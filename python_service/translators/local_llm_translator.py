# translators/local_llm_translator.py
"""
本地 LLM 翻译器 - 使用 Ollama
免费、快速、无需 API Key
"""
import requests
import json


class LocalLLMTranslator:
    """基于本地 Ollama 的手语翻译器"""
    
    def __init__(self, model_name="qwen2.5:0.5b", host="http://localhost:11434"):
        self.host = host
        self.model_name = model_name
        self.is_loaded = False
        self._check_connection()
    
    def _check_connection(self):
        """检查 Ollama 连接状态"""
        try:
            response = requests.get(f"{self.host}/api/tags", timeout=3)
            if response.status_code == 200:
                self.is_loaded = True
                return True
        except Exception:
            pass
        self.is_loaded = False
        return False
    
    def is_available(self):
        """检查是否可用 - 每次都重新检查连接"""
        if not self.is_loaded:
            self._check_connection()
        return self.is_loaded
    
    def translate(self, gloss_sequence):
        """
        使用本地 LLM 翻译手势序列
        """
        if not self.is_loaded:
            return self.fallback_translate(gloss_sequence)
        
        gloss_text = " ".join(gloss_sequence)
        
        # 构建提示词
        prompt = f"""你是一个专业的手语翻译助手。将手语词汇翻译成通顺的中文句子。
规则：
1. 调整手语语序为正常汉语
2. 添加必要的助词、连接词
3. 保持原意，输出自然口语化
4. 疑问句加问号，单个词汇也扩展成句子

输入：{gloss_text}
输出："""
        
        try:
            response = requests.post(
                f"{self.host}/api/generate",
                json={
                    "model": self.model_name,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.3,
                        "top_p": 0.9,
                        "max_tokens": 100
                    }
                },
                timeout=10
            )
            
            if response.status_code == 200:
                result = response.json()
                translation = result.get('response', '').strip()
                
                # 清理结果
                if "输出：" in translation:
                    translation = translation.split("输出：")[-1].strip()
                
                print(f"✅ 本地 LLM 翻译成功：{gloss_text} -> {translation}")
                return translation
            else:
                print(f"⚠️ 本地 LLM 调用失败：{response.status_code}")
                return self.fallback_translate(gloss_sequence)
                
        except Exception as e:
            print(f"❌ 本地 LLM 异常：{str(e)}")
            return self.fallback_translate(gloss_sequence)
    
    def chat(self, message, history=None):
        """对话功能"""
        if not self.is_loaded:
            return "抱歉，AI 助手暂未启用。"
        
        try:
            response = requests.post(
                f"{self.host}/api/generate",
                json={
                    "model": self.model_name,
                    "prompt": f"你是一个友好的手语助手。用户：{message}\n助手：",
                    "stream": False,
                    "options": {
                        "temperature": 0.7,
                        "max_tokens": 200
                    }
                },
                timeout=15
            )
            
            if response.status_code == 200:
                return response.json().get('response', '').strip()
            else:
                return "抱歉，AI 助手暂时无法响应。"
                
        except Exception as e:
            return "抱歉，出现了一些问题。"
    
    def chat_with_system(self, system_prompt, user_message):
        """带系统提示词的对话功能"""
        if not self.is_loaded:
            return "抱歉，AI 助手暂未启用。"
        
        try:
            # 构建完整的提示词
            full_prompt = f"""{system_prompt}

用户：{user_message}
助手："""
            
            response = requests.post(
                f"{self.host}/api/generate",
                json={
                    "model": self.model_name,
                    "prompt": full_prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.3,
                        "top_p": 0.9,
                        "num_predict": 300
                    }
                },
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json().get('response', '').strip()
                print(f"✅ 本地 LLM 对话成功：{user_message[:50]}... -> {result[:100]}...")
                return result
            else:
                print(f"⚠️ 本地 LLM 对话失败：{response.status_code}")
                return "抱歉，AI 助手暂时无法响应，请稍后再试。"
                
        except Exception as e:
            print(f"❌ 本地 LLM 对话异常：{str(e)}")
            return "抱歉，出现了一些问题，请稍后再试。"
    
    def fallback_translate(self, gloss_sequence):
        """降级到规则翻译"""
        from .rule_translator import RuleTranslator
        rule = RuleTranslator()
        return rule.translate(gloss_sequence)


# 测试
if __name__ == "__main__":
    translator = LocalLLMTranslator()
    
    if translator.is_available():
        test_cases = [
            ["我", "想", "吃饭"],
            ["你", "名字", "什么"],
            ["谢谢"],
        ]
        
        for gloss in test_cases:
            result = translator.translate(gloss)
            print(f"\n手势：{' '.join(gloss)}")
            print(f"翻译：{result}")
    else:
        print("本地 LLM 不可用")
