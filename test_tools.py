from tools import get_current_time, get_divination_tool
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
    client.close()

    div_res = get_divination_tool()
    print(f"Divination Result: {str(div_res)[:200]}...") # Truncate for log safety
except Exception as e:
    print(f"Divination Error: {e}")
