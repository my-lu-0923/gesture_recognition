# translators/llm_translator.py
"""
LLM翻译器 - 精准模式
用于最终翻译，生成自然语言
"""
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM
import re
import time
import os


class LLMTranslator:
    """基于大语言模型的手语翻译器"""

    def __init__(self, model_name=None):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.model = None
        self.tokenizer = None
        self.load_time = 0
        self.is_loaded = False
        
        # 优先使用本地模型路径
        local_model_path = "/Users/luuuuu/models/Qwen2-1.5B-Instruct"
        if os.path.exists(local_model_path):
            model_name = local_model_path
            print(f"✅ 检测到本地模型：{model_name}")
        else:
            model_name = "Qwen/Qwen2-1.5B-Instruct"
            print(f"⚠️ 未找到本地模型，将尝试从 HuggingFace 下载：{model_name}")

        print(f"LLM翻译器初始化，设备：{self.device}")
        print(f"模型：{model_name}")

        # 系统提示词
        self.system_prompt = """你是一个专业的手语翻译助手。你的任务是将手语词汇序列翻译成通顺、自然的中文句子。

规则：
1. 手语语序可能与汉语不同，你需要调整为正常汉语语序
2. 添加必要的助词、连接词使句子通顺
3. 保持原意不变
4. 输出要自然、口语化
5. 如果是疑问句，添加问号

示例：
输入：我 想 吃饭
输出：我想吃饭

输入：你 名字 什么
输出：你叫什么名字？

输入：我 和 朋友 一起 去 学校
输出：我和朋友一起去学校

现在请翻译："""

        # 尝试加载模型
        self.load_model(model_name)

    def load_model(self, model_name):
        """加载LLM模型"""
        try:
            print("正在加载LLM模型...")
            start_time = time.time()

            self.tokenizer = AutoTokenizer.from_pretrained(
                model_name,
                trust_remote_code=True
            )

            self.model = AutoModelForCausalLM.from_pretrained(
                model_name,
                torch_dtype=torch.float16,
                device_map="auto",
                trust_remote_code=True
            )
            self.model.eval()

            self.load_time = time.time() - start_time
            self.is_loaded = True
            print(f"✅ LLM模型加载成功，耗时: {self.load_time:.1f}秒")

        except Exception as e:
            print(f"⚠️ LLM模型加载失败: {str(e)}")
            print("将使用规则翻译器作为降级方案")
            self.is_loaded = False

    def translate(self, gloss_sequence):
        """
        使用LLM翻译手势序列
        """
        if not self.is_loaded or self.model is None:
            return self.fallback_translate(gloss_sequence)

        # 构建输入
        gloss_text = " ".join(gloss_sequence)
        prompt = f"{self.system_prompt}\n输入：{gloss_text}\n输出："

        try:
            # 编码输入
            inputs = self.tokenizer(prompt, return_tensors="pt", truncation=True, max_length=512)
            inputs = {k: v.to(self.device) for k, v in inputs.items()}

            # 生成翻译
            with torch.no_grad():
                outputs = self.model.generate(
                    **inputs,
                    max_new_tokens=50,
                    temperature=0.3,
                    do_sample=True,
                    top_p=0.9,
                    pad_token_id=self.tokenizer.eos_token_id
                )

            # 解码输出
            response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)

            # 提取翻译结果
            if "输出：" in response:
                translation = response.split("输出：")[-1].strip()
            else:
                translation = response.strip()

            # 清理结果
            translation = re.sub(r'^\s+', '', translation)
            translation = re.sub(r'\n', '', translation)

            return translation

        except Exception as e:
            print(f"LLM翻译失败: {str(e)}")
            return self.fallback_translate(gloss_sequence)

    def fallback_translate(self, gloss_sequence):
        """降级翻译（规则翻译）"""
        from .rule_translator import RuleTranslator
        rule = RuleTranslator()
        return rule.translate(gloss_sequence)

    def is_available(self):
        """检查LLM是否可用"""
        return self.is_loaded


# 测试
if __name__ == "__main__":
    translator = LLMTranslator()

    if translator.is_available():
        test_cases = [
            ["我", "想", "吃饭"],
            ["你", "名字", "什么"],
            ["我", "和", "朋友", "一起", "去", "学校"],
            ["明天", "我", "要", "去", "医院"],
        ]

        for gloss in test_cases:
            result = translator.translate(gloss)
            print(f"\n手势: {' '.join(gloss)}")
            print(f"LLM翻译: {result}")
    else:
        print("LLM不可用，请检查网络或模型下载")