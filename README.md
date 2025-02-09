# AI Palette 🎨

轻量优雅的统一 AI 接口，一个调用满足所有需求。
支持多种主流 AI 模型，如同调色板一样，随心所欲地切换不同的 AI 服务。
非常适合在 Cursor 等 AI IDE 作为上下文使用。

## 🌟 为什么选择 AI Palette?

- 🔄 **统一接口**: 一套代码适配多个大模型，无需重复开发
- 🛠 **降低成本**: 灵活切换不同模型，优化使用成本
- 🚀 **快速接入**: 5分钟即可完成接入，支持流式输出
- 🔌 **高可用性**: 内置完善的重试机制，确保服务稳定性
- 🎯 **开箱即用**: 主流模型开箱即用，接口统一规范

## ✨ 特性

- 🎨 统一优雅的接口设计
- 💎 单文件实现，轻量级且方便集成
- 🌊 支持流式输出
- 🔄 完善的错误处理和重试机制
- 📝 类型提示和文档完备
- ⚙️ 配置灵活，支持直接传参和环境变量
- 💬 支持上下文对话

## 🎯 支持的模型

### OpenAI
- GPT-4 Turbo
- GPT-3.5 Turbo

### 百度文心一言
- ERNIE Bot 4.0
- ERNIE Bot 8K

### 阿里通义千问
- Qwen Turbo
- Qwen Plus
- Qwen Max

### 智谱 AI
- GLM-4
- GLM-4-32K

### MiniMax
- ABAB-6
- ABAB-5.5

### DeepSeek
- DeepSeek Chat V3
- DeepSeek Chat R1

### 硅基流动：
- DeepSeek-R1 / V3
- Qwen 2.5 (72B/32B/14B/7B)
- Meta Llama 3 (70B/8B)
- Google Gemma 2 (27B/9B)
- InternLM 2.5 (20B/7B)
- Yi 1.5 (34B/9B/6B)
- ChatGLM 4 (9B)

### Ollama (本地部署)
- Llama 2
- Mistral
- CodeLlama
- Gemma
……


## 🚀 快速开始

## 📦 安装

```bash
pip install ai_palette
```

### Web 应用

启动服务器：
```bash
python -m ai_palette.app
```

服务器启动后，访问 http://127.0.0.1:18000 即可使用。

主要功能：
- 支持所有已配置模型的在线对话
- 支持流式输出
- 支持自定义系统提示词
- 支持查看对话历史
- 支持导出对话记录

<img src="ai_palette/static/image/web_demo.png" width="600" alt="AI Palette">

### Python API 使用

```python
from ai_palette import AIChat, Message

# 方式1：直接传入配置
chat = AIChat(
    provider="openai",  # 支持: openai, ernie, dashscope, zhipu, ollama, minimax, deepseek, siliconflow
    model="gpt-3.5-turbo",
    api_key="your-api-key"
)

# 方式2：从环境变量读取配置
chat = AIChat(provider="openai")  # 会自动读取对应的环境变量，如 OPENAI_API_KEY 和 OPENAI_MODEL

# 基本对话
response = chat.ask("你好，请介绍一下自己")
print(response)

# 带系统提示词的对话
chat.add_context("你是一个中医专家")
response = chat.ask("头痛该怎么办？")
print(response)

# 流式输出
chat = AIChat(provider="openai", enable_streaming=True)
for chunk in chat.ask("讲一个故事"):
    print(chunk["content"], end="", flush=True)

# 上下文对话
messages = []
messages.append(Message(role="user", content="你好，我叫小明"))
response = chat.ask("你好，我叫小明", messages=messages)
messages.append(Message(role="assistant", content=response))

messages.append(Message(role="user", content="你还记得我的名字吗？"))
response = chat.ask("你还记得我的名字吗？", messages=messages)

# 上下文管理
chat = AIChat(provider="openai")

# 添加系统提示词（只能添加一个）
chat.add_context("你是一个专业的Python导师", role="system")

# 添加对话历史
chat.add_context("我想学习Python", role="user")
chat.add_context("很好，我们开始吧", role="assistant")

# 发送新的问题
response = chat.ask("我应该从哪里开始？")

# 清除普通上下文，保留系统提示词
chat.clear_context()

# 清除所有上下文（包括系统提示词）
chat.clear_context(include_system_prompt=True)
```


