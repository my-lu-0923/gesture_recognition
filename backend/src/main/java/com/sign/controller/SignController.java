package com.sign.controller;

import com.sign.dto.HistoryDTO;
import com.sign.dto.StatisticsDTO;
import com.sign.model.LLMTranslationResult;
import com.sign.model.RecognitionResult;
import com.sign.service.HistoryService;
import com.sign.service.PythonService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpSession;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Logger;

@RestController
@CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
public class SignController {

    private static final Logger log = Logger.getLogger(SignController.class.getName());
    private static final Map<String, Long> LAST_SAVED_AT = new ConcurrentHashMap<>();
    private final PythonService pythonService;

    @Autowired
    private HistoryService historyService;  // 添加这行！注入 HistoryService

    public SignController(PythonService pythonService) {
        this.pythonService = pythonService;
    }

    @GetMapping("/")
    public String index() {
        return "redirect:/login";
    }

    @GetMapping("/api/health")
    @CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
    public Map<String, Object> health() {
        Map<String, Object> result = new HashMap<>();
        try {
            // 检查Python服务状态
            Map<String, Object> pythonHealth = pythonService.getPythonServiceStatus();
            
            result.put("status", "healthy");
            result.put("timestamp", System.currentTimeMillis());
            result.put("yolo_loaded", true);
            result.put("classes", 35);
            result.put("llmAvailable", false);
            
            // 添加Python服务引擎状态
            if (pythonHealth != null) {
                result.put("hybrid_loaded", pythonHealth.get("yolo_seq_loaded"));
                result.put("lstm_loaded", pythonHealth.get("yolo_seq_loaded"));
                result.put("python_status", pythonHealth.get("status"));
            } else {
                result.put("hybrid_loaded", false);
                result.put("lstm_loaded", false);
                result.put("python_status", "unavailable");
            }
        } catch (Exception e) {
            log.severe("健康检查失败: " + e.getMessage());
            result.put("status", "error");
            result.put("hybrid_loaded", false);
            result.put("lstm_loaded", false);
        }
        return result;
    }

    @GetMapping("/api/class_names")
    @CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
    public Map<String, Object> getClassNames() {
        String[] classNames = {
                "时间/时候", "你/您/你的/这", "早上", "9", "0",
                "快乐/高兴", "新", "祝", "请", "路",
                "生日", "平", "安", "朋友", "8",
                "认识", "名片", "结婚/妻子", "茶", "有",
                "花", "今天", "门", "停", "谢谢",
                "慢", "走", "晚", "我", "爱",
                "好", "人", "什么", "名字", "介绍"
        };
        Map<String, Object> result = new HashMap<>();
        result.put("class_names", classNames);
        result.put("count", classNames.length);
        return result;
    }

    @PostMapping("/api/login")
    @CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
    public Map<String, Object> login(@RequestBody Map<String, String> request, HttpSession session) {
        String username = request.get("username");
        String password = request.get("password");
        Map<String, Object> result = new HashMap<>();

        try {
            // 检查用户名和密码
            if (username == null || username.trim().isEmpty()) {
                result.put("success", false);
                result.put("message", "用户名不能为空");
                return result;
            }

            if (password == null || password.trim().isEmpty()) {
                result.put("success", false);
                result.put("message", "密码不能为空");
                return result;
            }

            // 调用 Service 层验证登录
            boolean authenticated = historyService.authenticateUser(username, password);
            
            if (authenticated) {
                // 登录成功，设置 session
                session.setAttribute("username", username);
                session.setAttribute("sessionId", UUID.randomUUID().toString());
                
                // 获取用户邮箱
                String email = historyService.getUserEmail(username);
                
                result.put("success", true);
                result.put("message", "登录成功");
                result.put("username", username);
                result.put("email", email);
                log.info("用户登录成功：" + username);
            } else {
                result.put("success", false);
                result.put("message", "用户名或密码错误");
            }
        } catch (Exception e) {
            log.severe("登录失败：" + e.getMessage());
            result.put("success", false);
            result.put("message", "登录失败：" + e.getMessage());
        }
        
        return result;
    }

