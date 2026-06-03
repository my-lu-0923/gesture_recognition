import matplotlib.pyplot as plt
import numpy as np
import matplotlib
import os

plt.rcParams['font.sans-serif'] = ['Arial Unicode MS', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

def plot_accuracy_comparison():
    labels = ['YOLOv8单独', 'LSTM单独', 'YOLO+LSTM融合']
    accuracy = [95.2, 77.88, 94.9]
    colors = ['#4CAF50', '#FF9800', '#2196F3']
    
    fig, ax = plt.subplots(figsize=(10, 6))
    bars = ax.bar(labels, accuracy, color=colors, alpha=0.8, width=0.6, edgecolor='black', linewidth=1.2)
    
    for bar in bars:
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height,
                f'{height:.2f}%', ha='center', va='bottom', fontsize=12, fontweight='bold')
    
    ax.set_title('不同识别模型准确率对比', fontsize=16, fontweight='bold', pad=20)
    ax.set_xlabel('模型类型', fontsize=14, fontweight='bold')
    ax.set_ylabel('准确率 (%)', fontsize=14, fontweight='bold')
    ax.set_ylim(0, 100)
    ax.grid(axis='y', alpha=0.3, linestyle='--')
    ax.tick_params(axis='both', labelsize=12)
    plt.tight_layout()
    plt.savefig('/Users/luuuuu/Documents/gesture_recognition/figures/accuracy_comparison.png', dpi=300, bbox_inches='tight')
    plt.close()

def plot_inference_latency():
    labels = ['YOLOv8推理', '时序引擎', 'LSTM推理', '端到端延迟', 'LLM翻译']
    latency = [15, 2, 8, 45, 2500]
    
    fig, ax = plt.subplots(figsize=(12, 7))
    
    x = np.arange(len(labels))
    bars = ax.bar(x, latency, color=['#4CAF50', '#8BC34A', '#CDDC39', '#9C27B0', '#FF5722'], 
                 alpha=0.8, edgecolor='black', linewidth=1.2)
    
    for i, bar in enumerate(bars):
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height,
                f'{height}ms', ha='center', va='bottom', fontsize=11, fontweight='bold')
    
    ax.set_title('各模块推理延迟对比', fontsize=16, fontweight='bold', pad=20)
    ax.set_xlabel('模块', fontsize=14, fontweight='bold')
    ax.set_ylabel('延迟 (ms)', fontsize=14, fontweight='bold')
    ax.set_xticks(x)
    ax.set_xticklabels(labels, rotation=15, ha='right')
    ax.grid(axis='y', alpha=0.3, linestyle='--')
    ax.tick_params(axis='both', labelsize=12)
    plt.tight_layout()
    plt.savefig('/Users/luuuuu/Documents/gesture_recognition/figures/inference_latency.png', dpi=300, bbox_inches='tight')
    plt.close()

def plot_translation_quality():
    labels = ['规则翻译器(固定短语)', '规则翻译器(未定义短语)', 'LLM翻译器']
    accuracy = [92, 61, 85]
    colors = ['#FF9800', '#F44336', '#2196F3']
    
    fig, ax = plt.subplots(figsize=(10, 6))
    bars = ax.bar(labels, accuracy, color=colors, alpha=0.8, width=0.55, edgecolor='black', linewidth=1.2)
    
    for bar in bars:
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height,
                f'{height}%', ha='center', va='bottom', fontsize=12, fontweight='bold')
    
    ax.set_title('翻译器准确率对比', fontsize=16, fontweight='bold', pad=20)
    ax.set_xlabel('翻译器类型', fontsize=14, fontweight='bold')
    ax.set_ylabel('准确率 (%)', fontsize=14, fontweight='bold')
    ax.set_ylim(0, 100)
    ax.grid(axis='y', alpha=0.3, linestyle='--')
    ax.tick_params(axis='both', labelsize=12)
    plt.tight_layout()
    plt.savefig('/Users/luuuuu/Documents/gesture_recognition/figures/translation_quality.png', dpi=300, bbox_inches='tight')
    plt.close()

