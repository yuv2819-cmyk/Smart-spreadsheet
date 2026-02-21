from __future__ import annotations


def _upload_sample_dataset(client, headers: dict[str, str]) -> int:
    csv_content = (
        "month,revenue,cost,profit,region\n"
        "2025-01,1000,700,300,North\n"
        "2025-02,1200,750,450,North\n"
        "2025-03,900,800,100,South\n"
    )
    response = client.post(
        "/datasets/upload",
        headers=headers,
        files={"file": ("sample.csv", csv_content, "text/csv")},
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    return int(payload["dataset_id"])


def test_reports_crud_and_collaboration(client, auth_headers):
    dataset_id = _upload_sample_dataset(client, auth_headers)

    create_payload = {
        "name": "Test Executive Report",
        "type": "Executive",
        "dataset_id": dataset_id,
        "summary": "Summary text",
        "key_insights": ["Insight A", "Insight B"],
        "recommendations": ["Action 1"],
        "risks": ["Risk 1"],
        "drivers": ["Driver 1"],
        "kpis": {"Total Revenue": "3100"},
        "content_markdown": "# Test Report",
        "status": "Ready",
        "size_kb": "1.2 KB",
    }
    create_response = client.post("/reports", headers=auth_headers, json=create_payload)
    assert create_response.status_code == 201, create_response.text
    report = create_response.json()
    report_id = int(report["id"])

    list_response = client.get("/reports", headers=auth_headers)
    assert list_response.status_code == 200
    assert any(int(item["id"]) == report_id for item in list_response.json())

    share_response = client.post(
        f"/reports/{report_id}/share",
        headers=auth_headers,
        json={"expires_in_hours": 24},
    )
    assert share_response.status_code == 200, share_response.text
    share_token = share_response.json()["token"]

    public_response = client.get(f"/reports/public/{share_token}")
    assert public_response.status_code == 200, public_response.text
    assert int(public_response.json()["id"]) == report_id

    comment_response = client.post(
        f"/reports/{report_id}/comments",
        headers=auth_headers,
        json={"body": "Looks good for leadership review."},
    )
    assert comment_response.status_code == 201, comment_response.text

    comments_list = client.get(f"/reports/{report_id}/comments", headers=auth_headers)
    assert comments_list.status_code == 200
    assert len(comments_list.json()) >= 1

    approval_response = client.put(
        f"/reports/{report_id}/approval",
        headers=auth_headers,
        json={"status": "approved", "note": "Approved for weekly meeting."},
    )
    assert approval_response.status_code == 200, approval_response.text
    assert approval_response.json()["status"] == "approved"

    approvals_list = client.get(f"/reports/{report_id}/approvals", headers=auth_headers)
    assert approvals_list.status_code == 200
    assert any(item["status"] == "approved" for item in approvals_list.json())

    delete_response = client.delete(f"/reports/{report_id}", headers=auth_headers)
    assert delete_response.status_code == 200, delete_response.text