    @PostMapping("/api/register")
    @CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
    public Map<String, Object> register(@RequestBody Map<String, String> request, HttpSession session) {
        String username = request.get("username");
        String email = request.get("email");
        String password = request.get("password");
        Map<String, Object> result = new HashMap<>();

        try {
            // 检查用户名是否为空
            if (username == null || username.trim().isEmpty()) {
                result.put("success", false);
                result.put("message", "用户名不能为空");
                return result;
            }

            // 检查邮箱是否为空
            if (email == null || email.trim().isEmpty()) {
                result.put("success", false);
                result.put("message", "邮箱不能为空");
                return result;
            }

            // 检查密码是否为空
            if (password == null || password.trim().isEmpty()) {
                result.put("success", false);
                result.put("message", "密码不能为空");
                return result;
            }

            // 调用 Service 层注册用户
            boolean registered = historyService.registerUser(username, email, password);
            
            if (registered) {
                // 注册成功后自动登录
                session.setAttribute("username", username);
                session.setAttribute("sessionId", UUID.randomUUID().toString());
                
                result.put("success", true);
                result.put("message", "注册成功");
                result.put("username", username);
                result.put("email", email);
                log.info("用户注册成功：" + username);
            } else {
                result.put("success", false);
                result.put("message", "用户名已存在");
            }
        } catch (Exception e) {
            log.severe("注册失败：" + e.getMessage());
            result.put("success", false);
            result.put("message", "注册失败：" + e.getMessage());
        }
        
        return result;
    }

    @GetMapping("/api/check")
    @CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
    public Map<String, Object> checkLogin(HttpSession session) {
        String username = (String) session.getAttribute("username");
        Map<String, Object> result = new HashMap<>();

        System.out.println("=== /api/check 被调用 ===");
        System.out.println("Session 中的 username: " + username);

        if (username != null) {
            result.put("loggedIn", true);
            result.put("username", username);
            // 获取用户邮箱
            String email = historyService.getUserEmail(username);
            System.out.println("/api/check 获取到的邮箱：" + email);
            result.put("email", email);
            System.out.println("返回的数据：" + result);
        } else {
            result.put("loggedIn", false);
        }
        return result;
    }

    @PostMapping("/api/logout")
    @CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
    public Map<String, Object> logout(HttpSession session) {
        session.invalidate();
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("message", "已退出登录");
        return result;
    }

    @PostMapping("/api/recognize")
    @CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
    public RecognitionResult recognize(@RequestBody Map<String, String> request, HttpSession session) {
        String image = request.get("image");
        String sessionId = (String) session.getAttribute("sessionId");
        String username = (String) session.getAttribute("username");

        // 如果没有登录，使用演示用户
        if (username == null) {
            username = "demo_user";
            session.setAttribute("username", username);
        }

        if (sessionId == null) {
            sessionId = UUID.randomUUID().toString();
            session.setAttribute("sessionId", sessionId);
        }

        RecognitionResult result = pythonService.recognize(image, sessionId);

        // ✅ 恢复自动保存功能
        // 保存识别历史：去抖时间调整为 2 秒，避免重复写入
        String saveKey = username + ":" + sessionId + ":" + result.getCurrentGesture();
        long now = System.currentTimeMillis();
        long lastSavedAt = LAST_SAVED_AT.getOrDefault(saveKey, 0L);
        boolean shouldSave = (result.getDetected() != null && result.getDetected())
                && result.getCurrentGesture() != null
                && result.getConfidence() != null
                && result.getConfidence() >= 0.5
                && (now - lastSavedAt >= 2000);

        if (shouldSave) {
            try {
                historyService.saveHistory(
                        username,
                        result.getCurrentGesture(),
                        result.getConfidence(),
                        sessionId,
                        result.getTranslation()
                );
                LAST_SAVED_AT.put(saveKey, now);
                log.info("保存识别历史成功：" + username + " - " + result.getCurrentGesture());
            } catch (Exception e) {
                log.severe("保存历史失败：" + e.getMessage());
            }
        }

        return result;
    }

