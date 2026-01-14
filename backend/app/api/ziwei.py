"""紫微斗數占卜 API"""

import json
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional

from app.core.database import get_db
from app.core.config import get_settings, BASE_DIR
from app.models.user import User
from app.models.settings import AIConfig
from app.models.history import History
from app.utils.auth import get_current_user, decrypt_api_key
from app.services.ziwei import ZiweiService
from app.services.ai import get_ai_service

router = APIRouter(prefix="/api/ziwei", tags=["紫微斗數"], redirect_slashes=False)
settings = get_settings()

SYSTEM_PROMPT_PATH = Path(BASE_DIR) / "prompts" / "ziwei_system.md"


class CalculateRequest(BaseModel):
    name: str
    gender: str
    birth_date: datetime
    birth_location: str
    is_twin: bool = False
    twin_order: Optional[str] = None


class CalculateResponse(BaseModel):
    natal_chart: dict
    message: str



class ZiweiDivinationRequest(BaseModel):
    birth_data_id: Optional[int] = None
    name: str
    gender: str
    birth_date: datetime
    birth_location: str
    is_twin: bool = False
    twin_order: Optional[str] = None
    query_type: str = Field(..., pattern="^(natal|yearly|monthly|daily)$")
    query_date: Optional[datetime] = None
    question: str = Field(..., min_length=1, max_length=500)
    chart_data: Optional[dict] = None  # Frontend generated chart JSON
    prompt_context: Optional[str] = None  # Frontend generated AI prompt text


class DivinationResponse(BaseModel):
    id: int
    status: str
    message: str


async def process_ziwei_divination(history_id: int, db_url: str):
    """背景處理紫微斗數占卜(AI 解讀)"""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    try:
        history = db.query(History).filter(History.id == history_id).first()
        if not history:
            return

        history.status = "processing"
        db.commit()

        ai_config = (
            db.query(AIConfig)
            .filter(AIConfig.user_id == history.user_id, AIConfig.is_active == True)
            .first()
        )

        if not ai_config:
            history.status = "error"
            history.interpretation = "錯誤：未設定 AI 服務"
            db.commit()
            return

        try:
            api_key = None
            if ai_config.api_key_encrypted:
                api_key = decrypt_api_key(ai_config.api_key_encrypted)

            ai_service = get_ai_service(
                ai_config.provider,
                api_key=api_key,
                base_url=ai_config.local_url,
                model=ai_config.effective_model
            )
        except Exception as e:
            history.status = "error"
            history.interpretation = f"錯誤：AI 服務初始化失敗 - {str(e)}"
            db.commit()
            return

        system_prompt = ""
        if SYSTEM_PROMPT_PATH.exists():
            system_prompt = SYSTEM_PROMPT_PATH.read_text(encoding="utf-8")

        chart_data_json = json.loads(history.chart_data)
        
        # Check if we have pre-generated prompt context from frontend
        if "prompt_context" in chart_data_json:
             chart_text = chart_data_json["prompt_context"]
        else:
            # Fallback to backend formatting (legacy)
            natal_chart = chart_data_json["natal_chart"]
            horoscope = chart_data_json.get("horoscope")
            is_twin_younger = (
                chart_data_json["birth_info"].get("is_twin")
                and chart_data_json["birth_info"].get("twin_order") == "younger"
            )
            chart_text = ZiweiService.format_for_ai(natal_chart, horoscope, is_twin_younger)

        user_prompt = f"""
【用戶問題】
{history.question}

【命盤資料】
{chart_text}
"""

        try:
            interpretation = await ai_service.generate(
                prompt=user_prompt, system_prompt=system_prompt
            )

            history.interpretation = interpretation
            history.status = "completed"
            history.ai_provider = ai_config.provider
            history.ai_model = ai_config.effective_model
        except Exception as e:
            history.status = "error"
            history.interpretation = f"AI 解讀失敗：{str(e)}"

        db.commit()

    except Exception as e:
        if history:
            history.status = "error"
            history.interpretation = f"系統錯誤：{str(e)}"
            db.commit()
    finally:
        db.close()


@router.post("/calculate", response_model=CalculateResponse)
def calculate_natal_chart(
    data: CalculateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        natal_chart = ZiweiService.generate_natal_chart(
            name=data.name,
            gender=data.gender,
            birth_datetime=data.birth_date,
            location=data.birth_location,
            is_twin=data.is_twin,
            twin_order=data.twin_order,
        )

        return {"natal_chart": natal_chart, "message": "排盤成功"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"排盤失敗：{str(e)}")


@router.post("", response_model=DivinationResponse)
async def create_divination(
    data: ZiweiDivinationRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ai_config = (
        db.query(AIConfig)
        .filter(AIConfig.user_id == current_user.id, AIConfig.is_active == True)
        .first()
    )

    if not ai_config:
        raise HTTPException(status_code=400, detail="請先設定 AI 服務")

    if data.query_type != "natal" and not data.query_date:
        raise HTTPException(status_code=400, detail="流年/流月/流日需要提供查詢日期")

    try:
        if data.chart_data:
            # Frontend provided chart data
            final_chart_data = data.chart_data
            # Inject prompt context if provided
            if data.prompt_context:
                final_chart_data["prompt_context"] = data.prompt_context
        else:
            # Backward compatibility: Backend calculation
            # Generate chart first to validate data
            natal_chart = ZiweiService.generate_natal_chart(
                name=data.name,
                gender=data.gender,
                birth_datetime=data.birth_date,
                location=data.birth_location,
                is_twin=data.is_twin,
                twin_order=data.twin_order,
            )

            horoscope = None
            if data.query_type != "natal":
                natal_chart_json = json.dumps(natal_chart, ensure_ascii=False)
                horoscope = ZiweiService.generate_horoscope(
                    natal_chart_json, data.query_date, data.query_type
                )

            final_chart_data = {
                "natal_chart": natal_chart,
                "horoscope": horoscope,
                "birth_info": natal_chart["birth_info"],
                "query_type": data.query_type,
                "query_date": data.query_date.isoformat() if data.query_date else None,
                "birth_data_id": data.birth_data_id
            }

        history = History(
            user_id=current_user.id,
            divination_type="ziwei",
            question=data.question,
            gender=data.gender,
            chart_data=json.dumps(final_chart_data, ensure_ascii=False),
            status="pending",
        )
        db.add(history)
        db.commit()
        db.refresh(history)

        background_tasks.add_task(
            process_ziwei_divination, history.id, str(settings.DATABASE_URL)
        )

        return {
            "id": history.id,
            "status": "pending",
            "message": "占卜建立成功，AI 解讀中...",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"占卜建立失敗：{str(e)}")


@router.post("/{history_id}/cancel")
def cancel_divination(
    history_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    history = (
        db.query(History)
        .filter(History.id == history_id, History.user_id == current_user.id)
        .first()
    )

    if not history:
        raise HTTPException(status_code=404, detail="找不到該占卜記錄")

    if history.status not in ["pending", "processing"]:
        raise HTTPException(status_code=400, detail="無法取消已完成的占卜")

    history.status = "cancelled"
    history.interpretation = "用戶取消"
    db.commit()

    return {"status": "success", "message": "已取消占卜"}
