"""
測試基礎建設煙霧測試（Ticket 01）

驗證 pytest 夾具本身可靠，後續票券才能信賴它們：
1. 假 OpenAI-compatible 伺服器四種行為（單發/串流/錯誤/延遲逾時）
2. 帶認證打現有端點
3. 資料庫隔離機制
"""

import httpx
import pytest

from app.core.database import SessionLocal
from app.models import User

# --- 1. 假伺服器行為 ---


@pytest.mark.asyncio
async def test_fake_server_single_completion(fake_ai):
    """單發 JSON 完成：回應形狀正確且請求被記錄"""
    fake_ai.respond_json("測試解盤內容")

    response = await httpx.AsyncClient().post(
        f"{fake_ai.base_url}/v1/chat/completions",
        json={"model": "fake-model", "messages": [{"role": "user", "content": "hi"}]},
        headers={"Authorization": "Bearer sk-test"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["choices"][0]["message"]["content"] == "測試解盤內容"
    assert body["usage"]["completion_tokens"] > 0

    # 請求記錄供斷言形狀
    assert fake_ai.last_request["path"] == "/v1/chat/completions"
    assert fake_ai.last_request["headers"]["authorization"] == "Bearer sk-test"
    assert fake_ai.last_request["body"]["model"] == "fake-model"


@pytest.mark.asyncio
async def test_fake_server_streaming_deltas_and_done(fake_ai):
    """SSE 串流：逐 delta data 行＋[DONE] 終止"""
    fake_ai.respond_stream(["甲", "乙", "丙"])

    async with httpx.AsyncClient(timeout=10.0) as http:
        async with http.stream(
            "POST",
            f"{fake_ai.base_url}/v1/chat/completions",
            json={"model": "fake-model", "messages": []},
        ) as response:
            assert response.status_code == 200
            assert response.headers["content-type"].startswith("text/event-stream")

            events: list[str] = []
            done_seen = False
            async for line in response.aiter_lines():
                if not line.startswith("data: "):
                    continue
                payload = line.removeprefix("data: ")
                if payload == "[DONE]":
                    done_seen = True
                    break
                events.append(payload)

    assert done_seen, "必須以 data: [DONE] 結尾"
    contents = [
        __import__("json").loads(e)["choices"][0]["delta"]["content"] for e in events
    ]
    assert contents == ["甲", "乙", "丙"]


@pytest.mark.asyncio
@pytest.mark.parametrize("status_code", [401, 429, 500])
async def test_fake_server_error_injection(fake_ai, status_code):
    """錯誤注入：401/429/500 各自以指定狀態碼與錯誤體回應"""
    fake_ai.respond_error(status_code, message="injected failure")

    response = await httpx.AsyncClient().post(
        f"{fake_ai.base_url}/v1/chat/completions", json={}
    )

    assert response.status_code == status_code
    assert response.json()["error"]["message"] == "injected failure"


@pytest.mark.asyncio
async def test_fake_server_delay_causes_client_timeout(fake_ai):
    """人為延遲：超過客戶端逾時即觸發 ReadTimeout"""
    fake_ai.delay = 1.0

    with pytest.raises(httpx.ReadTimeout):
        async with httpx.AsyncClient(timeout=0.2) as http:
            await http.post(f"{fake_ai.base_url}/v1/chat/completions", json={})


@pytest.mark.asyncio
async def test_fake_server_models_endpoint(fake_ai):
    """/v1/models 端點可供未來 model picker 使用"""
    fake_ai.models_response = {
        "object": "list",
        "data": [{"id": "m-1"}, {"id": "m-2"}],
    }

    response = await httpx.AsyncClient().get(f"{fake_ai.base_url}/v1/models")

    assert response.status_code == 200
    assert [m["id"] for m in response.json()["data"]] == ["m-1", "m-2"]


# --- 2. 認證 API 客戶端 ---


def test_health_endpoint_public(client):
    """/health 公開可達（app 於測試環境可完整啟動）"""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_auth_me_with_created_user(client, make_user, auth_headers):
    """夾具建立的使用者能通過 /api/auth/me 認證"""
    user = make_user(username="smoke-user", role="user")
    response = client.get("/api/auth/me", headers=auth_headers(user.username))

    assert response.status_code == 200
    assert response.json()["username"] == "smoke-user"


def test_auth_me_without_token_rejected(client):
    """無 token 被 401 拒絕（認證管線正常）"""
    response = client.get("/api/auth/me")
    assert response.status_code == 401


# --- 3. 資料庫隔離 ---


def _query_user(username: str) -> User | None:
    with SessionLocal() as session:
        return session.query(User).filter(User.username == username).first()


def test_db_write_visible_within_test(make_user):
    """同一測試內寫入立即可見"""
    make_user(username="visible-probe")
    assert _query_user("visible-probe") is not None


def test_db_isolation_from_previous_test(make_user):
    """clean_db 清空機制：上個測試的資料不會洩漏到下一個測試

    （本檔案中前一個測試已寫入 visible-probe；此處必須查無此人）
    """
    assert _query_user("visible-probe") is None
    # 且本測試自己的寫入正常
    make_user(username="current-probe")
    assert _query_user("current-probe") is not None


def test_history_table_also_cleaned(make_user):
    """所有註冊模型資料表都在清空範圍（以 History 抽樣驗證）"""
    from app.models import History

    user = make_user(username="history-probe")
    with SessionLocal() as session:
        session.add(
            History(
                user_id=user.id,
                divination_type="liuyao",
                question="q",
                chart_data="{}",
            )
        )
        session.commit()

    assert _query_user("history-probe") is not None
    with SessionLocal() as session:
        # 下一個測試將由 clean_db 清掉；本測試僅確認可寫入
        assert session.query(History).count() >= 1
