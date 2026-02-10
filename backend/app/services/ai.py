"""
AI 服務模組
"""

import httpx
import logging
import asyncio
import random
import json
from typing import Optional, AsyncGenerator, Any, Callable
from app.core.config import get_settings
from app.utils.auth import decrypt_api_key
from google import genai
from google.genai import types

from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

settings = get_settings()


class AIService:
    """AI 服務基類"""

    async def generate(self, prompt: str, system_prompt: str) -> str:
        """生成回應"""
        raise NotImplementedError

    async def generate_stream(
        self, prompt: str, system_prompt: str
    ) -> AsyncGenerator[str, None]:
        """串流生成回應"""
        raise NotImplementedError


class GeminiService(AIService):
    """Google Gemini AI 服務"""

    def __init__(self, api_key: str, model: str = "gemini-3-flash-preview"):
        self.api_key = api_key
        self.model = model or "gemini-3-flash-preview"
        self.client = genai.Client(
            api_key=api_key, http_options={"api_version": "v1alpha"}
        )

    async def _retry_async(
        self,
        func: Callable,
        *args,
        max_retries: int = 3,
        base_delay: float = 2.0,
        **kwargs,
    ) -> Any:
        """非同步重試邏輯"""
        for attempt in range(max_retries):
            try:
                return await func(*args, **kwargs)
            except Exception as e:
                error_str = str(e)
                is_429 = "429" in error_str or "RESOURCE_EXHAUSTED" in error_str
                is_503 = "503" in error_str or "Service Unavailable" in error_str

                # 🔴 429 錯誤（配額用完）立即終止，不重試
                if is_429:
                    logger.error(f"Gemini API 配額已用完 (429 RESOURCE_EXHAUSTED)")
                    raise Exception(
                        "⚠️ Gemini API 配額已用完，請稍後再試或檢查 API 配額限制"
                    ) from e

                # 如果是最後一次嘗試，拋出友善錯誤訊息
                if attempt == max_retries - 1:
                    if is_503:
                        logger.error(
                            f"Gemini API 服務不可用 (503 Service Unavailable) - 已重試 {max_retries} 次"
                        )
                        raise Exception(
                            "⚠️ Gemini API 服務暫時不可用，已重試多次仍失敗，請稍後再試"
                        ) from e
                    else:
                        logger.error(
                            f"Gemini API Error (Attempt {attempt + 1}/{max_retries}): {error_str}"
                        )
                        raise e

                # 進行重試（包含 503 錯誤）
                sleep_time = base_delay * (2**attempt) + random.uniform(0, 1)
                error_type = "503 Service Unavailable" if is_503 else "API Error"
                logger.warning(
                    f"Gemini {error_type}. Retrying in {sleep_time:.2f}s... (Attempt {attempt + 1}/{max_retries})"
                )
                await asyncio.sleep(sleep_time)

    async def generate(self, prompt: str, system_prompt: str) -> str:
        """生成回應 (使用 Thinking Config)"""
        config = types.GenerateContentConfig(
            system_instruction=system_prompt,
            thinking_config=types.ThinkingConfig(thinking_level="high"),
            temperature=1.0,
            max_output_tokens=16384,
        )

        try:
            response = await self._retry_async(
                self.client.aio.models.generate_content,
                model=self.model,
                contents=prompt,
                config=config,
            )
            return response.text
        except Exception as e:
            logger.error(f"Error in Gemini generate: {e}")
            raise e


class OpenAIService(AIService):
    """OpenAI 官方服務 (使用 SDK)"""

    def __init__(self, api_key: str, model: str = "gpt-5.1"):
        self.client = AsyncOpenAI(api_key=api_key)
        self.model = model or "gpt-5.1"  # 預設 gpt-5.1, 但允許用戶自定義

    async def generate(self, prompt: str, system_prompt: str) -> str:
        """生成回應"""
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt},
                ],
                temperature=1.0,
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"Error in OpenAI generate: {e}")
            raise e


class CustomAIService(AIService):
    """其他 AI 服務 (OpenAI Compatible)"""

    def __init__(self, base_url: str, model: str, api_key: Optional[str] = None):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.api_key = api_key

    async def generate(self, prompt: str, system_prompt: str) -> str:
        """生成回應"""
        url = f"{self.base_url}/v1/chat/completions"

        headers = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            "temperature": 1.0,
            "max_tokens": 16384,
        }

        async with httpx.AsyncClient(timeout=300.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()

            if "choices" in data and len(data["choices"]) > 0:
                return data["choices"][0]["message"]["content"]
            return ""

    @staticmethod
    async def test_connection(base_url: str) -> dict:
        """
        測試連線 (安全強化版)
        防護措施:
        1. 禁止跟隨重定向 (防止繞過 SSRF 檢查)
        2. 檢查 Content-Type (防止下載二進制檔案)
        3. 限制回應大小 (防止 DoS)
        """
        MAX_SIZE = 1024 * 50  # 限制讀取 50KB

        async def fetch_safely(client, url):
            try:
                # 使用 stream=True 避免直接下載大檔案
                async with client.stream(
                    "GET", url, follow_redirects=False
                ) as response:
                    # 1. 檢查狀態碼
                    if response.status_code != 200:
                        return None

                    # 2. 檢查 Content-Type
                    content_type = response.headers.get("content-type", "").lower()
                    if "application/json" not in content_type:
                        logger.warning(
                            f"Blocked non-JSON response from {url}: {content_type}"
                        )
                        return None

                    # 3. 讀取限制大小的內容
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
            # 設置較短的 timeout
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


def get_ai_service(provider: str, **kwargs) -> AIService:
    """取得 AI 服務實例"""
    if provider == "gemini":
        api_key = kwargs.get("api_key")
        model = kwargs.get("model")
        if not api_key:
            raise ValueError("Gemini API Key 未提供")
        return GeminiService(api_key, model=model)

    elif provider == "openai":
        api_key = kwargs.get("api_key")
        model = kwargs.get("model")
        if not api_key:
            raise ValueError("OpenAI API Key 未提供")
        return OpenAIService(api_key, model=model)

    elif provider == "local" or provider == "custom":
        base_url = kwargs.get("base_url") or kwargs.get("local_url")
        model = kwargs.get("model") or kwargs.get("local_model")
        api_key = kwargs.get("api_key")  # Optional

        if not base_url or not model:
            raise ValueError("自定義 AI URL 或模型未提供")
        return CustomAIService(base_url, model, api_key)

    else:
        raise ValueError(f"不支援的 AI 提供者: {provider}")
