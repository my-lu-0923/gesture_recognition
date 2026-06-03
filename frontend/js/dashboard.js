// dashboard.js - 实时翻译页面 (左摄像头右结果布局)
console.log('=== dashboard.js 新版加载 ===');

// 引入智能句子构建器
const sentenceBuilder = new SmartSentenceBuilder();

// ========== 全局变量 ==========
let streamRef = null;
let rafId = null;
let frameCounter = 0;
let lastFpsTs = 0;

const CONFIG = {
    minConfidence: 0.40,
    sendEveryNFrames: 12,
    sendCooldownMs: 1000,
    stableWindowSize: 5,
    sequenceBufferMaxLen: 12,
    temporalWindowFrames: 15,
    displayStability: 0.30,
};

let lastSentGesture = null;
let lastSendTime = 0;
let gestureSequenceBuffer = [];
let temporalFrameHistory = [];
let isRecognizing = false;
let recognitionCount = 0;
let totalConfidence = 0;

// 识别模式: 'yolo' | 'hybrid' | 'lstm' (默认使用 lstm，YOLO+LSTM混合，准确率更高)
let recognitionMode = 'lstm';

// DOM元素
let video = null;
let canvas = null;
let ctx = null;
let startBtn = null;
let stopBtn = null;
let snapshotBtn = null;
let apiStatus = null;
let currentSign = null;
let currentConfidence = null;
let detections = null;
let fpsEl = null;
let todayCount = null;
let llmStatus = null;
let engineStatus = null;

// 新增DOM元素
let resultGesture = null;
let resultConfidence = null;
let resultTime = null;
let sentenceDisplay = null;
let gestureSequenceEl = null;
let historyList = null;
let translateBtn = null;
let clearBtn = null;
let speakBtn = null;
let statFps = null;
let statCount = null;
let statAvgConf = null;
let statStreak = null;
let historyCount = null;
let currentMode = null;

// 模式按钮
let modeHybrid = null;
let modeYolo = null;
let modeLstm = null;

// ========== 获取DOM元素 ==========
function grabElements() {
    video = document.getElementById('videoElement');
    canvas = document.getElementById('overlayCanvas');
    startBtn = document.getElementById('startBtn');
    stopBtn = document.getElementById('stopBtn');
    snapshotBtn = document.getElementById('snapshotBtn');
    apiStatus = document.getElementById('apiStatus');
    currentSign = document.getElementById('currentSign');
    currentConfidence = document.getElementById('currentConfidence');
    detections = document.getElementById('detections');
    fpsEl = document.getElementById('fps');
    todayCount = document.getElementById('todayCount');
    llmStatus = document.getElementById('llmStatus');
    engineStatus = document.getElementById('engineStatus');
    
    // 新增元素
    resultGesture = document.getElementById('resultGesture');
    resultConfidence = document.getElementById('resultConfidence');
    resultTime = document.getElementById('resultTime');
    sentenceDisplay = document.getElementById('sentenceDisplay');
    gestureSequenceEl = document.getElementById('gestureSequence');
    historyList = document.getElementById('historyList');
    translateBtn = document.getElementById('translateBtn');
    clearBtn = document.getElementById('clearBtn');
    speakBtn = document.getElementById('speakBtn');
    statFps = document.getElementById('statFps');
    statCount = document.getElementById('statCount');
    statAvgConf = document.getElementById('statAvgConf');
    statStreak = document.getElementById('statStreak');
    historyCount = document.getElementById('historyCount');
    currentMode = document.getElementById('currentMode');
    
    // 模式按钮
    modeHybrid = document.getElementById('modeHybrid');
    modeYolo = document.getElementById('modeYolo');
    modeLstm = document.getElementById('modeLstm');

    if (canvas) ctx = canvas.getContext('2d');

    const missing = [];
    if (!video) missing.push('videoElement');
    if (!canvas) missing.push('overlayCanvas');
    if (!startBtn) missing.push('startBtn');
    if (!stopBtn) missing.push('stopBtn');
    if (missing.length > 0) {
        console.error('[Dashboard] 缺少 DOM 元素:', missing);
        return false;
    }
    return true;
}

