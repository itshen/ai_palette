// 存储所有模型列表
let allModels = [];

window.onload = function() {
    // 检查是否是首次访问
    const hasVisited = localStorage.getItem('hasVisitedAIPalette');
    if (!hasVisited) {
        showWelcomeModal();
        localStorage.setItem('hasVisitedAIPalette', 'true');
    }

    // 恢复聊天记录
    restoreChatHistory();

    // 加载已保存的配置
    const savedConfig = JSON.parse(localStorage.getItem('aiPaletteConfig') || '{}');
    
    // 恢复模型类型
    if (savedConfig.modelType) {
        const modelTypeSelect = document.getElementById('modelType');
        modelTypeSelect.value = savedConfig.modelType;
    }
    
    // 恢复 API Key
    const modelType = document.getElementById('modelType').value;
    if (savedConfig[`${modelType}_apiKey`]) {
        document.getElementById('apiKey').value = savedConfig[`${modelType}_apiKey`];
    }
    
    // 恢复模型选择
    if (savedConfig[`${modelType}_lastModel`]) {
        document.getElementById('model').value = savedConfig[`${modelType}_lastModel`];
    }
    
    // 恢复流式输出设置
    if (savedConfig.hasOwnProperty('enableStreaming')) {
        document.getElementById('enableStreaming').checked = savedConfig.enableStreaming;
    }
    
    // 恢复主题设置
    if (savedConfig.theme) {
        toggleTheme(savedConfig.theme);
    } else {
        // 检测系统主题并设置初始状态
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            document.documentElement.classList.remove('dark');
            updateThemeButtons('light');
        } else {
            updateThemeButtons('dark');
        }
    }

    // 监听系统主题变化
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
        if (event.matches) {
            document.documentElement.classList.add('dark');
            updateThemeButtons('dark');
        } else {
            document.documentElement.classList.remove('dark');
            updateThemeButtons('light');
        }
    });

    // 确保在页面加载时更新 API Key 帮助链接
    updateApiKeyHelpLink();
    
    // 初始化代码示例
    updateCodeExamples();
    
    // 初始化前端代码示例切换
    switchCodeExample('frontend');
    
    // 设置配置监听
    setupConfigListeners();
    
    // 监听主题切换,确保代码示例样式同步
    const observer = new MutationObserver(() => {
        requestAnimationFrame(() => {
            updateCodeExamples();
        });
    });
    
    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class']
    });
    
    // 初始化后刷新模型列表
    refreshModels();
};

// 显示欢迎模态框
function showWelcomeModal() {
    const modal = document.getElementById('welcomeModal');
    modal.style.opacity = '1';
    modal.style.pointerEvents = 'auto';
    const modalContent = modal.querySelector('.scale-95');
    setTimeout(() => {
        modalContent.classList.remove('scale-95');
        modalContent.classList.add('scale-100');
    }, 10);
}

// 关闭欢迎模态框
function closeWelcomeModal() {
    const modal = document.getElementById('welcomeModal');
    const modalContent = modal.querySelector('.scale-100, .scale-95');
    if (modalContent) {
        modalContent.classList.remove('scale-100');
        modalContent.classList.add('scale-95');
    }
    setTimeout(() => {
        modal.style.opacity = '0';
        modal.style.pointerEvents = 'none';
    }, 200);
}

// 点击模态框背景关闭
document.getElementById('welcomeModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeWelcomeModal();
    }
});

// 模型配置
const modelConfigs = {
    'openai': ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
    'ernie': ['ernie-bot', 'ernie-bot-4'],
    'dashscope': ['qwen-turbo', 'qwen-plus', 'qwen-max'],
    'zhipu': ['GLM-4-Plus', 'GLM-4-Flash'],
    'minimax': ['abab6.5-chat', 'abab7-preview'],
    'ollama': [],
    'deepseek': ['deepseek-coder', 'deepseek-chat'],
    'siliconflow': ['deepseek-ai/DeepSeek-R1', 'Qwen/Qwen2.5-7B-Instruct']
};

// 刷新模型列表
async function refreshModels() {
    const modelType = document.getElementById('modelType').value;
    const apiKey = document.getElementById('apiKey').value;
    const modelList = document.getElementById('modelList');
    const modelInput = document.getElementById('model');
    const modelDropdown = document.getElementById('modelDropdown');
    
    // 如果是双链推理，使用本地配置
    if (modelType === 'dual_chain') {
        // 从本地存储读取推理链列表
        const chains = JSON.parse(localStorage.getItem('aiPaletteChains') || '{}');
        
        // 清空当前模型列表
        allModels = [];
        modelList.innerHTML = '';
        
        // 添加所有可用的推理链到下拉列表
        Object.entries(chains).forEach(([chainId, chain]) => {
            allModels.push(chain.title);
            const option = document.createElement('div');
            option.className = 'px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer';
            option.textContent = chain.title;
            option.onclick = () => {
                modelInput.value = chain.title;
                modelDropdown.classList.add('hidden');
                
                // 保存选择
                const config = JSON.parse(localStorage.getItem('aiPaletteConfig') || '{}');
                config[`${modelType}_lastModel`] = chain.id;
                localStorage.setItem('aiPaletteConfig', JSON.stringify(config));
                
                // 更新代码示例
                updateCodeExamples();
            };
            modelList.appendChild(option);
        });
        
        modelInput.placeholder = '选择推理链';
        if (Object.keys(chains).length > 0) {
            modelDropdown.classList.remove('hidden');
        } else {
            modelInput.placeholder = '暂无可用的推理链';
        }
        return;
    }
    
    // 其他模型提供商的处理逻辑
    try {
        const response = await fetch(`/api/models?type=${modelType}&api_key=${apiKey}`);
        const data = await response.json();
        
        if (data.success) {
            allModels = data.models;
            modelList.innerHTML = '';
            
            if (allModels.length > 0) {
                allModels.forEach(model => {
                    const option = document.createElement('div');
                    option.className = 'px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer';
                    option.textContent = model;
                    option.onclick = () => {
                        modelInput.value = model;
                        modelDropdown.classList.add('hidden');
                        
                        // 保存选择
                        const config = JSON.parse(localStorage.getItem('aiPaletteConfig') || '{}');
                        config[`${modelType}_lastModel`] = model;
                        localStorage.setItem('aiPaletteConfig', JSON.stringify(config));
                        
                        // 更新代码示例
                        updateCodeExamples();
                    };
                    modelList.appendChild(option);
                });
                
                modelInput.placeholder = '选择或输入模型名称';
                modelDropdown.classList.remove('hidden');
            }
        } else {
            showError(data.error || '获取模型列表失败');
            modelInput.placeholder = '获取模型失败';
        }
    } catch (error) {
        showError('网络错误，请稍后重试');
        modelInput.placeholder = '获取模型失败';
    }
}

// 修改过滤模型列表函数
function filterModels(query) {
    const dropdown = document.getElementById('modelDropdown');
    const modelList = document.getElementById('modelList');
    
    if (!allModels || allModels.length === 0) {
        refreshModels();
        return;
    }
    
    const filteredModels = allModels.filter(model => 
        model.toLowerCase().includes(query.toLowerCase())
    );
    
    // 更新模型列表显示
    modelList.innerHTML = '';
    
    if (filteredModels.length === 0) {
        const noModels = document.createElement('div');
        noModels.className = 'px-4 py-2 dark:text-slate-400 text-slate-500 text-center';
        noModels.textContent = '没有匹配的模型';
        modelList.appendChild(noModels);
    } else {
        filteredModels.forEach(model => {
            const option = document.createElement('div');
            option.className = 'px-4 py-2 dark:hover:bg-slate-600 hover:bg-slate-100 cursor-pointer dark:text-slate-200 text-slate-700';
            option.textContent = model;
            option.onclick = () => {
                document.getElementById('model').value = model;
                dropdown.classList.add('hidden');
                
                // 保存选择
                const modelType = document.getElementById('modelType').value;
                const config = JSON.parse(localStorage.getItem('aiPaletteConfig') || '{}');
                config[`${modelType}_lastModel`] = model;
                localStorage.setItem('aiPaletteConfig', JSON.stringify(config));
                
                // 更新代码示例
                updateCodeExamples();
            };
            modelList.appendChild(option);
        });
    }
    
    // 显示下拉框
    dropdown.classList.remove('hidden');
}

// 修改显示模型下拉列表函数
function showModelDropdown() {
    const dropdown = document.getElementById('modelDropdown');
    const modelInput = document.getElementById('model');
    
    // 如果还没有模型列表数据，先获取
    if (allModels.length === 0) {
        refreshModels();
    } else {
        // 显示所有模型
        filterModels(modelInput.value);
    }
}

// 更新模型列表显示
function updateModelList(models) {
    const modelList = document.getElementById('modelList');
    modelList.innerHTML = '';
    
    if (models.length === 0) {
        const noModels = document.createElement('div');
        noModels.className = 'px-4 py-2 dark:text-slate-400 text-slate-500 text-center';
        noModels.textContent = '没有可用的模型';
        modelList.appendChild(noModels);
        return;
    }
    
    models.forEach(model => {
        const option = document.createElement('div');
        option.className = 'px-4 py-2 dark:hover:bg-slate-600 hover:bg-slate-100 cursor-pointer dark:text-slate-200 text-slate-700';
        option.textContent = model;
        option.onclick = () => {
            document.getElementById('model').value = model;
            document.getElementById('modelDropdown').classList.add('hidden');
            
            // 保存选择
            const modelType = document.getElementById('modelType').value;
            const config = JSON.parse(localStorage.getItem('aiPaletteConfig') || '{}');
            config[`${modelType}_lastModel`] = model;
            localStorage.setItem('aiPaletteConfig', JSON.stringify(config));
        };
        modelList.appendChild(option);
    });
}

// 显示错误信息
function showError(message) {
    // 创建错误提示
    const errorDiv = document.createElement('div');
    errorDiv.className = 'fixed top-4 right-4 flex w-full max-w-md items-start justify-between rounded-xl dark:bg-slate-800 bg-white p-4 shadow-xl border dark:border-slate-700 border-slate-200 z-[100]';
    errorDiv.innerHTML = `
        <div class="flex gap-2 sm:gap-4">
            <span class="text-red-500">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none">
                    <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"></path>
                    <path d="M12 9v4"></path>
                    <path d="M12 16v.01"></path>
                </svg>
            </span>
            <div class="flex-1">
                <strong class="block font-medium dark:text-slate-200 text-slate-900">错误</strong>
                <p class="mt-1 text-sm dark:text-slate-300 text-slate-600">${message}</p>
            </div>
        </div>
        <button onclick="this.parentElement.remove()" class="dark:text-slate-400 text-slate-500 dark:hover:text-slate-300 hover:text-slate-700">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none">
                <path d="M18 6l-12 12"></path>
                <path d="M6 6l12 12"></path>
            </svg>
        </button>
    `;
    document.body.appendChild(errorDiv);
    
    // 添加进入动画
    errorDiv.style.opacity = '0';
    errorDiv.style.transform = 'translateY(-20px)';
    errorDiv.style.transition = 'all 0.3s ease-out';
    
    // 强制重绘
    errorDiv.offsetHeight;
    
    // 显示
    errorDiv.style.opacity = '1';
    errorDiv.style.transform = 'translateY(0)';
    
    // 3秒后自动消失
    setTimeout(() => {
        errorDiv.style.opacity = '0';
        errorDiv.style.transform = 'translateY(-20px)';
        setTimeout(() => errorDiv.remove(), 300);
    }, 3000);
}

