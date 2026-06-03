// frontend/js/auth.js - 修复版，移除重复的 API_BASE
console.log('auth.js 加载中...');

// Auth Service v2.0 - 修复邮箱显示问题
// 修改时间：2026-03-26 16:30
class Auth {
    constructor() {
        this.currentUser = null;
        this.isAuthenticated = false;
        this.API_BASE = 'http://localhost:8080';  // 与后端服务端口一致
        this.loadUser();
    }

    async login(username, password) {
        try {
            const res = await fetch(`${this.API_BASE}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',  // 携带 cookie
                body: JSON.stringify({ username, password })
            });
    
            const data = await res.json();
    
            if (data.success) {
                console.log('=== 登录响应 ===');
                console.log('后端返回的数据:', data);
                // 从后端获取用户真实邮箱
                const userEmail = data.email || data.user?.email || username;
                console.log('提取的邮箱:', userEmail);
                this.currentUser = {
                    id: Date.now(),
                    name: username,
                    email: userEmail,
                    avatar: username.charAt(0).toUpperCase()
                };
                console.log('创建的用户对象:', this.currentUser);
                this.isAuthenticated = true;
                this.saveUser();
                return { success: true };
            } else {
                return { success: false, error: data.message || '登录失败' };
            }
        } catch (error) {
            console.error('登录请求失败:', error);
            return { success: false, error: '无法连接到服务器：' + error.message };
        }
    }

    async register(username, email, password) {
        try {
            const res = await fetch(`${this.API_BASE}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ username, email, password })
            });

            const data = await res.json();

            if (data.success) {
                return { success: true };
            } else {
                return { success: false, error: data.message || '注册失败' };
            }
        } catch (error) {
            console.error('注册请求失败:', error);
            return { success: false, error: '无法连接到服务器: ' + error.message };
        }
    }

    async logout() {
        try {
            await fetch(`${this.API_BASE}/api/logout`, {
                method: 'POST',
                credentials: 'include'
            });
        } catch (error) {
            console.error('退出请求失败:', error);
        }

        this.currentUser = null;
        this.isAuthenticated = false;
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    }

    async checkAuth() {
        console.log('>>> checkAuth() 开始执行');
        try {
            const res = await fetch(`${this.API_BASE}/api/check`, {
                method: 'GET',
                credentials: 'include'
            });
            console.log('>>> API 响应状态:', res.status);
            const data = await res.json();
            console.log('=== checkAuth 响应 ===');
            console.log('后端返回的数据:', data);

            if (data.loggedIn) {
                // 强制更新用户信息，总是使用后端返回的最新数据
                const userEmail = data.email || data.user?.email || data.username;
                console.log('提取的邮箱:', userEmail);

                // 创建新的用户对象（总是重新创建，确保数据最新）
                const newUser = {
                    id: Date.now(),
                    name: data.username,
                    email: userEmail,
                    avatar: data.username.charAt(0).toUpperCase()
                };

                console.log('创建的用户对象:', newUser);

                // 检查是否需要更新
                const needUpdate = !this.currentUser ||
                    this.currentUser.name !== newUser.name ||
                    this.currentUser.email !== newUser.email;

                console.log('needUpdate:', needUpdate);
                console.log('当前 currentUser:', this.currentUser);

                if (needUpdate) {
                    this.currentUser = newUser;
                    this.isAuthenticated = true;
                    this.saveUser();
                    console.log('✅ 用户信息已更新并保存');
                } else {
                    console.log('用户信息无需更新');
                }

                console.log('<<< checkAuth() 返回 true');
                return true;
            } else {
                this.currentUser = null;
                this.isAuthenticated = false;
                localStorage.removeItem('user');
                console.log('<<< checkAuth() 返回 false - 未登录');
                return false;
            }
        } catch (error) {
            console.error('检查登录状态失败:', error);
            console.log('<<< checkAuth() 异常返回 false');
            return false;
        }
    }



    // async checkAuth() {
    //     console.log('>>> checkAuth() 开始执行');
    //     try {
    //         const res = await fetch(`${this.API_BASE}/api/check`, {
    //             method: 'GET',
    //             credentials: 'include'
    //         });
    //         console.log('>>> API 响应状态:', res.status);
    //         const data = await res.json();
    //         console.log('=== checkAuth 响应 ===');
    //         console.log('后端返回的数据:', data);
    //
    //         if (data.loggedIn) {
    //             // 检查是否需要更新（用户名变化或没有邮箱数据）
    //             const needUpdate = !this.currentUser ||
    //                                this.currentUser.name !== data.username ||
    //                                !this.currentUser.email ||
    //                                this.currentUser.email === this.currentUser.name;
    //
    //             console.log('needUpdate:', needUpdate);
    //             console.log('当前 currentUser:', this.currentUser);
    //
    //             if (needUpdate) {
    //                 // 从后端获取用户真实邮箱
    //                 const userEmail = data.email || data.user?.email || data.username;
    //                 console.log('提取的邮箱:', userEmail);
    //                 this.currentUser = {
    //                     id: Date.now(),
    //                     name: data.username,
    //                     email: userEmail,
    //                     avatar: data.username.charAt(0).toUpperCase()
    //                 };
    //                 console.log('创建的用户对象:', this.currentUser);
    //                 this.isAuthenticated = true;
    //                 this.saveUser();
    //             }
    //             console.log('<<< checkAuth() 返回 true');
    //             return true;
    //         } else {
    //             this.currentUser = null;
    //             this.isAuthenticated = false;
    //             localStorage.removeItem('user');
    //             console.log('<<< checkAuth() 返回 false - 未登录');
    //             return false;
    //         }
    //     } catch (error) {
    //         console.error('检查登录状态失败:', error);
    //         console.log('<<< checkAuth() 异常返回 false');
    //         return false;
    //     }
    // }

    saveUser() {
        if (this.currentUser) {
            localStorage.setItem('user', JSON.stringify(this.currentUser));
        }
    }

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

    requireAuth() {
        if (!this.isAuthenticated) {
            window.location.href = 'login.html';
            return false;
        }
        return true;
    }

    getUser() {
        console.log('=== getUser 被调用 ===');
        console.log('当前 currentUser:', this.currentUser);
        const storedUser = localStorage.getItem('user');
        console.log('localStorage 中的 user:', storedUser);
        if (storedUser) {
            try {
                const parsed = JSON.parse(storedUser);
                console.log('解析后的 user:', parsed);
            } catch(e) {
                console.error('解析失败:', e);
            }
        }
        return this.currentUser;
    }

    // 更新页面上的用户信息显示
    updateUserInfo() {
        if (!this.currentUser) return;
        
        const user = this.currentUser;
        const avatarLetter = user.name.charAt(0).toUpperCase();
        const email = user.email || user.name;
        
        // 更新侧边栏用户信息
        const sidebarAvatars = document.querySelectorAll('.sidebar .avatar');
        const sidebarNames = document.querySelectorAll('.sidebar .user-name');
        const sidebarEmails = document.querySelectorAll('.sidebar .user-email');
        
        sidebarAvatars.forEach(el => el.textContent = avatarLetter);
        sidebarNames.forEach(el => el.textContent = user.name);
        sidebarEmails.forEach(el => el.textContent = email);
        
        // 更新个人中心页面的用户信息
        const profileAvatars = document.querySelectorAll('.profile-avatar');
        const profileNames = document.querySelectorAll('.profile-name');
        const profileEmails = document.querySelectorAll('.profile-email');
        
        profileAvatars.forEach(el => el.textContent = avatarLetter);
        profileNames.forEach(el => el.textContent = user.name);
        profileEmails.forEach(el => el.textContent = email);
        
        // 更新表单中的输入框
        const usernameInputs = document.querySelectorAll('input[type="text"]');
        const emailInputs = document.querySelectorAll('input[type="email"]');
        
        usernameInputs.forEach(input => {
            if (input.placeholder && input.placeholder.includes('用户名')) {
                input.value = user.name;
            }
        });
        
        emailInputs.forEach(input => {
            if (input.placeholder && input.placeholder.includes('邮箱')) {
                input.value = email;
            }
        });
        
        console.log('页面用户信息已更新:', user);
    }
}

// 创建全局实例
const auth = new Auth();

// 页面加载完成后自动更新用户信息（不自动跳转）
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== DOMContentLoaded (auth.js) ===');
    console.log('auth.isAuthenticated:', auth.isAuthenticated);
    console.log('auth.currentUser:', auth.currentUser);
    
    // 只更新页面显示的用户信息，不做任何跳转
    // 跳转逻辑由各页面自己控制
    if (auth.currentUser && auth.isAuthenticated) {
        console.log('✅ 本地缓存已登录，更新页面用户信息...');
        try {
            auth.updateUserInfo();
        } catch (e) {
            console.log('⚠️ 当前页面没有用户信息元素，跳过更新');
        }
    }
    
    console.log('📄 当前页面:', window.location.pathname);
    console.log('️ auth.js 不会自动跳转，由页面自己控制');
});

console.log('auth.js 加载完成');