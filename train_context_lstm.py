#!/usr/bin/env python3
"""
上下文 LSTM 模型 - 用于手语句子翻译

输入：YOLO 概率序列 (seq_length, 35)
输出：句子语义（用于翻译成完整句子）
"""

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import numpy as np
from pathlib import Path
import logging
from tqdm import tqdm
from tensorboardX import SummaryWriter
import argparse
import os

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)


# ========== 数据集定义 ==========

class YOLOSequenceDataset(Dataset):
    """YOLO 概率序列数据集"""
    
    def __init__(self, data_dir, seq_length=30):
        self.data_dir = Path(data_dir)
        self.seq_length = seq_length
        self.samples = []
        self.class_to_idx = {}
        self.idx_to_class = {}
        
        # 加载数据
        self._load_samples()
        
        logger.info(f"数据集加载完成：{len(self.samples)} 个样本，{len(self.class_to_idx)} 个类别")
    
    def _load_samples(self):
        """加载所有样本"""
        if not self.data_dir.exists():
            logger.error(f"数据目录不存在：{self.data_dir}")
            return
        
        # 遍历所有类别目录
        for class_dir in self.data_dir.iterdir():
            if not class_dir.is_dir():
                continue
            
            class_name = class_dir.name
            if class_name not in self.class_to_idx:
                idx = len(self.class_to_idx)
                self.class_to_idx[class_name] = idx
                self.idx_to_class[idx] = class_name
            
            # 查找所有 .npy 文件
            npy_files = list(class_dir.glob('*.npy'))
            
            for npy_file in npy_files:
                self.samples.append({
                    'path': str(npy_file),
                    'label': class_name
                })
    
    def __len__(self):
        return len(self.samples)
    
    def __getitem__(self, idx):
        sample = self.samples[idx]
        
        # 加载 YOLO 概率序列
        sequence = np.load(sample['path'])  # (seq_length, 35)
        
        # 转换为张量
        sequence = torch.FloatTensor(sequence)
        
        # 获取类别索引（句子标签）
        label = self.class_to_idx[sample['label']]
        
        return sequence, label


# ========== 模型定义 ==========

class ContextLSTM(nn.Module):
    """
    上下文理解的 LSTM 模型
    
    输入：(batch, seq_length, 35)  # YOLO 概率分布
    输出：(batch, num_classes)     # 句子/语义类别
    """
    
    def __init__(self, 
                 input_size=35,      # YOLO 输出维度
                 hidden_size=128,    # LSTM 隐藏层
                 num_layers=2,       # LSTM 层数
                 num_classes=35,     # 手势类别数（也是句子数）
                 dropout=0.3,
                 bidirectional=True):
        super().__init__()
        
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.bidirectional = bidirectional
        num_directions = 2 if bidirectional else 1
        
        # LSTM 编码序列
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0,
            bidirectional=bidirectional
        )
        
        # 注意力机制
        self.attention = nn.Sequential(
            nn.Linear(hidden_size * num_directions, hidden_size),
            nn.Tanh(),
            nn.Linear(hidden_size, 1),
            nn.Softmax(dim=1)
        )
        
        # 分类头
        self.classifier = nn.Sequential(
            nn.Linear(hidden_size * num_directions, hidden_size),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_size, num_classes)
        )
    
    def forward(self, x):
        # x: (batch, seq_len, 35)
        lstm_out, _ = self.lstm(x)  # (batch, seq_len, hidden*num_directions)
        
        # 注意力加权
        attn_weights = self.attention(lstm_out)  # (batch, seq_len, 1)
        context = torch.sum(attn_weights * lstm_out, dim=1)  # (batch, hidden*num_directions)
        
        # 分类
        output = self.classifier(context)  # (batch, num_classes)
        return output


# ========== 训练函数 ==========

def train_epoch(model, dataloader, criterion, optimizer, device, epoch):
    """训练一个 epoch"""
    model.train()
    
    total_loss = 0.0
    correct = 0
    total = 0
    
    pbar = tqdm(dataloader, desc=f'Epoch {epoch+1} [Train]', mininterval=5)
    
    for sequences, labels in pbar:
        sequences = sequences.to(device)
        labels = labels.to(device)
        
        # 前向传播
        optimizer.zero_grad()
        outputs = model(sequences)
        loss = criterion(outputs, labels)
        
        # 反向传播
        loss.backward()
        optimizer.step()
        
        # 统计
        total_loss += loss.item()
        _, predicted = outputs.max(1)
        total += labels.size(0)
        correct += predicted.eq(labels).sum().item()
        
        # 更新进度条
        acc = 100.0 * correct / total
        pbar.set_postfix(loss=f'{loss.item():.4f}', acc=f'{acc:.2f}%')
    
    # 处理验证集为空的情况
    if len(dataloader) == 0:
        avg_loss = total_loss
        avg_acc = 100.0 * correct / total if total > 0 else 0.0
    else:
        avg_loss = total_loss / len(dataloader)
        avg_acc = 100.0 * correct / total
    
    return avg_loss, avg_acc