// 修改处理模型类型变化的函数
async function handleModelTypeChange() {
    const modelType = document.getElementById('modelType').value;
    const apiKeyInput = document.getElementById('apiKey');
    const modelInput = document.getElementById('model');
    
    // 清空模型选择
    modelInput.innerHTML = '';
    modelInput.value = '';
    
    // 更新帮助链接
    updateApiKeyHelpLink();
    
    // 从本地存储获取该模型类型的上次配置
    const savedConfig = JSON.parse(localStorage.getItem('aiPaletteConfig') || '{}');
    
    // 如果是双链推理，使用本地配置
    if (modelType === 'dual_chain') {
        // 禁用 API Key 输入
        apiKeyInput.value = '';
        apiKeyInput.disabled = true;
        
        // 从本地存储读取推理链列表
        const chains = JSON.parse(localStorage.getItem('aiPaletteChains') || '{}');
        
        // 恢复上次选择的推理链
        if (savedConfig.dual_chain_lastModel) {
            const selectedChain = Object.values(chains).find(chain => chain.id === savedConfig.dual_chain_lastModel);
            if (selectedChain) {
                modelInput.value = selectedChain.title;
            }
        }
    } else {
        // 启用 API Key 输入
        apiKeyInput.disabled = false;
        // 恢复上次使用的 API Key
        apiKeyInput.value = savedConfig[`${modelType}_apiKey`] || '';
        // 恢复上次使用的模型
        modelInput.value = savedConfig[`${modelType}_lastModel`] || '';
    }
    
    // 刷新模型列表
    refreshModels();
    
    // 保存配置并更新代码示例
    saveConfig();
    requestAnimationFrame(() => {
        updateCodeExamples();
    });
}

function loadDualChainModels() {
    const modelSelect = document.getElementById('model');
    const chains = document.querySelectorAll('.chain-item');
    
    // 清空并添加所有可用的推理链
    modelSelect.innerHTML = '';
    chains.forEach(chain => {
        const chainId = chain.getAttribute('data-chain-id');
        const chainName = chain.querySelector('.chain-name').textContent;
        const option = document.createElement('option');
        option.value = chainId;
        option.textContent = chainName;
        modelSelect.appendChild(option);
    });
    
    if (chains.length === 0) {
        modelSelect.innerHTML = '<option value="">暂无可用的推理链</option>';
    }
}

// 点击页面其他地方时隐藏下拉框
document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('modelDropdown');
    const modelInput = document.getElementById('model');
    const refreshButton = modelInput.nextElementSibling;
    
    if (!modelInput.contains(e.target) && !refreshButton.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.add('hidden');
    }
});

// 监听模型输入框点击事件
document.getElementById('model').addEventListener('click', function() {
    if (allModels.length > 0) {
        filterModels(this.value);
    }
});

// 保存配置
function saveConfig() {
    const modelType = document.getElementById('modelType').value;
    const currentModel = document.getElementById('model').value;
    const currentApiKey = document.getElementById('apiKey').value;
    const enableStreaming = document.getElementById('enableStreaming').checked;
    
    const config = JSON.parse(localStorage.getItem('aiPaletteConfig') || '{}');
    
    config.modelType = modelType;
    config[`${modelType}_apiKey`] = currentApiKey;
    config[`${modelType}_lastModel`] = currentModel;
    config.enableStreaming = enableStreaming;
    
    localStorage.setItem('aiPaletteConfig', JSON.stringify(config));
}

// 切换 API Key 显示/隐藏
function toggleApiKeyVisibility() {
    const apiKeyInput = document.getElementById('apiKey');
    apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
}

// 更新 API Key 帮助链接
function updateApiKeyHelpLink() {
    const modelType = document.getElementById('modelType').value || 'siliconflow';  // 添加默认值
    const helpLink = document.getElementById('apiKeyHelp');
    
    const helpLinks = {
        'openai': 'https://platform.openai.com/api-keys',
        'ernie': 'https://console.bce.baidu.com/qianfan/overview',
        'dashscope': 'https://bailian.console.aliyun.com/?apiKey=1',
        'zhipu': 'https://open.bigmodel.cn/usercenter/apikeys',
        'minimax': 'https://platform.minimaxi.com/user-center/basic-information/interface-key',
        'ollama': 'https://ollama.com',
        'deepseek': 'https://platform.deepseek.com/',
        'siliconflow': 'https://cloud.siliconflow.cn/i/gQhQNfpv'
    };
    
    helpLink.href = helpLinks[modelType] || helpLinks['siliconflow'];  // 添加默认值
    helpLink.style.display = (modelType === 'ollama') ? 'none' : 'inline-block';
}

// 修改 escapeHtml 函数
function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/[&<>"']/g, function(match) {
        const escape = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return escape[match];
    });
}

