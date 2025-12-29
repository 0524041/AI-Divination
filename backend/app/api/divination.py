"""
占卜 API 路由
"""
import json
from pathlib import Path
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional

from app.core.database import get_db
from app.core.config import get_settings, BASE_DIR
from app.models.user import User
from app.models.settings import AIConfig
from app.models.history import History
from app.utils.auth import get_current_user, decrypt_api_key
from app.services.liuyao import perform_divination
from app.services.ai import get_ai_service

router = APIRouter(prefix="/api/divination", tags=["占卜"])
settings = get_settings()

# 讀取 system prompt
SYSTEM_PROMPT_PATH = Path(BASE_DIR) / "prompts" / "system_prompt.md"


# ========== Schemas ==========

class LiuYaoRequest(BaseModel):
    """六爻占卜請求"""
    question: str = Field(..., min_length=1, max_length=500)
    gender: Optional[str] = Field(None, description="'male' | 'female'")
    target: Optional[str] = Field(None, description="'self' | 'parent' | 'friend' | 'other'")


class DivinationResponse(BaseModel):
    """占卜回應"""
    id: int
    status: str
    coins: list
    chart_data: dict
    message: str


# ========== Background Tasks ==========

async def process_divination(history_id: int, db_url: str):
    """背景處理占卜 (AI 解盤)"""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    
    try:
        # 取得歷史紀錄
        history = db.query(History).filter(History.id == history_id).first()
        if not history:
            return
        
        history.status = "processing"
        db.commit()
        
        # 取得用戶的 AI 設定
        ai_config = db.query(AIConfig).filter(
            AIConfig.user_id == history.user_id,
            AIConfig.is_active == True
        ).first()
        
        if not ai_config:
            history.status = "error"
            history.interpretation = "錯誤：未設定 AI 服務"
            db.commit()
            return
        
        # 準備 AI 服務
        try:
            if ai_config.provider == "gemini":
                api_key = decrypt_api_key(ai_config.api_key_encrypted)
                ai_service = get_ai_service("gemini", api_key=api_key)
            else:
                ai_service = get_ai_service(
                    "local",
                    base_url=ai_config.local_url,
                    model=ai_config.local_model
                )
        except Exception as e:
            history.status = "error"
            history.interpretation = f"錯誤：AI 服務初始化失敗 - {str(e)}"
            db.commit()
            return
        
        # 讀取 system prompt
        system_prompt = ""
        if SYSTEM_PROMPT_PATH.exists():
            system_prompt = SYSTEM_PROMPT_PATH.read_text(encoding="utf-8")
        
        # 準備提示詞
        chart_data = json.loads(history.chart_data)
        user_prompt = f"""【六爻排盤詳情】
{chart_data.get('formatted', '')}

【用戶問題】
{history.question}

【算命對象】
性別：{history.gender or '未指定'}
對象：{history.target or '自己'}
"""
        
        # 呼叫 AI
        try:
            result = await ai_service.generate(user_prompt, system_prompt)
            history.interpretation = result
            history.ai_provider = ai_config.provider
            history.ai_model = ai_config.local_model if ai_config.provider == "local" else "gemini-3-flash-preview"
            history.status = "completed"
        except Exception as e:
            history.status = "error"
            history.interpretation = f"錯誤：AI 解盤失敗 - {str(e)}"
        
        db.commit()
        
    except Exception as e:
        print(f"Process divination error: {e}")
    finally:
        db.close()


# ========== Endpoints ==========

@router.post("/liuyao", response_model=DivinationResponse)
async def create_liuyao_divination(
    request: LiuYaoRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """六爻占卜"""
    # 檢查是否有 AI 設定
    ai_config = db.query(AIConfig).filter(
        AIConfig.user_id == current_user.id,
        AIConfig.is_active == True
    ).first()
    
    if not ai_config:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="請先在設定頁面配置 AI 服務"
        )
    
    # 執行占卜 (擲硬幣 + 排盤)
    result = perform_divination(question=request.question)
    
    # 儲存到歷史紀錄
    history = History(
        user_id=current_user.id,
        divination_type="liuyao",
        question=request.question,
        gender=request.gender,
        target=request.target,
        chart_data=json.dumps(result, ensure_ascii=False),
        status="pending"
    )
    db.add(history)
    db.commit()
    db.refresh(history)
    
    # 背景處理 AI 解盤
    background_tasks.add_task(
        process_divination,
        history.id,
        settings.DATABASE_URL
    )
    
    return DivinationResponse(
        id=history.id,
        status="pending",
        coins=result['yaogua'],
        chart_data=result,
        message="占卜已開始，AI 正在解盤中..."
    )


@router.post("/{history_id}/cancel")
def cancel_divination(
    history_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """取消占卜"""
    history = db.query(History).filter(
        History.id == history_id,
        History.user_id == current_user.id
    ).first()
    
    if not history:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="紀錄不存在"
        )
    
    if history.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="已完成的占卜無法取消"
        )
    
    history.status = "cancelled"
    db.commit()
    
    return {"message": "已取消"}
