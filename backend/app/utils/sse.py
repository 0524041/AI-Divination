"""
Server-Sent Events (SSE) 工具模組
用於安全的長時間通訊
"""
import json
import asyncio
import logging
from typing import AsyncGenerator, Any, Optional
from fastapi import Request
from fastapi.responses import StreamingResponse

logger = logging.getLogger(__name__)


class SSEManager:
    """SSE 連接管理器"""
    
    def __init__(self):
        self.active_connections: dict[str, bool] = {}
    
    def register(self, connection_id: str):
        """註冊新連接"""
        self.active_connections[connection_id] = True
        logger.info(f"SSE connection registered: {connection_id}")
    
    def unregister(self, connection_id: str):
        """取消註冊連接"""
        if connection_id in self.active_connections:
            self.active_connections[connection_id] = False
            logger.info(f"SSE connection unregistered: {connection_id}")
    
    def is_active(self, connection_id: str) -> bool:
        """檢查連接是否活躍"""
        return self.active_connections.get(connection_id, False)


# 全局 SSE 管理器
sse_manager = SSEManager()


async def sse_generator(
    request: Request,
    connection_id: str,
    data_generator: AsyncGenerator[Any, None]
) -> AsyncGenerator[str, None]:
    """
    SSE 事件生成器
    
    Args:
        request: FastAPI 請求對象
        connection_id: 連接 ID
        data_generator: 數據生成器
    
    Yields:
        格式化的 SSE 事件
    """
    try:
        # 註冊連接
        sse_manager.register(connection_id)
        
        # 發送連接確認
        yield format_sse_message("connected", {"connection_id": connection_id})
        
        # 持續發送數據
        async for data in data_generator:
            # 檢查客戶端是否斷開
            if await request.is_disconnected():
                logger.info(f"Client disconnected: {connection_id}")
                break
            
            # 檢查連接是否被取消
            if not sse_manager.is_active(connection_id):
                logger.info(f"Connection cancelled: {connection_id}")
                yield format_sse_message("cancelled", {"connection_id": connection_id})
                break
            
            # 發送數據
            if isinstance(data, dict):
                event_type = data.get("type", "message")
                event_data = data.get("data", data)
            else:
                event_type = "message"
                event_data = data
            
            yield format_sse_message(event_type, event_data)
            
            # 避免過快發送
            await asyncio.sleep(0.01)
        
        # 發送完成事件
        yield format_sse_message("done", {"connection_id": connection_id})
        
    except asyncio.CancelledError:
        logger.info(f"SSE generator cancelled: {connection_id}")
        yield format_sse_message("cancelled", {"connection_id": connection_id})
    except Exception as e:
        logger.error(f"SSE generator error: {e}")
        yield format_sse_message("error", {"error": str(e)})
    finally:
        # 清理連接
        sse_manager.unregister(connection_id)


def format_sse_message(event: str, data: Any) -> str:
    """
    格式化 SSE 消息
    
    Args:
        event: 事件類型
        data: 事件數據
    
    Returns:
        格式化的 SSE 消息
    """
    if isinstance(data, (dict, list)):
        data_str = json.dumps(data, ensure_ascii=False)
    else:
        data_str = str(data)
    
    return f"event: {event}\ndata: {data_str}\n\n"


def create_sse_response(
    request: Request,
    connection_id: str,
    data_generator: AsyncGenerator[Any, None]
) -> StreamingResponse:
    """
    創建 SSE 響應
    
    Args:
        request: FastAPI 請求對象
        connection_id: 連接 ID
        data_generator: 數據生成器
    
    Returns:
        StreamingResponse
    """
    return StreamingResponse(
        sse_generator(request, connection_id, data_generator),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # 禁用 nginx 緩衝
        }
    )


async def cancel_sse_connection(connection_id: str):
    """
    取消 SSE 連接
    
    Args:
        connection_id: 連接 ID
    """
    sse_manager.unregister(connection_id)
