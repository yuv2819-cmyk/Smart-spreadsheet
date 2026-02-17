import requests
import os

API_TOKEN = os.getenv("BACKEND_API_TOKEN", "dev-insecure-token")
HEADERS = {
    "Authorization": f"Bearer {API_TOKEN}",
    "X-Tenant-Id": os.getenv("BACKEND_TENANT_ID", "1"),
    "X-User-Id": os.getenv("BACKEND_USER_ID", "1"),
}

# Upload CSV file
url = "http://127.0.0.1:8000/datasets/upload"
csv_path = r"c:\Users\Yuvra\OneDrive\Desktop\smart-spreadsheet\test_sales_data.csv"
files = {"file": open(csv_path, "rb")}

print("Uploading CSV file...")
response = requests.post(url, files=files, headers=HEADERS)

if response.status_code == 200:
    print("✅ Upload successful!")
    print(f"Response: {response.json()}")
else:
    print(f"❌ Upload failed: {response.status_code}")
    print(f"Error: {response.text}")

# Test 1: Get dataset data
print("\n--- Test 1: Getting dataset data ---")
data_response = requests.get("http://127.0.0.1:8000/datasets/latest", headers=HEADERS)
if data_response.status_code == 200:
    dataset = data_response.json()
    print(f"✅ Dataset ID: {dataset['id']}")
    print(f"✅ Name: {dataset['name']}")
    print(f"✅ Row count: {dataset['row_count']}")
    if 'schema_info' in dataset and dataset['schema_info']:
        print(f"✅ Schema: {list(dataset['schema_info'].keys())}")
    dataset_id = dataset['id']
else:
    print(f"❌ Failed to get dataset")
    exit(1)

# Test 2: Get data rows
print("\n--- Test 2: Getting data rows ---")
rows_response = requests.get(f"http://127.0.0.1:8000/datasets/{dataset_id}/data?limit=5", headers=HEADERS)
if rows_response.status_code == 200:
    data = rows_response.json()
    print(f"✅ Retrieved {len(data['data'])} rows")
    print(f"First row: {data['data'][0]}")
else:
    print(f"❌ Failed to get rows")

# Test 3: Get overview metrics
print("\n--- Test 3: Getting overview metrics ---")
metrics_response = requests.get("http://127.0.0.1:8000/overview/metrics", headers=HEADERS)
if metrics_response.status_code == 200:
    metrics = metrics_response.json()
    print(f"✅ Total rows: {metrics['total_rows']}")
    print(f"✅ Total columns: {metrics['total_columns']}")
    print(f"✅ Numeric columns: {metrics['numeric_columns']}")
    if metrics['basic_stats']:
        print(f"✅ Stats available for: {list(metrics['basic_stats'].keys())}")
        # Show sales amount stats
        if 'Sales_Amount' in metrics['basic_stats']:
            stats = metrics['basic_stats']['Sales_Amount']
            print(f"   Sales Amount - Min: ${stats['min']:.2f}, Max: ${stats['max']:.2f}, Avg: ${stats['avg']:.2f}")
else:
    print(f"❌ Failed to get metrics")

# Test 4: AI Summarization
print("\n--- Test 4: Testing AI Summarization ---")
ai_payload = {"dataset_id": dataset_id}
ai_response = requests.post("http://127.0.0.1:8000/ai/summarize", json=ai_payload, headers=HEADERS)
if ai_response.status_code == 200:
    summary_data = ai_response.json()
    print(f"✅ AI Summary generated!")
    print(f"Summary: {summary_data['summary'][:200]}...")
    print(f"Key Insights ({len(summary_data['key_insights'])} items):")
    for i, insight in enumerate(summary_data['key_insights'][:3], 1):
        print(f"   {i}. {insight}")
else:
    print(f"❌ Failed to get AI summary: {ai_response.status_code}")
    print(f"Error: {ai_response.text}")

print("\n" + "="*50)
print("🎉 ALL TESTS COMPLETED!")
print("="*50)