def plot_sentence_optimizer():
    labels = ['优化前', '优化后']
    scores = [3.8, 4.3]
    colors = ['#E0E0E0', '#2196F3']
    
    fig, ax = plt.subplots(figsize=(8, 6))
    bars = ax.bar(labels, scores, color=colors, alpha=0.8, width=0.45, edgecolor='black', linewidth=1.2)
    
    for bar in bars:
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height,
                f'{height:.1f}', ha='center', va='bottom', fontsize=12, fontweight='bold')
    
    ax.set_title('句子优化器效果对比', fontsize=16, fontweight='bold', pad=20)
    ax.set_xlabel('状态', fontsize=14, fontweight='bold')
    ax.set_ylabel('自然度评分 (1-5)', fontsize=14, fontweight='bold')
    ax.set_ylim(0, 5.5)
    ax.grid(axis='y', alpha=0.3, linestyle='--')
    ax.tick_params(axis='both', labelsize=12)
    
    ax.axhline(y=4.0, color='g', linestyle='--', alpha=0.5, label='良好标准')
    ax.legend()
    plt.tight_layout()
    plt.savefig('/Users/luuuuu/Documents/gesture_recognition/figures/sentence_optimizer.png', dpi=300, bbox_inches='tight')
    plt.close()

def plot_resource_usage():
    categories = ['Python Flask', 'YOLO模型', 'LLM加载后', 'Spring Boot', '前端页面']
    memory_mb = [650, 500, 2100, 320, 120]
    
    fig, ax = plt.subplots(figsize=(10, 7))
    
    wedges, texts, autotexts = ax.pie(memory_mb, labels=categories, 
                                      autopct='%1.1f%%', pctdistance=0.85,
                                      colors=['#4CAF50', '#8BC34A', '#FF5722', '#2196F3', '#9C27B0'],
                                      startangle=90, wedgeprops=dict(edgecolor='white', linewidth=2))
    
    plt.setp(texts, fontsize=12, fontweight='bold')
    plt.setp(autotexts, fontsize=11, fontweight='bold', color='white')
    
    ax.set_title('各模块内存占用分布', fontsize=16, fontweight='bold', pad=20)
    plt.tight_layout()
    plt.savefig('/Users/luuuuu/Documents/gesture_recognition/figures/resource_usage.png', dpi=300, bbox_inches='tight')
    plt.close()

def plot_cpu_usage():
    categories = ['空闲', '实时识别', '视频合成']
    cpu_percent = [5, 31.5, 60]
    
    fig, ax = plt.subplots(figsize=(10, 6))
    
    ax.stackplot(categories, cpu_percent, labels=['CPU占用率'],
                 colors=['#FF9800'], alpha=0.8)
    
    for i, v in enumerate(cpu_percent):
        ax.text(i, v + 2, f'{v}%', ha='center', fontsize=12, fontweight='bold')
    
    ax.set_title('不同场景下CPU占用率', fontsize=16, fontweight='bold', pad=20)
    ax.set_xlabel('场景', fontsize=14, fontweight='bold')
    ax.set_ylabel('CPU占用率 (%)', fontsize=14, fontweight='bold')
    ax.set_ylim(0, 70)
    ax.legend()
    ax.grid(axis='y', alpha=0.3, linestyle='--')
    ax.tick_params(axis='both', labelsize=12)
    plt.tight_layout()
    plt.savefig('/Users/luuuuu/Documents/gesture_recognition/figures/cpu_usage.png', dpi=300, bbox_inches='tight')
    plt.close()

