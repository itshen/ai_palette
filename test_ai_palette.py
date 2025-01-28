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
    """获取模型的 API key
    
    Returns:
        str: API key，优先从环境变量获取，如果没有则返回获取地址
    """
    # API key 环境变量名映射
    env_vars = {
        'glm': 'GLM_API_KEY',
        'qwen': 'QWEN_API_KEY',
        'minimax': 'MINIMAX_API_KEY',
        'gpt': 'OPENAI_API_KEY',
        'ollama': '',  # Ollama 不需要 API key
        'deepseek': 'DEEPSEEK_API_KEY',
        'ernie': 'ERNIE_API_KEY'
    }
    
    # API key 获取地址映射（当环境变量不存在时显示）
    api_urls = {
        'glm': 'https://open.bigmodel.cn/usercenter/proj-mgmt/apikeys',
        'qwen': 'https://bailian.console.aliyun.com/?apiKey=1',
        'minimax': 'https://platform.minimaxi.com/user-center/basic-information/interface-key',
        'gpt': 'https://platform.openai.com/api-keys',
        'ollama': '',
        'deepseek': 'https://platform.deepseek.com/api-keys',
        'ernie': 'https://console.bce.baidu.com/ai/#/ai/wenxinworkshop/app/list'
    }
    
    # 如果模型类型有对应的环境变量，尝试从环境变量获取
    if env_var := env_vars.get(model_type):
        if api_key := os.getenv(env_var):
            return api_key
    
    # 如果环境变量不存在或为空，返回获取地址
    return api_urls.get(model_type, '')

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
        'glm': {
            'model': 'GLM-4',  # 更新为最新模型
            'api_url': 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
        },
        'qwen': {
            'model': 'qwen-turbo',  # 更新为 Qwen-turbo
            'api_url': 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation'
        },
        'minimax': {
            'model': 'abab6-chat',  # 更新为最新模型
            'api_url': 'https://api.minimax.chat/v1/chat/completions',
            'api_secret': os.getenv('MINIMAX_GROUP_ID', '')  # 从环境变量获取 group_id
        },
        'gpt': {
            'model': 'gpt-4-turbo-preview',  # 更新为 GPT-4-Turbo
            'api_url': 'https://api.openai.com/v1/chat/completions'
        },
        'ollama': {
            'model': get_ollama_models(),
            'api_url': 'http://localhost:11434/api/chat'
        },
        'deepseek': {
            'model': 'deepseek-chat',  # DeepSeek-V3 默认模型
            'api_url': 'https://api.deepseek.com/v1'  # 可选，与 OpenAI 兼容的 base_url
        },
        'ernie': {
            'model': 'ernie-4.0',  # 文心一言 4.0
            'api_url': 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions',
            'api_secret': os.getenv('ERNIE_API_SECRET', '')  # 从环境变量获取 API secret
        }
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
    
    # 基本对话测试
    prompts = [
        "你好，请用一句话介绍自己",
        "1+1等于几？请直接回答数字",
        "用Python写一个简单的Hello World程序"
    ]
    
    for prompt in prompts:
        print(f"\n用户: {prompt}")
        response = chat.ask(prompt)
        print(f"助手: {response}")
        time.sleep(0.5)  # 短暂延迟，避免请求过快

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
    
    prompts = [
        "讲一个简短的笑话",
        "写一首简单的诗",
    ]
    
    for prompt in prompts:
        print(f"\n用户: {prompt}")
        print("助手: ", end="", flush=True)
        for chunk in chat.ask(prompt):
            print(chunk, end="", flush=True)
        print("\n")
        time.sleep(0.5)

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
    
    # 多轮对话测试
    conversations = [
        ("你好，我叫小明", "打招呼并自我介绍"),
        ("你还记得我的名字吗？", "确认是否记住用户名字"),
        ("我最喜欢的颜色是蓝色", "告诉AI喜欢的颜色"),
        ("你还记得我最喜欢什么颜色吗？", "测试是否记住颜色信息"),
        ("那你能重复一下我们刚才聊了什么吗？", "总结对话内容")
    ]
    
    for user_input, desc in conversations:
        print(f"\n用户: {user_input} ({desc})")
        messages.append(Message(role="user", content=user_input))
        response = chat.ask(user_input, messages=messages)
        print(f"助手: {response}")
        messages.append(Message(role="assistant", content=response))
        time.sleep(0.5)

