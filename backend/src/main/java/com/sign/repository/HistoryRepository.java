package com.sign.repository;

import com.sign.model.RecognitionHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Repository
public interface HistoryRepository extends JpaRepository<RecognitionHistory, Long> {

    // 根据用户名分页查询（按时间倒序）
    Page<RecognitionHistory> findByUsernameOrderByCreatedAtDesc(String username, Pageable pageable);

    // 根据用户名和手势查询
    List<RecognitionHistory> findByUsernameAndGesture(String username, String gesture);

    // 根据用户名和时间范围查询
    List<RecognitionHistory> findByUsernameAndCreatedAtBetween(String username, LocalDateTime start, LocalDateTime end);

    // 删除用户的所有历史记录
    @Modifying
    @Transactional
    @Query("DELETE FROM RecognitionHistory h WHERE h.username = :username")
    void deleteByUsername(@Param("username") String username);

    // 统计用户总识别次数
    long countByUsername(String username);

    // 统计今日识别次数
    @Query("SELECT COUNT(h) FROM RecognitionHistory h WHERE h.username = :username AND DATE(h.createdAt) = CURRENT_DATE")
    long countTodayByUsername(@Param("username") String username);

    // 统计本周识别次数
    @Query("SELECT COUNT(h) FROM RecognitionHistory h WHERE h.username = :username AND WEEK(h.createdAt) = WEEK(CURRENT_DATE)")
    long countThisWeekByUsername(@Param("username") String username);

    // 统计本月识别次数
    @Query("SELECT COUNT(h) FROM RecognitionHistory h WHERE h.username = :username AND MONTH(h.createdAt) = MONTH(CURRENT_DATE)")
    long countThisMonthByUsername(@Param("username") String username);

    // 获取最近的 N 条记录
    List<RecognitionHistory> findTop10ByUsernameOrderByCreatedAtDesc(String username);

    // 统计每种手势的识别次数
    @Query("SELECT h.gesture, COUNT(h) FROM RecognitionHistory h WHERE h.username = :username GROUP BY h.gesture ORDER BY COUNT(h) DESC")
    List<Object[]> countByGesture(@Param("username") String username);

    // 获取每日识别统计
    @Query("SELECT DATE(h.createdAt), COUNT(h) FROM RecognitionHistory h WHERE h.username = :username GROUP BY DATE(h.createdAt) ORDER BY DATE(h.createdAt) DESC")
    List<Object[]> getDailyStats(@Param("username") String username);

    // 获取手势使用频率
    @Query("SELECT h.gesture, AVG(h.confidence), COUNT(h) FROM RecognitionHistory h WHERE h.username = :username GROUP BY h.gesture")
    List<Object[]> getGestureStats(@Param("username") String username);

    // 删除旧记录（保留最近 N 天）
    @Modifying
    @Transactional
    @Query("DELETE FROM RecognitionHistory h WHERE h.username = :username AND h.createdAt < :date")
    void deleteOldRecords(@Param("username") String username, @Param("date") LocalDateTime date);
}