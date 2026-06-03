"""
LSTM模型训练器
用于训练手势识别模型
"""

import os
import time
import json
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
from torch.utils.tensorboard import SummaryWriter
import numpy as np
from tqdm import tqdm

from lstm_models.gesture_lstm import GestureLSTM
from lstm_models.attention_lstm import AttentionLSTM

logger = logging.getLogger(__name__)


class LSTMTrainer:
    """
    LSTM模型训练器
    
    功能：
    1. 模型训练
    2. 验证
    3. 早停
    4. 学习率调度
    5. 检查点保存
    6. TensorBoard日志
    """
    
    def __init__(self,
                 model: nn.Module,
                 train_loader: DataLoader,
                 val_loader: DataLoader,
                 device: str = 'cuda',
                 learning_rate: float = 1e-3,
                 weight_decay: float = 1e-4,
                 checkpoint_dir: str = 'checkpoints'):
        """
        初始化训练器
        
        Args:
            model: 要训练的模型
            train_loader: 训练数据加载器
            val_loader: 验证数据加载器
            device: 训练设备
            learning_rate: 学习率
            weight_decay: 权重衰减
            checkpoint_dir: 检查点保存目录
        """
        self.model = model.to(device)
        self.train_loader = train_loader
        self.val_loader = val_loader
        self.device = device
        
        # 优化器
        self.optimizer = optim.Adam(
            model.parameters(),
            lr=learning_rate,
            weight_decay=weight_decay
        )
        
        # 学习率调度器
        self.scheduler = optim.lr_scheduler.ReduceLROnPlateau(
            self.optimizer,
            mode='min',
            factor=0.5,
            patience=5,
            verbose=True
        )
        
        # 损失函数
        self.criterion = nn.CrossEntropyLoss()
        
        # 检查点目录
        self.checkpoint_dir = Path(checkpoint_dir)
        self.checkpoint_dir.mkdir(exist_ok=True)
        
        # TensorBoard
        self.writer = SummaryWriter(log_dir=f'runs/gesture_recognition_{int(time.time())}')
        
        # 训练状态
        self.current_epoch = 0
        self.best_val_loss = float('inf')
        self.best_val_acc = 0.0
        self.patience_counter = 0
        self.patience = 10  # 早停耐心值
        
        # 训练历史
        self.history = {
            'train_loss': [],
            'train_acc': [],
            'val_loss': [],
            'val_acc': [],
            'learning_rate': []
        }
    
    def train_epoch(self) -> Tuple[float, float]:
        """
        训练一个epoch
        
        Returns:
            avg_loss: 平均损失
            accuracy: 准确率
        """
        self.model.train()
        total_loss = 0.0
        correct = 0
        total = 0
        
        pbar = tqdm(self.train_loader, desc=f'Epoch {self.current_epoch}')
        
        for batch_idx, (sequences, labels) in enumerate(pbar):
            sequences = sequences.to(self.device)
            labels = labels.to(self.device)
            
            # 前向传播
            self.optimizer.zero_grad()
            
            if hasattr(self.model, 'forward') and 'return_attention' in self.model.forward.__code__.co_varnames:
                outputs, _ = self.model(sequences, return_attention=False)
            else:
                outputs, _ = self.model(sequences)
            
            loss = self.criterion(outputs, labels)
            
            # 反向传播
            loss.backward()
            
            # 梯度裁剪
            torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
            
            self.optimizer.step()
            
            # 统计
            total_loss += loss.item()
            _, predicted = outputs.max(1)
            total += labels.size(0)
            correct += predicted.eq(labels).sum().item()
            
            # 更新进度条
            pbar.set_postfix({
                'loss': f'{loss.item():.4f}',
                'acc': f'{100.*correct/total:.2f}%'
            })
        
        avg_loss = total_loss / len(self.train_loader)
        accuracy = 100. * correct / total
        
        return avg_loss, accuracy
    
    def validate(self) -> Tuple[float, float]:
        """
        验证模型
        
        Returns:
            avg_loss: 平均损失
            accuracy: 准确率
        """
        self.model.eval()
        total_loss = 0.0
        correct = 0
        total = 0
        
        all_preds = []
        all_labels = []
        
        with torch.no_grad():
            for sequences, labels in tqdm(self.val_loader, desc='Validating'):
                sequences = sequences.to(self.device)
                labels = labels.to(self.device)
                
                # 前向传播
                if hasattr(self.model, 'forward') and 'return_attention' in self.model.forward.__code__.co_varnames:
                    outputs, _ = self.model(sequences, return_attention=False)
                else:
                    outputs, _ = self.model(sequences)
                
                loss = self.criterion(outputs, labels)
                
                # 统计
                total_loss += loss.item()
                _, predicted = outputs.max(1)
                total += labels.size(0)
                correct += predicted.eq(labels).sum().item()
                
                all_preds.extend(predicted.cpu().numpy())
                all_labels.extend(labels.cpu().numpy())
        
        avg_loss = total_loss / len(self.val_loader)
        accuracy = 100. * correct / total
        
        return avg_loss, accuracy
    
    def train(self, num_epochs: int = 100) -> Dict:
        """
        训练模型
        
        Args:
            num_epochs: 训练轮数
        
        Returns:
            history: 训练历史
        """
        logger.info(f"开始训练，共 {num_epochs} 个epoch")
        logger.info(f"设备: {self.device}")
        logger.info(f"训练样本数: {len(self.train_loader.dataset)}")
        logger.info(f"验证样本数: {len(self.val_loader.dataset)}")
        
        for epoch in range(num_epochs):
            self.current_epoch = epoch
            
            # 训练
            train_loss, train_acc = self.train_epoch()
            
            # 验证
            val_loss, val_acc = self.validate()
            
            # 学习率调度
            self.scheduler.step(val_loss)
            current_lr = self.optimizer.param_groups[0]['lr']
            
            # 记录历史
            self.history['train_loss'].append(train_loss)
            self.history['train_acc'].append(train_acc)
            self.history['val_loss'].append(val_loss)
            self.history['val_acc'].append(val_acc)
            self.history['learning_rate'].append(current_lr)
            
            # TensorBoard记录
            self.writer.add_scalar('Loss/train', train_loss, epoch)
            self.writer.add_scalar('Loss/val', val_loss, epoch)
            self.writer.add_scalar('Accuracy/train', train_acc, epoch)
            self.writer.add_scalar('Accuracy/val', val_acc, epoch)
            self.writer.add_scalar('Learning_rate', current_lr, epoch)
            
            # 打印日志
            logger.info(
                f"Epoch {epoch+1}/{num_epochs} - "
                f"Train Loss: {train_loss:.4f}, Train Acc: {train_acc:.2f}%, "
                f"Val Loss: {val_loss:.4f}, Val Acc: {val_acc:.2f}%, "
                f"LR: {current_lr:.6f}"
            )
            
            # 保存最佳模型
            if val_loss < self.best_val_loss:
                self.best_val_loss = val_loss
                self.best_val_acc = val_acc
                self.save_checkpoint('best_model.pth')
                self.patience_counter = 0
                logger.info(f"  -> 保存最佳模型 (Val Loss: {val_loss:.4f})")
            else:
                self.patience_counter += 1
            
            # 定期保存检查点
            if (epoch + 1) % 10 == 0:
                self.save_checkpoint(f'checkpoint_epoch_{epoch+1}.pth')
            
            # 早停检查
            if self.patience_counter >= self.patience:
                logger.info(f"早停触发，已 {self.patience} 个epoch未改进")
                break
        
        # 保存最终模型
        self.save_checkpoint('final_model.pth')
        
        # 保存训练历史
        self.save_history()
        
        self.writer.close()
        
        logger.info("训练完成！")
        logger.info(f"最佳验证准确率: {self.best_val_acc:.2f}%")
        
        return self.history
    
    def save_checkpoint(self, filename: str):
        """保存检查点"""
        checkpoint = {
            'epoch': self.current_epoch,
            'model_state_dict': self.model.state_dict(),
            'optimizer_state_dict': self.optimizer.state_dict(),
            'scheduler_state_dict': self.scheduler.state_dict(),
            'best_val_loss': self.best_val_loss,
            'best_val_acc': self.best_val_acc,
            'history': self.history
        }
        
        filepath = self.checkpoint_dir / filename
        torch.save(checkpoint, filepath)
        logger.info(f"检查点已保存: {filepath}")
    
    def load_checkpoint(self, filename: str):
        """加载检查点"""
        filepath = self.checkpoint_dir / filename
        if not filepath.exists():
            logger.warning(f"检查点不存在: {filepath}")
            return
        
        checkpoint = torch.load(filepath, map_location=self.device)
        
        self.model.load_state_dict(checkpoint['model_state_dict'])
        self.optimizer.load_state_dict(checkpoint['optimizer_state_dict'])
        self.scheduler.load_state_dict(checkpoint['scheduler_state_dict'])
        self.current_epoch = checkpoint['epoch']
        self.best_val_loss = checkpoint['best_val_loss']
        self.best_val_acc = checkpoint['best_val_acc']
        self.history = checkpoint['history']
        
        logger.info(f"检查点已加载: {filepath}")
    
    def save_history(self):
        """保存训练历史到JSON"""
        history_path = self.checkpoint_dir / 'training_history.json'
        with open(history_path, 'w') as f:
            json.dump(self.history, f, indent=2)
        logger.info(f"训练历史已保存: {history_path}")


