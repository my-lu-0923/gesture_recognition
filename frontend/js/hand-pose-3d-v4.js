/**
 * 基于真实关键点的3D手语演示系统 V4
 * 直接使用LabelMe标注的关键点坐标构建3D手部模型
 */

class HandPose3DV4 {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        
        this.options = {
            backgroundColor: options.backgroundColor || 0x667eea,
            handColor: options.handColor || 0xffdbac,
            jointColor: options.jointColor || 0xf5c6a0,
            boneColor: options.boneColor || 0xe8b89d,
            enableShadows: options.enableShadows !== false,
            animationSpeed: options.animationSpeed || 0.15,
            handScale: options.handScale || 3.5,
            ...options
        };
        
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.rightHand = null;
        
        this.currentPose = 'idle';
        this.targetPose = null;
        this.animationProgress = 0;
        this.isAnimating = false;
        this.currentKeypoints = null;
        this.targetKeypoints = null;
        
        this.cameraDistance = 10;
        this.cameraRotation = { x: 0, y: 0 };
        this.isDragging = false;
        this.previousMousePosition = { x: 0, y: 0 };
        
        this.keypointData = null;
        
        this.handConnections = [
            [0, 1], [1, 2], [2, 3], [3, 4],
            [0, 5], [5, 6], [6, 7], [7, 8],
            [0, 9], [9, 10], [10, 11], [11, 12],
            [0, 13], [13, 14], [14, 15], [15, 16],
            [0, 17], [17, 18], [18, 19], [19, 20],
            [5, 9], [9, 13], [13, 17]
        ];
        
