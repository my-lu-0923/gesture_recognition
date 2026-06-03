import cv2
import numpy as np
import base64
import logging
import time
import traceback
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from collections import deque
from enum import Enum
from ultralytics import YOLO
import os
import requests
from dotenv import load_dotenv
import jieba
import re
import subprocess
from datetime import datetime
import hashlib
import threading

load_dotenv()

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*", "supports_credentials": True, "allow_headers": ["Content-Type", "Authorization"]}})

# 初始化 SocketIO（支持WebSocket）
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

NO_PROXY = {'http': None, 'https': None}

# ========== 性能优化：请求缓存和并发控制 ==========
request_cache = {}
cache_lock = threading.Lock()
MAX_CACHE_SIZE = 10
CACHE_TTL = 0.5  # 缓存 500ms，避免重复请求

# 并发信号量（最多同时处理 2 个识别请求）
recognition_semaphore = threading.Semaphore(2)
active_requests = 0
requests_lock = threading.Lock()

CLASS_NAMES = [
    "时间/时候", "你/您/你的/这", "早上", "9", "0",
    "快乐/高兴", "新", "祝", "请", "路",
    "生日", "平", "安", "朋友", "8",
    "认识", "名片", "结婚/妻子", "茶", "有",
    "花", "今天", "门", "停", "谢谢",
    "慢", "走", "晚", "我", "爱",
    "好", "人", "什么", "名字", "介绍"
]

# ========== 翻译器初始化 ==========
rule_translator = None
local_llm_translator = None
sophnet_translator = None

# 1. 初始化 Sophnet 翻译器（优先使用，兼容 OpenAI SDK）
try:
    from translators.sophnet_translator import SophnetTranslator
    sophnet_translator = SophnetTranslator()
    if sophnet_translator.is_available():
        logger.info("✅ Sophnet 翻译器已启用")
    else:
        logger.info("⚠️ Sophnet 未配置，将使用备用方案")
        sophnet_translator = None
except Exception as e:
    logger.warning(f"Sophnet 翻译器加载失败: {e}")

# 2. 初始化规则翻译器和本地 LLM（备用）
try:
    from translators.rule_translator import RuleTranslator
    from translators.local_llm_translator import LocalLLMTranslator
    from translators.sentence_optimizer import SentenceOptimizer
    rule_translator = RuleTranslator()
    local_llm_translator = LocalLLMTranslator(model_name="qwen2.5:0.5b")
    sentence_optimizer = SentenceOptimizer()
    logger.info("✅ 规则翻译器、本地 LLM 和句子优化器加载成功")
except Exception as e:
    logger.warning(f"规则翻译器/本地 LLM/句子优化器加载失败: {e}")
    rule_translator = None
    local_llm_translator = None
    sentence_optimizer = None

yolo_model = None
try:
    model_path = 'models/new_hand_sign.pt'
    if os.path.exists(model_path):
        yolo_model = YOLO(model_path)
        logger.info(f"YOLO模型加载成功: {model_path}")
    else:
        logger.error(f"模型文件不存在: {model_path}")
except Exception as e:
    logger.error(f"YOLO模型加载失败: {e}")
    yolo_model = None

# ========== 新增：YOLO 序列 LSTM 识别器（77.88% 准确率）==========
yolo_seq_recognizer = None
try:
    from lstm_models.yolo_sequence_recognizer import YOLOSequenceGestureRecognizer
    lstm_model_path = 'models/context_lstm_finetuned_best.pth'
    if os.path.exists(lstm_model_path) and yolo_model is not None:
        yolo_seq_recognizer = YOLOSequenceGestureRecognizer(
            yolo_model_path='models/new_hand_sign.pt',
            lstm_model_path=lstm_model_path,
            seq_length=30,
            device='auto'
        )
        logger.info(f"YOLO序列LSTM识别器加载成功: {lstm_model_path}")
    else:
        logger.warning(f"YOLO序列LSTM模型不存在: {lstm_model_path}")
except Exception as e:
    logger.error(f"YOLO序列LSTM识别器加载失败: {e}")
    yolo_seq_recognizer = None


class GestureState(Enum):
    IDLE = "idle"
    DETECTING = "detecting"
    CONFIRMED = "confirmed"
    HOLDING = "holding"


