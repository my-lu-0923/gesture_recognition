# DeepSeek API 配置说明

## 1. 获取 DeepSeek API Key

1. 访问 DeepSeek 官网：https://platform.deepseek.com/
2. 注册/登录账号
3. 进入控制台，创建 API Key
4. 复制 API Key（格式：`sk-xxxxxxxxxxxxxxxxxxxxxxxx`）

## 2. 配置 API Key

### 方式一：使用 .env 文件（推荐）

在 `python_service` 目录下创建 `.env` 文件：

```bash
cd python_service
touch .env
```

编辑 `.env` 文件，添加以下内容：

```env
DEEPSEEK_API_KEY=sk-your-actual-api-key-here
```

### 方式二：环境变量

```bash
export DEEPSEEK_API_KEY=sk-your-actual-api-key-here
```

## 3. 重启 Python 服务

```bash
cd python_service
python app.py
```

启动后，查看控制台输出：
- ✅ `DeepSeek 翻译器初始化成功` - 表示配置成功
- ⚠️ `未找到 DEEPSEEK_API_KEY` - 表示未配置，将使用备用方案

## 4. 功能说明

### DeepSeek 翻译器功能

1. **智能手语翻译**
   - 将手语词汇序列翻译成通顺的中文句子
   - 自动调整语序，符合中文语法
   - 智能添加标点符号
   - 删除重复词汇

2. **AI 对话**
   - 回答手语相关问题
   - 提供手语学习建议
   - 解释手语词汇含义
   - 支持多轮对话

### 降级策略

系统采用三级降级策略：
1. **DeepSeek**（优先级最高）- 使用 DeepSeek API
2. **Local LLM** - 使用本地 Ollama 模型
3. **Rule Translator** - 使用规则翻译（备用）

## 5. API 定价

DeepSeek API 提供免费额度，个人使用基本够用。
具体定价请查看官网：https://platform.deepseek.com/pricing

## 6. 测试

配置完成后，可以测试：

1. **测试翻译功能**
   - 在实时翻译页面做手语手势
   - 查看翻译结果是否通顺

2. **测试对话功能**
   - 进入 AI 助手页面
   - 提问："手语的发展历史是什么？"
   - 查看回答是否智能

## 7. 常见问题

### Q: 如何验证是否成功调用 DeepSeek？

A: 查看 Python 服务控制台输出：
- ✅ `DeepSeek 翻译成功：...` - 表示翻译成功
- ✅ `DeepSeek 对话成功：...` - 表示对话成功
- ⚠️ `DeepSeek API 调用失败` - 表示 API Key 无效或网络问题

### Q: API Key 无效怎么办？

A: 检查：
1. API Key 是否正确复制
2. 是否有多余的空格
3. .env 文件是否在正确的位置
4. Python 服务是否重启

### Q: 网络问题无法访问 DeepSeek API？

A: 系统会自动降级到 Local LLM 或规则翻译，不影响基本功能。
