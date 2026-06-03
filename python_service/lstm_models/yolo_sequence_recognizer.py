"""
基于 YOLO 概率序列的 LSTM 手势识别器

使用新训练的 context_lstm 模型（77.88% 准确率）
输入：YOLO 概率序列 (30, 35)
输出：手势类别
"""

import torch
import torch.nn as nn
import numpy as np
import logging
import time
from collections import deque
from typing import Dict, Optional
from ultralytics import YOLO

logger = logging.getLogger(__name__)


class ContextLSTM(nn.Module):
    """上下文理解的 LSTM 模型（与训练时一致）"""
    
    def __init__(self, 
                 input_size=35,
                 hidden_size=128,
                 num_layers=2,
                 num_classes=35,
                 dropout=0.3,
                 bidirectional=True):
        super().__init__()
        
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.bidirectional = bidirectional
        num_directions = 2 if bidirectional else 1
        
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0,
            bidirectional=bidirectional
        )
        
        self.attention = nn.Sequential(
            nn.Linear(hidden_size * num_directions, hidden_size),
            nn.Tanh(),
            nn.Linear(hidden_size, 1),
            nn.Softmax(dim=1)
        )
        
        self.classifier = nn.Sequential(
            nn.Linear(hidden_size * num_directions, hidden_size),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_size, num_classes)
        )
    
    def forward(self, x):
        lstm_out, _ = self.lstm(x)
        attn_weights = self.attention(lstm_out)
        context = torch.sum(attn_weights * lstm_out, dim=1)
        output = self.classifier(context)
        return output


class YOLOSequenceGestureRecognizer:
    """
    基于 YOLO 概率序列的 LSTM 手势识别器
    
    流程：
    1. YOLO 检测单帧手势（输出 35 类概率）
    2. 累积 30 帧序列
    3. LSTM 识别手势类别
    4. 返回结果
    """
    
    def __init__(self, 
                 yolo_model_path: str,
                 lstm_model_path: str,
                 seq_length: int = 30,
                 device: str = 'auto'):
        
        self.seq_length = seq_length
        
        # 设置设备
        if device == 'auto':
            self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        else:
            self.device = torch.device(device)
        
        logger.info(f"使用设备: {self.device}")
        
        # 加载 YOLO 模型
        logger.info(f"加载 YOLO 模型: {yolo_model_path}")
        self.yolo_model = YOLO(yolo_model_path)
        logger.info("YOLO 模型加载成功")
        
        # 加载 LSTM 模型
        logger.info(f"加载 LSTM 模型: {lstm_model_path}")
        self.lstm_model = ContextLSTM(
            input_size=35,
            hidden_size=128,
            num_layers=2,
            num_classes=35,
            dropout=0.3,
            bidirectional=True
        ).to(self.device)
        
        checkpoint = torch.load(lstm_model_path, map_location=self.device, weights_only=False)
        self.lstm_model.load_state_dict(checkpoint['model_state_dict'])
        self.lstm_model.eval()
        
        # 加载类别映射
        self.class_to_idx = checkpoint.get('class_to_idx', {})
        self.idx_to_class = checkpoint.get('idx_to_class', {})
        
        logger.info(f"LSTM 模型加载成功（验证准确率：{checkpoint.get('val_acc', 0):.2f}%）")
        logger.info(f"类别数：{len(self.idx_to_class)}")
        
        # 序列缓冲区
        self.sequence_buffer = deque(maxlen=seq_length)
        
        # 识别结果
        self.last_gesture = None
        self.last_confidence = 0.0
        
        # 性能统计
        self.frame_count = 0
        self.inference_times = deque(maxlen=100)
    
    def extract_yolo_features(self, frame: np.ndarray) -> np.ndarray:
        """从单帧提取 YOLO 特征（35 维概率分布）"""
        results = self.yolo_model(frame, verbose=False)
        
        # 创建 35 维特征向量
        probs = np.zeros(35)
        
        # 使用 boxes 中的类别和置信度
        if hasattr(results[0], 'boxes') and results[0].boxes is not None and len(results[0].boxes) > 0:
            boxes = results[0].boxes
            for i in range(len(boxes)):
                cls_id = int(boxes.cls[i].item())
                conf = boxes.conf[i].item()
                if cls_id < 35:
                    probs[cls_id] = conf
        
        # 归一化
        if probs.sum() > 0:
            probs = probs / probs.sum()
        else:
            probs = np.ones(35) / 35
        
        return probs
    
    def process_frame(self, frame: np.ndarray) -> Dict:
        """
        处理单帧图像
        
        Returns:
            result: 包含以下字段的字典
                - gesture: 识别的手势名称（或None）
                - confidence: 置信度
                - state: 当前状态（collecting/ready）
                - is_new_gesture: 是否是新手势
                - inference_time: 推理时间(ms)
        """
        start_time = time.time()
        
        # 提取 YOLO 特征
        yolo_features = self.extract_yolo_features(frame)
        
        # 添加到序列缓冲区
        self.sequence_buffer.append(yolo_features)
        
        result = {
            'gesture': self.last_gesture,
            'confidence': self.last_confidence,
            'state': 'collecting',
            'is_new_gesture': False,
            'inference_time': 0.0,
            'sequence_length': len(self.sequence_buffer)
        }
        
        # 当缓冲区满时进行识别
        if len(self.sequence_buffer) == self.seq_length:
            # 构建输入张量
            sequence = np.array(list(self.sequence_buffer))  # (30, 35)
            input_tensor = torch.FloatTensor(sequence).unsqueeze(0).to(self.device)  # (1, 30, 35)
            
            # LSTM 推理
            with torch.no_grad():
                output = self.lstm_model(input_tensor)
                probs = torch.softmax(output, dim=1)
                confidence, predicted = probs.max(1)
                
                gesture_idx = predicted.item()
                confidence = confidence.item()
                
                # 获取类别名称
                if gesture_idx in self.idx_to_class:
                    gesture_name = self.idx_to_class[gesture_idx]
                else:
                    gesture_name = f"未知_{gesture_idx}"
                
                # 检查是否是新手势
                is_new = (gesture_name != self.last_gesture)
                self.last_gesture = gesture_name
                self.last_confidence = confidence
                
                result['gesture'] = gesture_name
                result['confidence'] = confidence
                result['state'] = 'ready'
                result['is_new_gesture'] = is_new
        
        # 计算推理时间
        inference_time = (time.time() - start_time) * 1000
        self.inference_times.append(inference_time)
        result['inference_time'] = inference_time
        
        self.frame_count += 1
        
        return result
    
    def reset(self):
        """重置识别器状态"""
        self.sequence_buffer.clear()
        self.last_gesture = None
        self.last_confidence = 0.0
        logger.info("识别器已重置")
    
    def get_stats(self) -> Dict:
        """获取性能统计"""
        if len(self.inference_times) == 0:
            return {'avg_inference_time': 0, 'fps': 0}
        
        avg_time = np.mean(self.inference_times)
        fps = 1000.0 / avg_time if avg_time > 0 else 0
        
        return {
            'avg_inference_time': avg_time,
            'fps': fps,
            'total_frames': self.frame_count,
            'device': str(self.device),
            'sequence_length': len(self.sequence_buffer)
        }