class TemporalRecognitionEngine:
    """
    时序动态识别引擎
    
    核心设计：
    1. 滑动窗口：维护最近N帧的检测结果
    2. 状态机：IDLE -> DETECTING -> CONFIRMED -> HOLDING -> IDLE
    3. 加权投票：越新的帧权重越高
    4. EMA平滑：置信度使用指数移动平均
    5. 动态阈值：根据历史稳定性自适应调整
    """

    def __init__(self, window_size=12, confirm_frames=2, hold_threshold=6,
                 min_confidence=0.35, ema_alpha=0.5, no_gesture_timeout=800):
        self.window_size = window_size
        self.confirm_frames = confirm_frames
        self.hold_threshold = hold_threshold
        self.min_confidence = min_confidence
        self.ema_alpha = ema_alpha
        self.no_gesture_timeout = no_gesture_timeout

        self.frame_buffer = deque(maxlen=window_size)
        self.state = GestureState.IDLE
        self.confirmed_gesture = None
        self.confirmed_confidence = 0.0
        self.ema_confidence = 0.0
        self.consecutive_count = 0
        self.hold_count = 0
        self.no_gesture_count = 0
        self.gesture_start_time = None
        self.sequence_buffer = deque(maxlen=20)
        self.last_confirm_time = 0
        self.gesture_history = []

    def reset(self):
        self.frame_buffer.clear()
        self.state = GestureState.IDLE
        self.confirmed_gesture = None
        self.confirmed_confidence = 0.0
        self.ema_confidence = 0.0
        self.consecutive_count = 0
        self.hold_count = 0
        self.no_gesture_count = 0
        self.gesture_start_time = None
        self.last_confirm_time = 0

    def process_frame(self, gesture, confidence, timestamp=None):
        """
        处理单帧检测结果，返回时序分析后的结果
        
        返回: {
            'gesture': str or None,
            'confidence': float,
            'state': GestureState,
            'is_new_gesture': bool,      # 是否是新确认的手势
            'stability': float,          # 稳定性 0-1
            'sequence': list             # 当前手势序列
        }
        """
        if timestamp is None:
            timestamp = time.time() * 1000

        frame_result = {
            'gesture': gesture,
            'confidence': confidence,
            'timestamp': timestamp
        }
        self.frame_buffer.append(frame_result)

        if gesture is not None and confidence >= self.min_confidence * 0.6:
            self.no_gesture_count = 0
        else:
            self.no_gesture_count += 1

        result = self._run_state_machine(timestamp)

        return result

    def _run_state_machine(self, timestamp):
        """核心状态机逻辑"""

        weighted_result = self._weighted_voting()

        if weighted_result is None:
            best_gesture = None
            best_confidence = 0.0
            stability = 0.0
        else:
            best_gesture = weighted_result['gesture']
            best_confidence = weighted_result['confidence']
            stability = weighted_result['stability']

        is_new_gesture = False

        if self.state == GestureState.IDLE:
            if best_gesture is not None and best_confidence >= self.min_confidence:
                self.state = GestureState.DETECTING
                self.consecutive_count = 1
                self.gesture_start_time = timestamp
                self.ema_confidence = best_confidence
                logger.debug(f"[时序] IDLE->DETECTING: {best_gesture} ({best_confidence:.2f})")

        elif self.state == GestureState.DETECTING:
            if best_gesture is not None and best_confidence >= self.min_confidence * 0.5:
                self.consecutive_count += 1
                self.ema_confidence = (self.ema_alpha * best_confidence +
                                       (1 - self.ema_alpha) * self.ema_confidence)

                if self.consecutive_count >= self.confirm_frames:
                    self.state = GestureState.CONFIRMED
                    self.confirmed_gesture = best_gesture
                    self.confirmed_confidence = self.ema_confidence
                    self.hold_count = 0
                    self.last_confirm_time = timestamp
                    is_new_gesture = True

                    if (len(self.sequence_buffer) == 0 or
                            self.sequence_buffer[-1] != best_gesture):
                        self.sequence_buffer.append(best_gesture)

                    logger.info(f"[时序] ✅ 手势确认: {best_gesture} "
                                f"(置信度={self.ema_confidence:.2f}, "
                                f"稳定性={stability:.2f}, "
                                f"连续帧={self.consecutive_count})")
            else:
                self.consecutive_count = max(0, self.consecutive_count - 1)
                if self.consecutive_count <= 0 or self.no_gesture_count > 6:
                    self.state = GestureState.IDLE
                    self.consecutive_count = 0
                    logger.debug("[时序] DETECTING->IDLE: 手势丢失")

        elif self.state == GestureState.CONFIRMED:
            self.hold_count += 1

            if best_gesture == self.confirmed_gesture or best_confidence >= self.min_confidence * 0.5:
                if best_gesture == self.confirmed_gesture:
                    self.ema_confidence = (self.ema_alpha * best_confidence +
                                           (1 - self.ema_alpha) * self.ema_confidence)
                    self.confirmed_confidence = self.ema_confidence
                self.state = GestureState.HOLDING
                logger.debug(f"[时序] CONFIRMED->HOLDING: {self.confirmed_gesture}")

            if self.hold_count >= self.hold_threshold or self.no_gesture_count > 5:
                self.gesture_history.append({
                    'gesture': self.confirmed_gesture,
                    'confidence': self.confirmed_confidence,
                    'duration': timestamp - self.gesture_start_time,
                    'sequence_idx': len(self.sequence_buffer) - 1
                })
                self.state = GestureState.IDLE
                self.consecutive_count = 0
                self.hold_count = 0
                logger.debug(f"[时序] CONFIRMED->IDLE: 手势结束 ({self.confirmed_gesture})")

        elif self.state == GestureState.HOLDING:
            # 保持状态下，只有相同手势或高置信度才能继续
            if best_gesture == self.confirmed_gesture and best_confidence >= self.min_confidence * 0.35:
                self.ema_confidence = (self.ema_alpha * best_confidence +
                                       (1 - self.ema_alpha) * self.ema_confidence)
                self.confirmed_confidence = self.ema_confidence
                self.hold_count += 1
            elif self.no_gesture_count > self.hold_threshold:
                self.gesture_history.append({
                    'gesture': self.confirmed_gesture,
                    'confidence': self.confirmed_confidence,
                    'duration': timestamp - (self.gesture_start_time or timestamp),
                    'sequence_idx': len(self.sequence_buffer) - 1
                })
                self.state = GestureState.IDLE
                self.consecutive_count = 0
                self.hold_count = 0
                logger.debug(f"[时序] HOLDING->IDLE: 手势超时释放 ({self.confirmed_gesture})")
            # 优化：切换手势需要更高的置信度和稳定性，避免误切换
            elif best_gesture != self.confirmed_gesture and best_confidence >= self.min_confidence * 1.2:
                self.gesture_history.append({
                    'gesture': self.confirmed_gesture,
                    'confidence': self.confirmed_confidence,
                    'duration': timestamp - (self.gesture_start_time or timestamp),
                    'sequence_idx': len(self.sequence_buffer) - 1
                })
                self.state = GestureState.DETECTING
                self.consecutive_count = 1
                self.gesture_start_time = timestamp
                self.ema_confidence = best_confidence
                logger.debug(f"[时序] HOLDING->DETECTING: 切换到新手势 {best_gesture}")

        return {
            'gesture': self.confirmed_gesture if self.state in [GestureState.CONFIRMED, GestureState.HOLDING] else None,
            'confidence': self.confirmed_confidence if self.state in [GestureState.CONFIRMED, GestureState.HOLDING] else 0.0,
            'raw_gesture': best_gesture,
            'raw_confidence': best_confidence,
            'state': self.state.value,
            'is_new_gesture': is_new_gesture,
            'stability': stability,
            'sequence': list(self.sequence_buffer),
            'consecutive_count': self.consecutive_count,
            'hold_count': self.hold_count
        }

    def _weighted_voting(self):
        """时间加权投票算法"""
        if len(self.frame_buffer) < 3:
            if len(self.frame_buffer) > 0 and self.frame_buffer[-1]['gesture'] is not None:
                return {
                    'gesture': self.frame_buffer[-1]['gesture'],
                    'confidence': self.frame_buffer[-1]['confidence'],
                    'stability': 0.3
                }
            return None

        now = time.time() * 1000
        recent_frames = [f for f in self.frame_buffer if now - f['timestamp'] < 2000]

        if len(recent_frames) < 1:
            return None

        vote_map = {}
        total_weight = 0

        for i, frame in enumerate(recent_frames):
            g = frame['gesture']
            c = frame['confidence']
            if g is None:
                continue

            age_factor = max(0.2, 1.0 - (now - frame['timestamp']) / 2500)
            recency_bonus = (i + 1) / max(len(recent_frames), 1)
            weight = age_factor * (0.5 + 0.5 * recency_bonus)

            if g not in vote_map:
                vote_map[g] = {'score': 0, 'count': 0, 'conf_sum': 0}

            vote_map[g]['score'] += c * weight
            vote_map[g]['count'] += 1
            vote_map[g]['conf_sum'] += c
            total_weight += weight

        if not vote_map:
            return None

        best_gesture = None
        best_score = 0

        for g, data in vote_map.items():
            consistency = data['count'] / max(len(recent_frames), 1)
            final_score = data['score'] * (0.5 + 0.5 * consistency)

            if final_score > best_score:
                best_score = final_score
                best_gesture = g

        if best_gesture is None:
            return None

        avg_conf = vote_map[best_gesture]['conf_sum'] / vote_map[best_gesture]['count']
        stability = vote_map[best_gesture]['count'] / max(len(recent_frames), 1)

        return {
            'gesture': best_gesture,
            'confidence': avg_conf,
            'stability': min(stability, 1.0)
        }


sessions = {}


def get_or_create_session(session_id):
    if session_id not in sessions:
        sessions[session_id] = TemporalRecognitionEngine(
            window_size=20,          # 增加窗口大小，提高投票稳定性
            confirm_frames=4,        # 增加确认帧数，减少误识别
            hold_threshold=10,       # 增加保持阈值，延长手势持续时间
            min_confidence=0.30,     # 保持较低阈值以检测更多手势
            ema_alpha=0.3,           # 降低EMA平滑系数，使置信度更稳定
            no_gesture_timeout=1200  # 增加超时时间，减少手势切换频率
        )
    return sessions[session_id]


@app.route('/health', methods=['GET'])
def health():
    """健康检查接口 - 返回所有识别引擎状态"""
    return jsonify({
        "status": "healthy",
        "timestamp": time.time(),
        "yolo_loaded": yolo_model is not None,
        "yolo_seq_loaded": yolo_seq_recognizer is not None,
        "classes": len(CLASS_NAMES),
        "engine": "yolo_sequence_lstm" if yolo_seq_recognizer else "yolo_v1"
    })


