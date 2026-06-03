/**
 * 语音翻译页面逻辑 - 视频播放器版本
 */

let textInput = null;
let generateSignBtn = null;
let voiceInputBtn = null;
let signPlayerCard = null;
let translationResultCard = null;
let playSignBtn = null;
let pauseSignBtn = null;
let stopSignBtn = null;
let speakTranslationBtn = null;
let signVideo = null;
let gestureDisplayList = [];
let lastTranslationText = '';
let currentGestureIndex = 0;
let isPlaying = false;
let isPaused = false;

// 手势图标映射（用于降级显示）
const GESTURE_ICONS = {
    '你好': '👋', '谢谢': '🙏', '爱': '❤️', '朋友': '🤝', '我': '👤',
    '你': '👉', '他': '👈', '她': '👈', '是': '✅', '不': '❌',
    '有': '✋', '没有': '🚫', '好': '👍', '想': '💭', '要': '🎯',
    '吃': '🍽️', '喝': '🥤', '水': '💧', '饭': '🍚', '今天': '📅',
    '明天': '📆', '昨天': '⏮️', '早上': '🌅', '晚上': '🌙', '晚安': '😴',
    '生日': '🎂', '快乐': '😊', '高兴': '😄', '新': '✨', '祝': '🎉',
    '请': '🙋', '路': '🛣️', '门': '🚪', '停': '🛑', '慢': '🐢',
    '走': '🚶', '晚': '🌃', '人': '👥', '什么': '❓', '名字': '📛',
    '介绍': '📝', '认识': '🤝', '名片': '💳', '结婚': '💒', '妻子': '👰',
    '茶': '🍵', '花': '🌸', '时间': '⏰', '时候': '🕐', '平': '⚖️',
    '安': '🔒', '中国': '🇨', '国家': '️', '家': '', '大': '️',
    '小': '⬇️', '多': '➕', '少': '➖', '来': '👋', '去': '👋',
    '看': '👀', '听': '👂', '说': '💬', '做': '✊', '学': '📖',
    '工作': '💼', '帮助': '🤝', '喜欢': '❤️', '知道': '🧠', '理解': '💡',
    '对不起': '🙏', '没关系': '👌', '再见': '👋', '欢迎': '🎉',
    '一': '☝️', '二': '✌️', '三': '🤟', '四': '🖖', '五': '🖐️',
    '个': '👆', '梦想': '🌟', '希望': '🌈', '美丽': '🌸', '勇敢': '💪',
    '努力': '💪', '成功': '🏆', '失败': '😢', '坚持': '💪', '永远': '♾️',
    '幸福': '😊', '健康': '💪', '平安': '🙏', '顺利': '✨', '开心': '😄',
    '难过': '😢', '生气': '😠', '害怕': '😨', '惊讶': '😲', '期待': '👀',
    '相信': '🙏', '支持': '🤝', '关心': '❤️', '照顾': '🤗', '陪伴': '👫',
    '未来': '🔮', '过去': '⏮️', '现在': '⏰', '开始': '▶️', '结束': '⏹️',
    '学习': '📚', '生活': '🏠', '世界': '🌍', '社会': '👥', '自然': '🌿'
};

// 手语类别名称（从后端获取）
let CLASS_NAMES = [];

// 手势图片映射（从 35 文件夹）
let GESTURE_IMAGE_MAPPING = {};

document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 [VoiceTranslation] 页面初始化...');
    
    // 获取DOM元素
    textInput = document.getElementById('textInput');
    generateSignBtn = document.getElementById('generateSignBtn');
    voiceInputBtn = document.getElementById('voiceInputBtn');
    signPlayerCard = document.getElementById('signPlayerCard');
    translationResultCard = document.getElementById('translationResultCard');
    playSignBtn = document.getElementById('playSignBtn');
    pauseSignBtn = document.getElementById('pauseSignBtn');
    stopSignBtn = document.getElementById('stopSignBtn');
    speakTranslationBtn = document.getElementById('speakTranslationBtn');
    signVideo = document.getElementById('signVideo');

    // 绑定事件
    if (generateSignBtn) {
        generateSignBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleGenerateSignLanguage();
        });
    }
    if (textInput) {
        textInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleGenerateSignLanguage();
            }
        });
    }
    if (voiceInputBtn) {
        voiceInputBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleVoiceInput();
        });
    }
    if (playSignBtn) {
        playSignBtn.addEventListener('click', handlePlaySignAnimation);
    }
    if (pauseSignBtn) {
        pauseSignBtn.addEventListener('click', handlePauseSignAnimation);
    }
    if (stopSignBtn) {
        stopSignBtn.addEventListener('click', handleStopSignAnimation);
    }
    if (speakTranslationBtn) {
        speakTranslationBtn.addEventListener('click', handleSpeakTranslation);
    }

    // 绑定视频事件
    if (signVideo) {
        signVideo.addEventListener('ended', onVideoEnded);
        signVideo.addEventListener('error', onVideoError);
        signVideo.addEventListener('loadeddata', () => {
            console.log('📹 视频数据已加载:', signVideo.src);
        });
        signVideo.addEventListener('canplay', () => {
            console.log('▶️ 视频可以播放');
        });
    }

    // 加载手势类别和图片映射
    await loadClassNames();
    await loadGestureImageMapping();

    console.log('✅ [VoiceTranslation] 初始化完成');
});

