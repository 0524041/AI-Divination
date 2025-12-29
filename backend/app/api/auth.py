"""
認證 API 路由
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional

from app.core.database import get_db
from app.models.user import User
from app.utils.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user
)

router = APIRouter(prefix="/api/auth", tags=["認證"])


# ========== Schemas ==========

class InitRequest(BaseModel):
    """初始化請求"""
    password: str = Field(..., min_length=6, description="Admin 密碼")


class RegisterRequest(BaseModel):
    """註冊請求"""
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)


class LoginRequest(BaseModel):
    """登入請求"""
    username: str
    password: str


class PasswordChangeRequest(BaseModel):
    """修改密碼請求"""
    old_password: str
    new_password: str = Field(..., min_length=6)
    confirm_password: str


class TokenResponse(BaseModel):
    """Token 回應"""
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserResponse(BaseModel):
    """用戶回應"""
    id: int
    username: str
    role: str


# ========== Endpoints ==========

@router.get("/check-init")
def check_init(db: Session = Depends(get_db)):
    """檢查是否已初始化 (是否有 admin 帳戶)"""
    admin = db.query(User).filter(User.role == "admin").first()
    return {"initialized": admin is not None}


@router.post("/init", response_model=TokenResponse)
def init_admin(request: InitRequest, db: Session = Depends(get_db)):
    """初始化 Admin 帳戶 (首次設置)"""
    # 檢查是否已存在 admin
    existing_admin = db.query(User).filter(User.role == "admin").first()
    if existing_admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="系統已初始化"
        )
    
    # 建立 admin 帳戶
    admin = User(
        username="admin",
        password_hash=hash_password(request.password),
        role="admin"
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    
    # 產生 token
    token = create_access_token(data={"sub": admin.username})
    
    return TokenResponse(
        access_token=token,
        user={"id": admin.id, "username": admin.username, "role": admin.role}
    )


@router.post("/register", response_model=TokenResponse)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """註冊一般用戶"""
    # 檢查是否已初始化
    admin = db.query(User).filter(User.role == "admin").first()
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="系統尚未初始化，請先建立 Admin 帳戶"
        )
    
    # 檢查用戶名是否已存在
    existing = db.query(User).filter(User.username == request.username).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用戶名已被使用"
        )
    
    # 建立用戶
    user = User(
        username=request.username,
        password_hash=hash_password(request.password),
        role="user"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # 產生 token
    token = create_access_token(data={"sub": user.username})
    
    return TokenResponse(
        access_token=token,
        user={"id": user.id, "username": user.username, "role": user.role}
    )


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """登入"""
    user = db.query(User).filter(User.username == request.username).first()
    
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="帳號或密碼錯誤"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="帳戶已停用"
        )
    
    token = create_access_token(data={"sub": user.username})
    
    return TokenResponse(
        access_token=token,
        user={"id": user.id, "username": user.username, "role": user.role}
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """取得當前用戶資訊"""
    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        role=current_user.role
    )


@router.put("/password")
def change_password(
    request: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """修改密碼"""
    # 驗證舊密碼
    if not verify_password(request.old_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="舊密碼錯誤"
        )
    
    # 確認新密碼
    if request.new_password != request.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="新密碼與確認密碼不符"
        )
    
    # 更新密碼
    current_user.password_hash = hash_password(request.new_password)
    db.commit()
    
    return {"message": "密碼已更新"}
