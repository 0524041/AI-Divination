"""
Admin API 路由
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List

from app.core.database import get_db
from app.models.user import User
from app.utils.auth import get_admin_user, hash_password

router = APIRouter(prefix="/api/admin", tags=["管理"])


# ========== Schemas ==========

class CreateUserRequest(BaseModel):
    """建立用戶請求"""
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    role: str = Field("user", description="'admin' | 'user'")


class UpdateRoleRequest(BaseModel):
    """更新權限請求"""
    role: str = Field(..., description="'admin' | 'user'")


class UserItem(BaseModel):
    """用戶項目"""
    id: int
    username: str
    role: str
    is_active: bool
    created_at: str


# ========== Endpoints ==========

@router.get("/users", response_model=List[UserItem])
def get_users(
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """取得所有用戶"""
    users = db.query(User).all()
    return [
        UserItem(
            id=u.id,
            username=u.username,
            role=u.role,
            is_active=u.is_active,
            created_at=u.created_at.isoformat()
        )
        for u in users
    ]


@router.post("/users", response_model=UserItem)
def create_user(
    request: CreateUserRequest,
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """建立新用戶"""
    # 檢查用戶名是否已存在
    existing = db.query(User).filter(User.username == request.username).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用戶名已被使用"
        )
    
    user = User(
        username=request.username,
        password_hash=hash_password(request.password),
        role=request.role
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return UserItem(
        id=user.id,
        username=user.username,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at.isoformat()
    )


@router.put("/users/{user_id}/role")
def update_user_role(
    user_id: int,
    request: UpdateRoleRequest,
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """更新用戶權限"""
    if user_id == admin_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="無法修改自己的權限"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用戶不存在"
        )
    
    user.role = request.role
    db.commit()
    
    return {"message": "權限已更新"}


@router.put("/users/{user_id}/toggle-active")
def toggle_user_active(
    user_id: int,
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """切換用戶啟用狀態"""
    if user_id == admin_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="無法停用自己的帳戶"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用戶不存在"
        )
    
    user.is_active = not user.is_active
    db.commit()
    
    return {"message": f"用戶已{'啟用' if user.is_active else '停用'}"}


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """刪除用戶"""
    if user_id == admin_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="無法刪除自己的帳戶"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用戶不存在"
        )
    
    db.delete(user)
    db.commit()
    
    return {"message": "用戶已刪除"}
