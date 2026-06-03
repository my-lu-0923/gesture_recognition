/**
 * 简化的手部可视化 - 使用Emoji和CSS动画
 * 替代复杂的Three.js 3D模型，更美观、更流畅
 */

class HandModelSimple {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('Container element not found');
            return;
        }
        
        this.currentGesture = 'idle';
        this.init();
    }
    
    init() {
        // 清空容器
        this.container.innerHTML = '';
        
        // 创建手势显示区域
        const displayDiv = document.createElement('div');
        displayDiv.id = 'gestureDisplay';
        displayDiv.style.cssText = `
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 12px;
            position: relative;
        `;
        
        // Emoji图标
        const emojiDiv = document.createElement('div');
        emojiDiv.id = 'gestureEmoji';
        emojiDiv.style.cssText = `
            font-size: 120px;
            margin-bottom: 20px;
            transition: all 0.3s ease;
            filter: drop-shadow(0 4px 8px rgba(0,0,0,0.2));
        `;
        emojiDiv.textContent = '🤚';
        
        // 手势名称
        const nameDiv = document.createElement('div');
        nameDiv.id = 'gestureName';
        nameDiv.style.cssText = `
            font-size: 28px;
            color: white;
            font-weight: bold;
            text-shadow: 0 2px 8px rgba(0,0,0,0.3);
            margin-bottom: 10px;
        `;
        nameDiv.textContent = '准备就绪';
        
        // 说明文字
        const descDiv = document.createElement('div');
        descDiv.id = 'gestureDesc';
        descDiv.style.cssText = `
            font-size: 14px;
            color: rgba(255,255,255,0.9);
            text-align: center;
            max-width: 80%;
        `;
        descDiv.textContent = '等待手势输入...';
        
        displayDiv.appendChild(emojiDiv);
        displayDiv.appendChild(nameDiv);
        displayDiv.appendChild(descDiv);
        this.container.appendChild(displayDiv);
        
        this.emojiEl = emojiDiv;
        this.nameEl = nameDiv;
        this.descEl = descDiv;
    }
    
    setPose(gestureName) {
        if (!this.emojiEl || !this.nameEl || !this.descEl) return;
        
        this.currentGesture = gestureName;
        
        // 手势到Emoji的映射（包含所有35个手语类别）
        const gestureMap = {
            'idle': { emoji: '🤚', name: '准备就绪', desc: '等待手势输入...' },
            '你好': { emoji: '👋', name: '你好', desc: '挥手问候' },
            '谢谢': { emoji: '🙏', name: '谢谢', desc: '双手合十表示感谢' },
            '爱': { emoji: '🤟', name: '爱', desc: 'ILY手势 - I Love You' },
            '喜欢': { emoji: '🤟', name: '喜欢', desc: '与爱相同的手势' },
            '我': { emoji: '👈', name: '我', desc: '指向自己' },
            '你': { emoji: '👉', name: '你', desc: '指向对方' },
            '他': { emoji: '👉', name: '他', desc: '指向第三方（右）' },
            '她': { emoji: '👉', name: '她', desc: '指向第三方（左）' },
            '朋友': { emoji: '🤝', name: '朋友', desc: '握手姿势' },
            '好': { emoji: '👍', name: '好', desc: '竖起大拇指' },
            '是': { emoji: '✅', name: '是', desc: '确认手势' },
            '不': { emoji: '❌', name: '不', desc: '否定手势' },
            '有': { emoji: '✋', name: '有', desc: '张开手掌' },
            '没有': { emoji: '🚫', name: '没有', desc: '否定+有' },
            '吃': { emoji: '🍽️', name: '吃', desc: '模拟进食动作' },
            '喝': { emoji: '🥤', name: '喝', desc: '模拟喝水动作' },
            '水': { emoji: '💧', name: '水', desc: 'W手形' },
            '饭': { emoji: '🍚', name: '饭', desc: '模拟吃饭' },
            '今天': { emoji: '📅', name: '今天', desc: '指当下时间' },
            '明天': { emoji: '📆', name: '明天', desc: '指向未来' },
            '早上': { emoji: '🌅', name: '早上', desc: '太阳升起' },
            '晚上': { emoji: '🌙', name: '晚上', desc: '月亮出现' },
            '晚安': { emoji: '😴', name: '晚安', desc: '睡觉手势' },
            '生日': { emoji: '🎂', name: '生日', desc: '庆祝生日' },
            '快乐': { emoji: '😊', name: '快乐', desc: '开心表情' },
            '高兴': { emoji: '😄', name: '高兴', desc: '喜悦表情' },
            '新': { emoji: '✨', name: '新', desc: '新鲜事物' },
            '祝': { emoji: '🎉', name: '祝', desc: '祝福手势' },
            '请': { emoji: '🙋', name: '请', desc: '礼貌请求' },
            '停': { emoji: '🛑', name: '停', desc: '停止手势' },
            '慢': { emoji: '🐢', name: '慢', desc: '缓慢动作' },
            '走': { emoji: '🚶', name: '走', desc: '行走动作' },
            '人': { emoji: '👥', name: '人', desc: '人的形象' },
            '什么': { emoji: '❓', name: '什么', desc: '疑问手势' },
            '名字': { emoji: '📛', name: '名字', desc: '姓名牌' },
            '介绍': { emoji: '📝', name: '介绍', desc: '引见手势' },
            '认识': { emoji: '🤝', name: '认识', desc: '相识握手' },
            '结婚': { emoji: '💒', name: '结婚', desc: '婚礼手势' },
            '妻子': { emoji: '👰', name: '妻子', desc: '新娘形象' },
            '茶': { emoji: '🍵', name: '茶', desc: '喝茶动作' },
            '花': { emoji: '🌸', name: '花', desc: '花朵形象' },
            '时间': { emoji: '⏰', name: '时间', desc: '看手表' },
            '时候': { emoji: '🕐', name: '时候', desc: '时间点' },
            '平': { emoji: '⚖️', name: '平', desc: '平衡手势' },
            '安': { emoji: '🔒', name: '安', desc: '安全手势' },
            '一': { emoji: '☝️', name: '一', desc: '食指伸出' },
            '二': { emoji: '✌️', name: '二', desc: '胜利手势' },
            '三': { emoji: '🤟', name: '三', desc: '三根手指' },
            '四': { emoji: '🖖', name: '四', desc: '四根手指' },
            '五': { emoji: '🖐️', name: '五', desc: '张开手掌' },
            '0': { emoji: '⭕', name: '零', desc: '圆形手势' },
            '6': { emoji: '🤙', name: '六', desc: '六的手势' },
            '7': { emoji: '🤏', name: '七', desc: '七的手势' },
            '8': { emoji: '🔫', name: '八', desc: '八的手势' },
            '9': { emoji: '🪝', name: '九', desc: '九的手势' },
        };
        
        const gesture = gestureMap[gestureName] || { 
            emoji: '🤔', 
            name: gestureName, 
            desc: '未知手势' 
        };
        
        // 添加动画效果
        this.emojiEl.style.transform = 'scale(0.8)';
        this.emojiEl.style.opacity = '0.5';
        
        setTimeout(() => {
            this.emojiEl.textContent = gesture.emoji;
            this.nameEl.textContent = `${gesture.name}`;
            this.descEl.textContent = gesture.desc;
            
            this.emojiEl.style.transform = 'scale(1)';
            this.emojiEl.style.opacity = '1';
        }, 150);
    }
}

// 导出类（保持与原有HandModel3D相同的接口）
window.HandModel3D = HandModelSimple;