# ========== YOLO 单帧识别 API ==========
# ========== YOLO 序列 LSTM 识别 API（77.88% 准确率）==========
@app.route('/recognize_yolo_seq', methods=['POST'])
def recognize_yolo_seq():
    """
    基于 YOLO 概率序列的 LSTM 手势识别 API
    
    使用新训练的 context_lstm 模型（77.88% 验证准确率）
    流程：YOLO 检测 → 累积 30 帧 → LSTM 识别 → 返回结果
    """
    rid = str(int(time.time() * 1000))[-6:]
    
    try:
        data = request.json
        if not data:
            return jsonify({"detected": False, "error": "No body", "message": "请求体为空"}), 200
        
        image_data = data.get('image')
        if not image_data:
            return jsonify({"detected": False, "error": "No image", "message": "请提供图片"}), 200
        
        # 解码图像
        try:
            if ',' in image_data:
                image_data = image_data.split(',')[1]
            image_bytes = base64.b64decode(image_data)
            nparr = np.frombuffer(image_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if frame is None:
                return jsonify({"detected": False, "error": "Decode failed", "message": "图片解码失败"}), 200
        except Exception as e:
            return jsonify({"detected": False, "error": str(e), "message": "图片解码异常"}), 200
        
        # 检查识别器
        if yolo_seq_recognizer is None:
            return jsonify({
                "detected": False,
                "error": "YOLO sequence recognizer not loaded",
                "message": "YOLO序列LSTM识别器未加载，请使用/recognize端点"
            }), 200
        
        # 调整图像大小
        h, w = frame.shape[:2]
        if max(h, w) > 640:
            scale = 640 / max(h, w)
            frame = cv2.resize(frame, (int(w * scale), int(h * scale)))
        
        # 使用 YOLO 序列识别器处理
        result = yolo_seq_recognizer.process_frame(frame)
        
        # 获取统计
        stats = yolo_seq_recognizer.get_stats()
        
        # 构建响应
        response = {
            "detected": result['gesture'] is not None,
            "current_gesture": result['gesture'],
            "confidence": round(result['confidence'], 4),
            "state": result['state'],
            "is_new_gesture": result['is_new_gesture'],
            "sequence_length": result['sequence_length'],
            "seq_required": 30,
            "inference_time_ms": round(result['inference_time'], 2),
            "fps": round(stats['fps'], 1),
            "engine": "yolo_sequence_lstm",
            "accuracy": "77.88%",
            "message": f"识别成功: {result['gesture']}" if result['gesture'] else f"收集中... ({result['sequence_length']}/30)"
        }
        
        logger.info(f"[{rid}] YOLO序列LSTM识别: {result['gesture']} ({result['confidence']:.2f}), "
                   f"序列: {result['sequence_length']}/30, "
                   f"耗时: {result['inference_time']:.1f}ms")
        
        return jsonify(response), 200
        
    except Exception as e:
        logger.error(f"[{rid}] YOLO序列LSTM识别异常: {e}")
        traceback.print_exc()
        return jsonify({
            "detected": False,
            "error": str(e),
            "message": "YOLO序列LSTM识别服务异常"
        }), 200


@app.route('/recognize_yolo_seq/reset', methods=['POST'])
def reset_yolo_seq():
    """重置 YOLO 序列识别器状态"""
    try:
        if yolo_seq_recognizer:
            yolo_seq_recognizer.reset()
            return jsonify({"status": "success", "message": "YOLO序列LSTM识别器已重置"}), 200
        else:
            return jsonify({"status": "error", "message": "YOLO序列LSTM识别器未加载"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 200


@app.route('/recognize_yolo_seq/stats', methods=['GET'])
def get_yolo_seq_stats():
    """获取 YOLO 序列识别器性能统计"""
    if yolo_seq_recognizer is None:
        return jsonify({"error": "YOLO sequence recognizer not loaded"}), 200
    
    stats = yolo_seq_recognizer.get_stats()
    return jsonify({
        "status": "success",
        "stats": stats,
        "seq_length": yolo_seq_recognizer.seq_length,
        "num_classes": 35,
        "accuracy": "77.88%"
    }), 200


@app.route('/recognize', methods=['POST'])
def recognize():
    rid = str(int(time.time() * 1000))[-6:]

    try:
        data = request.json
        if not data:
            return jsonify({"detected": False, "error": "No body", "message": "请求体为空"}), 200

        image_data = data.get('image')
        session_id = data.get('session_id', 'default')

        if not image_data:
            return jsonify({"detected": False, "error": "No image", "message": "请提供图片"}), 200

        try:
            if ',' in image_data:
                image_data = image_data.split(',')[1]

            image_bytes = base64.b64decode(image_data)
            nparr = np.frombuffer(image_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if frame is None:
                return jsonify({"detected": False, "error": "Decode failed", "message": "图片解码失败"}), 200
        except Exception as e:
            return jsonify({"detected": False, "error": str(e), "message": "图片解码异常"}), 200

        if yolo_model is None:
            return jsonify({"detected": False, "error": "Model not loaded", "message": "模型未加载"}), 200

        h, w = frame.shape[:2]
        
        # 优化：强制缩小到 480x480 以平衡速度和准确率
        if max(h, w) > 480:
            scale = 480 / max(h, w)
            frame = cv2.resize(frame, (int(w * scale), int(h * scale)))

        gesture = None
        confidence = 0.0

        try:
            # YOLO 参数：imgsz=480 提高识别准确率
            results = yolo_model(frame, conf=0.25, verbose=False, max_det=3, imgsz=480)

            if results and len(results) > 0:
                result = results[0]
                if result.boxes is not None and len(result.boxes) > 0:
                    boxes = result.boxes
                    confs = boxes.conf.cpu().numpy()
                    cls_ids = boxes.cls.cpu().numpy().astype(int)
                    
                    if len(confs) > 0:
                        max_idx = np.argmax(confs)
                        raw_conf = float(confs[max_idx])
                        raw_gesture = CLASS_NAMES[cls_ids[max_idx]]

                        if raw_conf >= 0.25:
                            gesture = raw_gesture
                            confidence = raw_conf
                        else:
                            gesture = raw_gesture
                            confidence = raw_conf
        except Exception as e:
            logger.error(f"[{rid}] YOLO推理异常: {e}")
            import traceback
            traceback.print_exc()
            gesture = None
            confidence = 0.0

        engine = get_or_create_session(session_id)
        
        # 上传识别直接使用YOLO结果，不经过时序处理
        # 因为上传的是单张图片，时序引擎需要多帧才能确认
        if session_id.startswith('upload_'):
            # 上传识别：直接返回YOLO原始结果
            temporal_result = {
                'gesture': gesture if confidence >= 0.35 else None,
                'confidence': confidence if confidence >= 0.35 else 0.0,
                'state': 'confirmed' if confidence >= 0.35 else 'idle',
                'raw_gesture': gesture,
                'raw_confidence': confidence,
                'is_new_gesture': True,
                'stability': 1.0 if confidence >= 0.35 else 0.0,
                'sequence': [gesture] if confidence >= 0.35 else []
            }
            logger.info(f"[{rid}] 上传识别: {gesture} ({confidence:.2f})")
        else:
            # 实时识别：使用时序引擎
            temporal_result = engine.process_frame(gesture, confidence)

        conf_value = temporal_result['confidence'] if temporal_result['confidence'] else 0
        logger.info(f"[{rid}] 时序结果: gesture={temporal_result['gesture']}, "
                    f"raw={temporal_result.get('raw_gesture')}, "
                    f"state={temporal_result['state']}, "
                    f"conf={conf_value:.2f}")

        quick_translation = ""
        seq = temporal_result.get('sequence', [])
        if seq:
            if local_llm_translator and local_llm_translator.is_available():
                quick_translation = local_llm_translator.translate(seq)
            elif rule_translator:
                quick_translation = rule_translator.translate(seq)
            else:
                quick_translation = " ".join(seq)

        response = {
            "detected": temporal_result['gesture'] is not None,
            "current_gesture": temporal_result['gesture'],
            "confidence": temporal_result['confidence'],
            "raw_gesture": temporal_result.get('raw_gesture'),
            "raw_confidence": temporal_result.get('raw_confidence', 0),
            "gesture_sequence": seq,
            "quick_translation": quick_translation,
            "buffer_size": len(seq),
            "state": temporal_result['state'],
            "is_new_gesture": temporal_result['is_new_gesture'],
            "stability": round(temporal_result.get('stability', 0), 3),
            "message": f"识别成功: {temporal_result['gesture']}" if temporal_result['gesture'] else "未检测到手语手势"
        }

        return jsonify(response), 200

    except Exception as e:
        logger.error(f"[{rid}] 识别接口异常: {e}")
        traceback.print_exc()
        return jsonify({
            "detected": False,
            "error": str(e),
            "message": "识别服务异常"
        }), 200


@app.route('/class_names', methods=['GET'])
def get_class_names():
    return jsonify({"class_names": CLASS_NAMES, "count": len(CLASS_NAMES)})


@app.route('/session/<session_id>/clear', methods=['POST'])
def clear_session(session_id):
    if session_id in sessions:
        sessions[session_id].reset()
    return jsonify({"status": "cleared"})


@app.route('/translate/llm', methods=['POST'])
def translate_llm():
    try:
        data = request.json
        session_id = data.get('session_id', 'default')

        if session_id not in sessions:
            return jsonify({"success": False, "error": "Session not found", "translation": "暂无手势记录"}), 200

        session = sessions[session_id]
        gesture_list = list(session.sequence_buffer)

        if not gesture_list:
            return jsonify({"success": False, "error": "No gestures", "translation": "请先进行手语识别"}), 200

        translation = ""
        optimized = False
        translator_used = "none"
        
        # 优先级调整：云端翻译优先，本地优化作为降级方案
        # 1. 优先使用 Sophnet 云端翻译（更准确的语句顺序）
        if sophnet_translator and sophnet_translator.is_available():
            translation = sophnet_translator.translate(gesture_list)
            translator_used = "sophnet"
            logger.info(f"使用 Sophnet 云端翻译: {gesture_list} -> {translation}")
        
        # 2. 如果云端翻译失败，尝试本地 LLM
        if not translation and local_llm_translator and local_llm_translator.is_available():
            translation = local_llm_translator.translate(gesture_list)
            translator_used = "local_llm"
            logger.info(f"使用本地 LLM 翻译: {gesture_list} -> {translation}")
        
        # 3. 如果LLM都失败，使用句子优化器（本地规则优化）
        if not translation and sentence_optimizer:
            translation = sentence_optimizer.optimize(gesture_list)
            optimized = True
            translator_used = "sentence_optimizer"
            logger.info(f"使用句子优化器: {gesture_list} -> {translation}")
        
        # 4. 最后降级到规则翻译器
        if not translation and rule_translator:
            translation = rule_translator.translate(gesture_list)
            translator_used = "rule"
            logger.info(f"使用规则翻译: {gesture_list} -> {translation}")
        
        # 5. 如果所有翻译器都失败，使用简单拼接
        if not translation:
            translation = "，".join(gesture_list)
            translator_used = "fallback"
            logger.warning(f"所有翻译器失败，使用简单拼接: {gesture_list}")

        return jsonify({
            "success": True,
            "translation": translation,
            "optimized": optimized,
            "translator": translator_used,
            "gesture_sequence": gesture_list,
            "history": session.gesture_history[-10:] if session.gesture_history else []
        }), 200

    except Exception as e:
        logger.error(f"LLM翻译异常: {e}")
        return jsonify({"success": False, "error": str(e), "translation": "翻译失败"}), 200


@app.route('/llm/status', methods=['GET'])
def llm_status():
    local_llm_available = local_llm_translator is not None and local_llm_translator.is_available()
    sophnet_available = sophnet_translator is not None and sophnet_translator.is_available()

    if sophnet_available:
        status_msg = "Sophnet 已启用"
        translator = "sophnet"
    elif local_llm_available:
        status_msg = "LLM 已启用"
        translator = "local_llm"
    elif rule_translator:
        status_msg = "规则模式"
        translator = "rule"
    else:
        status_msg = "未启用"
        translator = "none"

    return jsonify({
        "available": sophnet_available or local_llm_available,
        "sophnet_available": sophnet_available,
        "local_llm_available": local_llm_available,
        "message": status_msg,
        "translator": translator
    }), 200


@app.route('/chat', methods=['POST'])
def chat():
    """
    AI对话接口 - 使用 DeepSeek 提供智能对话
    """
    rid = str(int(time.time() * 1000))[-6:]
    logger.info(f"[{rid}] 收到AI对话请求")

    try:
        data = request.json
        message = data.get('message', '').strip()

        if not message:
            return jsonify({
                "success": False,
                "response": "请输入您的问题"
            }), 200

        logger.info(f"[{rid}] 用户问题: {message[:50]}...")

        # 优先级：Sophnet > Local LLM > 备用回复
        if sophnet_translator and sophnet_translator.is_available():
            response_text = sophnet_translator.chat(message)
            logger.info(f"[{rid}] Sophnet 回复成功")
        elif local_llm_translator and local_llm_translator.is_available():
            system_prompt = """你是一个智能助手。请直接回答用户的问题，不要添加额外内容。

回答要求：
1. 直接回答问题，简洁明了
2. 如果问题与手语相关，提供专业解答
3. 如果问题与手语无关，正常回答即可
4. 回答完毕后立即结束，不要继续说其他内容"""
            response_text = local_llm_translator.chat_with_system(system_prompt, message)
            logger.info(f"[{rid}] LLM回复成功")
        else:
            response_text = get_fallback_response(message)
            logger.info(f"[{rid}] 使用备用回复")

        return jsonify({
            "success": True,
            "response": response_text
        }), 200

    except Exception as e:
        logger.error(f"[{rid}] AI对话异常: {e}")
        traceback.print_exc()
        return jsonify({
            "success": False,
            "response": "抱歉，AI助手暂时无法响应，请稍后再试。"
        }), 200


# ========== 文本转手语API（借鉴SignTranslate-main算法）==========
IMAGE_BASE_PATH = os.path.join(os.path.dirname(__file__), '..', '35', 'train')
VIDEO_BASE_PATH = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'data', 'gesture_videos')

# 构建手势名称到图片路径的映射
GESTURE_IMAGE_MAP = {}
if os.path.exists(IMAGE_BASE_PATH):
    for filename in os.listdir(IMAGE_BASE_PATH):
        if filename.endswith('.jpg'):
            # 文件名格式: ID-手势名.jpg (如 18-你:您:你的.jpg)
            name_part = filename.replace('.jpg', '')
            if '-' in name_part:
                gesture_name = name_part.split('-', 1)[1]
                # 将文件名中的 : 转换为 / 以匹配CLASS_NAMES格式
                normalized_name = gesture_name.replace(':', '/')
                GESTURE_IMAGE_MAP[normalized_name] = os.path.join(IMAGE_BASE_PATH, filename)
                # 同时保留原始格式作为别名
                GESTURE_IMAGE_MAP[gesture_name] = os.path.join(IMAGE_BASE_PATH, filename)
    logger.info(f"加载了 {len(GESTURE_IMAGE_MAP)} 个手势图片")
    logger.info(f"手势图片映射: {list(GESTURE_IMAGE_MAP.keys())}")


def tokenize_chinese_text(text):
    """
    中文分词 - 借鉴SignTranslate-main的jieba分词算法
    将句子拆分为词语或短语，保留标点符号
    额外：对未匹配的词进行逐字拆分
    """
    tokens = []
    for fragment in re.split(r'([，。！？；,.!?;])', text):
        if fragment and fragment in '，。！？；,.!?;':
            tokens.append(fragment)
        elif fragment:
            tokens.extend(jieba.lcut(fragment))
    return [token for token in tokens if token.strip()]


def match_gesture_to_word(word):
    """
    将分词后的词语匹配到手语词汇库
    返回最匹配的手语词汇名称
    """
    word = word.strip()
    
    if not word:
        return None
    
    # 标点符号过滤
    if word in '，。！？；,.!?;':
        return None
    
    # 1. 直接精确匹配 CLASS_NAMES
    if word in CLASS_NAMES:
        return word
    
    # 2. 直接精确匹配图片名
    if word in GESTURE_IMAGE_MAP:
        return word
    
    # 3. 按 / 或 : 拆分后精确匹配（避免模糊匹配导致的错误）
    # 例如 word="你" 应该匹配到 "你/您/你的/这" 或 "你:您:你的"
    for cn in CLASS_NAMES:
        aliases = cn.split('/')
        for alias in aliases:
            alias = alias.strip()
            if word == alias:
                return cn
    
    for img_name, img_path in GESTURE_IMAGE_MAP.items():
        parts = img_name.replace(':', '/').split('/')
        for part in parts:
            if word == part.strip():
                return img_name
    
    # 4. 如果词长度>1，说明是多字词未匹配，返回None让上层逐字拆分
    # 不再使用模糊匹配，避免 "我爱你" 匹配到 "你/您/你的/这" 这种错误
    return None


def split_unmatched_word(word):
    """
    对未匹配的词进行智能拆分，尝试匹配
    策略：
    1. 先尝试匹配整个词
    2. 在剩余字符串中查找任意位置的子串匹配（如"祝你快乐"中的"快乐"）
    3. 最后逐字拆分
    """
    result = []
    remaining = word
    
    while remaining:
        matched = False
        
        # 策略1：尝试从长到短匹配前缀
        for length in range(len(remaining), 0, -1):
            substr = remaining[:length]
            gesture = match_gesture_to_word(substr)
            if gesture:
                result.append(gesture)
                remaining = remaining[length:]
                matched = True
                break
        
        # 策略2：如果前缀没匹配到，在剩余字符串中查找任意位置的子串
        if not matched:
            found = False
            # 从长到短尝试所有可能的子串
            for length in range(len(remaining), 1, -1):
                for start in range(len(remaining) - length + 1):
                    substr = remaining[start:start + length]
                    gesture = match_gesture_to_word(substr)
                    if gesture:
                        # 添加子串前的未匹配字符（逐字）
                        for char in remaining[:start]:
                            single = match_gesture_to_word(char)
                            if single:
                                result.append(single)
                        result.append(gesture)
                        remaining = remaining[start + length:]
                        found = True
                        break
                if found:
                    matched = True
                    break
            
            # 策略3：如果还是没匹配到，跳过第一个字符
            if not matched:
                remaining = remaining[1:]
    
    return result


def get_image_path_for_gesture(gesture_name):
    """
    获取手势对应的图片文件路径
    gesture_name 可能是 CLASS_NAMES 格式（如 "你/您/你的/这"）
    也可能是图片名格式（如 "你:您:你的"）
    也可能是单个字（如 "你"）
    """
    # 1. 直接匹配
    if gesture_name in GESTURE_IMAGE_MAP:
        return GESTURE_IMAGE_MAP[gesture_name]
    
    # 2. 将 gesture_name 按 / 拆分，取第一个别名去匹配图片
    # 例如 "你/您/你的/这" -> 用 "你" 去找图片
    first_alias = gesture_name.split('/')[0].strip()
    if first_alias:
        # 直接匹配图片名
        if first_alias in GESTURE_IMAGE_MAP:
            return GESTURE_IMAGE_MAP[first_alias]
        # 遍历图片映射查找
        for img_name, img_path in GESTURE_IMAGE_MAP.items():
            parts = img_name.replace(':', '/').split('/')
            for part in parts:
                if first_alias == part.strip():
                    return img_path
    
    # 3. 尝试将 / 替换为 : 再匹配
    normalized = gesture_name.replace('/', ':')
    if normalized in GESTURE_IMAGE_MAP:
        return GESTURE_IMAGE_MAP[normalized]
    
    return None


def convert_mp4_to_h264(input_path, output_path):
    """将 MP4 转换为 H.264 格式"""
    cmd = ['ffmpeg', '-y', '-i', input_path, '-vcodec', 'libx264', '-pix_fmt', 'yuv420p', '-an', output_path]
    try:
        result = subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        logger.info(f'FFmpeg 转码成功：{output_path}')
        # 删除临时文件
        if os.path.exists(input_path):
            os.remove(input_path)
    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        logger.error(f'FFmpeg 转码失败：{e}')
        # 如果转码失败，使用原始文件
        if os.path.exists(output_path):
            os.remove(output_path)
        os.rename(input_path, output_path)


def create_sign_language_video(gesture_sequence):
    """创建手语动画视频（参考 SignTranslate-main 的实现）"""
    try:
        # 输出目录
        output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'output')
        os.makedirs(output_dir, exist_ok=True)
        
        # 收集图片路径（使用已有的 GESTURE_IMAGE_MAP）
        image_paths = []
        for gesture_name in gesture_sequence:
            # 使用 get_image_path_for_gesture 函数查找图片
            image_path = get_image_path_for_gesture(gesture_name)
            if image_path and os.path.exists(image_path):
                image_paths.append(image_path)
                logger.info(f'找到手势图片：{gesture_name} -> {image_path}')
            else:
                logger.warning(f'手势图片不存在：{gesture_name}')
        
        if not image_paths:
            logger.error('没有找到任何有效的手势图片')
            return None
        
        # 视频参数
        width, height = 640, 480
        fps = 30
        duration_per_gesture = 2.0  # 每个手势停留 2 秒
        transition_frames = int(fps * 0.2)  # 过渡帧（0.2秒黑屏）
        
        # 生成时间戳
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        temp_video_path = os.path.join(output_dir, f"temp_sign_video_{timestamp}.mp4")
        
        # 创建视频写入器
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(temp_video_path, fourcc, fps, (width, height))
        
        black_frame = np.zeros((height, width, 3), dtype=np.uint8)
        
        # 逐帧写入视频
        for image_path in image_paths:
            try:
                img = cv2.imread(image_path)
                if img is None:
                    logger.error(f'无法读取图片：{image_path}')
                    # 写入黑屏
                    for _ in range(int(fps * duration_per_gesture)):
                        out.write(black_frame)
                    continue
                
                # 调整图片大小
                resized_img = cv2.resize(img, (width, height))
                
                # 写入手势帧
                for _ in range(int(fps * duration_per_gesture)):
                    out.write(resized_img)
                
                # 写入过渡黑屏
                for _ in range(transition_frames):
                    out.write(black_frame)
                
            except Exception as e:
                logger.error(f'处理图片 {image_path} 时出错：{e}')
                for _ in range(int(fps * duration_per_gesture)):
                    out.write(black_frame)
        
        out.release()
        
        # 检查视频文件
        if not os.path.exists(temp_video_path) or os.path.getsize(temp_video_path) == 0:
            logger.error('视频文件为空')
            return None
        
        # 转换为 H.264 格式（更好的浏览器兼容性）
        final_video_path = temp_video_path.replace('.mp4', '_h264.mp4')
        convert_mp4_to_h264(temp_video_path, final_video_path)
        
        return final_video_path
    
    except Exception as e:
        logger.error(f'创建手语视频失败：{e}')
        traceback.print_exc()
        return None


@app.route('/text_to_sign', methods=['POST'])
def text_to_sign():
    """
    文本转手语API
    借鉴SignTranslate-main的算法：
    1. 使用jieba进行中文分词
    2. 匹配手语词汇库
    3. 合成手语视频
    
    请求参数:
    - text: 要翻译的文本
    - generate_video: 是否生成视频（默认true）
    
    返回:
    - gesture_sequence: 手势序列
    - video_url: 视频URL（如果生成视频）
    - matched_words: 匹配到的词汇
    - unmatched_words: 未匹配到的词汇
    """
    rid = str(int(time.time() * 1000))[-6:]
    logger.info(f"[{rid}] 收到文本转手语请求")
    
    try:
        data = request.json
        text = data.get('text', '').strip()
        generate_video = data.get('generate_video', True)
        
        if not text:
            return jsonify({
                "success": False,
                "error": "请输入要翻译的文本"
            }), 200
        
        logger.info(f"[{rid}] 待翻译文本: {text}")
        
        # 1. 中文分词
        words = tokenize_chinese_text(text)
        logger.info(f"[{rid}] 分词结果: {words}")
        
        # 2. 匹配手语词汇
        gesture_sequence = []
        matched_words = []
        unmatched_words = []
        
        for word in words:
            matched_gesture = match_gesture_to_word(word)
            if matched_gesture:
                gesture_sequence.append(matched_gesture)
                matched_words.append(word)
            elif word not in '，。！？；,.!?;':
                # 逐字拆分尝试匹配
                logger.info(f"[{rid}] '{word}' 未直接匹配，尝试逐字拆分")
                char_matches = split_unmatched_word(word)
                if char_matches:
                    gesture_sequence.extend(char_matches)
                    matched_words.extend(char_matches)
                    logger.info(f"[{rid}] 逐字匹配成功: {char_matches}")
                else:
                    unmatched_words.append(word)
                    logger.info(f"[{rid}] 逐字匹配也失败: {word}")
        
        logger.info(f"[{rid}] 匹配到手势: {gesture_sequence}")
        logger.info(f"[{rid}] 未匹配词汇: {unmatched_words}")
        logger.info(f"[{rid}] 图片映射数量: {len(GESTURE_IMAGE_MAP)}")
        logger.info(f"[{rid}] 图片映射内容: {list(GESTURE_IMAGE_MAP.keys())}")
        
        if not gesture_sequence:
            return jsonify({
                "success": False,
                "error": "无法识别的手语词汇",
                "unmatched_words": unmatched_words
            }), 200
        
        result = {
            "success": True,
            "gesture_sequence": gesture_sequence,
            "matched_words": matched_words,
            "unmatched_words": unmatched_words,
            "original_text": text
        }
        
        # 3. 生成视频（可选）
        if generate_video:
            video_path = create_sign_language_video(gesture_sequence)
            if video_path:
                # 返回视频URL供前端访问
                video_filename = os.path.basename(video_path)
                result["video_url"] = f"/sign_video/{video_filename}"
                result["video_generated"] = True
            else:
                result["video_generated"] = False
                result["video_error"] = "视频生成失败"
        
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"[{rid}] 文本转手语异常: {e}")
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e)
        }), 200


