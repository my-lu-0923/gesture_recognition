#!/usr/bin/env python3
"""
自定义手势视频采集工具
用于收集 LSTM 训练数据

使用方法:
    python collect_gesture_data.py \
        --output_dir ../data/custom_gestures \
        --classes config/my_35classes.txt
"""

import cv2
import os
import argparse
from datetime import datetime
from pathlib import Path


class GestureCollector:
    """手势数据采集器"""
    
    def __init__(self, output_dir: str, classes: list):
        self.output_dir = output_dir
        self.classes = classes
        self.cap = None
        
    def start_camera(self):
        """启动摄像头"""
        print("正在打开摄像头...")
        self.cap = cv2.VideoCapture(0)
        
        if not self.cap.isOpened():
            print("❌ 无法打开摄像头")
            print("\n可能的原因:")
            print("1. 摄像头被其他应用占用（如 Zoom、微信、FaceTime）")
            print("2. macOS 摄像头权限未开启")
            print("3. 摄像头硬件故障")
            print("\n解决方法:")
            print("1. 关闭其他使用摄像头的应用")
            print("2. 系统设置 → 隐私与安全性 → 摄像头 → 允许 Terminal/Python")
            return False
        
        # 设置摄像头参数
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        
        # 测试是否能读取画面
        ret, frame = self.cap.read()
        if not ret:
            print("❌ 无法读取摄像头画面")
            self.cap.release()
            return False
        
        print("✅ 摄像头已打开")
        print("窗口将在 3 秒后出现...")
        
        # 创建窗口并测试
        cv2.namedWindow('Collect Gestures', cv2.WINDOW_NORMAL)
        cv2.imshow('Collect Gestures', frame)
        cv2.waitKey(1000)
        
        return True
    
    def collect_gesture(self, class_name: str, num_samples: int = 10):
        """
        采集单个手势的视频
        
        Args:
            class_name: 手势类别名称
            num_samples: 采集样本数
        """
        print(f"\n开始采集：{class_name}")
        
        # 创建类别目录
        class_dir = os.path.join(self.output_dir, class_name)
        os.makedirs(class_dir, exist_ok=True)
        
        # 检查已有多少个样本
        existing_samples = [f for f in os.listdir(class_dir) if f.startswith('sample_') and (f.endswith('.avi') or f.endswith('.mp4'))]
        existing_count = len(existing_samples)
        
        if existing_count >= num_samples:
            print(f"✅ 已有 {existing_count} 个样本，跳过")
            return
        
        print(f"📁 已有 {existing_count} 个样本，还需采集 {num_samples - existing_count} 个")
        print("按 's' 键开始录制，按 'q' 键跳过")
        
        for i in range(existing_count, num_samples):
            print(f"\n第 {i+1}/{num_samples} 个样本")
            print("准备... (3 秒后开始)")
            
            # 倒计时
            for j in range(3, 0, -1):
                print(f"{j}...")
                cv2.waitKey(1000)
            
            print("开始录制！按 's' 停止")
            
            # 录制视频
            frames = []
            recording = False
            start_time = None
            
            while True:
                ret, frame = self.cap.read()
                if not ret:
                    break
                
                # 显示画面
                display = frame.copy()
                cv2.putText(display, f"Class: {class_name}", (10, 30),
                           cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
                
                if recording:
                    frames.append(frame)
                    elapsed = (datetime.now() - start_time).total_seconds()
                    cv2.putText(display, f"Recording: {elapsed:.1f}s", (10, 60),
                               cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
                
                cv2.imshow('Collect Gestures', display)
                
                key = cv2.waitKey(1) & 0xFF
                if key == ord('s'):
                    if recording:
                        break
                    else:
                        recording = True
                        start_time = datetime.now()
                        print("录制中...")
                elif key == ord('q'):
                    print("跳过")
                    frames = []
                    break
            
            # 保存视频
            if len(frames) > 10:  # 至少 10 帧
                # 使用循环计数器作为文件名，避免覆盖
                sample_id = i + 1
                video_path = os.path.join(class_dir, f"sample_{sample_id:03d}.avi")
                
                # 保存视频
                height, width = frames[0].shape[:2]
                print(f"   视频尺寸：{width}x{height}, 帧数：{len(frames)}")
                
                # 尝试多种编码格式
                codecs = ['XVID', 'MJPG', 'mp4v', 'H264']
                out = None
                
                for codec in codecs:
                    try:
                        fourcc = cv2.VideoWriter_fourcc(*codec)
                        out = cv2.VideoWriter(video_path, fourcc, 20.0, (width, height))
                        if out.isOpened():
                            print(f"   ✅ 使用编码格式：{codec}")
                            break
                        else:
                            out.release()
                            out = None
                    except Exception as e:
                        print(f"   ❌ {codec} 失败：{e}")
                
                if out and out.isOpened():
                    for frame in frames:
                        out.write(frame)
                    out.release()
                    print(f"✅ 已保存：{video_path} ({len(frames)} 帧)")
                else:
                    print(f"❌ 所有编码格式都失败，尝试保存为图片序列...")
                    # 保存为图片序列作为后备
                    for j, frame in enumerate(frames):
                        img_path = os.path.join(class_dir, f"sample_{sample_id:03d}_frame_{j:03d}.jpg")
                        cv2.imwrite(img_path, frame)
                    print(f"✅ 已保存 {len(frames)} 张图片到 {class_dir}")
            else:
                print("❌ 帧数太少，已丢弃")
        
        print(f"\n{class_name} 采集完成！")
    
    def close(self):
        """关闭摄像头"""
        if self.cap:
            self.cap.release()
        cv2.destroyAllWindows()


def load_classes(class_file: str) -> list:
    """加载类别列表"""
    classes = []
    with open(class_file, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                classes.append(line)
    return classes


def main():
    parser = argparse.ArgumentParser(description='自定义手势数据采集工具')
    parser.add_argument('--output_dir', type=str, default='../data/custom_gestures',
                       help='输出目录')
    parser.add_argument('--classes', type=str, required=True,
                       help='类别文件路径')
    parser.add_argument('--samples_per_class', type=int, default=10,
                       help='每个类别的样本数')
    
    args = parser.parse_args()
    
    # 加载类别
    print("="*60)
    print("自定义手势数据采集工具")
    print("="*60)
    print(f"输出目录：{args.output_dir}")
    print(f"类别文件：{args.classes}")
    print(f"每类样本数：{args.samples_per_class}")
    print("="*60)
    
    classes = load_classes(args.classes)
    print(f"共 {len(classes)} 个类别:")
    for i, cls in enumerate(classes):
        print(f"  {i+1}. {cls}")
    print("="*60)
    
    # 创建采集器
    collector = GestureCollector(args.output_dir, classes)
    
    if not collector.start_camera():
        return
    
    try:
        # 采集每个类别
        for class_name in classes:
            collector.collect_gesture(class_name, args.samples_per_class)
            
            # 询问是否继续
            print("\n" + "="*60)
            print(f"已完成：{class_name}")
            print("按 'c' 继续下一个类别，按 'q' 退出")
            
            while True:
                key = cv2.waitKey(0) & 0xFF
                if key == ord('c'):
                    break
                elif key == ord('q'):
                    print("退出")
                    return
    finally:
        collector.close()
    
    print("\n" + "="*60)
    print("所有类别采集完成！")
    print("="*60)


if __name__ == '__main__':
    main()
