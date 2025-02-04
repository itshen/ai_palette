import json
import requests
import aiohttp
import asyncio
import os
from dataclasses import dataclass
from enum import Enum
from typing import Optional, List, Dict, Generator, Union, AsyncGenerator, Any, Callable
from loguru import logger
from dotenv import load_dotenv
from functools import wraps
import time

# 加载.env文件
load_dotenv()

# 设置默认日志级别为 WARNING
logger.remove()
logger.add(lambda msg: print(msg, end=''), level="WARNING")

def set_log_level(level: str) -> None:
    """设置日志级别
    Args:
        level: 日志级别，可选值：TRACE, DEBUG, INFO, WARNING, ERROR, CRITICAL
    """
    logger.remove()
    logger.add(lambda msg: print(msg, end=''), level=level.upper())

def retry_with_exponential_backoff(
    max_retries: int = 3,
    base_delay: float = 1,
    max_delay: float = 10,
    exceptions: tuple = (requests.RequestException, aiohttp.ClientError)
):
    """指数退避重试装饰器"""
    def decorator(func):
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            retries = 0
            while True:
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    retries += 1
                    if retries > max_retries:
                        raise e
                    delay = min(base_delay * (2 ** (retries - 1)), max_delay)
                    logger.warning(f"重试第 {retries} 次，等待 {delay} 秒。错误：{e}")
                    time.sleep(delay)

        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            retries = 0
            while True:
                try:
                    return await func(*args, **kwargs)
                except exceptions as e:
                    retries += 1
                    if retries > max_retries:
                        raise e
                    delay = min(base_delay * (2 ** (retries - 1)), max_delay)
                    logger.warning(f"重试第 {retries} 次，等待 {delay} 秒。错误：{e}")
                    await asyncio.sleep(delay)

        return async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper
    return decorator

class APIProvider(Enum):
    """API供应商枚举类"""
    OPENAI = "openai"
    ERNIE = "ernie"
    DASHSCOPE = "dashscope"  # 通义千问
    OLLAMA = "ollama"
    ZHIPU = "zhipu"  # 智谱AI
    MINIMAX = "minimax"
    DEEPSEEK = "deepseek"
    SILICONFLOW = "siliconflow"

    def get_base_url(self) -> str:
        """获取API基础地址"""
        urls = {
            APIProvider.OPENAI: "https://api.openai.com/v1/chat/completions",
            APIProvider.ERNIE: "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions",
            APIProvider.DASHSCOPE: "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
            APIProvider.OLLAMA: "http://localhost:11434/api/chat",
            APIProvider.ZHIPU: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
            APIProvider.MINIMAX: "https://api.minimax.chat/v1/chat/completions",
            APIProvider.DEEPSEEK: "https://api.deepseek.com/chat/completions",
            APIProvider.SILICONFLOW: "https://api.siliconflow.com/chat/completions"
        }
        return urls[self]

@dataclass
class Message:
    """消息数据类"""
    role: str
    content: str

    def to_dict(self) -> Dict[str, str]:
        """转换为字典格式"""
        return {"role": self.role, "content": self.content}

