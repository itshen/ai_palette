# 🌟 AI Palette - 强大的多模型AI聊天接口

## 🚀 主要特点

- **多模型支持**：一个接口，多种选择
  - OpenAI (GPT系列)
  - 文心一言 (ERNIE)
  - 通义千问 (Dashscope)
  - Ollama
  - 智谱AI (Zhipu)
  - MiniMax
  - Deepseek
  - SiliconFlow

- **丰富的功能**
  - ✨ 支持流式输出
  - 🔄 智能重试机制
  - 💬 上下文管理
  - 🎯 灵活的配置选项
  - 🔒 安全的API密钥管理

- **易用性**
  - 简单的API设计
  - 统一的接口
  - 详细的错误处理
  - 完善的日志系统

## 💡 使用示例

```python
from ai_palette import AIChat, APIProvider

# 创建聊天实例
chat = AIChat(
    provider=APIProvider.OPENAI,
    model="gpt-3.5-turbo",
    enable_streaming=True
)

# 基础对话
response = chat.ask("你好，请介绍一下自己")
print(response)

# 流式输出
for chunk in chat.ask("讲一个关于人工智能的小故事"):
    print(chunk["content"], end="", flush=True)
```

## 🌈 为什么选择 AI Palette?

1. **一站式解决方案**：不需要学习多个API，一个接口搞定所有模型
2. **生产级别的稳定性**：
   - 自动重试机制
   - 完善的错误处理
   - 详细的日志记录
3. **灵活的配置**：
   - 支持环境变量配置
   - 可自定义API地址
   - 温度和最大token控制
4. **优秀的开发体验**：
   - 类型提示支持
   - 清晰的文档
   - 直观的API设计

## 🎯 适用场景

- 聊天机器人开发
- AI助手集成
- 多模型对比测试
- 生产环境部署

## 🚀 开始使用

只需要简单几步，就能开始使用这个强大的工具：

1. 准备好相应的API密钥
2. 安装依赖
3. 导入并开始使用

就是这么简单！

## 🔥 特色功能展示

### Deepseek 模型的推理过程

```python
chat = AIChat(
    provider=APIProvider.DEEPSEEK,
    model="deepseek-reasoner",
    enable_streaming=True
)

# 获取推理过程和最终答案
for chunk in chat.ask("为什么月亮总是同一面朝向地球？"):
    if chunk["type"] == "reasoning":
        print("[推理]", chunk["content"])
    else:
        print("[答案]", chunk["content"])
```

## 🛠 技术特点

- 使用 Python 数据类和枚举确保类型安全
- 异步支持
- 优雅的重试机制
- 灵活的流式处理
- 完善的错误处理机制

---

开始使用 AI Palette，体验一站式的AI对话解决方案！🚀 