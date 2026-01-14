# 紫微斗數功能實作計劃 (Ziwei Implementation Plan)

> **版本**: 1.0  
> **建立日期**: 2026-01-14  
> **基於架構**: 參考六爻 (Liu Yao) 實作模式  
> **預計工作量**: 高複雜度（約 3-5 天）

---

## 📋 目錄

1. [功能需求概述](#1-功能需求概述)
2. [技術架構設計](#2-技術架構設計)
3. [資料結構設計](#3-資料結構設計)
4. [後端實作清單](#4-後端實作清單)
5. [前端實作清單](#5-前端實作清單)
6. [AI Prompt 設計](#6-ai-prompt-設計)
7. [實作順序建議](#7-實作順序建議)
8. [潛在風險與解決方案](#8-潛在風險與解決方案)
9. [測試計劃](#9-測試計劃)

---

## 1. 功能需求概述

### 1.1 核心流程
```
紫微斗數頁面 
  ↓
輸入生辰八字資訊 (含儲存/選擇功能)
  ↓
排盤結果呈現 (雙胞胎自動處理對宮法)
  ↓
選擇問卦類型 (本命/流年/流月/流日) + 輸入問題
  ↓
AI 解讀結果 (存入歷史紀錄)
```

### 1.2 輸入欄位
1. **姓名** (string, required)
2. **性別** (male/female, required)
3. **國曆出生年月日時** (datetime, required)
4. **雙胞胎選項** (boolean + elder/younger, optional)
5. **出生地** (台灣縣市下拉選單, required) - 用於真太陽時校正

### 1.3 生辰八字儲存機制
- 使用者可儲存多個生辰八字配置（例如：自己、家人、朋友）
- 儲存於 `user_birth_data` 資料表（僅該使用者可見）
- 提供選擇已儲存配置 + 刪除功能
- 自動填充表單欄位

### 1.4 排盤結果展示
- **一般排盤**：顯示 12 宮位、主星、輔星、命宮、身宮
- **雙胞胎排盤**：
  - 老大：正常排盤
  - 老二：套用「對宮法」（遷移宮 → 命宮）
  - 在畫面上標註說明對宮法調整內容

### 1.5 AI 問卦類型
| 類型 | 日期選擇 | 命盤資料 |
|-----|---------|---------|
| **本命** | 無 | 本命命盤 |
| **流年** | 選擇年份 | 本命 + 流年命盤 |
| **流月** | 選擇年月 | 本命 + 流月命盤 |
| **流日** | 選擇年月日 | 本命 + 流日命盤 |

### 1.6 歷史紀錄格式
- **顯示欄位**：
  - 算卦類型：`紫微斗數`
  - 對象：`{姓名}`
  - 問卦種類：`本命 / 流年YYYY / 流月YYYY-MM / 流日YYYY-MM-DD`
  - 問題：`{使用者問題}`
- **摺疊內容**：
  - 本命命盤資料（JSON 格式，可摺疊）
  - 流年/流月/流日命盤資料（若有）
  - AI 思考過程（<think> 標籤 (若有)）可參考六爻跟塔羅
- **直接md渲染顯示內容**：
  -AI 解讀結果（Markdown 渲染）
---

## 2. 技術架構設計

### 2.1 技術選型

#### 後端
- **紫微斗數演算法**：`iztro-py` (純 Python 實作)
  - **安裝**：`pip install iztro-py`
  - **版本**：0.3.3+
  - **優點**：無需 JavaScript 依賴，支援繁體中文
  - **API**：
    ```python
    from iztro_py import astro
    chart = astro.by_solar('2000-8-16', 6, '男', language='zh-TW')
    horoscope = chart.horoscope('2025-01-14')
    ```

#### 前端
- **框架**：Next.js 14 (App Router)
- **狀態管理**：React `useState`（參考六爻）
- **復用元件**：
  - `AISelector` (AI 選擇器)
  - `Input`, `Select`, `Button` (表單元件)
  - `MarkdownRenderer` (AI 結果渲染)
  - `Navbar`, `Footer` (佈局)

### 2.2 資料流設計

```
[前端] 使用者填寫表單
   ↓ POST /api/ziwei/calculate
[後端] 排盤演算法 (iztro-py)
   ↓ 返回 natal_chart_data
[前端] 顯示排盤結果
   ↓ 使用者選擇問卦類型 + 輸入問題
   ↓ POST /api/ziwei
[後端] 建立 history 記錄 (status: pending)
   ↓ 背景任務：process_ziwei_divination
   ↓ 呼叫 AI 服務
   ↓ 更新 history (status: completed)
[前端] 輪詢 GET /api/history/{id}
   ↓ 顯示 AI 解讀結果
```

---

## 3. 資料結構設計

### 3.1 後端資料表

#### 3.1.1 `user_birth_data` (新增)
```sql
CREATE TABLE user_birth_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    gender VARCHAR(10) NOT NULL,  -- 'male' | 'female'
    birth_date DATETIME NOT NULL,  -- 國曆出生時間
    birth_location VARCHAR(50) NOT NULL,  -- 台灣縣市
    is_twin BOOLEAN DEFAULT FALSE,
    twin_order VARCHAR(10),  -- 'elder' | 'younger'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_user_birth_data_user_id ON user_birth_data(user_id);
```

#### 3.1.2 `history` 表（擴充現有）
```python
# 已存在欄位（無需修改）
divination_type = "ziwei"
chart_data = JSON({
    "natal_chart": {...},      # 本命命盤
    "horoscope": {...},        # 流年/流月/流日（若有）
    "birth_info": {            # 生辰資訊
        "name": "...",
        "gender": "...",
        "birth_date": "...",
        "location": "...",
        "is_twin": False,
        "twin_order": None
    },
    "query_type": "natal",     # 'natal' | 'yearly' | 'monthly' | 'daily'
    "query_date": None         # 若是流年/流月/流日，記錄查詢日期
})
```

### 3.2 前端資料結構

#### 3.2.1 生辰八字表單 State
```typescript
interface BirthDataForm {
  name: string;
  gender: 'male' | 'female';
  birthDate: Date;
  birthLocation: string;  // 台灣縣市
  isTwin: boolean;
  twinOrder?: 'elder' | 'younger';
}
```

#### 3.2.2 排盤結果 State
```typescript
interface NatalChart {
  palaces: Palace[];  // 12 宮位
  soulPalace: string;
  bodyPalace: string;
  // ... (iztro 返回的完整資料)
}

interface Palace {
  name: string;
  majorStars: Star[];
  minorStars: Star[];
  // ...
}
```

---

## 4. 後端實作清單

### 4.1 依賴安裝

#### 4.1.1 安裝 `iztro-py`
**檔案**：`backend/pyproject.toml`
```toml
dependencies = [
    # ... existing dependencies ...
    "iztro-py>=0.3.3",
]
```

**執行**：
```bash
cd backend
uv sync
```

#### 4.1.2 建立台灣縣市經緯度資料
**檔案**：`backend/app/data/taiwan_cities.py` (新增)
```python
"""台灣縣市經緯度資料（用於真太陽時校正）"""

TAIWAN_CITIES = {
    "台北市": {"lat": 25.0330, "lng": 121.5654},
    "新北市": {"lat": 25.0169, "lng": 121.4627},
    "桃園市": {"lat": 24.9936, "lng": 121.3010},
    "台中市": {"lat": 24.1477, "lng": 120.6736},
    "台南市": {"lat": 22.9998, "lng": 120.2269},
    "高雄市": {"lat": 22.6273, "lng": 120.3014},
    "基隆市": {"lat": 25.1276, "lng": 121.7392},
    "新竹市": {"lat": 24.8138, "lng": 120.9675},
    "新竹縣": {"lat": 24.8387, "lng": 121.0177},
    "苗栗縣": {"lat": 24.5602, "lng": 120.8214},
    "彰化縣": {"lat": 24.0518, "lng": 120.5161},
    "南投縣": {"lat": 23.9609, "lng": 120.9719},
    "雲林縣": {"lat": 23.7092, "lng": 120.4313},
    "嘉義市": {"lat": 23.4800, "lng": 120.4491},
    "嘉義縣": {"lat": 23.4518, "lng": 120.2554},
    "屏東縣": {"lat": 22.5519, "lng": 120.5487},
    "宜蘭縣": {"lat": 24.7021, "lng": 121.7378},
    "花蓮縣": {"lat": 23.9871, "lng": 121.6015},
    "台東縣": {"lat": 22.7583, "lng": 121.1444},
    "澎湖縣": {"lat": 23.5712, "lng": 119.5793},
    "金門縣": {"lat": 24.4489, "lng": 118.3767},
    "連江縣": {"lat": 26.1605, "lng": 119.9297},
}

# 標準時區經度（東經 120 度）
STANDARD_MERIDIAN = 120.0

def calculate_solar_time_offset(location: str) -> int:
    """
    計算真太陽時校正（以分鐘為單位）
    
    Args:
        location: 台灣縣市名稱
        
    Returns:
        校正分鐘數（正數表示加，負數表示減）
    """
    if location not in TAIWAN_CITIES:
        return 0
    
    lng = TAIWAN_CITIES[location]["lng"]
    # 每 1 度經度差異 = 4 分鐘
    offset_minutes = int((lng - STANDARD_MERIDIAN) * 4)
    return offset_minutes
```

### 4.2 排盤服務

#### 4.2.1 紫微斗數服務
**檔案**：`backend/app/services/ziwei.py` (新增)

```python
"""紫微斗數排盤服務"""
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from iztro_py import astro
from app.data.taiwan_cities import calculate_solar_time_offset

class ZiweiService:
    """紫微斗數排盤服務"""
    
    @staticmethod
    def adjust_solar_time(
        birth_datetime: datetime,
        location: str
    ) -> datetime:
        """
        真太陽時校正
        
        Args:
            birth_datetime: 出生時間（國曆）
            location: 出生地（台灣縣市）
            
        Returns:
            校正後的時間
        """
        offset = calculate_solar_time_offset(location)
        return birth_datetime + timedelta(minutes=offset)
    
    @staticmethod
    def datetime_to_time_index(dt: datetime) -> int:
        """
        將時間轉換為 iztro 的 timeIndex (0-12)
        
        時辰對照表：
        0: 00:00-01:00 (早子時)
        1: 01:00-03:00 (丑時)
        2: 03:00-05:00 (寅時)
        ...
        12: 23:00-00:00 (晚子時)
        """
        hour = dt.hour
        if 0 <= hour < 1:
            return 0
        elif 1 <= hour < 3:
            return 1
        elif 3 <= hour < 5:
            return 2
        elif 5 <= hour < 7:
            return 3
        elif 7 <= hour < 9:
            return 4
        elif 9 <= hour < 11:
            return 5
        elif 11 <= hour < 13:
            return 6
        elif 13 <= hour < 15:
            return 7
        elif 15 <= hour < 17:
            return 8
        elif 17 <= hour < 19:
            return 9
        elif 19 <= hour < 21:
            return 10
        elif 21 <= hour < 23:
            return 11
        else:  # 23:00-00:00
            return 12
    
    @staticmethod
    def apply_twin_method(natal_chart: Dict[str, Any]) -> Dict[str, Any]:
        """
        雙胞胎對宮法處理（老二）
        
        原理：將「遷移宮」設為「命宮」，其他宮位順推
        
        Args:
            natal_chart: 原始命盤（老大）
            
        Returns:
            調整後的命盤（老二）
        """
        # 找到原命盤的「遷移宮」索引
        palaces = natal_chart.get("palaces", [])
        migration_idx = None
        
        for i, palace in enumerate(palaces):
            if palace.get("name") == "遷移":
                migration_idx = i
                break
        
        if migration_idx is None:
            raise ValueError("找不到遷移宮")
        
        # 重新排列宮位（遷移宮變成第一個）
        new_palaces = palaces[migration_idx:] + palaces[:migration_idx]
        
        # 更新命盤資料
        twin_chart = natal_chart.copy()
        twin_chart["palaces"] = new_palaces
        twin_chart["earthlyBranchOfSoulPalace"] = palaces[migration_idx].get("earthlyBranch")
        twin_chart["is_twin_younger"] = True
        
        return twin_chart
    
    @staticmethod
    def generate_natal_chart(
        name: str,
        gender: str,
        birth_datetime: datetime,
        location: str,
        is_twin: bool = False,
        twin_order: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        生成本命命盤
        
        Args:
            name: 姓名
            gender: 性別 ('male' | 'female')
            birth_datetime: 出生時間（國曆）
            location: 出生地
            is_twin: 是否為雙胞胎
            twin_order: 雙胞胎順序 ('elder' | 'younger')
            
        Returns:
            命盤資料字典
        """
        # 1. 真太陽時校正
        adjusted_time = ZiweiService.adjust_solar_time(birth_datetime, location)
        
        # 2. 轉換時辰
        time_index = ZiweiService.datetime_to_time_index(adjusted_time)
        
        # 3. 轉換性別
        gender_cn = "男" if gender == "male" else "女"
        
        # 4. 格式化日期字串 (YYYY-M-D)
        date_str = adjusted_time.strftime("%Y-%-m-%-d")
        
        # 5. 呼叫 iztro-py
        chart = astro.by_solar(date_str, time_index, gender_cn, language='zh-TW')
        
        # 6. 轉換為字典
        natal_chart = chart.to_dict()
        
        # 7. 雙胞胎處理
        if is_twin and twin_order == "younger":
            natal_chart = ZiweiService.apply_twin_method(natal_chart)
        
        # 8. 加入額外資訊
        natal_chart["birth_info"] = {
            "name": name,
            "gender": gender,
            "original_time": birth_datetime.isoformat(),
            "adjusted_time": adjusted_time.isoformat(),
            "location": location,
            "is_twin": is_twin,
            "twin_order": twin_order
        }
        
        return natal_chart
    
    @staticmethod
    def generate_horoscope(
        natal_chart_raw: str,  # JSON string from database
        query_date: datetime,
        query_type: str  # 'yearly' | 'monthly' | 'daily'
    ) -> Dict[str, Any]:
        """
        生成流年/流月/流日命盤
        
        Args:
            natal_chart_raw: 本命命盤（JSON 字串）
            query_date: 查詢日期
            query_type: 查詢類型
            
        Returns:
            流運資料字典
        """
        # 重新生成 natal_chart 物件（iztro-py 需要）
        import json
        natal_data = json.loads(natal_chart_raw)
        birth_info = natal_data["birth_info"]
        
        # 重建 chart 物件
        adjusted_time = datetime.fromisoformat(birth_info["adjusted_time"])
        time_index = ZiweiService.datetime_to_time_index(adjusted_time)
        date_str = adjusted_time.strftime("%Y-%-m-%-d")
        gender_cn = "男" if birth_info["gender"] == "male" else "女"
        
        chart = astro.by_solar(date_str, time_index, gender_cn, language='zh-TW')
        
        # 生成流運
        horoscope = chart.horoscope(query_date)
        
        # 根據 query_type 提取對應資料
        result = {
            "query_date": query_date.isoformat(),
            "query_type": query_type
        }
        
        if query_type == "yearly":
            result["yearly"] = horoscope.get("yearly")
            result["decadal"] = horoscope.get("decadal")
        elif query_type == "monthly":
            result["monthly"] = horoscope.get("monthly")
            result["yearly"] = horoscope.get("yearly")
        elif query_type == "daily":
            result["daily"] = horoscope.get("daily")
            result["monthly"] = horoscope.get("monthly")
        
        return result
    
    @staticmethod
    def format_for_ai(
        natal_chart: Dict[str, Any],
        horoscope: Optional[Dict[str, Any]] = None,
        is_twin_younger: bool = False
    ) -> str:
        """
        將命盤資料格式化為 AI Prompt 用的純文字
        
        Args:
            natal_chart: 本命命盤
            horoscope: 流運資料（可選）
            is_twin_younger: 是否為雙胞胎老二
            
        Returns:
            格式化後的文字
        """
        output = []
        
        # 1. 基本資訊
        output.append("=== 基本資訊 ===")
        birth_info = natal_chart.get("birth_info", {})
        output.append(f"姓名: {birth_info.get('name')}")
        output.append(f"性別: {birth_info.get('gender')}")
        output.append(f"出生時間: {birth_info.get('original_time')}")
        output.append(f"出生地: {birth_info.get('location')}")
        
        if is_twin_younger:
            output.append("⚠️ 此為雙胞胎老二，已套用「對宮法」（遷移宮設為命宮）")
        
        output.append("")
        
        # 2. 本命命盤
        output.append("=== 本命命盤 ===")
        output.append(f"命宮: {natal_chart.get('earthlyBranchOfSoulPalace')}")
        output.append(f"身宮: {natal_chart.get('earthlyBranchOfBodyPalace')}")
        output.append(f"五行局: {natal_chart.get('fiveElementsClass')}")
        output.append("")
        
        # 3. 十二宮位
        output.append("=== 十二宮位 ===")
        for palace in natal_chart.get("palaces", []):
            output.append(f"\n【{palace.get('name')}宮】")
            output.append(f"  天干: {palace.get('heavenlyStem')}")
            output.append(f"  地支: {palace.get('earthlyBranch')}")
            
            major_stars = palace.get("majorStars", [])
            if major_stars:
                output.append(f"  主星: {', '.join([s.get('name') for s in major_stars])}")
            
            minor_stars = palace.get("minorStars", [])
            if minor_stars:
                output.append(f"  輔星: {', '.join([s.get('name') for s in minor_stars])}")
        
        # 4. 流運（若有）
        if horoscope:
            output.append("\n\n=== 流運資訊 ===")
            output.append(f"查詢日期: {horoscope.get('query_date')}")
            output.append(f"查詢類型: {horoscope.get('query_type')}")
            
            if horoscope.get("yearly"):
                output.append("\n【流年】")
                yearly = horoscope["yearly"]
                output.append(f"  天干: {yearly.get('heavenlyStem')}")
                output.append(f"  地支: {yearly.get('earthlyBranch')}")
            
            if horoscope.get("monthly"):
                output.append("\n【流月】")
                monthly = horoscope["monthly"]
                output.append(f"  天干: {monthly.get('heavenlyStem')}")
                output.append(f"  地支: {monthly.get('earthlyBranch')}")
            
            if horoscope.get("daily"):
                output.append("\n【流日】")
                daily = horoscope["daily"]
                output.append(f"  天干: {daily.get('heavenlyStem')}")
                output.append(f"  地支: {daily.get('earthlyBranch')}")
        
        return "\n".join(output)
```

### 4.3 API 路由

#### 4.3.1 生辰八字管理 API
**檔案**：`backend/app/api/birth_data.py` (新增)

```python
"""生辰八字管理 API"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List

from app.core.database import get_db
from app.models.user import User
from app.models.birth_data import UserBirthData  # 需要新增此 model
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/birth-data", tags=["生辰八字"], redirect_slashes=False)

# ========== Schemas ==========

class BirthDataCreate(BaseModel):
    """建立生辰八字"""
    name: str = Field(..., min_length=1, max_length=100)
    gender: str = Field(..., pattern="^(male|female)$")
    birth_date: datetime
    birth_location: str = Field(..., min_length=1, max_length=50)
    is_twin: bool = False
    twin_order: str | None = Field(None, pattern="^(elder|younger)$")

class BirthDataResponse(BaseModel):
    """生辰八字回應"""
    id: int
    name: str
    gender: str
    birth_date: datetime
    birth_location: str
    is_twin: bool
    twin_order: str | None
    created_at: datetime

# ========== Routes ==========

@router.post("", response_model=BirthDataResponse)
def create_birth_data(
    data: BirthDataCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """建立生辰八字配置"""
    birth_data = UserBirthData(
        user_id=current_user.id,
        **data.model_dump()
    )
    db.add(birth_data)
    db.commit()
    db.refresh(birth_data)
    return birth_data

@router.get("", response_model=List[BirthDataResponse])
def list_birth_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """列出使用者的生辰八字配置"""
    return db.query(UserBirthData).filter(
        UserBirthData.user_id == current_user.id
    ).order_by(UserBirthData.created_at.desc()).all()

@router.delete("/{birth_data_id}")
def delete_birth_data(
    birth_data_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """刪除生辰八字配置"""
    birth_data = db.query(UserBirthData).filter(
        UserBirthData.id == birth_data_id,
        UserBirthData.user_id == current_user.id
    ).first()
    
    if not birth_data:
        raise HTTPException(status_code=404, detail="找不到該配置")
    
    db.delete(birth_data)
    db.commit()
    return {"status": "success", "message": "已刪除"}
```

#### 4.3.2 紫微斗數占卜 API
**檔案**：`backend/app/api/ziwei.py` (新增)

```python
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

# 讀取 system prompt
SYSTEM_PROMPT_PATH = Path(BASE_DIR) / "prompts" / "ziwei_system.md"

# ========== Schemas ==========

class CalculateRequest(BaseModel):
    """排盤請求"""
    name: str
    gender: str
    birth_date: datetime
    birth_location: str
    is_twin: bool = False
    twin_order: Optional[str] = None

class CalculateResponse(BaseModel):
    """排盤回應"""
    natal_chart: dict
    message: str

class ZiweiDivinationRequest(BaseModel):
    """紫微斗數占卜請求"""
    birth_data_id: Optional[int] = None  # 若選擇已儲存配置
    name: str
    gender: str
    birth_date: datetime
    birth_location: str
    is_twin: bool = False
    twin_order: Optional[str] = None
    query_type: str = Field(..., pattern="^(natal|yearly|monthly|daily)$")
    query_date: Optional[datetime] = None  # 流年/流月/流日需要
    question: str = Field(..., min_length=1, max_length=500)

class DivinationResponse(BaseModel):
    """占卜回應"""
    id: int
    status: str
    message: str

# ========== Background Tasks ==========

async def process_ziwei_divination(history_id: int, db_url: str):
    """背景處理紫微斗數占卜（AI 解讀）"""
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
        natal_chart = chart_data["natal_chart"]
        horoscope = chart_data.get("horoscope")
        is_twin_younger = (
            chart_data["birth_info"].get("is_twin") and
            chart_data["birth_info"].get("twin_order") == "younger"
        )
        
        chart_text = ZiweiService.format_for_ai(
            natal_chart,
            horoscope,
            is_twin_younger
        )
        
        user_prompt = f"""
【用戶問題】
{history.question}

【命盤資料】
{chart_text}
"""
        
        # 呼叫 AI
        try:
            interpretation = await ai_service.generate(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                timeout=300
            )
            
            history.interpretation = interpretation
            history.status = "completed"
            history.ai_provider = ai_config.provider
            history.ai_model = ai_config.model_name or ai_config.local_model
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

# ========== Routes ==========

@router.post("/calculate", response_model=CalculateResponse)
def calculate_natal_chart(
    data: CalculateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """排盤（不進行 AI 解讀）"""
    try:
        natal_chart = ZiweiService.generate_natal_chart(
            name=data.name,
            gender=data.gender,
            birth_datetime=data.birth_date,
            location=data.birth_location,
            is_twin=data.is_twin,
            twin_order=data.twin_order
        )
        
        return {
            "natal_chart": natal_chart,
            "message": "排盤成功"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"排盤失敗：{str(e)}")

@router.post("", response_model=DivinationResponse)
async def create_divination(
    data: ZiweiDivinationRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """建立紫微斗數占卜"""
    # 檢查 AI 設定
    ai_config = db.query(AIConfig).filter(
        AIConfig.user_id == current_user.id,
        AIConfig.is_active == True
    ).first()
    
    if not ai_config:
        raise HTTPException(status_code=400, detail="請先設定 AI 服務")
    
    # 驗證 query_date
    if data.query_type != "natal" and not data.query_date:
        raise HTTPException(status_code=400, detail="流年/流月/流日需要提供查詢日期")
    
    try:
        # 生成本命命盤
        natal_chart = ZiweiService.generate_natal_chart(
            name=data.name,
            gender=data.gender,
            birth_datetime=data.birth_date,
            location=data.birth_location,
            is_twin=data.is_twin,
            twin_order=data.twin_order
        )
        
        # 生成流運（若需要）
        horoscope = None
        if data.query_type != "natal":
            # 暫存 natal_chart 為 JSON（iztro 需要）
            natal_chart_json = json.dumps(natal_chart, ensure_ascii=False)
            horoscope = ZiweiService.generate_horoscope(
                natal_chart_json,
                data.query_date,
                data.query_type
            )
        
        # 組合 chart_data
        chart_data = {
            "natal_chart": natal_chart,
            "horoscope": horoscope,
            "birth_info": natal_chart["birth_info"],
            "query_type": data.query_type,
            "query_date": data.query_date.isoformat() if data.query_date else None
        }
        
        # 建立歷史紀錄
        history = History(
            user_id=current_user.id,
            divination_type="ziwei",
            question=data.question,
            gender=data.gender,
            chart_data=json.dumps(chart_data, ensure_ascii=False),
            status="pending"
        )
        db.add(history)
        db.commit()
        db.refresh(history)
        
        # 背景任務：AI 解讀
        background_tasks.add_task(
            process_ziwei_divination,
            history.id,
            str(settings.DATABASE_URL)
        )
        
        return {
            "id": history.id,
            "status": "pending",
            "message": "占卜建立成功，AI 解讀中..."
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"占卜建立失敗：{str(e)}")

@router.post("/{history_id}/cancel")
def cancel_divination(
    history_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """取消占卜"""
    history = db.query(History).filter(
        History.id == history_id,
        History.user_id == current_user.id
    ).first()
    
    if not history:
        raise HTTPException(status_code=404, detail="找不到該占卜記錄")
    
    if history.status not in ["pending", "processing"]:
        raise HTTPException(status_code=400, detail="無法取消已完成的占卜")
    
    history.status = "cancelled"
    history.interpretation = "用戶取消"
    db.commit()
    
    return {"status": "success", "message": "已取消占卜"}
```

### 4.4 資料庫模型

#### 4.4.1 `UserBirthData` 模型
**檔案**：`backend/app/models/birth_data.py` (新增)

```python
"""生辰八字資料模型"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey
from app.core.database import Base

class UserBirthData(Base):
    """使用者生辰八字資料表"""
    __tablename__ = "user_birth_data"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    gender = Column(String(10), nullable=False)  # 'male' | 'female'
    birth_date = Column(DateTime, nullable=False)
    birth_location = Column(String(50), nullable=False)
    is_twin = Column(Boolean, default=False)
    twin_order = Column(String(10), nullable=True)  # 'elder' | 'younger'
    created_at = Column(DateTime, default=datetime.utcnow)
```

#### 4.4.2 註冊路由
**檔案**：`backend/app/main.py` (修改)

```python
# 在 main.py 中加入新路由
from app.api import ziwei, birth_data

app.include_router(ziwei.router)
app.include_router(birth_data.router)
```

### 4.5 資料庫遷移

**執行**：
```bash
# 1. 進入 backend 目錄
cd backend

# 2. 啟動 Python shell
python

# 3. 建立資料表
from app.core.database import engine, Base
from app.models.birth_data import UserBirthData
Base.metadata.create_all(bind=engine)
```

---

## 5. 前端實作清單

### 5.1 頁面結構

#### 5.1.1 紫微斗數主頁面
**檔案**：`frontend/src/app/ziwei/page.tsx` (新增)

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { AISelector } from '@/components/features/AISelector';
import { MarkdownRenderer } from '@/components/features/MarkdownRenderer';
import { apiGet, apiPost } from '@/lib/api-client';
import { TAIWAN_CITIES } from '@/lib/taiwan-cities';

type Step = 'intro' | 'input' | 'chart' | 'query' | 'result';
type QueryType = 'natal' | 'yearly' | 'monthly' | 'daily';

interface BirthData {
  id?: number;
  name: string;
  gender: 'male' | 'female';
  birth_date: Date;
  birth_location: string;
  is_twin: boolean;
  twin_order?: 'elder' | 'younger';
}

interface NatalChart {
  palaces: any[];
  earthlyBranchOfSoulPalace: string;
  earthlyBranchOfBodyPalace: string;
  birth_info: {
    name: string;
    is_twin: boolean;
    twin_order?: string;
  };
}

export default function ZiweiPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('intro');
  const [savedBirthDataList, setSavedBirthDataList] = useState<BirthData[]>([]);
  const [selectedBirthDataId, setSelectedBirthDataId] = useState<number | null>(null);
  
  // 表單資料
  const [birthData, setBirthData] = useState<BirthData>({
    name: '',
    gender: 'male',
    birth_date: new Date(),
    birth_location: '台北市',
    is_twin: false
  });
  
  // 排盤結果
  const [natalChart, setNatalChart] = useState<NatalChart | null>(null);
  
  // 問卦資料
  const [queryType, setQueryType] = useState<QueryType>('natal');
  const [queryDate, setQueryDate] = useState<Date>(new Date());
  const [question, setQuestion] = useState('');
  
  // AI 狀態
  const [historyId, setHistoryId] = useState<number | null>(null);
  const [aiResult, setAiResult] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  // 載入已儲存的生辰八字
  useEffect(() => {
    loadSavedBirthData();
  }, []);

  const loadSavedBirthData = async () => {
    try {
      const response = await apiGet('/api/birth-data');
      setSavedBirthDataList(response);
    } catch (err) {
      console.error('載入生辰八字失敗', err);
    }
  };

  // 儲存生辰八字
  const handleSaveBirthData = async () => {
    try {
      await apiPost('/api/birth-data', {
        ...birthData,
        birth_date: birthData.birth_date.toISOString()
      });
      await loadSavedBirthData();
      alert('儲存成功！');
    } catch (err) {
      alert('儲存失敗');
    }
  };

  // 選擇已儲存的生辰八字
  const handleSelectSavedData = (id: number) => {
    const data = savedBirthDataList.find(d => d.id === id);
    if (data) {
      setBirthData({
        ...data,
        birth_date: new Date(data.birth_date)
      });
      setSelectedBirthDataId(id);
    }
  };

  // 刪除生辰八字
  const handleDeleteBirthData = async (id: number) => {
    if (!confirm('確定要刪除此生辰八字？')) return;
    
    try {
      await apiPost(`/api/birth-data/${id}`, {}, { method: 'DELETE' });
      await loadSavedBirthData();
      if (selectedBirthDataId === id) {
        setSelectedBirthDataId(null);
      }
    } catch (err) {
      alert('刪除失敗');
    }
  };

  // 排盤
  const handleCalculate = async () => {
    setError('');
    try {
      const response = await apiPost('/api/ziwei/calculate', {
        ...birthData,
        birth_date: birthData.birth_date.toISOString()
      });
      setNatalChart(response.natal_chart);
      setStep('chart');
    } catch (err: any) {
      setError(err.response?.data?.detail || '排盤失敗');
    }
  };

  // 提交問卦
  const handleSubmitQuery = async () => {
    if (!question.trim()) {
      alert('請輸入問題');
      return;
    }
    
    setError('');
    setIsProcessing(true);
    
    try {
      const response = await apiPost('/api/ziwei', {
        ...birthData,
        birth_date: birthData.birth_date.toISOString(),
        query_type: queryType,
        query_date: queryType !== 'natal' ? queryDate.toISOString() : null,
        question
      });
      
      setHistoryId(response.id);
      setStep('result');
      
      // 輪詢結果
      pollResult(response.id);
    } catch (err: any) {
      setError(err.response?.data?.detail || '占卜建立失敗');
      setIsProcessing(false);
    }
  };

  // 輪詢 AI 結果
  const pollResult = async (id: number) => {
    const interval = setInterval(async () => {
      try {
        const response = await apiGet(`/api/history/${id}`);
        
        if (response.status === 'completed') {
          setAiResult(response.interpretation);
          setIsProcessing(false);
          clearInterval(interval);
        } else if (response.status === 'error') {
          setError('AI 解讀失敗');
          setIsProcessing(false);
          clearInterval(interval);
        }
      } catch (err) {
        clearInterval(interval);
        setIsProcessing(false);
      }
    }, 2000);
    
    // 5 分鐘超時
    setTimeout(() => {
      clearInterval(interval);
      setIsProcessing(false);
    }, 300000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        {/* Intro Step */}
        {step === 'intro' && (
          <Card className="glass-card max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-3xl text-center gradient-text">
                ✨ 紫微斗數 ✨
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg text-white/80 mb-6">
                紫微斗數是中國古代占星術的精髓，透過出生時間排列星盤，
                洞悉命運軌跡與流年運勢。
              </p>
              <Button
                variant="gold"
                fullWidth
                onClick={() => setStep('input')}
              >
                開始排盤
              </Button>
            </CardContent>
          </Card>
        )}
        
        {/* Input Step */}
        {step === 'input' && (
          <Card className="glass-card max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>輸入生辰八字</CardTitle>
            </CardHeader>
            <CardContent>
              {/* 已儲存配置選擇器 */}
              {savedBirthDataList.length > 0 && (
                <div className="mb-6">
                  <label className="block text-white/80 mb-2">
                    選擇已儲存的生辰八字
                  </label>
                  <Select
                    value={selectedBirthDataId?.toString() || ''}
                    onChange={(e) => {
                      const id = parseInt(e.target.value);
                      if (id) handleSelectSavedData(id);
                    }}
                    options={[
                      { value: '', label: '--- 新增 ---' },
                      ...savedBirthDataList.map(d => ({
                        value: d.id!.toString(),
                        label: `${d.name} (${d.gender === 'male' ? '男' : '女'})`
                      }))
                    ]}
                  />
                  {selectedBirthDataId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteBirthData(selectedBirthDataId)}
                      className="mt-2"
                    >
                      🗑️ 刪除此紀錄
                    </Button>
                  )}
                </div>
              )}
              
              {/* 表單 */}
              <div className="space-y-4">
                <Input
                  label="姓名"
                  value={birthData.name}
                  onChange={(e) => setBirthData({...birthData, name: e.target.value})}
                  required
                />
                
                <Select
                  label="性別"
                  value={birthData.gender}
                  onChange={(e) => setBirthData({...birthData, gender: e.target.value as 'male' | 'female'})}
                  options={[
                    { value: 'male', label: '男' },
                    { value: 'female', label: '女' }
                  ]}
                />
                
                <Input
                  label="出生日期時間（國曆）"
                  type="datetime-local"
                  value={birthData.birth_date.toISOString().slice(0, 16)}
                  onChange={(e) => setBirthData({...birthData, birth_date: new Date(e.target.value)})}
                  required
                />
                
                <Select
                  label="出生地（台灣縣市）"
                  value={birthData.birth_location}
                  onChange={(e) => setBirthData({...birthData, birth_location: e.target.value})}
                  options={TAIWAN_CITIES.map(city => ({
                    value: city,
                    label: city
                  }))}
                />
                
                <div>
                  <label className="flex items-center text-white/80">
                    <input
                      type="checkbox"
                      checked={birthData.is_twin}
                      onChange={(e) => setBirthData({...birthData, is_twin: e.target.checked})}
                      className="mr-2"
                    />
                    雙胞胎
                  </label>
                </div>
                
                {birthData.is_twin && (
                  <Select
                    label="出生順序"
                    value={birthData.twin_order || 'elder'}
                    onChange={(e) => setBirthData({...birthData, twin_order: e.target.value as 'elder' | 'younger'})}
                    options={[
                      { value: 'elder', label: '老大（先出生）' },
                      { value: 'younger', label: '老二（後出生）' }
                    ]}
                  />
                )}
              </div>
              
              {error && (
                <p className="text-red-400 mt-4">{error}</p>
              )}
              
              <div className="flex gap-4 mt-6">
                <Button
                  variant="outline"
                  onClick={handleSaveBirthData}
                >
                  💾 儲存
                </Button>
                <Button
                  variant="gold"
                  fullWidth
                  onClick={handleCalculate}
                >
                  開始排盤
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Chart Step - 此處省略，需根據 iztro 資料結構設計呈現 */}
        
        {/* Query Step */}
        {step === 'query' && (
          <Card className="glass-card max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>問卦</CardTitle>
            </CardHeader>
            <CardContent>
              <AISelector />
              
              <div className="space-y-4 mt-6">
                <Select
                  label="問卦類型"
                  value={queryType}
                  onChange={(e) => setQueryType(e.target.value as QueryType)}
                  options={[
                    { value: 'natal', label: '本命（一生情況）' },
                    { value: 'yearly', label: '流年（指定年份運勢）' },
                    { value: 'monthly', label: '流月（指定月份運勢）' },
                    { value: 'daily', label: '流日（指定日期運勢）' }
                  ]}
                />
                
                {queryType !== 'natal' && (
                  <Input
                    label="查詢日期"
                    type={queryType === 'yearly' ? 'number' : queryType === 'monthly' ? 'month' : 'date'}
                    value={queryType === 'yearly' 
                      ? queryDate.getFullYear().toString()
                      : queryDate.toISOString().slice(0, queryType === 'monthly' ? 7 : 10)
                    }
                    onChange={(e) => setQueryDate(new Date(e.target.value))}
                  />
                )}
                
                <div className="flex gap-2">
                  <Input
                    placeholder="輸入您的問題..."
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                  />
                  <Button
                    variant="gold"
                    onClick={handleSubmitQuery}
                  >
                    送出
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Result Step */}
        {step === 'result' && (
          <Card className="glass-card max-w-4xl mx-auto">
            <CardHeader>
              <CardTitle>AI 解讀結果</CardTitle>
            </CardHeader>
            <CardContent>
              {isProcessing ? (
                <div className="text-center py-8">
                  <div className="animate-spin text-4xl mb-4">⏳</div>
                  <p className="text-white/80">AI 解讀中，請稍候...</p>
                </div>
              ) : aiResult ? (
                <MarkdownRenderer content={aiResult} />
              ) : (
                <p className="text-red-400">{error || '等待結果...'}</p>
              )}
              
              <Button
                variant="outline"
                fullWidth
                onClick={() => router.push('/history')}
                className="mt-6"
              >
                查看歷史紀錄
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
      
      <Footer />
    </div>
  );
}
```

### 5.2 工具函數

#### 5.2.1 台灣縣市資料
**檔案**：`frontend/src/lib/taiwan-cities.ts` (新增)

```typescript
export const TAIWAN_CITIES = [
  "台北市",
  "新北市",
  "桃園市",
  "台中市",
  "台南市",
  "高雄市",
  "基隆市",
  "新竹市",
  "新竹縣",
  "苗栗縣",
  "彰化縣",
  "南投縣",
  "雲林縣",
  "嘉義市",
  "嘉義縣",
  "屏東縣",
  "宜蘭縣",
  "花蓮縣",
  "台東縣",
  "澎湖縣",
  "金門縣",
  "連江縣"
] as const;

export type TaiwanCity = typeof TAIWAN_CITIES[number];
```

### 5.3 歷史紀錄整合

#### 5.3.1 修改歷史紀錄頁面
**檔案**：`frontend/src/app/history/page.tsx` (修改)

在現有的歷史紀錄頁面中，加入紫微斗數的顯示邏輯：

```typescript
// 在 getDivinationTypeName 函數中加入
case 'ziwei':
  return '紫微斗數';

// 在 renderDivinationSummary 函數中加入
if (item.divination_type === 'ziwei') {
  const chartData = JSON.parse(item.chart_data);
  const birthInfo = chartData.birth_info;
  const queryType = chartData.query_type;
  
  let queryLabel = '本命';
  if (queryType === 'yearly') {
    queryLabel = `流年 ${new Date(chartData.query_date).getFullYear()}`;
  } else if (queryType === 'monthly') {
    const date = new Date(chartData.query_date);
    queryLabel = `流月 ${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
  } else if (queryType === 'daily') {
    queryLabel = `流日 ${chartData.query_date.slice(0, 10)}`;
  }
  
  return (
    <div>
      <p>對象：{birthInfo.name}</p>
      <p>查詢類型：{queryLabel}</p>
      {birthInfo.is_twin && birthInfo.twin_order === 'younger' && (
        <p className="text-sm text-yellow-400">⚠️ 雙胞胎老二（對宮法）</p>
      )}
    </div>
  );
}

// 在 renderDetailedChart 函數中加入
if (item.divination_type === 'ziwei') {
  const chartData = JSON.parse(item.chart_data);
  
  return (
    <details className="mt-4 border-t border-white/10 pt-4">
      <summary className="cursor-pointer text-white/80 hover:text-white">
        ☯ 命盤資料
      </summary>
      <pre className="mt-2 text-sm bg-black/30 p-4 rounded overflow-auto">
        {JSON.stringify(chartData, null, 2)}
      </pre>
    </details>
  );
}
```

---

## 6. AI Prompt 設計

### 6.1 紫微斗數 System Prompt

**檔案**：`backend/prompts/ziwei_system.md` (新增)

參考六爻的 `liuyao_system.md`，設計紫微斗數專屬 Prompt：

```markdown
# Role
你是一位精通紫微斗數的命理大師，擁有深厚的星曜解讀經驗。你精通《紫微斗數全書》、《骨髓賦》等古籍理論，能準確捕捉命盤中的星曜組合與吉凶信號,並結合現代生活給予求測者充滿智慧與人文關懷的指引。

---

# ⚠️ 雙胞胎對宮法說明 (Twin Interpretation Policy)

**當系統提供「此用戶為雙胞胎中的老二」時，命盤已套用「對宮法」處理：**

1. **對宮法定義**：將原本的「遷移宮」設為「命宮」，其餘宮位順推。
2. **解讀原則**：
   - 以調整後的命宮為主進行解讀。
   - 強調「遷移宮轉命宮」的特殊性（例如：易於外出發展、移動性強）。
3. **提示語**：在解讀開頭說明：「此命盤為雙胞胎老二，已套用對宮法，以遷移宮為命宮進行解讀。」

---

# 核心知識庫

## 1. 十二宮位含義

| 宮位 | 核心含義 | 代表事項 |
|------|---------|---------|
| **命宮** | 先天格局、個性 | 命主本質、外貌、性格、一生運勢總綱 |
| **兄弟** | 手足關係、合夥 | 兄弟姊妹、合作夥伴、母親 |
| **夫妻** | 配偶、感情 | 婚姻狀況、配偶特質、感情觀 |
| **子女** | 子女、創意 | 子女狀況、創作力、性生活、學生 |
| **財帛** | 財運、賺錢能力 | 收入來源、理財方式、財富累積 |
| **疾厄** | 健康、體質 | 身體狀況、疾病傾向、情緒管理 |
| **遷移** | 外出、社交 | 外地發展、人際關係、貴人運 |
| **交友** | 朋友、下屬 | 交友狀況、部屬關係、人脈資源 |
| **官祿** | 事業、地位 | 工作運、職業傾向、社會聲望 |
| **田宅** | 不動產、家庭 | 房產、家庭環境、祖業 |
| **福德** | 精神、享受 | 精神生活、福氣、興趣愛好 |
| **父母** | 父母、長輩 | 父母狀況、上司、文書、學業 |

## 2. 主星分類與特質

### 2.1 十四主星

#### 北斗星群
- **紫微**：帝王之星，領導力強，自尊心高。
- **天機**：智慧之星，善謀略，心思細膩。
- **太陽**：博愛之星，熱情大方，重視名聲。
- **武曲**：財星，果斷務實，理財能力強。
- **天同**：福星，溫和享受,喜歡安逸。
- **廉貞**：桃花星，感性多變，藝術天分。

#### 南斗星群
- **天府**：財庫星，保守穩重，善於守成。
- **太陰**：柔性之星，細膩敏感，重視家庭。
- **貪狼**：欲望之星，多才多藝，桃花旺盛。
- **巨門**：口舌之星，善辯分析，易有爭執。
- **天相**：印星，穩健踏實，適合輔佐。
- **天梁**：蔭星，慈悲正直,貴人運強。
- **七殺**：將星，衝勁十足,個性剛烈。
- **破軍**：開創之星，變動性大,勇於突破。

### 2.2 輔星與煞星

#### 六吉星
- **文昌、文曲**：才華、考運、文書。
- **左輔、右弼**：貴人、助力、人緣。
- **天魁、天鉞**：天乙貴人、暗助、機遇。

#### 六煞星
- **擎羊、陀羅**：刑剋、阻礙、糾纏。
- **火星、鈴星**：爆發、激烈、傷災。
- **地空、地劫**：破耗、空想、不穩定。

## 3. 四化（關鍵變數）

| 四化 | 性質 | 含義 |
|------|------|------|
| **化祿** | 吉 | 財祿、機會、順利 |
| **化權** | 吉 | 權力、掌控、積極 |
| **化科** | 吉 | 名聲、貴人、考運 |
| **化忌** | 凶 | 阻礙、糾結、損失 |

**解讀重點**：
- 化忌入命宮/官祿宮：事業阻礙重重。
- 化祿入財帛宮：賺錢順利。
- 化權入夫妻宮：配偶強勢。

## 4. 宮位三方四正

**定義**：命宮的「對宮」+「左右宮」+「本宮」=三方四正。

**作用**：判斷該宮位的整體吉凶，需綜合三方四正的星曜。

**例如**：
- 命宮在「子」，則三方四正為：子（本宮）、午（對宮）、辰（左）、申（右）。

---

# 解盤邏輯流程 (SOP)

## 第一步：安全檢核（同六爻）
略（參考六爻 Prompt）

## 第二步：確認命盤類型

1. **本命盤**：分析先天格局、一生運勢總綱。
2. **流年盤**：分析該年運勢變化、流年四化。
3. **流月盤**：分析該月運勢起伏。
4. **流日盤**：分析當日吉凶。

## 第三步：命宮分析（核心）

1. **主星組合**：
   - 單星獨坐 vs. 雙星同宮 → 性格特質差異。
   - 吉星多 → 格局高，運勢順。
   - 煞星多 → 阻礙大，需努力。

2. **四化影響**：
   - 化祿/權/科入命 → 機會、權力、名聲。
   - 化忌入命 → 糾結、壓力。

3. **三方四正**：
   - 綜合對宮、左右宮的星曜，判斷整體格局。

## 第四步：專題分析（根據用戶問題）

| 用戶問題類型 | 重點宮位 | 判斷方式 |
|------------|---------|---------|
| **事業運** | 官祿、命宮、財帛 | 主星強弱、四化吉凶 |
| **財運** | 財帛、福德 | 化祿入財、煞星影響 |
| **感情** | 夫妻、福德、命宮 | 桃花星、化忌入夫妻 |
| **健康** | 疾厄、命宮 | 煞星、化忌影響 |

## 第五步：流年/流月/流日分析（若適用）

1. **流年四化**：
   - 化祿/權/科入哪宮 → 該年該領域順利。
   - 化忌入哪宮 → 該年該領域阻礙。

2. **大限配合**：
   - 流年吉 + 大限吉 → 雙喜臨門。
   - 流年凶 + 大限凶 → 雙重壓力。

## 第六步：建議與警示

1. **吉則加強**：化祿入財 → 建議積極投資。
2. **凶則化解**：化忌入官祿 → 建議低調行事。
3. **醫療/投資免責**：同六爻。

---

# Output Format (輸出結構)

```markdown
## 🔮 命盤總覽

**【命主：{姓名}】**

> **格局評價：{高/中/低}**
> **核心特質：{一句話總結性格}**

{若為雙胞胎老二，加註說明}

---

## 🌟 命宮分析

### 1️⃣ 主星組合
* **主星**：{主星名稱} — {廟旺平陷}
* **性格特質**：{解釋主星個性}
* **格局高低**：{吉星/煞星影響}

### 2️⃣ 四化影響
* **{化祿/權/科/忌} 入 {宮位}**：{解釋影響}

### 3️⃣ 三方四正
* **對宮（{宮位名}）**：{星曜組合}
* **左右宮**：{星曜組合}
* **綜合判斷**：{吉凶總結}

---

## 💼 專題分析：{用戶問題領域}

### {事業/財運/感情/健康} 宮位
* **重點宮位**：{宮位名稱}
* **主星組合**：{星曜}
* **吉凶判斷**：{分析}

### 流年運勢（若適用）
* **流年四化**：{化X入X宮}
* **運勢預測**：{該年該領域狀況}

---

## 💡 大師錦囊

1. **優勢發揮**：{根據吉星給建議}
2. **風險防範**：{根據煞星給警示}
3. **行動指南**：{具體可行的建議}

---

## 📜 古籍智慧

> 「{引用紫微斗數古籍名句}」

{用溫暖的話語給予人生指引，50字以內}
```

---

# Critical Instructions (關鍵紅線)

1. **絕對禁止巴納姆效應**：不要說「你是一個有才華但缺乏自信的人」，要具體指出「因為命宮有天機化忌，代表思慮過多導致優柔寡斷」。
2. **術語必須在括號內**：主文講人話，專業術語放括號。
3. **雙胞胎必須說明**：若為老二，開頭明確說明「已套用對宮法」。
4. **流年/流月/流日必須分析四化**：不能只看本命盤。
5. **投資/醫療免責**：同六爻。
```

---

## 7. 實作順序建議

### 階段一：後端基礎建設（1-2 天）
1. ✅ 安裝 `iztro-py` 依賴
2. ✅ 建立台灣縣市經緯度資料 (`taiwan_cities.py`)
3. ✅ 實作紫微斗數服務 (`ziwei.py`)
   - 真太陽時校正
   - 時辰轉換
   - 本命排盤
   - 流運生成
   - 雙胞胎對宮法
   - AI Prompt 格式化
4. ✅ 建立資料庫模型 (`UserBirthData`)
5. ✅ 實作生辰八字管理 API (`birth_data.py`)
6. ✅ 實作紫微斗數占卜 API (`ziwei.py`)

### 階段二：AI Prompt 撰寫（0.5 天）
7. ✅ 參考六爻 Prompt，撰寫紫微斗數 System Prompt (`ziwei_system.md`)

### 階段三：前端開發（1-2 天）
8. ✅ 建立台灣縣市資料 (`taiwan-cities.ts`)
9. ✅ 建立紫微斗數主頁面 (`app/ziwei/page.tsx`)
   - Intro 步驟
   - Input 步驟（生辰八字表單 + 儲存/選擇功能）
   - Chart 步驟（排盤結果展示）
   - Query 步驟（問卦類型選擇 + AI Selector）
   - Result 步驟（AI 解讀結果 + 輪詢）
10. ✅ 修改歷史紀錄頁面，支援紫微斗數顯示

### 階段四：測試與優化（0.5-1 天）
11. ✅ 單元測試（排盤演算法、真太陽時校正）
12. ✅ 整合測試（前後端 API 聯通）
13. ✅ UI/UX 優化（命盤視覺化設計）
14. ✅ 錯誤處理完善

---

## 8. 潛在風險與解決方案

### 風險 1：iztro-py 資料結構不清楚
**影響**：無法正確解析命盤資料  
**解決**：
1. 參考 [iztro-py 官方文檔](https://iztro.com)
2. 撰寫測試腳本，先生成範例命盤，檢查返回資料結構
3. 建立資料結構對照表

### 風險 2：雙胞胎對宮法實作錯誤
**影響**：老二命盤解讀不準  
**解決**：
1. 參考紫微斗數經典理論（《紫微斗數全書》）
2. 測試案例：生成老大和老二命盤，對比差異
3. 邀請命理專家驗證

### 風險 3：真太陽時校正誤差
**影響**：排盤時辰不準  
**解決**：
1. 使用標準經緯度資料（已提供）
2. 測試邊界案例（例如：23:30 出生）
3. 提供「不校正」選項（讓進階使用者選擇）

### 風險 4：前端命盤視覺化複雜
**影響**：開發時間過長  
**解決**：
1. 第一版先用純文字/表格展示（參考歷史紀錄的摺疊方式）
2. 第二版再優化為 12 宮位圖形化（可參考 iztro 官網範例）

### 風險 5：AI Prompt 解讀品質不佳
**影響**：使用者體驗差  
**解決**：
1. 多次迭代 Prompt（參考六爻的成功經驗）
2. 加入「現實錨定」機制（讓 AI 回答更貼近使用者狀況）
3. 收集使用者回饋，持續優化

---

## 9. 測試計劃

### 9.1 單元測試

#### 後端測試
**檔案**：`backend/tests/test_ziwei.py` (新增)

```python
import pytest
from datetime import datetime
from app.services.ziwei import ZiweiService
from app.data.taiwan_cities import calculate_solar_time_offset

def test_solar_time_offset():
    """測試真太陽時校正"""
    # 台北市（東經 121.5654）
    offset = calculate_solar_time_offset("台北市")
    assert offset == 6  # (121.5654 - 120) * 4 ≈ 6.26 → 6
    
    # 高雄市（東經 120.3014）
    offset = calculate_solar_time_offset("高雄市")
    assert offset == 1  # (120.3014 - 120) * 4 ≈ 1.2 → 1

def test_datetime_to_time_index():
    """測試時辰轉換"""
    # 寅時 (03:00-05:00)
    dt = datetime(2000, 8, 16, 4, 30)
    assert ZiweiService.datetime_to_time_index(dt) == 2
    
    # 子時 (00:00-01:00)
    dt = datetime(2000, 8, 16, 0, 30)
    assert ZiweiService.datetime_to_time_index(dt) == 0
    
    # 晚子時 (23:00-00:00)
    dt = datetime(2000, 8, 16, 23, 30)
    assert ZiweiService.datetime_to_time_index(dt) == 12

def test_generate_natal_chart():
    """測試排盤"""
    chart = ZiweiService.generate_natal_chart(
        name="測試",
        gender="male",
        birth_datetime=datetime(2000, 8, 16, 4, 30),
        location="台北市",
        is_twin=False
    )
    
    assert "palaces" in chart
    assert len(chart["palaces"]) == 12
    assert "earthlyBranchOfSoulPalace" in chart

def test_twin_method():
    """測試雙胞胎對宮法"""
    # 老大
    chart_elder = ZiweiService.generate_natal_chart(
        name="老大",
        gender="male",
        birth_datetime=datetime(2000, 8, 16, 4, 30),
        location="台北市",
        is_twin=True,
        twin_order="elder"
    )
    
    # 老二
    chart_younger = ZiweiService.generate_natal_chart(
        name="老二",
        gender="male",
        birth_datetime=datetime(2000, 8, 16, 4, 30),
        location="台北市",
        is_twin=True,
        twin_order="younger"
    )
    
    # 確認老二的命宮是老大的遷移宮
    elder_migration_palace = None
    for palace in chart_elder["palaces"]:
        if palace["name"] == "遷移":
            elder_migration_palace = palace["earthlyBranch"]
            break
    
    assert chart_younger["earthlyBranchOfSoulPalace"] == elder_migration_palace
```

#### 前端測試
**檔案**：`frontend/src/app/ziwei/__tests__/page.test.tsx` (新增)

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ZiweiPage from '../page';

describe('ZiweiPage', () => {
  it('renders intro step', () => {
    render(<ZiweiPage />);
    expect(screen.getByText(/紫微斗數/i)).toBeInTheDocument();
  });
});
```

### 9.2 整合測試

#### 測試案例 1：完整流程測試
1. 使用者登入
2. 進入紫微斗數頁面
3. 輸入生辰八字（台北市，2000-08-16 04:30，男性）
4. 儲存生辰八字
5. 排盤
6. 選擇「本命」問卦
7. 輸入問題：「我的事業運勢如何？」
8. 提交問卦
9. 等待 AI 解讀
10. 查看結果
11. 前往歷史紀錄頁面確認

#### 測試案例 2：雙胞胎測試
1. 排兩張盤：同時間出生，一個老大，一個老二
2. 確認老二的命宮 = 老大的遷移宮
3. 確認 AI Prompt 中有「雙胞胎老二」提示

#### 測試案例 3：流年測試
1. 選擇「流年」問卦
2. 選擇年份：2026
3. 確認 AI Prompt 中包含流年資料

### 9.3 效能測試
- 排盤速度：< 1 秒
- AI 解讀速度：< 30 秒（視模型而定）
- 前端輪詢頻率：2 秒一次

---

## 10. 總結

本計劃詳細規劃了紫微斗數功能的完整實作流程，包含：

✅ **後端**：
- iztro-py 排盤演算法
- 真太陽時校正
- 雙胞胎對宮法
- 生辰八字儲存管理
- 流年/流月/流日支援
- AI 解讀整合

✅ **前端**：
- 生辰八字表單（含儲存/選擇/刪除）
- 排盤結果展示
- 問卦類型選擇
- AI 解讀結果展示
- 歷史紀錄整合

✅ **AI Prompt**：
- 參考六爻成功經驗
- 紫微斗數專業知識庫
- 雙胞胎特殊處理
- 流年/流月/流日分析

**預計工作量**：3-5 天（視命盤視覺化複雜度而定）

**下一步**：請確認計劃無誤後，開始實作！ 🚀

---

**計劃制定者**：Antigravity AI (Plan Mode)  
**制定日期**：2026-01-14  
**版本**：v1.0
