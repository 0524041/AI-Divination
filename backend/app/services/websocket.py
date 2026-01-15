from typing import List
from fastapi import WebSocket


class ConnectionManager:
    """管理 WebSocket 連接"""

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        await self.broadcast_count()

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast_count(self):
        """廣播當前在線人數給所有客戶端"""
        count = len(self.active_connections)
        # 複製列表以避免在迭代時修改導致的錯誤 (雖然後端是單線程，但安全起見)
        for connection in list(self.active_connections):
            try:
                await connection.send_json({"type": "online_count", "count": count})
            except Exception:
                # 如果發送失敗（連接已斷開但未移除），則移除它
                self.disconnect(connection)


manager = ConnectionManager()
