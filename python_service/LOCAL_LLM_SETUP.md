# 本地 LLM 翻译器配置指南

## 🎯 问题诊断

你的 Qwen API Key 无效（AccessDenied），所以系统自动降级到规则翻译器。

## ✅ 解决方案：使用本地 LLM（免费、快速）

### 方案 1：安装 Ollama（推荐）⭐

#### 1. 安装 Ollama

**macOS:**
```bash
brew install ollama
```

**或者下载安装:**
访问 https://ollama.ai 下载对应系统版本

#### 2. 启动 Ollama

```bash
ollama serve
```

#### 3. 下载模型（选择一个）

**推荐模型（快速）：**
```bash
ollama pull qwen2.5:0.5b
```

**备选模型（更智能但稍慢）：**
```bash
ollama pull qwen2.5:1.5b
ollama pull qwen2:0.5b
```

#### 4. 测试模型

```bash
ollama run qwen2.5:0.5b "你好"
```

#### 5. 重启 Python 服务

```bash
cd /Users/luuuuu/Desktop/gesture_recognition/python_service
python3 app.py
```

看到输出：
```
✅ Ollama 已连接，使用模型：qwen2.5:0.5b
本地 LLM: ✅ 已加载
```

### 方案 2：修复 Qwen API

1. 访问：https://dashscope.console.aliyun.com/apiKey
2. 登录/注册阿里云账号
3. 开通 DashScope 服务
4. 创建或激活 API Key
5. 确保有免费额度或充值
6. 替换 `.env` 文件中的 API Key

### 优先级说明

系统现在会按以下顺序使用翻译器：

1. **本地 LLM** (Ollama) - ⭐ 最快、免费
2. **Qwen API** - 如果本地 LLM 不可用
3. **规则翻译** - 降级方案

## 🚀 性能对比

| 方案 | 速度 | 费用 | 智能度 | 推荐度 |
|------|------|------|--------|--------|
| 本地 LLM (0.5B) | ⚡⚡⚡ 快 | 免费 | ⭐⭐⭐ 好 | ⭐⭐⭐⭐⭐ |
| 本地 LLM (1.5B) | ⚡⚡ 中 | 免费 | ⭐⭐⭐⭐ 很好 | ⭐⭐⭐⭐ |
| Qwen API | ⚡ 很快 | 付费 | ⭐⭐⭐⭐⭐ 优秀 | ⭐⭐⭐ |
| 规则翻译 | ⚡⚡⚡ 最快 | 免费 | ⭐⭐ 一般 | ⭐⭐ |

## 📊 优化效果

### 延迟优化（已完成）

- ✅ 图像分辨率：降低 50% (320x240)
- ✅ JPEG 质量：降低到 60%
- ✅ 识别间隔：从 200ms → 100ms
- ✅ 发送频率：每 3 帧（约 100ms）
- ✅ 稳定触发：从 3 次 → 2 次

**预期延迟**: 从 300-400ms → **150-200ms** ⬇️ 50%

### 翻译优化（已完成）

- ✅ 新增 50+ 词汇的固定翻译
- ✅ 新增 60+ 句子模板
- ✅ 自动显示翻译到对话框
- ✅ 支持 LLM 智能翻译（如果启用）

## 🔧 快速测试

安装 Ollama 后，运行：

```bash
# 测试 Ollama
ollama run qwen2.5:0.5b "将手语'我 想 吃饭'翻译成中文"

# 测试 Python 服务
cd /Users/luuuuu/Desktop/gesture_recognition/python_service
python3 -c "
from translators.local_llm_translator import LocalLLMTranslator
t = LocalLLMTranslator()
print(t.translate(['我', '想', '吃饭']))
"
```

## 💡 建议

1. **首选本地 LLM** - 免费、快速、隐私
2. **模型选择** - `qwen2.5:0.5b` 速度和质量的平衡
3. **如果卡顿** - 检查 Ollama 是否正常运行
4. **查看日志** - Python 服务启动时会显示使用的翻译器

## ❓ 常见问题

**Q: Ollama 启动失败？**
A: 确保端口 11434 未被占用，检查防火墙设置

**Q: 模型下载慢？**
A: 使用国内镜像或等待下载完成

**Q: 翻译还是规则翻译？**
A: 查看 Python 服务日志，确认本地 LLM 是否加载成功