def plot_cache_effect():
    labels = ['识别缓存命中', '识别缓存未命中', 'LLM缓存命中', 'LLM缓存未命中']
    latency_ms = [3, 45, 8, 2500]
    
    fig, ax = plt.subplots(figsize=(12, 7))
    bars = ax.bar(labels, latency_ms, color=['#4CAF50', '#FF9800', '#4CAF50', '#FF9800'], 
                 alpha=0.8, edgecolor='black', linewidth=1.2)
    
    for bar in bars:
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height,
                f'{height}ms', ha='center', va='bottom', fontsize=11, fontweight='bold')
    
    ax.set_title('缓存机制对响应时间的影响', fontsize=16, fontweight='bold', pad=20)
    ax.set_xlabel('场景', fontsize=14, fontweight='bold')
    ax.set_ylabel('响应时间 (ms)', fontsize=14, fontweight='bold')
    ax.set_xticklabels(labels, rotation=15, ha='right')
    ax.grid(axis='y', alpha=0.3, linestyle='--')
    ax.tick_params(axis='both', labelsize=12)
    plt.tight_layout()
    plt.savefig('/Users/luuuuu/Documents/gesture_recognition/figures/cache_effect.png', dpi=300, bbox_inches='tight')
    plt.close()

def plot_yolo_metrics():
    metrics = ['精确率', '召回率', 'mAP50', 'mAP50-95']
    values = [96.3, 98.9, 98.7, 80.1]
    
    fig, ax = plt.subplots(figsize=(10, 6))
    
    ax.plot(metrics, values, marker='o', linestyle='-', linewidth=3, markersize=12,
            color='#2196F3', alpha=0.8)
    
    for i, v in enumerate(values):
        ax.text(i, v + 1, f'{v:.1f}%', ha='center', fontsize=12, fontweight='bold', color='#1976D2')
    
    ax.set_title('YOLOv8n模型性能指标', fontsize=16, fontweight='bold', pad=20)
    ax.set_xlabel('指标', fontsize=14, fontweight='bold')
    ax.set_ylabel('值 (%)', fontsize=14, fontweight='bold')
    ax.set_ylim(75, 100)
    ax.grid(axis='y', alpha=0.3, linestyle='--')
    ax.tick_params(axis='both', labelsize=12)
    plt.tight_layout()
    plt.savefig('/Users/luuuuu/Documents/gesture_recognition/figures/yolo_metrics.png', dpi=300, bbox_inches='tight')
    plt.close()

def plot_performance_radar():
    labels = ['准确率', '实时性', '翻译质量', '资源效率', '鲁棒性']
    values = [94.9, 95, 85, 75, 88]
    max_value = 100
    
    angles = np.linspace(0, 2 * np.pi, len(labels), endpoint=False).tolist()
    values += values[:1]
    angles += angles[:1]
    
    fig, ax = plt.subplots(figsize=(8, 8), subplot_kw={'polar': True})
    ax.fill(angles, values, color='#2196F3', alpha=0.3)
    ax.plot(angles, values, color='#2196F3', linewidth=2, marker='o', markersize=8)
    
    ax.set_xticks(angles[:-1])
    ax.set_xticklabels(labels, fontsize=12, fontweight='bold')
    ax.set_ylim(0, max_value)
    ax.set_title('系统综合性能评估', fontsize=16, fontweight='bold', pad=30)
    ax.grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.savefig('/Users/luuuuu/Documents/gesture_recognition/figures/performance_radar.png', dpi=300, bbox_inches='tight')
    plt.close()

if __name__ == '__main__':
    os.makedirs('/Users/luuuuu/Documents/gesture_recognition/figures', exist_ok=True)
    
    print("生成准确率对比图...")
    plot_accuracy_comparison()
    
    print("生成推理延迟对比图...")
    plot_inference_latency()
    
    print("生成翻译质量对比图...")
    plot_translation_quality()
    
    print("生成句子优化器效果对比图...")
    plot_sentence_optimizer()
    
    print("生成内存占用分布图(饼图)...")
    plot_resource_usage()
    
    print("生成CPU占用率图(面积图)...")
    plot_cpu_usage()
    
    print("生成缓存效果对比图...")
    plot_cache_effect()
    
    print("生成YOLO指标图(折线图)...")
    plot_yolo_metrics()
    
    print("生成性能雷达图...")
    plot_performance_radar()
    
    print("\n所有图表已生成！保存路径: /Users/luuuuu/Documents/gesture_recognition/figures/")