class AIChat:
    def __init__(
        self,
        provider: Union[APIProvider, str],
        model: str,
        api_key: Optional[str] = None,
        api_secret: Optional[str] = None,
        api_url: Optional[str] = None,
        enable_streaming: bool = False,
        temperature: float = 1.0,
        max_tokens: Optional[int] = None,
        timeout: int = 30,
        retry_count: int = 3
    ):
        # 如果传入的是字符串，转换为枚举
        if isinstance(provider, str):
            provider = APIProvider(provider.lower())
            
        self.provider = provider
        self.model = model
        
        # 从环境变量获取配置
        env_prefix = f"{provider.value.upper()}_"
        self.api_key = api_key or os.getenv(f"{env_prefix}API_KEY")
        self.api_secret = api_secret or os.getenv(f"{env_prefix}API_SECRET")
        self.api_url = api_url or os.getenv(f"{env_prefix}API_URL")
        
        self.enable_streaming = enable_streaming
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.timeout = timeout
        self.retry_count = retry_count
        self._system_prompt = None
        self._context = []
        self._last_reasoning_content = ""
        
        # 验证配置
        self._validate_config()

    def _validate_config(self) -> None:
        """验证配置是否有效"""
        if not self.model:
            raise ValueError("Model name is required")
            
        # 特定供应商的验证
        if self.provider == APIProvider.ERNIE and not self.api_secret:
            raise ValueError("API secret is required for ERNIE")
            
        # Ollama 不需要 API key
        if self.provider != APIProvider.OLLAMA and not self.api_key:
            raise ValueError("API key is required")

    def _get_api_url(self) -> str:
        """获取API地址"""
        return self.api_url or self.provider.get_base_url()

    def _get_headers(self) -> Dict[str, str]:
        """获取请求头"""
        headers = {"Content-Type": "application/json"}
        
        if self.provider in [APIProvider.OPENAI, APIProvider.ZHIPU, APIProvider.MINIMAX, 
                           APIProvider.DEEPSEEK, APIProvider.SILICONFLOW]:
            headers["Authorization"] = f"Bearer {self.api_key}"
            headers["Content-Type"] = "application/json"
            headers["Accept"] = "application/json"
        elif self.provider == APIProvider.DASHSCOPE:
            headers["Authorization"] = f"Bearer {self.api_key}"
        elif self.provider == APIProvider.ERNIE:
            headers["Authorization"] = f"Bearer {self._get_ernie_access_token()}"
            
        return headers

    def _get_ernie_access_token(self) -> str:
        """获取文心一言的access token"""
        url = f'https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id={self.api_key}&client_secret={self.api_secret}'
        response = requests.post(url)
        return response.json().get('access_token', '')

    def add_context(self, content: str, role: str = "system") -> None:
        """添加上下文消息
        
        Args:
            content: 消息内容
            role: 消息角色，可以是 "system"、"user" 或 "assistant"
        
        Raises:
            ValueError: 当尝试添加多个系统提示词时抛出
        """
        if role == "system":
            if self._system_prompt is not None:
                raise ValueError("只能设置一个系统提示词（system prompt）")
            self._system_prompt = Message(role="system", content=content)
        else:
            if role not in ["user", "assistant"]:
                raise ValueError("角色必须是 'system'、'user' 或 'assistant'")
            self._context.append(Message(role=role, content=content))

    def clear_context(self, include_system_prompt: bool = False) -> None:
        """清除上下文
        
        Args:
            include_system_prompt: 是否同时清除系统提示词
        """
        self._context.clear()
        if include_system_prompt:
            self._system_prompt = None

    def _prepare_messages(self, prompt: str, messages: Optional[List[Message]] = None) -> List[Dict[str, str]]:
        """准备发送给AI的消息列表"""
        final_messages = []
        
        # 添加系统提示词（如果存在）
        if self._system_prompt:
            final_messages.append(self._system_prompt.to_dict())
        
        # 添加上下文消息
        final_messages.extend([msg.to_dict() for msg in self._context])
        
        # 添加额外的消息历史（如果提供）
        if messages:
            final_messages.extend([msg.to_dict() for msg in messages])
        
        # 添加当前提示词
        final_messages.append(Message(role="user", content=prompt).to_dict())
        
        return final_messages

    def _prepare_request_data(self, messages: List[Dict[str, str]], stream: bool = False) -> Dict:
        """准备请求数据"""
        if self.provider == APIProvider.DASHSCOPE:
            data = {
                "model": self.model,
                "input": {"messages": messages},
                "parameters": {"result_format": "message"}
            }
            if self.max_tokens:
                data["parameters"]["max_tokens"] = self.max_tokens
            return data
        elif self.provider == APIProvider.MINIMAX:
            data = {
                "model": self.model,
                "messages": messages,
                "temperature": self.temperature,
                "stream": stream
            }
            if self.max_tokens:
                data["max_tokens"] = self.max_tokens
            return data
        elif self.provider == APIProvider.OLLAMA:
            return {
                "model": self.model,
                "messages": [
                    {
                        "role": msg["role"],
                        "content": msg["content"]
                    }
                    for msg in messages
                ],
                "stream": stream,
                "options": {
                    "temperature": self.temperature
                } if self.temperature != 1.0 else {}
            }
        elif self.provider in [APIProvider.SILICONFLOW, APIProvider.DEEPSEEK]:
            data = {
                "model": self.model,
                "messages": messages,
                "stream": stream
            }
            if self.max_tokens:
                data["max_tokens"] = self.max_tokens
            if self.temperature != 1.0:
                data["temperature"] = self.temperature
            return data
        else:
            # OpenAI 格式作为默认格式
            data = {
                "model": self.model,
                "messages": messages,
                "temperature": self.temperature,
                "stream": stream
            }
            if self.max_tokens:
                data["max_tokens"] = self.max_tokens
            return data

    @retry_with_exponential_backoff()
    def _normal_request(self, data: Dict) -> str:
        """发送普通请求"""
        try:
            response = requests.post(
                url=self._get_api_url(),
                headers=self._get_headers(),
                json=data,
                timeout=self.timeout
            )
            
            # 记录请求和响应信息
            logger.debug(f"Request URL: {self._get_api_url()}")
            logger.debug(f"Request Headers: {self._get_headers()}")
            logger.debug(f"Request Data: {json.dumps(data, ensure_ascii=False)}")
            logger.debug(f"Response Status: {response.status_code}")
            logger.debug(f"Response Headers: {response.headers}")
            
            # 检查响应状态码
            if response.status_code != 200:
                error_msg = f"API请求失败: HTTP {response.status_code}"
                try:
                    error_detail = response.json()
                    error_msg += f" - {error_detail.get('error', {}).get('message', '')}"
                except:
                    error_msg += f" - {response.text}"
                logger.error(error_msg)
                raise ValueError(error_msg)
            
            # 检查响应内容是否为空
            if not response.text.strip():
                error_msg = "API返回了空响应"
                logger.error(error_msg)
                raise ValueError(error_msg)
            
            # 记录原始响应
            logger.debug(f"Response Text: {response.text}")
            
            try:
                response_json = response.json()
            except json.JSONDecodeError as e:
                error_msg = f"JSON解析错误: {str(e)}\n响应内容: {response.text}"
                logger.error(error_msg)
                raise ValueError(error_msg)
            
            # 检查响应格式
            if not isinstance(response_json, dict):
                error_msg = f"响应格式错误: 预期为字典类型,实际为 {type(response_json)}"
                logger.error(error_msg)
                raise ValueError(error_msg)
            
            if "choices" not in response_json:
                error_msg = "响应缺少 'choices' 字段"
                logger.error(error_msg)
                raise ValueError(error_msg)
            
            if not response_json["choices"]:
                error_msg = "'choices' 数组为空"
                logger.error(error_msg)
                raise ValueError(error_msg)
            
            if self.provider == APIProvider.MINIMAX:
                return response_json["choices"][0]["message"]["content"]
            elif self.provider == APIProvider.DASHSCOPE:
                return response_json["output"]["choices"][0]["message"]["content"]
            elif self.provider in [APIProvider.DEEPSEEK, APIProvider.SILICONFLOW]:
                # 对于 Deepseek 和 Siliconflow，我们返回 content，但也记录 reasoning_content
                message = response_json["choices"][0]["message"]
                if not isinstance(message, dict):
                    error_msg = f"Deepseek或Siliconflow响应message格式错误: {message}"
                    logger.error(error_msg)
                    raise ValueError(error_msg)
                
                self._last_reasoning_content = message.get("reasoning_content", "")
                content = message.get("content")
                if content is None:
                    error_msg = "Deepseek或Siliconflow响应缺少content字段"
                    logger.error(error_msg)
                    raise ValueError(error_msg)
                return content
            
            return response_json["choices"][0]["message"]["content"]
            
        except requests.exceptions.Timeout:
            error_msg = f"请求超时(超过{self.timeout}秒)"
            logger.error(error_msg)
            raise
        except requests.exceptions.RequestException as e:
            error_msg = f"请求错误: {str(e)}"
            logger.error(error_msg)
            raise
        except Exception as e:
            error_msg = f"未预期的错误: {str(e)}"
            logger.error(error_msg)
            raise

    @retry_with_exponential_backoff()
    def _stream_request(self, data: Dict) -> Generator[Dict[str, str], None, None]:
        """发送流式请求"""
        response = requests.post(
            self._get_api_url(),
            headers=self._get_headers(),
            json=data,
            stream=True,
            timeout=self.timeout
        )
        response.raise_for_status()
        
        if self.provider == APIProvider.DASHSCOPE:
            for line in response.iter_lines():
                if line:
                    line = line.decode('utf-8')
                    if line.startswith('data: '):
                        if line.strip() == 'data: [DONE]':
                            break
                        json_data = json.loads(line[6:])
                        if "choices" in json_data and json_data["choices"]:
                            delta = json_data["choices"][0].get("delta", {})
                            content = delta.get("content", "")
                            if content:
                                yield {"type": "content", "content": content}
        elif self.provider == APIProvider.OLLAMA:
            for line in response.iter_lines():
                if line:
                    line = line.decode('utf-8')
                    json_data = json.loads(line)
                    if json_data.get("done", False):
                        break
                    content = json_data.get("message", {}).get("content", "")
                    if content:
                        yield {"type": "content", "content": content}
        elif self.provider in [APIProvider.DEEPSEEK, APIProvider.SILICONFLOW]:
            for line in response.iter_lines():
                if line:
                    line = line.decode('utf-8')
                    if line.startswith('data: '):
                        if line.strip() == 'data: [DONE]':
                            break
                        try:
                            json_data = json.loads(line[6:])
                            if "choices" in json_data and json_data["choices"] and json_data["choices"][0]:
                                delta = json_data["choices"][0].get("delta", {})
                                reasoning_content = delta.get("reasoning_content")
                                content = delta.get("content")
                                
                                if reasoning_content:
                                    yield {"type": "reasoning", "content": reasoning_content}
                                if content:
                                    yield {"type": "content", "content": content}
                        except (json.JSONDecodeError, KeyError, TypeError) as e:
                            logger.error(f"处理响应时出错: {str(e)}\n响应内容: {line}")
                            continue
        else:
            for line in response.iter_lines():
                if line:
                    line = line.decode('utf-8')
                    if line.startswith('data: '):
                        if line.strip() == 'data: [DONE]':
                            break
                        json_data = json.loads(line[6:])
                        content = json_data["choices"][0]["delta"].get("content", "")
                        if content:
                            yield {"type": "content", "content": content}

    def get_last_reasoning_content(self) -> str:
        """获取最后一次 Deepseek 的推理内容
        
        Returns:
            str: 推理内容。如果不是 Deepseek 模型或没有推理内容，返回空字符串
        """
        return self._last_reasoning_content

    def ask(self, prompt: str, messages: Optional[List[Message]] = None, stream: Optional[bool] = None) -> Union[str, Generator[Dict[str, str], None, None]]:
        """发送请求并获取回复

        Args:
            prompt: 提示词
            messages: 可选的消息历史
            stream: 是否使用流式输出，如果为 None 则使用实例的 enable_streaming 设置

        Returns:
            Union[str, Generator[Dict[str, str], None, None]]:
            - 如果不是流式输出，返回字符串
            - 如果是流式输出，返回字典生成器，每个字典包含：
              - type: 内容类型，"content" 或 "reasoning"
              - content: 具体内容
        """
        use_stream = stream if stream is not None else self.enable_streaming
        messages_dict = self._prepare_messages(prompt, messages)
        data = self._prepare_request_data(messages_dict, use_stream)
        
        if use_stream:
            return self._stream_request(data)
        return self._normal_request(data)

