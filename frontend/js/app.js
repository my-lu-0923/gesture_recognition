// frontend/js/app.js - 实时翻译界面 (YOLO+LSTM混合识别)
console.log('=== app.js 混合识别版开始加载 ===');

// ========== 全局变量 ==========
let videoElement = null;
let overlayCanvas = null;
let ctx = null;
let mediaStream = null;
let isStreaming = false;
let animationFrame = null;
let lastFrameTime = 0;
let fps = 0;
let frameCount = 0;
let detectionHistory = [];
let currentGestures = [];
let gestureBuffer = [];
let gestureSequence = []; // 手势序列用于构建句子
let lastRecognitionTime = 0;
const RECOGNITION_INTERVAL = 50;
const BUFFER_SIZE = 5;
const CONFIDENCE_THRESHOLD = 0.6;

// API基础URL
const API_BASE = 'http://localhost:8080';
let useMockMode = false;

// 识别模式: 'yolo' | 'hybrid' | 'lstm' (默认使用 yolo，速度最快)
let recognitionMode = 'yolo';
let hybridAvailable = false;
let lstmAvailable = false;

// ========== 模拟手势库 ==========
const gestureLibrary = [
    "你好", "谢谢", "对不起", "朋友", "爱", "学习", "工作",
    "电脑", "手机", "早上", "晚上", "生日", "快乐", "帮助",
    "请", "是", "不是", "再见", "开始", "结束", "时间", "你",
    "我", "好", "人", "什么", "名字", "介绍", "认识", "结婚"
];

// ========== 检查后端服务状态 ==========
async function checkBackendStatus() {
    try {
        const response = await fetch(`${API_BASE}/health`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('后端状态:', data);
            
            // 优先使用 YOLO 序列识别器（最快）
            if (data.yolo_seq_loaded) {
                hybridAvailable = true;
                recognitionMode = 'hybrid';  // hybrid 路由会优先使用 yolo_seq_recognizer
                console.log('✅ YOLO序列LSTM识别器已启用（推荐）');
            } else if (data.hybrid_loaded) {
                hybridAvailable = true;
                recognitionMode = 'yolo';  // 使用纯YOLO模式，避免hybrid太慢
                console.log('⚠️ 混合识别器可用但较慢，使用YOLO快速模式');
            } else if (data.lstm_loaded) {
                lstmAvailable = true;
                recognitionMode = 'lstm';
                console.log('✅ LSTM识别器已启用');
            } else {
                recognitionMode = 'yolo';
                console.log('⚠️ 仅YOLO可用');
            }
            
            useMockMode = false;
            return true;
        }
    } catch (error) {
        console.log('后端服务不可用:', error);
        useMockMode = true;
        return false;
    }
}

// 页面加载时检查后端状态
checkBackendStatus();

// ========== DOM 元素引用 ==========
let startBtn = null;
let stopBtn = null;
let snapshotBtn = null;
let videoPlaceholder = null;
let cameraStatus = null;
let currentSign = null;
let currentConfidence = null;
let fpsSpan = null;
let engineType = null;
let detectionCount = null;
let sentenceDisplay = null;
let gestureSequenceEl = null;
let historyList = null;
let translateBtn = null;
let clearBtn = null;

// 模式按钮
let modeHybrid = null;
let modeYolo = null;
let modeLstm = null;

// ========== 获取DOM元素 ==========
function getElements() {
    console.log('获取DOM元素...');

    videoElement = document.getElementById('videoElement');
    overlayCanvas = document.getElementById('overlayCanvas');
    startBtn = document.getElementById('startBtn');
    stopBtn = document.getElementById('stopBtn');
    snapshotBtn = document.getElementById('snapshotBtn');
    videoPlaceholder = document.getElementById('videoPlaceholder');
    cameraStatus = document.getElementById('cameraStatus');
    currentSign = document.getElementById('currentSign');
    currentConfidence = document.getElementById('currentConfidence');
    fpsSpan = document.getElementById('fps');
    engineType = document.getElementById('engineType');
    detectionCount = document.getElementById('detectionCount');
    sentenceDisplay = document.getElementById('sentenceDisplay');
    gestureSequenceEl = document.getElementById('gestureSequence');
    historyList = document.getElementById('historyList');
    translateBtn = document.getElementById('translateBtn');
    clearBtn = document.getElementById('clearBtn');
    
    // 模式按钮
    modeHybrid = document.getElementById('modeHybrid');
    modeYolo = document.getElementById('modeYolo');
    modeLstm = document.getElementById('modeLstm');

    console.log('元素获取完成');
}