def test_context_management(model_type: str):
    """测试上下文管理功能"""
    print(f"\n=== 测试 {model_type.upper()} 上下文管理 ===")
    config = get_model_config(model_type)
    chat = AIChat(
        model_type=model_type,
        api_key=get_api_key(model_type),
        **config
    )
    
    # 测试系统提示词
    print("1. 测试系统提示词:")
    system_prompts = [
        ("你是一个专业的Python导师", "Python适合初学者吗？"),
        ("你是一个中医专家", "头痛应该怎么办？"),
        ("你是一个数学老师", "解释一下什么是质数")
    ]
    
    for system_prompt, user_query in system_prompts:
        chat.clear_context(include_system_prompt=True)
        print(f"\n系统提示词: {system_prompt}")
        print(f"用户问题: {user_query}")
        chat.add_context(system_prompt, role="system")
        response = chat.ask(user_query)
        print(f"助手回复: {response}")
        time.sleep(0.5)
    
    # 测试添加用户消息
    print("\n2. 测试添加用户消息:")
    chat.clear_context(include_system_prompt=True)
    chat.add_context("你是一个编程助手", role="system")
    chat.add_context("我想学习编程", role="user")
    chat.add_context("这是个很好的选择，你想从哪种语言开始？", role="assistant")
    response = chat.ask("我听说Python比较简单，是这样吗？")
    print(f"回复: {response}")
    
    # 测试清除上下文
    print("\n3. 测试清除上下文:")
    chat.clear_context()
    response = chat.ask("还记得我们刚才在聊什么吗？")
    print(f"回复: {response}")
    
    # 测试重复添加系统提示词（应该抛出异常）
    print("\n4. 测试重复添加系统提示词:")
    try:
        chat.add_context("你是一个数学老师", role="system")
        chat.add_context("你是一个英语老师", role="system")
    except ValueError as e:
        print(f"预期的错误: {str(e)}")

def main():
    # 设置环境变量（测试时替换为实际的 API key）
    os.environ.update({
        'GLM_API_KEY': 'your-glm-api-key-here',
        'QWEN_API_KEY': 'your-qwen-api-key-here',
        'MINIMAX_API_KEY': 'your-minimax-api-key-here',
        'MINIMAX_GROUP_ID': 'your-minimax-group-id-here',
        'OPENAI_API_KEY': 'your-openai-api-key-here',
        'DEEPSEEK_API_KEY': 'your-deepseek-api-key-here',
        'ERNIE_API_KEY': 'your-ernie-api-key-here',
        'ERNIE_API_SECRET': 'your-ernie-api-secret-here'
    })
    
    # 要测试的模型列表
    models = ['glm', 'qwen', 'minimax', 'gpt', 'ollama', 'deepseek', 'ernie']
    
    # 获取要测试的模型
    test_models = os.getenv('TEST_MODELS', '').lower().split(',')
    if test_models and test_models[0]:
        models = [m for m in models if m in test_models]
    
    for model in models:
        try:
            print(f"\n{'='*20} 测试 {model.upper()} 模型 {'='*20}")
            
            # 检查是否有必要的环境变量
            if not get_api_key(model) and model != 'ollama':
                print(f"跳过 {model.upper()} 测试：缺少必要的 API key")
                print(f"请设置环境变量 {env_vars[model]} 或访问 {api_urls[model]} 获取 API key")
                continue
            
            # 测试基本对话
            test_basic_chat(model)
            time.sleep(1)
            
            # 测试流式输出
            test_streaming_chat(model)
            time.sleep(1)
            
            # 测试上下文对话
            test_context_chat(model)
            time.sleep(1)
            
            # 测试上下文管理
            test_context_management(model)
            time.sleep(1)
            
        except Exception as e:
            print(f"测试 {model} 时发生错误: {str(e)}")
            print(f"错误类型: {type(e).__name__}")
            print(f"错误详情: {str(e)}")
            print(f"如果是认证错误，请检查 API key 是否正确设置")

if __name__ == "__main__":
    main() 