package com.sign.dto;

import java.time.LocalDateTime;

public class HistoryDTO {
    private Long id;
    private String gesture;
    private Double confidence;
    private String confidencePercent;
    private String aiReply;
    private LocalDateTime createdAt;
    private String formattedTime;

    public HistoryDTO() {}

    public HistoryDTO(Long id, String gesture, Double confidence, String aiReply, LocalDateTime createdAt) {
        this.id = id;
        this.gesture = gesture;
        this.confidence = confidence;
        this.aiReply = aiReply;
        this.createdAt = createdAt;
        this.confidencePercent = String.format("%.1f%%", confidence * 100);
        this.formattedTime = createdAt != null ? createdAt.toString().replace("T", " ") : "";
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getGesture() { return gesture; }
    public void setGesture(String gesture) { this.gesture = gesture; }

    public Double getConfidence() { return confidence; }
    public void setConfidence(Double confidence) { this.confidence = confidence; }

    public String getConfidencePercent() { return confidencePercent; }
    public void setConfidencePercent(String confidencePercent) { this.confidencePercent = confidencePercent; }

    public String getAiReply() { return aiReply; }
    public void setAiReply(String aiReply) { this.aiReply = aiReply; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public String getFormattedTime() { return formattedTime; }
    public void setFormattedTime(String formattedTime) { this.formattedTime = formattedTime; }
}