// ========== 更新状态显示 ==========
function updateStatus(message, type = 'info') {
    if (cameraStatus) {
        cameraStatus.textContent = message;
        const dot = cameraStatus.parentElement.querySelector('.status-dot');
        if (dot) {
            dot.style.background = type === 'success' ? '#4ade80' : 
                                   type === 'error' ? '#ef4444' : '#f59e0b';
        }
    }
}

// ========== 更新引擎类型显示 ==========
function updateEngineDisplay() {
    if (engineType) {
        const modeNames = {
            'hybrid': '混合模式',
            'yolo': 'YOLO快速',
            'lstm': 'LSTM精准'
        };
        engineType.textContent = modeNames[recognitionMode] || '未知';
    }
}

// ========== 平滑手势识别结果 ==========
function smoothGestureRecognition(gesture, confidence) {
    const now = Date.now();
    
    if (confidence < CONFIDENCE_THRESHOLD || !gesture) {
        return null;
    }
    
    gestureBuffer.push({ gesture, confidence, timestamp: now });
    
    if (gestureBuffer.length > BUFFER_SIZE) {
        gestureBuffer.shift();
    }
    
    if (gestureBuffer.length < 2) {
        return null;
    }
    
    const recentGestures = gestureBuffer.slice(-BUFFER_SIZE);
    const gestureCounts = {};
    
    recentGestures.forEach(item => {
        gestureCounts[item.gesture] = (gestureCounts[item.gesture] || 0) + 1;
    });
    
    const stableGesture = Object.entries(gestureCounts)
        .sort((a, b) => b[1] - a[1])[0];
    
    if (stableGesture && stableGesture[1] >= 2) {
        const avgConfidence = recentGestures
            .filter(item => item.gesture === stableGesture[0])
            .reduce((sum, item) => sum + item.confidence, 0) / stableGesture[1];
        
        return { gesture: stableGesture[0], confidence: avgConfidence };
    }
    
    return null;
}

// ========== 添加到手势序列 ==========
let lastAutoTranslateTime = 0;
const AUTO_TRANSLATE_INTERVAL = 3000; // 每3秒自动翻译一次

function addToSequence(gesture, confidence) {
    // 避免重复添加相同手势
    if (gestureSequence.length > 0) {
        const last = gestureSequence[gestureSequence.length - 1];
        if (last.gesture === gesture) {
            // 更新置信度
            last.confidence = Math.max(last.confidence, confidence);
            updateSequenceDisplay();
            return;
        }
    }
    
    gestureSequence.push({
        gesture,
        confidence: Math.round(confidence),
        time: new Date().toLocaleTimeString()
    });
    
    // 限制序列长度
    if (gestureSequence.length > 10) {
        gestureSequence.shift();
    }
    
    updateSequenceDisplay();
    updateSentenceDisplay();
    addToHistory(gesture);
    
    // 自动翻译：当序列有变化且超过一定时间后自动触发
    const now = Date.now();
    if (gestureSequence.length >= 2 && (now - lastAutoTranslateTime) > AUTO_TRANSLATE_INTERVAL) {
        lastAutoTranslateTime = now;
        autoTranslateSentence();
    }
}

// ========== 更新序列显示 ==========
function updateSequenceDisplay() {
    if (!gestureSequenceEl) return;
    
    gestureSequenceEl.innerHTML = gestureSequence.map(item => `
        <div class="gesture-tag">
            ${item.gesture}
            <span class="confidence">${item.confidence}%</span>
        </div>
    `).join('');
}

