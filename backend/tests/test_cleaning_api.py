from __future__ import annotations


def _upload_messy_dataset(client, headers: dict[str, str]) -> int:
    csv_content = (
        "month,revenue,cost,profit,region\n"
        "2025-01,1000,700,300, North \n"
        "2025-02,1200,750,,north\n"
        "2025-02,1200,750,,north\n"
        "2025-03,900,800,100,South\n"
    )
    response = client.post(
        "/datasets/upload",
        headers=headers,
        files={"file": ("messy.csv", csv_content, "text/csv")},
    )
    assert response.status_code == 200, response.text
    return int(response.json()["dataset_id"])


def test_cleaning_profile_preview_diff_apply_and_rollback(client, auth_headers):
    dataset_id = _upload_messy_dataset(client, auth_headers)

    profile_response = client.get(f"/cleaning/profile/{dataset_id}", headers=auth_headers)
    assert profile_response.status_code == 200, profile_response.text
    profile = profile_response.json()
    assert profile["dataset_id"] == dataset_id
    assert len(profile["suggestions"]) > 0

    rule_ids = [item["id"] for item in profile["suggestions"]][:4]
    preview_response = client.post(
        "/cleaning/preview",
        headers=auth_headers,
        json={"dataset_id": dataset_id, "rule_ids": rule_ids},
    )
    assert preview_response.status_code == 200, preview_response.text
    preview = preview_response.json()
    assert preview["rows_before"] >= preview["rows_after"]

    diff_response = client.post(
        "/cleaning/diff",
        headers=auth_headers,
        json={"dataset_id": dataset_id, "rule_ids": rule_ids, "limit": 10},
    )
    assert diff_response.status_code == 200, diff_response.text
    assert "changes" in diff_response.json()

    apply_response = client.post(
        "/cleaning/apply",
        headers=auth_headers,
        json={"dataset_id": dataset_id, "rule_ids": rule_ids},
    )
    assert apply_response.status_code == 201, apply_response.text
    apply_payload = apply_response.json()
    transformation_id = int(apply_payload["transformation_id"])
    assert apply_payload["output_dataset_id"] != dataset_id

    history_response = client.get("/cleaning/history", headers=auth_headers)
    assert history_response.status_code == 200, history_response.text
    history = history_response.json()
    assert any(int(item["id"]) == transformation_id for item in history)

    rollback_response = client.post(f"/cleaning/rollback/{transformation_id}", headers=auth_headers)
    assert rollback_response.status_code == 200, rollback_response.text
    rollback_payload = rollback_response.json()
    assert rollback_payload["output_dataset_id"] != apply_payload["output_dataset_id"]
