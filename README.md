# 🤟 基于多模态感知与大语言模型的手语交互系统

[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/)
[![Java](https://img.shields.io/badge/Java-11+-orange.svg)](https://openjdk.org/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-2.7.5-brightgreen.svg)](https://spring.io/projects/spring-boot)
[![YOLOv8](https://img.shields.io/badge/YOLO-v8-purple.svg)](https://github.com/ultralytics/ultralytics)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> 一款基于 **YOLOv8 + LSTM + 大语言模型(LLM)** 的智能手语识别与交互系统，支持实时手势识别、智能翻译、学习统计等功能，致力于打破听障人士与健听人群之间的沟通壁垒。

---

## ✨ 核心功能

| 功能模块 | 说明 |
|---------|------|
| 🤖 **AI 实时识别** | 基于 YOLOv8 的实时手语识别，支持 35 种常用手势，准确率 98%+ |
| 💬 **智能翻译** | 集成大语言模型（云端模型/ 本地 Ollama），将手语词汇序列翻译为通顺的中文句子 |
| 🎤 **手语演示生成** | 输入文字，系统生成对应的手语动作指导 |
| 📷 **图片/视频识别** | 支持上传图片或视频进行离线手语识别 |
| 📊 **学习统计** | 记录用户学习进度，生成个性化统计报告 |
| 📚 **手势库** | 完整的手势词典，支持搜索与浏览 |
| 👤 **用户系统** | 注册/登录、个人中心、识别历史管理 |

---

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                        前端层 (Frontend)                      │
│              HTML5 + CSS3 + JavaScript (原生)                 │
│                   端口: 3000 (静态服务器)                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        后端层 (Backend)                       │
│              Spring Boot 2.7.5 + Spring Data JPA              │
│                   端口: 8080                                 │
│     RESTful API + 用户管理 + 历史记录 + 数据库交互             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      AI 服务层 (Python Service)                │
│              Flask + SocketIO + YOLOv8 + MediaPipe            │
│                   端口: 5001                                 │
│     实时识别 + LLM 翻译 + 手势检测 + 语义理解                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      数据层 (Database)                        │
│                    MySQL 8.0 + Docker (可选)                  │
│                   端口: 3306                                 │
└─────────────────────────────────────────────────────────────┘
```

### 技术栈

- **计算机视觉**: [YOLOv8](https://github.com/ultralytics/ultralytics) (Ultralytics) 
- **深度学习框架**: PyTorch 2.0+
- **后端框架**: Spring Boot 2.7.5 (Java 11)
- **前端**: 原生 HTML5 / CSS3 / JavaScript
- **数据库**: MySQL 8.0
- **大语言模型**: DeepSeek / Qwen / Ollama 本地模型 (兼容 OpenAI SDK)
- **部署**: Docker & Docker Compose (可选)

---

## 🚀 快速开始

### 环境要求

| 组件 | 版本要求 |
|------|---------|
| Python | 3.8+ |
| JDK | 11+ |
| Maven | 3.6+ |
| MySQL | 8.0 |
| Node.js | (可选，仅前端开发) |

### 1. 克隆项目

```bash
git clone https://github.com/yourusername/gesture_recognition.git
cd gesture_recognition
```

### 2. 数据库配置

#### 方式一：Docker 部署（推荐）

```bash
cd db
docker-compose up -d
```

- MySQL: `localhost:3306`
- phpMyAdmin: `localhost:8081`

#### 方式二：本地 MySQL

手动执行 `db/init/` 目录下的 SQL 脚本（按序号顺序）：

```bash
mysql -u root -p < db/init/01-create-database.sql
mysql -u root -p < db/init/02-create-tables.sql
mysql -u root -p < db/init/03-insert-demo-data.sql
mysql -u root -p < db/init/04-create-user.sql
```

### 3. 启动 Python AI 服务

```bash
cd python_service

# 创建虚拟环境（推荐）
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
# venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt

# 配置 API Key（可选，用于 LLM 翻译）
cp .env.example .env
# 编辑 .env 文件，填入你的 API Key

# 启动服务
python3 app.py
```

服务将在 `http://localhost:5001` 启动。

### 4. 启动 Java 后端服务

```bash
cd backend

# 编译并运行
mvn spring-boot:run
```

服务将在 `http://localhost:8080` 启动。

### 5. 启动前端页面

```bash
cd frontend

# 使用 Python 临时静态服务器
python3 -m http.server 3000
```

打开浏览器访问: `http://localhost:3000`

---

## 📁 项目结构

```
gesture_recognition/
├── backend/                    # Java 后端服务 (Spring Boot)
│   ├── src/main/java/com/sign/ # 源代码
│   │   ├── config/             # 跨域等配置
│   │   ├── controller/         # REST API 控制器
│   │   ├── dto/                # 数据传输对象
│   │   ├── model/              # 实体类
│   │   ├── repository/         # 数据访问层
│   │   └── service/            # 业务逻辑层
│   ├── src/main/resources/     # 静态资源与模板
│   └── pom.xml                 # Maven 配置
│
├── frontend/                   # 前端页面 (HTML/CSS/JS)
│   ├── css/                    # 样式文件
│   ├── js/                     # 脚本文件
│   ├── *.html                  # 页面文件
│   └── about.html              # 关于页面
│
├── python_service/             # Python AI 核心服务
│   ├── app.py                  # Flask 主应用入口
│   ├── lstm_models/            # LSTM 序列识别模型
│   ├── models/                 # YOLO 模型文件
│   ├── translators/            # LLM 翻译器 (DeepSeek/Qwen/Ollama)
│   ├── utils/                  # 工具函数
│   ├── requirements.txt        # Python 依赖
│   └── .env.example            # 环境变量模板
│
├── db/                         # 数据库相关
│   ├── init/                   # 初始化 SQL 脚本
│   ├── scripts/                # 备份/恢复脚本
│   └── docker-compose.yml      # Docker 部署配置
│
├── tools/                      # 辅助工具脚本
│   ├── extract_keypoints.py    # 关键点提取
│   └── convert_videos_to_webm.py # 视频格式转换
│
├── train_context_lstm.py       # LSTM 模型训练脚本
├── generate_test_visualizations.py # 可视化生成
└── README.md                   # 本文件
```

---

## 🤖 大语言模型配置

系统支持多种 LLM 翻译引擎，可自由切换：


### 1. DeepSeek API

```bash
# 在 python_service/.env 中配置
DEEPSEEK_API_KEY=sk-your-deepseek-api-key
```

### 2. 本地 Ollama（免费，无需联网）

```bash
# 安装 Ollama
brew install ollama  # macOS

# 启动服务
ollama serve

# 下载模型
ollama pull qwen2.5:0.5b

# 在 python_service/.env 中配置
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen2.5:0.5b
```

> 详细配置请参考：
> - [DeepSeek 配置指南](python_service/DEEPSEEK_CONFIG.md)
> - [本地 LLM 配置指南](python_service/LOCAL_LLM_SETUP.md)

---

## 📊 支持的 35 种手势

| 编号 | 手势 | 编号 | 手势 | 编号 | 手势 |
|:----:|:----:|:----:|:----:|:----:|:----:|
| 1 | 时间/时候 | 13 | 安 | 25 | 慢 |
| 2 | 你/您/你的/这 | 14 | 朋友 | 26 | 走 |
| 3 | 早上 | 15 | 8 | 27 | 晚 |
| 4 | 9 | 16 | 认识 | 28 | 我 |
| 5 | 0 | 17 | 名片 | 29 | 爱 |
| 6 | 快乐/高兴 | 18 | 结婚/妻子 | 30 | 好 |
| 7 | 新 | 19 | 茶 | 31 | 人 |
| 8 | 祝 | 20 | 有 | 32 | 什么 |
| 9 | 请 | 21 | 花 | 33 | 名字 |
| 10 | 路 | 22 | 今天 | 34 | 介绍 |
| 11 | 生日 | 23 | 门 | 35 | (预留) |
| 12 | 平 | 24 | 停 | | |

---

## 🛠️ 开发指南

### 训练自定义模型

```bash
# 使用 YOLOv8 训练手势检测模型
python train_context_lstm.py --data_dir ./data --epochs 100

# 数据预处理
python extract_keypoints.py --input ./videos --output ./keypoints
```

### 添加新手势

1. 在 `python_service/config/` 下更新类别映射文件
2. 收集并标注新手势数据
3. 重新训练 YOLO 模型
4. 更新前端手势库 (`frontend/gesture-library.html`)

---

## 🐳 Docker 部署

```bash
# 一键启动数据库
cd db && docker-compose up -d

# 停止服务
docker-compose down

# 查看日志
docker-compose logs -f mysql
```

---

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源协议。

---

## 🙏 致谢

- [Ultralytics YOLOv8](https://github.com/ultralytics/ultralytics) - 目标检测框架
- [MediaPipe](https://mediapipe.dev/) - 手部关键点检测
- [Spring Boot](https://spring.io/projects/spring-boot) - Java 后端框架
- [DeepSeek](https://deepseek.com/) / [Qwen](https://qwenlm.github.io/) - 大语言模型支持

---
>
> 🏫 **所属院校**: 浙江财经大学
>
> ⭐ 如果这个项目对你有帮助，请给它一个 Star！