    @PostMapping("/api/recognize/upload")
    @CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
    public RecognitionResult recognizeUpload(@RequestBody Map<String, String> request, HttpSession session) {
        // 上传识别使用独立的session_id，从请求中获取
        String image = request.get("image");
        String sessionId = request.get("session_id");
        
        // 如果没有提供session_id，生成一个
        if (sessionId == null || sessionId.isEmpty()) {
            sessionId = UUID.randomUUID().toString();
        }
        
        String username = (String) session.getAttribute("username");
        if (username == null) {
            username = "demo_user";
        }
        
        // 直接调用Python服务，不使用session管理
        RecognitionResult result = pythonService.recognize(image, sessionId);
        
        // 保存历史记录
        if (result.getDetected() != null && result.getDetected() 
            && result.getCurrentGesture() != null
            && result.getConfidence() != null
            && result.getConfidence() >= 0.5) {
            try {
                historyService.saveHistory(
                    username,
                    result.getCurrentGesture(),
                    result.getConfidence(),
                    sessionId,
                    result.getTranslation()
                );
                log.info("上传识别保存成功：" + username + " - " + result.getCurrentGesture());
            } catch (Exception e) {
                log.severe("上传识别保存失败：" + e.getMessage());
            }
        }
        
        return result;
    }

    @PostMapping("/api/recognize_hybrid")
    @CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
    public RecognitionResult recognizeHybrid(@RequestBody Map<String, String> request, HttpSession session) {
        String image = request.get("image");
        String sessionId = request.get("session_id");
        String username = (String) session.getAttribute("username");

        if (username == null) {
            username = "demo_user";
            session.setAttribute("username", username);
        }

        if (sessionId == null || sessionId.isEmpty()) {
            sessionId = UUID.randomUUID().toString();
            session.setAttribute("sessionId", sessionId);
        }

        RecognitionResult result = pythonService.recognizeHybrid(image, sessionId);

        String saveKey = username + ":" + sessionId + ":" + result.getCurrentGesture();
        long now = System.currentTimeMillis();
        long lastSavedAt = LAST_SAVED_AT.getOrDefault(saveKey, 0L);
        boolean shouldSave = (result.getDetected() != null && result.getDetected())
                && result.getCurrentGesture() != null
                && result.getConfidence() != null
                && result.getConfidence() >= 0.5
                && (now - lastSavedAt >= 2000);

        if (shouldSave) {
            try {
                historyService.saveHistory(
                        username,
                        result.getCurrentGesture(),
                        result.getConfidence(),
                        sessionId,
                        result.getTranslation()
                );
                LAST_SAVED_AT.put(saveKey, now);
                log.info("混合模式保存识别历史成功：" + username + " - " + result.getCurrentGesture());
            } catch (Exception e) {
                log.severe("混合模式保存历史失败：" + e.getMessage());
            }
        }

        return result;
    }

    @PostMapping("/api/recognize_lstm")
    @CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
    public RecognitionResult recognizeLSTM(@RequestBody Map<String, String> request, HttpSession session) {
        String image = request.get("image");
        String sessionId = request.get("session_id");
        String username = (String) session.getAttribute("username");

        if (username == null) {
            username = "demo_user";
            session.setAttribute("username", username);
        }

        if (sessionId == null || sessionId.isEmpty()) {
            sessionId = UUID.randomUUID().toString();
            session.setAttribute("sessionId", sessionId);
        }

        RecognitionResult result = pythonService.recognizeLSTM(image, sessionId);

        String saveKey = username + ":" + sessionId + ":" + result.getCurrentGesture();
        long now = System.currentTimeMillis();
        long lastSavedAt = LAST_SAVED_AT.getOrDefault(saveKey, 0L);
        boolean shouldSave = (result.getDetected() != null && result.getDetected())
                && result.getCurrentGesture() != null
                && result.getConfidence() != null
                && result.getConfidence() >= 0.5
                && (now - lastSavedAt >= 2000);

        if (shouldSave) {
            try {
                historyService.saveHistory(
                        username,
                        result.getCurrentGesture(),
                        result.getConfidence(),
                        sessionId,
                        result.getTranslation()
                );
                LAST_SAVED_AT.put(saveKey, now);
                log.info("LSTM模式保存识别历史成功：" + username + " - " + result.getCurrentGesture());
            } catch (Exception e) {
                log.severe("LSTM模式保存历史失败：" + e.getMessage());
            }
        }

        return result;
    }