// 修改 parseMarkdown 函数
function parseMarkdown(text) {
    if (!text) return '';
    
    // 先转义 HTML
    text = escapeHtml(text);

    // 连续两个的换行改成一个
    text = text.replace(/\n\n/g, '\n');
    
    // 处理加粗 **text**
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // 处理标题 ### text
    text = text.replace(/^###### (.*?)$/gm, '<h6 class="text-sm font-bold my-3">$1</h6>');
    text = text.replace(/^##### (.*?)$/gm, '<h5 class="text-base font-bold my-3">$1</h5>');
    text = text.replace(/^#### (.*?)$/gm, '<h4 class="text-lg font-bold my-3">$1</h4>');
    text = text.replace(/^### (.*?)$/gm, '<h3 class="text-xl font-bold my-3">$1</h3>');
    text = text.replace(/^## (.*?)$/gm, '<h2 class="text-2xl font-bold my-3">$1</h2>');
    text = text.replace(/^# (.*?)$/gm, '<h1 class="text-3xl font-bold my-4">$1</h1>');
    
    // 处理列表 - text
    text = text.replace(/^- (.*?)$/gm, '<li class="ml-4">$1</li>');
    
    // 处理分隔线 ---
    text = text.replace(/^---$/gm, '<hr class="my-4 border-t dark:border-slate-700 border-slate-200">');
    
    // 处理代码块
    text = text.replace(/```(.*?)\n([\s\S]*?)```/g, function(match, lang, code) {
        return `<pre class="bg-slate-100 dark:bg-slate-800 rounded-lg p-3 my-2"><code class="language-${lang}">${code}</code></pre>`;
    });
    
    // 处理行内代码
    text = text.replace(/`([^`]+)`/g, '<code class="bg-slate-100 dark:bg-slate-800 px-1 rounded">$1</code>');
    
    // 处理换行，保持原有的换行
    text = text.split('\n').map(line => {
        if (!line.startsWith('<') && line.trim() !== '') {
            return `<p class="mb-2 inline-block">${line}</p>`;  // 增加更多高度
        }
        return line;
    }).join('\n');
    
    return text;
}

// 发送消息
async function sendMessage() {
    const messageList = document.getElementById('messageList');
    const prompt = document.getElementById('prompt').value;
    const modelType = document.getElementById('modelType').value;
    const apiKey = document.getElementById('apiKey').value;
    const model = document.getElementById('model').value;
    const enableStreaming = document.getElementById('enableStreaming').checked;

    if (!prompt) return;

    // 隐藏建议框
    const suggestionBox = document.getElementById('suggestionBox');
    if (suggestionBox) {
        suggestionBox.remove();  // 完全移除建议框
    }

    // 清除全局变量
    window.currentResponse = '';
    window.currentReasoning = '';
    window.isThinking = false;

    // 保存配置
    saveConfig();

    // 收集上下文
    let context = [];
    // 如果是重新发起的对话，使用保存的上下文
    if (window.reaskContext) {
        context = window.reaskContext;
        window.reaskContext = null;  // 使用后清除
    } else {
        // 正常收集上下文
        const messages = messageList.children;
        for (const message of messages) {
            if (message.querySelector('.bg-blue-600')) {  // 用户消息
                const pElement = message.querySelector('p');
                context.push({
                    role: 'user',
                    content: pElement.dataset.originalContent || pElement.textContent.replace(/<br\s*\/?>/g, '\n')
                });
            } else if (message.querySelector('.bg-purple-600')) {  // AI 消息
                const responseElement = message.querySelector('pre');
                if (responseElement && responseElement.textContent && responseElement.textContent !== '...') {
                    context.push({
                        role: 'assistant',
                        content: responseElement.dataset.originalContent || responseElement.textContent.replace(/<br\s*\/?>/g, '\n')
                    });
                }
            }
        }
    }

    // 添加用户消息
    const userMessage = document.createElement('div');
    userMessage.className = 'flex items-start space-x-3 mb-4';
    // 先转义内容，再将换行符转换为 <br/>
    const escapedContent = escapeHtml(prompt);
    const displayContent = escapedContent.replace(/\n/g, '<br/>');
    userMessage.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 text-white">U</div>
        <div class="flex-1 dark:bg-slate-800 bg-white rounded-lg p-4 dark:border-slate-700 border-slate-200 border">
            <p class="dark:text-slate-200 text-slate-700" data-original-content="${escapeHtml(prompt)}">${displayContent}</p>
        </div>
    `;

    // 保存用户消息到聊天记录
    const messages = JSON.parse(localStorage.getItem('aiPaletteChatHistory') || '[]');
    messages.push({
        type: 'user',
        content: prompt  // 保存原始内容
    });
    localStorage.setItem('aiPaletteChatHistory', JSON.stringify(messages));

    messageList.appendChild(userMessage);

    // 添加 AI 回复容器
    const aiMessage = addAIMessage(prompt);
    messageList.appendChild(aiMessage);

    // 清空输入框
    document.getElementById('prompt').value = '';
    // 发送请求
    try {
        // 判断是否使用双链推理
        const isChainThinking = modelType === 'dual_chain';
        const endpoint = isChainThinking ? '/api/chain_chat' : '/api/chat';
        console.log('当前选择的模型类型:', modelType);
        console.log('使用的接口endpoint:', endpoint);

        let requestBody = {
            enable_streaming: enableStreaming,
            context: context
        };

        if (isChainThinking) {
            // 从本地存储获取当前选中的推理链配置
            const chains = JSON.parse(localStorage.getItem('aiPaletteChains') || '{}');
            const config = JSON.parse(localStorage.getItem('aiPaletteConfig') || '{}');
            const selectedChainTitle = config.dual_chain_lastModel;
            
            console.log('当前配置:', config);
            console.log('所有推理链:', chains);
            console.log('当前选中的推理链标题:', selectedChainTitle);
            
            // 通过标题查找对应的推理链
            const chainId = Object.keys(chains).find(id => chains[id].title === selectedChainTitle);
            console.log('找到的推理链ID:', chainId);
            
            if (!chainId || !chains[chainId]) {
                console.log('推理链检查失败:', {
                    hasChainId: !!chainId,
                    chainExists: chainId ? !!chains[chainId] : false,
                    selectedTitle: selectedChainTitle,
                    availableTitles: Object.values(chains).map(c => c.title)
                });
                throw new Error('请先选择或创建一个推理链');
            }
            
            const chainData = chains[chainId];
            console.log('获取到的推理链数据:', chainData);
            
            // 双链推理的参数
            Object.assign(requestBody, {
                query: prompt,
                thinkingConfig: chainData.thinkingConfig || {
                    modelType: modelType,
                    apiKey: apiKey,
                    model: model
                },
                resultConfig: chainData.resultConfig || {
                    modelType: modelType,
                    apiKey: apiKey,
                    model: model
                },
                thinkingPrompt: chainData.thinkingPrompt || '[$query$]',
                resultPrompt: chainData.resultPrompt || '[$thought$]\n[$query$]',
                use_reasoning_field: true
            });
        } else {
            // 普通对话的参数
            Object.assign(requestBody, {
                model_type: modelType,
                api_key: apiKey,
                model: model,
                prompt: prompt,
                include_reasoning: true
            });
        }

        // 发送请求并处理响应
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        if (enableStreaming) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            const responseElement = aiMessage.querySelector('pre');
            const reasoningElement = aiMessage.querySelector('div[id^="ai-reasoning"]');
            responseElement.textContent = '';
            window.currentResponse = '';  // 清除缓存

            while (true) {
                const {value, done} = await reader.read();
                if (done) {
                    // 移除呼吸灯效果
                    document.querySelector('button[type="submit"]').classList.remove('breathing-button');
                    saveChatHistory();
                    break;
                }

                const text = decoder.decode(value);
                const lines = text.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            
                            // 处理不同类型的消息
                            if (data.type === 'reasoning') {
                                // 如果还没有思考容器,创建一个
                                if (!reasoningElement.querySelector('.reasoning-content')) {
                                    reasoningElement.innerHTML = `
                                        <div class="text-slate-400">
                                            <div class="flex items-center cursor-pointer hover:text-slate-300 transition-colors duration-200" onclick="toggleReasoning(this)">
                                                <svg class="w-4 h-4 mr-1 reasoning-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="transform: rotate(90deg)">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                                                </svg>
                                                <span class="thinking-label">思考过程</span>
                                            </div>
                                            <div class="pl-5 mt-2 reasoning-content" style="height: auto; transition: height 0.3s">
                                                <div class="whitespace-pre-wrap text-slate-400"></div>
                                            </div>
                                        </div>`;
                                }
                                
                                // 添加内容
                                const reasoningContent = reasoningElement.querySelector('.reasoning-content');
                                const reasoningDiv = reasoningContent.querySelector('div');
                                const text = data.content;
                                // 累积推理内容
                                if (!window.currentReasoning) window.currentReasoning = '';
                                window.currentReasoning += text;
                                // 保存原始内容
                                reasoningDiv.dataset.originalContent = window.currentReasoning;
                                // 应用 markdown 解析
                                reasoningDiv.innerHTML = parseMarkdown(window.currentReasoning);
                            } else if (data.type === 'content') {
                                // 如果是<think>且没有思考容器,创建一个
                                if (data.content === '<think>' && !reasoningElement.querySelector('.reasoning-content')) {
                                    reasoningElement.innerHTML = `
                                        <div class="text-slate-400">
                                            <div class="flex items-center cursor-pointer hover:text-slate-300 transition-colors duration-200" onclick="toggleReasoning(this)">
                                                <svg class="w-4 h-4 mr-1 reasoning-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="transform: rotate(90deg)">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                                                </svg>
                                                <span class="thinking-label">思考过程</span>
                                            </div>
                                            <div class="pl-5 mt-2 reasoning-content" style="height: auto; transition: height 0.3s">
                                                <div class="whitespace-pre-wrap text-slate-400"></div>
                                            </div>
                                        </div>`;
                                    window.isThinking = true;
                                }
                                // 如果是</think>,收起思考过程
                                else if (data.content === '</think>') {
                                    window.isThinking = false;
                                }
                                // 如果在思考过程中,内容添加到思考过程中
                                else if (window.isThinking && reasoningElement.querySelector('.reasoning-content')) {
                                    const reasoningContent = reasoningElement.querySelector('.reasoning-content');
                                    const reasoningDiv = reasoningContent.querySelector('div');
                                    const text = data.content;
                                    // 累积推理内容
                                    if (!window.currentReasoning) window.currentReasoning = '';
                                    window.currentReasoning += text;
                                    // 应用 markdown 解析
                                    reasoningDiv.innerHTML = parseMarkdown(window.currentReasoning);
                                }
                                // 其他情况,显示在响应区域
                                else {
                                    // 停止思考标签的动画
                                    const thinkingLabel = reasoningElement.querySelector('.thinking-label');
                                    if (thinkingLabel) {
                                        thinkingLabel.classList.add('thinking-done');
                                    }
                                    // 收到内容时就直接将连续换行符替换为单个换行符
                                    const content = data.content.replace(/\n\n/g, '\n');
                                    window.currentResponse = (window.currentResponse || '') + content;
                                    
                                    // 保存原始内容
                                    responseElement.dataset.originalContent = window.currentResponse;
                                    
                                    // 尝试解析整个内容的markdown
                                    try {
                                        responseElement.innerHTML = parseMarkdown(window.currentResponse);
                                    } catch (e) {
                                        // 如果解析失败，至少显示转义后的原始内容
                                        responseElement.innerHTML = escapeHtml(window.currentResponse);
                                    }
                                }
                            }
                        } catch (e) {
                            console.error('解析响应失败:', e);
                        }
                    }
                }
            }
        } else {
            const data = await response.json();
            const responseElement = aiMessage.querySelector('pre');
            const reasoningElement = aiMessage.querySelector('div[id^="ai-reasoning"]');
            
            if (data.success) {
                // 保存原始内容
                responseElement.dataset.originalContent = data.response;
                // 设置显示内容
                responseElement.innerHTML = parseMarkdown(data.response);
                if (data.reasoning) {
                    reasoningElement.innerHTML = `
                        <div class="text-slate-400">
                            <div class="flex items-center cursor-pointer hover:text-slate-300 transition-colors duration-200" onclick="toggleReasoning(this)">
                                <svg class="w-4 h-4 mr-1 reasoning-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="transform: rotate(90deg)">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                                </svg>
                                思考过程
                            </div>
                            <div class="pl-5 mt-2 reasoning-content" style="height: auto">
                                <div class="whitespace-pre-wrap text-slate-400" data-original-content="${escapeHtml(data.reasoning)}">${parseMarkdown(data.reasoning)}</div>
                            </div>
                        </div>`;
                } else {
                    reasoningElement.remove();
                }
                // 在成功时保存聊天记录
                saveChatHistory();
            } else {
                responseElement.textContent = '错误: ' + data.error;
                responseElement.classList.add('text-red-500');
                reasoningElement.remove();
            }
        }
    } catch (error) {
        // 移除呼吸灯效果
        document.querySelector('button[type="submit"]').classList.remove('breathing-button');
        const responseElement = aiMessage.querySelector('pre');
        responseElement.textContent = '请求失败: ' + error.message;
        responseElement.classList.add('text-red-500');
    }
}

// 监听回车键发送消息
document.getElementById('prompt').addEventListener('keydown', function(e) {
    // 如果正在使用输入法（IME），不处理回车事件
    if (e.isComposing || e.keyCode === 229) {
        return;
    }
    
    // 如果按下的是回车键，但同时按着 Shift 键，则允许换行
    if (e.key === 'Enter' && e.shiftKey) {
        return;
    }
    
    // 如果按下的是回车键
    if (e.key === 'Enter') {
        // 阻止默认的换行行为
        e.preventDefault();
        
        // 获取当前输入的内容
        const content = this.value.trim();
        
        // 如果内容为空，或者内容只包含换行符，则不发送
        if (!content || content.length === 0) {
            return;
        }
        
        // 如果最后一次按键到现在的时间小于 500ms，则不发送
        // 这可以防止用户在快速输入时意外触发发送
        if (this.lastKeyTime && Date.now() - this.lastKeyTime < 500) {
            return;
        }
        
        // 记录这次按键的时间
        this.lastKeyTime = Date.now();
        
        // 发送消息
        sendMessage();
    }
});

// 处理 API Key 变化
function handleApiKeyChange() {
    const modelType = document.getElementById('modelType').value;
    const apiKey = document.getElementById('apiKey').value;
    
    // 保存到本地存储
    const config = JSON.parse(localStorage.getItem('aiPaletteConfig') || '{}');
    config[`${modelType}_apiKey`] = apiKey;
    localStorage.setItem('aiPaletteConfig', JSON.stringify(config));
    
    // 更新代码示例
    requestAnimationFrame(() => {
        updateCodeExamples();
    });
    
    // 刷新模型列表
    if (modelType === 'ollama' || ['openai', 'dashscope', 'deepseek', 'siliconflow'].includes(modelType)) {
        refreshModels();
    }
}

// 修改折叠/展开功能
function toggleReasoning(element) {
    const content = element.nextElementSibling;
    const arrow = element.querySelector('.reasoning-arrow');
    
    if (content.style.height === '0px' || content.style.height === '0') {
        content.style.height = content.scrollHeight + 'px';
        arrow.style.transform = 'rotate(90deg)';
        // 设置一个延时，等过渡动画完成后设置为 auto
        setTimeout(() => {
            content.style.height = 'auto';
        }, 300);
    } else {
        // 先设置为具体高度，以便动画
        content.style.height = content.scrollHeight + 'px';
        // 强制重绘
        content.offsetHeight;
        // 然后设置为 0
        content.style.height = '0';
        arrow.style.transform = 'rotate(0deg)';
    }
    
    // 保存状态
    saveChatHistory();
}

// 修改重新发起对话函数
function reaskQuestion(button) {
    const aiMessage = button.closest('.flex.items-start');
    const userMessage = aiMessage.previousElementSibling;
    const pElement = userMessage.querySelector('p');
    // 使用原始内容，如果没有则回退到显示内容
    const prompt = pElement.dataset.originalContent || pElement.innerHTML.replace(/<br\s*\/?>/g, '\n');
    
    // 收集之前的所有对话内容
    const messageList = document.getElementById('messageList');
    const context = [];
    const messages = messageList.children;
    
    // 遍历到当前消息为止的所有消息
    for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        // 如果到达当前用户消息，就停止
        if (message === userMessage) {
            break;
        }
        
        if (message.querySelector('.bg-blue-600')) {  // 用户消息
            const pElement = message.querySelector('p');
            context.push({
                role: 'user',
                content: pElement.dataset.originalContent || pElement.innerHTML.replace(/<br\s*\/?>/g, '\n')
            });
        } else if (message.querySelector('.bg-purple-600')) {  // AI 消息
            const responseElement = message.querySelector('pre');
            // 使用 dataset.originalContent 获取原始内容，如果没有则使用 textContent
            const content = responseElement.dataset.originalContent || responseElement.textContent;
            if (content && content !== '...') {
                context.push({
                    role: 'assistant',
                    content: content
                });
            }
        }
    }
    
    // 设置输入框内容
    document.getElementById('prompt').value = prompt;
    
    // 移除当前的 AI 回复和用户消息
    aiMessage.remove();
    userMessage.remove();
    
    // 更新本地存储的聊天记录
    const storedMessages = JSON.parse(localStorage.getItem('aiPaletteChatHistory') || '[]');
    // 移除最后两条消息（当前的用户消息和AI回复）
    storedMessages.splice(-2, 2);
    localStorage.setItem('aiPaletteChatHistory', JSON.stringify(storedMessages));
    
    // 清除之前的推理内容
    window.currentReasoning = '';
    
    // 保存上下文到全局变量，供sendMessage使用
    window.reaskContext = context;
    
    sendMessage();
}

// 清空全部对话
function clearAllMessages() {
    if (confirm('确定要清空全部对话吗？')) {
        // 清空本地存储中的聊天记录
        localStorage.removeItem('aiPaletteChatHistory');
        // 清空页面内容并显示推荐
        restoreChatHistory();
    }
}

// 修改复制响应内容函数
function copyResponse(button) {
    const aiMessage = button.closest('.flex.items-start');
    const responseElement = aiMessage.querySelector('pre');
    
    // 获取原始内容（markdown 格式）
    const originalContent = responseElement.dataset.originalContent || responseElement.textContent;
    
    // 复制到剪贴板
    navigator.clipboard.writeText(originalContent).then(() => {
        // 显示复制成功提示
        const originalTitle = button.title;
        button.title = '复制成功!';
        setTimeout(() => {
            button.title = originalTitle;
        }, 1000);
    }).catch(err => {
        console.error('复制失败:', err);
        button.title = '复制失败';
    });
}

// 使用提示词并直接发送
function usePromptAndSend(button) {
    document.getElementById('prompt').value = button.textContent.trim();
    // 隐藏建议框
    document.getElementById('suggestionBox').style.display = 'none';
    // 直接发送消息
    sendMessage();
}

