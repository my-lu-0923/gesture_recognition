"""
模型评估模块
用于评估手势识别模型的性能
"""

import os
import json
import logging
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from collections import defaultdict

import torch
import torch.nn as nn
from torch.utils.data import DataLoader
import numpy as np
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, classification_report
)
import matplotlib.pyplot as plt
import seaborn as sns
import matplotlib

# 设置中文字体支持
matplotlib.rcParams['font.sans-serif'] = ['STHeiti', 'SimHei', 'Arial Unicode MS', 'DejaVu Sans']
matplotlib.rcParams['axes.unicode_minus'] = False

logger = logging.getLogger(__name__)


class GestureEvaluator:
    """
    手势识别模型评估器
    
    评估指标：
    1. 准确率 (Accuracy)
    2. 精确率 (Precision)
    3. 召回率 (Recall)
    4. F1分数
    5. 混淆矩阵
    6. 每类准确率
    7. 推理延迟
    """
    
    def __init__(self, model: nn.Module, device: str = 'cuda'):
        """
        初始化评估器
        
        Args:
            model: 要评估的模型
            device: 计算设备
        """
        self.model = model.to(device)
        self.device = device
        self.model.eval()
        
        self.results = {}
    
    def evaluate(self, test_loader: DataLoader, class_names: List[str]) -> Dict:
        """
        评估模型
        
        Args:
            test_loader: 测试数据加载器
            class_names: 类别名称列表
        
        Returns:
            results: 评估结果字典
        """
        logger.info("开始模型评估...")
        
        all_preds = []
        all_labels = []
        all_probs = []
        inference_times = []
        
        with torch.no_grad():
            for sequences, labels in test_loader:
                sequences = sequences.to(self.device)
                labels = labels.to(self.device)
                
                # 测量推理时间
                start_time = torch.cuda.Event(enable_timing=True) if self.device == 'cuda' else None
                end_time = torch.cuda.Event(enable_timing=True) if self.device == 'cuda' else None
                
                if start_time:
                    start_time.record()
                else:
                    import time
                    t0 = time.time()
                
                # 前向传播
                if hasattr(self.model, 'forward') and 'return_attention' in self.model.forward.__code__.co_varnames:
                    outputs, _ = self.model(sequences, return_attention=False)
                else:
                    outputs, _ = self.model(sequences)
                
                if end_time:
                    end_time.record()
                    torch.cuda.synchronize()
                    inference_time = start_time.elapsed_time(end_time)  # ms
                else:
                    inference_time = (time.time() - t0) * 1000
                
                inference_times.append(inference_time / sequences.size(0))  # 每样本时间
                
                # 获取预测
                probs = torch.softmax(outputs, dim=1)
                _, preds = outputs.max(1)
                
                all_preds.extend(preds.cpu().numpy())
                all_labels.extend(labels.cpu().numpy())
                all_probs.extend(probs.cpu().numpy())
        
        all_preds = np.array(all_preds)
        all_labels = np.array(all_labels)
        all_probs = np.array(all_probs)
        
        # 计算指标
        self.results = {
            'accuracy': accuracy_score(all_labels, all_preds),
            'precision_macro': precision_score(all_labels, all_preds, average='macro', zero_division=0),
            'recall_macro': recall_score(all_labels, all_preds, average='macro', zero_division=0),
            'f1_macro': f1_score(all_labels, all_preds, average='macro', zero_division=0),
            'precision_weighted': precision_score(all_labels, all_preds, average='weighted', zero_division=0),
            'recall_weighted': recall_score(all_labels, all_preds, average='weighted', zero_division=0),
            'f1_weighted': f1_score(all_labels, all_preds, average='weighted', zero_division=0),
            'avg_inference_time_ms': np.mean(inference_times),
            'std_inference_time_ms': np.std(inference_times),
            'confusion_matrix': confusion_matrix(all_labels, all_preds).tolist(),
            'predictions': all_preds.tolist(),
            'labels': all_labels.tolist(),
            'class_names': class_names
        }
        
        # 每类准确率
        class_correct = defaultdict(int)
        class_total = defaultdict(int)
        
        for label, pred in zip(all_labels, all_preds):
            class_total[label] += 1
            if label == pred:
                class_correct[label] += 1
        
        self.results['per_class_accuracy'] = {}
        for class_idx in range(len(class_names)):
            if class_total[class_idx] > 0:
                acc = class_correct[class_idx] / class_total[class_idx]
                self.results['per_class_accuracy'][class_names[class_idx]] = acc
            else:
                self.results['per_class_accuracy'][class_names[class_idx]] = 0.0
        
        logger.info("评估完成！")
        self._print_results()
        
        return self.results
    
    def _print_results(self):
        """打印评估结果"""
        print("\n" + "=" * 70)
        print("模型评估结果")
        print("=" * 70)
        print(f"整体准确率: {self.results['accuracy']:.4f} ({self.results['accuracy']*100:.2f}%)")
        print(f"宏平均精确率: {self.results['precision_macro']:.4f}")
        print(f"宏平均召回率: {self.results['recall_macro']:.4f}")
        print(f"宏平均F1分数: {self.results['f1_macro']:.4f}")
        print(f"加权平均精确率: {self.results['precision_weighted']:.4f}")
        print(f"加权平均召回率: {self.results['recall_weighted']:.4f}")
        print(f"加权平均F1分数: {self.results['f1_weighted']:.4f}")
        print(f"平均推理时间: {self.results['avg_inference_time_ms']:.2f} ± {self.results['std_inference_time_ms']:.2f} ms")
        print(f"等效FPS: {1000/self.results['avg_inference_time_ms']:.1f}")
        print("=" * 70)
    
    def plot_confusion_matrix(self, save_path: Optional[str] = None):
        """
        绘制混淆矩阵
        
        Args:
            save_path: 保存路径
        """
        if 'confusion_matrix' not in self.results:
            logger.warning("请先运行evaluate()")
            return
        
        cm = np.array(self.results['confusion_matrix'])
        class_names = self.results['class_names']
        
        plt.figure(figsize=(14, 12))
        sns.heatmap(
            cm, 
            annot=True, 
            fmt='d', 
            cmap='Blues',
            xticklabels=class_names,
            yticklabels=class_names,
            cbar_kws={'label': 'Count'}
        )
        plt.xlabel('Predicted', fontsize=12)
        plt.ylabel('True', fontsize=12)
        plt.title('Confusion Matrix', fontsize=14)
        plt.xticks(rotation=45, ha='right')
        plt.yticks(rotation=0)
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
            logger.info(f"混淆矩阵已保存: {save_path}")
        else:
            plt.show()
        
        plt.close()
    
    def plot_per_class_accuracy(self, save_path: Optional[str] = None):
        """
        绘制每类准确率
        
        Args:
            save_path: 保存路径
        """
        if 'per_class_accuracy' not in self.results:
            logger.warning("请先运行evaluate()")
            return
        
        class_names = list(self.results['per_class_accuracy'].keys())
        accuracies = list(self.results['per_class_accuracy'].values())
        
        # 按准确率排序
        sorted_indices = np.argsort(accuracies)[::-1]
        class_names = [class_names[i] for i in sorted_indices]
        accuracies = [accuracies[i] for i in sorted_indices]
        
        plt.figure(figsize=(12, 8))
        colors = ['green' if acc > 0.8 else 'orange' if acc > 0.5 else 'red' for acc in accuracies]
        bars = plt.bar(range(len(class_names)), accuracies, color=colors, alpha=0.7)
        
        plt.xlabel('Gesture Class', fontsize=12)
        plt.ylabel('Accuracy', fontsize=12)
        plt.title('Per-Class Accuracy', fontsize=14)
        plt.xticks(range(len(class_names)), class_names, rotation=45, ha='right')
        plt.ylim([0, 1.05])
        plt.axhline(y=0.8, color='g', linestyle='--', alpha=0.5, label='80% threshold')
        plt.axhline(y=0.5, color='r', linestyle='--', alpha=0.5, label='50% threshold')
        plt.legend()
        plt.grid(axis='y', alpha=0.3)
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
            logger.info(f"每类准确率图已保存: {save_path}")
        else:
            plt.show()
        
        plt.close()
    
    def save_report(self, save_path: str):
        """
        保存评估报告
        
        Args:
            save_path: 保存路径
        """
        if not self.results:
            logger.warning("请先运行evaluate()")
            return
        
        # 生成详细报告
        report = {
            'summary': {
                'accuracy': self.results['accuracy'],
                'precision_macro': self.results['precision_macro'],
                'recall_macro': self.results['recall_macro'],
                'f1_macro': self.results['f1_macro'],
                'avg_inference_time_ms': self.results['avg_inference_time_ms'],
                'fps': 1000 / self.results['avg_inference_time_ms']
            },
            'per_class_accuracy': self.results['per_class_accuracy'],
            'classification_report': classification_report(
                self.results['labels'],
                self.results['predictions'],
                target_names=self.results['class_names'],
                output_dict=True
            )
        }
        
        with open(save_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        logger.info(f"评估报告已保存: {save_path}")
    
    def compare_models(self, other_results: Dict, model_names: List[str]):
        """
        比较多个模型的性能
        
        Args:
            other_results: 其他模型的结果
            model_names: 模型名称列表
        """
        print("\n" + "=" * 70)
        print("模型性能对比")
        print("=" * 70)
        print(f"{'Metric':<25} {model_names[0]:<15} {model_names[1]:<15}")
        print("-" * 70)
        
        metrics = ['accuracy', 'precision_macro', 'recall_macro', 'f1_macro']
        for metric in metrics:
            val1 = self.results.get(metric, 0)
            val2 = other_results.get(metric, 0)
            print(f"{metric:<25} {val1:<15.4f} {val2:<15.4f}")
        
        print("=" * 70)


if __name__ == '__main__':
    print("=" * 70)
    print("测试 GestureEvaluator")
    print("=" * 70)
    
    # 创建模拟模型
    from lstm_models.attention_lstm import AttentionLSTM
    from torch.utils.data import TensorDataset, DataLoader
    
    model = AttentionLSTM(
        input_size=42,
        hidden_size=64,
        num_layers=2,
        num_classes=10,
        dropout=0.3,
        bidirectional=True,
        attention_type='temporal',
        num_heads=4
    )
    
    # 创建模拟测试数据
    test_sequences = torch.randn(50, 30, 42)
    test_labels = torch.randint(0, 10, (50,))
    test_dataset = TensorDataset(test_sequences, test_labels)
    test_loader = DataLoader(test_dataset, batch_size=16, shuffle=False)
    
    # 类别名称
    class_names = [f'gesture_{i}' for i in range(10)]
    
    # 评估
    evaluator = GestureEvaluator(model, device='cpu')
    results = evaluator.evaluate(test_loader, class_names)
    
    # 保存报告
    evaluator.save_report('test_evaluation_report.json')
    
    print("\n" + "=" * 70)
    print("测试完成！")
    print("=" * 70)
