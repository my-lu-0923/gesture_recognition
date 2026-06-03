#!/usr/bin/env python3
"""
提取所有LabelMe标注文件中的关键点数据，生成JavaScript可用的JSON格式
"""

import json
import os
import glob

def extract_keypoints(json_path):
    """从LabelMe JSON文件中提取关键点"""
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    keypoints = []
    img_width = data.get('imageWidth', 640)
    img_height = data.get('imageHeight', 480)
    
    # 按索引排序关键点
    shapes = sorted(data['shapes'], key=lambda x: int(x['label'].split('_')[1]))
    
    for shape in shapes:
        label = shape['label']
        point = shape['points'][0]
        
        # 归一化到[-1, 1]范围，并翻转Y轴（图像坐标系Y向下，3D坐标系Y向上）
        x = (point[0] / img_width) * 2 - 1
        y = -((point[1] / img_height) * 2 - 1)  # 翻转Y轴
        
        keypoints.append([round(x, 4), round(y, 4)])
    
    return keypoints

def get_gesture_name(filename):
    """从文件名提取手势名称"""
    # 例如: "85-0.json" -> "0", "18-你:您:你的.json" -> "你/您/你的"
    basename = os.path.basename(filename).replace('.json', '')
    parts = basename.split('-', 1)
    if len(parts) == 2:
        # 将冒号分隔的别名转换为斜杠
        name = parts[1].replace(':', '/')
        return name
    return basename

def main():
    label_dir = '/Users/luuuuu/Desktop/gesture_recognition/35/label'
    output_file = '/Users/luuuuu/Desktop/gesture_recognition/frontend/data/gesture-keypoints.json'
    
    gesture_data = {}
    
    # 查找所有JSON标注文件
    json_files = glob.glob(os.path.join(label_dir, '*.json'))
    
    print(f"找到 {len(json_files)} 个标注文件")
    
    for json_file in sorted(json_files):
        try:
            gesture_name = get_gesture_name(json_file)
            keypoints = extract_keypoints(json_file)
            
            if len(keypoints) == 21:
                gesture_data[gesture_name] = keypoints
                print(f"✅ {gesture_name}: {len(keypoints)} 个关键点")
            else:
                print(f"⚠️ {gesture_name}: 只有 {len(keypoints)} 个关键点，跳过")
        except Exception as e:
            print(f"❌ 处理 {json_file} 失败: {e}")
    
    # 输出统计
    print(f"\n成功提取 {len(gesture_data)} 个手势的关键点数据")
    
    # 保存到文件
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(gesture_data, f, ensure_ascii=False, indent=2)
    
    print(f"数据已保存到: {output_file}")
    
    # 打印示例
    print("\n示例数据（手势'0'）:")
    if '0' in gesture_data:
        print(json.dumps(gesture_data['0'], indent=2))

if __name__ == '__main__':
    main()
