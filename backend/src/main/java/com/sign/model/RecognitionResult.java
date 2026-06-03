package com.sign.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true) // 忽略未知字段，避免解析失败
public class RecognitionResult {
    private Boolean detected;
    
    @JsonProperty("current_gesture") // 支持下划线命名 (Python 服务返回)
    private String currentGesture;
    
    private Double confidence;
    
    @JsonProperty("gesture_sequence") // 支持下划线命名 (Python 服务返回)
    private List<String> gestureSequence;
    
    @JsonProperty("quick_translation") // 支持下划线命名 (Python 服务返回)
    private String quickTranslation;
    
    @JsonProperty("buffer_size") // 支持下划线命名 (Python 服务返回)
    private Integer bufferSize;
    
    private String message;
    private String translation;  // 添加翻译字段
    
    @JsonProperty("detections")
    private List<Detection> detections;  // 添加检测结果列表

    // 内部类：检测结果
    @Data
    public static class Detection {
        private String gloss;
        private String label;
        private Double confidence;

        public Detection() {}

        public Detection(String gloss, Double confidence) {
            this.gloss = gloss;
            this.confidence = confidence;
            this.label = gloss;
        }
    }

    // 构造函数
    public RecognitionResult() {
        this.detected = false;
        this.gestureSequence = new java.util.ArrayList<>();
        this.detections = new java.util.ArrayList<>();
    }

    // 带参数的构造函数
    public RecognitionResult(String currentGesture, Double confidence) {
        this();
        this.detected = true;
        this.currentGesture = currentGesture;
        this.confidence = confidence;
    }

    // 便捷方法：添加检测结果
    public void addDetection(String gesture, Double confidence) {
        if (this.detections == null) {
            this.detections = new java.util.ArrayList<>();
        }
        this.detections.add(new Detection(gesture, confidence));
    }

    // 便捷方法：设置翻译结果
    public void setTranslationResult(String translation) {
        this.translation = translation;
        this.quickTranslation = translation;
    }

    @Override
    public String toString() {
        return "RecognitionResult{" +
                "detected=" + detected +
                ", currentGesture='" + currentGesture + '\'' +
                ", confidence=" + confidence +
                ", gestureSequence=" + gestureSequence +
                ", quickTranslation='" + quickTranslation + '\'' +
                ", bufferSize=" + bufferSize +
                ", message='" + message + '\'' +
                ", translation='" + translation + '\'' +
                ", detections=" + detections +
                '}';
    }
}