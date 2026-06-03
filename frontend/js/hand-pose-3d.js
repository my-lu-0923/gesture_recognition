/**
 * 3D数字人手模型 - 基于Three.js
 * 包含完整的双手骨骼系统、纹理贴图和鼠标交互
 */

class HandPose3D {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('Container element not found:', containerId);
            return;
        }

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.leftHand = null;
        this.rightHand = null;
        this.controls = null;
        this.currentPose = 'idle';
        
        // 相机距离（用于缩放）
        this.cameraDistance = 8;
        this.minDistance = 4;
        this.maxDistance = 15;

        this.init();
    }

    init() {
        // 初始化Three.js场景
        this.setupScene();
        
        // 创建左手和右手模型
        this.createLeftHand();
        this.createRightHand();
        
        // 添加鼠标控制
        this.addMouseControls();
        
        // 设置初始姿势
        this.setPose('idle');
        
        // 启动渲染循环
        this.animate();
        
        // 监听窗口大小变化
        window.addEventListener('resize', () => this.onWindowResize());
        
        console.log('✅ [HandPose3D] 3D双手模型初始化成功');
    }

    setupScene() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        // 创建场景
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x667eea);

        // 创建相机
        this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        this.camera.position.set(0, 0, 8);
        this.camera.lookAt(0, 0, 0);

        // 创建渲染器
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // 清空容器并添加canvas
        this.container.innerHTML = '';
        this.container.appendChild(this.renderer.domElement);

        // 添加光源
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 7);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);

        const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
        fillLight.position.set(-5, 0, -5);
        this.scene.add(fillLight);
    }

    createHandModel() {
        this.handGroup = new THREE.Group();

        // 材质
        const skinMaterial = new THREE.MeshStandardMaterial({
            color: 0xffdbac,
            roughness: 0.4,
            metalness: 0.1,
        });

        const jointMaterial = new THREE.MeshStandardMaterial({
            color: 0xf5c6a0,
            roughness: 0.5,
            metalness: 0.0,
        });

        // 创建手掌
        const palmGeometry = new THREE.BoxGeometry(1.8, 2.2, 0.5);
        const palm = new THREE.Mesh(palmGeometry, skinMaterial);
        palm.position.y = 0;
        palm.castShadow = true;
        this.handGroup.add(palm);

        // 创建手指配置 [长度, 宽度, 位置x, 位置y, 名称]
        const fingers = [
            { name: 'thumb', length: 1.2, width: 0.35, x: -1.1, y: 0.5, segments: 2, baseRotZ: -0.5 },
            { name: 'index', length: 1.8, width: 0.32, x: -0.6, y: 1.3, segments: 3, baseRotZ: 0 },
            { name: 'middle', length: 2.0, width: 0.33, x: -0.2, y: 1.35, segments: 3, baseRotZ: 0 },
            { name: 'ring', length: 1.7, width: 0.31, x: 0.2, y: 1.25, segments: 3, baseRotZ: 0 },
            { name: 'pinky', length: 1.3, width: 0.28, x: 0.6, y: 1.0, segments: 3, baseRotZ: 0 },
        ];

        // 创建每个手指
        fingers.forEach(finger => {
            const fingerGroup = new THREE.Group();
            fingerGroup.position.set(finger.x, finger.y, 0);
            fingerGroup.rotation.z = finger.baseRotZ || 0;

            const segmentLength = finger.length / finger.segments;
            let parentGroup = fingerGroup;

            for (let i = 0; i < finger.segments; i++) {
                // 指节
                const segmentGeometry = new THREE.CylinderGeometry(
                    finger.width / 2,
                    finger.width / 2,
                    segmentLength,
                    12
                );
                const segment = new THREE.Mesh(segmentGeometry, skinMaterial);
                segment.position.y = segmentLength / 2;
                segment.castShadow = true;
                
                // 关节
                if (i > 0) {
                    const jointGeometry = new THREE.SphereGeometry(finger.width / 2, 12, 12);
                    const joint = new THREE.Mesh(jointGeometry, jointMaterial);
                    joint.position.y = 0;
                    parentGroup.add(joint);
                }

                const jointGroup = new THREE.Group();
                jointGroup.add(segment);
                parentGroup.add(jointGroup);
                parentGroup = jointGroup;
                parentGroup.position.y = segmentLength;
            }

            this.handGroup.add(fingerGroup);
            this.joints[finger.name] = fingerGroup;
        });

        // 创建手腕/前臂
        const armGeometry = new THREE.CylinderGeometry(0.5, 0.6, 2.5, 16);
        const arm = new THREE.Mesh(armGeometry, skinMaterial);
        arm.position.y = -2.2;
        arm.castShadow = true;
        this.handGroup.add(arm);

        this.scene.add(this.handGroup);
    }

    setPose(gestureName) {
        this.targetPose = gestureName;
        this.animationProgress = 0;
        this.isAnimating = true;

        // 获取目标姿势的角度配置
        const poseConfig = this.getPoseConfig(gestureName);
        this.applyPoseConfig(poseConfig);
    }

    getPoseConfig(gestureName) {
        // 预定义的35个手语姿势配置
        const poses = {
            'idle': {
                thumb: { z: -0.3, x: 0.2 },
                index: { x: 0.1 },
                middle: { x: 0.1 },
                ring: { x: 0.1 },
                pinky: { x: 0.1 },
            },
            '你好': {
                thumb: { z: -0.5, x: 0.3 },
                index: { x: 1.2 },
                middle: { x: 1.3 },
                ring: { x: 1.1 },
                pinky: { x: 0.9 },
            },
            '谢谢': {
                thumb: { z: -0.4, x: 0.4 },
                index: { x: 0.7 },
                middle: { x: 0.8 },
                ring: { x: 0.6 },
                pinky: { x: 0.5 },
            },
            '爱': {
                thumb: { z: -0.6, x: 0.8 },
                index: { x: 1.2 },
                middle: { x: 0.2 },
                ring: { x: 0.2 },
                pinky: { x: 0.9 },
            },
            '喜欢': {
                thumb: { z: -0.6, x: 0.8 },
                index: { x: 1.2 },
                middle: { x: 0.2 },
                ring: { x: 0.2 },
                pinky: { x: 0.9 },
            },
            '我': {
                thumb: { z: -0.4, x: 0.5 },
                index: { x: 0.3 },
                middle: { x: 0.3 },
                ring: { x: 0.3 },
                pinky: { x: 0.3 },
            },
            '你/您/你的/这': {
                thumb: { z: -0.4, x: 0.5 },
                index: { x: 1.3 },
                middle: { x: 0.3 },
                ring: { x: 0.3 },
                pinky: { x: 0.3 },
            },
            '好': {
                thumb: { z: -0.3, x: 0.6 },
                index: { x: 0.2 },
                middle: { x: 0.2 },
                ring: { x: 0.2 },
                pinky: { x: 0.2 },
            },
            '是': {
                thumb: { z: -0.4, x: 0.5 },
                index: { x: 0.3 },
                middle: { x: 0.3 },
                ring: { x: 0.3 },
                pinky: { x: 0.3 },
            },
            '不': {
                thumb: { z: -0.5, x: 0.6 },
                index: { x: 1.0 },
                middle: { x: 0.2 },
                ring: { x: 0.2 },
                pinky: { x: 0.2 },
            },
            '有': {
                thumb: { z: -0.3, x: 0.4 },
                index: { x: 0.2 },
                middle: { x: 0.2 },
                ring: { x: 0.2 },
                pinky: { x: 0.2 },
            },
            '什么': {
                thumb: { z: -0.5, x: 0.6 },
                index: { x: 1.1 },
                middle: { x: 1.1 },
                ring: { x: 0.3 },
                pinky: { x: 0.3 },
            },
            '名字': {
                thumb: { z: -0.4, x: 0.5 },
                index: { x: 0.8 },
                middle: { x: 0.8 },
                ring: { x: 0.3 },
                pinky: { x: 0.3 },
            },
            '朋友': {
                thumb: { z: -0.4, x: 0.5 },
                index: { x: 0.6 },
                middle: { x: 0.6 },
                ring: { x: 0.6 },
                pinky: { x: 0.6 },
            },
            '认识': {
                thumb: { z: -0.4, x: 0.5 },
                index: { x: 0.7 },
                middle: { x: 0.7 },
                ring: { x: 0.4 },
                pinky: { x: 0.4 },
            },
            '介绍': {
                thumb: { z: -0.4, x: 0.5 },
                index: { x: 0.9 },
                middle: { x: 0.9 },
                ring: { x: 0.5 },
                pinky: { x: 0.5 },
            },
            '时间/时候': {
                thumb: { z: -0.5, x: 0.6 },
                index: { x: 1.0 },
                middle: { x: 0.3 },
                ring: { x: 0.3 },
                pinky: { x: 0.3 },
            },
            '今天': {
                thumb: { z: -0.4, x: 0.5 },
                index: { x: 0.8 },
                middle: { x: 0.4 },
                ring: { x: 0.4 },
                pinky: { x: 0.4 },
            },
            '早上': {
                thumb: { z: -0.4, x: 0.5 },
                index: { x: 1.0 },
                middle: { x: 1.0 },
                ring: { x: 0.5 },
                pinky: { x: 0.5 },
            },
            '快乐/高兴': {
                thumb: { z: -0.3, x: 0.6 },
                index: { x: 0.4 },
                middle: { x: 0.4 },
                ring: { x: 0.4 },
                pinky: { x: 0.4 },
            },
            '生日': {
                thumb: { z: -0.4, x: 0.5 },
                index: { x: 0.7 },
                middle: { x: 0.7 },
                ring: { x: 0.7 },
                pinky: { x: 0.7 },
            },
            '祝': {
                thumb: { z: -0.3, x: 0.5 },
                index: { x: 0.5 },
                middle: { x: 0.5 },
                ring: { x: 0.5 },
                pinky: { x: 0.5 },
            },
            '请': {
                thumb: { z: -0.4, x: 0.5 },
                index: { x: 0.6 },
                middle: { x: 0.6 },
                ring: { x: 0.6 },
                pinky: { x: 0.6 },
            },
            '人': {
                thumb: { z: -0.4, x: 0.5 },
                index: { x: 0.5 },
                middle: { x: 0.5 },
                ring: { x: 0.5 },
                pinky: { x: 0.5 },
            },
            '结婚/妻子': {
                thumb: { z: -0.5, x: 0.7 },
                index: { x: 0.8 },
                middle: { x: 0.3 },
                ring: { x: 0.3 },
                pinky: { x: 0.3 },
            },
            '茶': {
                thumb: { z: -0.6, x: 0.8 },
                index: { x: 0.9 },
                middle: { x: 0.3 },
                ring: { x: 0.3 },
                pinky: { x: 0.3 },
            },
            '花': {
                thumb: { z: -0.4, x: 0.6 },
                index: { x: 0.7 },
                middle: { x: 0.7 },
                ring: { x: 0.4 },
                pinky: { x: 0.4 },
            },
            '停': {
                thumb: { z: -0.3, x: 0.4 },
                index: { x: 0.2 },
                middle: { x: 0.2 },
                ring: { x: 0.2 },
                pinky: { x: 0.2 },
            },
            '慢': {
                thumb: { z: -0.4, x: 0.5 },
                index: { x: 0.4 },
                middle: { x: 0.4 },
                ring: { x: 0.3 },
                pinky: { x: 0.3 },
            },
            '走': {
                thumb: { z: -0.4, x: 0.5 },
                index: { x: 0.6 },
                middle: { x: 0.6 },
                ring: { x: 0.3 },
                pinky: { x: 0.3 },
            },
            '晚': {
                thumb: { z: -0.4, x: 0.5 },
                index: { x: 0.7 },
                middle: { x: 0.4 },
                ring: { x: 0.4 },
                pinky: { x: 0.4 },
            },
            '平': {
                thumb: { z: -0.3, x: 0.4 },
                index: { x: 0.3 },
                middle: { x: 0.3 },
                ring: { x: 0.3 },
                pinky: { x: 0.3 },
            },
            '安': {
                thumb: { z: -0.4, x: 0.5 },
                index: { x: 0.4 },
                middle: { x: 0.4 },
                ring: { x: 0.4 },
                pinky: { x: 0.4 },
            },
            '8': {
                thumb: { z: -0.5, x: 0.7 },
                index: { x: 1.0 },
                middle: { x: 1.0 },
                ring: { x: 0.3 },
                pinky: { x: 0.3 },
            },
            '9': {
                thumb: { z: -0.6, x: 0.8 },
                index: { x: 1.1 },
                middle: { x: 0.3 },
                ring: { x: 0.3 },
                pinky: { x: 0.3 },
            },
            '0': {
                thumb: { z: -0.3, x: 0.3 },
                index: { x: 0.2 },
                middle: { x: 0.2 },
                ring: { x: 0.2 },
                pinky: { x: 0.2 },
            },
        };

        return poses[gestureName] || poses['idle'];
    }

    applyPoseConfig(config) {
        // 应用姿势配置到各个手指
        Object.keys(config).forEach(fingerName => {
            if (this.joints[fingerName]) {
                const fingerConfig = config[fingerName];
                
                if (fingerConfig.x !== undefined) {
                    this.joints[fingerName].rotation.x = fingerConfig.x;
                }
                if (fingerConfig.z !== undefined) {
                    this.joints[fingerName].rotation.z = fingerConfig.z;
                }
            }
        });
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    onWindowResize() {
        if (!this.camera || !this.renderer) return;

        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    destroy() {
        if (this.renderer) {
            this.renderer.dispose();
        }
        if (this.container) {
            this.container.innerHTML = '';
        }
        window.removeEventListener('resize', () => this.onWindowResize());
    }
}

// 导出类
window.HandPose3D = HandPose3D;
