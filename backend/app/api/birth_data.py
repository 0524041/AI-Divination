"""生辰八字管理 API"""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List

from app.core.database import get_db
from app.models.user import User
from app.models.birth_data import UserBirthData
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/birth-data", tags=["生辰八字"], redirect_slashes=False)


class BirthDataCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    gender: str = Field(..., pattern="^(male|female)$")
    birth_date: datetime
    birth_location: str = Field(..., min_length=1, max_length=50)
    is_twin: bool = False
    twin_order: str | None = Field(None, pattern="^(elder|younger)$")


class BirthDataResponse(BaseModel):
    id: int
    name: str
    gender: str
    birth_date: datetime
    birth_location: str
    is_twin: bool
    twin_order: str | None
    created_at: datetime

    class Config:
        from_attributes = True


@router.post("", response_model=BirthDataResponse)
def create_birth_data(
    data: BirthDataCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    birth_data = UserBirthData(user_id=current_user.id, **data.model_dump())
    db.add(birth_data)
    db.commit()
    db.refresh(birth_data)
    return birth_data


@router.get("", response_model=List[BirthDataResponse])
def list_birth_data(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    return (
        db.query(UserBirthData)
        .filter(UserBirthData.user_id == current_user.id)
        .order_by(UserBirthData.created_at.desc())
        .all()
    )


@router.delete("/{birth_data_id}")
def delete_birth_data(
    birth_data_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    birth_data = (
        db.query(UserBirthData)
        .filter(
            UserBirthData.id == birth_data_id, UserBirthData.user_id == current_user.id
        )
        .first()
    )

    if not birth_data:
        raise HTTPException(status_code=404, detail="找不到該配置")

    db.delete(birth_data)
    db.commit()
    return {"status": "success", "message": "已刪除"}