// 修改添加AI消息的部分
function addAIMessage(message) {
    const modelType = document.getElementById('modelType').value;
    const model = document.getElementById('model').value;
    const modelInfo = `${modelType.toUpperCase()} / ${model}`;
    
    const aiMessage = document.createElement('div');
    aiMessage.className = 'flex items-start space-x-3 mb-4';
    aiMessage.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0 text-white">AI</div>
        <div class="flex-1 dark:bg-slate-800 bg-white rounded-lg p-4 dark:border-slate-700 border-slate-200 border">
            <div class="text-xs dark:text-slate-400 text-slate-500 mb-2">${modelInfo}</div>
            <div class="dark:text-slate-400 text-slate-500 text-sm mb-2" id="ai-reasoning-${Date.now()}"></div>
            <pre class="dark:text-slate-200 text-slate-700 whitespace-pre-wrap" id="ai-response-${Date.now()}">...</pre>
            <div class="flex justify-end space-x-2 mt-2 dark:text-slate-400 text-slate-500">
                <button onclick="copyResponse(this)" class="p-1.5 dark:hover:bg-slate-700 hover:bg-slate-100 rounded-lg" title="复制内容">
                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                </button>
                <button onclick="reaskQuestion(this)" class="p-1.5 dark:hover:bg-slate-700 hover:bg-slate-100 rounded-lg" title="重新发起对话">
                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>
                <button onclick="deleteMessage(this)" class="p-1.5 dark:hover:bg-slate-700 hover:bg-slate-100 rounded-lg" title="删除这一轮对话">
                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            </div>
        </div>
    `;
    return aiMessage;
}

// 删除当前对话轮次
function deleteMessage(button) {
    const aiMessage = button.closest('.flex.items-start');
    const userMessage = aiMessage.previousElementSibling;
    if (userMessage && userMessage.querySelector('.bg-blue-600')) {
        userMessage.remove();
    }
    aiMessage.remove();
    
    // 更新存储的聊天记录
    saveChatHistory();
    
    // 如果没有消息了，显示推荐
    const messageList = document.getElementById('messageList');
    if (messageList.children.length === 0) {
        restoreChatHistory();
    }
}

// 添加主题切换函数
function toggleTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    updateThemeButtons(theme);
    
    // 保存主题设置
    const config = JSON.parse(localStorage.getItem('aiPaletteConfig') || '{}');
    config.theme = theme;
    localStorage.setItem('aiPaletteConfig', JSON.stringify(config));
}

// 更新主题按钮状态
function updateThemeButtons(activeTheme) {
    const darkButton = document.querySelector('.dark-toggle');
    const lightButton = document.querySelector('.light-toggle');
    
    if (activeTheme === 'dark') {
        darkButton.classList.add('bg-blue-600', 'text-slate-50');
        darkButton.classList.remove('dark:text-slate-300', 'text-slate-500');
        lightButton.classList.remove('bg-blue-600', 'text-slate-50');
        lightButton.classList.add('dark:text-slate-300', 'text-slate-500');
    } else {
        lightButton.classList.add('bg-blue-600', 'text-slate-50');
        lightButton.classList.remove('dark:text-slate-300', 'text-slate-500');
        darkButton.classList.remove('bg-blue-600', 'text-slate-50');
        darkButton.classList.add('dark:text-slate-300', 'text-slate-500');
    }
}

// 修改保存聊天记录函数
function saveChatHistory() {
    const messageList = document.getElementById('messageList');
    const messages = [];
    
    for (const message of messageList.children) {
        if (message.id === 'suggestionBox') continue;
        
        if (message.querySelector('.bg-blue-600')) { // 用户消息
            const pElement = message.querySelector('p');
            messages.push({
                type: 'user',
                content: pElement.dataset.originalContent || pElement.textContent.replace(/<br\s*\/?>/g, '\n')
            });
        } else if (message.querySelector('.bg-purple-600')) { // AI 消息
            const modelInfo = message.querySelector('.text-xs').textContent;
            const responseElement = message.querySelector('pre');
            const reasoningElement = message.querySelector('div[id^="ai-reasoning"]');
            
            const messageData = {
                type: 'ai',
                modelInfo: modelInfo,
                content: responseElement.dataset.originalContent || responseElement.textContent
            };

            // 如果有推理内容，也保存
            const reasoningContent = reasoningElement?.querySelector('.reasoning-content');
            if (reasoningContent) {
                const reasoningDiv = reasoningContent.querySelector('div');
                messageData.reasoning = reasoningDiv.dataset.originalContent || reasoningDiv.textContent;
                // 始终设置为展开状态
                messageData.reasoningExpanded = true;
            }

            messages.push(messageData);
        }
    }
    
    localStorage.setItem('aiPaletteChatHistory', JSON.stringify(messages));
}

// 添加恢复聊天记录的函数
function restoreChatHistory() {
    const messageList = document.getElementById('messageList');
    if (!messageList) return;
    
    // 清空现有消息
    messageList.innerHTML = '';
    
    // 从 localStorage 获取消息历史
    const messages = JSON.parse(localStorage.getItem('aiPaletteChatHistory') || '[]');
    
    // 如果没有消息历史或消息不是数组，显示建议框
    if (!Array.isArray(messages) || messages.length === 0) {
        if (!document.getElementById('suggestionBox')) {
            messageList.innerHTML = `
                <div id="suggestionBox" class="mb-4">
                    <div class="flex flex-wrap gap-2 text-xs">
                        <button onclick="usePromptAndSend(this)" class="rounded-lg dark:bg-slate-800 bg-white px-3 py-1.5 dark:hover:bg-blue-600 hover:bg-blue-50 dark:hover:text-slate-200 hover:text-blue-600 dark:text-slate-300 text-slate-600 dark:border-slate-700 border-slate-200 border">
                            帮我制定一份一周健康饮食计划
                        </button>
                        <button onclick="usePromptAndSend(this)" class="rounded-lg dark:bg-slate-800 bg-white px-3 py-1.5 dark:hover:bg-blue-600 hover:bg-blue-50 dark:hover:text-slate-200 hover:text-blue-600 dark:text-slate-300 text-slate-600 dark:border-slate-700 border-slate-200 border">
                            如何缓解工作压力和情绪
                        </button>
                        <button onclick="usePromptAndSend(this)" class="rounded-lg dark:bg-slate-800 bg-white px-3 py-1.5 dark:hover:bg-blue-600 hover:bg-blue-50 dark:hover:text-slate-200 hover:text-blue-600 dark:text-slate-300 text-slate-600 dark:border-slate-700 border-slate-200 border">
                            推荐一些室内植物养护小技巧
                        </button>
                        <button onclick="usePromptAndSend(this)" class="rounded-lg dark:bg-slate-800 bg-white px-3 py-1.5 dark:hover:bg-blue-600 hover:bg-blue-50 dark:hover:text-slate-200 hover:text-blue-600 dark:text-slate-300 text-slate-600 dark:border-slate-700 border-slate-200 border">
                            分享一些提高睡眠质量的方法
                        </button>
                        <button onclick="usePromptAndSend(this)" class="rounded-lg dark:bg-slate-800 bg-white px-3 py-1.5 dark:hover:bg-blue-600 hover:bg-blue-50 dark:hover:text-slate-200 hover:text-blue-600 dark:text-slate-300 text-slate-600 dark:border-slate-700 border-slate-200 border">
                            推荐几道简单美味的家常菜
                        </button>
                        <button onclick="usePromptAndSend(this)" class="rounded-lg dark:bg-slate-800 bg-white px-3 py-1.5 dark:hover:bg-blue-600 hover:bg-blue-50 dark:hover:text-slate-200 hover:text-blue-600 dark:text-slate-300 text-slate-600 dark:border-slate-700 border-slate-200 border">
                            如何整理和收纳小户型空间
                        </button>
                        <button onclick="usePromptAndSend(this)" class="rounded-lg dark:bg-slate-800 bg-white px-3 py-1.5 dark:hover:bg-blue-600 hover:bg-blue-50 dark:hover:text-slate-200 hover:text-blue-600 dark:text-slate-300 text-slate-600 dark:border-slate-700 border-slate-200 border">
                            分享一些省钱小妙招
                        </button>
                    </div>
                </div>`;
        }
        return;
    }
    
    // 有效的消息历史，显示消息
    for (const message of messages) {
        if (message.type === 'user') {
            const userMessage = document.createElement('div');
            userMessage.className = 'flex items-start space-x-3 mb-4';
            // 先转义内容，再将换行符转换为 <br/>
            const escapedContent = escapeHtml(message.content);
            const displayContent = escapedContent.replace(/\n/g, '<br/>');
            userMessage.innerHTML = `
                <div class="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 text-white">U</div>
                <div class="flex-1 dark:bg-slate-800 bg-white rounded-lg p-4 dark:border-slate-700 border-slate-200 border">
                    <p class="dark:text-slate-200 text-slate-700" data-original-content="${escapeHtml(message.content)}">${displayContent}</p>
                </div>
            `;
            messageList.appendChild(userMessage);
        } else if (message.type === 'ai') {
            const aiMessage = document.createElement('div');
            aiMessage.className = 'flex items-start space-x-3 mb-4';
            
            let reasoningHtml = '';
            if (message.reasoning) {
                reasoningHtml = `
                    <div class="text-slate-400">
                        <div class="flex items-center cursor-pointer hover:text-slate-300 transition-colors duration-200" onclick="toggleReasoning(this)">
                            <svg class="w-4 h-4 mr-1 reasoning-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="transform: rotate(90deg)">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                            </svg>
                            思考过程
                        </div>
                        <div class="pl-5 mt-2 reasoning-content" style="height: auto">
                            <div class="whitespace-pre-wrap text-slate-400" data-original-content="${escapeHtml(message.reasoning)}">${parseMarkdown(message.reasoning)}</div>
                        </div>
                    </div>`;
            }

            aiMessage.innerHTML = `
                <div class="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0 text-white">AI</div>
                <div class="flex-1 dark:bg-slate-800 bg-white rounded-lg p-4 dark:border-slate-700 border-slate-200 border">
                    <div class="text-xs dark:text-slate-400 text-slate-500 mb-2">${escapeHtml(message.modelInfo)}</div>
                    <div class="dark:text-slate-400 text-slate-500 text-sm mb-2" id="ai-reasoning-${Date.now()}">${reasoningHtml}</div>
                    <pre class="dark:text-slate-200 text-slate-700 whitespace-pre-wrap" data-original-content="${escapeHtml(message.content)}">${parseMarkdown(message.content)}</pre>
                    <div class="flex justify-end space-x-2 mt-2 dark:text-slate-400 text-slate-500">
                        <button onclick="copyResponse(this)" class="p-1.5 dark:hover:bg-slate-700 hover:bg-slate-100 rounded-lg" title="复制内容">
                            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </button>
                        <button onclick="reaskQuestion(this)" class="p-1.5 dark:hover:bg-slate-700 hover:bg-slate-100 rounded-lg" title="重新发起对话">
                            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                        <button onclick="deleteMessage(this)" class="p-1.5 dark:hover:bg-slate-700 hover:bg-slate-100 rounded-lg" title="删除这一轮对话">
                            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </div>
            `;
            messageList.appendChild(aiMessage);
        }
    }
}

// 代码抽屉相关函数
function toggleCodeDrawer() {
    const drawer = document.getElementById('codeDrawer');
    const chatContainer = document.getElementById('chatContainer');
    const checkbox = document.getElementById('showCodeExamples');
    
    drawer.classList.toggle('translate-x-full');
    chatContainer.classList.toggle('drawer-open');
    
    // 同步 checkbox 状态
    checkbox.checked = !drawer.classList.contains('translate-x-full');
    
    // 触发窗口 resize 事件以更新布局
    window.dispatchEvent(new Event('resize'));
}

// 复制代码函数
function copyCode(button) {
    const pre = button.closest('.relative').querySelector('pre');
    const code = pre.querySelector('code').innerText;
    
    navigator.clipboard.writeText(code).then(() => {
        const originalText = button.innerText;
        button.innerText = '已复制';
        button.classList.add('dark:bg-green-700', 'bg-green-100', 'dark:text-green-100', 'text-green-700');
        
        setTimeout(() => {
            button.innerText = originalText;
            button.classList.remove('dark:bg-green-700', 'bg-green-100', 'dark:text-green-100', 'text-green-700');
        }, 2000);
    }).catch(err => {
        console.error('复制失败:', err);
        button.innerText = '复制失败';
        button.classList.add('dark:bg-red-700', 'bg-red-100', 'dark:text-red-100', 'text-red-700');
        
        setTimeout(() => {
            button.innerText = '复制代码';
            button.classList.remove('dark:bg-red-700', 'bg-red-100', 'dark:text-red-100', 'text-red-700');
        }, 2000);
    });
}

// 更新代码示例中的配置
function updateCodeExamples() {
    const modelType = document.getElementById('modelType').value;
    const model = document.getElementById('model').value;
    const apiKey = document.getElementById('apiKey').value;
    const enableStreaming = document.getElementById('enableStreaming').checked;
    
    // 更新所有代码块中的配置
    document.querySelectorAll('.code-block code').forEach(codeElement => {
        let code = codeElement.innerText;
        
        // JavaScript 代码更新
        if (codeElement.classList.contains('language-javascript')) {
            // Fetch API 代码更新
            if (code.includes('fetch')) {
                code = code.replace(/model_type:\s*[^,\n]*,(\s*\/\/[^\n]*\n|\s*\n)/, `model_type: '${modelType}',  // 当前选择的模型类型\n`);
                code = code.replace(/model:\s*[^,\n]*,(\s*\/\/[^\n]*\n|\s*\n)/, `model: '${model}',  // 当前选择的模型\n`);
                code = code.replace(/api_key:\s*[^,\n]*,(\s*\/\/[^\n]*\n|\s*\n)/, `api_key: '${apiKey}',  // 当前输入的 API Key\n`);
                code = code.replace(/enable_streaming:\s*[^,\n}]*(\s*\/\/[^\n]*\n|\s*\n|\s*})/, `enable_streaming: ${enableStreaming}  // 是否启用流式输出\n`);
            }
            // EventSource 代码更新
            else if (code.includes('EventSource')) {
                code = code.replace(/model_type:\s*[^,\n]*,(\s*\/\/[^\n]*\n|\s*\n)/, `model_type: '${modelType}',  // 当前选择的模型类型\n`);
                code = code.replace(/model:\s*[^,\n]*,(\s*\/\/[^\n]*\n|\s*\n)/, `model: '${model}',  // 当前选择的模型\n`);
                code = code.replace(/api_key:\s*[^,\n]*,(\s*\/\/[^\n]*\n|\s*\n)/, `api_key: '${apiKey}',  // 当前输入的 API Key\n`);
                code = code.replace(/enable_streaming:\s*[^,\n}]*(\s*\/\/[^\n]*\n|\s*\n|\s*})/, `enable_streaming: true  // 流式输出始终启用\n`);
            }
        } 
        // Python 代码更新
        else if (codeElement.classList.contains('language-python')) {
            // 前端 requests 代码更新
            if (code.includes('requests.post')) {
                code = code.replace(/'model_type':\s*[^,\n]*,(\s*#[^\n]*\n|\s*\n)/, `'model_type': '${modelType}',  # 当前选择的模型类型\n`);
                code = code.replace(/'model':\s*[^,\n]*,(\s*#[^\n]*\n|\s*\n)/, `'model': '${model}',  # 当前选择的模型\n`);
                code = code.replace(/'api_key':\s*[^,\n]*,(\s*#[^\n]*\n|\s*\n)/, `'api_key': '${apiKey}',  # 当前输入的 API Key\n`);
                code = code.replace(/'enable_streaming':\s*[^,\n}]*(\s*#[^\n]*\n|\s*\n|\s*})/, `'enable_streaming': ${enableStreaming ? 'True' : 'False'}  # 是否启用流式输出\n`);
            }
            // 后端 AIChat 代码更新
            else if (code.includes('AIChat')) {
                code = code.replace(/provider=[^,\n]*,(\s*#[^\n]*\n|\s*\n)/, `provider='${modelType}',  # 当前选择的模型类型\n`);
                code = code.replace(/model=[^,\n]*,(\s*#[^\n]*\n|\s*\n)/, `model='${model}',  # 当前选择的模型\n`);
                code = code.replace(/api_key=[^,\n]*,(\s*#[^\n]*\n|\s*\n)/, `api_key='${apiKey}',  # 当前输入的 API Key\n`);
                code = code.replace(/enable_streaming=[^)\n]*(\s*#[^\n]*\n|\s*\n|\s*})/, `enable_streaming=${enableStreaming ? 'True' : 'False'}  # 是否启用流式输出\n`);
            }
        } 
        // cURL 代码更新
        else if (codeElement.classList.contains('language-bash')) {
            code = code.replace(/"model_type":\s*[^,\n}]*,(\s*\/\/[^\n]*\n|\s*\n)/, `"model_type": "${modelType}",  // 当前选择的模型类型\n`);
            code = code.replace(/"model":\s*[^,\n}]*,(\s*\/\/[^\n]*\n|\s*\n)/, `"model": "${model}",  // 当前选择的模型\n`);
            code = code.replace(/"api_key":\s*[^,\n}]*,(\s*\/\/[^\n]*\n|\s*\n)/, `"api_key": "${apiKey}",  // 当前输入的 API Key\n`);
            code = code.replace(/"enable_streaming":\s*[^,\n}]*(\s*\/\/[^\n]*\n|\s*\n|\s*})/, `"enable_streaming": ${enableStreaming}  // 是否启用流式输出\n`);
        }
        
        // 确保每行后面都有换行符
        code = code.replace(/([^,\n}])(\/\/|#)([^\n]*)/g, '$1\n$2$3');
        code = code.replace(/,(\s*)(\/\/|#)([^\n]*)/g, ',\n$2$3');
        
        codeElement.innerText = code;
    });
}

// 切换代码示例函数
function switchCodeExample(type) {
    const selectedType = document.getElementById(`${type}CodeType`).value;
    const examples = document.querySelectorAll(`#${type}Examples .code-example`);
    
    // 隐藏所有示例
    examples.forEach(example => {
        example.classList.add('hidden');
    });
    
    // 显示选中的示例
    const selectedExample = document.getElementById(`${selectedType}Example`);
    if (selectedExample) {
        selectedExample.classList.remove('hidden');
        
        // 获取代码元素
        const codeElement = selectedExample.querySelector('code');
        if (codeElement) {
            const config = {
                modelType: document.getElementById('modelType').value,
                model: document.getElementById('model').value,
                apiKey: document.getElementById('apiKey').value,
                enableStreaming: document.getElementById('enableStreaming').checked
            };

            // 根据不同语言选择模板
            let template;
            if (selectedType === 'eventsource') {
                template = CODE_TEMPLATES.eventsource;
            } else if (selectedType === 'fetch') {
                template = CODE_TEMPLATES.fetch;
            } else if (selectedType === 'requests') {
                template = CODE_TEMPLATES.requests;
            } else if (selectedType === 'curl') {
                template = CODE_TEMPLATES.curl;
            }

            if (template) {
                codeElement.textContent = updateCodeWithTemplate(template, config);
            }
        }
    }
}

// 监听配置变化
function setupConfigListeners() {
    // 监听所有配置项的变化
    const configElements = [
        {id: 'modelType', events: ['change']},
        {id: 'model', events: ['change', 'input']},
        {id: 'apiKey', events: ['change', 'input', 'blur']},
        {id: 'enableStreaming', events: ['change']}
    ];

    configElements.forEach(({id, events}) => {
        const element = document.getElementById(id);
        if (element) {
            events.forEach(eventType => {
                element.addEventListener(eventType, () => {
                    // 使用 requestAnimationFrame 确保在下一帧更新,避免性能问题
                    requestAnimationFrame(() => {
                        updateCodeExamples();
                    });
                });
            });
        }
    });

    // 特别处理模型下拉列表点击选择事件
    document.getElementById('modelList')?.addEventListener('click', (e) => {
        if (e.target.tagName === 'DIV' && !e.target.id) {
            requestAnimationFrame(() => {
                updateCodeExamples();
            });
        }
    });
}

// 在页面加载时初始化
window.addEventListener('load', function() {
    // 初始化时禁用右侧所有内容
    document.getElementById('thinkingPrompt').disabled = true;
    document.getElementById('resultPrompt').disabled = true;
    document.getElementById('thinkingModelType').disabled = true;
    document.getElementById('resultModelType').disabled = true;
    document.getElementById('chainTitle').classList.remove('cursor-pointer');
    
    // 初始化代码示例
    updateCodeExamples();
    // 初始化前端代码示例切换
    switchCodeExample('frontend');
    // 设置配置监听
    setupConfigListeners();
    
    // 监听主题切换,确保代码示例样式同步
    const observer = new MutationObserver(() => {
        requestAnimationFrame(() => {
            updateCodeExamples();
        });
    });
    
    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class']
    });
    
    // 初始化后刷新模型列表
    refreshModels();
});

// 处理流式输出变化
function handleStreamingChange() {
    const enableStreaming = document.getElementById('enableStreaming').checked;
    
    // 保存到本地存储
    const config = JSON.parse(localStorage.getItem('aiPaletteConfig') || '{}');
    config.enableStreaming = enableStreaming;
    localStorage.setItem('aiPaletteConfig', JSON.stringify(config));
    
    // 更新代码示例
    requestAnimationFrame(() => {
        updateCodeExamples();
    });
}

// 代码范式定义
const CODE_TEMPLATES = {
    fetch: `const response = await fetch('/api/chat', {
method: 'POST',
headers: {
'Content-Type': 'application/json'
},
body: JSON.stringify({
model_type: '[$MODEL_TYPE$]',  // 当前选择的模型类型
model: '[$MODEL$]',  // 当前选择的模型
api_key: '[$API_KEY$]',  // 当前输入的 API Key
prompt: 'Your message here',
enable_streaming: [$STREAMING$]  // 是否启用流式输出
})
});

const data = await response.json();
console.log(data.response);`,

    eventsource: `const params = new URLSearchParams({
model_type: '[$MODEL_TYPE$]',  // 当前选择的模型类型
model: '[$MODEL$]',  // 当前选择的模型
api_key: '[$API_KEY$]',  // 当前输入的 API Key
prompt: 'Your message here',
enable_streaming: true  // 流式输出始终启用
});

const eventSource = new EventSource(\`/api/chat?\${params}\`);

eventSource.onmessage = (event) => {
const data = JSON.parse(event.data);
console.log(data.content);
};

eventSource.onerror = () => {
eventSource.close();
};`,

    requests: `import requests

response = requests.post(
'http://localhost:18000/api/chat',
json={
'model_type': '[$MODEL_TYPE$]',  # 当前选择的模型类型
'model': '[$MODEL$]',  # 当前选择的模型
'api_key': '[$API_KEY$]',  # 当前输入的 API Key
'prompt': 'Your message here',
'enable_streaming': [$STREAMING$]  # 是否启用流式输出
}
)

print(response.json()['response'])`,

    curl: `curl -X POST http://localhost:18000/api/chat \\
-H "Content-Type: application/json" \\
-d '{
"model_type": "[$MODEL_TYPE$]",  // 当前选择的模型类型
"model": "[$MODEL$]",  // 当前选择的模型
"api_key": "[$API_KEY$]",  // 当前输入的 API Key
"prompt": "Your message here",
"enable_streaming": [$STREAMING$]  // 是否启用流式输出
}'`,

    aichat: `from ai_palette import AIChat

# 初始化聊天实例
chat = AIChat(
provider='[$MODEL_TYPE$]',  # 当前选择的模型类型
model='[$MODEL$]',  # 当前选择的模型
api_key='[$API_KEY$]',  # 当前输入的 API Key
enable_streaming=[$STREAMING$]  # 是否启用流式输出
)`
};

// 更新代码示例的函数
function updateCodeWithTemplate(template, config) {
    const isPythonCode = template.includes('import ') || template.includes('AIChat');
    return template
        .replace(/\[\$MODEL_TYPE\$\]/g, config.modelType)
        .replace(/\[\$MODEL\$\]/g, config.model)
        .replace(/\[\$API_KEY\$\]/g, config.apiKey)
        .replace(/\[\$STREAMING\$\]/g, isPythonCode ? (config.enableStreaming ? 'True' : 'False') : config.enableStreaming);
}

// 切换代码示例函数
function switchCodeExample(type) {
    const selectedType = document.getElementById(`${type}CodeType`).value;
    const examples = document.querySelectorAll(`#${type}Examples .code-example`);
    
    // 隐藏所有示例
    examples.forEach(example => {
        example.classList.add('hidden');
    });
    
    // 显示选中的示例
    const selectedExample = document.getElementById(`${selectedType}Example`);
    if (selectedExample) {
        selectedExample.classList.remove('hidden');
        
        // 获取代码元素
        const codeElement = selectedExample.querySelector('code');
        if (codeElement) {
            const config = {
                modelType: document.getElementById('modelType').value,
                model: document.getElementById('model').value,
                apiKey: document.getElementById('apiKey').value,
                enableStreaming: document.getElementById('enableStreaming').checked
            };

            // 根据不同语言选择模板
            let template;
            if (selectedType === 'eventsource') {
                template = CODE_TEMPLATES.eventsource;
            } else if (selectedType === 'fetch') {
                template = CODE_TEMPLATES.fetch;
            } else if (selectedType === 'requests') {
                template = CODE_TEMPLATES.requests;
            } else if (selectedType === 'curl') {
                template = CODE_TEMPLATES.curl;
            }

            if (template) {
                codeElement.textContent = updateCodeWithTemplate(template, config);
            }
        }
    }
}

// 双链推理配置模态框相关函数
function toggleChainModal() {
    const modal = document.getElementById('chainModal');
    const modalContent = modal.querySelector('.scale-100, .scale-95');
    
    if (modal.classList.contains('opacity-0')) {
        // 显示模态框
        modal.classList.remove('opacity-0', 'pointer-events-none');
        if (modalContent) {
            modalContent.classList.remove('scale-95');
            modalContent.classList.add('scale-100');
        }
        
        // 检查是否有选中的条目，如果没有则选中第一个
        if (!currentChainId) {
            const firstChainItem = document.querySelector('#chainList li');
            if (firstChainItem) {
                const chainId = firstChainItem.dataset.chainId;
                selectChain(chainId);
            }
        }
    } else {
        // 隐藏模态框
        if (modalContent) {
            modalContent.classList.remove('scale-100');
            modalContent.classList.add('scale-95');
        }
        setTimeout(() => {
            modal.classList.add('opacity-0', 'pointer-events-none');
        }, 300);
    }
}

// 在页面加载时初始化模型输入框状态
window.addEventListener('load', () => {
    // 初始化思考和结果的模型输入框状态
    updateModelInputState('thinking', true);
    updateModelInputState('result', true);
    
    // 恢复已保存的推理链数据
    const chains = JSON.parse(localStorage.getItem('aiPaletteChains') || '{}');
    const chainList = document.getElementById('chainList');
    
    // 清空现有列表
    chainList.innerHTML = '';
    
    // 如果有保存的推理链，则恢复它们
    if (Object.keys(chains).length > 0) {
        Object.entries(chains).forEach(([chainId, chainData]) => {
            const newChain = document.createElement('li');
            newChain.className = 'flex items-center justify-between px-3 py-2 rounded-lg dark:bg-slate-700 bg-slate-100 dark:text-slate-300 text-slate-600 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors duration-200';
            newChain.dataset.chainId = chainId;
            
            newChain.innerHTML = `
                <div class="flex items-center justify-between w-full">
                    <span class="flex-1 truncate" ondblclick="makeEditable(this)">${chainData.title}</span>
                    <button onclick="deleteChain(this)" class="ml-2 p-1 rounded-lg dark:hover:bg-slate-600 hover:bg-slate-200 dark:text-slate-400 text-slate-600 flex items-center justify-center">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            `;
            
            // 添加点击事件
            newChain.addEventListener('click', (e) => {
                if (!e.target.closest('button')) {
                    selectChain(chainId);
                }
            });
            
            chainList.appendChild(newChain);
        });
    } else {
        // 如果没有保存的推理链，创建一个默认的
        const chainId = 'chain_' + Date.now();
        const newChain = document.createElement('li');
        newChain.className = 'flex items-center justify-between px-3 py-2 rounded-lg dark:bg-slate-700 bg-slate-100 dark:text-slate-300 text-slate-600 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors duration-200';
        newChain.dataset.chainId = chainId;
        
        // 获取当前时间并格式化为 mmddhhmm
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const formattedTime = `新的推理链_${month}${day}${hours}${minutes}`;
        
        newChain.innerHTML = `
            <div class="flex items-center justify-between w-full">
                <span class="flex-1 truncate" ondblclick="makeEditable(this)">${formattedTime}</span>
                <button onclick="deleteChain(this)" class="p-1.5 dark:hover:bg-slate-600 hover:bg-slate-200 dark:text-slate-400 text-slate-600 flex items-center justify-center">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        `;
        
        // 添加点击事件
        newChain.addEventListener('click', (e) => {
            if (!e.target.closest('button')) {
                selectChain(chainId);
            }
        });
        
        chainList.appendChild(newChain);
        
        // 创建并保存默认推理链数据
        const chainData = {
            id: chainId,
            title: formattedTime,
            thinkingPrompt: `我是一位专业的分析助手。
我会基于用户的问题进行深入分析和思考，我会输出内心的独白，思考中，我会基于下面的方式:
我会尝试一步一步思考与推理。

### 我的思考方式

作为一个专业分析助手，我将模拟人类的推理思维过程。
但我一定不会使用 markdown 的格式，而是使用纯文本。

1. 我的思维模式:
- 我会合理推测用户提问的真实意图
- 我会从多个角度思考问题
- 我会同时考虑正反两面
- 我善于进行因果推理
- 我会联想类似的案例
- 我注重系统性思维
- 我会保持批判和质疑
- 我会验证各种假设

### 我的分析步骤
我会按照以下步骤进行分析:

1. 我先吸收信息
- 我提取关键点
- 我理清上下文
- 我明确目标

2. 我再拆解要素
- 我分解核心要件
- 我找出关键变量
- 我标注重要线索

3. 我展开推理
- 我分析因果关系
- 我识别限制条件
- 我构建推理路径

4. 我进行验证
- 我正向论证
- 我反向否定
- 我测试边界
- 我验证假设

5. 我进行对比
- 我对比相似案例
- 我分析差异点
- 我借鉴经验

6. 我评估风险
- 我分析不确定性
- 我预判潜在问题
- 我权衡解决方案

7. 我检验结论
- 我检查逻辑自洽性
- 我验证可行性
- 我做综合评估


### 我的思考语言:
我不会使用大纲性的描述手段叙述，而是使用人类的内心独白的方式娓娓道来。
这些是我常用的思考话术
- 我觉得...
- 我认为...
- 我想到...
- 我转念一想... 
- 从我另一个角度看...
- 从另一个维度看...
- 我仔细想想...
- 我联想到...
- 话说回来...
- 思考到这里...
- 我补充一点...
- 我归纳来看...
- 第一反应是...
- 等一下...
- 顺着这个思路...
- 继续延伸...
- 深入想想...
- 回过头来看...
- 我觉得还有可能...
- 理一理头绪...
- 总的来说...
- 归纳一下...
- 回顾刚才的想法...

### 我的输出要求
1. 我的思考过程要完整,逻辑清晰；
2. 我用自然的语言来描述,避免生硬的框架；
3. 我的每个维度都独立思考,相互印证或质疑；
4. 我至少要进行 6 次从不同维度出发的思考；
5. 不允许使用任何 markdown 或者其他格式，只允许使用纯文本。
5. 最终使用这句话结尾："我将基于上面的思考，给出我的答案。"

我将基于这个框架,分析用户提出的这个问题：[$query$]

# 思考结果
好的，首先，`,
            resultPrompt: `我会根据任务类型和需求，基于我之前的思考，灵活运用以下表达方式，给出一个完整的答复:

# 我的表达方式
1. 主要内容
- 我给出核心观点/结论/方案
- 我进行重点论述
- 我说明关键要素

2. 细节展开
- 我提供具体解释
- 我列举相关案例
- 我展示实际应用

3. 注意事项
- 我指出重要提醒
- 我说明使用建议
- 我标注限制条件

4. 延伸内容
- 我提供补充信息
- 我给出相关建议
- 我展望后续发展

### 我的表达原则
1. 我保持语言自然流畅
2. 我确保内容连贯完整
3. 我注重实用性价值
4. 我适应不同场景需求
5. 我力求清晰易懂

### 用户的提问
[$query$]

### 我的思考
这是我之前的分析过程:
[$thought$]

# 我的回答

`,
            thinkingConfig: {
                modelType: 'inherit',
                model: '',
                apiKey: ''
            },
            resultConfig: {
                modelType: 'inherit',
                model: '',
                apiKey: ''
            }
        };
        saveChainData(chainData);
        
        // 选中新创建的推理链
        selectChain(chainId);
    }
});

// 添加新的推理链
function addNewChain() {
    const chainList = document.getElementById('chainList');
    const newChain = document.createElement('li');
    newChain.className = 'flex items-center justify-between px-3 py-2 rounded-lg dark:bg-slate-700 bg-slate-100 dark:text-slate-300 text-slate-600 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors duration-200';
    
    // 生成唯一ID
    const chainId = 'chain_' + Date.now();
    newChain.dataset.chainId = chainId;
    
    // 获取当前时间并格式化为 mmddhhmm
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const formattedTime = `新的推理链_${month}${day}${hours}${minutes}`;
    
    newChain.innerHTML = `
        <div class="flex items-center justify-between w-full">
            <span class="flex-1 truncate" ondblclick="makeEditable(this)">${formattedTime}</span>
            <button onclick="deleteChain(this)" class="p-1.5 dark:hover:bg-slate-600 hover:bg-slate-200 dark:text-slate-400 text-slate-600 flex items-center justify-center">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    `;
    
    // 添加点击事件
    newChain.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
            selectChain(chainId);
        }
    });
    
    chainList.appendChild(newChain);
    
    // 创建并保存空的推理链数据
    const chainData = {
        id: chainId,
        title: formattedTime,
        thinkingPrompt: `我是一位专业的分析助手。
我会基于用户的问题进行深入分析和思考，我会输出内心的独白，思考中，我会基于下面的方式:
我会尝试一步一步思考与推理。

### 我的思考方式
作为一个专业分析助手，我将模拟人类的思维过程。
但我一定不会使用 markdown 的格式，而是使用纯文本。

1. 我的思维模式:
- 我会合理推测用户提问的真实意图
- 我会从多个角度思考问题
- 我会同时考虑正反两面
- 我善于进行因果推理
- 我会联想类似的案例
- 我注重系统性思维
- 我会保持批判和质疑
- 我会验证各种假设

### 我的分析步骤
我会按照以下步骤进行分析:

1. 我先吸收信息
- 我提取关键点
- 我理清上下文
- 我明确目标

2. 我再拆解要素
- 我分解核心要件
- 我找出关键变量
- 我标注重要线索

3. 我展开推理
- 我分析因果关系
- 我识别限制条件
- 我构建推理路径

4. 我进行验证
- 我正向论证
- 我反向否定
- 我测试边界
- 我验证假设

5. 我进行对比
- 我对比相似案例
- 我分析差异点
- 我借鉴经验

6. 我评估风险
- 我分析不确定性
- 我预判潜在问题
- 我权衡解决方案

7. 我检验结论
- 我检查逻辑自洽性
- 我验证可行性
- 我做综合评估


### 我的思考语言:
我不会使用大纲性的描述手段叙述，而是使用人类的内心独白的方式娓娓道来。
这些是我常用的思考话术
- 我觉得...
- 我认为...
- 我想到...
- 我转念一想... 
- 从我另一个角度看...
- 从另一个维度看...
- 我仔细想想...
- 我联想到...
- 话说回来...
- 思考到这里...
- 我补充一点...
- 我归纳来看...
- 第一反应是...
- 等一下...
- 顺着这个思路...
- 继续延伸...
- 深入想想...
- 回过头来看...
- 我觉得还有可能...
- 理一理头绪...
- 总的来说...
- 归纳一下...
- 回顾刚才的想法...

### 我的输出要求
1. 我的思考过程要完整,逻辑清晰；
2. 我用自然的语言来描述,避免生硬的框架；
3. 我的每个维度都独立思考,相互印证或质疑；
4. 我至少要进行 6 次从不同维度出发的思考；
5. 不允许使用任何 markdown 或者其他格式，只允许使用纯文本。
5. 最终使用这句话结尾："我将基于上面的思考，给出我的答案。"

我将基于这个框架,分析用户提出的这个问题：[$query$]

# 思考结果
好的，首先，`,
        resultPrompt: `我会根据任务类型和需求，基于我之前的思考，灵活运用以下表达方式，给出一个完整的答复:

# 我的表达方式
1. 主要内容
- 我给出核心观点/结论/方案
- 我进行重点论述
- 我说明关键要素

2. 细节展开
- 我提供具体解释
- 我列举相关案例
- 我展示实际应用

3. 注意事项
- 我指出重要提醒
- 我说明使用建议
- 我标注限制条件

4. 延伸内容
- 我提供补充信息
- 我给出相关建议
- 我展望后续发展

### 我的表达原则
1. 我保持语言自然流畅
2. 我确保内容连贯完整
3. 我注重实用性价值
4. 我适应不同场景需求
5. 我力求清晰易懂

### 用户的提问
[$query$]

### 我的思考
这是我之前的分析过程:
[$thought$]

# 我的回答

`,
        thinkingConfig: {
            modelType: 'siliconflow',
            model: '',
            apiKey: ''
        },
        resultConfig: {
            modelType: 'siliconflow',
            model: '',
            apiKey: ''
        }
    };
    saveChainData(chainData);
    
    // 选中新创建的推理链
    selectChain(chainId);
}

// 删除推理链
function deleteChain(button) {
    const chainItem = button.closest('li');
    const chainId = chainItem.dataset.chainId;
    
    // 删除数据
    const chains = JSON.parse(localStorage.getItem('aiPaletteChains') || '{}');
    delete chains[chainId];
    localStorage.setItem('aiPaletteChains', JSON.stringify(chains));
    
    chainItem.remove();
    
    // 如果删除的是当前选中的推理链，清空右侧内容并禁用
    if (chainId === currentChainId) {
        document.getElementById('chainTitle').textContent = '未选择推理链';
        document.getElementById('thinkingPrompt').value = '';
        document.getElementById('resultPrompt').value = '';
        document.getElementById('thinkingPrompt').disabled = true;
        document.getElementById('resultPrompt').disabled = true;
        document.getElementById('thinkingModelType').disabled = true;
        document.getElementById('resultModelType').disabled = true;
        document.getElementById('chainTitle').classList.remove('cursor-pointer');
        currentChainId = null;
    }
}

// 使元素可编辑
function makeEditable(element) {
    if (!element) return;
    
    const chainItem = element.closest('li');
    const isTitle = element.id === 'chainTitle';
    
    // 如果是标题但不是当前选中的推理链，不允许编辑
    if (isTitle && !currentChainId) return;
    
    // 如果是列表项但没有 chainId，不允许编辑
    const chainId = isTitle ? currentChainId : (chainItem?.dataset?.chainId);
    if (!chainId) return;
    
    element.contentEditable = true;
    element.focus();
    
    // 保存原始内容，以便取消编辑时恢复
    const originalContent = element.textContent;
    
    // 使用防抖进行实时保存
    let saveTimeout;
    const debouncedSave = () => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            const newContent = element.textContent.trim();
            if (newContent && newContent !== originalContent) {
                const chains = JSON.parse(localStorage.getItem('aiPaletteChains') || '{}');
                if (chains[chainId]) {
                    chains[chainId].title = newContent;
                    localStorage.setItem('aiPaletteChains', JSON.stringify(chains));
                    
                    if (isTitle) {
                        // 更新列表项的标题
                        const listItem = document.querySelector(`li[data-chain-id="${chainId}"] span`);
                        if (listItem) {
                            listItem.textContent = newContent;
                        }
                    } else {
                        // 更新右侧标题
                        const titleElement = document.getElementById('chainTitle');
                        if (titleElement && chainId === currentChainId) {
                            titleElement.textContent = newContent;
                        }
                    }
                }
            }
        }, 300); // 300ms 的防抖延迟
    };
    
    // 监听输入事件进行实时保存
    element.addEventListener('input', debouncedSave);
    
    // 处理回车键
    element.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            element.blur();
        }
    });
    
    // 失去焦点时的处理
    element.addEventListener('blur', () => {
        element.contentEditable = false;
        const newContent = element.textContent.trim();
        
        // 如果内容为空，恢复原始内容
        if (!newContent) {
            element.textContent = originalContent;
        }
        
        // 清除输入事件监听器
        element.removeEventListener('input', debouncedSave);
    });
}

