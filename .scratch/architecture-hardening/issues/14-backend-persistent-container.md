# 14 — [架構] 後端常駐容器／async DB

**What to build:** 評估把 FastAPI 移到常駐容器（Fly.io／Railway／Render／Cloud Run）並把進行中狀態移到 Redis（Upstash）或 DB，或改 async DB driver（asyncpg）。

**Why:** Serverless 本質不適合「長連線＋長時 AI＋記憶體狀態」；這能一次解決逾時截斷、連線池擴散、事件迴圈阻塞與限流失效。

**Status:** deferred（後續討論調整架構）

## 討論要點
- 成本對比：Vercel Pro Fluid Compute vs 常駐容器
- 狀態外部化（限流、佔位、presence、性能記錄）
- 資料庫連線池與讀寫分離

## Out of scope（本輪）
架構層改動，待後續討論。
