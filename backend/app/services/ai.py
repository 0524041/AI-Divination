"""
AI 服務模組
"""
import httpx
import logging
import asyncio
import random
from typing import Optional, AsyncGenerator, Any, Callable
from app.core.config import get_settings
from app.utils.auth import decrypt_api_key
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

settings = get_settings()


class AIService:
    """AI 服務基類"""
    
    async def generate(self, prompt: str, system_prompt: str) -> str:
        """生成回應"""
        raise NotImplementedError
    
    async def generate_stream(self, prompt: str, system_prompt: str) -> AsyncGenerator[str, None]:
        """串流生成回應"""
        raise NotImplementedError

class GeminiService(AIService):
    """Google Gemini AI 服務"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.model = "gemini-3-flash-preview"
        self.client = genai.Client(api_key=api_key, http_options={'api_version': 'v1alpha'})
    
    async def _retry_async(self, func: Callable, *args, max_retries: int = 3, base_delay: float = 2.0, **kwargs) -> Any:
        """非同步重試邏輯"""
        for attempt in range(max_retries):
            try:
                return await func(*args, **kwargs)
            except Exception as e:
                error_str = str(e)
                is_429 = "429" in error_str or "RESOURCE_EXHAUSTED" in error_str
                is_503 = "503" in error_str or "Service Unavailable" in error_str
                
                # 🔴 重點修改：遇到 429/503 立即終止，不重試
                if is_429:
                    logger.error(f"Gemini API 配額已用完 (429 RESOURCE_EXHAUSTED)")
                    raise Exception("⚠️ Gemini API 配額已用完，請稍後再試或檢查 API 配額限制") from e
                
                if is_503:
                    logger.error(f"Gemini API 服務不可用 (503 Service Unavailable)")
                    raise Exception("⚠️ Gemini API 服務暫時不可用，請稍後再試") from e
                
                # 其他錯誤：如果是最後一次嘗試，直接拋出
                if attempt == max_retries - 1:
                    logger.error(f"Gemini API Error (Attempt {attempt+1}/{max_retries}): {error_str}")
                    raise e
                
                # 其他錯誤：重試
                sleep_time = base_delay * (2 ** attempt) + random.uniform(0, 1)
                logger.warning(f"Gemini API Error. Retrying in {sleep_time:.2f}s... (Attempt {attempt+1}/{max_retries})")
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
                config=config
            )
            return response.text
        except Exception as e:
            logger.error(f"Error in Gemini generate: {e}")
            raise e

class LocalAIService(AIService):
    """本地 AI 服務 (OpenAI 兼容)"""
    
    def __init__(self, base_url: str, model: str):
        self.base_url = base_url.rstrip('/')
        self.model = model
    
    async def generate(self, prompt: str, system_prompt: str) -> str:
        """生成回應"""
        url = f"{self.base_url}/v1/chat/completions"
        
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            "temperature": 1.0,
            "max_tokens": 16384,
        }
        
        async with httpx.AsyncClient(timeout=300.0) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
            
            if "choices" in data and len(data["choices"]) > 0:
                return data["choices"][0]["message"]["content"]
            return ""
    
    @staticmethod
    async def test_connection(base_url: str) -> dict:
        """測試連線"""
        try:
            url = f"{base_url.rstrip('/')}/v1/models"
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url)
                response.raise_for_status()
                data = response.json()
                
                models = []
                if "data" in data:
                    models = [m.get("id", "") for m in data["data"]]
                
                return {"success": True, "models": models}
        except Exception as e:
            return {"success": False, "error": str(e)}


def get_ai_service(provider: str, **kwargs) -> AIService:
    """取得 AI 服務實例"""
    if provider == "gemini":
        api_key = kwargs.get("api_key")
        if not api_key:
            raise ValueError("Gemini API Key 未提供")
        return GeminiService(api_key)
    elif provider == "local":
        base_url = kwargs.get("base_url")
        model = kwargs.get("model")
        if not base_url or not model:
            raise ValueError("Local AI URL 或模型未提供")
        return LocalAIService(base_url, model)
    else:
        raise ValueError(f"不支援的 AI 提供者: {provider}")