// 加载手势类别
async function loadClassNames() {
    try {
        const res = await SignAPI.getClasses();
        CLASS_NAMES = res.class_names || [];
        console.log(`✅ [VoiceTranslation] 加载了 ${CLASS_NAMES.length} 个手势类别`);
        console.log('📋 CLASS_NAMES 完整内容:', CLASS_NAMES);
    } catch (error) {
        console.error('❌ [VoiceTranslation] 加载手势类别失败:', error);
    }
}

// 加载手势图片映射
async function loadGestureImageMapping() {
    try {
        const res = await fetch('js/gesture-image-mapping.json');
        GESTURE_IMAGE_MAPPING = await res.json();
        console.log(`✅ [VoiceTranslation] 加载了 ${Object.keys(GESTURE_IMAGE_MAPPING).length} 个手势图片映射`);
    } catch (error) {
        console.error('❌ [VoiceTranslation] 加载手势图片映射失败:', error);
    }
}

// 生成手语
async function handleGenerateSignLanguage() {
    if (!textInput) return;
    
    const text = textInput.value.trim();
    if (!text) {
        alert('请输入要翻译的文字');
        return;
    }

    console.log('📝 [VoiceTranslation] 开始翻译:', text);

    // 显示加载状态
    if (translationResultCard) {
        translationResultCard.style.display = 'block';
        document.getElementById('translationResult').innerHTML = '<div style="text-align:center;color:#999;">🔄 正在分析文本并生成手语动画...</div>';
    }

    try {
        // 使用新的文本转手语API（生成视频）
        const response = await fetch('http://localhost:5001/text_to_sign', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                generate_video: true
            })
        });

        const result = await response.json();
        console.log('🤖 [VoiceTranslation] API返回:', result);

        if (!result.success || !result.gesture_sequence || result.gesture_sequence.length === 0) {
            document.getElementById('translationResult').innerHTML = 
                '<div style="color:#c6473b;">❌ 无法识别的手语词汇，请尝试使用更简单的表达</div>';
            return;
        }

        const gestures = result.gesture_sequence;
        lastTranslationText = text;
        
        // 显示结果
        displayTranslationResult(text, gestures, result.unmatched_words);
        
        // 如果有视频，直接播放
        if (result.video_url) {
            console.log('✅ [VoiceTranslation] 使用后端生成的视频:', result.video_url);
            playGeneratedVideo(result.video_url, gestures);
        } else {
            console.log('⚠️ [VoiceTranslation] 后端未返回视频，使用本地视频序列播放');
            // 降级：使用本地视频序列
            showSignPlayer(gestures);
            // 自动开始播放
            setTimeout(() => {
                handlePlaySignAnimation();
            }, 500);
        }

    } catch (error) {
        console.error('❌ [VoiceTranslation] 生成手语失败:', error);
        // 降级处理：使用本地分词
        const gestures = textToGestureSequence(text);
        if (gestures.length > 0) {
            lastTranslationText = text;
            displayTranslationResult(text, gestures);
            showSignPlayer(gestures);
        } else {
            document.getElementById('translationResult').innerHTML = 
                '<div style="color:#c6473b;">❌ 生成失败，请稍后再试</div>';
        }
    }
}

