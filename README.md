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

## 📦 安装

```bash
pip install -r requirements.txt
```

## 🚀 快速开始

```python
from ai_palette import AIChat, Message

# 方式1：直接传入配置
chat = AIChat(
    provider="openai",
    model="gpt-3.5-turbo",
    api_key="your-api-key"
)

# 方式2：从环境变量读取配置
chat = AIChat(provider="openai")  # 会自动读取 OPENAI_API_KEY 和 OPENAI_MODEL

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
    print(chunk, end="", flush=True)

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
chat.add_context("很好，Python是一个很好的选择。我们从基础开始吧。", role="assistant")

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
# https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-3.5-turbo

# 文心一言配置
# https://cloud.baidu.com/product/wenxinworkshop
ERNIE_API_KEY=xxxxxxxxxxxxxxxx
ERNIE_API_SECRET=xxxxxxxxxxxxxxxx
ERNIE_MODEL=ernie-bot-4

# ChatGLM 配置
# https://open.bigmodel.cn/usercenter/apikeys
GLM_API_KEY=xxxxxxxxxxxxxxxx
GLM_MODEL=glm-4

# 通义千问配置
# https://bailian.console.aliyun.com/?apiKey=1
QWEN_API_KEY=xxxxxxxxxxxxxxxx
QWEN_MODEL=qwen-max

# MiniMax 配置
# https://platform.minimax.com/user-center/basic-information/interface-key
MINIMAX_API_KEY=xxxxxxxxxxxxxxxx
MINIMAX_API_SECRET=xxxxxxxxxxxxxxxx
MINIMAX_MODEL=abab5.5-chat

# Ollama 配置（本地运行无需 API KEY）
# https://ollama.com/download
OLLAMA_API_URL=http://localhost:11434/api/chat
OLLAMA_MODEL=llama2
```

## 🎯 高级用法

### Deepseek 模型使用

Deepseek 模型具有独特的推理能力，可以展示 AI 的思考过程：

```python
from ai_palette import AIChat

# 创建 Deepseek 实例
chat = AIChat(
    provider="deepseek",
    model="deepseek-reasoner",
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
      model="deepseek-reasoner",
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

## 📄 Web 界面

项目提供了一个简洁美观的 Web 界面（`app.py`），可以直接在浏览器中体验各种模型的对话能力：

```bash
# 运行 Web 服务
python app.py
```

启动后访问 `http://localhost:5000` 即可使用。主要功能：
- 支持所有已配置模型的在线对话
- 支持流式输出
- 支持自定义系统提示词
- 支持查看对话历史
- 支持导出对话记录


<img src="static/image/web_demo.png" width="600" alt="AI Palette">

## 📄 许可证

MIT 


<img src="static/image/connect.jpg" width="400" alt="PI Palette">

---

# AI Palette 🎨 [English]

A lightweight and elegant unified AI interface that meets all needs with a single call.
Supporting multiple mainstream AI models, switch between different AI services as freely as using a palette.
It is great for AI IDEs such as Cursor to use as a context.

## 🌟 Why Choose AI Palette?

- 🔄 **Unified Interface**: One codebase fits multiple large models, no need to develop repeatedly
- 🛠 **Reduce Costs**: Flexible switching between different models, optimizing usage costs
- 🚀 **Quick Integration**: 5 minutes to complete integration, support streaming output
- 🔌 **High Availability**: Built-in complete retry mechanism, ensuring service stability
- 🎯 **Out-of-the-Box**: Mainstream models ready to use, interface uniform and standardized

## ✨ Features

- 🎨 Unified elegant interface design
- 💎 Single file implementation, lightweight and easy to integrate
- 🌊 Support streaming output
- 🔄 Complete error handling and retry mechanism
- 📝 Type hints and comprehensive documentation
- ⚙️ Flexible configuration, supporting direct parameters and environment variables
- 💬 Support contextual dialogue

## 🎯 Supported Models

### OpenAI
- GPT-4 Turbo
- GPT-3.5 Turbo

### Baidu ERNIE
- ERNIE Bot 4.0
- ERNIE Bot 8K

### Alibaba Qwen
- Qwen Turbo
- Qwen Plus
- Qwen Max

### Zhipu AI
- GLM-4
- GLM-4-32K

### MiniMax
- ABAB-6
- ABAB-5.5

### DeepSeek
- DeepSeek Chat V3
- DeepSeek Chat R1

### SiliconFlow
- DeepSeek-R1 / V3
- Qwen 2.5 (72B/32B/14B/7B)
- Meta Llama 3 (70B/8B)
- Google Gemma 2 (27B/9B)
- InternLM 2.5 (20B/7B)
- Yi 1.5 (34B/9B/6B)
- ChatGLM 4 (9B)

### Ollama (Local Deployment)
- Llama 2
- Mistral
- CodeLlama
- Gemma

## 📦 Installation

```bash
pip install -r requirements.txt
```

## 🚀 Quick Start