## ⚙️ 环境变量配置

创建 `.env` 文件，参考 `.env.example` 进行配置：

```bash
# OpenAI GPT 配置
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-3.5-turbo

# 文心一言配置
ERNIE_API_KEY=xxxxxxxxxxxxxxxx
ERNIE_API_SECRET=xxxxxxxxxxxxxxxx
ERNIE_MODEL=ernie-bot-4

# 通义千问配置
# https://bailian.console.aliyun.com/?apiKey=1
DASHSCOPE_API_KEY=xxxxxxxxxxxxxxxx
DASHSCOPE_MODEL=qwen-max

# ChatGLM配置
# https://open.bigmodel.cn/usercenter/proj-mgmt/apikeys
ZHIPU_API_KEY=xxxxxxxxxxxxxxxx
ZHIPU_MODEL=glm-4

# Ollama配置
OLLAMA_API_URL=http://localhost:11434/api/chat
OLLAMA_MODEL=llama2

# MiniMax配置
# https://platform.minimaxi.com/user-center/basic-information/interface-key
MINIMAX_API_KEY=xxxxxxxxxxxxxxxx
MINIMAX_API_SECRET=xxxxxxxxxxxxxxxx
MINIMAX_MODEL=abab5.5-chat

# Deepseek配置
# https://platform.deepseek.com/
DEEPSEEK_API_KEY=xxxxxxxxxxxxxxxx
DEEPSEEK_MODEL=deepseek-chat

# Siliconflow配置
SILICONFLOW_API_KEY=xxxxxxxxxxxxxxxx
SILICONFLOW_MODEL=siliconflow-chat
```

## 🎯 高级用法

### Deepseek 模型使用

Deepseek 模型具有独特的推理能力，可以展示 AI 的思考过程：

```python
from ai_palette import AIChat

# 创建 Deepseek 实例
chat = AIChat(
    provider="deepseek",
    model="deepseek-chat",
    enable_streaming=True  # 启用流式输出
)

# 非流式请求
response = chat.ask("解释量子纠缠现象")
print("回答:", response)
print("推理过程:", chat.get_last_reasoning_content())

# 流式请求
for chunk in chat.ask("为什么月亮总是同一面朝向地球？"):
    if chunk["type"] == "reasoning":
        print("\n[推理过程]", chunk["content"], end="")
    else:  # type == "content"
        print("\n[最终答案]", chunk["content"], end="")
```

#### Deepseek API Key 设置

有三种方式设置 Deepseek API Key：

1. 命令行参数：
```bash
python test_deepseek.py --api-key YOUR_API_KEY --save
```

2. 环境变量：
```bash
export DEEPSEEK_API_KEY="your-api-key"
```

3. 交互式输入：
直接运行程序，根据提示输入 API Key。

#### Deepseek 特有功能

- 推理过程展示：通过 `get_last_reasoning_content()` 获取 AI 的推理过程
- 流式输出区分：支持同时获取推理过程和最终答案的流式输出
- 超时控制：可以根据问题复杂度设置不同的超时时间
  ```python
  # 复杂问题使用更长的超时时间
  chat = AIChat(
      provider="deepseek",
      model="deepseek-chat",
      timeout=180  # 3分钟超时
  )
  ```

### 选择性测试

可以通过环境变量选择要测试的模型：

```bash
# 只测试指定的模型
export TEST_MODELS=openai,deepseek,ollama
python test_ai_palette.py

# 测试所有模型
python test_ai_palette.py
```

### 消息历史

```python
messages = [
    Message(role="system", content="你是一个helpful助手"),
    Message(role="user", content="今天天气真好"),
    Message(role="assistant", content="是的，阳光明媚")
]
response = chat.ask("我们去散步吧", messages=messages)
```

