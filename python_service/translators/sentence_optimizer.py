"""
句子优化器 - 将手语识别的词汇序列优化为通顺的中文句子

功能：
1. 去重：去除连续重复的词汇
2. 过滤：去除无意义的词汇（如"的"、"了"等助词在某些情况下）
3. 补全：根据上下文补全缺失的词汇
4. 排序：调整词序使句子更通顺
5. 语义优化：将手语词汇转换为自然语言
"""

import logging
from typing import List, Dict, Optional
from collections import Counter

logger = logging.getLogger(__name__)


class SentenceOptimizer:
    """
    句子优化器
    
    将手语识别的词汇序列优化为通顺的中文句子
    """
    
    # 常见手语词汇到自然语言的映射
    VOCABULARY_MAP = {
        # 人称代词
        "你/您/你的/这": "你",
        "我": "我",
        "他": "他",
        "她": "她",
        "我们": "我们",
        "你们": "你们",
        
        # 时间词
        "时间/时候": "时候",
        "早上": "早上",
        "今天": "今天",
        "明天": "明天",
        "昨天": "昨天",
        
        # 动词
        "祝": "祝",
        "请": "请",
        "有": "有",
        "是": "是",
        "在": "在",
        "去": "去",
        "来": "来",
        "吃": "吃",
        "喝": "喝",
        "看": "看",
        "听": "听",
        "说": "说",
        "做": "做",
        "想": "想",
        "爱": "爱",
        "喜欢": "喜欢",
        "好": "好",
        "快乐/高兴": "快乐",
        
        # 名词
        "生日": "生日",
        "朋友": "朋友",
        "家": "家",
        "学校": "学校",
        "工作": "工作",
        "钱": "钱",
        "书": "书",
        "水": "水",
        "饭": "饭",
        "茶": "茶",
        "花": "花",
        "门": "门",
        "路": "路",
        "新": "新",
        "走": "走",
        
        # 形容词
        "平": "平",
        "安": "安",
        "新": "新",
        "好": "好",
        
        # 数字
        "0": "零",
        "1": "一",
        "2": "二",
        "3": "三",
        "4": "四",
        "5": "五",
        "6": "六",
        "7": "七",
        "8": "八",
        "9": "九",
    }
    
    # 常见搭配模式（用于补全和排序）
    COMMON_PATTERNS = [
        # 生日祝福
        (["祝", "你", "生日", "快乐"], "祝你生日快乐"),
        (["你", "生日", "快乐"], "祝你生日快乐"),
        (["生日", "快乐"], "生日快乐"),
        
        # 问候
        (["你", "好"], "你好"),
        (["早上", "好"], "早上好"),
        (["请", "安"], "请安"),
        
        # 常见句型
        (["我", "爱", "你"], "我爱你"),
        (["我", "喜欢", "你"], "我喜欢你"),
        (["我", "想", "你"], "我想你"),
        
        # 时间表达
        (["今天", "早上"], "今天早上"),
        (["明天", "早上"], "明天早上"),
        (["昨天", "早上"], "昨天早上"),
    ]
    
    # 需要过滤的词汇（在某些上下文中）
    FILTER_WORDS = {
        "的", "了", "着", "过", "吗", "呢", "啊", "呀", "哦", "嗯"
    }
    
    def __init__(self):
        self.pattern_cache = {}
        logger.info("句子优化器初始化完成")
    
    def optimize(self, gesture_sequence: List[str]) -> str:
        """
        优化手势序列为通顺句子
        
        Args:
            gesture_sequence: 手势词汇序列
            
        Returns:
            优化后的句子
        """
        if not gesture_sequence:
            return ""
        
        # 1. 词汇映射转换
        mapped_words = [self._map_vocabulary(word) for word in gesture_sequence]
        
        # 2. 去重（去除连续重复）
        deduped_words = self._remove_consecutive_duplicates(mapped_words)
        
        # 3. 过滤无意义词汇
        filtered_words = self._filter_words(deduped_words)
        
        # 4. 尝试匹配常见模式
        matched_sentence = self._match_patterns(filtered_words)
        if matched_sentence:
            return matched_sentence
        
        # 5. 语义优化和排序
        optimized_words = self._optimize_word_order(filtered_words)
        
        # 6. 组合成句子
        sentence = self._combine_to_sentence(optimized_words)
        
        return sentence
    
    def _map_vocabulary(self, word: str) -> str:
        """将手语词汇映射为自然语言词汇"""
        return self.VOCABULARY_MAP.get(word, word)
    
    def _remove_consecutive_duplicates(self, words: List[str]) -> List[str]:
        """去除连续重复的词汇"""
        if not words:
            return []
        
        result = [words[0]]
        for word in words[1:]:
            if word != result[-1]:
                result.append(word)
        return result
    
    def _filter_words(self, words: List[str]) -> List[str]:
        """过滤无意义的词汇"""
        # 简单过滤：如果词汇太多，过滤掉一些助词
        if len(words) > 5:
            return [w for w in words if w not in self.FILTER_WORDS]
        return words
    
    def _match_patterns(self, words: List[str]) -> Optional[str]:
        """尝试匹配常见模式"""
        # 将词汇列表转为字符串用于匹配
        words_str = " ".join(words)
        
        for pattern, sentence in self.COMMON_PATTERNS:
            # 检查是否包含模式中的所有词汇
            if all(word in words for word in pattern):
                # 检查词汇顺序是否大致正确
                indices = [words.index(word) for word in pattern if word in words]
                if indices == sorted(indices):
                    return sentence
        
        return None
    
    def _optimize_word_order(self, words: List[str]) -> List[str]:
        """优化词汇顺序"""
        if len(words) <= 2:
            return words
        
        # 简单的词序优化规则
        optimized = words.copy()
        
        # 规则1：时间词放在句首
        time_words = ["今天", "明天", "昨天", "早上", "时间", "时候"]
        for i, word in enumerate(optimized):
            if word in time_words and i > 0:
                # 将时间词移到句首
                optimized.insert(0, optimized.pop(i))
                break
        
        # 规则2：人称代词放在动词前
        pronouns = ["我", "你", "他", "她", "我们", "你们"]
        verbs = ["爱", "喜欢", "想", "祝", "请", "有", "是", "在", "去", "来", "吃", "喝", "看", "听", "说", "做"]
        
        for i, word in enumerate(optimized):
            if word in pronouns:
                # 找到后面的动词
                for j in range(i + 1, len(optimized)):
                    if optimized[j] in verbs:
                        # 确保人称代词在动词前
                        if i > j:
                            optimized.insert(j, optimized.pop(i))
                        break
        
        return optimized
    
    def _combine_to_sentence(self, words: List[str]) -> str:
        """将词汇组合成句子"""
        if not words:
            return ""
        
        # 简单组合
        sentence = "".join(words)
        
        # 添加标点符号
        if not sentence.endswith(("。", "！", "？", "，")):
            # 根据内容判断标点
            if any(word in sentence for word in ["吗", "呢", "什么", "哪里", "怎么"]):
                sentence += "？"
            elif any(word in sentence for word in ["祝", "快乐", "好", "爱", "喜欢"]):
                sentence += "！"
            else:
                sentence += "。"
        
        return sentence
    
    def get_suggestions(self, gesture_sequence: List[str]) -> List[str]:
        """
        获取多个可能的句子建议
        
        Args:
            gesture_sequence: 手势词汇序列
            
        Returns:
            可能的句子列表
        """
        suggestions = []
        
        # 原始序列
        original = "".join(gesture_sequence)
        suggestions.append(original)
        
        # 优化后的句子
        optimized = self.optimize(gesture_sequence)
        if optimized != original:
            suggestions.append(optimized)
        
        # 常见模式匹配
        mapped_words = [self._map_vocabulary(word) for word in gesture_sequence]
        for pattern, sentence in self.COMMON_PATTERNS:
            if all(word in mapped_words for word in pattern):
                if sentence not in suggestions:
                    suggestions.append(sentence)
        
        return suggestions[:5]  # 最多返回5个建议


if __name__ == '__main__':
    # 测试
    optimizer = SentenceOptimizer()
    
    test_sequences = [
        ["祝", "你/您/你的/这", "生日", "快乐/高兴"],
        ["你/您/你的/这", "好"],
        ["我", "爱", "你/您/你的/这"],
        ["早上", "好"],
        ["今天", "早上", "我", "吃", "饭"],
    ]
    
    print("句子优化器测试:")
    print("=" * 50)
    for seq in test_sequences:
        result = optimizer.optimize(seq)
        print(f"输入: {seq}")
        print(f"输出: {result}")
        print("-" * 50)
