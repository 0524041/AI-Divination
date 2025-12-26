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


def format_divination_result(data: dict, gender: str = None, target: str = None) -> str:
    """
    Formats the raw divination result into a human-readable string for the AI prompt.
    輸出格式更豐富，包含完整的六爻排盤信息。
    
    Args:
        data: 六爻排盤結果字典
        gender: 求測者性別 (男/女)
        target: 占卜對象 (自己/父母/朋友/他人)
    """
    if not data or not isinstance(data, dict):
        return str(data)
    
    if "error" in data:
        return f"錯誤：{data['error']}"

    lines = []
    
    # 分隔線
    sep = "=" * 60
    dash = "-" * 60
    
    lines.append(sep)
    lines.append(f"起卦時間: {data.get('time', '未知')}")
    lines.append(f"八字: {data.get('bazi', '未知')}")
    lines.append(f"空亡: {data.get('kongwang', '未知')}")
    lines.append(f"卦宮: {data.get('guashen', '未知')}")
    lines.append(f"本卦: {data.get('benguaming', '未知')}")
    biangua = data.get('bianguaming', '無變卦')
    lines.append(f"變卦: {biangua if biangua else '無變卦'}")
    
    # 求測者資訊
    if gender or target:
        lines.append(sep)
        if gender:
            lines.append(f"求測者性別: {gender}")
        if target:
            lines.append(f"占卜對象: {target}")
    
    lines.append(sep)
    
    # 神煞
    shensha_data = data.get('shensha', [])
    if shensha_data:
        shensha_parts = []
        for s in shensha_data:
            name = s.get('name', '未知')
            zhi_list = s.get('zhi', [])
            shensha_parts.append(f"{name}:{zhi_list}")
        lines.append(f"神煞: {', '.join(shensha_parts)}")
    else:
        lines.append("神煞: 無")
    
    lines.append(dash)
    
    # 表頭
    lines.append("爻位   六神     六親     地支   五行   爻象   世應   動    變爻")
    lines.append(dash)
    
    # 六爻詳情 (從上到下: 6爻 -> 1爻)
    for yao_num in [6, 5, 4, 3, 2, 1]:
        key = f"yao_{yao_num}"
        yao = data.get(key)
        if not yao:
            continue
        
        liushen = yao.get('liushen', '')
        origin = yao.get('origin', {})
        
        # 世應標記
        shi_ying = ""
        if origin.get('is_subject'):
            shi_ying = "世"
        elif origin.get('is_object'):
            shi_ying = "應"
        
        relative = origin.get('relative', '')
        zhi = origin.get('zhi', '')
        wuxing = origin.get('wuxing', '')
        line_symbol = origin.get('line', '⚊' if origin.get('is_yang', True) else '⚋')
        
        # 動爻標記
        is_moving = origin.get('is_changed', False)
        moving_mark = "○" if is_moving else ""
        
        # 變爻信息
        variant_str = ""
        if is_moving and yao.get('variant'):
            v = yao['variant']
            v_rel = v.get('relative', '')
            v_zhi = v.get('zhi', '')
            v_wuxing = v.get('wuxing', '')
            variant_str = f"→ {v_rel} {v_zhi}{v_wuxing}"
        
        # 格式化輸出行
        line_text = f"{yao_num}爻    {liushen:<5} {relative:<5} {zhi:<3} {wuxing:<3} {line_symbol:<3} {shi_ying:<3} {moving_mark:<3} {variant_str}"
        lines.append(line_text)
    
    lines.append(sep)
    
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
    
    print(f"[Local AI] Request URL: {url}")
    print(f"[Local AI] Model: {model_name}")
    print(f"[Local AI] Prompt length: {len(prompt)} chars")
        
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
        print(f"[Local AI] Sending request...")
        # 設定 timeout 為 5 分鐘 (300秒)，因為本地 AI 模型生成可能較慢
        with urllib.request.urlopen(req, timeout=300) as response:
            result = json.loads(response.read().decode('utf-8'))
            content = result['choices'][0]['message']['content']
            print(f"[Local AI] Response received, length: {len(content)} chars")
            return content
    except urllib.error.URLError as e:
        print(f"[Local AI] URLError: {e}")
        if hasattr(e, 'reason'):
            if 'timed out' in str(e.reason).lower():
                raise Exception(f"Local AI Error: 連線逾時 (超過 5 分鐘)，請檢查本地 AI 服務是否正常運作")
            raise Exception(f"Local AI Error: 無法連線到 {url} - {e.reason}")
        raise Exception(f"Local AI Error: {e}")
    except json.JSONDecodeError as e:
        print(f"[Local AI] JSON Decode Error: {e}")
        raise Exception(f"Local AI Error: 無法解析回應 JSON - {e}")
    except KeyError as e:
        print(f"[Local AI] Response format error: missing key {e}")
        raise Exception(f"Local AI Error: 回應格式錯誤，缺少欄位 {e}")
    except Exception as e:
        print(f"[Local AI] Error: {e}")
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
    print(f"[AI Service] call_ai() called with provider='{provider}'")
    
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
