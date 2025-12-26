"""
AI Service - AI 調用服務
"""
import os
import json
import time
import random
import urllib.request
import urllib.error
from pathlib import Path

from ..core.config import get_config
from ..core.database import get_setting

# Gemini Setup (可選)
try:
    from google import genai
    from google.genai import types
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    genai = None
    types = None

config = get_config()

# Gemini Model - 使用 gemini-3-flash-preview 配合高級思考模式
MODEL_ID = "gemini-3-flash-preview"


def retry_api_call(func, *args, max_retries=3, base_delay=2, **kwargs):
    """
    Retries an API call with exponential backoff for 429 and 503 errors.
    """
    for attempt in range(max_retries):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            error_str = str(e)
            is_429 = "429" in error_str or "RESOURCE_EXHAUSTED" in error_str
            is_503 = "503" in error_str or "Service Unavailable" in error_str
            
            if not (is_429 or is_503):
                raise e
            
            if attempt == max_retries - 1:
                print(f"Max retries reached for error: {error_str}")
                raise e
            
            sleep_time = base_delay * (2 ** attempt) + random.uniform(0, 1)
            print(f"API Limit/Error ({'429' if is_429 else '503'}). Retrying in {sleep_time:.2f}s... (Attempt {attempt+1}/{max_retries})")
            time.sleep(sleep_time)


def get_system_prompt() -> str:
    """
    Loads the system prompt from prompts/system_prompt.md.
    """
    try:
        # 嘗試從 backend/prompts 讀取
        prompt_path = config.PROMPTS_DIR / 'system_prompt.md'
        if prompt_path.exists():
            with open(prompt_path, 'r', encoding='utf-8') as f:
                return f.read()
        
        # 備用：從專案根目錄的 prompts 讀取
        fallback_path = config.BASE_DIR.parent / 'prompts' / 'system_prompt.md'
        if fallback_path.exists():
            with open(fallback_path, 'r', encoding='utf-8') as f:
                return f.read()
                
    except Exception as e:
        print(f"Error loading prompt: {e}")
    
    return """你是一個精通易經八卦六爻算命的算命師。<問題>{question}<內容>{divination_result}"""


def format_divination_result(data: dict) -> str:
    """
    Formats the raw divination result into a human-readable string for the AI prompt.
    """
    if not data or not isinstance(data, dict):
        return str(data)
    
    if "error" in data:
        return f"錯誤：{data['error']}"

    lines = []
    lines.append("【基礎資訊】")
    lines.append(f"起卦時間：{data.get('time', '未知')}")
    lines.append(f"干支：{data.get('bazi', '未知')}")
    lines.append(f"空亡：{data.get('kongwang', '未知')}")
    
    shensha_data = data.get('shensha', [])
    if shensha_data:
        shensha_list = [f"{s.get('name', '未知')}-{','.join(s.get('zhi', []))}" for s in shensha_data]
        lines.append(f"神煞：{', '.join(shensha_list)}")
    else:
        lines.append("神煞：無")
    lines.append("")

    lines.append("【卦象結構】")
    lines.append(f"本卦：{data.get('benguaming', '未知')}")
    lines.append(f"變卦：{data.get('bianguaming', '未知')}")
    lines.append("")

    lines.append("【六爻排盤】")
    
    yao_names = {
        "yao_6": "上爻",
        "yao_5": "五爻",
        "yao_4": "四爻",
        "yao_3": "三爻",
        "yao_2": "二爻",
        "yao_1": "初爻"
    }

    for key in ["yao_6", "yao_5", "yao_4", "yao_3", "yao_2", "yao_1"]:
        yao = data.get(key)
        if not yao:
            continue
        
        liushen = yao.get('liushen', '')
        origin = yao.get('origin', {})
        
        marker = ""
        if origin.get('is_subject'):
            marker = "[世] "
        elif origin.get('is_object'):
            marker = "[應] "
            
        relative = origin.get('relative', '')
        zhi = origin.get('zhi', '')
        wuxing = origin.get('wuxing', '')
        
        line_text = f"{yao_names[key]}：{marker}{relative}{zhi}{wuxing} ({liushen})"
        
        if origin.get('is_changed'):
            variant = yao.get('variant', {})
            v_relative = variant.get('relative', '')
            v_zhi = variant.get('zhi', '')
            v_wuxing = variant.get('wuxing', '')
            line_text += f" ——動變——> {v_relative}{v_zhi}{v_wuxing}"
            
        lines.append(line_text)
        
    return "\n".join(lines)


def call_local_ai(prompt: str, api_url: str, model_name: str) -> str:
    """
    Calls a local OpenAI-compatible API.
    """
    headers = {
        "Content-Type": "application/json"
    }
    
    url = api_url.rstrip('/')
    if not url.endswith('/chat/completions'):
        url = f"{url}/chat/completions"
        
    payload = {
        "model": model_name,
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": 1.0
    }
    
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers=headers)
    
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            result = json.loads(response.read().decode('utf-8'))
            return result['choices'][0]['message']['content']
    except Exception as e:
        raise Exception(f"Local AI Error: {e}")


def call_gemini(prompt: str, api_key: str) -> str:
    """
    Calls Gemini API with thinking mode.
    """
    if not GEMINI_AVAILABLE:
        raise Exception("Gemini SDK not installed. Please install google-genai package.")
    
    client = genai.Client(api_key=api_key)
    config = types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(thinking_level="high")
    )
    
    response = retry_api_call(
        client.models.generate_content,
        model=MODEL_ID,
        contents=[prompt],
        config=config
    )
    
    return response.text


def call_ai(prompt: str, provider: str = 'local', user_gemini_key: str = None) -> tuple[str, str]:
    """
    統一的 AI 調用入口
    
    Args:
        prompt: 完整的提示詞
        provider: AI 提供者 ('local' 或 'gemini')
        user_gemini_key: 用戶的 Gemini API Key
    
    Returns:
        tuple: (AI 回應內容, 使用的模型名稱)
    """
    if provider == 'gemini':
        if not user_gemini_key:
            raise Exception("使用 Gemini 需要提供 API Key，請在設定中填入您的 API Key")
        
        try:
            result = call_gemini(prompt, user_gemini_key)
            return result, MODEL_ID
        except Exception as e:
            error_msg = str(e)
            if "API key" in error_msg or "401" in error_msg or "403" in error_msg:
                raise Exception("Gemini API Key 無效，請檢查您的 API Key")
            raise e
    
    else:  # Default to local AI
        local_url = get_setting('local_api_url', 'http://localhost:1234/v1')
        local_model = get_setting('local_model_name', 'qwen/qwen3-8b')
        print(f"Calling Local AI: {local_model} at {local_url}")
        result = call_local_ai(prompt, local_url, local_model)
        return result, local_model
