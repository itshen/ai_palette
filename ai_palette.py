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
                    logger.warning(f"重试第 {retries} 次，等待 {delay} 秒")
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
                    logger.warning(f"重试第 {retries} 次，等待 {delay} 秒")
                    await asyncio.sleep(delay)

        return async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper
    return decorator

class HTTPClient:
    @staticmethod
    def post(url: str, headers: Dict[str, str], json: Dict[str, Any], timeout: int = 30) -> requests.Response:
        """发送同步POST请求"""
        logger.debug(f"POST {url}")
        logger.trace(f"Request headers: {headers}")
        logger.trace(f"Request data: {json}")
        response = requests.post(url, headers=headers, json=json, timeout=timeout)
        response.raise_for_status()
        logger.trace(f"Response: {response.text}")
        return response

    @staticmethod
    async def post_async(url: str, headers: Dict[str, str], json: Dict[str, Any], timeout: int = 30) -> Dict[str, Any]:
        """发送异步POST请求"""
        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, json=json, timeout=timeout) as response:
                if response.status >= 400:
                    raise aiohttp.ClientResponseError(
                        response.request_info,
                        response.history,
                        status=response.status,
                        message=await response.text()
                    )
                return await response.json()

class AIModelType(Enum):
    GPT = "gpt"
    ERNIE = "ernie"
    QWEN = "qwen"
    OLLAMA = "ollama"
    GLM = "glm"
    MINIMAX = "minimax"
    DEEPSEEK = "deepseek"

    def _get_api_url(self) -> str:
        """获取API地址"""
        if self.api_url:
            return self.api_url
            
        urls = {
            AIModelType.GPT: "https://api.openai.com/v1/chat/completions",
            AIModelType.ERNIE: "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions",
            AIModelType.QWEN: "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
            AIModelType.OLLAMA: "http://localhost:11434/api/chat",
            AIModelType.GLM: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
            AIModelType.MINIMAX: "https://api.minimax.chat/v1/chat/completions",
            AIModelType.DEEPSEEK: "https://api.deepseek.com/v1/chat/completions"
        }
        return urls[self.model_type]

    def _prepare_request_data(self, messages: List[Dict[str, str]], stream: bool = False) -> Dict:
        """准备请求数据"""
        if self.model_type == AIModelType.QWEN:
            data = {
                "model": self.model,
                "input": {"messages": messages},
                "parameters": {"result_format": "message"}
            }
            if self.max_tokens:
                data["parameters"]["max_tokens"] = self.max_tokens
            return data
        elif self.model_type == AIModelType.MINIMAX:
            data = {
                "model": self.model,
                "messages": messages,
                "temperature": self.temperature,
                "stream": stream
            }
            if self.max_tokens:
                data["max_tokens"] = self.max_tokens
            return data
        elif self.model_type == AIModelType.OLLAMA:
            # Ollama API 格式
            # https://github.com/ollama/ollama/blob/main/docs/api.md
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
        else:
            # GPT, GLM, DEEPSEEK 等使用标准的 OpenAI 格式
            data = {
                "model": self.model,
                "messages": messages,
                "temperature": self.temperature,
                "stream": stream
            }
            if self.max_tokens:
                data["max_tokens"] = self.max_tokens
            return data

@dataclass
class Message:
    role: str
    content: str

    def to_dict(self) -> Dict[str, str]:
        return {"role": self.role, "content": self.content}

