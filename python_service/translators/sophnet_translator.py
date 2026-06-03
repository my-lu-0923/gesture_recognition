"""
Sophnet 翻译器和对话器
使用 Sophnet 平台 API（兼容 OpenAI SDK）
支持模型：Qwen3-VL-235B、GLM-4-7、MiniMax-M2.5
"""

import os
import requests
from typing import List, Dict, Optional


class SophnetTranslator:
    """
    Sophnet 翻译器 - 用于手语翻译和AI对话
    
    功能：
    1. 将手语词汇序列翻译成通顺的中文句子
    2. 提供智能对话功能
    3. 支持上下文理解
    """
    
    def __init__(self, api_key: str = None, base_url: str = None, model: str = "Qwen3-VL-235B-A22B-Instruct"):
        """
        初始化 Sophnet 翻译器
        
        Args:
            api_key: Sophnet API Key
            base_url: API 基础 URL
            model: 使用的模型名称，默认 Qwen3-VL-235B-A22B-Instruct
        """
        self.api_key = api_key or os.getenv('SOPHNET_API_KEY')
        self.base_url = base_url or os.getenv('SOPHNET_BASE_URL', 'https://www.sophnet.com/api/open-apis/v1')
        self.model = model
        self.api_url = f"{self.base_url}/chat/completions"
        self.is_loaded = self.api_key is not None
        
        if self.is_loaded:
            print(f"✅ Sophnet 翻译器初始化成功，模型: {model}")
        else:
            print("⚠️ 未找到 SOPHNET_API_KEY，Sophnet 翻译器未启用")
    
    def is_available(self) -> bool:
        """检查翻译器是否可用"""
        return self.is_loaded
    
    def translate(self, gesture_sequence: List[str], context: str = None) -> str:
        """
        将手语词汇序列翻译成通顺的中文句子
        
        Args:
            gesture_sequence: 手势词汇序列
            context: 上下文信息（可选）
            
        Returns:
            翻译后的中文句子
        """
        if not self.is_loaded:
            return self._fallback_translate(gesture_sequence)
        
        try:
            system_prompt = """你是一个专业的手语翻译助手。你的任务是将手语词汇序列翻译成通顺、自然的中文句子。

翻译规则：
1. 理解手语词汇的含义和语序
2. 根据中文语法调整词序，使句子通顺
3. 适当添加必要的连接词、助词等，使句子完整
4. 删除重复的词汇
5. 添加合适的标点符号（句号、问号、感叹号等）
6. 保持原意不变，不要添加额外信息

示例：
- 输入：['你', '好', '吗'] → 输出：你好吗？
- 输入：['请', '问', '你', '叫', '什么', '名字'] → 输出：请问你叫什么名字？
- 输入：['祝', '你', '生日', '快乐'] → 输出：祝你生日快乐！
- 输入：['我', '爱', '你'] → 输出：我爱你！

请直接输出翻译结果，不要添加任何解释。"""
            
            gestures_str = ' → '.join(gesture_sequence)
            user_message = f"请将以下手语词汇序列翻译成通顺的中文句子：\n{gestures_str}"
            
            if context:
                user_message += f"\n\n上下文信息：{context}"
            
            response = self._call_api(system_prompt, user_message, temperature=0.3)
            
            if response:
                print(f"✅ Sophnet 翻译成功：{gestures_str} → {response}")
                return response
            else:
                return self._fallback_translate(gesture_sequence)
                
        except Exception as e:
            print(f"❌ Sophnet 翻译异常：{str(e)}")
            return self._fallback_translate(gesture_sequence)
    
    def chat(self, message: str, history: List[Dict] = None) -> str:
        """
        与用户进行智能对话
        
        Args:
            message: 用户消息
            history: 对话历史（可选）
            
        Returns:
            AI 回复
        """
        if not self.is_loaded:
            return self._fallback_chat(message)
        
        try:
            system_prompt = """你是一个友好、专业的手语AI助手。你的职责是：

1. 回答用户关于手语的问题（历史、学习方法、语法特点等）
2. 帮助用户学习手语
3. 解释手语词汇的含义和用法
4. 提供手语学习建议

回答要求：
- 直接回答问题，简洁明了
- 使用友好的语气
- 如果问题与手语无关，正常回答即可
- 回答完毕后立即结束，不要继续说其他内容
- 使用 Markdown 格式使回答更易读"""
            
            messages = [
                {'role': 'system', 'content': system_prompt}
            ]
            
            if history:
                messages.extend(history)
            
            messages.append({'role': 'user', 'content': message})
            
            response = self._call_api_messages(messages, temperature=0.7)
            
            if response:
                print(f"✅ Sophnet 对话成功：{message[:50]}... → {response[:100]}...")
                return response
            else:
                return self._fallback_chat(message)
                
        except Exception as e:
            print(f"❌ Sophnet 对话异常：{str(e)}")
            return self._fallback_chat(message)
    
    def _call_api(self, system_prompt: str, user_message: str, temperature: float = 0.7) -> Optional[str]:
        """调用 Sophnet API"""
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.api_key}'
        }
        
        data = {
            'model': self.model,
            'messages': [
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': user_message}
            ],
            'temperature': temperature,
            'max_tokens': 500
        }
        
        response = requests.post(self.api_url, headers=headers, json=data, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            return result['choices'][0]['message']['content'].strip()
        else:
            print(f"⚠️ Sophnet API 调用失败：{response.status_code} - {response.text}")
            return None
    
    def _call_api_messages(self, messages: List[Dict], temperature: float = 0.7) -> Optional[str]:
        """调用 Sophnet API（带消息历史）"""
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.api_key}'
        }
        
        data = {
            'model': self.model,
            'messages': messages,
            'temperature': temperature,
            'max_tokens': 500
        }
        
        response = requests.post(self.api_url, headers=headers, json=data, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            return result['choices'][0]['message']['content'].strip()
        else:
            print(f"⚠️ Sophnet API 调用失败：{response.status_code} - {response.text}")
            return None
    
    def _fallback_translate(self, gesture_sequence: List[str]) -> str:
        """降级到规则翻译"""
        if not gesture_sequence:
            return "等待识别手势..."
        
        result = ''.join(gesture_sequence)
        
        if any(word in result for word in ['吗', '什么', '谁', '哪里', '怎么']):
            result += '？'
        elif any(word in result for word in ['祝', '快乐', '谢谢', '好']):
            result += '！'
        else:
            result += '。'
        
        return result
    
    def _fallback_chat(self, message: str) -> str:
        """降级到规则对话"""
        message_lower = message.lower()
        
        if '发展史' in message or '历史' in message:
            return """手语的发展历史非常悠久：

📜 **古代时期** - 手语自古就存在于聋哑人社区中
📚 **近代发展** - 1760年法国建立第一所聋哑学校
🌍 **现代** - 全球有超过300种不同的手语

中国手语(CSL)也有自己独特的语法和词汇体系。"""
        elif '怎么学' in message or '学习' in message:
            return """学习手语的建议：

1️⃣ 从基本字母和数字的手势开始
2️⃣ 学习常用词汇（你好、谢谢、我爱你等）
3️⃣ 参加手语培训班或在线课程
4️⃣ 与聋哑人交流实践"""
        elif '你好' in message or 'hi' in message:
            return "你好！我是手语AI助手，很高兴为你服务！有什么我可以帮你的吗？😊"
        else:
            return f"""我收到了您的问题：「{message}」

我是手语AI助手，可以帮您了解手语知识、学习手势、翻译句子等。请问我关于手语的问题吧！"""
