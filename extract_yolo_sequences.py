#!/usr/bin/env python3
"""
从训练视频中提取 YOLO 概率序列

用于训练上下文 LSTM 模型
输入：视频文件
输出：YOLO 概率序列 (N 帧，35 类概率)
"""

import cv2
import numpy as np
from pathlib import Path
from ultralytics import YOLO
import logging
from tqdm import tqdm

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

# ========== 配置 ==========
YOLO_MODEL_PATH = 'python_service/models/new_hand_sign.pt'  # 你的 YOLO 模型（94% 准确率）
VIDEO_DIR = Path('data/custom_gestures_35')  # 训练视频目录
OUTPUT_DIR = Path('data/lstm_yolo_context')  # 输出目录
SEQ_LENGTH = 30  # 序列长度（帧数）

# 35 个类别标签
CLASS_NAMES = [
    "时间/时候", "你/您/你的", "早上", "9", "0",
    "快乐/高兴", "新", "祝", "请", "路",
    "生日", "平", "安", "朋友", "8",
    "认识", "名片", "结婚/妻子", "茶", "有",
    "花", "今天", "门", "停", "谢谢",
    "慢", "走", "晚", "我", "爱",
    "好", "人", "什么", "名字", "介绍"
]


def extract_yolo_sequence(video_path, yolo_model, seq_length=30):
    """
    从视频中提取 YOLO 概率序列
    
    Args:
        video_path: 视频文件路径
        yolo_model: YOLO 模型
        seq_length: 目标序列长度
    
    Returns:
        sequence: YOLO 概率序列 (seq_length, 35)
    """
    cap = cv2.VideoCapture(str(video_path))
    
    yolo_outputs = []
    frame_count = 0
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        # YOLO 推理
        results = yolo_model(frame, verbose=False)
        
        # 创建 35 维特征向量
        probs = np.zeros(35)
        
        # 优先使用 boxes 中的类别和置信度
        if hasattr(results[0], 'boxes') and results[0].boxes is not None and len(results[0].boxes) > 0:
            boxes = results[0].boxes
            for i in range(len(boxes)):
                cls_id = int(boxes.cls[i].item())
                conf = boxes.conf[i].item()
                if cls_id < 35:
                    probs[cls_id] = conf
        # 如果没有 boxes，尝试使用 probs
        elif hasattr(results[0], 'probs') and results[0].probs is not None:
            probs = results[0].probs.data.cpu().numpy()
        
        # 归一化
        if probs.sum() > 0:
            probs = probs / probs.sum()
        else:
            probs = np.ones(35) / 35
        
        yolo_outputs.append(probs)
        frame_count += 1
    
    cap.release()
    
    if len(yolo_outputs) == 0:
        logger.warning(f"视频 {video_path} 没有提取到任何帧")
        return None
    
    # 转换为 numpy 数组
    sequence = np.array(yolo_outputs)  # (N, 35)
    
    # 填充或截断到固定长度
    if len(sequence) < seq_length:
        # 填充
        padding = np.zeros((seq_length - len(sequence), 35))
        sequence = np.vstack([sequence, padding])
    else:
        # 截断（取中间部分）
        start = (len(sequence) - seq_length) // 2
        sequence = sequence[start:start + seq_length]
    
    return sequence


def process_all_videos():
    """处理所有训练视频"""
    
    # 加载 YOLO 模型
    if not Path(YOLO_MODEL_PATH).exists():
        logger.error(f"YOLO 模型不存在：{YOLO_MODEL_PATH}")
        logger.info("请指定正确的 YOLO 模型路径")
        return
    
    logger.info(f"加载 YOLO 模型：{YOLO_MODEL_PATH}")
    yolo_model = YOLO(YOLO_MODEL_PATH)
    logger.info("YOLO 模型加载成功")
    
    # 创建输出目录
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / 'train').mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / 'val').mkdir(parents=True, exist_ok=True)
    
    # 统计
    total_videos = 0
    success_videos = 0
    failed_videos = []
    
    # 遍历所有类别
    for class_dir in tqdm(VIDEO_DIR.iterdir(), desc="处理类别"):
        if not class_dir.is_dir():
            continue
        
        class_name = class_dir.name.split(',')[0]  # 去除重复部分（如"人，人"→"人"）
        logger.info(f"\n处理类别：{class_name}")
        
        # 处理该类别的所有视频
        video_files = list(class_dir.glob('*.avi')) + list(class_dir.glob('*.mp4'))
        
        for video_path in video_files:
            total_videos += 1
            
            try:
                # 提取 YOLO 序列
                sequence = extract_yolo_sequence(
                    video_path, 
                    yolo_model, 
                    seq_length=SEQ_LENGTH
                )
                
                if sequence is None or sequence.shape != (SEQ_LENGTH, 35):
                    logger.warning(f"提取失败：{video_path.name}")
                    failed_videos.append(str(video_path))
                    continue
                
                # 保存序列
                output_subdir = OUTPUT_DIR / 'train' / class_name
                output_subdir.mkdir(parents=True, exist_ok=True)
                
                output_path = output_subdir / f"{video_path.stem}.npy"
                np.save(output_path, sequence)
                
                success_videos += 1
                
            except Exception as e:
                logger.error(f"处理视频失败 {video_path.name}: {e}")
                failed_videos.append(str(video_path))
    
    # 输出统计
    logger.info("\n" + "="*60)
    logger.info("处理完成！")
    logger.info("="*60)
    logger.info(f"总视频数：{total_videos}")
    logger.info(f"成功：{success_videos}")
    logger.info(f"失败：{len(failed_videos)}")
    
    if failed_videos:
        logger.info("\n失败的视频:")
        for video in failed_videos[:10]:
            logger.info(f"  - {video}")
        if len(failed_videos) > 10:
            logger.info(f"  ... 还有 {len(failed_videos) - 10} 个")
    
    # 验证输出
    logger.info("\n验证输出数据:")
    train_samples = sum(1 for f in (OUTPUT_DIR / 'train').rglob('*.npy'))
    logger.info(f"训练集样本数：{train_samples}")
    
    # 测试加载一个样本
    if train_samples > 0:
        sample_file = next((OUTPUT_DIR / 'train').rglob('*.npy'))
        test_data = np.load(sample_file)
        logger.info(f"测试样本：{sample_file.name}")
        logger.info(f"  形状：{test_data.shape}")
        logger.info(f"  数据类型：{test_data.dtype}")
        logger.info(f"  值范围：[{test_data.min():.4f}, {test_data.max():.4f}]")


if __name__ == '__main__':
    process_all_videos()
