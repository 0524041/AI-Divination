from datetime import datetime
import subprocess
import json
import os
import sys

def get_current_time():
    """
    Returns the current date and time.
    """
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

class DivinationClient:
    def __init__(self):
        self.process = None

    def start_server(self):
        command = [
            "uvx",
            "--from",
            "https://github.com/wangsquirrel/divination-chart-mcp.git",
            "divination-chart-mcp"
        ]
        # Use simple Popen to interact via stdin/stdout
        self.process = subprocess.Popen(
            command,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=sys.stderr, # Forward stderr to see logs if any
            text=True,
            bufsize=1
        )
        
        # Initialize MCP
        init_req = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "divination-app", "version": "1.0"}
            }
        }
        self.send_request(init_req)
        self.send_request(init_req)
        # We expect a response to initialize (ID: 1)
        self.read_response(request_id=1)
        
        # Send initialized notification
        init_notif = {
            "jsonrpc": "2.0",
            "method": "notifications/initialized"
        }
        self.send_notification(init_notif)

    def send_request(self, req):
        json_str = json.dumps(req)
        self.process.stdin.write(json_str + "\n")
        self.process.stdin.flush()

    def send_notification(self, notif):
        json_str = json.dumps(notif)
        self.process.stdin.write(json_str + "\n")
        self.process.stdin.flush()

    def read_response(self, request_id=None):
        while True:
            line = self.process.stdout.readline()
            if not line:
                break
            # print(f"DEBUG: Received: {line.strip()}")
            try:
                data = json.loads(line)
                # If we are looking for a specific ID
                if request_id is not None:
                    if data.get('id') == request_id:
                        return data
                    else:
                        # Skip notifications or other ID responses
                        continue
                # If no ID specified (e.g. initial handshake sometimes?), just return data
                return data
            except json.JSONDecodeError:
                continue
    
    def get_tool_list(self):
        req = {
            "jsonrpc": "2.0",
            "id": 10,
            "method": "tools/list"
        }
        self.send_request(req)
        response = self.read_response(request_id=10)
        return response['result']['tools']

    def call_liu_yao(self, **kwargs):
        """
        Calls the liu_yao tool on the MCP server.
        Accepts kwargs to override input_data (e.g. yaogua, time).
        """
        if not self.process:
            self.start_server()

        # Construct the tool call
        now = datetime.now()
        # Default input data
        input_data = {
            "year": now.year,
            "month": now.month,
            "day": now.day,
            "hour": now.hour,
            "minute": now.minute
        }
        # Update with manual inputs (e.g. yaogua)
        input_data.update(kwargs)
        
        req = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {
                "name": "divination_liu_yao",
                "arguments": { "input_data": input_data } 
            }
        }
        self.send_request(req)
        # self.send_request(req) # Duplicate send removed? Previously there was a duplicate send in lines 123-124
        # Wait, previous code had two sends. Likely a copy paste error.
        
        response = self.read_response(request_id=2)
        
        if "error" in response:
            raise Exception(f"MCP Error: {response['error']}")
            
        return response['result']['content'][0]['text']

    def close(self):
        if self.process:
            self.process.terminate()

def get_divination_tool(**kwargs):
    """
    Wrapper function to be used by Gemini or Server.
    Triggers a real divination using the MCP server.
    Accepts kwargs (e.g. coins, yaogua)
    """
    client = DivinationClient()
    try:
        result_json_str = client.call_liu_yao(**kwargs)
        client.close()
        # Parse it back to json object
        return json.loads(result_json_str)
    except Exception as e:
        client.close()
        return {"error": str(e)}

# For testing manually
if __name__ == "__main__":
    print(get_current_time())
    # print(get_divination_tool()) 