    // 获取历史记录列表
    @GetMapping("/api/history/list")
    @CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
    public Map<String, Object> getHistoryList(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            HttpSession session) {

        String username = (String) session.getAttribute("username");
        Map<String, Object> result = new HashMap<>();

        if (username == null) {
            username = "demo_user";
        }

        try {
            Page<HistoryDTO> historyPage = historyService.getUserHistory(username, page, size);

            result.put("success", true);
            result.put("data", historyPage.getContent());
            result.put("total", historyPage.getTotalElements());
            result.put("totalPages", historyPage.getTotalPages());
            result.put("currentPage", page);
        } catch (Exception e) {
            log.severe("获取历史记录失败: " + e.getMessage());
            result.put("success", false);
            result.put("message", e.getMessage());
        }

        return result;
    }

    // 获取统计数据
    @GetMapping("/api/history/stats")
    @CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
    public Map<String, Object> getHistoryStats(HttpSession session) {
        String username = (String) session.getAttribute("username");
        Map<String, Object> result = new HashMap<>();

        if (username == null) {
            username = "demo_user";
        }

        try {
            StatisticsDTO stats = historyService.getUserStatistics(username);
            result.put("success", true);
            result.put("totalCount", stats.getTotalCount());
            result.put("todayCount", stats.getTodayCount());
            result.put("weekCount", stats.getWeekCount());
            result.put("monthCount", stats.getMonthCount());
            result.put("topGesture", stats.getTopGesture());
            result.put("gestureStats", stats.getGestureStats());
        } catch (Exception e) {
            log.severe("获取统计数据失败: " + e.getMessage());
            result.put("success", false);
        }

        return result;
    }

    // 清空历史记录
    @DeleteMapping("/api/history/clear")
    @CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
    public Map<String, Object> clearHistory(HttpSession session) {
        String username = (String) session.getAttribute("username");
        Map<String, Object> result = new HashMap<>();

        if (username == null) {
            username = "demo_user";
        }

        try {
            historyService.clearUserHistory(username);
            result.put("success", true);
            result.put("message", "历史记录已清空");
        } catch (Exception e) {
            log.severe("清空历史失败: " + e.getMessage());
            result.put("success", false);
            result.put("message", e.getMessage());
        }

        return result;
    }

    // 删除单条记录
    @DeleteMapping("/api/history/delete/{id}")
    @CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
    public Map<String, Object> deleteHistory(@PathVariable Long id, HttpSession session) {
        String username = (String) session.getAttribute("username");
        Map<String, Object> result = new HashMap<>();

        if (username == null) {
            username = "demo_user";
        }

        try {
            boolean success = historyService.deleteHistory(id, username);
            result.put("success", success);
            result.put("message", success ? "删除成功" : "删除失败");
        } catch (Exception e) {
            log.severe("删除历史失败: " + e.getMessage());
            result.put("success", false);
            result.put("message", e.getMessage());
        }

        return result;
    }

    // 获取最近记录
    @GetMapping("/api/history/recent")
    @CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
    public Map<String, Object> getRecentHistory(
            @RequestParam(defaultValue = "10") int limit,
            HttpSession session) {

        String username = (String) session.getAttribute("username");
        Map<String, Object> result = new HashMap<>();

        if (username == null) {
            username = "demo_user";
        }

        try {
            List<HistoryDTO> recent = historyService.getRecentHistory(username, limit);
            result.put("success", true);
            result.put("data", recent);
        } catch (Exception e) {
            log.severe("获取最近记录失败: " + e.getMessage());
            result.put("success", false);
        }

        return result;
    }

    // 导出数据为 CSV
    @GetMapping("/api/history/export")
    @CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
    public Map<String, Object> exportHistory(HttpSession session) {
        String username = (String) session.getAttribute("username");
        Map<String, Object> result = new HashMap<>();

        if (username == null) {
            username = "demo_user";
        }

        try {
            List<HistoryDTO> histories = historyService.getRecentHistory(username, 1000);
            result.put("success", true);
            result.put("data", histories);
        } catch (Exception e) {
            log.severe("导出失败: " + e.getMessage());
            result.put("success", false);
        }

        return result;
    }