// 选择推理链
let currentChainId = null;
function selectChain(chainId) {
    // 移除其他列表项的选中状态
    document.querySelectorAll('#chainList li').forEach(item => {
        item.classList.remove('dark:bg-blue-600', 'bg-blue-100');
    });
    
    // 添加选中状态
    const selectedItem = document.querySelector(`li[data-chain-id="${chainId}"]`);
    if (selectedItem) {
        selectedItem.classList.add('dark:bg-blue-600', 'bg-blue-100');
    }
    
    // 加载推理链数据
    const chains = JSON.parse(localStorage.getItem('aiPaletteChains') || '{}');
    const chainData = chains[chainId];
    
    if (chainData) {
        // 启用右侧所有内容
        document.getElementById('thinkingPrompt').disabled = false;
        document.getElementById('resultPrompt').disabled = false;
        document.getElementById('thinkingModelType').disabled = false;
        document.getElementById('resultModelType').disabled = false;
        document.getElementById('chainTitle').classList.add('cursor-pointer');
        
        // 更新右侧内容
        document.getElementById('chainTitle').textContent = chainData.title;
        document.getElementById('thinkingPrompt').value = chainData.thinkingPrompt || '';
        document.getElementById('resultPrompt').value = chainData.resultPrompt || '';
        
        // 加载模型配置
        if (chainData.thinkingConfig) {
            document.getElementById('thinkingModelType').value = chainData.thinkingConfig.modelType;
            document.getElementById('thinkingModel').value = chainData.thinkingConfig.model;
            document.getElementById('thinkingApiKey').value = chainData.thinkingConfig.apiKey;
            
            // 根据是否继承设置输入框状态
            updateModelInputState('thinking', chainData.thinkingConfig.modelType === 'inherit');
        }
        
        if (chainData.resultConfig) {
            document.getElementById('resultModelType').value = chainData.resultConfig.modelType;
            document.getElementById('resultModel').value = chainData.resultConfig.model;
            document.getElementById('resultApiKey').value = chainData.resultConfig.apiKey;
            
            // 根据是否继承设置输入框状态
            updateModelInputState('result', chainData.resultConfig.modelType === 'inherit');
        }
        
        currentChainId = chainId;
        
        // 添加输入事件监听
        setupPromptListeners();
    }
}

