package com.sign.service;

import com.sign.dto.HistoryDTO;
import com.sign.dto.StatisticsDTO;
import com.sign.model.RecognitionHistory;
import com.sign.repository.HistoryRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class HistoryService {

    @Autowired
    private HistoryRepository historyRepository;

    @Autowired(required = false)
    private JdbcTemplate jdbcTemplate;

    // 保存识别记录
    @Transactional
    public RecognitionHistory saveHistory(String username, String gesture, Double confidence,
                                          String sessionId, String aiReply) {
        RecognitionHistory history = new RecognitionHistory();
        history.setUsername(username);
        history.setUserId(resolveUserId(username));
        history.setGesture(gesture);
        history.setConfidence(confidence != null ? confidence : 0.85);
        history.setSessionId(sessionId);
        history.setAiReply(aiReply);
        history.setCreatedAt(LocalDateTime.now());

        return historyRepository.save(history);
    }

    private Long resolveUserId(String username) {
        if (jdbcTemplate != null) {
            try {
                List<Long> ids = jdbcTemplate.query(
                        "SELECT id FROM users WHERE username = ? LIMIT 1",
                        (rs, rowNum) -> rs.getLong("id"),
                        username
                );
                if (!ids.isEmpty()) {
                    return ids.get(0);
                }
            } catch (Exception ignored) {
            }
        }
        if ("admin".equalsIgnoreCase(username)) return 1L;
        return 2L;
    }

    // 获取用户历史记录（分页）
    public Page<HistoryDTO> getUserHistory(String username, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<RecognitionHistory> historyPage = historyRepository.findByUsernameOrderByCreatedAtDesc(username, pageable);

        return historyPage.map(history -> new HistoryDTO(
                history.getId(),
                history.getGesture(),
                history.getConfidence(),
                history.getAiReply(),
                history.getCreatedAt()
        ));
    }

    // 获取用户统计信息
    public StatisticsDTO getUserStatistics(String username) {
        StatisticsDTO stats = new StatisticsDTO();

        long totalCount = historyRepository.countByUsername(username);
        long todayCount = historyRepository.countTodayByUsername(username);
        long weekCount = historyRepository.countThisWeekByUsername(username);
        long monthCount = historyRepository.countThisMonthByUsername(username);

        List<Object[]> gestureStatsList = historyRepository.countByGesture(username);
        Map<String, Long> gestureStats = new HashMap<>();

        for (Object[] stat : gestureStatsList) {
            gestureStats.put((String) stat[0], (Long) stat[1]);
        }

        // 找出最常用的手势
        String topGesture = gestureStats.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse("无");

        stats.setTotalCount(totalCount);
        stats.setTodayCount(todayCount);
        stats.setWeekCount(weekCount);
        stats.setMonthCount(monthCount);
        stats.setGestureStats(gestureStats);
        stats.setTopGesture(topGesture);

        return stats;
    }

    // 清空用户历史
    @Transactional
    public void clearUserHistory(String username) {
        historyRepository.deleteByUsername(username);
    }

    // 删除单条记录
    @Transactional
    public boolean deleteHistory(Long id, String username) {
        Optional<RecognitionHistory> history = historyRepository.findById(id);
        if (history.isPresent() && history.get().getUsername().equals(username)) {
            historyRepository.deleteById(id);
            return true;
        }
        return false;
    }

    // 获取最近N条记录
    public List<HistoryDTO> getRecentHistory(String username, int limit) {
        List<RecognitionHistory> histories = historyRepository.findTop10ByUsernameOrderByCreatedAtDesc(username);
        return histories.stream()
                .limit(limit)
                .map(history -> new HistoryDTO(
                        history.getId(),
                        history.getGesture(),
                        history.getConfidence(),
                        history.getAiReply(),
                        history.getCreatedAt()
                ))
                .collect(Collectors.toList());
    }

    // 获取用户邮箱
    public String getUserEmail(String username) {
        System.out.println("=== 开始获取用户邮箱 ===");
        System.out.println("用户名：" + username);
        System.out.println("JdbcTemplate: " + (jdbcTemplate != null ? "可用" : "不可用"));
        
        if (jdbcTemplate != null) {
            try {
                String sql = "SELECT email FROM users WHERE username = ? LIMIT 1";
                System.out.println("执行 SQL: " + sql);
                System.out.println("参数：" + username);
                
                String email = jdbcTemplate.queryForObject(
                        sql,
                        String.class,
                        username
                );
                
                System.out.println("查询结果：" + email);
                
                if (email == null) {
                    System.out.println("警告：查询返回 null，返回用户名作为后备");
                    return username;
                }
                
                System.out.println("成功获取邮箱：" + email);
                return email;
            } catch (Exception e) {
                System.err.println("获取用户邮箱失败：" + e.getMessage());
                System.err.println("异常类型：" + e.getClass().getName());
                e.printStackTrace();
            }
        } else {
            System.err.println("JdbcTemplate 为 null，无法查询数据库");
        }
        // 默认返回用户名作为后备
        System.out.println("返回默认值：" + username);
        return username;
    }
    
    // 清理旧数据（保留最近 30 天）
    @Transactional
    public int cleanOldRecords(String username, int daysToKeep) {
        LocalDateTime cutoffDate = LocalDateTime.now().minusDays(daysToKeep);
        long count = historyRepository.countByUsername(username);
        historyRepository.deleteOldRecords(username, cutoffDate);
        return (int) (count - historyRepository.countByUsername(username));
    }

    public List<Map<String, Object>> getGestureLibrary(String username) {
        if (jdbcTemplate == null) return getGestureLibraryFallback(username);
        try {
            return jdbcTemplate.query(
                    "SELECT g.id, g.gesture_name, g.gesture_description, g.category, g.difficulty, " +
                            "COALESCE(g.usage_count, 0) AS usage_count, " +
                            "COALESCE(ls.mastery_level, 0) AS mastery_level, " +
                            "COALESCE(ls.study_count, 0) AS study_count " +
                            "FROM gesture_library g " +
                            "LEFT JOIN users u ON u.username = ? " +
                            "LEFT JOIN learning_stats ls ON ls.user_id = u.id AND ls.gesture_id = g.id " +
                            "ORDER BY g.gesture_name",
                    (rs, rowNum) -> {
                        Map<String, Object> row = new HashMap<>();
                        row.put("id", rs.getLong("id"));
                        row.put("gestureName", rs.getString("gesture_name"));
                        row.put("description", rs.getString("gesture_description"));
                        row.put("category", rs.getString("category"));
                        row.put("difficulty", rs.getInt("difficulty"));
                        row.put("usageCount", rs.getLong("usage_count"));
                        row.put("masteryLevel", rs.getInt("mastery_level"));
                        row.put("studyCount", rs.getInt("study_count"));
                        return row;
                    },
                    username
            );
        } catch (Exception e) {
            return getGestureLibraryFallback(username);
        }
    }

    private List<Map<String, Object>> getGestureLibraryFallback(String username) {
        Map<String, Long> gestureStats = getUserStatistics(username).getGestureStats();
        List<Map<String, Object>> fallback = new ArrayList<>();
        for (Map.Entry<String, Long> entry : gestureStats.entrySet()) {
            Map<String, Object> row = new HashMap<>();
            row.put("id", fallback.size() + 1L);
            row.put("gestureName", entry.getKey());
            row.put("description", "来自识别历史统计");
            row.put("category", "历史");
            row.put("difficulty", 1);
            row.put("usageCount", entry.getValue());
            row.put("masteryLevel", 1);
            row.put("studyCount", entry.getValue().intValue());
            fallback.add(row);
        }
        return fallback;
    }

    public Map<String, Object> getLearningStats(String username) {
        Map<String, Object> result = new HashMap<>();
        StatisticsDTO stats = getUserStatistics(username);
        result.put("totalRecognitions", stats.getTotalCount());
        result.put("todayRecognitions", stats.getTodayCount());
        result.put("weekRecognitions", stats.getWeekCount());
        result.put("monthRecognitions", stats.getMonthCount());
        result.put("topGesture", stats.getTopGesture());
        result.put("gestureStats", stats.getGestureStats());

        long masteredCount = 0;
        long learningCount = 0;
        if (jdbcTemplate != null) {
            try {
                List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                        "SELECT COALESCE(ls.mastery_level, 0) AS mastery_level " +
                                "FROM gesture_library g " +
                                "LEFT JOIN users u ON u.username = ? " +
                                "LEFT JOIN learning_stats ls ON ls.user_id = u.id AND ls.gesture_id = g.id",
                        username
                );
                for (Map<String, Object> row : rows) {
                    int level = ((Number) row.get("mastery_level")).intValue();
                    if (level >= 3) masteredCount++;
                    if (level > 0 && level < 3) learningCount++;
                }
            } catch (Exception ignored) {
            }
        }

        result.put("masteredCount", masteredCount);
        result.put("learningCount", learningCount);
        return result;
    }

    // 注册用户
    @Transactional
    public boolean registerUser(String username, String email, String password) {
        if (jdbcTemplate == null) {
            throw new RuntimeException("数据库连接不可用");
        }
        
        try {
            // 检查用户名是否已存在
            Integer count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM users WHERE username = ?",
                    Integer.class,
                    username
            );
            
            if (count != null && count > 0) {
                return false; // 用户名已存在
            }
            
            // 插入新用户（密码使用明文，实际项目应该加密）
            int rows = jdbcTemplate.update(
                    "INSERT INTO users (username, email, password, created_at) VALUES (?, ?, ?, NOW())",
                    username, email, password
            );
            
            return rows > 0;
        } catch (Exception e) {
            throw new RuntimeException("注册失败：" + e.getMessage(), e);
        }
    }

    // 验证用户登录
    public boolean authenticateUser(String username, String password) {
        if (jdbcTemplate == null) {
            System.err.println("数据库连接不可用，登录验证失败");
            return false;
        }
        
        try {
            List<Integer> count = jdbcTemplate.query(
                    "SELECT COUNT(*) as count FROM users WHERE username = ? AND password = ?",
                    (rs, rowNum) -> rs.getInt("count"),
                    username, password
            );
            
            boolean authenticated = !count.isEmpty() && count.get(0) > 0;
            System.out.println("用户登录验证 - 用户名: " + username + ", 结果: " + (authenticated ? "成功" : "失败"));
            return authenticated;
        } catch (Exception e) {
            System.err.println("登录验证失败：" + e.getMessage());
            e.printStackTrace();
            return false;
        }
    }
}