function setUserInfo() {
    if (typeof auth === "undefined") return;
    const user = auth.getUser();
    if (!user) return;
    const elUsername = document.getElementById("username");
    const elAvatar = document.getElementById("avatar");
    const elEmail = document.getElementById("userEmail");
    if (elUsername) elUsername.textContent = user.name || "演示用户";
    if (elAvatar) elAvatar.textContent = (user.avatar || "用").slice(0, 1);
    if (elEmail) elEmail.textContent = user.email || user.name;
}

// ========== 初始化 ==========
async function initDashboard() {
    console.log('🚀 [Dashboard] 开始初始化...');

    if (!grabElements()) {
        console.error('❌ [Dashboard] 关键 DOM 元素缺失，初始化中止');
        return;
    }

    setUserInfo();

    try {
        const health = await SignAPI.health();
        if (apiStatus) {
            apiStatus.textContent = health.status === "healthy" ? "API 已连接" : "API 异常";
        }
        // 检查后端支持的引擎
        if (health.hybrid_loaded) {
            recognitionMode = 'hybrid';
            if (engineStatus) engineStatus.textContent = "混合模式";
            if (currentMode) currentMode.textContent = "混合";
        } else if (health.lstm_loaded) {
            recognitionMode = 'lstm';
            if (engineStatus) engineStatus.textContent = "LSTM";
            if (currentMode) currentMode.textContent = "LSTM";
        } else {
            recognitionMode = 'yolo';
            if (engineStatus) engineStatus.textContent = "YOLO";
            if (currentMode) currentMode.textContent = "YOLO";
        }
    } catch (e) {
        if (apiStatus) apiStatus.textContent = "API 连接失败";
    }

    try {
        const stats = await SignAPI.getHistoryStats();
        if (stats && stats.success && todayCount) {
            todayCount.textContent = stats.todayCount || 0;
        }
    } catch (e) { /* ignore */ }

    try {
        const llmRes = await SignAPI.getLLMStatus();
        if (llmStatus) {
            llmStatus.textContent = llmRes.available ? "LLM 已启用" : "规则模式";
        }
    } catch (e) {
        if (llmStatus) llmStatus.textContent = "规则模式";
    }

    // 绑定事件
    startBtn.addEventListener("click", dashboard_startCamera);
    stopBtn.addEventListener("click", dashboard_stopCamera);
    snapshotBtn.addEventListener("click", dashboard_snapshotRecognize);
    
    if (translateBtn) translateBtn.addEventListener("click", handleTranslate);
    if (clearBtn) clearBtn.addEventListener("click", handleClear);
    if (speakBtn) speakBtn.addEventListener("click", handleSpeak);
    
    // 模式切换
    if (modeHybrid) modeHybrid.addEventListener("click", () => switchMode('hybrid'));
    if (modeYolo) modeYolo.addEventListener("click", () => switchMode('yolo'));
    if (modeLstm) modeLstm.addEventListener("click", () => switchMode('lstm'));

    loadGestureClasses();

    console.log('✅ [Dashboard] 初始化完成');
}

// ========== 模式切换 ==========
function switchMode(mode) {
    recognitionMode = mode;
    
    // 更新按钮样式
    [modeHybrid, modeYolo, modeLstm].forEach(btn => {
        if (btn) btn.classList.remove('active');
    });
    
    if (mode === 'hybrid' && modeHybrid) modeHybrid.classList.add('active');
    if (mode === 'yolo' && modeYolo) modeYolo.classList.add('active');
    if (mode === 'lstm' && modeLstm) modeLstm.classList.add('active');
    
    // 更新显示
    const modeNames = { 'hybrid': '混合', 'yolo': 'YOLO', 'lstm': 'LSTM' };
    if (currentMode) currentMode.textContent = modeNames[mode];
    if (engineStatus) engineStatus.textContent = modeNames[mode] + '模式';
    
    // 重置缓冲区
    gestureSequenceBuffer = [];
    temporalFrameHistory = [];
    
    console.log(`[Dashboard] 切换到${mode}模式`);
}

