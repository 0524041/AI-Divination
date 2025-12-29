"""
歷史紀錄 API 路由
"""
import json
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.core.database import get_db
from app.models.user import User
from app.models.history import History
from app.utils.auth import get_current_user, get_admin_user

router = APIRouter(prefix="/api/history", tags=["歷史紀錄"])


# ========== Schemas ==========

class HistoryItem(BaseModel):
    """歷史紀錄項目"""
    id: int
    divination_type: str
    question: str
    gender: Optional[str]
    target: Optional[str]
    chart_data: dict
    interpretation: Optional[str]
    ai_provider: Optional[str]
    ai_model: Optional[str]
    status: str
    created_at: datetime
    username: Optional[str] = None  # Admin 查看時顯示


class HistoryListResponse(BaseModel):
    """歷史紀錄列表回應"""
    items: List[HistoryItem]
    total: int
    page: int
    page_size: int


# ========== Endpoints ==========

@router.get("", response_model=HistoryListResponse)
def get_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    divination_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """取得當前用戶的歷史紀錄"""
    query = db.query(History).filter(History.user_id == current_user.id)
    
    if divination_type:
        query = query.filter(History.divination_type == divination_type)
    
    total = query.count()
    items = query.order_by(History.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    
    return HistoryListResponse(
        items=[
            HistoryItem(
                id=item.id,
                divination_type=item.divination_type,
                question=item.question,
                gender=item.gender,
                target=item.target,
                chart_data=json.loads(item.chart_data),
                interpretation=item.interpretation,
                ai_provider=item.ai_provider,
                ai_model=item.ai_model,
                status=item.status,
                created_at=item.created_at
            )
            for item in items
        ],
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/{history_id}", response_model=HistoryItem)
def get_history_item(
    history_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """取得單筆歷史紀錄"""
    history = db.query(History).filter(
        History.id == history_id,
        History.user_id == current_user.id
    ).first()
    
    if not history:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="紀錄不存在"
        )
    
    return HistoryItem(
        id=history.id,
        divination_type=history.divination_type,
        question=history.question,
        gender=history.gender,
        target=history.target,
        chart_data=json.loads(history.chart_data),
        interpretation=history.interpretation,
        ai_provider=history.ai_provider,
        ai_model=history.ai_model,
        status=history.status,
        created_at=history.created_at
    )


@router.delete("/{history_id}")
def delete_history_item(
    history_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """刪除歷史紀錄"""
    history = db.query(History).filter(
        History.id == history_id,
        History.user_id == current_user.id
    ).first()
    
    if not history:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="紀錄不存在"
        )
    
    db.delete(history)
    db.commit()
    
    return {"message": "已刪除"}


# ========== Admin Endpoints ==========

@router.get("/admin/all", response_model=HistoryListResponse)
def get_all_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user_id: Optional[int] = None,
    divination_type: Optional[str] = None,
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Admin 取得所有用戶的歷史紀錄"""
    query = db.query(History, User).join(User, History.user_id == User.id)
    
    if user_id:
        query = query.filter(History.user_id == user_id)
    if divination_type:
        query = query.filter(History.divination_type == divination_type)
    
    total = query.count()
    results = query.order_by(History.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    
    return HistoryListResponse(
        items=[
            HistoryItem(
                id=history.id,
                divination_type=history.divination_type,
                question=history.question,
                gender=history.gender,
                target=history.target,
                chart_data=json.loads(history.chart_data),
                interpretation=history.interpretation,
                ai_provider=history.ai_provider,
                ai_model=history.ai_model,
                status=history.status,
                created_at=history.created_at,
                username=user.username
            )
            for history, user in results
        ],
        total=total,
        page=page,
        page_size=page_size
    )
