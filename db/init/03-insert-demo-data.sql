USE sign_language;

-- 插入演示用户（密码使用明文，与注册逻辑一致）
INSERT INTO users (username, password, email, avatar, role, status) VALUES
                                                                        ('admin', '123456', 'admin@example.com', '👨‍', 'ADMIN', 1),
                                                                        ('demo_user', '123456', 'demo@example.com', '👤', 'USER', 1),
                                                                        ('张三', '123456', 'zhangsan@example.com', '👨', 'USER', 1),
                                                                        ('李四', '123456', 'lisi@example.com', '👩', 'USER', 1);

-- 插入手势库数据
INSERT INTO gesture_library (gesture_name, gesture_description, category, difficulty) VALUES
                                                                                          ('你好', '手掌向前，轻轻摆动', '问候', 1),
                                                                                          ('谢谢', '手掌从下巴向前推出', '礼貌', 1),
                                                                                          ('对不起', '右手握拳，在胸前画圈', '礼貌', 2),
                                                                                          ('朋友', '双手食指相碰，然后分开', '社交', 2),
                                                                                          ('爱', '双手交叉放在胸前', '情感', 2),
                                                                                          ('学习', '手掌在额头前做写字的动作', '日常', 2),
                                                                                          ('工作', '双手握拳，在胸前做敲击动作', '日常', 2),
                                                                                          ('电脑', '双手模拟打字动作', '日常', 2),
                                                                                          ('手机', '右手模拟接电话动作', '日常', 1),
                                                                                          ('早上', '右手从下往上划过天空', '时间', 2),
                                                                                          ('晚上', '右手从上往下划过天空', '时间', 2),
                                                                                          ('生日', '双手在头顶做生日帽动作', '庆祝', 2),
                                                                                          ('快乐', '双手在胸前画圈并微笑', '情感', 1),
                                                                                          ('帮助', '右手伸出，左手扶住右手', '礼貌', 2),
                                                                                          ('请', '手掌向上，向前伸出', '礼貌', 1);

-- 插入演示识别历史
INSERT INTO recognition_history (user_id, username, gesture, confidence, ai_reply, session_id, created_at) VALUES
                                                                                                               (2, 'demo_user', '你好', 0.95, '你好！欢迎使用手语系统', 'session_demo_1', DATE_SUB(NOW(), INTERVAL 2 DAY)),
                                                                                                               (2, 'demo_user', '谢谢', 0.98, '不客气，很高兴为您服务', 'session_demo_1', DATE_SUB(NOW(), INTERVAL 1 DAY)),
                                                                                                               (2, 'demo_user', '朋友', 0.92, '朋友是我们生活中重要的伙伴', 'session_demo_2', NOW()),
                                                                                                               (2, 'demo_user', '爱', 0.89, '爱是一种美好的情感', 'session_demo_2', DATE_SUB(NOW(), INTERVAL 3 HOUR)),
                                                                                                               (2, 'demo_user', '学习', 0.94, '学习让我们不断进步', 'session_demo_3', DATE_SUB(NOW(), INTERVAL 1 HOUR)),
                                                                                                               (3, '张三', '你好', 0.96, '你好！今天过得怎么样？', 'session_zhang', DATE_SUB(NOW(), INTERVAL 5 HOUR)),
                                                                                                               (3, '张三', '工作', 0.91, '工作辛苦了，注意休息', 'session_zhang', DATE_SUB(NOW(), INTERVAL 4 HOUR)),
                                                                                                               (4, '李四', '生日', 0.93, '生日快乐！祝您天天开心', 'session_li', DATE_SUB(NOW(), INTERVAL 2 HOUR));

-- 插入学习统计数据
INSERT INTO learning_stats (user_id, gesture_id, study_count, last_study, mastery_level) VALUES
                                                                                             (2, 1, 15, NOW(), 3),
                                                                                             (2, 2, 12, NOW(), 3),
                                                                                             (2, 3, 8, NOW(), 2),
                                                                                             (2, 4, 5, NOW(), 2),
                                                                                             (3, 1, 10, NOW(), 2),
                                                                                             (3, 2, 7, NOW(), 2),
                                                                                             (4, 11, 3, NOW(), 1);

-- 插入对话历史
INSERT INTO chat_history (user_id, session_id, message, is_user, created_at) VALUES
                                                                                 (2, 'chat_001', '你好', TRUE, DATE_SUB(NOW(), INTERVAL 30 MINUTE)),
                                                                                 (2, 'chat_001', '你好！我是手语助手，有什么可以帮您？', FALSE, DATE_SUB(NOW(), INTERVAL 30 MINUTE)),
                                                                                 (2, 'chat_001', '谢谢', TRUE, DATE_SUB(NOW(), INTERVAL 25 MINUTE)),
                                                                                 (2, 'chat_001', '不客气，很高兴为您服务', FALSE, DATE_SUB(NOW(), INTERVAL 25 MINUTE));

-- 显示插入成功
SELECT 'Demo data inserted successfully!' AS message;
SELECT COUNT(*) as total_users FROM users;
SELECT COUNT(*) as total_histories FROM recognition_history;