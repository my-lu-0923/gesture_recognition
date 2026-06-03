/**
 * 手语视频播放器 - 支持句子级别的视频连播
 */

class SignLanguageVideoPlayer {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = {
            videoBasePath: options.videoBasePath || 'data/gesture_videos',
            autoPlay: options.autoPlay !== false,
            showControls: options.showControls !== false,
            ...options
        };
        
        this.videoElement = null;
        this.currentGestureIndex = 0;
        this.gestureSequence = [];
        this.isPlaying = false;
        this.isPaused = false;
        this.onGestureChange = null;
        this.onComplete = null;
        
        this.init();
    }
    
    init() {
        if (!this.container) {
            console.error('❌ SignLanguageVideoPlayer: 容器元素不存在');
            return;
        }
        
        this.container.innerHTML = '';
        this.container.style.position = 'relative';
        
        // 创建视频元素
        this.videoElement = document.createElement('video');
        this.videoElement.className = 'sign-video';
        this.videoElement.style.width = '100%';
        this.videoElement.style.height = '100%';
        this.videoElement.style.minHeight = '450px';
        this.videoElement.style.objectFit = 'contain';
        this.videoElement.style.borderRadius = '12px';
        this.videoElement.style.backgroundColor = '#000';
        this.videoElement.style.display = 'block';
        this.videoElement.setAttribute('playsinline', '');
        this.videoElement.setAttribute('webkit-playsinline', '');
        this.videoElement.setAttribute('muted', '');
        
        if (this.options.showControls) {
            this.videoElement.controls = true;
        }
        
        this.container.appendChild(this.videoElement);
        
        // 绑定事件
        this.videoElement.addEventListener('ended', () => this.onVideoEnded());
        this.videoElement.addEventListener('error', (e) => this.onVideoError(e));
        this.videoElement.addEventListener('loadeddata', () => {
            console.log('📹 视频数据已加载:', this.videoElement.src);
        });
        this.videoElement.addEventListener('canplay', () => {
            console.log('▶️ 视频可以播放');
        });
        
        console.log('✅ SignLanguageVideoPlayer 初始化完成');
        console.log('📦 容器尺寸:', this.container.clientWidth, 'x', this.container.clientHeight);
        console.log('📦 视频元素尺寸:', this.videoElement.clientWidth, 'x', this.videoElement.clientHeight);
    }
    
    /**
     * 播放手势序列
     * @param {Array} gestures - 手势名称数组，如 ['你好', '朋友', '我', '爱', '你']
     */
    async playSequence(gestures) {
        if (!gestures || gestures.length === 0) {
            console.warn('⚠️ 手势序列为空');
            return;
        }
        
        this.gestureSequence = gestures;
        this.currentGestureIndex = 0;
        this.isPlaying = true;
        this.isPaused = false;
        
        console.log(`🎬 开始播放手势序列: ${gestures.join(' → ')}`);
        
        await this.playCurrentGesture();
    }
    
    /**
     * 播放当前手势
     */
    async playCurrentGesture() {
        if (!this.isPlaying || this.isPaused) return;
        
        if (this.currentGestureIndex >= this.gestureSequence.length) {
            this.onSequenceComplete();
            return;
        }
        
        const gestureName = this.gestureSequence[this.currentGestureIndex];
        console.log(`📹 播放手势 [${this.currentGestureIndex + 1}/${this.gestureSequence.length}]: ${gestureName}`);
        
        // 触发手势变化回调
        if (this.onGestureChange) {
            this.onGestureChange(gestureName, this.currentGestureIndex, this.gestureSequence.length);
        }
        
        // 获取视频路径
        const videoPath = this.getVideoPath(gestureName);
        
        if (!videoPath) {
            console.warn(`⚠️ 未找到手势 "${gestureName}" 的视频，跳过`);
            this.currentGestureIndex++;
            await new Promise(resolve => setTimeout(resolve, 100));
            await this.playCurrentGesture();
            return;
        }
        
        // 加载并播放视频
        try {
            console.log('🔄 正在加载视频:', videoPath);
            
            return new Promise((resolve, reject) => {
                this.videoElement.src = videoPath;
                this.videoElement.load();
                
                // 设置超时
                const timeout = setTimeout(() => {
                    console.warn(`⚠️ 视频加载超时: ${gestureName}`);
                    this.currentGestureIndex++;
                    resolve(this.playCurrentGesture());
                }, 5000);
                
                this.videoElement.oncanplay = () => {
                    clearTimeout(timeout);
                    console.log('▶️ 开始播放:', gestureName);
                    this.videoElement.play().then(() => {
                        resolve();
                    }).catch(err => {
                        console.error('❌ play() 失败:', err);
                        clearTimeout(timeout);
                        this.currentGestureIndex++;
                        resolve(this.playCurrentGesture());
                    });
                };
                
                this.videoElement.onerror = (e) => {
                    clearTimeout(timeout);
                    console.error('❌ 视频加载错误:', e, '路径:', videoPath);
                    this.currentGestureIndex++;
                    resolve(this.playCurrentGesture());
                };
            });
            
        } catch (error) {
            console.error(`❌ 播放视频异常: ${videoPath}`, error);
            this.currentGestureIndex++;
            await new Promise(resolve => setTimeout(resolve, 200));
            await this.playCurrentGesture();
        }
    }
    
    /**
     * 获取手势视频路径
     */
    getVideoPath(gestureName) {
        // 使用 encodeURIComponent 处理中文路径
        const encodedGestureName = encodeURIComponent(gestureName);
        const possiblePaths = [
            `${this.options.videoBasePath}/${encodedGestureName}/sample_001.webm`,
        ];
        
        console.log(`🔍 视频路径：${possiblePaths[0]}`);
        return possiblePaths[0];
    }
    
    /**
     * 视频播放结束事件
     */
    async onVideoEnded() {
        console.log(`✅ 手势播放完成: ${this.gestureSequence[this.currentGestureIndex]}`);
        
        this.currentGestureIndex++;
        
        if (this.currentGestureIndex >= this.gestureSequence.length) {
            this.onSequenceComplete();
        } else {
            // 短暂延迟后播放下一个
            await new Promise(resolve => setTimeout(resolve, 300));
            await this.playCurrentGesture();
        }
    }
    
    /**
     * 视频播放错误事件
     */
    onVideoError(event) {
        console.error('❌ 视频播放错误:', event);
        this.currentGestureIndex++;
        this.playCurrentGesture();
    }
    
    /**
     * 序列播放完成
     */
    onSequenceComplete() {
        this.isPlaying = false;
        this.isPaused = false;
        this.currentGestureIndex = 0;
        
        console.log('🎉 手势序列播放完成');
        
        if (this.onComplete) {
            this.onComplete();
        }
    }
    
    /**
     * 暂停播放
     */
    pause() {
        if (!this.isPlaying) return;
        
        this.isPaused = true;
        this.videoElement.pause();
        console.log('⏸️ 播放已暂停');
    }
    
    /**
     * 继续播放
     */
    async resume() {
        if (!this.isPaused) return;
        
        this.isPaused = false;
        console.log('▶️ 继续播放');
        
        try {
            await this.videoElement.play();
        } catch (error) {
            console.error('❌ 继续播放失败:', error);
            await this.playCurrentGesture();
        }
    }
    
    /**
     * 停止播放
     */
    stop() {
        this.isPlaying = false;
        this.isPaused = false;
        this.currentGestureIndex = 0;
        this.videoElement.pause();
        this.videoElement.currentTime = 0;
        console.log('⏹️ 播放已停止');
    }
    
    /**
     * 获取当前播放状态
     */
    getStatus() {
        return {
            isPlaying: this.isPlaying,
            isPaused: this.isPaused,
            currentIndex: this.currentGestureIndex,
            totalGestures: this.gestureSequence.length,
            currentGesture: this.gestureSequence[this.currentGestureIndex] || null
        };
    }
    
    /**
     * 销毁播放器
     */
    destroy() {
        this.stop();
        if (this.videoElement && this.videoElement.parentNode) {
            this.videoElement.parentNode.removeChild(this.videoElement);
        }
    }
}
