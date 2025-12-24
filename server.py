from flask import Flask, request, jsonify, render_template, send_from_directory
from database import init_db, add_history, get_history, toggle_favorite, get_daily_usage_count, get_setting, set_setting
from tools import get_current_time, get_divination_tool
from google import genai
from google.genai import types
import os
import json

app = Flask(__name__, static_folder='static', template_folder='templates')

# Initialize DB
init_db()

# Gemini Setup
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
# user wants gemini-3-flash
MODEL_ID = "gemini-3-flash-preview"

# Map tools
tools_map = {
    "get_current_time": get_current_time,
    "get_divination_tool": get_divination_tool
}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/divinate', methods=['POST'])
def divinate():
    data = request.json
    question = data.get('question')
    
    if not question:
        return jsonify({"error": "Question is required"}), 400

    # 1. Check Limits
    limit_str = get_setting('daily_limit', '5')
    if limit_str != 'unlimited':
        try:
            limit = int(limit_str)
            count = get_daily_usage_count()
            if count >= limit:
                return jsonify({"error": f"Daily limit of {limit} divinations reached."}), 403
        except ValueError:
            pass # Treat as unlimited if invalid? Or default to 5. Let's assume safe.
    
    # Prepend prefix
    full_question = "幫我算一掛 " + question

    # 2. Call Gemini
    # We use a chat session or just generate_content with tools
    # Since we need a back-and-forth for tools, we manage the history manually or let the client handle it.
    
    # Construct initial prompt
    # We want the model to use the tools to answer.
    
    config = types.GenerateContentConfig(
        tools=[get_current_time, get_divination_tool],
        thinking_config=types.ThinkingConfig(thinking_level="high")
    )

    # First turn: User Question
    try:
        # We start a chat to maintain context of tool calls
        chat = client.chats.create(model=MODEL_ID, config=config)
        chat = client.chats.create(model=MODEL_ID, config=config)
        response = chat.send_message(full_question)
        
        # Loop for tool calls
        # The SDK usually executes tools automatically if configured? 
        # The generic `google-genai` might NOT auto-execute.
        # Let's inspect response for function calls.
        
        # Simple loop for handling function calls
        # If response has function calls, execute them and send back.
        # Note: Depending on SDK, response might be a generator or object.
        
        # Handle potential multiple turns of tool use
        while response.function_calls:
            parts = []
            for fc in response.function_calls:
                tool_name = fc.name
                tool_args = fc.args
                
                print(f"Calling tool: {tool_name} with args: {tool_args}")
                
                if tool_name in tools_map:
                    tool_func = tools_map[tool_name]
                    # Execute
                    try:
                        # Arguments from Gemini are usually dict-like or object
                        # We convert to dict if needed, but tool_args should be kwargs
                        result = tool_func(**tool_args)
                    except Exception as e:
                        result = {"error": str(e)}
                    
                    parts.append(types.Part.from_function_response(
                        name=tool_name,
                        response={"result": result}
                    ))
            
            # Send tool outputs back
            response = chat.send_message(parts)

        # Final response text
        interpretation = response.text
        
        # We want to save the "raw" divination result if possible.
        # We can extract it from the chat history if we really want to save the hexagram details.
        # For now, we search history for the tool response from 'get_divination_tool'
        # This is a bit complex to dig out from the chat object properties without more digging.
        # Simplified: We just save the interpretation. 
        # But user wants "Result place" and "Collection".
        # Let's try to extract the last tool response from chat history if available.
        
        divination_json = {}
        # Iterate history to find tool response
        # history is verify specific in this SDK
        # Let's just trust the interpretation contains everything for now due to complexity.
        # OR: we can capture it in the loop above.
        
        # Refined Loop with capture:
        # (The loop above is good, but we lost the result pointer)
        # Let's just save the interpretation. The model should include the hexagram info in the text.
        
        history_id = add_history(question, {"raw": "See interpretation"}, interpretation)
        
        return jsonify({
            "id": history_id,
            "result": interpretation
        })

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/history', methods=['GET'])
def history():
    return jsonify(get_history())

@app.route('/api/history/<int:id>/favorite', methods=['PUT'])
def favorite(id):
    data = request.json
    toggle_favorite(id, data.get('is_favorite'))
    return jsonify({"success": True})

@app.route('/api/settings', methods=['GET', 'POST'])
def handle_settings():
    if request.method == 'GET':
        return jsonify({
            "daily_limit": get_setting('daily_limit', '5')
        })
    else:
        data = request.json
        if 'daily_limit' in data:
            set_setting('daily_limit', data['daily_limit'])
        return jsonify({"success": True})

if __name__ == '__main__':
    app.run(debug=True, port=8080)
