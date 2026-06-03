-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS sign_language
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE sign_language;

-- 显示创建成功信息
SELECT 'Database sign_language created successfully!' AS message;