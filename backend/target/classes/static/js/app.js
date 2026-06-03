// frontend/js/app.js - 完整版

// ========== 全局变量 ==========
let video = null;
let canvas = null;
let ctx = null;
let ws = null;
let isStreaming = false;
let animationFrame = null;
let lastFrameTime = 0;
let fps = 0;
let frameCount = 0;
let detectionHistory = [];
let currentGestures = []; // 当前检测到的手势
let llmMode = 'mock'; // LLM模式

// API基础URL
const API_BASE = 'http://localhost:8000';

// ========== DOM元素 ==========
const videoElement = document.getElementById('videoElement');
const overlayCanvas = document.getElementById('overlayCanvas');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const snapshotBtn = document.getElementById('snapshotBtn');
const apiStatus = document.getElementById('apiStatus');
const llmStatus = document.getElementById('llmStatus');
const classesCount = document.getElementById('classesCount');
const classesList = document.getElementById('classesList');
const currentSign = document.getElementById('currentSign');
const currentConfidence = document.getElementById('currentConfidence');
const detectionsContainer = document.getElementById('detections');
const detectionCount = document.getElementById('detectionCount');
const detectionBadge = document.getElementById('detectionBadge');
const fpsSpan = document.getElementById('fps');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const understandBtn = document.getElementById('understandBtn');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const llmModelSelect = document.getElementById('llmModelSelect');
const apiKeyInput = document.getElementById('apiKeyInput');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', init);

async function init() {
    console.log('🚀 初始化前端应用...');

    // 检查API连接
    await checkApiStatus();

    // 加载手势类别
    await loadClasses();

    // 加载对话历史
    await loadHistory();

    // 设置画布
    if (overlayCanvas) {
        ctx = overlayCanvas.getContext('2d');
    }

    // 绑定事件
    startBtn.addEventListener('click', startCamera);
    stopBtn.addEventListener('click', stopCamera);
    snapshotBtn.addEventListener('click', takeSnapshot);
    sendBtn.addEventListener('click', sendMessage);
    understandBtn.addEventListener('click', understandGestures);
    clearHistoryBtn.addEventListener('click', clearHistory);
    saveSettingsBtn.addEventListener('click', saveSettings);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // 标签页切换
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const tabId = btn.dataset.tab;
            document.getElementById(`${tabId}Tab`).classList.add('active');
        });
    });
}

// ========== API 状态检查 ==========
async function checkApiStatus() {
    try {
        const response = await fetch(`${API_BASE}/health`);
        const data = await response.json();

        if (data.status === 'healthy') {
            apiStatus.innerHTML = '✅ API已连接';
            apiStatus.style.color = '#48bb78';

            // 更新LLM状态
            if (data.llm) {
                llmStatus.innerHTML = `🤖 LLM: ${data.llm.type}`;
                llmMode = data.llm.type;
            }
        } else {
            apiStatus.innerHTML = '❌ API连接异常';
            apiStatus.style.color = '#e53e3e';
        }
    } catch (error) {
        console.error('API连接失败:', error);
        apiStatus.innerHTML = '❌ API连接失败';
        apiStatus.style.color = '#e53e3e';
    }
}

// ========== 加载手势类别 ==========
async function loadClasses() {
    try {
        const response = await fetch(`${API_BASE}/classes`);
        const data = await response.json();

        if (data.classes) {
            classesCount.innerHTML = `📊 支持 ${data.count} 个手势`;

            // 显示类别列表
            classesList.innerHTML = data.classes.map(cls =>
                `<div class="class-tag">${cls}</div>`
            ).join('');
        }
    } catch (error) {
        console.error('加载类别失败:', error);
        classesCount.innerHTML = '❌ 加载失败';
    }
}

// ========== 加载对话历史 ==========
async function loadHistory() {
    try {
        const response = await fetch(`${API_BASE}/history`);
        const data = await response.json();

        if (data.history && data.history.length > 0) {
            historyList.innerHTML = data.history.map(item => {
                const time = new Date(item.timestamp * 1000).toLocaleTimeString();
                return `
                    <div class="history-item">
                        <span class="time">${time}</span>
                        <span class="role">${item.role}:</span>
                        <span>${item.content}</span>
                    </div>
                `;
            }).join('');
        }
    } catch (error) {
        console.error('加载历史失败:', error);
    }
}

