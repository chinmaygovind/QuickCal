#!/usr/bin/env python3
"""
Simple QuickCal Lambda endpoint tester
"""

import requests
import json
from datetime import datetime

# Your Lambda endpoint URL
LAMBDA_ENDPOINT = "https://zvm5r0eaxe.execute-api.us-east-1.amazonaws.com/default/quickcal-event-processor"

def main():
    print("QuickCal Lambda Endpoint Tester")
    print("=" * 50)
    
    # Single test case
    test_payload = {
        "selectedText": "Team meeting tomorrow at 2 PM in Conference Room A",
        "currentDate": "Saturday, August 24, 2025",
        "timezone": "America/New_York",
        "sourceUrl": "https://example.com",
        "userEmail": "test@example.com",
        "sessionId": "session_test_12345"
    }
    
    print(f"Testing with payload:")
    print(json.dumps(test_payload, indent=2))
    print("-" * 50)
    
    try:
        start_time = datetime.now()
        response = requests.post(
            LAMBDA_ENDPOINT,
            headers={"Content-Type": "application/json"},
            json=test_payload,
            timeout=30
        )
        duration = (datetime.now() - start_time).total_seconds()
        
        print(f"Status: {response.status_code} ({duration:.2f}s)")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ SUCCESS!")
            print(f"Title: {data.get('title', 'N/A')}")
            print(f"Start: {data.get('timestamp_start', 'N/A')}")
            print(f"End: {data.get('timestamp_end', 'N/A')}")
            print(f"Location: {data.get('location', 'N/A')}")
            print(f"Description: {data.get('description', 'N/A')}")
            if data.get('missing'):
                print(f"Missing fields: {data.get('missing')}")
        else:
            print(f"❌ Error: {response.text}")
            
    except requests.exceptions.Timeout:
        print("❌ Timeout (>30s)")
    except requests.exceptions.ConnectionError:
        print("❌ Connection failed")
    except Exception as e:
        print(f"❌ Exception: {str(e)}")

if __name__ == "__main__":
    main()
