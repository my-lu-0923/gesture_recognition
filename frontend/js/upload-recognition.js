// frontend/js/upload-recognition.js - 完全替换

// ========== 全局变量 ==========
let selectedImage = null;
let selectedVideo = null;
let recognitionHistory = [];

// ========== 工具函数 ==========
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ========== 识别核心函数 ==========
async function recognizeWithBase64(base64) {
    // 上传识别必须使用upload_前缀的session_id
    const sessionId = `upload_${Date.now()}`;

    console.log('发送识别请求, sessionId:', sessionId);

    try {
        const response = await fetch('http://localhost:8080/api/recognize/upload', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                image: base64,
                session_id: sessionId
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        console.log('识别结果详情:', result);
        return result;

    } catch (error) {
        console.error('识别请求失败:', error);
        throw error;
    }
}

// ========== 显示识别结果 - 修复版 ==========
function displayResult(result) {
    console.log('displayResult 收到的数据:', result);

    // 获取 DOM 元素
    const resultCard = document.getElementById('resultCard');
    const resultGesture = document.getElementById('resultGesture');
    const resultConfidence = document.getElementById('resultConfidence');
    const resultTranslation = document.getElementById('resultTranslation');
    const confidenceFill = document.getElementById('confidenceFill');
    const resultSaved = document.getElementById('resultSaved');

    if (!resultCard) {
        console.error('结果卡片元素不存在');
        return;
    }

    // 检查 result 是否为对象
    let data = result;
    if (typeof result === 'string') {
        try {
            data = JSON.parse(result);
        } catch(e) {
            console.error('解析字符串失败:', e);
            data = { detected: false };
        }
    }

    // 提取字段（兼容不同命名）
    const detected = data.detected === true;
    const gesture = data.current_gesture || data.currentGesture || data.gesture;
    const confidence = typeof data.confidence === 'number' ? data.confidence : 0;
    const translation = data.quick_translation || data.translation || data.quickTranslation || '';
    const gestureSequence = data.gesture_sequence || data.gestureSequence || [];
    const message = data.message || '';

    console.log('解析后:', { detected, gesture, confidence, translation, gestureSequence });

    // 显示结果卡片
    resultCard.style.display = 'block';

    // 修复：如果是“识别中”状态，直接返回
    if (gesture === '识别中...' || gesture === '处理视频中...') {
        resultGesture.textContent = gesture;
        resultConfidence.textContent = '';
        resultTranslation.textContent = '请稍候...';
        if (confidenceFill) confidenceFill.style.width = '0%';
        return;
    }

    console.log('=== 判断条件 ===', { 
        detected, 
        hasGesture: !!gesture, 
        hasConfidence: confidence > 0,
        all: detected && gesture && confidence > 0 
    });

    if (detected && gesture && confidence > 0) {
        // 成功识别
        resultGesture.textContent = gesture;
        resultConfidence.textContent = `置信度: ${Math.round(confidence * 100)}%`;
        resultTranslation.textContent = translation || `手势序列: ${gestureSequence.join(' → ')}`;

        if (confidenceFill) {
            confidenceFill.style.width = `${confidence * 100}%`;
        }

        resultSaved.textContent = '✅ 已保存到历史记录';
        resultSaved.style.color = '#48bb78';

        // 保存到历史
        saveToHistory(gesture, confidence, translation || gesture);

        // 3秒后清除保存提示
        setTimeout(() => {
            if (resultSaved) resultSaved.textContent = '';
        }, 3000);

    } else {
        // 未识别到手势
        resultGesture.textContent = '未识别';
        resultConfidence.textContent = '置信度: 0%';
        resultTranslation.textContent = message || '未检测到手语手势，请调整光线或角度重试';

        if (confidenceFill) {
            confidenceFill.style.width = '0%';
        }

        resultSaved.textContent = '❌ 识别失败';
        resultSaved.style.color = '#f56565';
    }
}

// ========== 保存到历史 ==========
function saveToHistory(gesture, confidence, translation) {
    const saved = localStorage.getItem('upload_recognition_history');
    if (saved) {
        try {
            recognitionHistory = JSON.parse(saved);
        } catch(e) {
            recognitionHistory = [];
        }
    } else {
        recognitionHistory = [];
    }

    const historyItem = {
        id: Date.now(),
        gesture: gesture,
        confidence: confidence,
        translation: translation,
        time: new Date().toLocaleString(),
        timestamp: Date.now()
    };

    recognitionHistory.unshift(historyItem);

    // 只保留最近50条
    if (recognitionHistory.length > 50) {
        recognitionHistory = recognitionHistory.slice(0, 50);
    }

    localStorage.setItem('upload_recognition_history', JSON.stringify(recognitionHistory));

    // 刷新历史列表
    renderHistory();
    updateStats();
}

// ========== 渲染历史列表 ==========
function renderHistory() {
    const historyList = document.getElementById('historyList');
    if (!historyList) return;

    const saved = localStorage.getItem('upload_recognition_history');
    if (saved) {
        try {
            recognitionHistory = JSON.parse(saved);
        } catch(e) {
            recognitionHistory = [];
        }
    }

    if (!recognitionHistory || recognitionHistory.length === 0) {
        historyList.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--gray-color);">📭 暂无识别记录</div>';
        return;
    }

    historyList.innerHTML = recognitionHistory.slice().reverse().map(item => `
        <div style="padding: 12px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <div style="font-weight: bold; font-size: 1rem;">${item.gesture}</div>
                <div style="font-size: 0.7rem; color: #888;">${item.time}</div>
            </div>
            <div>
                <div style="color: #3b82f6;">${Math.round(item.confidence * 100)}%</div>
                <button onclick="deleteHistoryItem(${item.id})" style="background: none; border: none; color: #f56565; cursor: pointer; font-size: 0.7rem;">删除</button>
            </div>
        </div>
    `).join('');
}