// ========== 摄像头控制 ==========
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: 640,
                height: 480,
                facingMode: 'user'
            }
        });

        videoElement.srcObject = stream;
        isStreaming = true;

        // 更新按钮状态
        startBtn.disabled = true;
        stopBtn.disabled = false;
        snapshotBtn.disabled = false;
        chatInput.disabled = false;
        sendBtn.disabled = false;
        understandBtn.disabled = false;

        // 连接WebSocket
        connectWebSocket();

        // 开始处理视频
        videoElement.play();
        animationFrame = requestAnimationFrame(processVideo);

        addSystemMessage('📷 摄像头已开启');

    } catch (error) {
        console.error('摄像头启动失败:', error);
        alert('无法访问摄像头，请检查权限');
    }
}

function stopCamera() {
    if (videoElement.srcObject) {
        const tracks = videoElement.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        videoElement.srcObject = null;
    }

    if (ws) {
        ws.close();
        ws = null;
    }

    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
    }

    isStreaming = false;

    // 更新按钮状态
    startBtn.disabled = false;
    stopBtn.disabled = true;
    snapshotBtn.disabled = true;
    chatInput.disabled = true;
    sendBtn.disabled = true;
    understandBtn.disabled = true;

    // 清空画布
    if (ctx) {
        ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    }

    // 清空检测结果
    detectionsContainer.innerHTML = '<div class="placeholder">等待检测...</div>';
    currentSign.textContent = '-';
    currentConfidence.textContent = '';
    detectionCount.textContent = '0';
    detectionBadge.textContent = '0';
    currentGestures = [];

    addSystemMessage('📹 摄像头已关闭');
}

// ========== WebSocket 连接 ==========
function connectWebSocket() {
    ws = new WebSocket('ws://localhost:5001');  // 修改为正确的端口

    ws.onopen = () => {
        console.log('WebSocket连接成功');
        addSystemMessage('🔗 已连接到YOLO+LSTM识别服务');
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            
            // 处理不同类型的WebSocket消息
            if (data.type === 'status' || data.connected !== undefined) {
                console.log('WS Status:', data.message);
                return;
            }
            
            if (data.error || data.type === 'error') {
                console.error('WS Error:', data.message);
                addSystemMessage(`❌ ${data.message}`);
                return;
            }
            
            // 处理识别结果
            if (data.gesture !== undefined || data.detected !== undefined) {
                displayRecognitionResult(data);
            }
        } catch (e) {
            console.error('解析WebSocket消息失败:', e);
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket错误:', error);
        addSystemMessage('❌ WebSocket连接错误，请确保Python服务已启动');
    };

    ws.onclose = () => {
        console.log('WebSocket连接关闭');
        addSystemMessage('🔌 识别服务连接已断开');
    };
}

// ========== 视频处理 ==========
function processVideo(timestamp) {
    if (!isStreaming || !ws || ws.readyState !== WebSocket.OPEN) {
        animationFrame = requestAnimationFrame(processVideo);
        return;
    }

    // 计算FPS
    if (lastFrameTime) {
        const delta = timestamp - lastFrameTime;
        fps = Math.round(1000 / delta);
        fpsSpan.textContent = fps;
    }
    lastFrameTime = timestamp;

    // 发送视频帧
    if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        const tempCtx = canvas.getContext('2d');

        // 镜像绘制（让用户感觉自然）
        tempCtx.translate(canvas.width, 0);
        tempCtx.scale(-1, 1);
        tempCtx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(blob => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(blob);
            }
        }, 'image/jpeg', 0.8);
    }

    animationFrame = requestAnimationFrame(processVideo);
}

// ========== 显示检测结果 ==========
function displayDetections(data) {
    const detections = data.detections || [];
    const count = data.count || 0;

    // 更新计数
    detectionCount.textContent = count;
    detectionBadge.textContent = count;
    currentGestures = detections;

    // 绘制检测框
    drawDetections(detections);

    // 更新检测列表
    if (detections.length > 0) {
        // 取置信度最高的作为当前手势
        const top = detections.reduce((max, d) =>
            d.confidence > max.confidence ? d : max
        );

        currentSign.textContent = top.label;
        currentConfidence.textContent = `${(top.confidence * 100).toFixed(1)}%`;

        // 显示检测列表
        detectionsContainer.innerHTML = detections.map(d => `
            <div class="detection-item">
                <span class="label">${d.label}</span>
                <span class="confidence">${(d.confidence * 100).toFixed(1)}%</span>
            </div>
        `).join('');

        // 添加到历史（每10帧添加一次）
        if (frameCount % 10 === 0) {
            addToHistory(top);
        }
    } else {
        currentSign.textContent = '-';
        currentConfidence.textContent = '';
        detectionsContainer.innerHTML = '<div class="placeholder">未检测到手势</div>';
    }
}