@app.route('/data/output/<path:filename>', methods=['GET'])
def serve_generated_video(filename):
    """
    提供生成的手语视频文件
    """
    output_dir = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'data', 'output')
    return send_from_directory(output_dir, filename)


def get_fallback_response(message):
    """
    当LLM不可用时，提供基于规则的备用回复
    """
    message_lower = message.lower()

    if '发展史' in message or '历史' in message or '起源' in message:
        return """手语的发展历史非常悠久：

📜 **古代时期**
- 手语自古就存在于聋哑人社区中
- 古希腊、古罗马文献中就有关于手语的记载

📚 **近代发展**
- 1760年：法国的德雷佩神父建立了第一所聋哑学校，奠定了现代手语教育的基础
- 1817年：美国建立了第一所聋哑学校，美国手语(ASL)开始形成

🌍 **现代**
- 1960年代：威廉·斯托科证明手语是完整的自然语言，具有自己的语法结构
- 现在：全球有超过300种不同的手语，每种都是独立的语言

中国手语(CSL)也有自己独特的语法和词汇体系，与汉语口语有所不同。"""

    elif '怎么学' in message or '如何学' in message or '学习' in message:
        return """学习手语的建议：

1️⃣ **基础入门**
- 从基本字母和数字的手势开始
- 学习常用词汇（如：你好、谢谢、我爱你等）

2️⃣ **练习方法**
- 每天坚持练习15-30分钟
- 对着镜子练习，观察自己的手势是否标准
- 录制视频对比纠正

3️⃣ **进阶提升**
- 多看手语视频教程
- 参加手语社团或课程
- 与聋哑朋友交流实践

4️⃣ **注意事项**
- 手语不仅是手势，还包括面部表情和身体动作
- 不同地区的手语可能有差异
- 保持耐心，语言学习需要时间积累💪"""

    elif '语法' in message or '特点' in message or '区别' in message:
        return """手语的主要特点：

🔤 **语法结构**
- 手语的语序与口语不同，通常采用「话题-评论」结构
- 例如：「你 名字 什么？」而不是「你叫什么名字？」
- 时间词通常放在句首或句末

✋ **表达方式**
- 手势是主要表达方式
- 面部表情非常重要（如疑问时需要配合疑问表情）
- 身体姿态和空间位置也传递信息

🌏 **地域差异**
- 中国手语(CSL)南北存在差异
- 各国手语互不相通（如ASL、BSL、JSL等）
- 就像口语一样，手语也有方言现象

手语是真正的自然语言，具有完整的语音（手形）、词汇、语法系统！"""

    else:
        return f"""我收到了您的问题：「{message}」

我是手语AI助手，目前LLM服务未完全启用。您可以问我：
- 手语的发展历史
- 如何学习手语
- 手语的语法特点
- 各国手语的区别
- 聋哑人社区的相关知识

另外，开启摄像头后我可以帮您识别和翻译手势！"""