// 简单分词和匹配
function textToGestureSequence(text) {
    const gestures = [];
    const unmatched = [];
    let remaining = text;

    console.log('🔍 [VoiceTranslation] 开始分词，输入文本:', text);
    console.log('📚 [VoiceTranslation] CLASS_NAMES:', CLASS_NAMES);

    while (remaining.length > 0) {
        let matched = false;

        for (let len = Math.min(remaining.length, 10); len >= 1; len--) {
            const substr = remaining.substring(0, len);

            // 优先精确匹配CLASS_NAMES
            if (CLASS_NAMES.includes(substr)) {
                gestures.push(substr);
                remaining = remaining.substring(len);
                matched = true;
                console.log(`✅ 精确匹配: "${substr}"`);
                break;
            }

            // 子串匹配：输入的子串是某个CLASS_NAME的一部分（如"你"匹配"你/您/你的/这"）
            const parentMatch = CLASS_NAMES.find(cn => cn.includes(substr) && substr.length >= 1);
            if (parentMatch) {
                gestures.push(parentMatch);
                remaining = remaining.substring(len);
                matched = true;
                console.log(`✅ 子串匹配: "${substr}" → "${parentMatch}"`);
                break;
            }

            // 其次匹配GESTURE_ICONS
            if (GESTURE_ICONS[substr]) {
                gestures.push(substr);
                remaining = remaining.substring(len);
                matched = true;
                console.log(`✅ 图标映射: "${substr}"`);
                break;
            }
        }

        if (!matched) {
            unmatched.push(remaining[0]);
            console.log(`⏭️ 跳过: "${remaining[0]}"`);
            remaining = remaining.substring(1);
        }
    }

    if (unmatched.length > 0) {
        console.warn('⚠️ 未匹配字符:', unmatched.join(''));
    }
    
    console.log('📊 分词结果:', gestures);
    return gestures;
}

// 显示翻译结果
function displayTranslationResult(originalText, gestures, unmatchedWords = []) {
    if (!translationResultCard) return;
    
    translationResultCard.style.display = 'block';
    
    let unmatchedHtml = '';
    if (unmatchedWords && unmatchedWords.length > 0) {
        unmatchedHtml = `
            <div style="margin-bottom: 10px; padding: 10px; background: #fff3cd; border-radius: 8px; font-size: 13px;">
                <strong style="color: #856404;">⚠️ 未匹配词汇：</strong>
                <span style="color: #856404;">${unmatchedWords.join('、')}</span>
            </div>
        `;
    }
    
    const resultHtml = `
        ${unmatchedHtml}
        <div style="margin-bottom: 15px;">
            <strong style="color: #3a2b1a;">原文：</strong>
            <span>${originalText}</span>
        </div>
        <div style="margin-bottom: 15px;">
            <strong style="color: #3a2b1a;">手语序列：</strong>
            <span style="color: #d88932; font-weight: bold;">${gestures.join(' → ')}</span>
        </div>
        <div style="font-size: 13px; color: #88786a;">
            💡 点击下方「▶️ 播放」按钮观看手语视频演示
        </div>
    `;
    
    document.getElementById('translationResult').innerHTML = resultHtml;
}

// 显示手语播放器
function showSignPlayer(gestures) {
    if (!signPlayerCard) return;
    
    gestureDisplayList = gestures;
    currentGestureIndex = 0;

    signPlayerCard.style.display = 'block';
    
    const sequenceElement = document.getElementById('gestureSequence');
    if (sequenceElement) {
        sequenceElement.textContent = `序列：${gestures.join(' → ')}`;
    }
    
    // 初始化显示
    updateGestureDisplay('准备就绪', 0, gestures.length);
    
    console.log('🎬 [VoiceTranslation] 视频播放器已就绪，手势序列:', gestures);
}

// 播放后端生成的视频
function playGeneratedVideo(videoUrl, gestures) {
    if (!signPlayerCard || !signVideo) return;
    
    // 显示播放器卡片
    signPlayerCard.style.display = 'block';
    
    // 设置视频源
    const fullUrl = `http://localhost:5001${videoUrl}`;
    console.log('🎬 [VoiceTranslation] 播放生成的视频:', fullUrl);
    
    signVideo.src = fullUrl;
    
    // 更新手势序列显示
    const sequenceElement = document.getElementById('gestureSequence');
    if (sequenceElement) {
        sequenceElement.textContent = `序列：${gestures.join(' → ')}`;
    }
    
    // 更新当前手势名称
    updateGestureDisplay('正在播放', 0, gestures.length);
    
    // 显示播放按钮，隐藏暂停按钮
    playSignBtn.style.display = 'inline-flex';
    pauseSignBtn.style.display = 'none';
    
    console.log('✅ [VoiceTranslation] 视频已加载，请点击播放按钮开始播放');
}