if __name__ == '__main__':
    print("=" * 70)
    print("测试 LSTMTrainer")
    print("=" * 70)
    
    # 创建模拟数据
    from torch.utils.data import TensorDataset
    
    # 模拟训练数据
    train_sequences = torch.randn(100, 30, 42)  # 100个样本，30帧，42维
    train_labels = torch.randint(0, 35, (100,))
    train_dataset = TensorDataset(train_sequences, train_labels)
    train_loader = DataLoader(train_dataset, batch_size=16, shuffle=True)
    
    # 模拟验证数据
    val_sequences = torch.randn(20, 30, 42)
    val_labels = torch.randint(0, 35, (20,))
    val_dataset = TensorDataset(val_sequences, val_labels)
    val_loader = DataLoader(val_dataset, batch_size=16, shuffle=False)
    
    # 创建模型
    model = AttentionLSTM(
        input_size=42,
        hidden_size=64,
        num_layers=2,
        num_classes=35,
        dropout=0.3,
        bidirectional=True,
        attention_type='temporal',
        num_heads=4
    )
    
    # 创建训练器
    trainer = LSTMTrainer(
        model=model,
        train_loader=train_loader,
        val_loader=val_loader,
        device='cpu',
        learning_rate=1e-3,
        checkpoint_dir='test_checkpoints'
    )
    
    # 训练2个epoch用于测试
    print("\n开始训练...")
    history = trainer.train(num_epochs=2)
    
    print("\n训练历史:")
    print(f"  训练损失: {history['train_loss']}")
    print(f"  验证损失: {history['val_loss']}")
    print(f"  训练准确率: {history['train_acc']}")
    print(f"  验证准确率: {history['val_acc']}")
    
    print("\n" + "=" * 70)
    print("测试完成！")
    print("=" * 70)