# ========== 用户认证API ==========
# 简单的内存用户存储（生产环境应使用数据库）
users = {}
active_sessions = {}

@app.route('/api/register', methods=['POST'])
def register():
    """用户注册 - 同步到Java后端MySQL数据库"""
    try:
        data = request.json
        username = data.get('username', '').strip()
        email = data.get('email', '').strip()
        password = data.get('password', '')

        if not username or not password:
            return jsonify({"success": False, "message": "用户名和密码不能为空"}), 200

        # 调用Java后端API，将用户写入MySQL数据库
        try:
            java_backend_url = 'http://localhost:8080/api/register'
            response = requests.post(
                java_backend_url,
                json={"username": username, "email": email, "password": password},
                timeout=5,
                proxies=NO_PROXY
            )
            java_result = response.json()
            
            if java_result.get('success'):
                # Java后端注册成功，同时更新内存缓存
                users[username] = {
                    "username": username,
                    "email": email or username,
                    "password": password
                }
                logger.info(f"用户注册成功(已写入MySQL): {username}")
                return jsonify({"success": True, "message": "注册成功"}), 200
            else:
                # Java后端返回失败（如用户名已存在）
                error_msg = java_result.get('message', '注册失败')
                logger.warning(f"用户注册失败: {username} - {error_msg}")
                return jsonify({"success": False, "message": error_msg}), 200
        except requests.exceptions.RequestException as e:
            # Java后端不可用时，降级为内存存储
            logger.error(f"无法连接到Java后端，使用内存存储: {e}")
            if username in users:
                return jsonify({"success": False, "message": "用户名已存在"}), 200
            
            users[username] = {
                "username": username,
                "email": email or username,
                "password": password
            }
            logger.info(f"用户注册成功(仅内存存储): {username}")
            return jsonify({"success": True, "message": "注册成功(注意：服务重启后数据会丢失)"}), 200

    except Exception as e:
        logger.error(f"注册异常: {e}")
        return jsonify({"success": False, "message": "注册失败"}), 200


