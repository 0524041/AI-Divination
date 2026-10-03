"""
AI-Divination Backend App

注意：此處刻意不匯出任何東西。`app/main.py` 與 `app/api/*`
互相引用，若套件根再 `from app.main import app` 會形成循環匯入——
本地 `uvicorn app.main:app` 恰好躲過，但在 Vercel（以檔案路徑直接載入
entrypoint）下必爆 ImportError。統一律：永遠用 `app.main:app` 完整路徑。
"""
