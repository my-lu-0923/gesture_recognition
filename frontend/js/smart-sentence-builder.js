/**
 * 智能句子构建器 v2.0
 * 
 * 功能：
 * 1. 理解手势序列的语义
 * 2. 自动去重、选择最合适的词
 * 3. 连成通顺的中文句子
 * 4. 智能增删字，达到语义通顺和合理化
 * 5. 基于规则 + 上下文理解的混合方法
 */

class SmartSentenceBuilder {
    constructor() {
        // 同义词组映射 - 用于选择最合适的词
        this.synonymGroups = {
            '你/您/你的/这': {
                options: ['你', '您', '你的', '这'],
                default: '你',
                context: {
                    '名字': '你',      // 你叫什么名字
                    '好': '你',        // 你好
                    '请': '您',        // 请您
                    '爱': '你',        // 我爱你
                    '朋友': '你',      // 你是朋友
                }
            },
            '快乐/高兴': {
                options: ['快乐', '高兴'],
                default: '快乐',
                context: {
                    '祝': '快乐',      // 祝你快乐
                    '生日': '快乐',    // 生日快乐
                    '新': '快乐',      // 新年快乐
                }
            },
            '时间/时候': {
                options: ['时间', '时候'],
                default: '时候',
                context: {}
            },
            '结婚/妻子': {
                options: ['结婚', '妻子'],
                default: '结婚',
                context: {}
            }
        };

        // 常见句式模板（按优先级排序）
        this.sentencePatterns = [
            // 问候类
            {
                pattern: ['你/您/你的/这', '好'],
                template: '你好！',
                priority: 10,
                keywords: ['好']
            },
            {
                pattern: ['早上', '好'],
                template: '早上好！',
                priority: 10,
                keywords: ['早上', '好']
            },
            
            // 询问类
            {
                pattern: ['请', '你/您/你的/这', '什么', '名字'],
                template: '请问你叫什么名字？',
                priority: 10,
                keywords: ['名字', '什么']
            },
            {
                pattern: ['你/您/你的/这', '什么', '名字'],
                template: '你叫什么名字？',
                priority: 9,
                keywords: ['名字', '什么']
            },
            {
                pattern: ['请', '什么', '名字'],
                template: '请问什么名字？',
                priority: 8,
                keywords: ['名字', '什么']
            },
            
            // 祝福类
            {
                pattern: ['祝', '你/您/你的/这', '生日', '快乐/高兴'],
                template: '祝你生日快乐！',
                priority: 10,
                keywords: ['祝', '生日', '快乐']
            },
            {
                pattern: ['祝', '你/您/你的/这', '快乐/高兴'],
                template: '祝你快乐！',
                priority: 9,
                keywords: ['祝', '快乐']
            },
            {
                pattern: ['祝', '你/您/你的/这', '新', '快乐/高兴'],
                template: '祝你新年快乐！',
                priority: 10,
                keywords: ['祝', '新', '快乐']
            },
            {
                pattern: ['祝', '你/您/你的/这', '结婚/妻子', '快乐/高兴'],
                template: '祝你结婚快乐！',
                priority: 9,
                keywords: ['祝', '结婚', '快乐']
            },
            {
                pattern: ['祝', '你/您/你的/这', '平', '安'],
                template: '祝你平安！',
                priority: 9,
                keywords: ['祝', '平', '安']
            },
            
            // 自我介绍类
            {
                pattern: ['我', '名字'],
                template: '我的名字是...',
                priority: 7,
                keywords: ['我', '名字']
            },
            {
                pattern: ['我', '介绍'],
                template: '我介绍一下。',
                priority: 7,
                keywords: ['我', '介绍']
            },
            {
                pattern: ['我', '有', '名片'],
                template: '我有名片。',
                priority: 7,
                keywords: ['我', '名片']
            },
            {
                pattern: ['认识', '你/您/你的/这'],
                template: '认识你很高兴！',
                priority: 8,
                keywords: ['认识']
            },
            
            // 日常用语
            {
                pattern: ['谢谢'],
                template: '谢谢！',
                priority: 8,
                keywords: ['谢谢']
            },
            {
                pattern: ['请', '慢', '走'],
                template: '请慢走！',
                priority: 8,
                keywords: ['慢', '走']
            },
            {
                pattern: ['请', '停'],
                template: '请停！',
                priority: 6,
                keywords: ['停']
            },
            {
                pattern: ['我', '爱', '你/您/你的/这'],
                template: '我爱你！',
                priority: 9,
                keywords: ['爱']
            },
            {
                pattern: ['我', '爱', '花'],
                template: '我爱花。',
                priority: 6,
                keywords: ['爱', '花']
            },
            {
                pattern: ['我', '爱', '茶'],
                template: '我爱喝茶。',
                priority: 6,
                keywords: ['爱', '茶']
            },
            {
                pattern: ['我', '走'],
                template: '我走了。',
                priority: 6,
                keywords: ['走']
            },
            {
                pattern: ['我', '人'],
                template: '我是人。',
                priority: 4,
                keywords: ['人']
            },
            {
                pattern: ['今天', '早上'],
                template: '今天早上',
                priority: 5,
                keywords: ['今天', '早上']
            },
            {
                pattern: ['今天'],
                template: '今天',
                priority: 3,
                keywords: ['今天']
            },
            {
                pattern: ['我', '有'],
                template: '我有...',
                priority: 5,
                keywords: ['有']
            },
            {
                pattern: ['门', '停'],
                template: '门停了。',
                priority: 4,
                keywords: ['门', '停']
            },
            {
                pattern: ['路'],
                template: '路...',
                priority: 2,
                keywords: ['路']
            },
            {
                pattern: ['花'],
                template: '花...',
                priority: 2,
                keywords: ['花']
            },
            {
                pattern: ['茶'],
                template: '茶...',
                priority: 2,
                keywords: ['茶']
            },
            {
                pattern: ['朋友'],
                template: '朋友',
                priority: 3,
                keywords: ['朋友']
            },
            {
                pattern: ['名片'],
                template: '名片',
                priority: 3,
                keywords: ['名片']
            }
        ];

        // 需要去重的词
        this.duplicateWords = ['请', '你/您/你的/这', '快乐/高兴', '祝'];

        // 语气词（可以删除）
        this.fillerWords = ['请'];

        // 标点符号映射
        this.punctuationMap = {
            '问': '？',
            '名字': '？',
            '什么': '？',
            '祝': '！',
            '快乐': '！',
            '高兴': '！',
            '生日': '！',
            '新': '！',
            '谢谢': '！',
            '好': '！',
            '爱': '！',
            '介绍': '。',
            '走': '。',
            '停': '！',
            '慢': '。'
        };

        // 句子结束词
        this.sentenceEnders = ['名字', '什么', '祝', '快乐', '高兴', '生日', '新', '谢谢', '好', '爱', '介绍', '走', '停', '慢'];
    }