// 设置 prompt 输入监听
function setupPromptListeners() {
    const thinkingPrompt = document.getElementById('thinkingPrompt');
    const resultPrompt = document.getElementById('resultPrompt');
    const thinkingModelType = document.getElementById('thinkingModelType');
    const thinkingModel = document.getElementById('thinkingModel');
    const thinkingApiKey = document.getElementById('thinkingApiKey');
    const resultModelType = document.getElementById('resultModelType');
    const resultModel = document.getElementById('resultModel');
    const resultApiKey = document.getElementById('resultApiKey');
    
    // 防抖函数
    const debounce = (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };
    
    // 保存更改到 localStorage
    const saveChanges = () => {
        if (currentChainId) {
            const chains = JSON.parse(localStorage.getItem('aiPaletteChains') || '{}');
            if (chains[currentChainId]) {
                chains[currentChainId].thinkingPrompt = thinkingPrompt.value;
                chains[currentChainId].resultPrompt = resultPrompt.value;
                chains[currentChainId].thinkingConfig = {
                    modelType: thinkingModelType.value,
                    model: thinkingModel.value,
                    apiKey: thinkingApiKey.value
                };
                chains[currentChainId].resultConfig = {
                    modelType: resultModelType.value,
                    model: resultModel.value,
                    apiKey: resultApiKey.value
                };
                localStorage.setItem('aiPaletteChains', JSON.stringify(chains));
            }
        }
    };
    
    // 使用防抖处理保存
    const debouncedSave = debounce(saveChanges, 300);
    
    // 添加输入事件监听器
    thinkingPrompt.addEventListener('input', debouncedSave);
    resultPrompt.addEventListener('input', debouncedSave);
    thinkingModelType.addEventListener('change', debouncedSave);
    thinkingModel.addEventListener('input', debouncedSave);
    thinkingApiKey.addEventListener('input', debouncedSave);
    resultModelType.addEventListener('change', debouncedSave);
    resultModel.addEventListener('input', debouncedSave);
    resultApiKey.addEventListener('input', debouncedSave);
    
    // 处理模型类型变化
    thinkingModelType.addEventListener('change', () => {
        const isInherit = thinkingModelType.value === 'inherit';
        updateModelInputState('thinking', isInherit);
        if (!isInherit) {
            // 先清空模型和key
            thinkingModel.value = '';
            thinkingApiKey.value = '';
            
            // 只自动填充 API Key
            const mainConfig = JSON.parse(localStorage.getItem('aiPaletteConfig') || '{}');
            const selectedType = thinkingModelType.value;
            if (mainConfig[`${selectedType}_apiKey`]) {
                thinkingApiKey.value = mainConfig[`${selectedType}_apiKey`];
            }
        }
        debouncedSave();
    });
    
    resultModelType.addEventListener('change', () => {
        const isInherit = resultModelType.value === 'inherit';
        updateModelInputState('result', isInherit);
        if (!isInherit) {
            // 先清空模型和key
            resultModel.value = '';
            resultApiKey.value = '';
            
            // 只自动填充 API Key
            const mainConfig = JSON.parse(localStorage.getItem('aiPaletteConfig') || '{}');
            const selectedType = resultModelType.value;
            if (mainConfig[`${selectedType}_apiKey`]) {
                resultApiKey.value = mainConfig[`${selectedType}_apiKey`];
            }
        }
        debouncedSave();
    });
}