// ========== 加载手势类别 ==========
async function loadGestureClasses() {
    const el = document.getElementById('classesList');
    if (!el) return;
    
    const fallbackClasses = [
        "时间/时候", "你/您/你的/这", "早上", "9", "0",
        "快乐/高兴", "新", "祝", "请", "路",
        "生日", "平", "安", "朋友", "8",
        "认识", "名片", "结婚/妻子", "茶", "有",
        "花", "今天", "门", "停", "谢谢",
        "慢", "走", "晚", "我", "爱",
        "好", "人", "什么", "名字", "介绍"
    ];
    
    try {
        const res = await SignAPI.getClasses();
        const names = res.class_names || fallbackClasses;
        el.innerHTML = names.map(n =>
            `<span class="class-tag">${n}</span>`
        ).join('');
        const badge = document.getElementById('totalClassesBadge');
        if (badge) badge.textContent = names.length + '个';
        const totalEl = document.getElementById('totalClasses');
        if (totalEl) totalEl.textContent = names.length;
    } catch (e) {
        console.error('加载手势类别失败:', e);
        el.innerHTML = fallbackClasses.map(n =>
            `<span class="class-tag">${n}</span>`
        ).join('');
        const badge = document.getElementById('totalClassesBadge');
        if (badge) badge.textContent = fallbackClasses.length + '个';
    }
}

// ========== 摄像头控制 ==========
async function dashboard_startCamera() {
    if (streamRef) {
        console.log('⚠️ 摄像头已在运行');
        return;
    }

    console.log('📷 [Dashboard] 请求摄像头...');

    try {
        streamRef = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }
        });

        console.log('✅ [Dashboard] 摄像头权限已获取');

        video.srcObject = streamRef;

        await new Promise((resolve) => {
            video.onloadedmetadata = resolve;
            setTimeout(resolve, 3000);
        });

        await video.play();
        console.log('✅ [Dashboard] 视频播放中');

        await new Promise(r => requestAnimationFrame(r));

        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;

        startBtn.disabled = true;
        stopBtn.disabled = false;
        snapshotBtn.disabled = false;
        if (speakBtn) speakBtn.disabled = false;

        resetRecognitionState();
        if (detections) {
            detections.innerHTML = '<div style="text-align:center;color:#999;padding:20px;">等待识别...</div>';
        }

        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;

        console.log('🔄 [Dashboard] 启动识别循环');
        dashboard_loop();

    } catch (error) {
        console.error('❌ [Dashboard] 摄像头启动失败:', error);
        let msg = '无法开启摄像头';
        if (error.name === 'NotAllowedError') msg = '请允许浏览器使用摄像头权限';
        else if (error.name === 'NotFoundError') msg = '未检测到摄像头设备';
        else if (error.name === 'NotReadableError') msg = '摄像头被其他应用占用';
        alert(msg);
        streamRef = null;
        startBtn.disabled = false;
        stopBtn.disabled = true;
        snapshotBtn.disabled = true;
    }
}

function dashboard_stopCamera() {
    if (!streamRef) return;

    console.log('⏹️ [Dashboard] 关闭摄像头...');

    if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }

    streamRef.getTracks().forEach(t => t.stop());
    streamRef = null;
    if (video) video.srcObject = null;

    resetRecognitionState();

    startBtn.disabled = false;
    stopBtn.disabled = true;
    snapshotBtn.disabled = true;
    if (speakBtn) speakBtn.disabled = true;

    if (currentSign) currentSign.textContent = '-';
    if (currentConfidence) currentConfidence.textContent = '';
    if (resultGesture) resultGesture.textContent = '-';
    if (resultConfidence) resultConfidence.textContent = '置信度: 0%';
    if (resultTime) resultTime.textContent = '--:--:--';
    if (detections) {
        detections.innerHTML = '<div style="text-align:center;color:#999;padding:20px;">等待摄像头开启...</div>';
    }
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);

    console.log('✅ [Dashboard] 摄像头已关闭');
}