// ========== 显示YOLO+LSTM识别结果（新）==========
function displayRecognitionResult(data) {
    const gesture = data.gesture;
    const confidence = data.confidence || 0;
    const state = data.state || 'unknown';
    const sequenceLength = data.sequence_length || 0;
    const seqRequired = data.seq_required || 30;
    const isNewGesture = data.is_new_gesture || false;
    
    // 处理完整句子（优先显示）
    if (data.is_sentence_complete && data.complete_sentence) {
        displayCompleteSentence(data.complete_sentence, data.gesture_sequence || []);
    }
    
    // 更新当前手势显示
    if (gesture && state === 'ready') {
        currentSign.textContent = gesture;
        currentConfidence.textContent = `${(confidence * 100).toFixed(1)}%`;
        
        // 显示识别状态
        detectionCount.textContent = '1';
        detectionBadge.textContent = '✓';
        
        // 显示检测结果
        detectionsContainer.innerHTML = `
            <div class="detection-item active">
                <span class="label">${gesture}</span>
                <span class="confidence">${(confidence * 100).toFixed(1)}%</span>
                <span class="state-badge ${isNewGesture ? 'new' : ''}">${isNewGesture ? 'NEW' : ''}</span>
            </div>
        `;
        
        // 如果是新手势，添加到历史
        if (isNewGesture) {
            addToHistory({
                label: gesture,
                confidence: confidence
            });
        }
    } else if (state === 'collecting') {
        // 显示收集进度
        currentSign.textContent = '收集帧...';
        currentConfidence.textContent = `${sequenceLength}/${seqRequired}`;
        
        detectionCount.textContent = '0';
        detectionBadge.textContent = `${sequenceLength}`;
        
        detectionsContainer.innerHTML = `
            <div class="detection-item collecting">
                <span class="label">收集中...</span>
                <span class="confidence">${sequenceLength}/${seqRequired} 帧</span>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${(sequenceLength / seqRequired * 100)}%"></div>
                </div>
            </div>
        `;
    } else {
        currentSign.textContent = '-';
        currentConfidence.textContent = '';
        detectionCount.textContent = '0';
        detectionBadge.textContent = '0';
        detectionsContainer.innerHTML = '<div class="placeholder">等待手势输入</div>';
    }
    
    // 更新FPS（如果后端返回了）
    if (data.fps) {
        fpsSpan.textContent = data.fps;
    }
}

