# 後端性能分析與優化指南

## 🔍 問題診斷

你提到感覺後端訪問 DB 時有延遲，可能的原因包括：

### 1. 資料庫相關延遲
- ❌ **缺少索引**：查詢時需要全表掃描
- ❌ **資料庫碎片**：長時間使用後，SQLite 檔案產生碎片
- ❌ **查詢效率低**：沒有優化的 SQL 查詢
- ❌ **連接池問題**：頻繁建立/關閉資料庫連接

### 2. 後端計算延遲
- ❌ **序列化開銷**：JSON 序列化/反序列化大量數據
- ❌ **同步操作**：阻塞式的資料處理
- ❌ **無快取機制**：重複查詢相同數據

---

## 🛠️ 我為你準備的診斷工具

### 1. 性能監控系統
已經為你的後端添加了完整的性能監控：

#### 自動監控每個 API 請求
- 記錄每個請求的響應時間
- 在 HTTP Header 中返回 `X-Response-Time`
- 自動記錄慢請求（>1秒）到日誌

#### 性能分析 API（管理員專用）
```bash
# 查看整體性能統計
GET http://localhost:8000/api/debug/performance

# 查看慢查詢分析
GET http://localhost:8000/api/debug/slow-queries

# 查看資料庫統計
GET http://localhost:8000/api/debug/database
```

### 2. 資料庫優化工具

#### 一鍵性能分析
```bash
# 執行完整的性能分析
./analyze_performance.sh
```

這會檢查：
- ✓ 資料庫檔案大小
- ✓ 記錄數統計
- ✓ 查詢速度測試
- ✓ 索引狀況
- ✓ 提供優化建議

#### 資料庫優化腳本
```bash
cd backend

# 創建索引 + 分析（推薦先執行這個）
python3 optimize_db.py all

# 查看現有索引
python3 optimize_db.py show

# 清理資料庫碎片（可選）
python3 optimize_db.py vacuum
```

---

## 🚀 優化方案

### 立即優化（5分鐘）

1. **創建資料庫索引**（最重要！）
```bash
cd backend
python3 optimize_db.py all
```

已為以下欄位創建索引：
- `history(user_id)` - 用戶歷史查詢
- `history(created_at)` - 時間排序
- `history(divination_type)` - 類型篩選
- `history(user_id, created_at)` - 複合索引
- `ai_configs(user_id, is_active)` - AI 配置查詢
- `users(username)` - 登入查詢

**預期效果**：查詢速度提升 2-10 倍

2. **重啟後端服務**
```bash
./start.sh --stop
./start.sh
```

現在後端會自動記錄性能資訊。

### 監控與分析（10分鐘）

3. **執行性能分析**
```bash
./analyze_performance.sh
```

查看輸出，確認：
- 查詢時間是否 < 50ms
- 是否已創建索引
- 資料庫大小是否合理

4. **使用瀏覽器查看即時監控**

訪問這些 API（需要管理員登入）：
```
http://localhost:8000/api/debug/performance
http://localhost:8000/api/debug/slow-queries
http://localhost:8000/api/debug/database
```

5. **觀察日誌**
```bash
./start.sh --logs
```

查找：
- `⏱️ SLOW REQUEST` - 慢請求（>1秒）
- `⚠️` - 警告級別（>0.5秒）
- `✓` - 正常請求

### 進階優化（可選）

6. **如果資料庫較大（>10MB），執行 VACUUM**
```bash
cd backend
python3 optimize_db.py vacuum
```

7. **定期執行 ANALYZE**（每週一次）
```bash
cd backend
python3 optimize_db.py analyze
```

---

## 📊 性能基準

### 正常性能指標：
- 簡單查詢（SELECT）：< 10ms
- 排序查詢（ORDER BY）：< 30ms
- 聯結查詢（JOIN）：< 50ms
- API 總響應時間：< 200ms

### 如果超過以下數值，需要優化：
- ⚠️ 查詢 > 100ms
- ⚠️ API 響應 > 500ms
- 🚨 API 響應 > 1000ms

---

## 🔧 常見問題解決

### Q: 如何確認是 DB 慢還是計算慢？

**A: 查看日誌中的詳細計時**

啟用性能監控後，日誌會顯示：
```
🗄️  DB Query [get_user_history]: 45.2ms
✓ get_history() 耗時: 120ms
⏱️  GET /api/history - 0.125s
```

- 如果 DB Query 時間佔大部分 → DB 問題
- 如果函數耗時遠大於 DB Query → 計算問題

### Q: 歷史紀錄很多，查詢變慢？

**A: 使用分頁 + 索引**

1. 確保已創建索引（見上方優化步驟）
2. API 已經支援分頁：
```
GET /api/history?page=1&page_size=20
```

### Q: 每次啟動都很慢？

**A: 檢查資料庫連接配置**

目前配置是單線程連接池，如果需要提升併發：

編輯 [database.py](backend/app/core/database.py)：
```python
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False},
    pool_size=10,  # 添加這行
    max_overflow=20  # 添加這行
)
```

---

## 📈 監控持續改進

### 1. 使用性能 API 持續監控
定期訪問 `/api/debug/slow-queries` 找出最慢的端點。

### 2. 查看 X-Response-Time Header
在瀏覽器開發者工具的 Network 面板，每個請求都會返回響應時間。

### 3. 分析日誌
```bash
# 找出所有慢請求
./start.sh --logs | grep "SLOW REQUEST"

# 找出 DB 查詢時間
./start.sh --logs | grep "DB Query"
```

---

## 🎯 下一步

1. ✅ **立即執行**：`python3 backend/optimize_db.py all`
2. ✅ **重啟後端**：`./start.sh --stop && ./start.sh`
3. ✅ **執行分析**：`./analyze_performance.sh`
4. ✅ **使用網站，觀察日誌**：`./start.sh --logs`
5. ✅ **訪問性能監控 API**：確認改善效果

如果執行後仍有問題，查看具體的慢查詢日誌，我可以進一步優化特定的 API。
