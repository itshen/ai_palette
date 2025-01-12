from flask import Flask, render_template, request, jsonify, Response, send_from_directory
from ai_palette import AIChat, Message
import os
import json
import requests

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory(os.path.dirname(os.path.abspath(__file__)), filename)

@app.route('/api/models/ollama', methods=['GET'])
def get_ollama_models():
    try:
        response = requests.get('http://localhost:11434/api/tags')
        models = response.json()
        return jsonify({'success': True, 'models': [model['name'] for model in models['models']]})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/chat', methods=['GET', 'POST'])
def chat():
    if request.method == 'GET':
        data = request.args
    else:
        data = request.json
        
    model_type = data.get('model_type')
    api_key = data.get('api_key')
    prompt = data.get('prompt')
    model = data.get('model')
    enable_streaming = data.get('enable_streaming', False)
    
    try:
        chat = AIChat(
            model_type=model_type,
            api_key=api_key,
            model=model,
            enable_streaming=enable_streaming
        )
        
        if enable_streaming:
            def generate():
                for chunk in chat.ask(prompt):
                    yield f"data: {json.dumps({'chunk': chunk})}\n\n"
            return Response(generate(), mimetype='text/event-stream')
        else:
            response = chat.ask(prompt)
            return jsonify({'success': True, 'response': response})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=18000)
