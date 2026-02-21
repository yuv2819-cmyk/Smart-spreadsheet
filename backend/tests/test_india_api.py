def _upload_dataset(client, headers: dict[str, str]) -> int:
    csv_content = (
        "order_date,revenue,cost,region,customer_email\n"
        "2025-04-01,1000,700,Delhi,alice@example.com\n"
        "2025-04-15,1400,900,Mumbai,bob@example.com\n"
        "2025-05-02,1500,950,Bengaluru,alice@example.com\n"
        "2025-05-20,1300,870,Delhi,charlie@example.com\n"
    )
    response = client.post(
        "/datasets/upload",
        headers=headers,
        files={"file": ("india.csv", csv_content, "text/csv")},
    )
    assert response.status_code == 200, response.text
    return int(response.json()["dataset_id"])


def test_india_insights_and_report_generation(client, auth_headers):
    dataset_id = _upload_dataset(client, auth_headers)

    insights_response = client.get(f"/india/insights?dataset_id={dataset_id}&language=hinglish", headers=auth_headers)
    assert insights_response.status_code == 200, insights_response.text
    payload = insights_response.json()
    assert payload["dataset_id"] == dataset_id
    assert payload["locale"] == "india"
    assert isinstance(payload["macro_overlay"], list)
    assert isinstance(payload["recommended_actions"], list)

    report_response = client.post(
        "/india/report",
        headers=auth_headers,
        json={"dataset_id": dataset_id, "language": "hinglish"},
    )
    assert report_response.status_code == 201, report_response.text
    report_payload = report_response.json()
    assert report_payload["dataset_id"] == dataset_id
    assert report_payload["type"] == "India Trend"
