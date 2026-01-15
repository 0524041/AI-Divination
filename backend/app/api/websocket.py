from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.websocket import manager

router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws/online")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # 保持連接活躍，客戶端可以發送 ping
            # 我們只需要監聽斷開事件
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.broadcast_count()
    except Exception:
        # 其他異常
        manager.disconnect(websocket)
        await manager.broadcast_count()