        this.init();
    }
    
    async init() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        await this.loadKeypointData();
        
        this.setupScene(width, height);
        this.setupCamera();
        this.setupRenderer(width, height);
        this.setupLighting();
        this.setupControls();
        
        this.createHandModels();
        
        this.animate();
        
        console.log('✅ HandPose3DV4 初始化完成');
    }
    
    async loadKeypointData() {
        try {
            const response = await fetch('data/gesture-keypoints.json');
            this.keypointData = await response.json();
            console.log('✅ 关键点数据加载成功，共', Object.keys(this.keypointData).length, '个手势');
        } catch (error) {
            console.error('❌ 关键点数据加载失败:', error);
            this.keypointData = {};
        }
    }
    
    setupScene(width, height) {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(this.options.backgroundColor);
    }
    
    setupCamera() {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
        this.camera.position.set(0, 0, this.cameraDistance);
        this.camera.lookAt(0, 0, 0);
    }
    
    setupRenderer(width, height) {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        
        if (this.options.enableShadows) {
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        }
        
        this.container.insertBefore(this.renderer.domElement, this.container.firstChild);
    }
    
    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
        mainLight.position.set(5, 5, 5);
        if (this.options.enableShadows) {
            mainLight.castShadow = true;
        }
        this.scene.add(mainLight);
        
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
        fillLight.position.set(-5, -5, -5);
        this.scene.add(fillLight);
    }
    
    setupControls() {
        this.container.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.previousMousePosition = { x: e.clientX, y: e.clientY };
        });
        
        this.container.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            
            const deltaX = e.clientX - this.previousMousePosition.x;
            const deltaY = e.clientY - this.previousMousePosition.y;
            
            this.cameraRotation.y += deltaX * 0.01;
            this.cameraRotation.x += deltaY * 0.01;
            this.cameraRotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.cameraRotation.x));
            
            this.previousMousePosition = { x: e.clientX, y: e.clientY };
        });
        
        this.container.addEventListener('mouseup', () => {
            this.isDragging = false;
        });
        
        this.container.addEventListener('mouseleave', () => {
            this.isDragging = false;
        });
        
        this.container.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.cameraDistance += e.deltaY * 0.01;
            this.cameraDistance = Math.max(5, Math.min(20, this.cameraDistance));
            this.camera.position.z = this.cameraDistance;
        });
        
        window.addEventListener('resize', () => {
            const width = this.container.clientWidth;
            const height = this.container.clientHeight;
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
        });
    }
    
    createHandModels() {
        this.rightHand = this.createHand('right');
        this.scene.add(this.rightHand.group);
        this.setPose('idle');
    }
    
    createHand(handType) {
        const group = new THREE.Group();
        
        // 创建21个关节球体
        const joints = [];
        const jointGeometry = new THREE.SphereGeometry(0.15, 16, 16);
        const jointMaterial = new THREE.MeshPhongMaterial({ 
            color: this.options.jointColor,
            shininess: 100
        });
        
        for (let i = 0; i < 21; i++) {
            const joint = new THREE.Mesh(jointGeometry, jointMaterial);
            joint.position.set(0, 0, 0);
            group.add(joint);
            joints.push(joint);
        }
        
        // 创建骨骼连线
        const bones = [];
        const boneMaterial = new THREE.LineBasicMaterial({ 
            color: this.options.boneColor,
            linewidth: 3
        });
        
        for (const [start, end] of this.handConnections) {
            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(6);
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            
            const line = new THREE.Line(geometry, boneMaterial);
            group.add(line);
            bones.push(line);
        }
        
        // 创建手臂组 - 手臂应该在手腕下方
        const armGroup = new THREE.Group();
        
        // 手臂 - 使用圆柱体
        const armGeometry = new THREE.CylinderGeometry(0.15, 0.2, 1.5, 16);
        const armMaterial = new THREE.MeshPhongMaterial({
            color: this.options.handColor,
            shininess: 50,
            transparent: true,
            opacity: 0.85
        });
        const arm = new THREE.Mesh(armGeometry, armMaterial);
        // 将手臂向下移动，使顶部在group的原点(0,0,0)处
        arm.position.y = -0.75;
        armGroup.add(arm);
        
        // 创建手掌组 - 手掌应该在手腕上方
        const palmGroup = new THREE.Group();
        
        // 手掌 - 使用盒子
        const palmGeometry = new THREE.BoxGeometry(0.8, 1.0, 0.15);
        const palmMaterial = new THREE.MeshPhongMaterial({
            color: this.options.handColor,
            shininess: 60,
            transparent: true,
            opacity: 0.8
        });
        const palm = new THREE.Mesh(palmGeometry, palmMaterial);
        // 将手掌向上移动，使底部在group的原点(0,0,0)处
        palm.position.y = 0.5;
        palmGroup.add(palm);
        
        // 添加手掌轮廓线
        const palmEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.8, 1.0, 0.15));
        const palmLine = new THREE.LineSegments(palmEdges, new THREE.LineBasicMaterial({ color: 0xd4a574, linewidth: 2 }));
        palmLine.position.y = 0.5;
        palmGroup.add(palmLine);
        
        // 将手掌和手臂组添加到主组，但初始位置在原点
        group.add(armGroup);
        group.add(palmGroup);
        
        return { group, joints, bones, palmGroup, armGroup, handType };
    }
    
    setPose(gestureName, animate = true) {
        if (!this.keypointData || !this.keypointData[gestureName]) {
            console.warn(`⚠️ 手势 "${gestureName}" 的关键点数据不存在`);
            return;
        }
        
        const keypoints = this.keypointData[gestureName];
        
        if (animate && this.currentKeypoints) {
            this.targetPose = gestureName;
            this.targetKeypoints = keypoints;
            this.animationProgress = 0;
            this.isAnimating = true;
        } else {
            this.currentPose = gestureName;
            this.currentKeypoints = keypoints;
            this.targetKeypoints = null;
            this.isAnimating = false;
            this.applyKeypointsToHand(this.rightHand, keypoints, 'right');
        }
    }
    
    applyKeypointsToHand(hand, keypoints, handType) {
        const scale = this.options.handScale;
        
        // 更新关节位置 - 翻转X轴以纠正镜像
        for (let i = 0; i < 21 && i < keypoints.length; i++) {
            let x = -keypoints[i][0] * scale; // 翻转X轴纠正镜像
            let y = keypoints[i][1] * scale;
            
            hand.joints[i].position.set(x, y, 0);
        }
        
        // 更新骨骼连线
        for (let b = 0; b < hand.bones.length; b++) {
            const [startIdx, endIdx] = this.handConnections[b];
            const positions = hand.bones[b].geometry.attributes.position.array;
            
            positions[0] = hand.joints[startIdx].position.x;
            positions[1] = hand.joints[startIdx].position.y;
            positions[2] = hand.joints[startIdx].position.z;
            positions[3] = hand.joints[endIdx].position.x;
            positions[4] = hand.joints[endIdx].position.y;
            positions[5] = hand.joints[endIdx].position.z;
            
            hand.bones[b].geometry.attributes.position.needsUpdate = true;
        }
        
        // 获取手腕位置（索引0）
        const wrist = hand.joints[0].position;
        
        // 更新手掌位置 - 手掌底部在手腕处，向上延伸
        if (hand.palmGroup) {
            hand.palmGroup.position.copy(wrist);
            hand.palmGroup.scale.set(1, 1, 1);
        }
        
        // 更新手臂位置 - 手臂顶部在手腕处，向下延伸
        if (hand.armGroup) {
            hand.armGroup.position.copy(wrist);
            hand.armGroup.scale.set(1, 1, 1);
        }
    }
    
    updateAnimation() {
        if (!this.isAnimating || !this.currentKeypoints || !this.targetKeypoints) {
            return;
        }
        
        this.animationProgress += this.options.animationSpeed;
        
        if (this.animationProgress >= 1) {
            this.animationProgress = 1;
            this.isAnimating = false;
            this.currentPose = this.targetPose;
            this.currentKeypoints = this.targetKeypoints;
            this.targetKeypoints = null;
            this.applyKeypointsToHand(this.rightHand, this.currentKeypoints, 'right');
            return;
        }
        
        const t = this.animationProgress;
        const easedT = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        
        const interpolatedKeypoints = [];
        for (let i = 0; i < 21; i++) {
            const startX = this.currentKeypoints[i][0];
            const startY = this.currentKeypoints[i][1];
            const targetX = this.targetKeypoints[i][0];
            const targetY = this.targetKeypoints[i][1];
            
            const x = startX + (targetX - startX) * easedT;
            const y = startY + (targetY - startY) * easedT;
            
            interpolatedKeypoints.push([x, y]);
        }
        
        this.applyKeypointsToHand(this.rightHand, interpolatedKeypoints, 'right');
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.updateAnimation();
        
        this.camera.position.x = Math.sin(this.cameraRotation.y) * this.cameraDistance;
        this.camera.position.y = Math.sin(this.cameraRotation.x) * this.cameraDistance;
        this.camera.position.z = Math.cos(this.cameraRotation.y) * this.cameraDistance;
        this.camera.lookAt(0, 0, 0);
        
        this.renderer.render(this.scene, this.camera);
    }
    
    getCurrentPose() {
        return this.currentPose;
    }
    
    getAvailableGestures() {
        return Object.keys(this.keypointData || {});
    }
}
