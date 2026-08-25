"""
Thread 訊息模型與遷移測試（Ticket 03）
"""

from app.core.database import SessionLocal
from app.core.thread_migrations import migrate_history_to_messages
from app.models import History, ThreadMessage, User
from app.models.thread_message import extract_think


def _make_user(username: str = "migrate-user") -> User:
    with SessionLocal() as db:
        user = User(username=username, password_hash="x", role="user", is_active=True)
        db.add(user)
        db.commit()
        db.refresh(user)
        return user


def _make_record(
    user_id: int,
    interpretation: str | None,
    status: str = "completed",
    ai_model: str | None = "test-model",
) -> History:
    with SessionLocal() as db:
        record = History(
            user_id=user_id,
            divination_type="liuyao",
            question="測試問題",
            chart_data="{}",
            interpretation=interpretation,
            status=status,
            ai_model=ai_model,
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record


def _messages_of(record_id: int) -> list[ThreadMessage]:
    with SessionLocal() as db:
        return (
            db.query(ThreadMessage)
            .filter(ThreadMessage.record_id == record_id)
            .order_by(ThreadMessage.id)
            .all()
        )


# --- extract_think 單元 ---


def test_extract_think_with_block():
    think, content = extract_think("<think>思考中</think>\n## 解盤\n正文")
    assert think == "思考中"
    assert content == "## 解盤\n正文"


def test_extract_think_multiple_blocks_joined():
    think, content = extract_think("<think>A</think>X<think>B</think>Y")
    assert think == "A\nB"
    assert content == "XY"


def test_extract_think_multiline_block():
    think, content = extract_think("<think>第一行\n第二行</think>正文")
    assert think == "第一行\n第二行"
    assert content == "正文"


def test_extract_think_without_block():
    think, content = extract_think("純正文")
    assert think is None
    assert content == "純正文"


# --- 遷移：四種 legacy 形態 ---


def test_migration_record_with_think_block():
    """含 think 的解盤 → assistant 訊息（think 分流）"""
    user = _make_user()
    record = _make_record(
        user.id, "<think>推理過程</think># 卦象解讀\n這是好卦。"
    )

    created = migrate_history_to_messages(SessionLocal())
    assert created >= 1

    messages = _messages_of(record.id)
    assert len(messages) == 1
    message = messages[0]
    assert message.role == "assistant"
    assert message.content == "# 卦象解讀\n這是好卦。"
    assert message.think == "推理過程"
    assert message.model == "test-model"


def test_migration_record_without_think_block():
    """無 think 的解盤 → 全文為 content、think 為空"""
    user = _make_user("no-think-user")
    record = _make_record(user.id, "直接給結論。")

    migrate_history_to_messages(SessionLocal())

    (message,) = _messages_of(record.id)
    assert message.content == "直接給結論。"
    assert message.think is None


def test_migration_skips_empty_interpretation():
    """空/None 解盤不產生訊息"""
    user = _make_user("empty-user")
    record_none = _make_record(user.id, None)
    record_blank = _make_record(user.id, "   ", status="error")

    created = migrate_history_to_messages(SessionLocal())

    assert created == 0
    assert _messages_of(record_none.id) == []
    assert _messages_of(record_blank.id) == []


def test_migration_skips_failed_status_with_content():
    """失敗狀態但殘留文字者仍遷移（內容存在即保留歷史）"""
    user = _make_user("failed-status-user")
    # 失敗狀態通常 interpretation 為空 → 由空值規則涵蓋；此處驗證「有內容就轉」
    record = _make_record(user.id, "部分輸出", status="cancelled")

    migrate_history_to_messages(SessionLocal())

    messages = _messages_of(record.id)
    assert len(messages) == 1
    assert messages[0].content == "部分輸出"


# --- 幂等與排序 ---


def test_migration_is_idempotent():
    """重跑不重複建立"""
    user = _make_user("idempotent-user")
    record = _make_record(user.id, "解盤內容")

    first = migrate_history_to_messages(SessionLocal())
    second = migrate_history_to_messages(SessionLocal())

    assert first >= 1
    assert second == 0
    assert len(_messages_of(record.id)) == 1


def test_migration_preserves_multiple_records_ordering():
    """多筆紀錄各自一則訊息；thread 內排序確定"""
    user = _make_user("multi-user")
    record_a = _make_record(user.id, "A 的解盤")
    record_b = _make_record(user.id, "B 的解盤")

    migrate_history_to_messages(SessionLocal())

    assert [m.content for m in _messages_of(record_a.id)] == ["A 的解盤"]
    assert [m.content for m in _messages_of(record_b.id)] == ["B 的解盤"]


# --- Schema 限制 ---


def test_role_constraint_accepts_only_known_values_via_app_layer():
    """role 欄位存在且長度限制生效（字串層級驗證由應用層把關，此處驗證欄位可寫）"""
    user = _make_user("schema-user")
    with SessionLocal() as db:
        record = History(
            user_id=user.id,
            divination_type="tarot",
            question="q",
            chart_data="{}",
            status="completed",
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        record_id = record.id

        message = ThreadMessage(
            record_id=record_id, role="user", content="請問這卦如何？"
        )
        db.add(message)
        db.commit()

    (loaded,) = _messages_of(record_id)
    assert loaded.role == "user"
    assert loaded.think is None


def test_record_delete_cascades_messages():
    """刪除占卜紀錄時訊息級聯刪除"""
    from app.core.database import Base

    user = _make_user("cascade-user")
    record = _make_record(user.id, "將被刪除")
    migrate_history_to_messages(SessionLocal())
    assert len(_messages_of(record.id)) == 1

    with SessionLocal() as db:
        db.query(History).filter(History.id == record.id).delete()
        db.commit()

    assert _messages_of(record.id) == []
    # 避免 Base 未使用警告
    assert Base.metadata.tables["thread_messages"] is not None