    /**
     * 构建智能句子
     * @param {string[]} gestures - 手势序列
     * @returns {string} 智能句子
     */
    build(gestures) {
        if (!gestures || gestures.length === 0) {
            return '等待识别手势...';
        }

        // 步骤1：清理和标准化手势序列
        let cleaned = this.cleanGestures(gestures);

        // 步骤2：尝试匹配句式模板
        let matched = this.matchPatterns(cleaned);
        if (matched) {
            return matched;
        }

        // 步骤3：智能拼接
        return this.smartJoin(cleaned);
    }

    /**
     * 清理手势序列
     */
    cleanGestures(gestures) {
        let result = [];
        let lastGesture = null;
        let consecutiveCount = 0;

        for (let gesture of gestures) {
            // 跳过重复的连续手势（只保留1次）
            if (gesture === lastGesture) {
                consecutiveCount++;
                if (consecutiveCount > 1) {
                    continue;
                }
            } else {
                consecutiveCount = 1;
            }

            // 标准化手势名称
            let normalized = this.normalizeGesture(gesture);
            result.push(normalized);
            lastGesture = gesture;
        }

        // 二次清理：移除相邻重复项
        result = this.removeAdjacentDuplicates(result);

        return result;
    }

    /**
     * 移除相邻重复项
     */
    removeAdjacentDuplicates(gestures) {
        if (gestures.length <= 1) return gestures;
        
        let result = [gestures[0]];
        for (let i = 1; i < gestures.length; i++) {
            if (gestures[i] !== gestures[i - 1]) {
                result.push(gestures[i]);
            }
        }
        return result;
    }

    /**
     * 标准化手势名称（从同义词组中选择最合适的词）
     */
    normalizeGesture(gesture) {
        // 检查是否在同义词组中
        for (let [group, config] of Object.entries(this.synonymGroups)) {
            if (gesture === group || group.includes(gesture)) {
                // 使用默认词
                return config.default;
            }
        }
        return gesture;
    }

    /**
     * 根据上下文选择最合适的词（增强版）
     */
    selectBestWord(gesture, context) {
        if (!this.synonymGroups[gesture]) {
            return gesture;
        }

        let config = this.synonymGroups[gesture];

        // 检查上下文
        if (context && config.context[context]) {
            return config.context[context];
        }

        return config.default;
    }