function resetRecognitionState() {
    frameCounter = 0;
    lastFpsTs = 0;
    lastSentGesture = null;
    lastSendTime = 0;
    temporalFrameHistory = [];
    isRecognizing = false;
    recognitionCount = 0;
    totalConfidence = 0;
}

// ========== 绘制引导框 ==========
function drawGuide() {
    if (!canvas || !video || !ctx || !video.videoWidth) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#48bb78";
    ctx.lineWidth = 4;
    const w = canvas.width * 0.75;
    const h = canvas.height * 0.8;
    const x = (canvas.width - w) / 2;
    const y = (canvas.height - h) / 2;
    ctx.strokeRect(x, y, w, h);
    ctx.font = "bold 16px sans-serif";
    ctx.fillStyle = "#48bb78";
    ctx.fillText("🤟 手势识别区域", x + 10, y + 28);
}

// ========== 捕获帧 ==========
function captureFrameBase64() {
    if (!video || !video.videoWidth) return null;
    const c = document.createElement('canvas');
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    const cctx = c.getContext('2d');
    cctx.translate(c.width, 0);
    cctx.scale(-1, 1);
    cctx.drawImage(video, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.95);
}

// ========== 更新检测显示 ==========
function updateDetectionDisplay(gesture, confidence) {
    // 左侧小显示
    if (currentSign) currentSign.textContent = gesture || '-';
    if (currentConfidence) currentConfidence.textContent = gesture ? `${Math.round(confidence * 100)}%` : '';
    
    // 右侧大显示
    if (resultGesture) resultGesture.textContent = gesture || '-';
    if (resultConfidence) resultConfidence.textContent = `置信度: ${Math.round(confidence * 100)}%`;
    if (resultTime) resultTime.textContent = new Date().toLocaleTimeString();
    
    // 检测列表
    if (detections && gesture) {
        const item = document.createElement('div');
        item.className = 'detection-item';
        item.innerHTML = `<span><strong>${gesture}</strong></span><span style="color:#3b82f6;">${Math.round(confidence * 100)}%</span><span style="font-size:0.7rem;color:#6c757d;">${new Date().toLocaleTimeString()}</span>`;
        detections.insertBefore(item, detections.firstChild);
        while (detections.children.length > 8) {
            detections.removeChild(detections.lastChild);
        }
    }
    
    // 更新统计
    recognitionCount++;
    totalConfidence += confidence;
    if (statCount) statCount.textContent = recognitionCount;
    if (statAvgConf) statAvgConf.textContent = Math.round((totalConfidence / recognitionCount) * 100) + '%';
    if (statStreak) statStreak.textContent = gestureSequenceBuffer.length;
}

// ========== 更新手势序列 ==========
function updateSequenceDisplay() {
    if (!gestureSequenceEl) return;
    
    gestureSequenceEl.innerHTML = gestureSequenceBuffer.map(g => 
        `<div class="gesture-tag">${g}</div>`
    ).join('');
    
    // 更新句子显示 - 使用智能句子构建器
    if (sentenceDisplay) {
        if (gestureSequenceBuffer.length === 0) {
            sentenceDisplay.innerHTML = '<div class="placeholder">等待识别手势...</div>';
        } else {
            // 使用智能句子构建器生成通顺的句子
            const smartSentence = sentenceBuilder.build(gestureSequenceBuffer);
            sentenceDisplay.innerHTML = `<strong>${smartSentence}</strong>`;
        }
    }
}