// ========== 删除历史记录 ==========
window.deleteHistoryItem = function(id) {
    const saved = localStorage.getItem('upload_recognition_history');
    if (saved) {
        try {
            let history = JSON.parse(saved);
            history = history.filter(item => item.id !== id);
            localStorage.setItem('upload_recognition_history', JSON.stringify(history));
            renderHistory();
            updateStats();
        } catch(e) {
            console.error('删除失败:', e);
        }
    }
};

// ========== 清空所有历史 ==========
function clearAllHistory() {
    if (confirm('确定要清空所有识别历史吗？')) {
        localStorage.removeItem('upload_recognition_history');
        recognitionHistory = [];
        renderHistory();
        updateStats();
        alert('历史记录已清空');
    }
}

// ========== 更新统计数据 ==========
function updateStats() {
    const saved = localStorage.getItem('upload_recognition_history');
    if (saved) {
        try {
            recognitionHistory = JSON.parse(saved);
        } catch(e) {
            recognitionHistory = [];
        }
    }

    const today = new Date().toDateString();
    const todayCount = recognitionHistory ? recognitionHistory.filter(item =>
        new Date(item.time).toDateString() === today
    ).length : 0;

    const totalCount = recognitionHistory ? recognitionHistory.length : 0;
    const avgConfidence = totalCount > 0
        ? (recognitionHistory.reduce((sum, item) => sum + (item.confidence || 0), 0) / totalCount * 100).toFixed(1)
        : 0;

    const todayCountEl = document.getElementById('todayCount');
    const totalCountEl = document.getElementById('totalCount');
    const accuracyEl = document.getElementById('accuracy');

    if (todayCountEl) todayCountEl.textContent = todayCount;
    if (totalCountEl) totalCountEl.textContent = totalCount;
    if (accuracyEl) accuracyEl.textContent = avgConfidence > 0 ? `${avgConfidence}%` : '--';
}

// ========== 图片识别 ==========
async function recognizeImage() {
    const input = document.getElementById('imageInput');
    if (!input.files || !input.files.length) {
        alert('请先选择图片文件');
        return;
    }

    const file = input.files[0];
    console.log('开始识别图片:', file.name, file.size);

    // 显示加载状态
    const resultCard = document.getElementById('resultCard');
    const resultGesture = document.getElementById('resultGesture');
    if (resultCard) {
        resultCard.style.display = 'block';
        if (resultGesture) resultGesture.textContent = '识别中...';
    }

    try {
        // 转换图片为 base64
        const base64 = await fileToBase64(file);
        console.log('Base64 转换完成');

        // 调用识别接口
        const result = await recognizeWithBase64(base64);
        console.log('识别完成，结果:', result);

        // 显示结果
        displayResult(result);

        // 更新统计数据
        updateStats();

    } catch (error) {
        console.error('图片识别失败:', error);
        displayResult({
            detected: false,
            message: `识别失败: ${error.message}`
        });
    }
}