```python
from ai_palette import AIChat, Message

# Method 1: Direct configuration
chat = AIChat(
    provider="openai",
    model="gpt-3.5-turbo",
    api_key="your-api-key"
)

# Method 2: Read from environment variables
chat = AIChat(provider="openai")  # Will automatically read OPENAI_API_KEY and OPENAI_MODEL

# Basic conversation
response = chat.ask("Hello, please introduce yourself")
print(response)

# Conversation with system prompt
chat.add_context("You are a medical expert")
response = chat.ask("What should I do for a headache?")
print(response)

# Streaming output
chat = AIChat(provider="openai", enable_streaming=True)
for chunk in chat.ask("Tell me a story"):
    print(chunk, end="", flush=True)

# Contextual dialogue
messages = []
messages.append(Message(role="user", content="Hi, my name is Tom"))
response = chat.ask("Hi, my name is Tom", messages=messages)
messages.append(Message(role="assistant", content=response))

messages.append(Message(role="user", content="Do you remember my name?"))
response = chat.ask("Do you remember my name?", messages=messages)

# Context management
chat = AIChat(provider="openai")

# Add system prompt (only one can be set)
chat.add_context("You are a Python tutor", role="system")

# Add dialogue history
chat.add_context("I want to learn Python", role="user")
chat.add_context("Great, let's start with the basics", role="assistant")

# Send new question
response = chat.ask("Where should I start?")

# Clear regular context, keep system prompt
chat.clear_context()

# Clear all context (including system prompt)
chat.clear_context(include_system_prompt=True)
```

## ⚙️ Environment Variables

Create a `.env` file, refer to `.env.example` for configuration:

```bash
# OpenAI GPT Configuration
# https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-3.5-turbo

# ERNIE Configuration
# https://cloud.baidu.com/product/wenxinworkshop
ERNIE_API_KEY=xxxxxxxxxxxxxxxx
ERNIE_API_SECRET=xxxxxxxxxxxxxxxx
ERNIE_MODEL=ernie-bot-4

# ChatGLM Configuration
# https://open.bigmodel.cn/usercenter/apikeys
GLM_API_KEY=xxxxxxxxxxxxxxxx
GLM_MODEL=glm-4

# Qwen Configuration
# https://bailian.console.aliyun.com/?apiKey=1
QWEN_API_KEY=xxxxxxxxxxxxxxxx
QWEN_MODEL=qwen-max

# MiniMax Configuration
# https://platform.minimax.com/user-center/basic-information/interface-key
MINIMAX_API_KEY=xxxxxxxxxxxxxxxx
MINIMAX_API_SECRET=xxxxxxxxxxxxxxxx
MINIMAX_MODEL=abab5.5-chat

# Ollama Configuration (No API KEY needed for local running)
# https://ollama.com/download
OLLAMA_API_URL=http://localhost:11434/api/chat
OLLAMA_MODEL=llama2
```

## 🎯 Advanced Usage

### Message History

```python
messages = [
    Message(role="system", content="You are a helpful assistant"),
    Message(role="user", content="The weather is nice today"),
    Message(role="assistant", content="Yes, it's sunny")
]
response = chat.ask("Shall we go for a walk?", messages=messages)
```

### Error Retry

Exponential backoff retry mechanism enabled by default:
- Maximum retry attempts: 3
- Base delay: 1 second
- Maximum delay: 10 seconds

Can be customized when creating an instance:

```python
chat = AIChat(
    provider="openai",
    retry_count=5,  # Maximum 5 retries
    timeout=60     # Request timeout 60 seconds
)
```

### Context Management [English]

AI Palette provides flexible context management features:

- **System Prompt**: Only one can be set, always at the beginning of the conversation
- **Dialogue History**: Multiple user and assistant messages can be added
- **Context Cleanup**: Supports selective clearing of regular dialogue or including system prompt

```python
# Add system prompt
chat.add_context("You are a Python tutor", role="system")

# Add dialogue history
chat.add_context("I want to learn Python", role="user")
chat.add_context("Great, let's start with the basics", role="assistant")

# Clear context
chat.clear_context()  # Only clear regular dialogue
chat.clear_context(include_system_prompt=True)  # Clear all context
```

## 📄 Web Interface

The project provides a clean and beautiful web interface (`app.py`) that allows you to experience various models' conversational capabilities directly in your browser:

```bash
# Run the web server
python app.py
```

Visit `http://localhost:5000` after startup. Main features:
- Support online conversation with all configured models
- Support streaming output
- Support custom system prompts
- Support viewing conversation history
- Support exporting conversation records

<img src="static/image/web_demo.png" width="600" alt="AI Palette">

## 📄 License

MIT 

### Deepseek Model Usage

Deepseek model has unique reasoning ability, showing AI's thinking process:

```python
from ai_palette import AIChat

# Create Deepseek instance
chat = AIChat(
    provider="deepseek",
    model="deepseek-reasoner",
    enable_streaming=True  # Enable streaming output
)

# Non-streaming request
response = chat.ask("Explain quantum entanglement phenomenon")
print("Answer:", response)
print("Reasoning:", chat.get_last_reasoning_content())

# Streaming request
for chunk in chat.ask("Why does the moon always face the same side towards the earth?"):
    if chunk["type"] == "reasoning":
        print("\n[Reasoning]", chunk["content"], end="")
    else:  # type == "content"
        print("\n[Final Answer]", chunk["content"], end="")
```

#### Deepseek API Key Setting

There are three ways to set Deepseek API Key:

1. Command line argument:
```bash
python test_deepseek.py --api-key YOUR_API_KEY --save
```

2. Environment variable:
```bash
export DEEPSEEK_API_KEY="your-api-key"
```

3. Interactive input:
Run the program and enter API Key based on the prompt.

#### Deepseek Specific Features

- Reasoning Process Display: Get AI's reasoning process through `get_last_reasoning_content()`
- Streaming Output Differentiation: Support streaming output that simultaneously gets reasoning process and final answer
- Timeout Control: Different timeout times can be set based on the complexity of the question
  ```python
  # Use longer timeout for complex questions
  chat = AIChat(
      provider="deepseek",
      model="deepseek-reasoner",
      timeout=180  # 3 minutes timeout
  )
  ```