// 更新手势显示
function updateGestureDisplay(gestureName, currentIndex, total) {
    const nameElement = document.getElementById('currentGestureName');
    const progressBar = document.getElementById('progressBar');
    
    if (nameElement) {
        if (currentIndex === 0 && total === 0) {
            nameElement.textContent = gestureName;
        } else {
            nameElement.textContent = `${gestureName} (${currentIndex + 1}/${total})`;
        }
    }
    
    if (progressBar && total > 0) {
        const progress = ((currentIndex + 1) / total) * 100;
        progressBar.style.width = `${progress}%`;
    }
}

// 播放完成回调
function onPlaybackComplete() {
    console.log('✅ [VoiceTranslation] 视频播放完成');
    
    isPlaying = false;
    isPaused = false;
    currentGestureIndex = 0;
    
    playSignBtn.style.display = 'inline-flex';
    pauseSignBtn.style.display = 'none';
    
    updateGestureDisplay('播放完成', 0, gestureDisplayList.length);
}

// 播放动画
async function handlePlaySignAnimation() {
    if (!signVideo) {
        console.log('⚠️ [VoiceTranslation] 视频元素不存在');
        return;
    }
    
    // 如果有手势序列，播放序列图片
    if (gestureDisplayList && gestureDisplayList.length > 0) {
        console.log('▶️ [VoiceTranslation] 开始播放手势序列，共', gestureDisplayList.length, '个手势');
        isPlaying = true;
        isPaused = false;
        currentGestureIndex = 0;
        
        playSignBtn.style.display = 'none';
        pauseSignBtn.style.display = 'inline-flex';
        
        // 开始播放第一个手势
        await playCurrentGesture();
    } else {
        console.log('⚠️ [VoiceTranslation] 没有可播放的内容');
    }
}

