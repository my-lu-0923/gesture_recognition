package com.sign.model;

import javax.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "recognition_history", indexes = {
        @Index(name = "idx_username", columnList = "username"),
        @Index(name = "idx_created_at", columnList = "created_at"),
        @Index(name = "idx_username_created", columnList = "username, created_at")
})
public class RecognitionHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "username", nullable = false, length = 50)
    private String username;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "gesture", nullable = false, length = 100)
    private String gesture;

    @Column(name = "confidence", nullable = false)
    private Double confidence;

    @Column(name = "ai_reply", length = 1000)
    private String aiReply;

    @Column(name = "image_data", columnDefinition = "TEXT")
    private String imageData;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "session_id", length = 100)
    private String sessionId;

    @Column(name = "confidence_score")
    private Double confidenceScore;

    @Column(name = "processing_time")
    private Long processingTime;

    // 构造函数
    public RecognitionHistory() {
        this.createdAt = LocalDateTime.now();
    }

    public RecognitionHistory(String username, String gesture, Double confidence, String sessionId) {
        this.username = username;
        this.gesture = gesture;
        this.confidence = confidence;
        this.sessionId = sessionId;
        this.createdAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getGesture() {
        return gesture;
    }

    public void setGesture(String gesture) {
        this.gesture = gesture;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public Double getConfidence() {
        return confidence;
    }

    public void setConfidence(Double confidence) {
        this.confidence = confidence;
    }

    public String getAiReply() {
        return aiReply;
    }

    public void setAiReply(String aiReply) {
        this.aiReply = aiReply;
    }

    public String getImageData() {
        return imageData;
    }

    public void setImageData(String imageData) {
        this.imageData = imageData;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public Double getConfidenceScore() {
        return confidenceScore;
    }

    public void setConfidenceScore(Double confidenceScore) {
        this.confidenceScore = confidenceScore;
    }

    public Long getProcessingTime() {
        return processingTime;
    }

    public void setProcessingTime(Long processingTime) {
        this.processingTime = processingTime;
    }
}