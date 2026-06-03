// frontend/js/api.js
const API_BASE = 'http://localhost:8080';
console.log('[API] api.js 加载中... v5, API_BASE =', API_BASE);

// 测试标记
window.apiJsLoaded = true;
window.API_BASE_VALUE = API_BASE; // 暴露给全局用于调试

// 定义 SignAPI 对象
const SignAPI = {
    // 登录
    login: async (username, password) => {
        try {
            const res = await fetch(`${API_BASE}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', //支持跨域携带cookie
                body: JSON.stringify({ username, password })
            });
            return await res.json();
        } catch (error) {
            console.error('登录失败:', error);
            return { success: false, message: '连接失败: ' + error.message };
        }
    },

    // 注册
    register: async (username, email, password) => {
        try {
            const res = await fetch(`${API_BASE}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ username, email, password })
            });
            return await res.json();
        } catch (error) {
            console.error('注册失败:', error);
            return { success: false, message: '连接失败: ' + error.message };
        }
    },

    // 退出登录
    logout: async () => {
        try {
            const res = await fetch(`${API_BASE}/api/logout`, {
                method: 'POST',
                credentials: 'include'
            });
            return await res.json();
        } catch (error) {
            console.error('退出失败:', error);
            return { success: false };
        }
    },

    // 检查登录状态
    checkLogin: async () => {
        try {
            const res = await fetch(`${API_BASE}/api/check`, {
                method: 'GET',
                credentials: 'include'
            });
            return await res.json();
        } catch (error) {
            console.error('检查登录失败:', error);
            return { loggedIn: false };
        }
    },

    // 健康检查
    health: async () => {
        try {
            const res = await fetch(`${API_BASE}/api/health`, {
                method: 'GET',
                credentials: 'include'
            });
            return await res.json();
        } catch (error) {
            console.error('健康检查失败:', error);
            return { status: 'error' };
        }
    },

    // 获取类别
    getClasses: async () => {
        try {
            const res = await fetch(`${API_BASE}/api/class_names`, {
                method: 'GET',
                credentials: 'include'
            });
            return await res.json();
        } catch (error) {
            console.error('获取类别失败:', error);
            return { class_names: [], count: 0 };
        }
    },

    // 获取LLM状态
    getLLMStatus: async () => {
        try {
            const res = await fetch(`${API_BASE}/api/llm/status`, {
                method: 'GET',
                credentials: 'include'
            });
            return await res.json();
        } catch (error) {
            console.error('获取LLM状态失败:', error);
            return { available: false };
        }
    },

    // 手势识别 (YOLO)
    recognize: async (imageBase64, sessionId) => {
        try {
            const res = await fetch(`${API_BASE}/api/recognize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ image: imageBase64, session_id: sessionId })
            });
            return await res.json();
        } catch (error) {
            console.error('识别失败:', error);
            return { detected: false, error: error.message };
        }
    },

    recognizeUpload: async (imageBase64, sessionId) => {
        try {
            const res = await fetch(`${API_BASE}/api/recognize/upload`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ image: imageBase64, session_id: sessionId })
            });
            return await res.json();
        } catch (error) {
            console.error('上传识别失败:', error);
            return { detected: false, error: error.message };
        }
    },

    // 混合识别 (YOLO + LSTM) - 通过Java后端代理到Python
    recognizeHybrid: async (imageBase64, sessionId) => {
        try {
            const res = await fetch(`${API_BASE}/api/recognize_hybrid`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ image: imageBase64, session_id: sessionId })
            });
            return await res.json();
        } catch (error) {
            console.error('混合识别失败:', error);
            return { detected: false, error: error.message };
        }
    },

    // LSTM识别 - 通过Java后端代理到Python
    recognizeLSTM: async (imageBase64, sessionId) => {
        try {
            const res = await fetch(`${API_BASE}/api/recognize_lstm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ image: imageBase64, session_id: sessionId })
            });
            return await res.json();
        } catch (error) {
            console.error('LSTM识别失败:', error);
            return { detected: false, error: error.message };
        }
    },

    // 规则翻译
    ruleTranslate: async (sessionId) => {
        try {
            const res = await fetch(`${API_BASE}/api/translate/rule`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ session_id: sessionId })
            });
            return await res.json();
        } catch (error) {
            console.error('规则翻译失败:', error);
            return { success: false, error: error.message };
        }
    },

    // LLM翻译
    llmTranslate: async (sessionId) => {
        try {
            const res = await fetch(`${API_BASE}/api/translate/llm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ session_id: sessionId })
            });
            return await res.json();
        } catch (error) {
            console.error('LLM翻译失败:', error);
            return { success: false, error: error.message };
        }
    },

    // AI对话
    chat: async (message) => {
        try {
            const res = await fetch(`${API_BASE}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ message: message })
            });
            return await res.json();
        } catch (error) {
            console.error('AI对话失败:', error);
            return { success: false, response: '网络错误，请检查连接' };
        }
    },

    // 获取历史记录列表
    getHistoryList: async (page = 0, size = 20) => {
        try {
            const res = await fetch(`${API_BASE}/api/history/list?page=${page}&size=${size}`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            return await res.json();
        } catch (error) {
            console.error('获取历史记录失败:', error);
            return { success: false, data: [], total: 0 };
        }
    },

    // 获取统计数据
    getHistoryStats: async () => {
        try {
            const res = await fetch(`${API_BASE}/api/history/stats`, {
                method: 'GET',
                credentials: 'include'
            });
            return await res.json();
        } catch (error) {
            console.error('获取统计数据失败:', error);
            return { success: false };
        }
    },

    // 清空历史记录
    clearHistory: async () => {
        try {
            const res = await fetch(`${API_BASE}/api/history/clear`, {
                method: 'DELETE',
                credentials: 'include'
            });
            return await res.json();
        } catch (error) {
            console.error('清空历史失败:', error);
            return { success: false };
        }
    },

    // 删除单条记录
    deleteHistoryItem: async (id) => {
        try {
            const res = await fetch(`${API_BASE}/api/history/delete/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            return await res.json();
        } catch (error) {
            console.error('删除失败:', error);
            return { success: false };
        }
    },

    // 获取最近记录
    getRecentHistory: async (limit = 10) => {
        try {
            const res = await fetch(`${API_BASE}/api/history/recent?limit=${limit}`, {
                method: 'GET',
                credentials: 'include'
            });
            return await res.json();
        } catch (error) {
            console.error('获取最近记录失败:', error);
            return { success: false };
        }
    },

    // 导出历史数据
    exportHistory: async () => {
        try {
            const res = await fetch(`${API_BASE}/api/history/export`, {
                method: 'GET',
                credentials: 'include'
            });
            return await res.json();
        } catch (error) {
            console.error('导出失败:', error);
            return { success: false };
        }
    },

    getGestureLibrary: async () => {
        try {
            const res = await fetch(`${API_BASE}/api/gesture-library`, {
                method: 'GET',
                credentials: 'include'
            });
            return await res.json();
        } catch (error) {
            console.error('获取手势库失败:', error);
            return { success: false, data: [] };
        }
    },

    getLearningStats: async () => {
        try {
            const res = await fetch(`${API_BASE}/api/learning/stats`, {
                method: 'GET',
                credentials: 'include'
            });
            return await res.json();
        } catch (error) {
            console.error('获取学习统计失败:', error);
            return { success: false, data: {} };
        }
    },

    // 清空会话
    clearSession: async (sessionId) => {
        try {
            const res = await fetch(`${API_BASE}/api/session/clear`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ session_id: sessionId })
            });
            return await res.json();
        } catch (error) {
            console.error('清空会话失败:', error);
            return { success: false };
        }
    }
};

// 为了让全局可以使用
window.SignAPI = SignAPI;

// 控制台输出确认
console.log('API模块加载完成，API_BASE:', API_BASE);
console.log('SignAPI 可用方法:', Object.keys(SignAPI));
console.log('SignAPI.recognizeHybrid:', typeof SignAPI.recognizeHybrid);
console.log('SignAPI.recognizeLSTM:', typeof SignAPI.recognizeLSTM);