class AIChat:
    def __init__(
        self,
        model_type: Union[AIModelType, str],
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        api_secret: Optional[str] = None,
        api_url: Optional[str] = None,
        enable_streaming: bool = False,
        temperature: float = 1.0,
        max_tokens: Optional[int] = None,
        timeout: int = 30,
        retry_count: int = 3
    ):
        # 如果传入的是字符串，转换为枚举
        if isinstance(model_type, str):
            model_type = AIModelType(model_type.lower())
            
        self.model_type = model_type
        
        # 从环境变量获取配置
        env_prefix = f"{model_type.value.upper()}_"
        self.api_key = api_key or os.getenv(f"{env_prefix}API_KEY")
        self.model = model or os.getenv(f"{env_prefix}MODEL")
        self.api_secret = api_secret or os.getenv(f"{env_prefix}API_SECRET")
        self.api_url = api_url or os.getenv(f"{env_prefix}API_URL")
        
        self.enable_streaming = enable_streaming
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.timeout = timeout
        self.retry_count = retry_count
        self._system_prompt = None  # 存储系统提示词
        self._context = []  # 存储其他上下文消息
        
        # 验证配置
        self._validate_config()
        
    def _validate_config(self) -> None:
        """验证配置是否有效"""
        if not self.model:
            raise ValueError("Model name is required")
            
        # 特定模型的验证
        if self.model_type == AIModelType.ERNIE and not self.api_secret:
            raise ValueError("API secret is required for ERNIE model")
            
        # Ollama 不需要 API key
        if self.model_type != AIModelType.OLLAMA and not self.api_key:
            raise ValueError("API key is required")

    def _get_api_url(self) -> str:
        """获取API地址"""
        if self.api_url:
            return self.api_url
            
        urls = {
            AIModelType.GPT: "https://api.openai.com/v1/chat/completions",
            AIModelType.ERNIE: "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions",
            AIModelType.QWEN: "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
            AIModelType.OLLAMA: "http://localhost:11434/api/chat",
            AIModelType.GLM: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
            AIModelType.MINIMAX: "https://api.minimax.chat/v1/chat/completions",
            AIModelType.DEEPSEEK: "https://api.deepseek.com/v1/chat/completions" 
        }
        return urls[self.model_type]

    def _get_headers(self) -> Dict[str, str]:
        """获取请求头"""
        headers = {"Content-Type": "application/json"}
        
        if self.model_type in [AIModelType.GPT, AIModelType.GLM, AIModelType.MINIMAX]:
            headers["Authorization"] = f"Bearer {self.api_key}"
        elif self.model_type == AIModelType.QWEN:
            headers["Authorization"] = f"Bearer {self.api_key}"
        elif self.model_type == AIModelType.ERNIE:
            # 文心一言需要先获取access token
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
        if self.model_type == AIModelType.QWEN:
            data = {
                "model": self.model,
                "input": {"messages": messages},
                "parameters": {"result_format": "message"}
            }
            if self.max_tokens:
                data["parameters"]["max_tokens"] = self.max_tokens
            return data
        elif self.model_type == AIModelType.MINIMAX:
            data = {
                "model": self.model,
                "messages": messages,
                "temperature": self.temperature,
                "stream": stream
            }
            if self.max_tokens:
                data["max_tokens"] = self.max_tokens
            return data
        elif self.model_type == AIModelType.OLLAMA:
            # Ollama API 格式
            # https://github.com/ollama/ollama/blob/main/docs/api.md
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
        else:
            # GPT, GLM, DEEPSEEK 等使用标准的 OpenAI 格式
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
        if self.model_type == AIModelType.OLLAMA:
            response = requests.post(
                url=self._get_api_url(),
                headers=self._get_headers(),
                json=data,
                timeout=self.timeout
            )
            response.raise_for_status()
            return response.json().get('message', {}).get('content', '')
        else:
            response = HTTPClient.post(
                url=self._get_api_url(),
                headers=self._get_headers(),
                json=data,
                timeout=self.timeout
            )
            
            if self.model_type == AIModelType.MINIMAX:
                return response.json()["choices"][0]["message"]["content"]
            elif self.model_type == AIModelType.QWEN:
                return response.json()["output"]["choices"][0]["message"]["content"]
            return response.json()["choices"][0]["message"]["content"]

    @retry_with_exponential_backoff()
    def _stream_request(self, data: Dict) -> Generator[str, None, None]:
        """发送流式请求"""
        response = requests.post(
            self._get_api_url(),
            headers=self._get_headers(),
            json=data,
            stream=True,
            timeout=self.timeout
        )
        response.raise_for_status()
        
        if self.model_type == AIModelType.QWEN:
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
                                yield content
        elif self.model_type == AIModelType.OLLAMA:
            for line in response.iter_lines():
                if line:
                    line = line.decode('utf-8')
                    json_data = json.loads(line)
                    if json_data.get("done", False):
                        break
                    content = json_data.get("message", {}).get("content", "")
                    if content:
                        yield content
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
                            yield content

    def ask(self, prompt: str, messages: Optional[List[Message]] = None, stream: Optional[bool] = None) -> Union[str, Generator[str, None, None]]:
        """发送请求并获取回复"""
        use_stream = stream if stream is not None else self.enable_streaming
        messages_dict = self._prepare_messages(prompt, messages)
        data = self._prepare_request_data(messages_dict, use_stream)
        
        if use_stream:
            return self._stream_request(data)
        return self._normal_request(data)

# 使用示例
if __name__ == "__main__":
    def basic_chat_example():
        # 创建聊天实例 - 方式1：直接传入配置
        chat = AIChat(
            model_type="gpt",
            api_key="your-api-key",
            model="gpt-3.5-turbo"
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
        # 创建支持流式输出的聊天实例 - 方式2：从环境变量读取配置
        chat = AIChat(
            model_type="gpt",  # 会自动读取 GPT_API_KEY 和 GPT_MODEL
            enable_streaming=True
        )
        
        print("\n流式输出示例:")
        for chunk in chat.ask("讲一个关于人工智能的小故事"):
            print(chunk, end="", flush=True)

    def minimax_chat_example():
        # 创建 MiniMax 聊天实例 - 方式3：混合配置
        chat = AIChat(
            model_type="minimax",
            model="abab5.5-chat",  # 指定模型
            # API密钥和Group ID从环境变量读取
        )
        
        # 基本对话
        response = chat.ask("你好，请介绍一下自己")
        print("\nMiniMax对话回复:", response)
        
        # 流式输出
        print("\nMiniMax流式输出示例:")
        for chunk in chat.ask("讲一个中国传统故事", stream=True):
            print(chunk, end="", flush=True)

    # 运行示例
    print("=== 基础用法示例 ===")
    basic_chat_example()
    
    print("\n=== 流式输出示例 ===")
    stream_chat_example()
    
    print("\n=== MiniMax示例 ===")
    minimax_chat_example()