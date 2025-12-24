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
        # We expect a response to initialize
        self.read_response()
        
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

    def read_response(self):
        while True:
            line = self.process.stdout.readline()
            if not line:
                break
            try:
                data = json.loads(line)
                # Skip any notifications or non-response messages if we are waiting for a specific response
                # But for simplicity, we just return the first JSON object for now.
                return data
            except json.JSONDecodeError:
                continue
    
    def call_liu_yao(self):
        """
        Calls the liu_yao tool on the MCP server.
        """
        if not self.process:
            self.start_server()

        # Construct the tool call
        # Based on typical MCP, we need to list tools to find the name or assume "liu_yao" based on user prompt
        # Let's inspect tools first just to be sure, or just try calling it.
        # User prompt implies "divination-chart-mcp" has "liu_yao".
        
        # Actually, let's just make a tool call request.
        req = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {
                "name": "liu_yao",
                "arguments": {} 
            }
        }
        self.send_request(req)
        response = self.read_response()
        
        if "error" in response:
            raise Exception(f"MCP Error: {response['error']}")
            
        return response['result']['content'][0]['text']

    def close(self):
        if self.process:
            self.process.terminate()

def get_divination_tool():
    """
    Wrapper function to be used by Gemini.
    Triggers a real divination using the MCP server.
    """
    client = DivinationClient()
    try:
        result_json_str = client.call_liu_yao()
        client.close()
        # Parse it back to json object to return clean data if possible, 
        # but Gemini usually expects a dict or string.
        # The tool returns a JSON string, let's load it and return dict.
        return json.loads(result_json_str)
    except Exception as e:
        client.close()
        return {"error": str(e)}

# For testing manually
if __name__ == "__main__":
    print(get_current_time())
    # print(get_divination_tool()) 