// 播放当前手势（使用 35 文件夹的静态图片，每个手势停留 2 秒）
async function playCurrentGesture() {
    if (!isPlaying || isPaused) return;
    
    if (currentGestureIndex >= gestureDisplayList.length) {
        onPlaybackComplete();
        return;
    }
    
    const gestureName = gestureDisplayList[currentGestureIndex];
    console.log(`📹 播放手势 [${currentGestureIndex + 1}/${gestureDisplayList.length}]: ${gestureName}`);
    
    // 更新显示
    updateGestureDisplay(gestureName, currentGestureIndex, gestureDisplayList.length);
    
    // 使用 35 文件夹的静态图片，通过映射获取文件名
    // 后端返回的格式是 "你/您/你的/这"（用 / 分隔），但映射的 key 是 "你:您:你的"（用 : 分隔）
    // 需要尝试多种格式来匹配
    let imageFilename = GESTURE_IMAGE_MAPPING[gestureName];
    
    if (!imageFilename) {
        // 尝试将 / 替换为 : 再查找
        const colonFormat = gestureName.replace(/\//g, ':');
        imageFilename = GESTURE_IMAGE_MAPPING[colonFormat];
    }
    
    if (!imageFilename) {
        // 尝试遍历映射，查找包含第一个别名的 key
        // 例如 "你/您/你的/这" 的第一个别名是 "你"，应该匹配到 "你:您:你的"
        const firstAlias = gestureName.split('/')[0].trim();
        if (firstAlias) {
            for (const [key, value] of Object.entries(GESTURE_IMAGE_MAPPING)) {
                // 将 key 中的 : 替换为 / 后拆分，检查是否包含第一个别名
                const keyAliases = key.replace(/:/g, '/').split('/');
                if (keyAliases.includes(firstAlias)) {
                    imageFilename = value;
                    break;
                }
            }
        }
    }
    
    if (!imageFilename) {
        console.error(`❌ 未找到手势 "${gestureName}" 的图片映射`);
        // 即使失败也继续下一个
        currentGestureIndex++;
        await new Promise(resolve => setTimeout(resolve, 200));
        await playCurrentGesture();
        return;
    }
    
    const imagePath = `http://localhost:5001/gesture_image/${encodeURIComponent(imageFilename)}`;
    console.log('🖼️ 加载图片:', imagePath);
    console.log('📝 原始文件名:', imageFilename);
    
    try {
        // 直接设置 img 元素的 src
        signVideo.src = imagePath;
        
        console.log(`⏱️ 手势 "${gestureName}" 显示 2 秒`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // 停留 2 秒
        
        // 当前手势播放完成，继续下一个
        onVideoEnded();
        
    } catch (error) {
        console.error(`❌ 播放手势异常：${gestureName}`, error);
        currentGestureIndex++;
        await new Promise(resolve => setTimeout(resolve, 200));
        await playCurrentGesture();
    }
}

// 视频播放结束
function onVideoEnded() {
    console.log('📹 视频播放结束');
    
    // 如果正在播放手势序列，继续播放下一个
    if (isPlaying && gestureDisplayList && gestureDisplayList.length > 0) {
        currentGestureIndex++;
        
        if (currentGestureIndex >= gestureDisplayList.length) {
            // 所有手势播放完成
            onPlaybackComplete();
        } else {
            // 继续播放下一个手势
            playCurrentGesture();
        }
    } else {
        // 单个视频播放完成
        isPlaying = false;
        isPaused = false;
        currentGestureIndex = 0;
        
        playSignBtn.style.display = 'inline-flex';
        pauseSignBtn.style.display = 'none';
        
        console.log('✅ [VoiceTranslation] 视频播放完成，可重复播放');
    }
}

// 视频播放错误
function onVideoError(e) {
    console.error('❌ 视频播放错误:', e);
    
    isPlaying = false;
    isPaused = false;
    
    playSignBtn.style.display = 'inline-flex';
    pauseSignBtn.style.display = 'none';
}

// 暂停动画
function handlePauseSignAnimation() {
    if (!signVideo) return;
    
    if (isPaused) {
        // 恢复播放
        isPaused = false;
        playSignBtn.style.display = 'none';
        pauseSignBtn.style.display = 'inline-flex';
        // 继续播放当前手势
        playCurrentGesture();
    } else if (isPlaying) {
        // 暂停播放
        isPaused = true;
        playSignBtn.style.display = 'inline-flex';
        pauseSignBtn.style.display = 'none';
    }
}

// 停止动画
function handleStopSignAnimation() {
    if (!signVideo) return;
    
    isPlaying = false;
    isPaused = false;
    currentGestureIndex = 0;
    
    playSignBtn.style.display = 'inline-flex';
    pauseSignBtn.style.display = 'none';
    
    updateGestureDisplay('准备就绪', 0, gestureDisplayList.length);
}

// 朗读翻译
function handleSpeakTranslation() {
    if (!lastTranslationText) return;
    
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(lastTranslationText);
        utterance.lang = 'zh-CN';
        utterance.rate = 0.8;
        speechSynthesis.speak(utterance);
    } else {
        alert('您的浏览器不支持语音合成');
    }
}

let speechRecognition = null;
let isListening = false;

// 语音输入
function handleVoiceInput() {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
        alert('您的浏览器不支持语音识别');
        return;
    }

    if (isListening) {
        stopListening();
        return;
    }

    startListening();
}

function startListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    speechRecognition = new SpeechRecognition();
    
    speechRecognition.lang = 'zh-CN';
    speechRecognition.continuous = false;
    speechRecognition.interimResults = false;
    
    speechRecognition.onstart = () => {
        console.log('🎤 开始语音识别...');
        isListening = true;
        if (voiceInputBtn) {
            voiceInputBtn.innerHTML = '<span>⏹️</span> 停止聆听';
            voiceInputBtn.classList.add('voice-input-active');
        }
    };
    
    speechRecognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        console.log('🎤 识别结果:', transcript);
        if (textInput) {
            textInput.value = transcript;
        }
    };
    
    speechRecognition.onerror = (event) => {
        console.error('🎤 语音识别错误:', event.error);
        if (event.error !== 'aborted') {
            alert('语音识别失败：' + event.error);
        }
        resetVoiceButton();
    };
    
    speechRecognition.onend = () => {
        console.log('🎤 语音识别结束');
        resetVoiceButton();
    };
    
    try {
        speechRecognition.start();
    } catch (e) {
        console.error('启动语音识别失败:', e);
        resetVoiceButton();
    }
}

function stopListening() {
    if (speechRecognition) {
        speechRecognition.abort();
        speechRecognition = null;
    }
    isListening = false;
    resetVoiceButton();
    console.log('⏹️ 已停止语音识别');
}

function resetVoiceButton() {
    isListening = false;
    if (voiceInputBtn) {
        voiceInputBtn.innerHTML = '<span>🎤</span> 语音输入';
        voiceInputBtn.classList.remove('voice-input-active');
    }
}
