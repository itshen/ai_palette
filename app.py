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

@app.route('/api/models', methods=['GET'])
def get_models():
    model_provider = request.args.get('type')
    api_key = request.args.get('api_key')
    
    try:
        headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
        
        # 固定模型列表的提供商
        fixed_models = {
            'ernie': ['ernie-bot', 'ernie-bot-4'],
            'zhipu': ['GLM-4-Plus', 'GLM-4-Flash'],
            'minimax': ['abab6.5-chat', 'abab7-preview']
        }
        
        # 如果是固定模型列表的提供商
        if model_provider in fixed_models:
            return jsonify({'success': True, 'models': fixed_models[model_provider]})
        
        # Ollama 本地模型
        if model_provider == 'ollama':
            try:
                response = requests.get('http://localhost:11434/api/tags')
                if response.status_code == 200:
                    models = response.json()
                    return jsonify({'success': True, 'models': [model['name'] for model in models['models']]})
                else:
                    return jsonify({'success': False, 'error': 'Ollama 服务未启动或无法访问'}), response.status_code
            except Exception as e:
                return jsonify({'success': False, 'error': f'连接 Ollama 失败: {str(e)}'}), 500
        
        # 需要 API 调用的提供商
        if model_provider in ['openai', 'dashscope', 'deepseek', 'siliconflow']:
            base_urls = {
                'openai': 'https://api.openai.com/v1/models',
                'dashscope': 'https://dashscope.aliyuncs.com/api/v1/models',
                'deepseek': 'https://api.deepseek.com/v1/models',
                'siliconflow': 'https://api.siliconflow.cn/v1/models'
            }
            
            if not api_key:
                return jsonify({'success': False, 'error': '需要 API Key'}), 401
                
            try:
                response = requests.get(base_urls[model_provider], headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    if model_provider == 'openai':
                        models = [model['id'] for model in data.get('data', [])]
                    elif model_provider == 'dashscope':
                        models = [model['model'] for model in data.get('models', [])]
                    elif model_provider == 'deepseek':
                        models = [model['id'] for model in data.get('data', [])]
                    elif model_provider == 'siliconflow':
                        models = [model['id'] for model in data.get('data', [])]
                    return jsonify({'success': True, 'models': models})
                else:
                    return jsonify({'success': False, 'error': f'获取模型列表失败: {response.text}'}), response.status_code
            except Exception as e:
                return jsonify({'success': False, 'error': f'API 调用失败: {str(e)}'}), 500
        
        return jsonify({'success': False, 'error': '不支持的模型类型'}), 400
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
    timeout = data.get('timeout', 120)  # 添加超时参数，默认120秒
    include_reasoning = data.get('include_reasoning', True)  # 是否包含思考过程
    context = data.get('context', [])  # 获取上下文
    
    try:
        # 根据不同的模型类型设置不同的参数
        chat_params = {
            'provider': model_type,  # 使用 model_type 作为 provider
            'api_key': api_key,
            'model': model,
            'enable_streaming': enable_streaming,
            'timeout': timeout
        }
        
        chat = AIChat(**chat_params)
        
        # 添加上下文消息
        for msg in context:
            # 如果是assistant的消息,需要过滤掉思考过程
            if msg['role'] == 'assistant':
                content = msg['content']
                # 如果内容包含<think>标记,只保留非思考部分
                if '<think>' in content:
                    # 移除<think>到</think>之间的内容
                    start = content.find('<think>')
                    end = content.find('</think>')
                    if end > start:
                        content = content[end + 8:].strip()  # 8是</think>的长度
                chat.add_context(content=content, role=msg['role'])
            else:
                chat.add_context(content=msg['content'], role=msg['role'])
        
        if enable_streaming:
            def generate():
                for chunk in chat.ask(prompt):
                    if isinstance(chunk, dict):
                        # 对于结构化的输出直接传递
                        yield f"data: {json.dumps(chunk)}\n\n"
                    else:
                        # 尝试获取推理过程
                        try:
                            if hasattr(chat, 'get_last_reasoning_content'):
                                reasoning = chat.get_last_reasoning_content()
                                if reasoning:
                                    yield f"data: {json.dumps({'type': 'reasoning', 'content': reasoning})}\n\n"
                        except Exception as e:
                            print(f"获取推理过程失败: {e}")
                        
                        # 发送实际内容
                        yield f"data: {json.dumps({'type': 'content', 'content': chunk})}\n\n"
            return Response(generate(), mimetype='text/event-stream')
        else:
            response = chat.ask(prompt)
            result = {'success': True, 'response': response}
            
            # 如果需要包含思考过程
            if include_reasoning and hasattr(chat, 'get_last_reasoning_content'):
                try:
                    reasoning = chat.get_last_reasoning_content()
                    if reasoning:
                        result['reasoning'] = reasoning
                except Exception as e:
                    result['reasoning_error'] = str(e)
            
            return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

def run_server():
    app.run(host='0.0.0.0', port=18000)

if __name__ == '__main__':
    run_server()
