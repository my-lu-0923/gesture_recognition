USE sign_language;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
                                     id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '用户ID',
                                     username VARCHAR(50) UNIQUE NOT NULL COMMENT '用户名',
    password VARCHAR(255) NOT NULL COMMENT '密码（加密）',
    email VARCHAR(100) COMMENT '邮箱',
    avatar VARCHAR(255) COMMENT '头像URL',
    role VARCHAR(20) DEFAULT 'USER' COMMENT '角色：USER/ADMIN',
    status TINYINT DEFAULT 1 COMMENT '状态：0-禁用，1-启用',
    last_login DATETIME COMMENT '最后登录时间',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 识别历史表
CREATE TABLE IF NOT EXISTS recognition_history (
                                                   id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '记录ID',
                                                   user_id BIGINT NOT NULL COMMENT '用户ID',
                                                   username VARCHAR(50) NOT NULL COMMENT '用户名（冗余字段，便于查询）',
    gesture VARCHAR(100) NOT NULL COMMENT '识别的手势',
    confidence DOUBLE NOT NULL COMMENT '置信度',
    confidence_percent VARCHAR(10) GENERATED ALWAYS AS (CONCAT(ROUND(confidence * 100, 1), '%')) STORED COMMENT '置信度百分比',
    ai_reply VARCHAR(1000) COMMENT 'AI回复内容',
    image_data TEXT COMMENT '手势图片（Base64）',
    session_id VARCHAR(100) COMMENT '会话ID',
    processing_time BIGINT COMMENT '处理耗时（毫秒）',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

    INDEX idx_user_id (user_id),
    INDEX idx_username (username),
    INDEX idx_gesture (gesture),
    INDEX idx_created_at (created_at),
    INDEX idx_session_id (session_id),
    INDEX idx_user_created (user_id, created_at),

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='识别历史表';

-- 手势库表
CREATE TABLE IF NOT EXISTS gesture_library (
                                               id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '手势ID',
                                               gesture_name VARCHAR(100) NOT NULL UNIQUE COMMENT '手势名称',
    gesture_description TEXT COMMENT '手势描述',
    image_url VARCHAR(500) COMMENT '手势示例图片URL',
    video_url VARCHAR(500) COMMENT '手势教学视频URL',
    category VARCHAR(50) COMMENT '分类：日常/问候/情感等',
    difficulty TINYINT DEFAULT 1 COMMENT '难度：1-简单，2-中等，3-困难',
    usage_count BIGINT DEFAULT 0 COMMENT '使用次数',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_category (category),
    INDEX idx_difficulty (difficulty),
    INDEX idx_usage (usage_count)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='手势库表';

-- 学习统计表
CREATE TABLE IF NOT EXISTS learning_stats (
                                              id BIGINT PRIMARY KEY AUTO_INCREMENT,
                                              user_id BIGINT NOT NULL,
                                              gesture_id BIGINT NOT NULL,
                                              study_count INT DEFAULT 0 COMMENT '学习次数',
                                              last_study DATETIME COMMENT '最后学习时间',
                                              mastery_level TINYINT DEFAULT 0 COMMENT '掌握程度：0-未学习，1-认识，2-熟悉，3-精通',

                                              INDEX idx_user_gesture (user_id, gesture_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (gesture_id) REFERENCES gesture_library(id) ON DELETE CASCADE,

    UNIQUE KEY uk_user_gesture (user_id, gesture_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='学习统计表';

-- 对话历史表
CREATE TABLE IF NOT EXISTS chat_history (
                                            id BIGINT PRIMARY KEY AUTO_INCREMENT,
                                            user_id BIGINT NOT NULL,
                                            session_id VARCHAR(100) NOT NULL,
    message TEXT NOT NULL COMMENT '消息内容',
    is_user BOOLEAN DEFAULT TRUE COMMENT '是否用户消息',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_user_session (user_id, session_id),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='对话历史表';

-- 显示表创建成功
SELECT 'All tables created successfully!' AS message;