def validate(model, dataloader, criterion, device, epoch):
    """验证"""
    model.eval()
    
    total_loss = 0.0
    correct = 0
    total = 0
    
    pbar = tqdm(dataloader, desc=f'Epoch {epoch+1} [Val]', mininterval=5)
    
    with torch.no_grad():
        for sequences, labels in pbar:
            sequences = sequences.to(device)
            labels = labels.to(device)
            
            outputs = model(sequences)
            loss = criterion(outputs, labels)
            
            total_loss += loss.item()
            _, predicted = outputs.max(1)
            total += labels.size(0)
            correct += predicted.eq(labels).sum().item()
            
            acc = 100.0 * correct / total
            pbar.set_postfix(loss=f'{loss.item():.4f}', acc=f'{acc:.2f}%')
    
    avg_loss = total_loss / len(dataloader)
    avg_acc = 100.0 * correct / total
    
    return avg_loss, avg_acc


def train(args):
    """训练主流程"""
    
    # 设置设备
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    logger.info(f"使用设备：{device}")
    
    # 加载数据集
    logger.info("加载训练数据集...")
    train_dataset = YOLOSequenceDataset(
        os.path.join(args.data_dir, 'train'),
        seq_length=args.seq_length
    )
    
    val_dataset = YOLOSequenceDataset(
        os.path.join(args.data_dir, 'val'),
        seq_length=args.seq_length
    )
    
    # 保存类别映射（在划分前）
    class_to_idx = train_dataset.class_to_idx
    idx_to_class = train_dataset.idx_to_class
    num_classes = len(class_to_idx)
    
    # 如果验证集为空，从训练集划分 20% 作为验证集
    if len(val_dataset) == 0 and len(train_dataset) > 0:
        logger.info("验证集为空，从训练集划分 20% 作为验证集...")
        val_size = max(1, int(len(train_dataset) * 0.2))
        train_size = len(train_dataset) - val_size
        
        # 随机划分
        train_subset, val_subset = torch.utils.data.random_split(
            train_dataset, 
            [train_size, val_size],
            generator=torch.Generator().manual_seed(42)  # 固定随机种子
        )
        
        train_dataset = train_subset
        val_dataset = val_subset
        logger.info(f"  训练集：{len(train_dataset)} 个样本")
        logger.info(f"  验证集：{len(val_dataset)} 个样本")
    
    logger.info(f"训练集：{len(train_dataset)} 个样本")
    logger.info(f"验证集：{len(val_dataset)} 个样本")
    logger.info(f"类别数：{num_classes}")
    
    # 创建数据加载器
    train_loader = DataLoader(
        train_dataset, 
        batch_size=args.batch_size, 
        shuffle=True,
        num_workers=2,
        pin_memory=True
    )
    
    val_loader = DataLoader(
        val_dataset, 
        batch_size=args.batch_size, 
        shuffle=False,
        num_workers=2,
        pin_memory=True
    )
    
    # 创建模型
    model = ContextLSTM(
        input_size=35,  # YOLO 输出维度
        hidden_size=args.hidden_size,
        num_layers=args.num_layers,
        num_classes=num_classes,
        dropout=args.dropout,
        bidirectional=args.bidirectional
    ).to(device)
    
    logger.info(f"模型创建成功")
    logger.info(f"参数量：{sum(p.numel() for p in model.parameters()):,}")
    
    # 损失函数和优化器
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(
        model.parameters(), 
        lr=args.learning_rate,
        weight_decay=args.weight_decay
    )
    
    # 学习率调度器
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, 
        mode='max', 
        factor=0.5, 
        patience=5
    )
    
    # TensorBoard
    writer = SummaryWriter(log_dir=args.log_dir)
    
    # 训练循环
    num_epochs = args.epochs
    best_val_acc = 0.0
    
    logger.info(f"\n开始训练，共 {num_epochs} 个 epoch")
    logger.info("="*60)
    
    for epoch in range(num_epochs):
        # 训练
        train_loss, train_acc = train_epoch(
            model, train_loader, criterion, optimizer, device, epoch
        )
        
        # 验证
        val_loss, val_acc = validate(
            model, val_loader, criterion, device, epoch
        )
        
        # 更新学习率
        scheduler.step(val_acc)
        
        # 记录日志
        logger.info(
            f'Epoch {epoch+1:3d}/{num_epochs} | '
            f'Train Loss: {train_loss:.4f} | '
            f'Train Acc: {train_acc:5.2f}% | '
            f'Val Loss: {val_loss:.4f} | '
            f'Val Acc: {val_acc:5.2f}%'
        )
        
        # TensorBoard
        writer.add_scalar('Loss/train', train_loss, epoch)
        writer.add_scalar('Loss/val', val_loss, epoch)
        writer.add_scalar('Accuracy/train', train_acc, epoch)
        writer.add_scalar('Accuracy/val', val_acc, epoch)
        
        # 保存最佳模型
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            checkpoint = {
                'epoch': epoch,
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'val_acc': val_acc,
                'class_to_idx': train_dataset.class_to_idx,
                'idx_to_class': train_dataset.idx_to_class,
                'args': args
            }
            
            # 保存最佳模型
            best_model_path = os.path.join(args.checkpoint_dir, 'context_lstm_best.pth')
            torch.save(checkpoint, best_model_path)
            logger.info(f'✅ 保存最佳模型：{best_model_path} (准确率：{val_acc:.2f}%)')
        
        logger.info("="*60)
    
    # 关闭 TensorBoard
    writer.close()
    
    logger.info(f"\n训练完成！")
    logger.info(f"最佳验证准确率：{best_val_acc:.2f}%")
    logger.info(f"模型保存路径：{args.checkpoint_dir}")