// ========== 视频识别 ==========
async function recognizeVideo() {
    const input = document.getElementById('videoInput');
    if (!input.files || !input.files.length) {
        alert('请先选择视频文件');
        return;
    }

    const file = input.files[0];
    console.log('开始处理视频:', file.name);

    // 显示加载状态
    const resultCard = document.getElementById('resultCard');
    const resultGesture = document.getElementById('resultGesture');
    if (resultCard) {
        resultCard.style.display = 'block';
        if (resultGesture) resultGesture.textContent = '处理视频中...';
    }

    try {
        // 创建视频元素提取首帧
        const url = URL.createObjectURL(file);
        const video = document.createElement('video');
        video.src = url;
        video.muted = true;

        // 等待视频元数据加载
        await new Promise((resolve, reject) => {
            video.onloadedmetadata = () => {
                video.currentTime = 0.1;
                resolve();
            };
            video.onerror = reject;
            setTimeout(() => reject(new Error('视频加载超时')), 5000);
        });

        // 等待 seek 完成
        await new Promise((resolve) => {
            video.onseeked = resolve;
            setTimeout(resolve, 1000);
        });

        // 提取帧
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const base64 = canvas.toDataURL('image/jpeg', 0.85);
        URL.revokeObjectURL(url);

        console.log('视频首帧已提取');

        // 识别
        const result = await recognizeWithBase64(base64);
        displayResult(result);
        updateStats();

    } catch (error) {
        console.error('视频识别失败:', error);
        displayResult({
            detected: false,
            message: `视频处理失败: ${error.message}`
        });
    }
}

// ========== 预览图片 ==========
function handleImageFile(file) {
    if (!file) return;

    selectedImage = file;
    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = document.getElementById('imagePreview');
        if (preview) {
            preview.innerHTML = `<img src="${e.target.result}" style="max-width: 100%; max-height: 300px; border-radius: 8px; margin-top: 10px;">`;
        }
        const recognizeBtn = document.getElementById('imageBtn');
        if (recognizeBtn) recognizeBtn.style.display = 'inline-block';
    };
    reader.readAsDataURL(file);
}

// ========== 预览视频 ==========
function handleVideoFile(file) {
    if (!file) return;

    selectedVideo = file;
    const url = URL.createObjectURL(file);
    const preview = document.getElementById('videoPreview');
    if (preview) {
        preview.innerHTML = `<video src="${url}" style="max-width: 100%; max-height: 300px; margin-top: 10px;" controls></video>`;
    }
    const recognizeBtn = document.getElementById('videoBtn');
    if (recognizeBtn) recognizeBtn.style.display = 'inline-block';
}

// ========== 初始化页面 ==========
function initUploadPage() {
    console.log('初始化上传识别页面...');

    // 绑定图片选择
    const selectImageBtn = document.getElementById('selectImageBtn');
    const imageInput = document.getElementById('imageInput');
    if (selectImageBtn && imageInput) {
        selectImageBtn.addEventListener('click', () => imageInput.click());
        imageInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                handleImageFile(e.target.files[0]);
            }
        });
    }

    // 绑定视频选择
    const selectVideoBtn = document.getElementById('selectVideoBtn');
    const videoInput = document.getElementById('videoInput');
    if (selectVideoBtn && videoInput) {
        selectVideoBtn.addEventListener('click', () => videoInput.click());
        videoInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                handleVideoFile(e.target.files[0]);
            }
        });
    }

    // 绑定识别按钮
    const imageBtn = document.getElementById('imageBtn');
    if (imageBtn) {
        imageBtn.addEventListener('click', recognizeImage);
    }

    const videoBtn = document.getElementById('videoBtn');
    if (videoBtn) {
        videoBtn.addEventListener('click', recognizeVideo);
    }

    // 绑定清空历史按钮
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', clearAllHistory);
    }

    // 绑定关闭结果按钮
    const closeResultBtn = document.getElementById('closeResultBtn');
    if (closeResultBtn) {
        closeResultBtn.addEventListener('click', () => {
            const resultCard = document.getElementById('resultCard');
            if (resultCard) resultCard.style.display = 'none';
        });
    }

    // 绑定选项卡切换
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const tabId = btn.dataset.tab;
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            const targetTab = document.getElementById(`tab-${tabId}`);
            if (targetTab) targetTab.classList.add('active');

            // 如果切换到历史选项卡，刷新历史
            if (tabId === 'history') {
                renderHistory();
            }
        });
    });

    // 加载历史数据
    renderHistory();
    updateStats();

    console.log('上传识别页面初始化完成');
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUploadPage);
} else {
    initUploadPage();
}