// 更新模型输入框状态
function updateModelInputState(type, isInherit) {
    const modelInput = document.getElementById(`${type}Model`);
    const apiKeyInput = document.getElementById(`${type}ApiKey`);
    const modelTypeSelect = document.getElementById(`${type}ModelType`);
    
    if (isInherit) {
        modelInput.disabled = true;
        apiKeyInput.disabled = true;
        modelInput.value = '';
        apiKeyInput.value = '';
        modelInput.placeholder = '';
        apiKeyInput.placeholder = '';
        
        // 隐藏模型选择下拉框
        if (window[`${type}ModelDropdown`]) {
            window[`${type}ModelDropdown`].classList.add('hidden');
        }
    } else {
        modelInput.disabled = false;
        apiKeyInput.disabled = false;
        modelInput.placeholder = '选择或输入模型名称';
        apiKeyInput.placeholder = '输入 API Key';
        
        // 从主配置获取当前类型的 API Key
        const mainConfig = JSON.parse(localStorage.getItem('aiPaletteConfig') || '{}');
        const selectedType = modelTypeSelect.value;
        if (mainConfig[`${selectedType}_apiKey`]) {
            apiKeyInput.value = mainConfig[`${selectedType}_apiKey`];
        }
        
        // 获取并显示模型列表
        refreshChainModels(type);
    }
}

