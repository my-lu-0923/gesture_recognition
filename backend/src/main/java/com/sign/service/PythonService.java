package com.sign.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sign.model.LLMTranslationResult;
import com.sign.model.RecognitionResult;
import com.sign.model.RecognitionResult.Detection;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.logging.Logger;

@Service
public class PythonService {

    private static final Logger log = Logger.getLogger(PythonService.class.getName());

    // 使用默认值，即使配置文件加载失败也能运行
    @Value("${python.service.url:http://localhost:5001}")
    private String pythonServiceUrl;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final CloseableHttpClient httpClient = HttpClients.createDefault();

    @Autowired
    private HistoryService historyService;  // 注入 HistoryService

    /**
     * 识别手势（调用 Python 服务）
     */
    public RecognitionResult recognize(String imageBase64, String sessionId) {
        RecognitionResult result = new RecognitionResult();
        try {
            // 判断是否为上传识别（单张图片/视频首帧）
            String url;
            if (sessionId != null && sessionId.startsWith("upload_")) {
                // 上传识别使用普通 YOLO 识别（单帧即可识别）
                url = pythonServiceUrl + "/recognize";
                log.info("调用Python服务(上传识别-YOLO单帧): " + url);
            } else {
                // 实时识别使用 YOLO 序列 LSTM 识别器（需要累积30帧）
                url = pythonServiceUrl + "/recognize_yolo_seq";
                log.info("调用Python服务(YOLO序列LSTM): " + url);
            }

            Map<String, Object> request = new HashMap<>();
            request.put("image", imageBase64);
            request.put("session_id", sessionId);

            String jsonRequest = objectMapper.writeValueAsString(request);

            HttpPost httpPost = new HttpPost(url);
            httpPost.setHeader("Content-Type", "application/json");
            httpPost.setEntity(new StringEntity(jsonRequest, "UTF-8"));

            try (CloseableHttpResponse response = httpClient.execute(httpPost)) {
                BufferedReader reader = new BufferedReader(
                        new InputStreamReader(response.getEntity().getContent()));
                StringBuilder responseStr = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    responseStr.append(line);
                }

                // 解析 Python 服务返回的结果
                result = parseRecognitionResult(responseStr.toString());
                log.info("识别成功: " + result.getCurrentGesture() + " - 置信度: " + result.getConfidence());
            }
        } catch (Exception e) {
            log.severe("识别失败: " + e.getMessage());
            // 返回模拟数据用于测试
//            result = getMockRecognitionResult();
        }
        return result;
    }

    /**
     * 混合模式识别手势（YOLO + LSTM）
     */
    public RecognitionResult recognizeHybrid(String imageBase64, String sessionId) {
        RecognitionResult result = new RecognitionResult();
        try {
            String url = pythonServiceUrl + "/recognize_yolo_seq";
            log.info("调用Python服务(混合模式): " + url);

            Map<String, Object> request = new HashMap<>();
            request.put("image", imageBase64);
            request.put("session_id", sessionId);

            String jsonRequest = objectMapper.writeValueAsString(request);

            HttpPost httpPost = new HttpPost(url);
            httpPost.setHeader("Content-Type", "application/json");
            httpPost.setEntity(new StringEntity(jsonRequest, "UTF-8"));

            try (CloseableHttpResponse response = httpClient.execute(httpPost)) {
                BufferedReader reader = new BufferedReader(
                        new InputStreamReader(response.getEntity().getContent()));
                StringBuilder responseStr = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    responseStr.append(line);
                }

                result = parseRecognitionResult(responseStr.toString());
                log.info("混合模式识别成功: " + result.getCurrentGesture() + " - 置信度: " + result.getConfidence());
            }
        } catch (Exception e) {
            log.severe("混合模式识别失败: " + e.getMessage());
        }
        return result;
    }

    /**
     * LSTM精准模式识别手势
     */
    public RecognitionResult recognizeLSTM(String imageBase64, String sessionId) {
        RecognitionResult result = new RecognitionResult();
        try {
            String url = pythonServiceUrl + "/recognize_yolo_seq";
            log.info("调用Python服务(LSTM模式): " + url);

            Map<String, Object> request = new HashMap<>();
            request.put("image", imageBase64);
            request.put("session_id", sessionId);

            String jsonRequest = objectMapper.writeValueAsString(request);

            HttpPost httpPost = new HttpPost(url);
            httpPost.setHeader("Content-Type", "application/json");
            httpPost.setEntity(new StringEntity(jsonRequest, "UTF-8"));

            try (CloseableHttpResponse response = httpClient.execute(httpPost)) {
                BufferedReader reader = new BufferedReader(
                        new InputStreamReader(response.getEntity().getContent()));
                StringBuilder responseStr = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    responseStr.append(line);
                }

                result = parseRecognitionResult(responseStr.toString());
                log.info("LSTM模式识别成功: " + result.getCurrentGesture() + " - 置信度: " + result.getConfidence());
            }
        } catch (Exception e) {
            log.severe("LSTM模式识别失败: " + e.getMessage());
        }
        return result;
    }

    /**
     * 解析 Python 服务返回的识别结果
     */
    private RecognitionResult parseRecognitionResult(String jsonResponse) {
        try {
            // 尝试直接解析为 RecognitionResult
            RecognitionResult result = objectMapper.readValue(jsonResponse, RecognitionResult.class);

            // 确保 detections 不为空
            if (result.getDetections() == null && result.getCurrentGesture() != null) {
                result.addDetection(result.getCurrentGesture(), result.getConfidence());
            }

            return result;
        } catch (Exception e) {
            log.warning("解析识别结果失败，使用备用方案: " + e.getMessage());

            // 备用解析：手动解析 JSON
            try {
                Map<String, Object> responseMap = objectMapper.readValue(jsonResponse, Map.class);
                RecognitionResult result = new RecognitionResult();

                // 解析 detected
                if (responseMap.containsKey("detected")) {
                    result.setDetected((Boolean) responseMap.get("detected"));
                }

                // 解析 current_gesture (支持 Python 服务的下划线命名)
                if (responseMap.containsKey("current_gesture")) {
                    result.setCurrentGesture((String) responseMap.get("current_gesture"));
                } else if (responseMap.containsKey("currentGesture")) {
                    result.setCurrentGesture((String) responseMap.get("currentGesture"));
                }

                // 解析 confidence
                if (responseMap.containsKey("confidence")) {
                    Object conf = responseMap.get("confidence");
                    if (conf instanceof Integer) {
                        result.setConfidence(((Integer) conf).doubleValue());
                    } else if (conf instanceof Double) {
                        result.setConfidence((Double) conf);
                    }
                }

                // 解析 detections
                if (responseMap.containsKey("detections")) {
                    List<Map<String, Object>> detections = (List<Map<String, Object>>) responseMap.get("detections");
                    for (Map<String, Object> det : detections) {
                        String gesture = (String) det.get("gesture");
                        Double confidence = (Double) det.get("confidence");
                        if (gesture != null) {
                            result.addDetection(gesture, confidence != null ? confidence : 0.8);
                        }
                    }
                }

                // 解析 translation
                if (responseMap.containsKey("translation")) {
                    result.setTranslation((String) responseMap.get("translation"));
                }

                return result;
            } catch (Exception ex) {
                log.severe("❌ 解析失败（Python 服务返回异常）: " + ex.getMessage());
                // 🔴 不返回模拟数据，返回未检测结果
                RecognitionResult failedResult = new RecognitionResult();
                failedResult.setDetected(false);
                failedResult.setMessage("识别服务响应异常，请稍后再试");
                return failedResult;
            }
        }
    }
    /**
     * LLM 翻译
     */
    public LLMTranslationResult llmTranslate(String sessionId, String username) {
        LLMTranslationResult result = new LLMTranslationResult();
        try {
            String url = pythonServiceUrl + "/translate/llm";
            log.info("调用LLM翻译: " + url);

            Map<String, Object> request = new HashMap<>();
            request.put("session_id", sessionId);
            request.put("username", username);

            String jsonRequest = objectMapper.writeValueAsString(request);

            HttpPost httpPost = new HttpPost(url);
            httpPost.setHeader("Content-Type", "application/json");
            httpPost.setEntity(new StringEntity(jsonRequest, "UTF-8"));

            try (CloseableHttpResponse response = httpClient.execute(httpPost)) {
                BufferedReader reader = new BufferedReader(
                        new InputStreamReader(response.getEntity().getContent()));
                StringBuilder responseStr = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    responseStr.append(line);
                }

                result = objectMapper.readValue(responseStr.toString(), LLMTranslationResult.class);
            }
        } catch (Exception e) {
            log.severe("LLM翻译失败: " + e.getMessage());
            result.setSuccess(false);
            result.setError(e.getMessage());
            result.setTranslation("LLM服务暂时不可用，请稍后再试");
        }
        return result;
    }

    /**
     * 规则翻译
     */
    public LLMTranslationResult ruleTranslate(String sessionId) {
        LLMTranslationResult result = new LLMTranslationResult();
        try {
            String url = pythonServiceUrl + "/translate/rule";
            log.info("调用规则翻译: " + url);

            Map<String, Object> request = new HashMap<>();
            request.put("session_id", sessionId);

            String jsonRequest = objectMapper.writeValueAsString(request);

            HttpPost httpPost = new HttpPost(url);
            httpPost.setHeader("Content-Type", "application/json");
            httpPost.setEntity(new StringEntity(jsonRequest, "UTF-8"));

            try (CloseableHttpResponse response = httpClient.execute(httpPost)) {
                BufferedReader reader = new BufferedReader(
                        new InputStreamReader(response.getEntity().getContent()));
                StringBuilder responseStr = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    responseStr.append(line);
                }

                result = objectMapper.readValue(responseStr.toString(), LLMTranslationResult.class);
            }
        } catch (Exception e) {
            log.severe("规则翻译失败: " + e.getMessage());
            result.setSuccess(false);
            result.setError(e.getMessage());
        }
        return result;
    }

    /**
     * 清空会话
     */
    public boolean clearSession(String sessionId) {
        try {
            String url = pythonServiceUrl + "/session/" + sessionId + "/clear";
            HttpPost httpPost = new HttpPost(url);

            try (CloseableHttpResponse response = httpClient.execute(httpPost)) {
                return response.getStatusLine().getStatusCode() == 200;
            }
        } catch (Exception e) {
            log.severe("清空会话失败: " + e.getMessage());
            return false;
        }
    }

    /**
     * 获取 LLM 状态
     */
    /**
     * 获取Python服务状态
     */
    public Map<String, Object> getPythonServiceStatus() {
        try {
            String url = pythonServiceUrl + "/health";
            org.apache.http.client.methods.HttpGet httpGet = new org.apache.http.client.methods.HttpGet(url);
            
            try (CloseableHttpResponse response = httpClient.execute(httpGet)) {
                BufferedReader reader = new BufferedReader(
                        new InputStreamReader(response.getEntity().getContent()));
                StringBuilder responseStr = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    responseStr.append(line);
                }
                
                return objectMapper.readValue(responseStr.toString(), Map.class);
            }
        } catch (Exception e) {
            log.warning("获取Python服务状态失败: " + e.getMessage());
            return null;
        }
    }

    public Map<String, Object> getLLMStatus() {
        Map<String, Object> result = new HashMap<>();
        try {
            String url = pythonServiceUrl + "/llm/status";
            org.apache.http.client.methods.HttpGet httpGet = new org.apache.http.client.methods.HttpGet(url);

            try (CloseableHttpResponse response = httpClient.execute(httpGet)) {
                BufferedReader reader = new BufferedReader(
                        new InputStreamReader(response.getEntity().getContent()));
                StringBuilder responseStr = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    responseStr.append(line);
                }

                result = objectMapper.readValue(responseStr.toString(), Map.class);
            }
        } catch (Exception e) {
            log.severe("获取LLM状态失败: " + e.getMessage());
            result.put("available", false);
            result.put("error", e.getMessage());
        }
        return result;
    }

    /**
     * AI对话 - 调用Python服务的/chat接口
     */
    public Map<String, Object> chatWithLLM(String message, String username) {
        Map<String, Object> result = new HashMap<>();
        try {
            String url = pythonServiceUrl + "/chat";
            log.info("调用AI对话: " + url);

            Map<String, Object> request = new HashMap<>();
            request.put("message", message);
            request.put("username", username);

            String jsonRequest = objectMapper.writeValueAsString(request);

            HttpPost httpPost = new HttpPost(url);
            httpPost.setHeader("Content-Type", "application/json");
            httpPost.setEntity(new StringEntity(jsonRequest, "UTF-8"));

            try (CloseableHttpResponse response = httpClient.execute(httpPost)) {
                BufferedReader reader = new BufferedReader(
                        new InputStreamReader(response.getEntity().getContent()));
                StringBuilder responseStr = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    responseStr.append(line);
                }

                result = objectMapper.readValue(responseStr.toString(), Map.class);
                log.info("AI对话返回: " + (result.get("response") != null ?
                        result.get("response").toString().substring(0,
                                Math.min(50, result.get("response").toString().length())) : "null"));
            }
        } catch (Exception e) {
            log.severe("AI对话失败: " + e.getMessage());
            result.put("success", false);
            result.put("response", "AI服务暂时不可用，请稍后再试。");
            result.put("error", e.getMessage());
        }
        return result;
    }
}