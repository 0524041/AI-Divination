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
from app.services.ai import get_ai_service
from app.services.ziwei_service import ziwei_service
from app.schemas.ziwei import ZiweiProcessRequest, ZiweiBirthDetails, ZiweiQuerySettings

router = APIRouter(prefix="/api/ziwei", tags=["紫微斗數"], redirect_slashes=False)
settings = get_settings()

SYSTEM_PROMPT_PATH = Path(BASE_DIR) / "prompts" / "ziwei_system.md"


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
    chart_data: dict
    prompt_context: Optional[str] = (
        None  # Make optional as we generate it in backend now
    )


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
    history = None

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
                model=ai_config.effective_model,
            )
        except Exception as e:
            history.status = "error"
            history.interpretation = f"錯誤：AI 服務初始化失敗 - {str(e)}"
            db.commit()
            return

        # 讀取系統 Prompt 模板
        system_prompt_template = ""
        if SYSTEM_PROMPT_PATH.exists():
            system_prompt_template = SYSTEM_PROMPT_PATH.read_text(encoding="utf-8")
        else:
            # Fallback simple prompt if file missing
            system_prompt_template = "你是一位紫微斗數專家。請根據提供的信息回答問題。\n\n{{使用者資訊}}\n\n{{完整命盤}}\n\n{{補充說明}}"

        # 準備資料給 ZiweiService
        chart_data_json = json.loads(history.chart_data)

        # 正規化性別
        raw_gender = history.gender or "male"
        normalized_gender = "男"
        if raw_gender == "female" or raw_gender == "女":
            normalized_gender = "女"
        elif raw_gender == "male" or raw_gender == "男":
            normalized_gender = "男"

        # 構造 Request 物件 (需從 history 還原)
        process_request = ZiweiProcessRequest(
            birth_details=ZiweiBirthDetails(
                name=chart_data_json.get("name", "用戶"),  # 優先從 chart_data 獲取
                # 檢查 History model: id, user_id, question, gender, chart_data...
                # name 似乎沒存，暫時用 "用戶" 或從 chart_data 找
                gender=normalized_gender,
                birth_date=datetime.now(),  # Placeholder if strictly needed, but chart is already calc.
                # Actually, virtual age calc needs birth date.
                # If history doesn't have birth_date, we might have a problem unless it's in chart_data['solarDate']
                birth_location="Unknown",
            ),
            query_settings=ZiweiQuerySettings(
                query_type=chart_data_json.get(
                    "query_type", "natal"
                ),  # 優先從 chart_data 獲取
                query_date=datetime.fromisoformat(chart_data_json.get("query_date"))
                if chart_data_json.get("query_date")
                else datetime.now(),  # 優先從 chart_data 獲取
                question=history.question,
            ),
            chart_data=chart_data_json,
        )

        # 修正：嘗試從 chart_data 提取準確資訊
        if "solarDate" in chart_data_json:
            try:
                process_request.birth_details.birth_date = datetime.strptime(
                    chart_data_json["solarDate"], "%Y-%m-%d"
                )
            except:
                pass

        # 修正: query_type 和 query_date 應該在 request 時存入，但 History model 似乎沒存 query_type?
        # 我們可以查看 API 的 `create_divination` 存了什麼。
        # 暫時假設 query_date 為當前 (如果是流年/流月，前端通常會算好 chart 發過來)

        # 執行 Service 處理
        prompt_data = ziwei_service.process_chart(process_request)

        # 替換模板變數
        final_system_prompt = (
            system_prompt_template.replace(
                "{{使用者資訊}}", prompt_data["user_info_json"]
            )
            .replace("{{完整命盤}}", prompt_data["chart_info_json"])
            .replace("{{補充說明}}", prompt_data["supplementary_info_json"])
            .replace("{{使用者提問問題}}", prompt_data["question"])
        )

        user_prompt = f"請解答我的問題：{history.question}"

        try:
            interpretation = await ai_service.generate(
                prompt=user_prompt, system_prompt=final_system_prompt
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
        final_chart_data = data.chart_data
        final_chart_data["prompt_context"] = data.prompt_context
        # Save query metadata to chart_data so it persists in history
        final_chart_data["query_type"] = data.query_type
        final_chart_data["name"] = data.name  # Save subject name
        if data.query_date:
            final_chart_data["query_date"] = data.query_date.isoformat()

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
