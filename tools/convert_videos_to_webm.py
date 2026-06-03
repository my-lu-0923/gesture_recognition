"""
视频转换脚本：将AVI格式的手语视频转换为WebM格式
用于浏览器端播放
"""

import os
import subprocess
from pathlib import Path

def convert_avi_to_webm(avi_path, webm_path):
    """将单个AVI视频转换为WebM格式"""
    cmd = [
        'ffmpeg',
        '-i', avi_path,
        '-c:v', 'libvpx-vp9',
        '-b:v', '1M',
        '-c:a', 'libvorbis',
        '-y',  # 覆盖已存在的文件
        webm_path
    ]
    
    try:
        subprocess.run(cmd, check=True, capture_output=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"转换失败 {avi_path}: {e.stderr.decode()}")
        return False
    except FileNotFoundError:
        print("错误：未找到ffmpeg，请先安装ffmpeg")
        return False

def process_all_gestures(data_dir, output_dir):
    """处理所有手势视频"""
    data_path = Path(data_dir)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    gesture_count = 0
    video_count = 0
    
    # 遍历所有手势文件夹
    for gesture_folder in sorted(data_path.iterdir()):
        if not gesture_folder.is_dir():
            continue
        
        gesture_name = gesture_folder.name.split('，')[0]  # 提取手势名称
        gesture_output_dir = output_path / gesture_name
        gesture_output_dir.mkdir(parents=True, exist_ok=True)
        
        print(f"\n处理手势: {gesture_name}")
        gesture_count += 1
        
        # 处理该手势下的所有视频
        for avi_file in sorted(gesture_folder.glob('*.avi')):
            webm_filename = avi_file.stem + '.webm'
            webm_filepath = gesture_output_dir / webm_filename
            
            if webm_filepath.exists():
                print(f"  跳过已存在: {webm_filename}")
                continue
            
            print(f"  转换: {avi_file.name} -> {webm_filename}")
            if convert_avi_to_webm(str(avi_file), str(webm_filepath)):
                video_count += 1
    
    print(f"\n✅ 转换完成！")
    print(f"   手势数量: {gesture_count}")
    print(f"   视频数量: {video_count}")
    print(f"   输出目录: {output_dir}")

if __name__ == '__main__':
    data_dir = 'data/custom_gestures_35'
    output_dir = 'frontend/data/gesture_videos'
    
    process_all_gestures(data_dir, output_dir)
