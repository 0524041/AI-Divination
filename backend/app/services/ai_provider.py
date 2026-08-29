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

# --- 固定請求參數（全域預設；可被 preset／連線的 per-model 參數覆蓋） ---
REQUEST_TEMPERATURE = 0.9
THINKING_LEVEL = 0.9
DEFAULT_TIMEOUT_SECONDS = 300.0
# 推理型模型會先輸出大量 reasoning_content，預留足夠空間給正文
MAX_OUTPUT_TOKENS = 16384


class _Unset:
    """區分「未指定」（繼承上層/預設）與 None（明確停用）的 sentinel"""

    def __repr__(self) -> str:
        return "UNSET"


UNSET = _Unset()


@dataclass
class ModelCallParams:
    """單一模型的呼叫參數（spec: ai-model-selection）

    - UNSET：未指定（合併時繼承上層）
    - reasoning_param: 思考參數名稱（如 "reasoning_effort"、"thinking_level"）；
      None 表示此模型不送任何思考參數
    - reasoning_value: 思考程度值（字串 low/medium/high 或數值；Agnes 閘道只收字串）
    - temperature / max_tokens: UNSET 時用全域預設
    """

    reasoning_param: str | None | _Unset = UNSET
    reasoning_value: str | int | None | _Unset = UNSET
    temperature: float | None | _Unset = UNSET
    max_tokens: int | None | _Unset = UNSET


def effort_label(level: float) -> str:
    """將 0.0–1.0 的思考程度常數映射為線上協定的字串列舉"""
    if level < 0.34:
        return "low"
    if level < 0.67:
        return "medium"
    return "high"


DEFAULT_CALL_PARAMS = ModelCallParams(
    reasoning_param="reasoning_effort",
    reasoning_value=effort_label(THINKING_LEVEL),
    temperature=REQUEST_TEMPERATURE,
    max_tokens=MAX_OUTPUT_TOKENS,
)


def merge_call_params(*layers: ModelCallParams | None) -> ModelCallParams:
    """逐層合併呼叫參數：後層非 UNSET 的欄位覆蓋前層（None 是明確值，會覆蓋）"""
    merged = ModelCallParams()
    for layer in layers:
        if layer is None:
            continue
        for field in ("reasoning_param", "reasoning_value", "temperature", "max_tokens"):
            value = getattr(layer, field)
            if value is not UNSET:
                setattr(merged, field, value)
    return merged


def call_params_from_dict(raw: dict | None) -> ModelCallParams | None:
    """由 JSON 模型項目的 params dict 轉為 ModelCallParams

    未出現的欄位保持 UNSET；"reasoning_param": null 表示明確停用。
    raw 為空或非 dict → None（不覆蓋）。
    """
    if not isinstance(raw, dict) or not raw:
        return None
    return ModelCallParams(
        reasoning_param=raw.get("reasoning_param", UNSET),
        reasoning_value=raw.get("reasoning_value", UNSET),
        temperature=raw.get("temperature", UNSET),
        max_tokens=raw.get("max_tokens", UNSET),
    )


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
        call_params: ModelCallParams | None = None,
        protocol: str = "chat",
    ):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model
        self._call_params = call_params
        self.protocol = protocol  # "chat" | "responses"
        self._client = client or httpx.AsyncClient(timeout=timeout_seconds)
        self.last_usage: StreamUsage | None = None
        self.last_duration_ms: int | None = None

    async def aclose(self) -> None:
        """關閉底層 HTTP client（管線 finally 呼叫）"""
        await self._client.aclose()

    async def stream_messages(
        self,
        messages: list[dict[str, str]],
        call_params: ModelCallParams | None = None,
    ) -> AsyncIterator[dict]:
        """逐 delta 產生 {"type": "thinking"|"text", "text": str}

        完成後 last_usage 讀取 token 用量；失敗時 raise AIProviderError。
        call_params 覆蓋全域預設（spec: per-model 呼叫參數）。
        """
        params = merge_call_params(DEFAULT_CALL_PARAMS, self._call_params, call_params)
        self.last_usage = None
        payload = self._build_payload(messages, params)
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        try:
            async with self._client.stream(
                "POST",
                self._request_url(),
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
                    data = line[len("data:") :].strip()
                    if not data:
                        continue
                    if data == "[DONE]":
                        break
                    if self.protocol == "responses":
                        delta = self._parse_responses_chunk(data)
                    else:
                        delta = self._parse_chunk(data)
                    if delta is not None:
                        yield delta
        except httpx.TimeoutException as exc:
            raise AIProviderError("timeout", f"上游逾時：{exc}") from exc
        except httpx.HTTPError as exc:
            raise AIProviderError("upstream", f"連線失敗：{exc}") from exc

    def _request_url(self) -> str:
        """依 protocol 組出請求位址（容納含/不含 /v1 的 base_url）"""
        trimmed = self.base_url.rstrip("/")
        if self.protocol == "responses":
            if trimmed.endswith("/v1"):
                return f"{trimmed}/responses"
            return f"{trimmed}/v1/responses"
        return completions_url(self.base_url)

    def _build_payload(
        self, messages: list[dict[str, str]], params: ModelCallParams
    ) -> dict:
        """依 protocol 組出請求 payload"""
        if params.temperature is UNSET:
            temperature: float | None = REQUEST_TEMPERATURE
        else:
            temperature = params.temperature
        if params.max_tokens is UNSET:
            max_tokens = MAX_OUTPUT_TOKENS
        else:
            max_tokens = params.max_tokens

        if self.protocol == "responses":
            # OpenAI Responses API（OpenCode Go /v1/responses 相容模型）
            payload: dict = {
                "model": self.model,
                "input": [
                    {
                        "role": m["role"],
                        "content": [{"type": "input_text", "text": m["content"]}],
                    }
                    for m in messages
                ],
                "max_output_tokens": max_tokens,
                "stream": True,
            }
            # 思考程度：Responses API 只有 reasoning.effort（low/medium/high）
            if params.reasoning_param is not UNSET and params.reasoning_param:
                value = (
                    params.reasoning_value
                    if params.reasoning_value not in (None, UNSET)
                    else effort_label(THINKING_LEVEL)
                )
                payload["reasoning"] = {"effort": value}
            if temperature is not None:
                payload["temperature"] = temperature
            return payload

        # OpenAI chat/completions
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }
        if params.reasoning_param is UNSET:
            payload["reasoning_effort"] = effort_label(THINKING_LEVEL)
        elif params.reasoning_param and params.reasoning_value is not None:
            payload[params.reasoning_param] = params.reasoning_value
        return payload

    def _parse_responses_chunk(self, payload: str) -> dict | None:
        """解析 Responses API 事件；usage 於 response.completed 寫入 last_usage"""
        try:
            data = json.loads(payload)
        except json.JSONDecodeError:
            return None

        event_type = data.get("type", "")
        if event_type == "response.output_text.delta":
            delta = data.get("delta")
            return {"type": "text", "text": delta} if delta else None
        if event_type in (
            "response.reasoning_summary_text.delta",
            "response.reasoning_text.delta",
        ):
            delta = data.get("delta")
            return {"type": "thinking", "text": delta} if delta else None
        if event_type == "response.completed":
            usage = (data.get("response") or {}).get("usage") or {}
            self.last_usage = StreamUsage(
                prompt_tokens=usage.get("input_tokens"),
                completion_tokens=usage.get("output_tokens"),
            )
            return None
        if event_type == "response.failed":
            error = (data.get("response") or {}).get("error") or {}
            message = error.get("message") or "上游回應失敗"
            raise AIProviderError("upstream", f"上游回應失敗：{message}")
        return None

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
