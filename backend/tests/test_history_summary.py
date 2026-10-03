"""
歷史清單摘要模式測試（Ticket 07）

summary=1 只回列表所需欄位（略過完整解盤全文），chart_data 仍保留供列表顯示；
預設（summary 未帶）行為不變。
"""

from app.core.database import SessionLocal
from app.models import History


def _seed_record(user_id: int, interpretation: str) -> int:
    with SessionLocal() as db:
        record = History(
            user_id=user_id,
            divination_type="liuyao",
            question="測試問題",
            chart_data='{"benguaming": "乾為天"}',
            interpretation=interpretation,
            status="completed",
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record.id


def test_history_summary_omits_interpretation(client, make_user, auth_headers):
    user = make_user(username="hist-summary-user")
    headers = auth_headers(user.username)
    full_text = "<think>推論</think>完整解盤全文"
    _seed_record(user.id, full_text)

    full = client.get("/api/history", headers=headers)
    assert full.status_code == 200
    assert full.json()["items"][0]["interpretation"] == full_text

    summary = client.get("/api/history?summary=1", headers=headers)
    assert summary.status_code == 200
    item = summary.json()["items"][0]
    assert item["interpretation"] is None
    assert item["chart_data"]["benguaming"] == "乾為天"
