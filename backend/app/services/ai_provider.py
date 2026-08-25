"""
統一 AI Provider（ADR-0001）

單一 OpenAI-compatible adapter：所有非 OAuth 的供應商一律以
base_url + api_key + model 接入，串流回應。

溫度與思考程度為程式碼常數（皆 0.9），不開放任何設定介面。
思考程度經 effort_label() 映射為線上協定接受的字串
（low/medium/high；數值型 reasoning_effort 已被 Agnes 閘道拒絕，見 ADR-0001 補充）。

錯誤分類：auth（401/403）、quota（429）、timeout、upstream（其餘）。
"""

import json
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass

import httpx

# --- 固定請求參數（刻意不設設定檔/DB 欄位：管理者不可調） ---
REQUEST_TEMPERATURE = 0.9
THINKING_LEVEL = 0.9
DEFAULT_TIMEOUT_SECONDS = 300.0


def effort_label(level: float) -> str:
    """將 0.0–1.0 的思考程度常數映射為線上協定的字串列舉"""
    if level < 0.34:
        return "low"
    if level < 0.67:
        return "medium"
    return "high"


def completions_url(base_url: str) -> str:
    """由端點 base_url 組出 chat/completions 位址（容納含/不含 /v1 兩種寫法）"""
    trimmed = base_url.rstrip("/")
    if trimmed.endswith("/v1"):
        return f"{trimmed}/chat/completions"
    return f"{trimmed}/v1/chat/completions"


@dataclass
class StreamUsage:
    prompt_tokens: int | None = None
    completion_tokens: int | None = None


class AIProviderError(Exception):
    """供應商呼叫失敗（kind: auth | quota | timeout | upstream）"""

    def __init__(self, kind: str, message: str, status_code: int | None = None):
        super().__init__(message)
        self.kind = kind
        self.status_code = status_code


class OpenAICompatProvider:
    """OpenAI-compatible 串流客戶端"""

    def __init__(
        self,
        base_url: str,
        api_key: str,
        model: str,
        timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
        client: httpx.AsyncClient | None = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model
        self._client = client or httpx.AsyncClient(timeout=timeout_seconds)
        self.last_usage: StreamUsage | None = None
        self.last_duration_ms: int | None = None

    async def stream_messages(
        self, messages: list[dict[str, str]]
    ) -> AsyncIterator[dict]:
        """逐 delta 產生 {"type": "thinking"|"text", "text": str}

        完成後 last_usage 讀取 token 用量；失敗時 raise AIProviderError。
        """
        self.last_usage = None
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": REQUEST_TEMPERATURE,
            "reasoning_effort": effort_label(THINKING_LEVEL),
            "stream": True,
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        try:
            async with self._client.stream(
                "POST",
                completions_url(self.base_url),
                json=payload,
                headers=headers,
            ) as response:
                if response.status_code != 200:
                    body = (await response.aread()).decode("utf-8", errors="replace")
                    raise self._http_error(response.status_code, body)

                content_type = response.headers.get("content-type", "")
                if "text/event-stream" not in content_type:
                    body = (await response.aread()).decode("utf-8", errors="replace")
                    raise AIProviderError(
                        "upstream",
                        f"上游未回傳串流（content-type={content_type}）：{body[:200]}",
                        response.status_code,
                    )

                async for line in response.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    payload = line[len("data:") :].strip()
                    if not payload:
                        continue
                    if payload == "[DONE]":
                        break
                    delta = self._parse_chunk(payload)
                    if delta is not None:
                        yield delta
        except httpx.TimeoutException as exc:
            raise AIProviderError("timeout", f"上游逾時：{exc}") from exc
        except httpx.HTTPError as exc:
            raise AIProviderError("upstream", f"連線失敗：{exc}") from exc

    def _parse_chunk(self, payload: str) -> dict | None:
        """解析一個 JSON chunk；回傳 delta dict 或 None（無內容）"""
        try:
            chunk = json.loads(payload)
        except json.JSONDecodeError:
            return None

        usage = chunk.get("usage")
        if isinstance(usage, dict):
            self.last_usage = StreamUsage(
                prompt_tokens=usage.get("prompt_tokens"),
                completion_tokens=usage.get("completion_tokens"),
            )

        choices = chunk.get("choices") or []
        if not choices:
            return None
        delta = choices[0].get("delta") or {}

        thinking = delta.get("reasoning_content")
        if thinking:
            return {"type": "thinking", "text": thinking}
        text = delta.get("content")
        if text:
            return {"type": "text", "text": text}
        return None

    @staticmethod
    def _http_error(status_code: int, body: str) -> AIProviderError:
        if status_code in (401, 403):
            return AIProviderError(
                "auth",
                f"金鑰驗證失敗（HTTP {status_code}）：{body[:200]}",
                status_code,
            )
        if status_code == 429:
            return AIProviderError(
                "quota", f"額度用盡或限流（HTTP 429）：{body[:200]}", status_code
            )
        return AIProviderError(
            "upstream", f"上游錯誤（HTTP {status_code}）：{body[:200]}", status_code
        )


async def timed_stream(
    provider: OpenAICompatProvider, messages: list[dict[str, str]]
) -> AsyncIterator[dict]:
    """量測耗時的串流包裝（duration_ms 於結束/拋錯時寫入 provider.last_duration_ms）"""
    start = time.monotonic()
    try:
        async for delta in provider.stream_messages(messages):
            yield delta
    finally:
        provider.last_duration_ms = int((time.monotonic() - start) * 1000)
