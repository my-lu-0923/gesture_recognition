# translators/qwen_translator.py
"""
基于阿里云 Qwen（千问）API 的翻译器
使用 DashScope SDK 调用通义千问大模型
"""
import os
import time
import dashscope
from dashscope import Generation


class QwenTranslator:
    """基于阿里云千问 API 的手语翻译器"""

    def __init__(self, api_key=None):
        self.is_loaded = False
        self.api_key = api_key or os.getenv('DASHSCOPE_API_KEY')
        
        if not self.api_key:
            print("⚠️ 未找到 DASHSCOPE_API_KEY，请设置环境变量")
            print("获取 API Key: https://dashscope.console.aliyun.com/apiKey")
            return
        
        # 配置 API Key
        dashscope.api_key = self.api_key
        
        # 系统提示词
        self.system_prompt = """你是一个专业的手语翻译助手。你的任务是将手语词汇序列翻译成通顺、自然的中文句子。

规则：
1. 手语语序可能与汉语不同，你需要调整为正常汉语语序
2. 添加必要的助词、连接词使句子通顺
3. 保持原意不变
4. 输出要自然、口语化
5. 如果是疑问句，添加问号
6. 如果输入是单个词汇，也尽量扩展成完整的句子

示例：
输入：我 想 吃饭
输出：我想吃饭

输入：你 名字 什么
输出：你叫什么名字？

输入：我 和 朋友 一起 去 学校
输出：我和朋友一起去学校

输入：谢谢
输出：非常感谢！

现在请翻译："""
        
        self.is_loaded = True
        print("✅ Qwen 翻译器初始化成功")

    def translate(self, gloss_sequence):
        """
        使用 Qwen API 翻译手势序列
        
        Args:
            gloss_sequence: 手势词汇列表，如 ["我", "想", "吃饭"]
            
        Returns:
            翻译后的中文句子
        """
        if not self.is_loaded:
            return self.fallback_translate(gloss_sequence)
        
        # 构建输入
        gloss_text = " ".join(gloss_sequence)
        
        # 构建消息
        messages = [
            {'role': 'system', 'content': self.system_prompt},
            {'role': 'user', 'content': f"输入：{gloss_text}\n输出："}
        ]
        
        try:
            # 调用 Qwen API
            response = Generation.call(
                model='qwen-turbo',  # 使用 qwen-turbo 模型
                messages=messages,
                result_format='message',  # 设置返回格式为 message
                temperature=0.3,  # 降低随机性
                top_p=0.9,
                max_tokens=100  # 限制输出长度
            )
            
            if response.status_code == 200:
                # 提取翻译结果
                translation = response.output.choices[0].message.content.strip()
                
                # 清理结果
                if "输出：" in translation:
                    translation = translation.split("输出：")[-1].strip()
                
                print(f"✅ Qwen 翻译成功：{' '.join(gloss_sequence)} -> {translation}")
                return translation
            else:
                print(f"⚠️ Qwen API 调用失败：{response.code} - {response.message}")
                return self.fallback_translate(gloss_sequence)
                
        except Exception as e:
            print(f"❌ Qwen 翻译异常：{str(e)}")
            return self.fallback_translate(gloss_sequence)

    def chat(self, message, history=None):
        """
        与 Qwen 进行对话
        
        Args:
            message: 用户消息
            history: 对话历史，格式为 [{'role': 'user', 'content': '...'}, {'role': 'assistant', 'content': '...'}]
            
        Returns:
            AI 回复
        """
        if not self.is_loaded:
            return "抱歉，AI 助手暂未启用，请稍后再试。"
        
        try:
            # 构建消息历史
            messages = [
                {'role': 'system', 'content': '你是一个友好、专业的手语助手，帮助用户学习手语、解答手语相关问题。'}
            ]
            
            # 添加历史对话
            if history:
                messages.extend(history)
            
            # 添加当前问题
            messages.append({'role': 'user', 'content': message})
            
            # 调用 Qwen API
            response = Generation.call(
                model='qwen-turbo',
                messages=messages,
                result_format='message',
                temperature=0.7,
                max_tokens=200
            )
            
            if response.status_code == 200:
                reply = response.output.choices[0].message.content.strip()
                print(f"✅ Qwen 对话成功：{message} -> {reply}")
                return reply
            else:
                print(f"⚠️ Qwen 对话失败：{response.code} - {response.message}")
                return "抱歉，AI 助手暂时无法响应，请稍后再试。"
                
        except Exception as e:
            print(f"❌ Qwen 对话异常：{str(e)}")
            return "抱歉，出现了一些问题，请稍后再试。"

    def fallback_translate(self, gloss_sequence):
        """降级翻译（规则翻译）"""
        from .rule_translator import RuleTranslator
        rule = RuleTranslator()
        return rule.translate(gloss_sequence)

    def is_available(self):
        """检查 Qwen 是否可用"""
        return self.is_loaded and self.api_key is not None


# 测试
if __name__ == "__main__":
    translator = QwenTranslator()
    
    if translator.is_available():
        test_cases = [
            ["我", "想", "吃饭"],
            ["你", "名字", "什么"],
            ["我", "和", "朋友", "一起", "去", "学校"],
            ["明天", "我", "要", "去", "医院"],
            ["谢谢"],
        ]
        
        for gloss in test_cases:
            result = translator.translate(gloss)
            print(f"\n手势：{' '.join(gloss)}")
            print(f"Qwen 翻译：{result}")
        
        # 测试对话
        print("\n\n=== 对话测试 ===")
        reply = translator.chat("你好，我刚开始学手语，有什么建议吗？")
        print(f"用户：你好，我刚开始学手语，有什么建议吗？")
        print(f"AI: {reply}")
    else:
        print("Qwen 不可用，请检查 API Key 配置")
