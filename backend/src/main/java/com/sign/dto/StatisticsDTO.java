package com.sign.dto;

import java.util.Map;

public class StatisticsDTO {
    private long totalCount;
    private long todayCount;
    private long weekCount;
    private long monthCount;
    private Map<String, Long> gestureStats;
    private String topGesture;
    private double averageConfidence;

    // Getters and Setters
    public long getTotalCount() { return totalCount; }
    public void setTotalCount(long totalCount) { this.totalCount = totalCount; }

    public long getTodayCount() { return todayCount; }
    public void setTodayCount(long todayCount) { this.todayCount = todayCount; }

    public long getWeekCount() { return weekCount; }
    public void setWeekCount(long weekCount) { this.weekCount = weekCount; }

    public long getMonthCount() { return monthCount; }
    public void setMonthCount(long monthCount) { this.monthCount = monthCount; }

    public Map<String, Long> getGestureStats() { return gestureStats; }
    public void setGestureStats(Map<String, Long> gestureStats) { this.gestureStats = gestureStats; }

    public String getTopGesture() { return topGesture; }
    public void setTopGesture(String topGesture) { this.topGesture = topGesture; }

    public double getAverageConfidence() { return averageConfidence; }
    public void setAverageConfidence(double averageConfidence) { this.averageConfidence = averageConfidence; }
}