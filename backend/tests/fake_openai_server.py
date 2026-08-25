"""
假 OpenAI-compatible 伺服器（測試夾具）

一支可腳本化的本地 ASGI 伺服器，模擬 /v1/chat/completions 與 /v1/models：
- 單發 JSON 完成
- SSE 逐 delta 串流（data: {...} ... data: [DONE]）
- 可注入 401/429/5xx 錯誤與人為延遲
- 記錄每個收到的請求，供測試斷言請求形狀

以真實 socket（uvicorn 執行於 ephemeral port）供應，
使 httpx/openai SDK 等任何客戶端都能對它發請求，不觸網。
"""

import json
import threading
import time
from typing import Any

import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse


class FakeOpenAICompatServer:
    """可腳本化的假 OpenAI-compatible 伺服器"""

    def __init__(self) -> None:
        self._app = FastAPI()

        # --- 可腳本化行為（測試直接設定這些屬性） ---
        # "json" | "stream" | "error"
        self.mode: str = "json"
        self.json_response: dict[str, Any] = {
            "id": "chatcmpl-fake",
            "object": "chat.completion",
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": "解盤結果"},
                    "finish_reason": "stop",
                }
            ],
            "usage": {"prompt_tokens": 10, "completion_tokens": 5},
        }
        self.stream_deltas: list[str] = ["第一句。", "第二句。", "第三句。"]
        # 結構化串流項目：[("thinking"|"text", str), ...]；設定後覆蓋 stream_deltas 行為
        self.stream_items: list[tuple[str, str]] = []
        # 串流結尾附加的 usage（模擬上游回傳 token 統計）
        self.stream_usage: dict[str, int] | None = None
        self.stream_delay: float = 0.0
        self.error_status: int = 401
        self.error_body: dict[str, Any] = {"error": {"message": "invalid api key"}}
        self.delay: float = 0.0
        self.models_response: dict[str, Any] = {
            "object": "list",
            "data": [{"id": "fake-model"}],
        }

        # --- 請求記錄 ---
        self.requests: list[dict[str, Any]] = []
        self._lock = threading.Lock()

        self._register_routes()

        self._app_ref = self._app
        config = uvicorn.Config(
            self._app_ref,
            host="127.0.0.1",
            port=0,
            log_level="error",
        )
        self._server = uvicorn.Server(config)
        self._thread = threading.Thread(target=self._server.run, daemon=True)

    def _record(self, request: Request, body: Any) -> None:
        with self._lock:
            self.requests.append(
                {
                    "method": request.method,
                    "path": request.url.path,
                    "headers": dict(request.headers),
                    "body": body,
                }
            )

    async def _read_body(self, request: Request) -> Any:
        raw = await request.body()
        if not raw:
            return None
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return raw.decode("utf-8", errors="replace")

    def _register_routes(self) -> None:
        app = self._app

        @app.post("/v1/chat/completions")
        async def chat_completions(request: Request):
            body = await self._read_body(request)
            self._record(request, body)

            if self.delay:
                time.sleep(self.delay)

            if self.mode == "error":
                return JSONResponse(
                    status_code=self.error_status, content=self.error_body
                )

            if self.mode == "stream":
                return StreamingResponse(
                    self._stream_events(),
                    media_type="text/event-stream",
                )

            return JSONResponse(content=self.json_response)

        @app.get("/v1/models")
        async def list_models(request: Request):
            self._record(request, None)
            if self.mode == "error":
                return JSONResponse(
                    status_code=self.error_status, content=self.error_body
                )
            return JSONResponse(content=self.models_response)

    async def _stream_events(self) -> Any:
        items = self.stream_items or [("text", t) for t in self.stream_deltas]
        for kind, text in items:
            if self.stream_delay:
                time.sleep(self.stream_delay)
            field = "reasoning_content" if kind == "thinking" else "content"
            chunk = {
                "id": "chatcmpl-fake-stream",
                "object": "chat.completion.chunk",
                "choices": [
                    {"index": 0, "delta": {field: text}, "finish_reason": None}
                ],
            }
            yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
        if self.stream_usage is not None:
            usage_chunk = {
                "id": "chatcmpl-fake-stream",
                "object": "chat.completion.chunk",
                "choices": [],
                "usage": self.stream_usage,
            }
            yield f"data: {json.dumps(usage_chunk)}\n\n"
        yield "data: [DONE]\n\n"

    # --- 生命週期 ---

    def start(self) -> "FakeOpenAICompatServer":
        self._thread.start()
        deadline = time.monotonic() + 10.0
        while not self._server.started:
            if time.monotonic() > deadline:
                raise RuntimeError("FakeOpenAICompatServer failed to start")
            time.sleep(0.02)
        return self

    def stop(self) -> None:
        self._server.should_exit = True
        self._thread.join(timeout=5.0)

    @property
    def base_url(self) -> str:
        socket = self._server.servers[0].sockets[0]
        host, port = socket.getsockname()[:2]
        return f"http://{host}:{port}"

    def clear_requests(self) -> None:
        with self._lock:
            self.requests.clear()

    @property
    def last_request(self) -> dict[str, Any]:
        with self._lock:
            return self.requests[-1]

    # --- 行為捷徑 ---

    def respond_json(self, content: str | None = None) -> None:
        """單發完成；可自訂回覆文字"""
        self.mode = "json"
        if content is not None:
            self.json_response = {
                "id": "chatcmpl-fake",
                "object": "chat.completion",
                "choices": [
                    {
                        "index": 0,
                        "message": {"role": "assistant", "content": content},
                        "finish_reason": "stop",
                    }
                ],
                "usage": {"prompt_tokens": 10, "completion_tokens": 5},
            }

    def respond_stream(self, deltas: list[str]) -> None:
        """逐 delta SSE 串流（純文字內容）"""
        self.mode = "stream"
        self.stream_items = []
        self.stream_deltas = deltas

    def respond_stream_items(self, items: list[tuple[str, str]]) -> None:
        """逐 delta SSE 串流，含 thinking/text 分流"""
        self.mode = "stream"
        self.stream_items = items

    def respond_error(self, status_code: int, message: str | None = None) -> None:
        """注入 HTTP 錯誤（401/429/500...）"""
        self.mode = "error"
        self.error_status = status_code
        if message is not None:
            self.error_body = {"error": {"message": message}}