@app.route('/api/login', methods=['POST'])
def login():
    """用户登录 - 调用Java后端验证数据库中的用户"""
    try:
        data = request.json
        username = data.get('username', '').strip()
        password = data.get('password', '')

        if not username or not password:
            return jsonify({"success": False, "message": "用户名和密码不能为空"}), 200

        # 调用Java后端验证用户
        try:
            java_backend_url = 'http://localhost:8080/api/login'
            response = requests.post(
                java_backend_url,
                json={"username": username, "password": password},
                timeout=5,
                proxies=NO_PROXY
            )
            java_result = response.json()
            
            if java_result.get('success'):
                # Java后端验证成功，同步到内存缓存
                users[username] = {
                    "username": username,
                    "email": java_result.get('email', f"{username}@example.com"),
                    "password": password
                }
                
                # 创建session
                session_id = f"sess_{int(time.time() * 1000)}"
                active_sessions[session_id] = {
                    "username": username,
                    "email": java_result.get('email', f"{username}@example.com"),
                    "login_time": time.time()
                }

                response = jsonify({
                    "success": True,
                    "message": "登录成功",
                    "username": username,
                    "email": java_result.get('email', f"{username}@example.com")
                })
                response.set_cookie('session_id', session_id, httponly=True, samesite='Lax')
                logger.info(f"用户登录成功: {username}")
                return response, 200
            else:
                error_msg = java_result.get('message', '用户名或密码错误')
                return jsonify({"success": False, "message": error_msg}), 200
        except requests.exceptions.RequestException as e:
            logger.error(f"无法连接到Java后端: {e}")
            return jsonify({"success": False, "message": "无法连接到认证服务，请稍后重试"}), 200

    except Exception as e:
        logger.error(f"登录异常: {e}")
        return jsonify({"success": False, "message": "登录失败"}), 200


