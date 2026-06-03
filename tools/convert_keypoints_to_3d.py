#!/usr/bin/env python3
"""
将LabelMe标注的2D手部关键点数据转换为3D模型的关节角度配置

LabelMe关键点格式（MediaPipe 21点）:
- 0: 手腕 (wrist)
- 1-4: 拇指 (thumb) - CMC, MCP, IP, tip
- 5-8: 食指 (index) - MCP, PIP, DIP, tip
- 9-12: 中指 (middle) - MCP, PIP, DIP, tip
- 13-16: 无名指 (ring) - MCP, PIP, DIP, tip
- 17-20: 小指 (pinky) - MCP, PIP, DIP, tip

输出: 3D模型可用的关节角度配置
"""

import json
import math
import os
import glob
import numpy as np
from pathlib import Path


class KeypointConverter:
    def __init__(self):
        # MediaPipe手部连接关系
        self.connections = {
            'thumb': [0, 1, 2, 3, 4],
            'index': [0, 5, 6, 7, 8],
            'middle': [0, 9, 10, 11, 12],
            'ring': [0, 13, 14, 15, 16],
            'pinky': [0, 17, 18, 19, 20]
        }
        
    def load_keypoints(self, json_path):
        """加载LabelMe标注文件"""
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        keypoints = {'left': {}, 'right': {}}
        
        for shape in data['shapes']:
            label = shape['label']
            points = shape['points'][0]
            
            if label.startswith('R_'):
                idx = int(label.split('_')[1])
                keypoints['right'][idx] = points
            elif label.startswith('L_'):
                idx = int(label.split('_')[1])
                keypoints['left'][idx] = points
        
        return keypoints, data.get('imageWidth', 640), data.get('imageHeight', 480)
    
    def normalize_keypoints(self, keypoints, img_width, img_height):
        """归一化关键点到[-1, 1]范围"""
        normalized = {}
        
        for idx, (x, y) in keypoints.items():
            # 转换坐标系：图像坐标 -> 3D坐标
            # x: 从左到右 [-1, 1]
            # y: 从下到上 [-1, 1] (翻转Y轴)
            nx = (x / img_width) * 2 - 1
            ny = -((y / img_height) * 2 - 1)  # 翻转Y轴
            normalized[idx] = (nx, ny)
        
        return normalized
    
    def calculate_joint_angles(self, keypoints_normalized):
        """计算关节角度"""
        if not keypoints_normalized or len(keypoints_normalized) < 5:
            return None
        
        # 计算手指弯曲角度
        finger_angles = {}
        
        # 拇指角度 (基于CMC-MCP-IP的夹角)
        if all(i in keypoints_normalized for i in [1, 2, 3]):
            thumb_angle = self._calculate_angle(
                keypoints_normalized[1],
                keypoints_normalized[2],
                keypoints_normalized[3]
            )
            finger_angles['thumb'] = thumb_angle
        
        # 其他手指角度 (基于MCP-PIP-DIP的夹角)
        for finger_name, indices in self.connections.items():
            if finger_name == 'thumb':
                continue
            
            if len(indices) >= 4 and all(i in keypoints_normalized for i in indices[1:4]):
                mcp, pip, dip = indices[1], indices[2], indices[3]
                angle = self._calculate_angle(
                    keypoints_normalized[mcp],
                    keypoints_normalized[pip],
                    keypoints_normalized[dip]
                )
                finger_angles[finger_name] = angle
        
        # 计算手指张开角度（相对于手掌中心）
        if 0 in keypoints_normalized and 5 in keypoints_normalized and 17 in keypoints_normalized:
            wrist = keypoints_normalized[0]
            index_mcp = keypoints_normalized[5]
            pinky_mcp = keypoints_normalized[17]
            
            # 手掌方向
            palm_angle = math.atan2(
                pinky_mcp[1] - index_mcp[1],
                pinky_mcp[0] - index_mcp[0]
            )
            
            # 各手指相对于手掌的张开角度
            for finger_name, indices in self.connections.items():
                if len(indices) >= 2 and indices[1] in keypoints_normalized:
                    finger_mcp = keypoints_normalized[indices[1]]
                    finger_angle = math.atan2(
                        finger_mcp[1] - wrist[1],
                        finger_mcp[0] - wrist[0]
                    )
                    spread_angle = finger_angle - palm_angle
                    
                    if finger_name not in finger_angles:
                        finger_angles[finger_name] = {}
                    finger_angles[finger_name]['spread'] = spread_angle
        
        return finger_angles
    
    def _calculate_angle(self, p1, p2, p3):
        """计算三点之间的角度（在p2处）"""
        v1 = (p1[0] - p2[0], p1[1] - p2[1])
        v2 = (p3[0] - p2[0], p3[1] - p2[1])
        
        dot = v1[0] * v2[0] + v1[1] * v2[1]
        norm1 = math.sqrt(v1[0]**2 + v1[1]**2)
        norm2 = math.sqrt(v2[0]**2 + v2[1]**2)
        
        if norm1 == 0 or norm2 == 0:
            return 0
        
        cos_angle = max(-1, min(1, dot / (norm1 * norm2)))
        angle = math.acos(cos_angle)
        
        return angle
    
    def convert_to_3d_config(self, keypoints, img_width, img_height, gesture_name):
        """转换为3D模型配置格式"""
        right_normalized = self.normalize_keypoints(keypoints.get('right', {}), img_width, img_height)
        left_normalized = self.normalize_keypoints(keypoints.get('left', {}), img_width, img_height)
        
        right_angles = self.calculate_joint_angles(right_normalized)
        left_angles = self.calculate_joint_angles(left_normalized)
        
        config = {gesture_name: {}}
        
        # 右手配置
        if right_angles:
            config[gesture_name]['right'] = self._angles_to_3d_format(right_angles, right_normalized)
        
        # 左手配置
        if left_angles:
            config[gesture_name]['left'] = self._angles_to_3d_format(left_angles, left_normalized)
        
        # 如果只有单手，使用both
        if not right_angles and left_angles:
            config[gesture_name]['left'] = self._angles_to_3d_format(left_angles, left_normalized)
        elif right_angles and not left_angles:
            config[gesture_name]['right'] = self._angles_to_3d_format(right_angles, right_normalized)
        
        return config
    
    def _angles_to_3d_format(self, angles, normalized_keypoints):
        """将角度转换为3D模型格式"""
        config = {}
        
        for finger_name in ['thumb', 'index', 'middle', 'ring', 'pinky']:
            if finger_name not in angles:
                continue
            
            finger_data = angles[finger_name]
            
            if isinstance(finger_data, dict):
                # 有spread信息
                bend_angle = finger_data.get('bend', 0)
                spread_angle = finger_data.get('spread', 0)
            else:
                # 只有弯曲角度
                bend_angle = finger_data
                spread_angle = 0
            
            # 转换为3D模型的x和z旋转
            # x: 弯曲角度
            # z: 张开角度
            config[finger_name] = {
                'x': [round(bend_angle * 0.5, 3)],  # 缩放以适应3D模型
                'z': round(spread_angle, 3)
            }
        
        return config
    
    def process_all_gestures(self, label_dir):
        """处理所有手势标注文件"""
        all_configs = {}
        
        json_files = glob.glob(os.path.join(label_dir, '*.json'))
        
        for json_file in sorted(json_files):
            filename = os.path.basename(json_file)
            # 从文件名提取手势名称，如 "18-你:您:你的.json" -> "你/您/你的"
            gesture_name = filename.split('-', 1)[1].replace('.json', '').replace(':', '/')
            
            print(f"处理手势: {gesture_name}")
            
            try:
                keypoints, img_width, img_height = self.load_keypoints(json_file)
                config = self.convert_to_3d_config(keypoints, img_width, img_height, gesture_name)
                all_configs.update(config)
            except Exception as e:
                print(f"处理 {gesture_name} 失败: {e}")
        
        return all_configs
    
    def generate_js_code(self, configs):
        """生成JavaScript代码"""
        js_code = "const POSE_CONFIGS = {\n"
        
        for gesture_name, config in configs.items():
            js_code += f"    '{gesture_name}': {json.dumps(config, ensure_ascii=False, indent=6)},\n"
        
        js_code += "};\n"
        
        return js_code


def main():
    converter = KeypointConverter()
    
    # 处理所有标注文件
    label_dir = '/Users/luuuuu/Desktop/gesture_recognition/35/label'
    configs = converter.process_all_gestures(label_dir)
    
    # 生成JavaScript代码
    js_code = converter.generate_js_code(configs)
    
    # 保存结果
    output_file = '/Users/luuuuu/Desktop/gesture_recognition/frontend/js/pose-configs-from-data.js'
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(js_code)
    
    print(f"\n✅ 成功生成 {len(configs)} 个手势的配置")
    print(f"📁 配置文件已保存到: {output_file}")
    
    # 打印示例配置
    print("\n示例配置:")
    for name, config in list(configs.items())[:3]:
        print(f"\n{name}:")
        print(json.dumps(config, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