    /**
     * 匹配句式模板
     */
    matchPatterns(gestures) {
        // 按优先级排序
        let sortedPatterns = [...this.sentencePatterns].sort((a, b) => b.priority - a.priority);

        for (let pattern of sortedPatterns) {
            if (this.matchPattern(gestures, pattern)) {
                return pattern.template;
            }
        }

        return null;
    }

    /**
     * 检查手势序列是否匹配模板
     */
    matchPattern(gestures, pattern) {
        // 检查所有关键词是否都在手势序列中
        let gestureSet = new Set(gestures);
        let matchCount = 0;

        for (let keyword of pattern.keywords) {
            // 检查是否在同义词组中
            if (this.synonymGroups[keyword]) {
                // 检查是否有同义词组中的任何词
                let hasSynonym = this.synonymGroups[keyword].options.some(opt => gestureSet.has(opt));
                if (hasSynonym) matchCount++;
            } else if (gestureSet.has(keyword)) {
                matchCount++;
            }
        }

        // 如果所有关键词都匹配，认为匹配成功
        return matchCount === pattern.keywords.length;
    }

    /**
     * 智能拼接手势序列
     */
    smartJoin(gestures) {
        if (gestures.length === 0) return '';

        // 优化：先尝试按语义分组
        let groups = this.groupBySemantics(gestures);
        
        let result = [];
        let sentenceCount = 0;

        for (let group of groups) {
            if (group.length === 0) continue;

            // 处理每个语义组
            let sentence = this.buildSentenceFromGroup(group);
            if (sentence) {
                result.push(sentence);
                sentenceCount++;
            }
        }

        // 如果没有生成任何句子，使用简单拼接
        if (result.length === 0) {
            return gestures.join('，') + '。';
        }

        return result.join('');
    }

    /**
     * 按语义分组手势
     */
    groupBySemantics(gestures) {
        let groups = [];
        let currentGroup = [];

        // 句子结束词
        const enders = ['名字', '什么', '谢谢', '好', '爱', '介绍', '走', '停'];
        // 句子开始词
        const starters = ['请', '你', '您', '我', '祝', '今天', '早上'];

        for (let i = 0; i < gestures.length; i++) {
            let gesture = gestures[i];
            currentGroup.push(gesture);

            // 检查是否应该结束当前组
            if (enders.includes(gesture)) {
                groups.push([...currentGroup]);
                currentGroup = [];
            }
            // 如果下一个词是开始词，也结束当前组
            else if (i < gestures.length - 1 && starters.includes(gestures[i + 1])) {
                groups.push([...currentGroup]);
                currentGroup = [];
            }
        }

        // 添加剩余的组
        if (currentGroup.length > 0) {
            groups.push(currentGroup);
        }

        return groups;
    }

    /**
     * 从语义组构建句子
     */
    buildSentenceFromGroup(group) {
        if (group.length === 0) return '';

        // 尝试匹配模板
        for (let pattern of this.sentencePatterns.sort((a, b) => b.priority - a.priority)) {
            if (this.matchPattern(group, pattern)) {
                return pattern.template;
            }
        }

        // 没有匹配到模板，智能拼接
        let result = [];
        for (let i = 0; i < group.length; i++) {
            let gesture = group[i];
            let nextGesture = group[i + 1];

            // 处理"请"字
            if (gesture === '请') {
                if (i === 0 || result.length === 0) {
                    result.push(gesture);
                } else {
                    continue;
                }
                continue;
            }

            result.push(gesture);

            // 添加标点
            let punctuation = this.getPunctuation(gesture, nextGesture);
            if (punctuation) {
                result.push(punctuation);
            }
        }

        // 确保句子有结束标点
        if (result.length > 0 && !this.isPunctuation(result[result.length - 1])) {
            result.push('。');
        }

        return result.join('');
    }

    /**
     * 获取标点符号
     */
    getPunctuation(current, next) {
        // 如果是疑问词，添加问号
        if (['什么', '名字', '问'].includes(current)) {
            return '？';
        }

        // 如果是祝福词，添加感叹号
        if (['祝', '快乐', '高兴', '生日', '新'].includes(current)) {
            return '！';
        }

        // 如果是感谢词，添加感叹号
        if (['谢谢'].includes(current)) {
            return '！';
        }

        // 如果是问候词，添加感叹号
        if (['好', '爱'].includes(current)) {
            return '！';
        }

        // 如果是陈述词，添加句号
        if (['介绍', '走', '停', '慢', '有', '认识'].includes(current)) {
            return '。';
        }

        // 默认不加标点（让下一个手势决定）
        return '';
    }

    /**
     * 检查是否是标点符号
     */
    isPunctuation(char) {
        return ['。', '！', '？', '，', '、', '；', '：'].includes(char);
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SmartSentenceBuilder;
}
