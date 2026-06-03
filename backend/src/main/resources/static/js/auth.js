// frontend/js/auth.js
class Auth {
    constructor() {
        this.currentUser = null;
        this.isAuthenticated = false;
        this.loadUser();
    }

    // 登录
    async login(email, password) {
        // 模拟登录（实际项目中应该调用后端API）
        return new Promise((resolve) => {
            setTimeout(() => {
                if (email && password) {
                    this.currentUser = {
                        id: 1,
                        name: '演示用户',
                        email: email,
                        avatar: '用'
                    };
                    this.isAuthenticated = true;
                    this.saveUser();
                    resolve({ success: true });
                } else {
                    resolve({ success: false, error: '请填写邮箱和密码' });
                }
            }, 500);
        });
    }

    // 注册
    async register(username, email, password) {
        // 模拟注册
        return new Promise((resolve) => {
            setTimeout(() => {
                if (username && email && password) {
                    resolve({ success: true });
                } else {
                    resolve({ success: false, error: '请填写完整信息' });
                }
            }, 500);
        });
    }

    // 登出
    logout() {
        this.currentUser = null;
        this.isAuthenticated = false;
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    }

    // 保存用户到本地存储
    saveUser() {
        if (this.currentUser) {
            localStorage.setItem('user', JSON.stringify(this.currentUser));
        }
    }

    // 从本地存储加载用户
    loadUser() {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                this.currentUser = JSON.parse(userStr);
                this.isAuthenticated = true;
            } catch (e) {
                console.error('加载用户失败:', e);
            }
        }
    }

    // 检查登录状态，未登录则跳转
    requireAuth() {
        if (!this.isAuthenticated) {
            window.location.href = 'login.html';
            return false;
        }
        return true;
    }

    // 获取当前用户
    getUser() {
        return this.currentUser;
    }
}

// 创建全局实例
const auth = new Auth();