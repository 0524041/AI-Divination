"""
AI 服務模組
"""
import httpx
from typing import Optional, AsyncGenerator
from app.core.config import get_settings
from app.utils.auth import decrypt_api_key

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
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"
        self.model = "gemini-2.0-flash"
    
    async def generate(self, prompt: str, system_prompt: str) -> str:
        """生成回應"""
        url = f"{self.base_url}/models/{self.model}:generateContent?key={self.api_key}"
        
        payload = {
            "contents": [
                {"role": "user", "parts": [{"text": prompt}]}
            ],
            "systemInstruction": {
                "parts": [{"text": system_prompt}]
            },
            "generationConfig": {
                "temperature": 0.7,
                "maxOutputTokens": 8192,
            }
        }
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
            
            if "candidates" in data and len(data["candidates"]) > 0:
                return data["candidates"][0]["content"]["parts"][0]["text"]
            return ""


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
            "temperature": 0.7,
            "max_tokens": 8192,
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
