-- 创建应用专用用户
CREATE USER IF NOT EXISTS 'sign_user'@'%' IDENTIFIED BY 'sign_password';
CREATE USER IF NOT EXISTS 'sign_user'@'localhost' IDENTIFIED BY 'sign_password';

-- 授予权限
GRANT ALL PRIVILEGES ON sign_language.* TO 'sign_user'@'%';
GRANT ALL PRIVILEGES ON sign_language.* TO 'sign_user'@'localhost';

-- 刷新权限
FLUSH PRIVILEGES;

-- 显示用户创建成功
SELECT 'User sign_user created successfully!' AS message;