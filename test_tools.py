from tools import get_current_time, get_divination_tool
from datetime import datetime
import sys
import os
import json

print("Testing get_current_time()...")
try:
    time_res = get_current_time()
    print(f"Time Result: {time_res}")
except Exception as e:
    print(f"Time Error: {e}")

print("\nTesting get_divination_tool()...")
try:
    # This invokes the MCP. It might take a second.
    # List tools first
    from tools import DivinationClient
    client = DivinationClient()
    client.start_server()
    print("Available Tools:")
    tools = client.get_tool_list()
    print(json.dumps(tools, indent=2, ensure_ascii=False))
    
    # Check if we can find one for divination
    # div_res = get_divination_tool() # Using the unknown name will fail
    # Let's try to call the first tool if available
    print("\n--- Testing Divination Tool with Manual Input ---")
    try:
        # User defined 1/2. Let's try to map to what the tool might expect.
        # usually 0,1,2,3 correspond to coin counts.
        # Let's try passing 'yaogua' explicit list.
        # Also try passing 'coins' or similar.
        # Current time params
        now = datetime.now()
        params = {
            "year": now.year,
            "month": now.month,
            "day": now.day,
            "hour": now.hour,
            "minute": now.minute,
            # Hypothesis: It accepts 'yaogua' list
            "yaogua": [1, 2, 1, 2, 1, 2] 
        }
        res = client.call_liu_yao(**params)
        print(f"Result with manual yaogua: {json.dumps(res, indent=2, ensure_ascii=False)}")
    except Exception as e:
        print(f"Error testing manual input: {e}")
    client.close()

    div_res = get_divination_tool()
    print(f"Divination Result: {str(div_res)[:200]}...") # Truncate for log safety
except Exception as e:
    print(f"Divination Error: {e}")