    @PostMapping("/api/chat")
    @CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
    public Map<String, Object> chat(@RequestBody Map<String, Object> request, HttpSession session) {
        String message = (String) request.get("message");
        String username = (String) session.getAttribute("username");

        Map<String, Object> result = new HashMap<>();

        if (username == null) {
            username = "demo_user";
            session.setAttribute("username", username);
        }

        if (message == null || message.trim().isEmpty()) {
            result.put("success", false);
            result.put("response", "请输入您的问题");
            return result;
        }

        try {
            Map<String, Object> chatResult = pythonService.chatWithLLM(message, username);

            result.put("success", chatResult.getOrDefault("success", false));
            result.put("response", chatResult.getOrDefault("response", "无法获取回复"));
            log.info("AI对话成功: " + message.substring(0, Math.min(50, message.length())) + "...");
        } catch (Exception e) {
            log.severe("对话失败：" + e.getMessage());
            result.put("success", false);
            result.put("response", "抱歉，AI 助手暂时无法响应，请稍后再试。");
        }
        return result;
    }
    
    @PostMapping("/api/translate/llm")
    @CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
    public LLMTranslationResult llmTranslate(HttpSession session) {
        String sessionId = (String) session.getAttribute("sessionId");
        String username = (String) session.getAttribute("username");

        if (sessionId == null) {
            sessionId = UUID.randomUUID().toString();
            session.setAttribute("sessionId", sessionId);
        }
        if (username == null) username = "demo_user";

        try {
            return pythonService.llmTranslate(sessionId, username);
        } catch (Exception e) {
            log.severe("LLM翻译失败：" + e.getMessage());
            LLMTranslationResult result = new LLMTranslationResult();
            result.setSuccess(false);
            result.setError(e.getMessage());
            result.setTranslation("翻译服务暂时不可用，请稍后再试");
            return result;
        }
    }

    @PostMapping("/api/translate/rule")
    @CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
    public LLMTranslationResult ruleTranslate(HttpSession session) {
        LLMTranslationResult result = new LLMTranslationResult();
        result.setSuccess(true);
        result.setTranslation("规则翻译");
        return result;
    }

    @PostMapping("/api/session/clear")
    @CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
    public Map<String, Object> clearSession(HttpSession session) {
        String sessionId = (String) session.getAttribute("sessionId");
        Map<String, Object> result = new HashMap<>();

        if (sessionId != null) {
            boolean success = pythonService.clearSession(sessionId);
            result.put("success", success);
            log.info("清空会话成功：" + sessionId);
        } else {
            result.put("success", true);
            log.info("无需清空会话（sessionId 为空）");
        }
        return result;
    }

    @GetMapping("/api/llm/status")
    @CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
    public Map<String, Object> getLLMStatus() {
        try {
            Map<String, Object> status = pythonService.getLLMStatus();
            log.info("LLM状态: " + status);
            return status;
        } catch (Exception e) {
            log.severe("获取LLM状态失败: " + e.getMessage());
            Map<String, Object> result = new HashMap<>();
            result.put("available", false);
            result.put("message", "规则模式");
            result.put("error", e.getMessage());
            return result;
        }
    }

    @GetMapping("/api/history")
    @CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
    public Map<String, Object> getHistory() {
        Map<String, Object> result = new HashMap<>();
        result.put("history", new Object[]{});
        return result;
    }

    @GetMapping("/api/gesture-library")
    @CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
    public Map<String, Object> getGestureLibrary(HttpSession session) {
        String username = (String) session.getAttribute("username");
        if (username == null) username = "demo_user";
        Map<String, Object> result = new HashMap<>();
        try {
            List<Map<String, Object>> gestures = historyService.getGestureLibrary(username);
            result.put("success", true);
            result.put("data", gestures);
            result.put("count", gestures.size());
        } catch (Exception e) {
            log.severe("获取手势库失败: " + e.getMessage());
            result.put("success", false);
            result.put("data", List.of());
            result.put("count", 0);
        }
        return result;
    }

    @GetMapping("/api/learning/stats")
    @CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
    public Map<String, Object> getLearningStats(HttpSession session) {
        String username = (String) session.getAttribute("username");
        if (username == null) username = "demo_user";
        Map<String, Object> result = new HashMap<>();
        try {
            result.put("success", true);
            result.put("data", historyService.getLearningStats(username));
        } catch (Exception e) {
            log.severe("获取学习统计失败: " + e.getMessage());
            result.put("success", false);
            result.put("data", Map.of());
        }
        return result;
    }
}