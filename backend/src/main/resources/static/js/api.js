// frontend/js/api.js
const API_BASE = 'http://localhost:8000';

class SignAPI {
    // ========== 系统状态 ==========
    static async health() {
        try {
            const res = await fetch(`${API_BASE}/health`);
            return await res.json();
        } catch (error) {
            console.error('健康检查失败:', error);
            return { status: 'error' };
        }
    }

    static async getClasses() {
        try {
            const res = await fetch(`${API_BASE}/classes`);
            return await res.json();
        } catch (error) {
            console.error('获取类别失败:', error);
            return { classes: [], count: 0 };
        }
    }

    // ========== 手势识别 ==========
    static async detectImage(file) {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch(`${API_BASE}/detect`, {
                method: 'POST',
                body: formData
            });
            return await res.json();
        } catch (error) {
            console.error('识别失败:', error);
            return { success: false, detections: [] };
        }
    }

    // ========== LLM交互 ==========
    static async understandGestures(gestures) {
        try {
            const res = await fetch(`${API_BASE}/understand`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ gestures })
            });
            return await res.json();
        } catch (error) {
            console.error('理解手势失败:', error);
            return { response: '连接失败，请检查网络' };
        }
    }

    static async chat(message, gestures = []) {
        try {
            const res = await fetch(`${API_BASE}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message, gestures })
            });
            return await res.json();
        } catch (error) {
            console.error('对话失败:', error);
            return { response: '连接失败，请检查网络' };
        }
    }

    static async translate(gestures) {
        try {
            const res = await fetch(`${API_BASE}/translate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ gestures })
            });
            return await res.json();
        } catch (error) {
            console.error('翻译失败:', error);
            return { text: '' };
        }
    }

    // ========== 历史记录 ==========
    static async getHistory() {
        try {
            const res = await fetch(`${API_BASE}/history`);
            return await res.json();
        } catch (error) {
            console.error('获取历史失败:', error);
            return { history: [] };
        }
    }

    static async clearHistory() {
        try {
            const res = await fetch(`${API_BASE}/history/clear`, {
                method: 'POST'
            });
            return await res.json();
        } catch (error) {
            console.error('清空历史失败:', error);
            return { success: false };
        }
    }
}

// WebSocket管理器
class WebSocketManager {
    constructor(url) {
        this.url = url;
        this.ws = null;
        this.listeners = [];
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    connect() {
        try {
            this.ws = new WebSocket(this.url);

            this.ws.onopen = () => {
                console.log('WebSocket连接成功');
                this.reconnectAttempts = 0;
                this.triggerListeners('open');
            };

            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.triggerListeners('message', data);
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket错误:', error);
                this.triggerListeners('error', error);
            };

            this.ws.onclose = () => {
                console.log('WebSocket连接关闭');
                this.triggerListeners('close');
                this.reconnect();
            };
        } catch (error) {
            console.error('WebSocket连接失败:', error);
        }
    }

    reconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            setTimeout(() => this.connect(), 2000);
        }
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(data);
        }
    }

    addListener(callback) {
        this.listeners.push(callback);
    }

    triggerListeners(event, data = null) {
        this.listeners.forEach(callback => callback(event, data));
    }

    close() {
        if (this.ws) {
            this.ws.close();
        }
    }
}