# 使用示例
if __name__ == "__main__":
    def print_separator(title: str = "") -> None:
        """打印分隔线"""
        print(f"\n{'='*20} {title} {'='*20}")

    def basic_chat_example():
        """基础对话示例"""
        print_separator("基础对话示例")
        
        # 创建聊天实例 - 方式1：直接传入配置
        chat = AIChat(
            provider=APIProvider.OPENAI,
            model="gpt-3.5-turbo",
            api_key="your-api-key"
        )
        
        # 基本对话
        response = chat.ask("你好，请介绍一下自己")
        print("基本对话回复:", response)
        
        # 带系统提示词的对话
        chat.add_context("你是一个中医专家")
        response = chat.ask("头痛该怎么办？")
        print("\n专家建议:", response)
        
        # 使用消息历史
        messages = [
            Message(role="system", content="你是一个helpful助手"),
            Message(role="user", content="今天天气真好"),
            Message(role="assistant", content="是的，阳光明媚")
        ]
        response = chat.ask("我们去散步吧", messages=messages)
        print("\n带历史的对话:", response)

    def stream_chat_example():
        """流式输出示例"""
        print_separator("流式输出示例")
        
        # 创建支持流式输出的聊天实例 - 方式2：从环境变量读取配置
        chat = AIChat(
            provider=APIProvider.OPENAI,  # 会自动读取 OPENAI_API_KEY 和 OPENAI_MODEL
            enable_streaming=True
        )
        
        print("\n普通流式输出示例:")
        for chunk in chat.ask("讲一个关于人工智能的小故事"):
            print(chunk["content"], end="", flush=True)

    def deepseek_example():
        """Deepseek 模型示例"""
        print_separator("Deepseek 示例")
        
        # 创建 Deepseek 聊天实例
        chat = AIChat(
            provider=APIProvider.DEEPSEEK,
            model="deepseek-reasoner",
            enable_streaming=True
        )
        
        # 非流式请求
        print("\n非流式请求示例:")
        response = chat.ask("解释一下量子纠缠现象")
        print("回答:", response)
        print("推理过程:", chat.get_last_reasoning_content())
        
        # 流式请求
        print("\n流式请求示例:")
        reasoning_text = ""
        content_text = ""
        
        print("\n[推理过程]")
        print("-" * 50)
        for chunk in chat.ask("为什么月亮总是同一面朝向地球？"):
            if chunk["type"] == "reasoning":
                reasoning_text += chunk["content"]
                print(chunk["content"], end="", flush=True)
            else:  # type == "content"
                if content_text == "":  # 第一次输出内容时打印分隔线
                    print("\n\n[最终回答]")
                    print("-" * 50)
                content_text += chunk["content"]
                print(chunk["content"], end="", flush=True)
        print("\n")

    def error_handling_example():
        """错误处理示例"""
        print_separator("错误处理示例")
        
        try:
            # 故意使用错误的配置
            chat = AIChat(
                provider=APIProvider.OPENAI,
                model="gpt-3.5-turbo"
                # 没有提供 API key
            )
        except ValueError as e:
            print("配置错误:", e)
        
        try:
            # 使用不支持的模型类型
            chat = AIChat(
                provider=APIProvider.UNKNOWN,
                api_key="some-key"
            )
        except ValueError as e:
            print("不支持的模型类型:", e)

    def async_chat_example():
        """异步对话示例"""
        print_separator("异步对话示例")
        
        import asyncio
        
        async def process_stream():
            chat = AIChat(
                provider=APIProvider.DEEPSEEK,
                model="deepseek-reasoner",
                enable_streaming=True
            )
            
            reasoning_text = ""
            content_text = ""
            
            async for chunk in chat.ask("解释一下引力波是什么？"):
                if chunk["type"] == "reasoning":
                    reasoning_text += chunk["content"]
                    print(f"\r推理进度: {len(reasoning_text)} 字符", end="", flush=True)
                else:
                    if content_text == "":
                        print("\n开始生成回答...")
                    content_text += chunk["content"]
                    print(f"\r回答进度: {len(content_text)} 字符", end="", flush=True)
            
            print("\n\n最终推理长度:", len(reasoning_text))
            print("最终回答长度:", len(content_text))
        
        # 运行异步示例
        asyncio.run(process_stream())

    # 运行所有示例
    #basic_chat_example()
    #stream_chat_example()
    deepseek_example()
    #error_handling_example()
    #async_chat_example()