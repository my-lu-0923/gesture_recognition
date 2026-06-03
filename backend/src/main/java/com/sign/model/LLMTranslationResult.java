// backend/src/main/java/com/sign/model/LLMTranslationResult.java
package com.sign.model;

import lombok.Data;
import java.util.List;

@Data
public class LLMTranslationResult {
    private Boolean success;
    private List<String> gestures;
    private String translation;
    private Integer elapsedMs;
    private Boolean llmAvailable;
    private String error;
}