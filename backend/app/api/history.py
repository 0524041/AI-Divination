"""
歷史紀錄 API 路由
"""
import json
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta

from app.core.database import get_db
from app.models.user import User
from app.models.history import History
from app.models.share_token import ShareToken
from app.utils.auth import get_current_user, get_admin_user

router = APIRouter(prefix="/api/history", tags=["歷史紀錄"])
share_router = APIRouter(prefix="/api/share", tags=["分享"])


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


class StatisticsResponse(BaseModel):
    """統計資訊回應"""
    total_count: int
    today_count: int
    last_7_days_most_used_type: str
    last_7_days_type_counts: dict


# ========== Share Schemas ==========

class ShareCreateRequest(BaseModel):
    """建立分享請求"""
    history_id: int


class ShareCreateResponse(BaseModel):
    """建立分享回應"""
    token: str
    expires_at: datetime
    share_url: str


class SharedHistoryItem(BaseModel):
    """公開分享的歷史紀錄項目（隱藏敏感資訊）"""
    divination_type: str
    question: str
    gender: Optional[str]
    target: Optional[str]
    chart_data: dict
    chart_data_display: Optional[str]  # 簡化版顯示用
    interpretation: Optional[str]
    ai_provider: Optional[str]
    ai_model: Optional[str]


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


@router.get("/statistics", response_model=StatisticsResponse)
def get_statistics(
    user_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """取得統計資訊
    - 普通用戶：只能查看自己的統計
    - Admin 用戶：可以查看指定用戶或所有用戶的統計
    - user_id=None: 查看自己的統計（或 admin 自己的）
    - user_id=0: 查看所有用戶的統計（僅 admin）
    - user_id=specific_id: 查看指定用戶的統計（僅 admin）
    """
    # 確定要查詢的用戶
    target_user_id = None
    query_all_users = False
    
    if user_id is not None:
        # 只有 admin 可以查看其他用戶的統計
        if current_user.role != 'admin':
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="無權限查看其他用戶的統計"
            )
        if user_id == 0:
            # 查看所有用戶
            query_all_users = True
        else:
            # 查看指定用戶
            target_user_id = user_id
    else:
        # 查看自己的統計
        target_user_id = current_user.id
    
    # 總計數
    if query_all_users:
        total_count = db.query(History).count()
    else:
        total_count = db.query(History).filter(History.user_id == target_user_id).count()
    
    # 今天的計數
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    if query_all_users:
        today_count = db.query(History).filter(History.created_at >= today_start).count()
    else:
        today_count = db.query(History).filter(
            History.user_id == target_user_id,
            History.created_at >= today_start
        ).count()
    
    # 最近7天的類型統計
    seven_days_ago = datetime.now() - timedelta(days=7)
    if query_all_users:
        type_counts = db.query(
            History.divination_type,
            func.count(History.id).label('count')
        ).filter(
            History.created_at >= seven_days_ago
        ).group_by(History.divination_type).all()
    else:
        type_counts = db.query(
            History.divination_type,
            func.count(History.id).label('count')
        ).filter(
            History.user_id == target_user_id,
            History.created_at >= seven_days_ago
        ).group_by(History.divination_type).all()
    
    # 轉換為字典
    type_counts_dict = {t[0]: t[1] for t in type_counts}
    
    # 找出最常使用的類型
    most_used_type = max(type_counts_dict.items(), key=lambda x: x[1])[0] if type_counts_dict else "無"
    
    return StatisticsResponse(
        total_count=total_count,
        today_count=today_count,
        last_7_days_most_used_type=most_used_type,
        last_7_days_type_counts=type_counts_dict
    )


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


# ========== Share Endpoints ==========

def get_display_formatted(chart_data: dict) -> Optional[str]:
    """
    從 chart_data 生成簡化版的顯示內容（只到卦象結構的結束線 ----）
    不包含【本卦】【變卦】的詳細解釋
    """
    formatted = chart_data.get('formatted', '')
    if not formatted:
        return None
    
    # 分割成行
    lines = formatted.split('\n')
    result_lines = []
    dash_count = 0
    
    for line in lines:
        # 計算遇到的 ---- 分隔線數量
        if line.strip().startswith('----'):
            dash_count += 1
            result_lines.append(line)
            # 第三條 ---- 是卦象結構的結束線，到此為止
            if dash_count >= 3:
                break
            continue
        
        # 如果遇到【本卦：或【變卦：代表已經進入解釋區域，停止
        if line.startswith('【本卦：') or line.startswith('【變卦：'):
            break
        
        result_lines.append(line)
    
    return '\n'.join(result_lines)


@share_router.post("/create", response_model=ShareCreateResponse)
def create_share_token(
    request: ShareCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """建立分享連結（需登入）"""
    # 確認該紀錄屬於當前用戶 (或是管理員)
    query = db.query(History).filter(History.id == request.history_id)
    
    # 如果不是管理員，只能讀取自己的紀錄
    if current_user.role != 'admin':
        query = query.filter(History.user_id == current_user.id)
    
    history = query.first()
    
    if not history:
        print(f"Share failed: User {current_user.id} ({current_user.role}) tried to share History {request.history_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="紀錄不存在或無權限分享"
        )
    
    # 檢查是否已有有效的分享 token
    existing_token = db.query(ShareToken).filter(
        ShareToken.history_id == request.history_id,
        ShareToken.expires_at > datetime.utcnow()
    ).first()
    
    if existing_token:
        # 返回現有 token
        return ShareCreateResponse(
            token=existing_token.token,
            expires_at=existing_token.expires_at,
            share_url=f"/share/{existing_token.token}"
        )
    
    # 建立新的分享 token
    token = ShareToken.generate_token()
    expires_at = ShareToken.create_expiry(days=7)
    
    share_token = ShareToken(
        token=token,
        history_id=request.history_id,
        expires_at=expires_at
    )
    
    db.add(share_token)
    db.commit()
    db.refresh(share_token)
    
    return ShareCreateResponse(
        token=share_token.token,
        expires_at=share_token.expires_at,
        share_url=f"/share/{share_token.token}"
    )


@share_router.get("/{token}", response_model=SharedHistoryItem)
def get_shared_history(
    token: str,
    db: Session = Depends(get_db)
):
    """取得分享的歷史紀錄（公開存取，不需登入）"""
    # 查詢 token
    share_token = db.query(ShareToken).filter(
        ShareToken.token == token
    ).first()
    
    if not share_token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="分享連結不存在"
        )
    
    # 檢查是否過期
    if share_token.is_expired():
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="分享連結已過期"
        )
    
    # 取得歷史紀錄
    history = db.query(History).filter(
        History.id == share_token.history_id
    ).first()
    
    if not history:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="紀錄不存在"
        )
    
    chart_data = json.loads(history.chart_data)
    
    return SharedHistoryItem(
        divination_type=history.divination_type,
        question=history.question,
        gender=history.gender,
        target=history.target,
        chart_data=chart_data,
        chart_data_display=get_display_formatted(chart_data),
        interpretation=history.interpretation,
        ai_provider=history.ai_provider,
        ai_model=history.ai_model
    )

