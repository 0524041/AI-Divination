"""
AI 連線探測（spec: ai-model-selection）

測試 OpenAI-compatible 服務連線並取得候選模型清單。
安全強化：禁止跟隨重定向（防 SSRF 繞過）、檢查 Content-Type、限制回應大小。
"""

import json
import logging

import httpx

from app.services.ai_provider import OPENCODE_PROBE_SESSION_ID, session_headers

logger = logging.getLogger(__name__)


async def test_connection(
    base_url: str, session_id: str | None = None
) -> dict:
    """探測服務的模型清單；回傳 {success, models} 或 {success, error}

    非對話請求無會話 ID 時用固定探測值，滿足 OpenCode Go 的 header 要求。
    """
    MAX_SIZE = 1024 * 50  # 限制讀取 50KB
    headers = session_headers(session_id or OPENCODE_PROBE_SESSION_ID)

    async def fetch_safely(client, url):
        try:
            # 使用 stream=True 避免直接下載大檔案
            async with client.stream(
                "GET", url, headers=headers, follow_redirects=False
            ) as response:
                if response.status_code != 200:
                    return None

                content_type = response.headers.get("content-type", "").lower()
                if "application/json" not in content_type:
                    logger.warning(
                        f"Blocked non-JSON response from {url}: {content_type}"
                    )
                    return None

                content = b""
                async for chunk in response.aiter_bytes():
                    content += chunk
                    if len(content) > MAX_SIZE:
                        break

                return content
        except Exception as e:
            logger.warning(f"Connection test failed for {url}: {e}")
            return None

    try:
        # 較短的 timeout
        async with httpx.AsyncClient(timeout=5.0) as client:
            # 優先嘗試: OpenAI Compatible (/v1/models) - 支援 LM Studio, vLLM 等
            url_openai = f"{base_url.rstrip('/')}/v1/models"
            content = await fetch_safely(client, url_openai)

            if content:
                try:
                    data = json.loads(content)
                    models = []
                    if "data" in data:
                        models = [m.get("id", "") for m in data["data"]]
                    return {"success": True, "models": models}
                except json.JSONDecodeError:
                    pass

            # 備用嘗試: Ollama API (/api/tags)
            url_ollama = f"{base_url.rstrip('/')}/api/tags"
            content = await fetch_safely(client, url_ollama)

            if content:
                try:
                    data = json.loads(content)
                    models = []
                    if "models" in data:
                        models = [m.get("name", "") for m in data["models"]]
                    elif "data" in data:
                        models = [m.get("id", "") for m in data["data"]]
                    return {"success": True, "models": models}
                except json.JSONDecodeError:
                    pass

            return {
                "success": False,
                "error": "無法連接或服務回應格式不正確 (僅支援 JSON)",
            }

    except Exception as e2:
        return {"success": False, "error": str(e2)}
