// AI模型类型枚举
const AIModelType = {
    GPT: 'gpt',
    ERNIE: 'ernie',
    QWEN: 'qwen',
    OLLAMA: 'ollama',
    GLM: 'glm',
    MINIMAX: 'minimax',
    DEEPSEEK: 'deepseek'
};

// 日志级别枚举
const LogLevel = {
    TRACE: 0,
    DEBUG: 1,
    INFO: 2,
    WARNING: 3,
    ERROR: 4,
    CRITICAL: 5
};

// 日志工具类
class Logger {
    static currentLevel = LogLevel.WARNING;

    static setLevel(level) {
        if (typeof level === 'string') {
            level = LogLevel[level.toUpperCase()];
        }
        Logger.currentLevel = level;
    }

    static _log(level, ...args) {
        if (level >= Logger.currentLevel) {
            const prefix = Object.keys(LogLevel).find(key => LogLevel[key] === level);
            console.log(`[${prefix}]`, ...args);
        }
    }

    static trace(...args) { Logger._log(LogLevel.TRACE, ...args); }
    static debug(...args) { Logger._log(LogLevel.DEBUG, ...args); }
    static info(...args) { Logger._log(LogLevel.INFO, ...args); }
    static warning(...args) { Logger._log(LogLevel.WARNING, ...args); }
    static error(...args) { Logger._log(LogLevel.ERROR, ...args); }
    static critical(...args) { Logger._log(LogLevel.CRITICAL, ...args); }
}

