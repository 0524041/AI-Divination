"""Vercel Serverless 入口（backend 專案 Root Directory 指向 backend/）

Vercel Python runtime 會將此 `app` 以 ASGI 方式託管；
vercel.json 把所有路由 rewrite 到這支 function。
"""

from app.main import app  # noqa: F401
