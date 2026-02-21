from __future__ import annotations

import pytest


def _upload_currency_dataset(client, headers: dict[str, str]) -> int:
    csv_content = (
        "month,revenue,cost,region\n"
        "2025-01,\"$1,000\",700,North\n"
        "2025-02,\"$1,200\",750,North\n"
        "2025-03,\"$900\",800,South\n"
    )
    response = client.post(
        "/datasets/upload",
        headers=headers,
        files={"file": ("currency.csv", csv_content, "text/csv")},
    )
    assert response.status_code == 200, response.text
    return int(response.json()["dataset_id"])


def test_precision_audit_and_currency_parsing(client, auth_headers):
    dataset_id = _upload_currency_dataset(client, auth_headers)

    overview_response = client.get("/overview/metrics", headers=auth_headers)
    assert overview_response.status_code == 200, overview_response.text
    payload = overview_response.json()

    assert "revenue" in payload["numeric_columns"]
    assert "cost" in payload["numeric_columns"]
    assert payload["basic_stats"]["revenue"]["avg"] == pytest.approx((1000 + 1200 + 900) / 3)
    assert payload["basic_stats"]["cost"]["avg"] == pytest.approx((700 + 750 + 800) / 3)

    precision_audit = (payload.get("analyst_insights") or {}).get("precision_audit") or {}
    coerced_columns = [
        str(item.get("column"))
        for item in (precision_audit.get("coerced_numeric_columns") or [])
    ]
    assert "revenue" in coerced_columns

    profile_response = client.get(f"/cleaning/profile/{dataset_id}", headers=auth_headers)
    assert profile_response.status_code == 200, profile_response.text
    suggestion_ids = [str(item.get("id")) for item in profile_response.json().get("suggestions", [])]
    assert any(rule_id == "coerce_numeric::revenue" for rule_id in suggestion_ids)
