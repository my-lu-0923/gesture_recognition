 // ========== 全局变量 ==========
let streamRef = null;
let rafId = null;
let video, canvas, ctx, startBtn, stopBtn, snapshotBtn;

// ========== 初始化 ==========
async function init() {
    console.log('🚀 开始初始化...');
    
    // 获取 DOM 元素
    video = document.getElementById("videoElement");
    canvas = document.getElementById("overlayCanvas");
    ctx = canvas ? canvas.getContext("2d") : null;
    startBtn = document.getElementById("startBtn");
    stopBtn = document.getElementById("stopBtn");
    snapshotBtn = document.getElementById("snapshotBtn");
    
    console.log('元素状态:', {
        video: !!video,
        canvas: !!canvas,
        startBtn: !!startBtn,
        stopBtn: !!stopBtn
    });
    
    // 绑定事件
    if (startBtn) {
        startBtn.addEventListener("click", startCamera);
        console.log('✅ startBtn 事件已绑定');
    }
    
    if (stopBtn) {
        stopBtn.addEventListener("click", stopCamera);
        console.log('✅ stopBtn 事件已绑定');
    }
    
    if (snapshotBtn) {
        snapshotBtn.addEventListener("click", takeSnapshot);
        console.log('✅ snapshotBtn 事件已绑定');
    }
    
    console.log('✅ 初始化完成');
}

// ========== 开启摄像头 ==========
async function startCamera() {
    console.log('🔴 点击开启摄像头');
    
    if (streamRef) {
        console.log('⚠️ 摄像头已在运行');
        return;
    }
    
    try {
        // 请求摄像头
        streamRef = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 } }
        });
        
        console.log('✅ 摄像头已获取');
        
        // 设置视频
        video.srcObject = streamRef;
        await video.play();
        
        console.log('✅ 视频已开始');
        
        // 更新按钮
        startBtn.disabled = true;
        stopBtn.disabled = false;
        snapshotBtn.disabled = false;
        
        console.log('✅ 摄像头开启成功');
        
    } catch (error) {
        console.error('❌ 开启摄像头失败:', error);
        alert('无法开启摄像头：' + error.message);
        streamRef = null;
        startBtn.disabled = false;
    }
}

// ========== 关闭摄像头 ==========
function stopCamera() {
    console.log('⏹️ 关闭摄像头');
    
    if (!streamRef) return;
    
    // 停止视频轨道
    streamRef.getTracks().forEach(track => track.stop());
    streamRef = null;
    video.srcObject = null;
    
    // 更新按钮
    startBtn.disabled = false;
    stopBtn.disabled = true;
    snapshotBtn.disabled = true;
    
    console.log('✅ 摄像头已关闭');
}

// ========== 拍照 ==========
function takeSnapshot() {
    console.log('📸 拍照');
    if (!streamRef) return;
    
    const c = document.createElement('canvas');
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    const cctx = c.getContext('2d');
    cctx.drawImage(video, 0, 0);
    
    // 下载图片
    const link = document.createElement('a');
    link.download = 'snapshot.png';
    link.href = c.toDataURL('image/png');
    link.click();
    
    console.log('✅ 照片已保存');
}

// ========== 启动 ==========
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

console.log('📦 dashboard.js 已加载');
