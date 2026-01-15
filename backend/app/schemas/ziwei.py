from typing import Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel, Field


class ZiweiBirthDetails(BaseModel):
    name: str
    gender: str = Field(..., pattern="^(男|女)$")
    birth_date: datetime
    birth_location: str
    is_twin: bool = False
    twin_order: Optional[str] = None


class ZiweiQuerySettings(BaseModel):
    query_type: str = Field(..., pattern="^(natal|yearly|monthly|daily)$")
    query_date: datetime
    question: str = Field(..., min_length=1, max_length=500)


class ZiweiProcessRequest(BaseModel):
    birth_details: ZiweiBirthDetails
    query_settings: ZiweiQuerySettings
    chart_data: Dict[str, Any]  # The full iztro chart object