// ========== 显示完整翻译句子 ==========
function displayCompleteSentence(sentence, gestureSequence) {
    // 添加系统消息显示完整句子
    addSystemMessage(`✅ 识别完成: ${sentence}`);
    
    // 在聊天区域显示翻译结果
    if (chatMessages) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system-message';
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-header">
                    <span class="message-role">🤖 手语翻译</span>
                    <span class="message-time">${new Date().toLocaleTimeString()}</span>
                </div>
                <div class="message-text">
                    <div class="gesture-sequence">手势序列: ${gestureSequence.join(' → ')}</div>
                    <div class="translated-sentence">翻译结果: <strong>${sentence}</strong></div>
                </div>
            </div>
        `;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // 更新当前手势显示为完整句子
    if (currentSign) {
        currentSign.textContent = sentence;
        currentSign.style.fontSize = '18px';
        currentSign.style.color = '#48bb78';
    }
    if (currentConfidence) {
        currentConfidence.textContent = `${gestureSequence.length}个手势`;
    }
    
    // 3秒后恢复样式
    setTimeout(() => {
        if (currentSign) {
            currentSign.style.fontSize = '';
            currentSign.style.color = '';
        }
    }, 3000);
}

// ========== 绘制检测框 ==========
function drawDetections(detections) {
    if (!ctx || !overlayCanvas) return;

    // 设置画布尺寸
    overlayCanvas.width = videoElement.videoWidth;
    overlayCanvas.height = videoElement.videoHeight;

    // 清空画布
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    // 绘制每个检测框
    detections.forEach(d => {
        const [x1, y1, x2, y2] = d.bbox;

        // 镜像坐标转换（因为视频是镜像的）
        const mirroredX1 = overlayCanvas.width - x2;
        const mirroredX2 = overlayCanvas.width - x1;

        // 绘制矩形
        ctx.strokeStyle = '#48bb78';
        ctx.lineWidth = 3;
        ctx.strokeRect(mirroredX1, y1, mirroredX2 - mirroredX1, y2 - y1);

        // 绘制标签背景
        ctx.fillStyle = '#48bb78';
        ctx.font = '14px Arial';
        const text = `${d.label} ${(d.confidence * 100).toFixed(1)}%`;
        const textWidth = ctx.measureText(text).width;

        ctx.fillRect(mirroredX1, y1 - 25, textWidth + 10, 20);
        ctx.fillStyle = 'white';
        ctx.fillText(text, mirroredX1 + 5, y1 - 10);
    });
}

// ========== 添加到历史 ==========
function addToHistory(detection) {
    const historyItem = {
        label: detection.label,
        confidence: detection.confidence,
        time: new Date().toLocaleTimeString()
    };

    detectionHistory.unshift(historyItem);

    // 只保留最近20条
    if (detectionHistory.length > 20) {
        detectionHistory.pop();
    }
}

// ========== 拍照识别 ==========
async function takeSnapshot() {
    if (!isStreaming) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const tempCtx = canvas.getContext('2d');

    // 镜像绘制
    tempCtx.translate(canvas.width, 0);
    tempCtx.scale(-1, 1);
    tempCtx.drawImage(videoElement, 0, 0);

    canvas.toBlob(async (blob) => {
        const formData = new FormData();
        formData.append('file', blob, 'snapshot.jpg');

        try {
            addSystemMessage('📸 拍照识别中...');

            const response = await fetch(`${API_BASE}/detect`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                displayDetections({ detections: data.detections, count: data.count });
                addSystemMessage(`✅ 识别完成，检测到 ${data.count} 个手势`);
            }
        } catch (error) {
            console.error('拍照识别失败:', error);
            addSystemMessage('❌ 识别失败');
        }
    }, 'image/jpeg');
}

// ========== 发送消息 ==========
async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message && currentGestures.length === 0) {
        addSystemMessage('请说话或做手势');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: message,
                gestures: currentGestures
            })
        });

        const data = await response.json();

        // 显示用户消息
        addChatMessage('user', message || '做了手势');

        // 显示助手回复
        addChatMessage('assistant', data.response);

        // 清空输入
        chatInput.value = '';

    } catch (error) {
        console.error('发送消息失败:', error);
        addSystemMessage('❌ 发送失败');
    }
}

// ========== 理解手势 ==========
async function understandGestures() {
    if (currentGestures.length === 0) {
        addSystemMessage('没有检测到手势');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/understand`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                gestures: currentGestures
            })
        });

        const data = await response.json();

        // 显示助手回复
        addChatMessage('assistant', data.response);

    } catch (error) {
        console.error('理解手势失败:', error);
        addSystemMessage('❌ 理解失败');
    }
}

// ========== 添加聊天消息 ==========
function addChatMessage(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    messageDiv.innerHTML = `<div class="content">${content}</div>`;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addSystemMessage(content) {
    addChatMessage('system', content);
}

// ========== 清空历史 ==========
async function clearHistory() {
    try {
        await fetch(`${API_BASE}/history/clear`, {
            method: 'POST'
        });

        detectionHistory = [];
        historyList.innerHTML = '<div class="placeholder">暂无历史记录</div>';
        addSystemMessage('🧹 历史已清空');

    } catch (error) {
        console.error('清空历史失败:', error);
    }
}

// ========== 保存设置 ==========
async function saveSettings() {
    const modelType = llmModelSelect.value;
    const apiKey = apiKeyInput.value;

    // 这里可以调用后端的设置接口
    llmMode = modelType;
    llmStatus.innerHTML = `🤖 LLM: ${modelType}`;

    addSystemMessage(`⚙️ LLM模式已切换为: ${modelType}`);

    // 清空API Key输入
    apiKeyInput.value = '';
}

// ========== 导出函数（供HTML调用） ==========
window.startCamera = startCamera;
window.stopCamera = stopCamera;
window.takeSnapshot = takeSnapshot;
window.sendMessage = sendMessage;
window.understandGestures = understandGestures;
window.clearHistory = clearHistory;