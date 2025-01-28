// 导入依赖
const { AIChat, AIModelType, setLogLevel } = require('./ai_palette');

// 存储 Ollama 模型名称
let OLLAMA_MODEL = null;

// 辅助函数：根据模型类型获取对应的 API key
function getApiKey(modelType) {
    const apiKeys = {
        'glm': 'https://open.bigmodel.cn/usercenter/proj-mgmt/apikeys',
        'qwen': 'https://bailian.console.aliyun.com/?apiKey=1',
        'minimax': 'https://platform.minimaxi.com/user-center/basic-information/interface-key',
        'gpt': 'https://platform.openai.com/api-keys',
        'ollama': ''  // Ollama 不需要 API key
    };
    return apiKeys[modelType] || '';
}

// 获取 Ollama 可用的模型列表
async function getOllamaModels() {
    if (OLLAMA_MODEL) {
        return OLLAMA_MODEL;
    }
    
    try {
        const response = await fetch('http://localhost:11434/api/tags');
        if (response.ok) {
            const data = await response.json();
            const models = data.models || [];
            if (models.length > 0) {
                OLLAMA_MODEL = models[0].name || 'llama2';
                console.log('Ollama 可用模型:', models.map(model => model.name));
                console.log('选择使用模型:', OLLAMA_MODEL);
                return OLLAMA_MODEL;
            }
        }
    } catch (e) {
        console.error('获取 Ollama 模型列表失败:', e);
    }
    OLLAMA_MODEL = 'llama2';
    return OLLAMA_MODEL;
}

// 获取模型配置
function getModelConfig(modelType) {
    const configs = {
        'glm': { model: 'GLM-4-Plus' },
        'qwen': { model: 'qwen-max' },
        'minimax': { model: 'abab5.5-chat', apiSecret: '1679552762033994' },  // group_id
        'gpt': { model: 'gpt-3.5-turbo' },
        'ollama': { model: OLLAMA_MODEL || 'llama2', apiUrl: 'http://localhost:11434/api/chat' }
    };
    return configs[modelType] || {};
}

// 测试基本对话功能
async function testBasicChat(modelType) {
    console.log(`\n=== 测试 ${modelType.toUpperCase()} 基本对话 ===`);
    const config = getModelConfig(modelType);
    const chat = new AIChat({
        modelType,
        apiKey: getApiKey(modelType),
        ...config
    });
    
    const response = await chat.ask("你好，请用一句话介绍自己");
    console.log('回复:', response);
}

// 测试流式输出功能
async function testStreamingChat(modelType) {
    console.log(`\n=== 测试 ${modelType.toUpperCase()} 流式输出 ===`);
    const config = getModelConfig(modelType);
    const chat = new AIChat({
        modelType,
        apiKey: getApiKey(modelType),
        enableStreaming: true,
        ...config
    });
    
    process.stdout.write('回复: ');
    for await (const chunk of chat.ask("讲一个简短的笑话")) {
        process.stdout.write(chunk);
    }
    console.log();
}

// 测试上下文对话功能
async function testContextChat(modelType) {
    console.log(`\n=== 测试 ${modelType.toUpperCase()} 上下文对话 ===`);
    const config = getModelConfig(modelType);
    const chat = new AIChat({
        modelType,
        apiKey: getApiKey(modelType),
        ...config
    });
    
    const messages = [];
    
    // 第一轮对话
    console.log('用户: 你好，我叫小明');
    messages.push({ role: 'user', content: '你好，我叫小明' });
    let response = await chat.ask('你好，我叫小明', messages);
    console.log('助手:', response);
    messages.push({ role: 'assistant', content: response });
    
    // 第二轮对话，应该记住用户名字
    console.log('\n用户: 你还记得我的名字吗？');
    messages.push({ role: 'user', content: '你还记得我的名字吗？' });
    response = await chat.ask('你还记得我的名字吗？', messages);
    console.log('助手:', response);
    messages.push({ role: 'assistant', content: response });
    
    // 第三轮对话，继续上下文
    console.log('\n用户: 那你能重复一下我们刚才聊了什么吗？');
    messages.push({ role: 'user', content: '那你能重复一下我们刚才聊了什么吗？' });
    response = await chat.ask('那你能重复一下我们刚才聊了什么吗？', messages);
    console.log('助手:', response);
    
    await new Promise(resolve => setTimeout(resolve, 1000));  // 避免请求过快
}

// 测试上下文管理功能
async function testContextManagement(modelType) {
    console.log(`\n=== 测试 ${modelType.toUpperCase()} 上下文管理 ===`);
    const config = getModelConfig(modelType);
    const chat = new AIChat({
        modelType,
        apiKey: getApiKey(modelType),
        ...config
    });
    
    // 测试添加系统提示词
    console.log('1. 测试系统提示词:');
    chat.addContext('你是一个专业的Python导师', 'system');
    const response1 = await chat.ask('Python适合初学者吗？');
    console.log('回复:', response1);
    
    // 测试添加用户消息
    console.log('\n2. 测试添加用户消息:');
    chat.addContext('我想学习Python', 'user');
    chat.addContext('很好，Python是一个很好的选择。我们从基础开始吧。', 'assistant');
    const response2 = await chat.ask('我应该从哪里开始？');
    console.log('回复:', response2);
    
    // 测试清除上下文
    console.log('\n3. 测试清除上下文:');
    chat.clearContext();
    const response3 = await chat.ask('还记得我们刚才在聊什么吗？');
    console.log('回复:', response3);
    
    // 测试重复添加系统提示词（应该抛出异常）
    console.log('\n4. 测试重复添加系统提示词:');
    try {
        chat.addContext('你是一个数学老师', 'system');
        chat.addContext('你是一个英语老师', 'system');
    } catch (e) {
        console.log('预期的错误:', e.message);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));  // 避免请求过快
}

// 主测试函数
async function main() {
    // 设置日志级别为 DEBUG
    setLogLevel('DEBUG');
    
    // 初始化 Ollama 模型
    await getOllamaModels();
    
    // 要测试的模型列表
    const models = ['glm', 'qwen', 'minimax', 'gpt', 'ollama', 'deepseek'];  // 添加了 deepseek
    
    for (const model of models) {
        try {
            console.log(`\n${'='.repeat(20)} 测试 ${model.toUpperCase()} 模型 ${'='.repeat(20)}`);
            
            // 测试基本对话
            await testBasicChat(model);
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // 测试流式输出
            await testStreamingChat(model);
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // 测试上下文对话
            await testContextChat(model);
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // 测试上下文管理
            await testContextManagement(model);
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (e) {
            console.error(`测试 ${model} 时发生错误:`, e);
        }
    }
}

// 运行测试
if (require.main === module) {
    main().catch(console.error);
}

// 导出测试函数（方便单独运行某个测试）
module.exports = {
    testBasicChat,
    testStreamingChat,
    testContextChat,
    testContextManagement
}; 