import requests

API_URL = "http://127.0.0.1:8000"

print("="*60)
print("Testing AI Query Endpoint")
print("="*60)

# Test AI query with the uploaded sales data
test_query = {
    "dataset_id": 1,
    "prompt": "What are the top 3 bestselling products by revenue?"
}

print(f"\nSending AI Query: '{test_query['prompt']}'")
print("Waiting for OpenAI response...")

try:
    response = requests.post(f"{API_URL}/ai/query", json=test_query, timeout=30)
    
    if response.status_code == 200:
        data = response.json()
        print("\n✅ AI Query Successful!")
        print(f"\nQuery ID: {data['id']}")
        print(f"Execution Time: {data['execution_time_ms']}ms")
        print(f"\n📝 Generated Code:")
        print("-" * 60)
        print(data['generated_code'])
        print("-" * 60)
        
        if data.get('result_data'):
            print(f"\n📊 Result Data:")
            print(data['result_data'])
            
    else:
        print(f"\n❌ AI Query Failed: {response.status_code}")
        print(f"Error: {response.text}")
        
except Exception as e:
    print(f"\n❌ Error: {str(e)}")

print("\n" + "="*60)
print("Test Complete")
print("="*60)
