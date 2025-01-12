import os
from ai_palette import AIChat, Message
from typing import Dict, Optional
import time
import requests
import json

# 存储 Ollama 模型名称
OLLAMA_MODEL = None

# 辅助函数：根据模型类型获取对应的 API key
def get_api_key(model_type: str) -> str:
    api_keys = {
        'glm': 'https://open.bigmodel.cn/usercenter/proj-mgmt/apikeys',
        'qwen': 'https://bailian.console.aliyun.com/?apiKey=1',
        'minimax': 'https://platform.minimaxi.com/user-center/basic-information/interface-key',
        'gpt': 'https://platform.openai.com/api-keys',
        'ollama': ''  # Ollama 不需要 API key
    }
    return api_keys.get(model_type, '')

def get_ollama_models() -> str:
    """获取 Ollama 可用的模型列表，返回第一个模型名称"""
    global OLLAMA_MODEL
    if OLLAMA_MODEL:
        return OLLAMA_MODEL
        
    try:
        response = requests.get('http://localhost:11434/api/tags')
        if response.status_code == 200:
            models = response.json().get('models', [])
            if models:
                OLLAMA_MODEL = models[0].get('name', 'llama2')
                print(f"Ollama 可用模型: {[model['name'] for model in models]}")
                print(f"选择使用模型: {OLLAMA_MODEL}")
                return OLLAMA_MODEL
    except Exception as e:
        print(f"获取 Ollama 模型列表失败: {str(e)}")
    OLLAMA_MODEL = 'llama2'
    return OLLAMA_MODEL

def get_model_config(model_type: str) -> Dict[str, str]:
    """获取模型配置"""
    configs = {
        'glm': {'model': 'GLM-4-Plus'},
        'qwen': {'model': 'qwen-max'},
        'minimax': {'model': 'abab5.5-chat', 'api_secret': '1679552762033994'},  # group_id
        'gpt': {'model': 'gpt-3.5-turbo'},
        'ollama': {'model': get_ollama_models(), 'api_url': 'http://localhost:11434/api/chat'}
    }
    return configs.get(model_type, {})

def test_basic_chat(model_type: str):
    """测试基本对话功能"""
    print(f"\n=== 测试 {model_type.upper()} 基本对话 ===")
    config = get_model_config(model_type)
    chat = AIChat(
        model_type=model_type,
        api_key=get_api_key(model_type),
        **config
    )
    
    response = chat.ask("你好，请用一句话介绍自己")
    print(f"回复: {response}")

def test_streaming_chat(model_type: str):
    """测试流式输出功能"""
    print(f"\n=== 测试 {model_type.upper()} 流式输出 ===")
    config = get_model_config(model_type)
    chat = AIChat(
        model_type=model_type,
        api_key=get_api_key(model_type),
        enable_streaming=True,
        **config
    )
    
    print("回复: ", end="", flush=True)
    for chunk in chat.ask("讲一个简短的笑话"):
        print(chunk, end="", flush=True)
    print()

def test_context_chat(model_type: str):
    """测试上下文对话功能"""
    print(f"\n=== 测试 {model_type.upper()} 上下文对话 ===")
    config = get_model_config(model_type)
    chat = AIChat(
        model_type=model_type,
        api_key=get_api_key(model_type),
        **config
    )
    
    messages = []
    
    # 第一轮对话
    print(f"用户: 你好，我叫小明")
    messages.append(Message(role="user", content="你好，我叫小明"))
    response = chat.ask("你好，我叫小明", messages=messages)
    print(f"助手: {response}")
    messages.append(Message(role="assistant", content=response))
    
    # 第二轮对话，应该记住用户名字
    print(f"\n用户: 你还记得我的名字吗？")
    messages.append(Message(role="user", content="你还记得我的名字吗？"))
    response = chat.ask("你还记得我的名字吗？", messages=messages)
    print(f"助手: {response}")
    messages.append(Message(role="assistant", content=response))
    
    # 第三轮对话，继续上下文
    print(f"\n用户: 那你能重复一下我们刚才聊了什么吗？")
    messages.append(Message(role="user", content="那你能重复一下我们刚才聊了什么吗？"))
    response = chat.ask("那你能重复一下我们刚才聊了什么吗？", messages=messages)
    print(f"助手: {response}")
    
    time.sleep(1)  # 避免请求过快

def main():
    # 要测试的模型列表
    models = ['glm', 'qwen', 'minimax', 'gpt', 'ollama']  # 测试所有支持的模型
    
    for model in models:
        try:
            print(f"\n{'='*20} 测试 {model.upper()} 模型 {'='*20}")
            
            # 测试基本对话
            test_basic_chat(model)
            time.sleep(1)  # 避免请求过快
            
            # 测试流式输出
            test_streaming_chat(model)
            time.sleep(1)
            
            # 测试上下文对话
            test_context_chat(model)
            time.sleep(1)
            
        except Exception as e:
            print(f"测试 {model} 时发生错误: {str(e)}")

if __name__ == "__main__":
    main() 