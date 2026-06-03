import time
import base64
import cv2
import numpy as np
import requests

test_image = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
_, buffer = cv2.imencode('.jpg', test_image)
image_base64 = base64.b64encode(buffer).decode('utf-8')

print('测试 /recognize 接口...')
start = time.time()
try:
    resp = requests.post('http://localhost:5001/recognize', 
                        json={'image': f'data:image/jpeg;base64,{image_base64}', 'session_id': 'test'},
                        timeout=30)
    elapsed = time.time() - start
    data = resp.json()
    print(f'耗时: {elapsed:.2f}s')
    print(f'结果: detected={data.get("detected")}, gesture={data.get("current_gesture")}')
except Exception as e:
    elapsed = time.time() - start
    print(f'超时/错误: {elapsed:.2f}s - {e}')

print('\n测试 /recognize_hybrid 接口...')
start = time.time()
try:
    resp = requests.post('http://localhost:5001/recognize_hybrid',
                        json={'image': f'data:image/jpeg;base64,{image_base64}'},
                        timeout=30)
    elapsed = time.time() - start
    data = resp.json()
    print(f'耗时: {elapsed:.2f}s')
    print(f'引擎: {data.get("engine")}, 耗时: {data.get("inference_time_ms")}ms')
except Exception as e:
    elapsed = time.time() - start
    print(f'超时/错误: {elapsed:.2f}s - {e}')