@app.route('/api/logout', methods=['POST'])
def logout():
    """用户退出登录"""
    try:
        session_id = request.cookies.get('session_id')
        if session_id and session_id in active_sessions:
            del active_sessions[session_id]
            logger.info(f"用户退出登录: {session_id}")

        response = jsonify({"success": True, "message": "退出成功"})
        response.delete_cookie('session_id')
        return response, 200

    except Exception as e:
        logger.error(f"退出异常: {e}")
        return jsonify({"success": False, "message": "退出失败"}), 200


@app.route('/api/check', methods=['GET'])
def check_auth():
    """检查用户登录状态"""
    try:
        session_id = request.cookies.get('session_id')

        if session_id and session_id in active_sessions:
            session = active_sessions[session_id]
            return jsonify({
                "loggedIn": True,
                "username": session["username"],
                "email": session["email"]
            }), 200
        else:
            return jsonify({"loggedIn": False}), 200

    except Exception as e:
        logger.error(f"检查登录状态异常: {e}")
        return jsonify({"loggedIn": False}), 200


@app.route('/api/health', methods=['GET'])
def api_health():
    """API健康检查"""
    return jsonify({"status": "ok", "timestamp": time.time()}), 200


# ========== 提供35文件夹的静态图片 ==========
@app.route('/gesture_image/<path:filename>', methods=['GET'])
def get_gesture_image(filename):
    """提供 35 文件夹中的手势图片"""
    try:
        from urllib.parse import unquote
        
        # URL解码（处理中文文件名）
        decoded_filename = unquote(filename)
        
        # 图片目录
        image_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '35', 'train')
        
        # 安全性检查：防止路径遍历攻击
        safe_filename = os.path.basename(decoded_filename)
        file_path = os.path.join(image_dir, safe_filename)
        
        logger.info(f'请求图片：{safe_filename}，完整路径：{file_path}')
        
        if not os.path.exists(file_path):
            logger.error(f'图片文件不存在：{file_path}')
            # 列出目录中的文件帮助调试
            try:
                files = os.listdir(image_dir)
                logger.info(f'目录中的文件：{files[:10]}...')
            except:
                pass
            return jsonify({'success': False, 'message': f'图片不存在：{safe_filename}'}), 404
        
        # 返回图片文件
        return send_from_directory(image_dir, safe_filename, mimetype='image/jpeg')
    
    except Exception as e:
        logger.error(f'获取手势图片失败：{e}')
        return jsonify({'success': False, 'message': str(e)}), 500


# ========== 生成手语动画视频（参考 SignTranslate-main） ==========
@app.route('/generate_sign_video', methods=['POST'])
def generate_sign_video():
    """根据手势序列生成手语动画视频"""
    try:
        data = request.json
        gesture_sequence = data.get('gesture_sequence', [])
        
        if not gesture_sequence:
            return jsonify({'success': False, 'message': '手势序列为空'}), 400
        
        logger.info(f'生成手语视频，手势序列：{gesture_sequence}')
        
        # 生成视频
        video_path = create_sign_language_video(gesture_sequence)
        
        if video_path and os.path.exists(video_path):
            video_filename = os.path.basename(video_path)
            video_url = f'http://localhost:5001/sign_video/{video_filename}'
            logger.info(f'视频生成成功：{video_url}')
            return jsonify({
                'success': True,
                'video_url': video_url,
                'video_filename': video_filename
            })
        else:
            return jsonify({'success': False, 'message': '视频生成失败'}), 500
    
    except Exception as e:
        logger.error(f'生成手语视频失败：{e}')
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


# ========== 提供生成的视频文件 ==========
@app.route('/sign_video/<filename>', methods=['GET'])
def get_sign_video(filename):
    """提供生成的手语视频文件"""
    try:
        output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'output')
        safe_filename = os.path.basename(filename)
        file_path = os.path.join(output_dir, safe_filename)
        
        if not os.path.exists(file_path):
            return jsonify({'success': False, 'message': f'视频不存在：{safe_filename}'}), 404
        
        return send_from_directory(output_dir, safe_filename, mimetype='video/mp4')
    
    except Exception as e:
        logger.error(f'获取视频失败：{e}')
        return jsonify({'success': False, 'message': str(e)}), 500


# ========== WebSocket 会话管理 ==========
ws_sessions = {}  # 存储每个WebSocket连接的会话状态

class WSGestureSession:
    """WebSocket手势识别会话"""
    def __init__(self):
        self.gesture_sequence = []  # 累积的手势序列
        self.last_gesture_time = time.time()  # 上次识别到手势的时间
        self.last_sent_sentence = ""  # 上次发送的句子
        self.sentence_buffer = []  # 当前句子缓冲区
        self.pause_threshold = 2.0  # 停顿阈值（秒），超过此时间认为句子结束
        self.max_sequence_length = 50  # 最大序列长度
        
    def add_gesture(self, gesture, confidence):
        """添加识别到的手势"""
        if gesture and confidence > 0.5:  # 只添加高置信度的手势
            # 避免连续重复
            if not self.gesture_sequence or self.gesture_sequence[-1] != gesture:
                self.gesture_sequence.append(gesture)
                self.sentence_buffer.append(gesture)
                self.last_gesture_time = time.time()
                
                # 限制序列长度
                if len(self.gesture_sequence) > self.max_sequence_length:
                    self.gesture_sequence = self.gesture_sequence[-self.max_sequence_length:]
    
    def is_sentence_complete(self):
        """判断句子是否完成（基于停顿检测）"""
        if not self.sentence_buffer:
            return False
        return (time.time() - self.last_gesture_time) > self.pause_threshold
    
    def get_and_clear_sentence(self):
        """获取当前句子并清空缓冲区"""
        sentence = self.sentence_buffer.copy()
        self.sentence_buffer = []
        return sentence
    
    def reset(self):
        """重置会话"""
        self.gesture_sequence = []
        self.sentence_buffer = []
        self.last_sent_sentence = ""
        self.last_gesture_time = time.time()