// ========== 添加到历史 ==========
function addToHistory(gesture, confidence) {
    if (!historyList) return;
    
    // 移除空提示
    const emptyMsg = historyList.querySelector('.history-empty');
    if (emptyMsg) emptyMsg.remove();
    
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
        <span class="gesture-name">${gesture}</span>
        <span class="gesture-conf">${Math.round(confidence * 100)}%</span>
        <span class="gesture-time">${new Date().toLocaleTimeString()}</span>
    `;
    historyList.insertBefore(item, historyList.firstChild);
    
    // 限制数量
    while (historyList.children.length > 20) {
        historyList.removeChild(historyList.lastChild);
    }
    
    // 更新计数
    if (historyCount) historyCount.textContent = historyList.children.length;
}

// ========== 识别当前帧 ==========
async function dashboard_recognizeCurrentFrame() {
    if (isRecognizing) {
        console.log('[Dashboard] 识别中，跳过...');
        return;
    }

    const now = Date.now();
    if (now - lastSendTime < CONFIG.sendCooldownMs) {
        console.log('[Dashboard] 冷却中，跳过...');
        return;
    }

    const base64 = captureFrameBase64();
    if (!base64) {
        console.warn('⚠️ [Dashboard] 无法捕获帧');
        return;
    }

    const sid = localStorage.getItem('sessionId') || `dash_${Date.now()}`;
    localStorage.setItem('sessionId', sid);

    isRecognizing = true;
    console.log(`[Dashboard] 发送识别请求，模式: ${recognitionMode}`);
    console.log(`[Dashboard] API_BASE =`, typeof API_BASE !== 'undefined' ? API_BASE : 'UNDEFINED');
    console.log(`[Dashboard] window.API_BASE_VALUE =`, window.API_BASE_VALUE);

    // 设置超时，防止请求卡住（增加到 15 秒，hybrid 模式需要更长时间）
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('识别请求超时')), 15000)
    );

    try {
        // 根据模式选择API
        let resultPromise;
        switch (recognitionMode) {
            case 'hybrid':
                resultPromise = SignAPI.recognizeHybrid(base64, sid);
                break;
            case 'lstm':
                resultPromise = SignAPI.recognizeLSTM(base64, sid);
                break;
            default:
                resultPromise = SignAPI.recognize(base64, sid);
        }

        // 使用 Promise.race 添加超时
        const result = await Promise.race([resultPromise, timeoutPromise]);

        console.log('[Dashboard] 识别结果:', JSON.stringify(result));

        const gesture = result.current_gesture || result.currentGesture;
        const conf = Number(result.confidence || 0);
        const sequence = result.gesture_sequence || [];

        console.log(`[Dashboard] 解析结果: gesture=${gesture}, conf=${conf}`);

        // 显示识别状态（即使没有检测到手势）
        if (apiStatus) {
            if (gesture && conf >= 0.3) {
                apiStatus.textContent = `识别中: ${gesture} (${Math.round(conf * 100)}%)`;
            } else if (result.detected === false) {
                apiStatus.textContent = '未检测到手势';
            } else {
                apiStatus.textContent = '识别中...';
            }
        }

        if (gesture && conf >= 0.2) {
            const shouldUpdate = gesture !== lastSentGesture || conf > 0.4;
            console.log(`[Dashboard] 条件检查: shouldUpdate=${shouldUpdate}`);

            if (shouldUpdate) {
                updateDetectionDisplay(gesture, conf);
                addToHistory(gesture, conf);

                // 优化：完全去重，避免同一个手势重复出现
                const isStableGesture = conf >= 0.4 && 
                    !gestureSequenceBuffer.includes(gesture);
                
                if (isStableGesture) {
                    gestureSequenceBuffer.push(gesture);
                    if (gestureSequenceBuffer.length > CONFIG.sequenceBufferMaxLen) {
                        gestureSequenceBuffer.shift();
                    }
                    updateSequenceDisplay();
                }

                lastSentGesture = gesture;
                lastSendTime = now;
            }
        } else {
            console.log(`[Dashboard] 结果过滤: gesture=${gesture}, conf=${conf} (需要conf>=0.3)`);
            // 显示未检测到手势的状态
            if (resultGesture) resultGesture.textContent = '-';
            if (resultConfidence) resultConfidence.textContent = '置信度: 0%';
        }
    } catch (error) {
        // 优化错误处理：不要每次超时都显示错误（静默处理）
        if (error.message.includes('超时') || error.message.includes('timeout')) {
            console.warn('[Dashboard] 识别超时（服务器繁忙）');
            if (apiStatus) apiStatus.textContent = '识别中...';
        } else if (error.message.includes('busy')) {
            console.log('[Dashboard] 服务器繁忙，跳过本次请求');
            // 静默处理，不显示错误
        } else {
            console.error('[Dashboard] 识别请求失败:', error);
            if (apiStatus) apiStatus.textContent = `识别失败: ${error.message}`;
        }
    } finally {
        isRecognizing = false;
    }
}

// ========== 拍照识别 ==========
async function dashboard_snapshotRecognize() {
    if (!streamRef) {
        alert('请先开启摄像头');
        return;
    }
    await dashboard_recognizeCurrentFrame();
    try {
        const stats = await SignAPI.getHistoryStats();
        if (stats && stats.success && todayCount) {
            todayCount.textContent = stats.todayCount || 0;
        }
    } catch (e) { /* ignore */ }
}

// ========== 翻译句子 ==========
async function handleTranslate() {
    if (gestureSequenceBuffer.length === 0) {
        alert('请先识别一些手势');
        return;
    }
    
    const seqText = gestureSequenceBuffer.join(' → ');
    
    try {
        console.log('[翻译] 开始调用LLM翻译...');
        const response = await SignAPI.llmTranslate(localStorage.getItem('sessionId') || 'default');
        console.log('[翻译] 翻译响应:', response);
        
        if (response.success && response.translation) {
            const translator = response.translator || 'unknown';
            const translatorName = {
                'sophnet': '☁️ Sophnet云端翻译',
                'local_llm': '🤖 本地LLM翻译',
                'sentence_optimizer': '⚡ 句子优化器',
                'rule': '📝 规则翻译',
                'fallback': '🔧 简单拼接'
            }[translator] || '未知翻译器';
            
            if (sentenceDisplay) {
                sentenceDisplay.innerHTML = `<strong>翻译结果：</strong>${response.translation}<br><small style="color:#88786a">${translatorName} | 原始序列：${seqText}</small>`;
            }
            console.log(`[翻译] 使用${translatorName}成功`);
        } else {
            // 本地简单拼接（降级方案）
            const simple = gestureSequenceBuffer.join('，');
            if (sentenceDisplay) {
                sentenceDisplay.innerHTML = `<strong>翻译结果：</strong>${simple}<br><small style="color:#88786a">（本地简单拼接 - 降级方案）</small>`;
            }
            console.warn('[翻译] 云端翻译失败，使用本地拼接降级');
        }
    } catch (error) {
        console.error('[翻译] 翻译请求失败:', error);
        const simple = gestureSequenceBuffer.join('，');
        if (sentenceDisplay) {
            sentenceDisplay.innerHTML = `<strong>翻译结果：</strong>${simple}<br><small style="color:#88786a">（本地简单拼接 - 降级方案）</small>`;
        }
    }
}

// ========== 清空序列 ==========
function handleClear() {
    gestureSequenceBuffer = [];
    updateSequenceDisplay();
    if (sentenceDisplay) {
        sentenceDisplay.innerHTML = '<div class="placeholder">等待识别手势...</div>';
    }
}

// ========== 语音朗读 ==========
function handleSpeak() {
    const text = sentenceDisplay ? sentenceDisplay.textContent : '';
    if (!text || text.includes('等待识别')) {
        alert('暂无内容可朗读');
        return;
    }

    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    } else {
        alert('您的浏览器不支持语音播放');
    }
}

// ========== 主循环 ==========
function dashboard_loop(ts = 0) {
    if (!streamRef || !video || !video.srcObject || video.readyState < 2) {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
        return;
    }

    if (video.videoWidth > 0 && canvas &&
        (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight)) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
    }

    drawGuide();

    frameCounter++;
    if (frameCounter % CONFIG.sendEveryNFrames === 0) {
        dashboard_recognizeCurrentFrame();
    }

    if (lastFpsTs > 0) {
        const fps = Math.max(1, Math.round(1000 / (ts - lastFpsTs)));
        if (fpsEl) fpsEl.textContent = `FPS: ${fps}`;
        if (statFps) statFps.textContent = fps;
    }
    lastFpsTs = ts;

    rafId = requestAnimationFrame(dashboard_loop);
}

// ========== 启动 ==========
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboard);
} else {
    initDashboard();
}

console.log('📦 [Dashboard] dashboard.js 新版已加载');