// ========== 更新句子显示 ==========
function updateSentenceDisplay() {
    if (!sentenceDisplay) return;
    
    if (gestureSequence.length === 0) {
        sentenceDisplay.textContent = '';
        return;
    }
    
    // 简单的句子构建逻辑
    const words = gestureSequence.map(item => item.gesture);
    sentenceDisplay.textContent = words.join('，');
}

// ========== 添加到历史记录 ==========
function addToHistory(gesture) {
    if (!historyList) return;
    
    const time = new Date().toLocaleTimeString();
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
        <span class="gesture">${gesture}</span>
        <span class="time">${time}</span>
    `;
    
    // 移除"等待识别..."
    if (historyList.children.length === 1 && 
        historyList.children[0].textContent.includes('等待识别')) {
        historyList.innerHTML = '';
    }
    
    historyList.insertBefore(item, historyList.firstChild);
    
    // 限制历史记录数量
    while (historyList.children.length > 20) {
        historyList.removeChild(historyList.lastChild);
    }
}

// ========== 后端识别 ==========
async function sendFrameToBackend(imageData) {
    const now = Date.now();
    if (now - lastRecognitionTime < RECOGNITION_INTERVAL) {
        return;
    }
    
    try {
        // 根据模式选择API端点
        let apiEndpoint;
        switch (recognitionMode) {
            case 'hybrid':
                apiEndpoint = `${API_BASE}/recognize_hybrid`;
                break;
            case 'lstm':
                apiEndpoint = `${API_BASE}/recognize_lstm`;
                break;
            default:
                apiEndpoint = `${API_BASE}/recognize`;
        }

        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: imageData })
        });

        if (!response.ok) throw new Error('API 请求失败');
        const data = await response.json();

        if (data.detected && data.current_gesture) {
            const confidence = data.confidence ? Math.round(data.confidence * 100) : 85;
            
            const smoothed = smoothGestureRecognition(data.current_gesture, confidence);
            
            if (smoothed) {
                if (currentSign) currentSign.textContent = smoothed.gesture;
                if (currentConfidence) {
                    currentConfidence.textContent = `置信度: ${Math.round(smoothed.confidence)}%`;
                }
                
                addToSequence(smoothed.gesture, smoothed.confidence);
                
                // 更新检测次数
                if (detectionCount) {
                    detectionCount.textContent = parseInt(detectionCount.textContent || 0) + 1;
                }
            } else {
                if (currentSign) currentSign.textContent = data.current_gesture;
                if (currentConfidence) currentConfidence.textContent = `置信度: ${confidence}%`;
            }
            
            lastRecognitionTime = now;
        }
        return true;
    } catch (error) {
        console.log('后端识别失败:', error);
        return false;
    }
}

// ========== 视频处理 ==========
function processVideo(timestamp) {
    if (!isStreaming || !mediaStream || !videoElement || !videoElement.videoWidth) {
        return;
    }

    // 计算 FPS
    if (lastFrameTime) {
        const delta = timestamp - lastFrameTime;
        if (delta > 0) {
            fps = Math.round(1000 / delta);
            if (fpsSpan) fpsSpan.textContent = fps;
        }
    }
    lastFrameTime = timestamp;

    // 每 2 帧发送一次识别
    frameCount++;
    if (frameCount % 2 === 0 && !useMockMode && isStreaming) {
        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        const tempCtx = canvas.getContext('2d');
        tempCtx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        sendFrameToBackend(imageData);
    }

    animationFrame = requestAnimationFrame(processVideo);
}

// ========== 绘制覆盖层 ==========
function drawOverlay() {
    if (!isStreaming) return;
    
    if (!overlayCanvas || !videoElement || !videoElement.videoWidth) {
        overlayAnimationId = requestAnimationFrame(drawOverlay);
        return;
    }

    if (overlayCanvas.clientWidth > 0) {
        overlayCanvas.width = overlayCanvas.clientWidth;
        overlayCanvas.height = overlayCanvas.clientHeight;

        if (ctx) {
            ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
            
            // 绘制识别区域框
            ctx.strokeStyle = '#667eea';
            ctx.lineWidth = 3;
            const rectX = overlayCanvas.width * 0.15;
            const rectY = overlayCanvas.height * 0.1;
            const rectW = overlayCanvas.width * 0.7;
            const rectH = overlayCanvas.height * 0.8;
            ctx.strokeRect(rectX, rectY, rectW, rectH);
            
            // 绘制提示文字
            ctx.font = "bold 16px 'Noto Sans SC'";
            ctx.fillStyle = '#667eea';
            ctx.fillText("🤟 请将手势放在框内", rectX + 10, rectY + 30);
        }
    }

    overlayAnimationId = requestAnimationFrame(drawOverlay);
}

let overlayAnimationId = null;

// ========== 摄像头控制 ==========
async function startCamera() {
    console.log('开始启动摄像头...');

    if (!videoElement) {
        alert('页面元素未加载完成，请刷新页面重试');
        return;
    }

    if (isStreaming) {
        alert('摄像头已开启');
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
        });

        mediaStream = stream;
        videoElement.srcObject = stream;
        isStreaming = true;
        
        gestureBuffer = [];
        frameCount = 0;

        // 更新按钮状态
        if (startBtn) startBtn.disabled = true;
        if (stopBtn) stopBtn.disabled = false;
        if (snapshotBtn) snapshotBtn.disabled = false;
        
        // 隐藏占位符
        if (videoPlaceholder) videoPlaceholder.style.display = 'none';
        
        // 更新状态
        updateStatus('识别中', 'success');

        // 开始播放视频
        await videoElement.play();
        
        // 开始处理循环
        if (animationFrame) cancelAnimationFrame(animationFrame);
        animationFrame = requestAnimationFrame(processVideo);
        
        // 开始绘制覆盖层
        if (overlayAnimationId) cancelAnimationFrame(overlayAnimationId);
        drawOverlay();

        console.log('✅ 摄像头启动成功');

    } catch (error) {
        console.error('摄像头启动失败:', error);
        alert('无法访问摄像头，请检查权限：' + error.message);
        updateStatus('启动失败', 'error');
    }
}

function stopCamera() {
    console.log('停止摄像头...');

    isStreaming = false;
    
    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
    }
    if (overlayAnimationId) {
        cancelAnimationFrame(overlayAnimationId);
        overlayAnimationId = null;
    }

    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
        if (videoElement) videoElement.srcObject = null;
    }

    // 更新按钮状态
    if (startBtn) startBtn.disabled = false;
    if (stopBtn) stopBtn.disabled = true;
    if (snapshotBtn) snapshotBtn.disabled = true;
    
    // 显示占位符
    if (videoPlaceholder) videoPlaceholder.style.display = 'flex';
    
    // 更新状态
    updateStatus('摄像头关闭');

    // 清空画布
    if (ctx && overlayCanvas) {
        ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    }
    
    // 重置显示
    if (currentSign) currentSign.textContent = '-';
    if (currentConfidence) currentConfidence.textContent = '置信度: 0%';
    if (fpsSpan) fpsSpan.textContent = '0';

    console.log('✅ 摄像头已关闭');
}

// 页面卸载时清理资源
window.addEventListener('beforeunload', () => {
    isStreaming = false;
    if (animationFrame) cancelAnimationFrame(animationFrame);
    if (overlayAnimationId) cancelAnimationFrame(overlayAnimationId);
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
    }
});

// ========== 拍照功能 ==========
function takeSnapshot() {
    if (!isStreaming || !videoElement || !videoElement.videoWidth) {
        alert('请先开启摄像头');
        return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const tempCtx = canvas.getContext('2d');
    tempCtx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    const imageDataURL = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `手势快照_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.png`;
    link.href = imageDataURL;
    link.click();
}

// ========== 切换识别模式 ==========
function switchMode(mode) {
    recognitionMode = mode;
    
    // 更新按钮样式
    [modeHybrid, modeYolo, modeLstm].forEach(btn => {
        if (btn) btn.classList.remove('active');
    });
    
    if (mode === 'hybrid' && modeHybrid) modeHybrid.classList.add('active');
    if (mode === 'yolo' && modeYolo) modeYolo.classList.add('active');
    if (mode === 'lstm' && modeLstm) modeLstm.classList.add('active');
    
    updateEngineDisplay();
    
    // 重置缓冲区
    gestureBuffer = [];
    
    console.log(`切换到${mode}模式`);
}

// ========== 智能翻译 ==========
async function translateSentence() {
    if (gestureSequence.length === 0) {
        alert('请先识别一些手势');
        return;
    }
    
    const words = gestureSequence.map(item => item.gesture).join('，');
    
    try {
        const response = await fetch(`${API_BASE}/translate/llm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                session_id: 'default',
                gestures: gestureSequence.map(item => ({ gloss: item.gesture }))
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.translation) {
            if (sentenceDisplay) {
                sentenceDisplay.innerHTML = `<strong>翻译结果：</strong>${data.translation}<br><small style="color:#64748b">原始序列：${words}</small>`;
            }
        } else {
            // 简单的本地翻译逻辑
            const simpleTranslation = gestureSequence.map(item => item.gesture).join('');
            if (sentenceDisplay) {
                sentenceDisplay.innerHTML = `<strong>翻译结果：</strong>${simpleTranslation}<br><small style="color:#64748b">（本地简单拼接）</small>`;
            }
        }
    } catch (error) {
        console.error('翻译失败:', error);
        const simpleTranslation = gestureSequence.map(item => item.gesture).join('');
        if (sentenceDisplay) {
            sentenceDisplay.innerHTML = `<strong>翻译结果：</strong>${simpleTranslation}`;
        }
    }
}