# ========== WebSocket 实时识别支持 ==========
@socketio.on('connect')
def ws_connect():
    """WebSocket连接建立"""
    session_id = request.sid
    ws_sessions[session_id] = WSGestureSession()
    logger.info(f"✅ WebSocket客户端已连接: {session_id}")
    emit('status', {'connected': True, 'message': 'WebSocket连接成功，可以开始识别'})

@socketio.on('disconnect')
def ws_disconnect():
    """WebSocket连接断开"""
    session_id = request.sid
    if session_id in ws_sessions:
        del ws_sessions[session_id]
    logger.info(f"❌ WebSocket客户端断开: {session_id}")

@socketio.on('reset_session')
def reset_ws_session():
    """重置当前会话的手势序列"""
    session_id = request.sid
    if session_id in ws_sessions:
        ws_sessions[session_id].reset()
        emit('session_reset', {'message': '手势序列已重置'})
        logger.info(f"[WS] 会话已重置: {session_id}")

@socketio.on('video_frame')
def handle_video_frame(data):
    """
    处理前端发送的视频帧（Base64编码）
    
    流程：
    1. 解码图像
    2. 调用YOLO+LSTM识别器
    3. 累积手势序列
    4. 检测停顿，触发句子优化
    5. 返回识别结果和完整句子
    """
    try:
        start_time = time.time()
        session_id = request.sid
        
        # 获取或创建会话
        if session_id not in ws_sessions:
            ws_sessions[session_id] = WSGestureSession()
        session = ws_sessions[session_id]
        
        # 解码Base64图像
        if isinstance(data, str) and ',' in data:
            image_data = data.split(',')[1]
        elif isinstance(data, str):
            image_data = data
        else:
            emit('error', {'message': '无效的图像数据格式'})
            return
        
        # Base64解码
        image_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            emit('error', {'message': '图像解码失败'})
            return
        
        # 检查识别器是否可用
        if yolo_seq_recognizer is None:
            emit('recognition_result', {
                'detected': False,
                'gesture': None,
                'confidence': 0,
                'state': 'error',
                'message': 'YOLO序列LSTM识别器未加载'
            })
            return
        
        # 调整图像大小以提高性能
        h, w = frame.shape[:2]
        if max(h, w) > 640:
            scale = 640 / max(h, w)
            frame = cv2.resize(frame, (int(w * scale), int(h * scale)))
        
        # 使用YOLO序列LSTM识别器处理帧
        result = yolo_seq_recognizer.process_frame(frame)
        
        # 累积手势序列
        if result['gesture'] and result['state'] == 'ready':
            session.add_gesture(result['gesture'], result['confidence'])
        
        # 检测句子是否完成（停顿检测）
        complete_sentence = None
        optimized_sentence = None
        if session.is_sentence_complete() and session.sentence_buffer:
            # 获取手势序列
            gesture_list = session.get_and_clear_sentence()
            
            # 使用句子优化器生成通顺句子
            if sentence_optimizer and gesture_list:
                optimized_sentence = sentence_optimizer.optimize(gesture_list)
                complete_sentence = optimized_sentence
                logger.info(f"[WS] 句子完成: {gesture_list} -> {optimized_sentence}")
            elif gesture_list:
                complete_sentence = ' '.join(gesture_list)
                logger.info(f"[WS] 句子完成（未优化）: {complete_sentence}")
        
        # 计算推理时间
        inference_time = (time.time() - start_time) * 1000
        
        # 构建响应数据
        response_data = {
            'detected': result['gesture'] is not None,
            'gesture': result['gesture'],
            'confidence': round(result['confidence'], 4),
            'state': result['state'],
            'is_new_gesture': result['is_new_gesture'],
            'sequence_length': result['sequence_length'],
            'seq_required': 30,
            'inference_time_ms': round(inference_time, 2),
            'engine': 'yolo_sequence_lstm',
            'timestamp': time.time() * 1000,
            # 连续识别相关字段
            'gesture_sequence': session.gesture_sequence[-10:],  # 最近10个手势
            'sequence_count': len(session.gesture_sequence),
            'is_sentence_complete': complete_sentence is not None,
            'complete_sentence': complete_sentence,
            'optimized_sentence': optimized_sentence,
            'buffer_count': len(session.sentence_buffer)
        }
        
        # 根据状态生成消息
        if complete_sentence:
            response_data['message'] = f"完整句子: {complete_sentence}"
            logger.info(f"[WS] 句子识别完成: {complete_sentence}")
        elif result['gesture']:
            response_data['message'] = f"识别: {result['gesture']} ({result['confidence']:.2%})"
            logger.info(f"[WS] 手势识别: {result['gesture']} ({result['confidence']:.2%}), 序列: {len(session.gesture_sequence)}")
        else:
            response_data['message'] = f"收集中... ({result['sequence_length']}/30)"
        
        # 发送识别结果到前端
        emit('recognition_result', response_data)
        
    except Exception as e:
        logger.error(f"[WS] 视频帧处理异常: {e}")
        traceback.print_exc()
        emit('error', {
            'detected': False,
            'message': f'处理异常: {str(e)}',
            'error': str(e)
        })


if __name__ == '__main__':
    print("\n" + "=" * 60)
    print("智能手语翻译系统 v3.0 - YOLO+Context LSTM时序识别")
    print("=" * 60)
    print(f"YOLO 模型:       {'✅ 已加载' if yolo_model else '❌ 未加载'}")
    print(f"YOLO序列LSTM:    {'✅ 已加载' if yolo_seq_recognizer else '⚠️ 未加载'}")
    print(f"Sophnet翻译器:   {'✅ 已加载' if sophnet_translator and sophnet_translator.is_available() else '⚠️ 未配置'}")
    print(f"规则翻译器:       {'✅ 已加载' if rule_translator else '❌ 未加载'}")
    print(f"本地 LLM:         {'✅ 已加载' if local_llm_translator and local_llm_translator.is_available() else '⚠️ 未安装'}")
    print(f"手势类别:         {len(CLASS_NAMES)} 类")
    print(f"识别引擎:         {'YOLO+Context LSTM (77.88%)' if yolo_seq_recognizer else 'YOLO单帧'}")
    print(f"服务地址:         http://localhost:5001")
    print("=" * 60)
    print("\nAPI端点:")
    print("  POST /api/login       - 用户登录")
    print("  POST /api/register    - 用户注册")
    print("  GET  /api/check       - 检查登录状态")
    print("  POST /api/logout      - 退出登录")
    print("  POST /recognize       - YOLO单帧识别 + 时序处理")
    print("  WS   /ws              - WebSocket实时识别 (NEW!)")
    print("  GET  /health          - 服务健康检查")
    print("  GET  /gesture_image/<filename> - 获取35文件夹的手势图片")
    print("=" * 60 + "\n")
    
    # 使用SocketIO运行（支持WebSocket）
    socketio.run(app, host='0.0.0.0', port=5001, debug=False)