// 重试装饰器函数
function withRetry(func, maxRetries = 3, baseDelay = 1000, maxDelay = 10000) {
    return async function (...args) {
        let retries = 0;
        while (true) {
            try {
                return await func.apply(this, args);
            } catch (error) {
                retries++;
                if (retries > maxRetries) {
                    throw error;
                }
                const delay = Math.min(baseDelay * Math.pow(2, retries - 1), maxDelay);
                Logger.warning(`重试第 ${retries} 次，等待 ${delay}ms`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    };
}

// AI聊天API封装
class AIChat {
    constructor(config = {}) {
        this.modelType = config.modelType || AIModelType.OLLAMA;
        this.model = config.model || 'llama2';
        if (this.modelType === AIModelType.DEEPSEEK) {
            this.model = config.model || 'deepseek-chat';  // DeepSeek 默认模型
        }
        this.apiKey = config.apiKey || null;
        this.apiSecret = config.apiSecret || null;  // 用于文心一言
        this.apiUrl = config.apiUrl || this._getApiUrl();
        this.enableStreaming = config.enableStreaming || false;
        this.temperature = config.temperature || 1.0;
        this.maxTokens = config.maxTokens || null;
        this.timeout = config.timeout || 30000;
        this.retryCount = config.retryCount || 3;
        this._systemPrompt = null;
        this._context = [];
        
        // 验证配置
        this._validateConfig();

        // 使用重试装饰器包装请求方法
        this._normalRequest = withRetry(this._normalRequest.bind(this), this.retryCount);
        this._streamRequest = withRetry(this._streamRequest.bind(this), this.retryCount);
    }

    _validateConfig() {
        if (!this.model) {
            throw new Error("Model name is required");
        }
        
        // 特定模型的验证
        if (this.modelType === AIModelType.ERNIE && !this.apiSecret) {
            throw new Error("API secret is required for ERNIE model");
        }
        
        // Ollama 不需要 API key
        if (this.modelType !== AIModelType.OLLAMA && !this.apiKey) {
            throw new Error("API key is required");
        }
    }

    _getApiUrl() {
        const urls = {
            [AIModelType.GPT]: "https://api.openai.com/v1/chat/completions",
            [AIModelType.ERNIE]: "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions",
            [AIModelType.QWEN]: "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
            [AIModelType.OLLAMA]: "http://localhost:11434/api/chat",
            [AIModelType.GLM]: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
            [AIModelType.MINIMAX]: "https://api.minimax.chat/v1/chat/completions",
            [AIModelType.DEEPSEEK]: "https://api.deepseek.com/v1/chat/completions"
        };
        return urls[this.modelType];
    }

    async _getHeaders() {
        const headers = { "Content-Type": "application/json" };
        
        if ([AIModelType.GPT, AIModelType.GLM, AIModelType.MINIMAX, AIModelType.DEEPSEEK].includes(this.modelType)) {
            headers["Authorization"] = `Bearer ${this.apiKey}`;
        } else if (this.modelType === AIModelType.QWEN) {
            headers["Authorization"] = `Bearer ${this.apiKey}`;
        } else if (this.modelType === AIModelType.ERNIE) {
            // 文心一言需要先获取access token
            headers["Authorization"] = `Bearer ${await this._getErnieAccessToken()}`;
        }
        
        return headers;
    }

    async _getErnieAccessToken() {
        const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${this.apiKey}&client_secret=${this.apiSecret}`;
        const response = await fetch(url, { method: 'POST' });
        const data = await response.json();
        return data.access_token || '';
    }

    // 添加上下文消息
    addContext(content, role = "system") {
        if (role === "system") {
            if (this._systemPrompt !== null) {
                throw new Error("只能设置一个系统提示词（system prompt）");
            }
            this._systemPrompt = { role: "system", content };
        } else {
            if (!["user", "assistant"].includes(role)) {
                throw new Error("角色必须是 'system'、'user' 或 'assistant'");
            }
            this._context.push({ role, content });
        }
    }

    // 清除上下文
    clearContext(includeSystemPrompt = false) {
        this._context = [];
        if (includeSystemPrompt) {
            this._systemPrompt = null;
        }
    }

    // 准备消息列表
    _prepareMessages(prompt, messages = null) {
        const finalMessages = [];
        
        if (this._systemPrompt) {
            finalMessages.push(this._systemPrompt);
        }
        
        finalMessages.push(...this._context);
        
        if (messages) {
            finalMessages.push(...messages);
        }
        
        finalMessages.push({ role: 'user', content: prompt });
        
        return finalMessages;
    }

    // 准备请求数据
    _prepareRequestData(messages, stream = false) {
        if (this.modelType === AIModelType.QWEN) {
            const data = {
                model: this.model,
                input: { messages },
                parameters: { result_format: "message" }
            };
            if (this.maxTokens) {
                data.parameters.max_tokens = this.maxTokens;
            }
            return data;
        } else if (this.modelType === AIModelType.MINIMAX) {
            const data = {
                model: this.model,
                messages,
                temperature: this.temperature,
                stream
            };
            if (this.maxTokens) {
                data.max_tokens = this.maxTokens;
            }
            return data;
        } else if (this.modelType === AIModelType.OLLAMA) {
            return {
                model: this.model,
                messages: messages.map(msg => ({
                    role: msg.role,
                    content: msg.content
                })),
                stream,
                options: {
                    temperature: this.temperature
                }
            };
        } else {
            // GPT, GLM, DEEPSEEK 等使用标准的 OpenAI 格式
            const data = {
                model: this.model,
                messages,
                temperature: this.temperature,
                stream
            };
            if (this.maxTokens) {
                data.max_tokens = this.maxTokens;
            }
            return data;
        }
    }

    // 发送普通请求
    async _normalRequest(data) {
        Logger.debug(`POST ${this.apiUrl}`);
        Logger.trace('Request headers:', await this._getHeaders());
        Logger.trace('Request data:', data);

        const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: await this._getHeaders(),
            body: JSON.stringify(data),
            timeout: this.timeout
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        Logger.trace('Response:', result);
        
        if (this.modelType === AIModelType.MINIMAX) {
            return result.choices[0].message.content;
        } else if (this.modelType === AIModelType.QWEN) {
            return result.output.choices[0].message.content;
        } else if (this.modelType === AIModelType.OLLAMA) {
            return result.message?.content || '';
        } else {
            return result.choices[0].message.content;
        }
    }

    // 发送流式请求
    async *_streamRequest(data) {
        Logger.debug(`POST ${this.apiUrl} (streaming)`);
        Logger.trace('Request headers:', await this._getHeaders());
        Logger.trace('Request data:', data);

        const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: await this._getHeaders(),
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
                break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.trim()) {
                    try {
                        if (this.modelType === AIModelType.QWEN) {
                            if (line.startsWith('data: ')) {
                                if (line.trim() === 'data: [DONE]') break;
                                const json = JSON.parse(line.slice(6));
                                if (json.choices?.[0]?.delta?.content) {
                                    Logger.trace('Stream chunk:', json.choices[0].delta.content);
                                    yield json.choices[0].delta.content;
                                }
                            }
                        } else if (this.modelType === AIModelType.OLLAMA) {
                            const json = JSON.parse(line);
                            if (json.done) break;
                            if (json.message?.content) {
                                Logger.trace('Stream chunk:', json.message.content);
                                yield json.message.content;
                            }
                        } else {
                            if (line.startsWith('data: ')) {
                                if (line.trim() === 'data: [DONE]') break;
                                const json = JSON.parse(line.slice(6));
                                const content = json.choices[0].delta?.content;
                                if (content) {
                                    Logger.trace('Stream chunk:', content);
                                    yield content;
                                }
                            }
                        }
                    } catch (e) {
                        Logger.error('解析响应数据失败:', e);
                    }
                }
            }
        }
    }

    // 发送请求并获取回复
    async ask(prompt, messages = null, stream = null) {
        const useStream = stream !== null ? stream : this.enableStreaming;
        const messagesDict = this._prepareMessages(prompt, messages);
        const data = this._prepareRequestData(messagesDict, useStream);
        
        if (useStream) {
            return this._streamRequest(data);
        }
        return this._normalRequest(data);
    }
}

// 设置日志级别
function setLogLevel(level) {
    Logger.setLevel(level);
}

// 存储设置到本地
function saveSettings(settings) {
    localStorage.setItem('aiChatSettings', JSON.stringify(settings));
}

// 从本地获取设置
function loadSettings() {
    const settings = localStorage.getItem('aiChatSettings');
    return settings ? JSON.parse(settings) : null;
}

// 导出
if (typeof window !== 'undefined') {
    window.AIChat = AIChat;
    window.AIModelType = AIModelType;
    window.saveSettings = saveSettings;
    window.loadSettings = loadSettings;
    window.setLogLevel = setLogLevel;
} else {
    module.exports = {
        AIChat,
        AIModelType,
        saveSettings,
        loadSettings,
        setLogLevel
    };
} 