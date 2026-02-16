"""
認證 API 路由
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional

from app.core.database import get_db
from app.models.user import User
from app.utils.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    get_current_user_or_guest,
)
from app.utils.security import (
    check_rate_limit,
    RateLimitDep,
    get_guest_identifier,
    check_guest_daily_limit,
)

router = APIRouter(prefix="/api/auth", tags=["認證"])


# ========== Schemas ==========


class InitRequest(BaseModel):
    """初始化請求"""

    password: str = Field(..., min_length=6, max_length=20, description="Admin 密碼")


class RegisterRequest(BaseModel):
    """註冊請求"""

    username: str = Field(..., min_length=3, max_length=20, pattern=r"^[a-zA-Z0-9_-]+$")
    password: str = Field(..., min_length=6, max_length=20)


class LoginRequest(BaseModel):
    """登入請求"""

    username: str
    password: str


class PasswordChangeRequest(BaseModel):
    """修改密碼請求"""

    old_password: str
    new_password: str = Field(..., min_length=6, max_length=20)
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
            status_code=status.HTTP_400_BAD_REQUEST, detail="系統已初始化"
        )

    # 建立 admin 帳戶
    admin = User(
        username="admin", password_hash=hash_password(request.password), role="admin"
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)

    # 產生 token
    token = create_access_token(data={"sub": admin.username})

    return TokenResponse(
        access_token=token,
        user={"id": admin.id, "username": admin.username, "role": admin.role},
    )


@router.post("/register", response_model=TokenResponse)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """註冊一般用戶"""
    # 檢查是否已初始化
    admin = db.query(User).filter(User.role == "admin").first()
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="系統尚未初始化，請先建立 Admin 帳戶",
        )

    # 檢查用戶名是否已存在
    existing = db.query(User).filter(User.username == request.username).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="用戶名已被使用"
        )

    # 建立用戶
    user = User(
        username=request.username,
        password_hash=hash_password(request.password),
        role="user",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # 產生 token
    token = create_access_token(data={"sub": user.username})

    return TokenResponse(
        access_token=token,
        user={"id": user.id, "username": user.username, "role": user.role},
    )


@router.post("/login", response_model=TokenResponse)
def login(
    login_request: LoginRequest,
    db: Session = Depends(get_db),
    _: None = Depends(RateLimitDep(max_requests=10, window_seconds=60)),
):
    """登入"""
    user = db.query(User).filter(User.username == login_request.username).first()

    if not user or not verify_password(login_request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="帳號或密碼錯誤"
        )

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="帳戶已停用")

    token = create_access_token(data={"sub": user.username})

    return TokenResponse(
        access_token=token,
        user={"id": user.id, "username": user.username, "role": user.role},
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """取得當前用戶資訊"""
    return UserResponse(
        id=current_user.id, username=current_user.username, role=current_user.role
    )


@router.put("/password")
def change_password(
    request: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """修改密碼"""
    # 驗證舊密碼
    if not verify_password(request.old_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="舊密碼錯誤"
        )

    # 確認新密碼
    if request.new_password != request.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="新密碼與確認密碼不符"
        )

    # 更新密碼
    current_user.password_hash = hash_password(request.new_password)
    db.commit()

    return {"message": "密碼已更新"}


@router.get("/client-config")
def get_client_config():
    """
    獲取客戶端配置
    注意：已移除簽名密鑰暴露（不再使用簽名驗證）
    """
    from app.core.config import get_settings

    settings = get_settings()

    return {"app_name": settings.APP_NAME, "version": "2.0.0"}


@router.post("/guest-login", response_model=TokenResponse)
def guest_login(
    request: Request,
    db: Session = Depends(get_db),
    _: None = Depends(RateLimitDep(max_requests=10, window_seconds=60)),
):
    """訪客試用登入"""
    identifier = get_guest_identifier(request)

    allowed, today_count = check_guest_daily_limit(request, db)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"訪客試用每日限制 5 次，今日已使用 {today_count} 次。請註冊帳號以使用完整功能。",
        )

    guest_user = (
        db.query(User)
        .filter(User.role == "guest", User.guest_identifier == identifier)
        .first()
    )

    if not guest_user:
        import secrets

        username = f"guest_{identifier[:8]}_{secrets.token_hex(4)}"
        guest_user = User(
            username=username,
            password_hash=hash_password(secrets.token_urlsafe(32)),
            role="guest",
            guest_identifier=identifier,
        )
        db.add(guest_user)
        db.commit()
        db.refresh(guest_user)

    token_data = {
        "sub": guest_user.username,
        "guest_id": identifier,
        "remaining": 5 - today_count,
    }
    token = create_access_token(data=token_data)

    return TokenResponse(
        access_token=token,
        user={
            "id": guest_user.id,
            "username": guest_user.username,
            "role": guest_user.role,
        },
    )
