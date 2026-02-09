import urllib.request
import urllib.parse
import json
import sys
import io

BASE_URL = "http://localhost:8000"

def run_test():
    print("1. Creating sample CSV...")
    # Manual multipart form construction since urllib doesn't do it easily
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    
    csv_content = "product,revenue,quantity\nWidget A,100,5\nWidget B,200,10\nWidget C,300,15"
    
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="test_data.csv"\r\n'
        f"Content-Type: text/csv\r\n\r\n"
        f"{csv_content}\r\n"
        f"--{boundary}--\r\n"
    )
    
    headers = {
        "Content-Type": f"multipart/form-data; boundary={boundary}"
    }
    
    print("2. Uploading CSV...")
    req = urllib.request.Request(f"{BASE_URL}/datasets/upload", data=body.encode('utf-8'), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            print(f"Upload success: {data}")
            dataset_id = data['dataset_id']
    except urllib.error.HTTPError as e:
        print(f"Upload failed: {e.code} {e.read().decode()}")
        return

    print("3. Fetching Metrics...")
    try:
        with urllib.request.urlopen(f"{BASE_URL}/overview/metrics") as response:
             metrics = json.loads(response.read().decode())
             print(f"Metrics: {metrics}")
             
             # Verify
             if metrics['total_rows'] != 3:
                 print("FAILED: total_rows mismatch")
                 sys.exit(1)
             if metrics['dataset_id'] != dataset_id:
                 print("FAILED: dataset_id mismatch")
                 sys.exit(1)
             print("Metrics matched!")
    except urllib.error.HTTPError as e:
        print(f"Metrics failed: {e.code} {e.read().decode()}")
        return
    
    print("4. Testing AI Summary...")
    req_summary = urllib.request.Request(
        f"{BASE_URL}/ai/summarize", 
        data=json.dumps({"dataset_id": dataset_id}).encode('utf-8'),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
         with urllib.request.urlopen(req_summary) as response:
             summary = json.loads(response.read().decode())
             print(f"Summary: {summary}")
    except urllib.error.HTTPError as e:
        print(f"Summary failed: {e.code} {e.read().decode()}")
        return

    print("Test passed!")

if __name__ == "__main__":
    run_test()