def parse_args():
    """解析命令行参数"""
    parser = argparse.ArgumentParser(description='上下文 LSTM 手势翻译模型训练')
    
    # 数据参数
    parser.add_argument('--data_dir', type=str, default='data/lstm_yolo_context',
                       help='数据目录')
    parser.add_argument('--seq_length', type=int, default=30,
                       help='序列长度 (帧数)')
    
    # 模型参数
    parser.add_argument('--hidden_size', type=int, default=128,
                       help='LSTM 隐藏层维度')
    parser.add_argument('--num_layers', type=int, default=2,
                       help='LSTM 层数')
    parser.add_argument('--dropout', type=float, default=0.3,
                       help='Dropout 率')
    parser.add_argument('--bidirectional', action='store_true', default=True,
                       help='双向 LSTM')
    
    # 训练参数
    parser.add_argument('--epochs', type=int, default=100,
                       help='训练轮数')
    parser.add_argument('--batch_size', type=int, default=32,
                       help='批次大小')
    parser.add_argument('--learning_rate', type=float, default=1e-3,
                       help='学习率')
    parser.add_argument('--weight_decay', type=float, default=1e-4,
                       help='权重衰减')
    
    # 其他参数
    parser.add_argument('--checkpoint_dir', type=str, default='checkpoints',
                       help='检查点保存目录')
    parser.add_argument('--log_dir', type=str, default='logs/context_lstm',
                       help='TensorBoard 日志目录')
    
    return parser.parse_args()


def main():
    """主函数"""
    args = parse_args()
    
    # 创建目录
    os.makedirs(args.checkpoint_dir, exist_ok=True)
    os.makedirs(args.log_dir, exist_ok=True)
    
    # 打印配置
    logger.info("="*60)
    logger.info("上下文 LSTM 手势翻译模型训练")
    logger.info("="*60)
    logger.info(f"数据目录：{args.data_dir}")
    logger.info(f"序列长度：{args.seq_length}")
    logger.info(f"训练轮数：{args.epochs}")
    logger.info(f"批次大小：{args.batch_size}")
    logger.info(f"学习率：{args.learning_rate}")
    logger.info(f"隐藏层维度：{args.hidden_size}")
    logger.info(f"LSTM 层数：{args.num_layers}")
    logger.info(f"Dropout: {args.dropout}")
    logger.info(f"双向 LSTM: {args.bidirectional}")
    logger.info("="*60)
    
    train(args)


if __name__ == '__main__':
    main()