### 错误重试

默认启用指数退避重试机制：
- 最大重试次数：3次
- 基础延迟：1秒
- 最大延迟：10秒

可以在创建实例时自定义：

```python
chat = AIChat(
    provider="openai",
    retry_count=5,  # 最大重试5次
    timeout=60     # 请求超时时间60秒
)
```

### 上下文管理

AI Palette 提供了灵活的上下文管理功能：

- **系统提示词**: 只能设置一个，始终位于对话最前面
- **对话历史**: 可以添加多条用户和助手的对话记录
- **上下文清理**: 支持选择性清除普通对话或包含系统提示词

```python
# 添加系统提示词
chat.add_context("你是一个专业的Python导师", role="system")

# 添加对话历史
chat.add_context("我想学习Python", role="user")
chat.add_context("很好，我们开始吧", role="assistant")

# 清除上下文
chat.clear_context()  # 只清除普通对话
chat.clear_context(include_system_prompt=True)  # 清除所有上下文
```

### 推理链功能

推理链允许你使用两个不同的模型进行两阶段推理：一个用于思考，一个用于生成最终结果。这对于需要深度思考和推理的复杂任务特别有用。

```python
import requests
import json

# 推理链配置示例
chain_config = {
    "query": "为什么天会下雨？",  # 用户问题
    "enable_streaming": True,     # 是否启用流式输出
    "use_reasoning_field": True,  # True: 使用 reasoning_content 字段返回思考过程
                                 # False: 使用 <think></think> 标签包裹思考过程
    "thinkingConfig": {          # 思考阶段的模型配置
        "modelType": "siliconflow",
        "model": "Qwen/Qwen2.5-7B-Instruct",
        "apiKey": "your-api-key"
    },
    "resultConfig": {            # 结果阶段的模型配置
        "modelType": "siliconflow",
        "model": "Qwen/Qwen2.5-7B-Instruct",
        "apiKey": "your-api-key"
    },
    "thinkingPrompt": "这个是思考的 prompt， 会包括 [$query$]",
    "resultPrompt": "这个是结果，不但包括[$thought$]，还会包括[$query$]",
    "context": [                 # 可选的上下文历史
        {"role": "user", "content": "之前的问题"},
        {"role": "assistant", "content": "之前的回答"}
    ]
}

# 发送请求
response = requests.post(
    "http://localhost:18000/api/chain_chat",
    json=chain_config
)

# 处理非流式响应
if not chain_config["enable_streaming"]:
    result = response.json()
    if result["success"]:
        if chain_config["use_reasoning_field"]:
            print("思考过程:", result["reasoning_content"])
            print("最终答案:", result["response"])
        else:
            print("完整回答:", result["response"])  # 包含 <think></think> 标签
    else:
        print("错误:", result["error"])

# 处理流式响应
else:
    for line in response.iter_lines():
        if line:
            line = line.decode('utf-8')
            if line.startswith('data: '):
                data = json.loads(line[6:])
                if data.get("type") == "thinking":
                    print("思考中:", data["content"])
                elif data.get("type") == "content":
                    if chain_config["use_reasoning_field"]:
                        print("最终答案:", data["content"])
                        if "reasoning_content" in data:
                            print("思考过程:", data["reasoning_content"])
                    else:
                        print("完整回答:", data["content"])  # 包含 <think></think> 标签
```

推理链的主要特点：

- 🔄 **两阶段推理**: 分别使用思考模型和结果模型
- 🎯 **灵活配置**: 可以为每个阶段配置不同的模型和参数
- 💭 **思考过程**: 可选择使用单独字段或标签形式展示思考过程
- 🌊 **流式输出**: 支持实时查看思考和结果的生成过程
- 📜 **上下文支持**: 保持对话历史，自动处理思考内容

## 📄 许可证

MIT 


<img src="ai_palette/static/image/connect.jpg" width="400" alt="AI Palette">