// 刷新推理链模型列表
async function refreshChainModels(type) {
    const modelTypeSelect = document.getElementById(`${type}ModelType`);
    const modelInput = document.getElementById(`${type}Model`);
    const apiKeyInput = document.getElementById(`${type}ApiKey`);
    const modelType = modelTypeSelect.value;
    
    try {
        // 显示加载状态
        modelInput.placeholder = '加载中...';
        modelInput.disabled = true;
        
        const response = await fetch(`/api/models?type=${modelType}&api_key=${apiKeyInput.value}`);
        const data = await response.json();
        
        if (data.success) {
            // 保存模型列表到全局变量
            window[`${type}Models`] = data.models || [];
            
            // 创建或更新下拉框
            createModelDropdown(type);
            
            // 如果有模型，显示下拉框
            if (window[`${type}Models`].length > 0) {
                modelInput.placeholder = '选择或输入模型名称';
            } else {
                modelInput.placeholder = '未找到可用模型';
            }
        } else {
            showError(data.error || '获取模型列表失败');
            modelInput.placeholder = '获取模型失败';
            window[`${type}Models`] = [];
        }
    } catch (error) {
        showError('获取模型列表失败: ' + error.message);
        modelInput.placeholder = '获取模型失败';
        window[`${type}Models`] = [];
    } finally {
        modelInput.disabled = false;
    }
}

// 创建模型下拉框
function createModelDropdown(type) {
    const modelInput = document.getElementById(`${type}Model`);
    if (!modelInput) return; // 如果输入框不存在，直接返回
    
    // 如果下拉框不存在，创建一个
    let dropdown = window[`${type}ModelDropdown`];
    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id = `${type}ModelDropdown`;
        dropdown.className = 'hidden absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-auto rounded-lg dark:bg-slate-700 bg-white dark:border-slate-600 border-slate-200 border shadow-lg';
        
        // 创建模型列表容器
        const modelList = document.createElement('div');
        modelList.id = `${type}ModelList`;
        modelList.className = 'py-1';
        dropdown.appendChild(modelList);
        
        // 将下拉框插入到输入框后面
        modelInput.parentNode.style.position = 'relative';
        modelInput.parentNode.appendChild(dropdown);
        window[`${type}ModelDropdown`] = dropdown;
        
        // 添加点击事件监听
        document.addEventListener('click', (e) => {
            if (!modelInput.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });
        
        // 添加输入框点击事件
        modelInput.addEventListener('click', () => {
            if (window[`${type}Models`]?.length > 0) {
                updateModelList(type, modelInput.value);
                dropdown.classList.remove('hidden');
            }
        });
        
        // 添加输入事件
        modelInput.addEventListener('input', () => {
            if (window[`${type}Models`]?.length > 0) {
                updateModelList(type, modelInput.value);
                dropdown.classList.remove('hidden');
            }
        });
    }
    
    // 确保下拉框和列表容器存在后再更新列表
    if (document.getElementById(`${type}ModelList`)) {
        updateModelList(type, modelInput.value);
    }
}

// 更新模型列表
function updateModelList(type, query) {
    const modelList = document.getElementById(`${type}ModelList`);
    if (!modelList) return; // 如果元素不存在，直接返回
    
    const models = window[`${type}Models`] || [];
    const filteredModels = query ? 
        models.filter(model => model.toLowerCase().includes(query.toLowerCase())) : 
        models;
    
    modelList.innerHTML = '';
    
    if (filteredModels.length === 0) {
        const noModels = document.createElement('div');
        noModels.className = 'px-4 py-2 dark:text-slate-400 text-slate-500 text-center';
        noModels.textContent = '没有可用的模型';
        modelList.appendChild(noModels);
        return;
    }
    
    filteredModels.forEach(model => {
        const option = document.createElement('div');
        option.className = 'px-4 py-2 dark:hover:bg-slate-600 hover:bg-slate-100 cursor-pointer dark:text-slate-200 text-slate-700';
        option.textContent = model;
        option.onclick = () => {
            document.getElementById(`${type}Model`).value = model;
            window[`${type}ModelDropdown`].classList.add('hidden');
            // 触发保存
            document.getElementById(`${type}Model`).dispatchEvent(new Event('input'));
        };
        modelList.appendChild(option);
    });
}

// 添加双链推理配置模态框切换函数
function toggleChainModal() {
    const modal = document.getElementById('chainModal');
    const modalContent = modal.querySelector('.scale-100, .scale-95');
    
    if (modal.classList.contains('opacity-0')) {
        // 显示模态框
        modal.classList.remove('opacity-0', 'pointer-events-none');
        if (modalContent) {
            modalContent.classList.remove('scale-95');
            modalContent.classList.add('scale-100');
        }
        
        // 检查是否有选中的条目，如果没有则选中第一个
        if (!currentChainId) {
            const firstChainItem = document.querySelector('#chainList li');
            if (firstChainItem) {
                const chainId = firstChainItem.dataset.chainId;
                selectChain(chainId);
            }
        }
    } else {
        // 隐藏模态框
        if (modalContent) {
            modalContent.classList.remove('scale-100');
            modalContent.classList.add('scale-95');
        }
        setTimeout(() => {
            modal.classList.add('opacity-0', 'pointer-events-none');
        }, 300);
    }
}

// 在页面加载时初始化模型输入框状态
window.addEventListener('load', () => {
    // 初始化思考和结果的模型输入框状态
    updateModelInputState('thinking', true);
    updateModelInputState('result', true);
    
    // ... 其他现有的初始化代码 ...
});

// 保存推理链数据
function saveChainData(chainData) {
    const chains = JSON.parse(localStorage.getItem('aiPaletteChains') || '{}');
    chains[chainData.id] = chainData;
    localStorage.setItem('aiPaletteChains', JSON.stringify(chains));
}

// 导出推理链
function exportChain() {
    if (!currentChainId) {
        showError('请先选择一个推理链');
        return;
    }

    const chains = JSON.parse(localStorage.getItem('aiPaletteChains') || '{}');
    const chainData = chains[currentChainId];

    if (!chainData) {
        showError('找不到推理链数据');
        return;
    }

    // 创建导出数据
    const exportData = {
        title: chainData.title,
        thinkingPrompt: chainData.thinkingPrompt,
        resultPrompt: chainData.resultPrompt,
        thinkingConfig: chainData.thinkingConfig,
        resultConfig: chainData.resultConfig,
        exportTime: new Date().toISOString()
    };

    // 创建并下载文件
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${chainData.title}_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 导入推理链
function importChain() {
    // 创建文件输入元素
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importData = JSON.parse(e.target.result);
                
                // 验证导入数据的格式
                if (!importData.title || !importData.thinkingPrompt || !importData.resultPrompt || 
                    !importData.thinkingConfig || !importData.resultConfig) {
                    throw new Error('导入文件格式不正确');
                }

                // 创建新的推理链
                const chainId = 'chain_' + Date.now();
                const chainData = {
                    id: chainId,
                    title: importData.title,
                    thinkingPrompt: importData.thinkingPrompt,
                    resultPrompt: importData.resultPrompt,
                    thinkingConfig: importData.thinkingConfig,
                    resultConfig: importData.resultConfig
                };

                // 保存推理链数据
                saveChainData(chainData);

                // 创建新的列表项
                const chainList = document.getElementById('chainList');
                const newChain = document.createElement('li');
                newChain.className = 'flex items-center justify-between px-3 py-2 rounded-lg dark:bg-slate-700 bg-slate-100 dark:text-slate-300 text-slate-600 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors duration-200';
                newChain.dataset.chainId = chainId;
                
                newChain.innerHTML = `
                    <div class="flex items-center justify-between w-full">
                        <span class="flex-1 truncate" ondblclick="makeEditable(this)">${importData.title}</span>
                        <button onclick="deleteChain(this)" class="p-1.5 dark:hover:bg-slate-600 hover:bg-slate-200 dark:text-slate-400 text-slate-600 flex items-center justify-center">
                            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                `;
                
                // 添加点击事件
                newChain.addEventListener('click', (e) => {
                    if (!e.target.closest('button')) {
                        selectChain(chainId);
                    }
                });
                
                chainList.appendChild(newChain);
                
                // 选中新导入的推理链
                selectChain(chainId);

                showSuccess('推理链导入成功');
            } catch (error) {
                showError('导入失败: ' + error.message);
            }
        };
        reader.readAsText(file);
    };

    input.click();
}

// 验证结果 Prompt 是否包含思考占位符
function validateResultPrompt(textarea) {
    const content = textarea.value;
    const warningId = 'resultPromptWarning';
    const existingWarning = document.getElementById(warningId);
    const placeholderText = textarea.parentNode.querySelector('.text-xs');
    
    if (content && !content.includes('[$thought$]')) {
        // 添加红色边框和文字
        textarea.classList.add('border-red-500');
        placeholderText.className = 'text-xs text-red-500 mb-2';
    } else {
        // 恢复正常颜色
        textarea.classList.remove('border-red-500');
        placeholderText.className = 'text-xs dark:text-slate-400 text-slate-500 mb-2';
        // 移除警告（如果存在）
        if (existingWarning) {
            existingWarning.remove();
        }
    }
}

// 验证思考 Prompt 是否包含用户请求占位符
function validateThinkingPrompt(textarea) {
    const content = textarea.value;
    const warningId = 'thinkingPromptWarning';
    const existingWarning = document.getElementById(warningId);
    const placeholderText = textarea.parentNode.querySelector('.text-xs');
    
    if (content && !content.includes('[$query$]')) {
        // 添加红色边框和文字
        textarea.classList.add('border-red-500');
        placeholderText.className = 'text-xs text-red-500 mb-2';
        
    } else {
        // 恢复正常颜色
        textarea.classList.remove('border-red-500');
        placeholderText.className = 'text-xs dark:text-slate-400 text-slate-500 mb-2';
        // 移除警告（如果存在）
        if (existingWarning) {
            existingWarning.remove();
        }
    }
}

// 验证结果 Prompt 是否包含必要的占位符
function validateResultPrompt(textarea) {
    const content = textarea.value;
    const warningId = 'resultPromptWarning';
    const existingWarning = document.getElementById(warningId);
    const placeholderText = textarea.parentNode.querySelector('.text-xs');
    const missingPlaceholders = [];
    
    if (content) {
        if (!content.includes('[$thought$]')) {
            missingPlaceholders.push('思考占位符 [$thought$]');
        }
        if (!content.includes('[$query$]')) {
            missingPlaceholders.push('用户请求占位符 [$query$]');
        }
    }
    
    if (content && missingPlaceholders.length > 0) {
        // 添加红色边框和文字
        textarea.classList.add('border-red-500');
        placeholderText.className = 'text-xs text-red-500 mb-2';
    } else {
        // 恢复正常颜色
        textarea.classList.remove('border-red-500');
        placeholderText.className = 'text-xs dark:text-slate-400 text-slate-500 mb-2';
        // 移除警告（如果存在）
        if (existingWarning) {
            existingWarning.remove();
        }
    }
}

// 在光标位置插入文本
function insertAtCursor(elementId, text) {
    const textarea = document.getElementById(elementId);
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    
    textarea.value = value.substring(0, start) + text + value.substring(end);
    
    // 设置新的光标位置
    const newCursorPos = start + text.length;
    textarea.setSelectionRange(newCursorPos, newCursorPos);
    
    // 聚焦文本框
    textarea.focus();
}

function showChainInfo() {
    const modal = document.getElementById('chainInfoModal');
    const backdrop = modal.querySelector('.backdrop-blur-sm');
    const content = modal.querySelector('.transform');
    
    // 显示模态框
    modal.classList.remove('hidden');
    
    // 添加淡入效果
    requestAnimationFrame(() => {
        backdrop.classList.remove('opacity-0');
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    });
}

function hideChainInfo() {
    const modal = document.getElementById('chainInfoModal');
    const backdrop = modal.querySelector('.backdrop-blur-sm');
    const content = modal.querySelector('.transform');
    
    // 添加淡出效果
    backdrop.classList.add('opacity-0');
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');
    
    // 延迟隐藏模态框
    setTimeout(() => {
        modal.classList.add('hidden');
        // 重置状态
        content.classList.remove('scale-95');
    }, 300);
}

// 点击模态框外部关闭
document.getElementById('chainInfoModal').addEventListener('click', function(e) {
    if (e.target === this || e.target.classList.contains('backdrop-blur-sm')) {
        hideChainInfo();
    }
});

// 阻止模态框内容的点击事件冒泡
document.querySelector('#chainInfoModal .transform').addEventListener('click', function(e) {
    e.stopPropagation();
});