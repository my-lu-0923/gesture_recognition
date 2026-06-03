"""
数据加载模块
用于加载和预处理手势识别数据集
"""

import os
import json
import numpy as np
import torch
from torch.utils.data import Dataset, DataLoader
import cv2
import logging
from typing import List, Tuple, Optional, Dict
from pathlib import Path

logger = logging.getLogger(__name__)


class GestureDataset(Dataset):
    """
    手势识别数据集
    
    数据格式：
    - 每个样本是一个序列，包含seq_length帧的关键点数据
    - 每帧包含21个手部关键点的(x, y)坐标
    - 标签是手势类别ID
    """
    
    def __init__(self, 
                 data_dir: str,
                 seq_length: int = 30,
                 num_keypoints: int = 21,
                 transform=None,
                 mode='train'):
        """
        Args:
            data_dir: 数据目录
            seq_length: 序列长度
            num_keypoints: 关键点数量
            transform: 数据增强变换
            mode: 'train' 或 'test'
        """
        self.data_dir = Path(data_dir)
        self.seq_length = seq_length
        self.num_keypoints = num_keypoints
        self.transform = transform
        self.mode = mode
        
        # 加载数据
        self.samples = []
        self.labels = []
        self.class_names = []
        
        self._load_data()
    
    def _load_data(self):
        """加载数据集"""
        logger.info(f"从 {self.data_dir} 加载数据...")
        
        # 查找所有序列文件
        sequence_files = list(self.data_dir.glob('**/*_sequence.npy'))
        
        if len(sequence_files) == 0:
            logger.warning(f"未找到序列文件，尝试加载单个帧...")
            self._load_from_frames()
        else:
            self._load_from_sequences(sequence_files)
        
        logger.info(f"加载完成: {len(self.samples)} 个样本, {len(self.class_names)} 个类别")
    
    def _load_from_sequences(self, sequence_files: List[Path]):
        """从序列文件加载"""
        for seq_file in sequence_files:
            try:
                # 加载序列
                sequence = np.load(seq_file)  # (seq_len, num_kp, 2)
                
                # 从文件名解析标签
                # 格式: class_name_sequence.npy 或 class_name_idx_sequence.npy
                class_name = seq_file.stem.replace('_sequence', '').split('_')[0]
                
                if class_name not in self.class_names:
                    self.class_names.append(class_name)
                
                label = self.class_names.index(class_name)
                
                self.samples.append(sequence)
                self.labels.append(label)
                
            except Exception as e:
                logger.warning(f"加载文件失败 {seq_file}: {e}")
    
    def _load_from_frames(self):
        """从单个帧文件构建序列"""
        # 查找所有关键点文件
        keypoint_files = list(self.data_dir.glob('**/*_keypoints.npy'))
        
        # 按类别分组
        class_groups = {}
        for kp_file in keypoint_files:
            class_name = kp_file.parent.name
            if class_name not in class_groups:
                class_groups[class_name] = []
            class_groups[class_name].append(kp_file)
        
        # 为每个类别构建序列
        for class_name, files in class_groups.items():
            if class_name not in self.class_names:
                self.class_names.append(class_name)
            
            label = self.class_names.index(class_name)
            
            # 排序文件
            files = sorted(files)
            
            # 构建序列（滑动窗口）
            for i in range(0, len(files) - self.seq_length + 1, self.seq_length // 2):
                sequence = []
                for j in range(i, i + self.seq_length):
                    if j < len(files):
                        kp = np.load(files[j])
                        sequence.append(kp)
                    else:
                        # 填充
                        sequence.append(np.zeros((self.num_keypoints, 2)))
                
                if len(sequence) == self.seq_length:
                    self.samples.append(np.array(sequence))
                    self.labels.append(label)
    
    def __len__(self):
        return len(self.samples)
    
    def __getitem__(self, idx):
        """
        获取单个样本
        
        Returns:
            sequence: (seq_length, num_keypoints * 2)
            label: 类别ID
        """
        sequence = self.samples[idx]  # (seq_length, num_keypoints, 2)
        label = self.labels[idx]
        
        # 数据增强
        if self.transform and self.mode == 'train':
            sequence = self.transform(sequence)
        
        # 归一化
        sequence = self._normalize(sequence)
        
        # 重塑为 (seq_length, num_keypoints * 2)
        sequence = sequence.reshape(self.seq_length, -1)
        
        # 转换为张量
        sequence = torch.FloatTensor(sequence)
        label = torch.LongTensor([label])[0]
        
        return sequence, label
    
    def _normalize(self, sequence: np.ndarray) -> np.ndarray:
        """
        归一化序列
        
        Args:
            sequence: (seq_length, num_keypoints, 2)
        
        Returns:
            normalized: 归一化后的序列
        """
        # 对每个帧进行归一化
        normalized = np.zeros_like(sequence)
        
        for t in range(len(sequence)):
            frame = sequence[t]
            
            # 相对于手腕归一化
            wrist = frame[0].copy()
            frame_rel = frame - wrist
            
            # 缩放
            palm_size = np.linalg.norm(frame_rel[9])  # 中指根部到手腕的距离
            if palm_size > 0:
                frame_rel = frame_rel / palm_size
            
            normalized[t] = frame_rel
        
        return normalized
    
    def get_class_names(self):
        """获取类别名称列表"""
        return self.class_names


class DataAugmentation:
    """
    数据增强
    """
    
    @staticmethod
    def random_scale(sequence: np.ndarray, scale_range=(0.9, 1.1)) -> np.ndarray:
        """随机缩放"""
        scale = np.random.uniform(*scale_range)
        return sequence * scale
    
    @staticmethod
    def random_translate(sequence: np.ndarray, translate_range=(-0.1, 0.1)) -> np.ndarray:
        """随机平移"""
        translate = np.random.uniform(*translate_range, size=2)
        return sequence + translate
    
    @staticmethod
    def random_rotate(sequence: np.ndarray, angle_range=(-15, 15)) -> np.ndarray:
        """随机旋转"""
        angle = np.random.uniform(*angle_range)
        angle_rad = np.deg2rad(angle)
        cos_a = np.cos(angle_rad)
        sin_a = np.sin(angle_rad)
        
        rotation_matrix = np.array([
            [cos_a, -sin_a],
            [sin_a, cos_a]
        ])
        
        # 对每个关键点应用旋转
        rotated = np.zeros_like(sequence)
        for t in range(len(sequence)):
            for k in range(len(sequence[t])):
                rotated[t, k] = rotation_matrix @ sequence[t, k]
        
        return rotated
    
    @staticmethod
    def add_noise(sequence: np.ndarray, noise_level=0.01) -> np.ndarray:
        """添加高斯噪声"""
        noise = np.random.randn(*sequence.shape) * noise_level
        return sequence + noise
    
    @staticmethod
    def time_warp(sequence: np.ndarray, sigma=0.2) -> np.ndarray:
        """时间扭曲"""
        # 简单的线性插值
        orig_steps = np.arange(sequence.shape[0])
        random_scale = np.random.normal(1.0, sigma)
        new_steps = np.linspace(0, sequence.shape[0] - 1, int(sequence.shape[0] * random_scale))
        
        warped = np.zeros_like(sequence)
        for k in range(sequence.shape[1]):
            for d in range(sequence.shape[2]):
                warped[:, k, d] = np.interp(orig_steps, new_steps[:sequence.shape[0]], 
                                           sequence[:, k, d])
        
        return warped


class GestureDataLoader:
    """
    数据加载器工厂
    """
    
    @staticmethod
    def create_loaders(data_dir: str,
                      seq_length: int = 30,
                      batch_size: int = 16,
                      num_workers: int = 4,
                      train_ratio: float = 0.8) -> Tuple[DataLoader, DataLoader, List[str]]:
        """
        创建训练和测试数据加载器
        
        Returns:
            train_loader: 训练数据加载器
            test_loader: 测试数据加载器
            class_names: 类别名称列表
        """
        # 创建完整数据集
        full_dataset = GestureDataset(
            data_dir=data_dir,
            seq_length=seq_length,
            mode='train'
        )
        
        class_names = full_dataset.get_class_names()
        
        # 划分训练集和测试集
        dataset_size = len(full_dataset)
        train_size = int(train_ratio * dataset_size)
        test_size = dataset_size - train_size
        
        train_dataset, test_dataset = torch.utils.data.random_split(
            full_dataset, [train_size, test_size]
        )
        
        # 设置测试集模式
        test_dataset.dataset.mode = 'test'
        
        # 创建数据加载器
        train_loader = DataLoader(
            train_dataset,
            batch_size=batch_size,
            shuffle=True,
            num_workers=num_workers,
            pin_memory=True
        )
        
        test_loader = DataLoader(
            test_dataset,
            batch_size=batch_size,
            shuffle=False,
            num_workers=num_workers,
            pin_memory=True
        )
        
        logger.info(f"数据加载器创建完成:")
        logger.info(f"  训练集: {len(train_dataset)} 样本")
        logger.info(f"  测试集: {len(test_dataset)} 样本")
        logger.info(f"  批次大小: {batch_size}")
        
        return train_loader, test_loader, class_names


if __name__ == '__main__':
    print("=" * 70)
    print("测试 GestureDataset")
    print("=" * 70)
    
    # 创建模拟数据目录
    import tempfile
    import shutil
    
    temp_dir = tempfile.mkdtemp()
    
    try:
        # 创建模拟数据
        for class_idx, class_name in enumerate(['hello', 'thanks', 'yes']):
            class_dir = Path(temp_dir) / class_name
            class_dir.mkdir(exist_ok=True)
            
            # 创建10个序列
            for seq_idx in range(10):
                sequence = np.random.randn(30, 21, 2).astype(np.float32)
                np.save(class_dir / f"{class_name}_{seq_idx}_sequence.npy", sequence)
        
        # 加载数据集
        dataset = GestureDataset(temp_dir, seq_length=30)
        
        print(f"\n数据集大小: {len(dataset)}")
        print(f"类别名称: {dataset.get_class_names()}")
        
        # 获取一个样本
        sequence, label = dataset[0]
        print(f"\n样本形状: {sequence.shape}")
        print(f"标签: {label}")
        print(f"序列范围: [{sequence.min():.4f}, {sequence.max():.4f}]")
        
        # 测试数据加载器
        train_loader, test_loader, class_names = GestureDataLoader.create_loaders(
            temp_dir, seq_length=30, batch_size=4
        )
        
        print(f"\n训练批次数量: {len(train_loader)}")
        print(f"测试批次数量: {len(test_loader)}")
        
        # 获取一个批次
        for batch_sequences, batch_labels in train_loader:
            print(f"\n批次序列形状: {batch_sequences.shape}")
            print(f"批次标签形状: {batch_labels.shape}")
            break
        
        print("\n" + "=" * 70)
        print("测试完成！")
        print("=" * 70)
        
    finally:
        # 清理临时目录
        shutil.rmtree(temp_dir)