// ========== 自动翻译（后台静默调用）==========
async function autoTranslateSentence() {
    if (gestureSequence.length < 2) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/translate/llm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                session_id: 'default',
                gestures: gestureSequence.map(item => ({ gloss: item.gesture }))
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.translation) {
            if (sentenceDisplay) {
                sentenceDisplay.innerHTML = `<strong>实时翻译：</strong>${data.translation}<br><small style="color:#64748b">手势序列：${gestureSequence.map(item => item.gesture).join(' → ')}</small>`;
            }
        }
    } catch (error) {
        console.error('自动翻译失败:', error);
    }
}

// ========== 清空序列 ==========
function clearSequence() {
    gestureSequence = [];
    updateSequenceDisplay();
    if (sentenceDisplay) sentenceDisplay.textContent = '';
    gestureBuffer = [];
}

// ========== 绑定事件 ==========
function bindEvents() {
    console.log('绑定事件...');

    if (startBtn) startBtn.addEventListener('click', startCamera);
    if (stopBtn) stopBtn.addEventListener('click', stopCamera);
    if (snapshotBtn) snapshotBtn.addEventListener('click', takeSnapshot);
    if (translateBtn) translateBtn.addEventListener('click', translateSentence);
    if (clearBtn) clearBtn.addEventListener('click', clearSequence);
    
    // 模式切换
    if (modeHybrid) modeHybrid.addEventListener('click', () => switchMode('hybrid'));
    if (modeYolo) modeYolo.addEventListener('click', () => switchMode('yolo'));
    if (modeLstm) modeLstm.addEventListener('click', () => switchMode('lstm'));

    console.log('✅ 事件绑定完成');
}

// ========== 初始化 ==========
async function init() {
    console.log('🚀 初始化应用...');

    getElements();

    if (overlayCanvas) {
        ctx = overlayCanvas.getContext('2d');
    }

    await checkBackendStatus();
    updateEngineDisplay();
    bindEvents();
    
    console.log('✅ 初始化完成');
}

// 等待DOM加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// 导出全局函数
window.startCamera = startCamera;
window.stopCamera = stopCamera;
window.takeSnapshot = takeSnapshot;
window.switchMode = switchMode;
window.translateSentence = translateSentence;
window.clearSequence = clearSequence;

console.log('=== app.js 混合识别版加载完成 ===');
console.log('💡 提示：在控制台输入 startCamera() 开启摄像头');
