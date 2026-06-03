/**
 * 3D双手模型和动画系统
 * 使用Three.js渲染逼真的数字人双手
 * 支持LLM动态生成手势姿势
 */

class HandModel3D {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error('Canvas element not found');
            return;
        }

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        
        this.headGroup = null;
        this.leftArmGroup = null;
        this.rightArmGroup = null;
        this.leftHandGroup = null;
        this.rightHandGroup = null;
        
        this.leftFingers = {};
        this.rightFingers = {};
        this.leftArm = {};
        this.rightArm = {};
        
        this.currentPose = 'idle';
        this.targetPose = 'idle';
        this.animationProgress = 0;
        this.isAnimating = false;
        
        this.poseCache = {};
        this.isGeneratingPose = false;

        this.init();
    }

    init() {
        this.scene = new THREE.Scene();
        
        const rect = this.canvas.getBoundingClientRect();
        const width = rect.width || this.canvas.clientWidth || 800;
        const height = rect.height || this.canvas.clientHeight || 450;
        
        this.camera = new THREE.PerspectiveCamera(
            45,
            width / height,
            0.1,
            1000
        );
        this.camera.position.set(0, 0, 18);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ 
            canvas: this.canvas,
            antialias: true,
            alpha: true 
        });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;

        this.setupLights();

        this.createHead();
        this.createArms();
        this.createHands();

        this.animate();

        window.addEventListener('resize', () => this.onWindowResize());
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
        mainLight.position.set(5, 10, 7);
        mainLight.castShadow = true;
        this.scene.add(mainLight);

        const fillLight = new THREE.DirectionalLight(0x667eea, 0.3);
        fillLight.position.set(-5, 0, -5);
        this.scene.add(fillLight);
    }

    createHead() {
        this.headGroup = new THREE.Group();

        const skinMaterial = new THREE.MeshPhongMaterial({
            color: 0xf5d0b0,
            shininess: 30,
            specular: 0x444444
        });

        const headGeometry = new THREE.SphereGeometry(2.5, 32, 32);
        const head = new THREE.Mesh(headGeometry, skinMaterial);
        head.castShadow = true;
        this.headGroup.add(head);

        const neckGeometry = new THREE.CylinderGeometry(0.8, 1.0, 1.5, 16);
        const neck = new THREE.Mesh(neckGeometry, skinMaterial);
        neck.position.y = -3.0;
        neck.castShadow = true;
        this.headGroup.add(neck);

        const eyeWhiteGeometry = new THREE.SphereGeometry(0.35, 16, 16);
        const eyeWhiteMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
        
        const leftEyeWhite = new THREE.Mesh(eyeWhiteGeometry, eyeWhiteMaterial);
        leftEyeWhite.position.set(-0.8, 0.3, 2.3);
        this.headGroup.add(leftEyeWhite);
        
        const rightEyeWhite = new THREE.Mesh(eyeWhiteGeometry, eyeWhiteMaterial);
        rightEyeWhite.position.set(0.8, 0.3, 2.3);
        this.headGroup.add(rightEyeWhite);

        const pupilGeometry = new THREE.SphereGeometry(0.15, 16, 16);
        const pupilMaterial = new THREE.MeshPhongMaterial({ color: 0x222222 });
        
        const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
        leftPupil.position.set(-0.8, 0.3, 2.6);
        this.headGroup.add(leftPupil);
        
        const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
        rightPupil.position.set(0.8, 0.3, 2.6);
        this.headGroup.add(rightPupil);

        const noseGeometry = new THREE.ConeGeometry(0.2, 0.6, 8);
        const nose = new THREE.Mesh(noseGeometry, skinMaterial);
        nose.position.set(0, -0.2, 2.5);
        nose.rotation.x = Math.PI / 2;
        this.headGroup.add(nose);

        const mouthGeometry = new THREE.TorusGeometry(0.4, 0.08, 8, 16, Math.PI);
        const mouthMaterial = new THREE.MeshPhongMaterial({ color: 0xcc6666 });
        const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
        mouth.position.set(0, -0.9, 2.3);
        mouth.rotation.x = Math.PI;
        this.headGroup.add(mouth);

        const hairMaterial = new THREE.MeshPhongMaterial({ color: 0x2a1810 });
        const hairGeometry = new THREE.SphereGeometry(2.6, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2);
        const hair = new THREE.Mesh(hairGeometry, hairMaterial);
        hair.position.y = 0.3;
        this.headGroup.add(hair);

        this.headGroup.position.y = 5;
        this.scene.add(this.headGroup);
    }

    createArms() {
        const skinMaterial = new THREE.MeshPhongMaterial({
            color: 0xf5d0b0,
            shininess: 30,
            specular: 0x444444
        });

        this.leftArmGroup = new THREE.Group();
        this.rightArmGroup = new THREE.Group();

        this.createSingleArm(this.leftArmGroup, this.leftArm, skinMaterial, 'left');
        this.createSingleArm(this.rightArmGroup, this.rightArm, skinMaterial, 'right');

        this.leftArmGroup.position.set(-4.5, 2, 0);
        this.rightArmGroup.position.set(4.5, 2, 0);

        this.scene.add(this.leftArmGroup);
        this.scene.add(this.rightArmGroup);
    }

    createSingleArm(armGroup, armObj, material, side) {
        const shoulderJoint = new THREE.Group();
        
        const shoulderGeometry = new THREE.SphereGeometry(0.6, 16, 16);
        const shoulder = new THREE.Mesh(shoulderGeometry, material);
        shoulder.castShadow = true;
        shoulderJoint.add(shoulder);
        
        armGroup.add(shoulderJoint);
        armObj.shoulder = shoulderJoint;

        const upperArmGroup = new THREE.Group();
        
        const upperArmGeometry = new THREE.CylinderGeometry(0.45, 0.4, 3.5, 16);
        const upperArm = new THREE.Mesh(upperArmGeometry, material);
        upperArm.position.y = -1.75;
        upperArm.castShadow = true;
        upperArmGroup.add(upperArm);
        
        shoulderJoint.add(upperArmGroup);
        armObj.upperArm = upperArmGroup;

        const elbowJoint = new THREE.Group();
        elbowJoint.position.y = -3.5;
        
        const elbowGeometry = new THREE.SphereGeometry(0.4, 16, 16);
        const elbow = new THREE.Mesh(elbowGeometry, material);
        elbow.castShadow = true;
        elbowJoint.add(elbow);
        
        upperArmGroup.add(elbowJoint);
        armObj.elbow = elbowJoint;

        const forearmGroup = new THREE.Group();
        
        const forearmGeometry = new THREE.CylinderGeometry(0.35, 0.3, 3.0, 16);
        const forearm = new THREE.Mesh(forearmGeometry, material);
        forearm.position.y = -1.5;
        forearm.castShadow = true;
        forearmGroup.add(forearm);
        
        elbowJoint.add(forearmGroup);
        armObj.forearm = forearmGroup;

        const wristJoint = new THREE.Group();
        wristJoint.position.y = -3.0;
        
        const wristGeometry = new THREE.SphereGeometry(0.35, 16, 16);
        const wrist = new THREE.Mesh(wristGeometry, material);
        wrist.castShadow = true;
        wristJoint.add(wrist);
        
        forearmGroup.add(wristJoint);
        armObj.wrist = wristJoint;
    }

    createHands() {
        this.leftHandGroup = new THREE.Group();
        this.rightHandGroup = new THREE.Group();

        const skinMaterial = new THREE.MeshPhongMaterial({
            color: 0xf5d0b0,
            shininess: 30,
            specular: 0x444444
        });

        this.createSingleHand(this.leftHandGroup, this.leftFingers, skinMaterial, 'left');
        this.createSingleHand(this.rightHandGroup, this.rightFingers, skinMaterial, 'right');

        if (this.leftArm && this.leftArm.wrist) {
            this.leftArm.wrist.add(this.leftHandGroup);
        }
        if (this.rightArm && this.rightArm.wrist) {
            this.rightArm.wrist.add(this.rightHandGroup);
        }

        this.leftHandGroup.position.set(0, -0.5, 0);
        this.rightHandGroup.position.set(0, -0.5, 0);
        
        this.leftHandGroup.rotation.x = Math.PI / 2;
        this.rightHandGroup.rotation.x = Math.PI / 2;
    }

    createSingleHand(handGroup, fingersObj, material, side) {
        const palmGeometry = new THREE.BoxGeometry(2.2, 2.5, 0.6);
        const palm = new THREE.Mesh(palmGeometry, material);
        palm.position.y = 0;
        palm.castShadow = true;
        handGroup.add(palm);

        const fingerConfigs = side === 'left' ? [
            [1.5, 0.32, 0.8, 1.4, 'thumb'],
            [1.8, 0.28, 0.55, 2.4, 'index'],
            [2.0, 0.30, 0.0, 2.5, 'middle'],
            [1.8, 0.28, -0.5, 2.35, 'ring'],
            [1.5, 0.25, -0.95, 2.1, 'pinky']
        ] : [
            [1.5, 0.32, -0.8, 1.4, 'thumb'],
            [1.8, 0.28, -0.55, 2.4, 'index'],
            [2.0, 0.30, 0.0, 2.5, 'middle'],
            [1.8, 0.28, 0.5, 2.35, 'ring'],
            [1.5, 0.25, 0.95, 2.1, 'pinky']
        ];

        fingerConfigs.forEach(([length, width, x, y, name]) => {
            const finger = this.createFinger(length, width, material, name);
            finger.position.set(x, y, 0);
            handGroup.add(finger);
            fingersObj[name] = finger;
        });

        const wristGeometry = new THREE.CylinderGeometry(0.55, 0.65, 1.2, 16);
        const wrist = new THREE.Mesh(wristGeometry, material);
        wrist.position.y = -2.0;
        wrist.rotation.z = Math.PI / 2;
        wrist.castShadow = true;
        handGroup.add(wrist);
    }

    createFinger(length, width, material, name) {
        const fingerGroup = new THREE.Group();

        const joint1Length = length * 0.4;
        const joint1 = new THREE.Mesh(
            new THREE.BoxGeometry(width, joint1Length, width),
            material
        );
        joint1.position.y = joint1Length / 2;
        joint1.castShadow = true;
        fingerGroup.add(joint1);

        const joint2Length = length * 0.35;
        const joint2 = new THREE.Mesh(
            new THREE.BoxGeometry(width * 0.9, joint2Length, width * 0.9),
            material
        );
        joint2.position.y = joint1Length + joint2Length / 2;
        joint2.castShadow = true;
        fingerGroup.add(joint2);

        const joint3Length = length * 0.25;
        const joint3 = new THREE.Mesh(
            new THREE.BoxGeometry(width * 0.8, joint3Length, width * 0.8),
            material
        );
        joint3.position.y = joint1Length + joint2Length + joint3Length / 2;
        joint3.castShadow = true;
        fingerGroup.add(joint3);

        const tipGeometry = new THREE.SphereGeometry(width * 0.45, 8, 8);
        const tip = new THREE.Mesh(tipGeometry, material);
        tip.position.y = joint1Length + joint2Length + joint3Length;
        tip.castShadow = true;
        fingerGroup.add(tip);

        fingerGroup.userData.initialRotation = 0;
        fingerGroup.userData.name = name;

        return fingerGroup;
    }

    getPredefinedPose(gestureName) {
        const singleHandPoses = {
            'idle': { 
                thumb: 0.2, index: 0.1, middle: 0.1, ring: 0.1, pinky: 0.1,
                arm: { shoulder: 0, elbow: 0, wrist: 0 }
            },
            // 基础代词 - 更准确的手势
            '我': { 
                thumb: 0.4, index: 1.0, middle: 1.1, ring: 0.9, pinky: 0.7,
                arm: { shoulder: -0.5, elbow: -1.0, wrist: 0 }
            },
            '你': { 
                thumb: 0.3, index: 1.4, middle: 0.3, ring: 0.3, pinky: 0.3,
                arm: { shoulder: -0.3, elbow: -0.8, wrist: 0 }
            },
            '他': { 
                thumb: 0.3, index: 1.4, middle: 0.3, ring: 0.3, pinky: 0.3,
                arm: { shoulder: -0.3, elbow: -0.8, wrist: 0.3 }
            },
            '她': { 
                thumb: 0.3, index: 1.4, middle: 0.3, ring: 0.3, pinky: 0.3,
                arm: { shoulder: -0.3, elbow: -0.8, wrist: -0.3 }
            },
            // 常用词汇
            '你好': { 
                thumb: 0.8, index: 1.3, middle: 1.4, ring: 1.2, pinky: 1.0,
                arm: { shoulder: -0.6, elbow: -1.2, wrist: 0.2 }
            },
            '谢谢': { 
                thumb: 0.5, index: 0.8, middle: 0.9, ring: 0.7, pinky: 0.6,
                arm: { shoulder: -0.4, elbow: -1.0, wrist: 0 }
            },
            '爱': { 
                thumb: 1.0, index: 1.3, middle: 0.2, ring: 0.2, pinky: 1.0,
                arm: { shoulder: -0.5, elbow: -1.0, wrist: 0 }
            },
            '喜欢': { 
                thumb: 1.0, index: 1.3, middle: 0.2, ring: 0.2, pinky: 1.0,
                arm: { shoulder: -0.6, elbow: -1.3, wrist: 0.2 }
            },
            '朋友': { 
                thumb: 0.6, index: 1.2, middle: 1.3, ring: 1.1, pinky: 0.9,
                arm: { shoulder: -0.4, elbow: -0.9, wrist: 0 }
            },
            '好': { 
                thumb: 0.8, index: 1.3, middle: 1.4, ring: 1.2, pinky: 1.0,
                arm: { shoulder: -0.4, elbow: -1.0, wrist: 0 }
            },
            '是': { 
                thumb: 0.3, index: 1.3, middle: 1.4, ring: 1.2, pinky: 1.0,
                arm: { shoulder: -0.3, elbow: -0.6, wrist: 0 }
            },
            '不': { 
                thumb: 0.2, index: 0.3, middle: 0.3, ring: 0.3, pinky: 0.3,
                arm: { shoulder: -0.5, elbow: -1.2, wrist: 0.3 }
            },
            '有': { 
                thumb: 0.5, index: 0.9, middle: 1.0, ring: 0.8, pinky: 0.6,
                arm: { shoulder: -0.4, elbow: -0.8, wrist: 0 }
            },
            '没有': { 
                thumb: 0.2, index: 0.2, middle: 0.2, ring: 0.2, pinky: 0.2,
                arm: { shoulder: -0.4, elbow: -0.8, wrist: 0 }
            },
            '想': { 
                thumb: 0.4, index: 0.7, middle: 0.8, ring: 0.6, pinky: 0.5,
                arm: { shoulder: -0.8, elbow: -1.5, wrist: 0.2 }
            },
            '知道': { 
                thumb: 0.5, index: 1.0, middle: 1.1, ring: 0.9, pinky: 0.7,
                arm: { shoulder: -0.8, elbow: -1.5, wrist: 0.2 }
            },
            '美丽': { 
                thumb: 0.6, index: 1.2, middle: 1.3, ring: 1.1, pinky: 0.9,
                arm: { shoulder: -0.6, elbow: -1.2, wrist: 0.1 }
            },
            '要': { 
                thumb: 0.6, index: 1.1, middle: 1.2, ring: 1.0, pinky: 0.8,
                arm: { shoulder: -0.4, elbow: -0.9, wrist: 0 }
            },
            '吃': { 
                thumb: 0.7, index: 0.6, middle: 0.7, ring: 0.5, pinky: 0.4,
                arm: { shoulder: -0.5, elbow: -1.3, wrist: 0 }
            },
            '喝': { 
                thumb: 0.8, index: 0.5, middle: 0.6, ring: 0.4, pinky: 0.3,
                arm: { shoulder: -0.5, elbow: -1.3, wrist: 0 }
            },
            '水': { 
                thumb: 0.5, index: 0.8, middle: 0.9, ring: 0.7, pinky: 0.5,
                arm: { shoulder: -0.4, elbow: -1.0, wrist: 0 }
            },
            '饭': { 
                thumb: 0.6, index: 0.7, middle: 0.8, ring: 0.6, pinky: 0.5,
                arm: { shoulder: -0.5, elbow: -1.2, wrist: 0 }
            },
            '今天': { 
                thumb: 0.4, index: 1.1, middle: 1.2, ring: 1.0, pinky: 0.8,
                arm: { shoulder: -0.3, elbow: -0.7, wrist: 0 }
            },
            '明天': { 
                thumb: 0.4, index: 1.2, middle: 1.3, ring: 1.1, pinky: 0.9,
                arm: { shoulder: -0.3, elbow: -0.7, wrist: 0 }
            },
            '再见': { 
                thumb: 0.3, index: 1.3, middle: 1.4, ring: 1.2, pinky: 1.0,
                arm: { shoulder: -0.6, elbow: -1.5, wrist: 0.5 }
            },
            '欢迎': { 
                thumb: 0.6, index: 1.2, middle: 1.3, ring: 1.1, pinky: 0.9,
                arm: { shoulder: -0.5, elbow: -1.2, wrist: 0.3 }
            },
            '一': { 
                thumb: 1.3, index: 0.1, middle: 1.4, ring: 1.4, pinky: 1.4,
                arm: { shoulder: -0.3, elbow: -0.8, wrist: 0 }
            },
            '二': { 
                thumb: 1.3, index: 0.1, middle: 0.1, ring: 1.4, pinky: 1.4,
                arm: { shoulder: -0.3, elbow: -0.8, wrist: 0 }
            },
            '三': { 
                thumb: 1.3, index: 0.1, middle: 0.1, ring: 0.1, pinky: 1.4,
                arm: { shoulder: -0.3, elbow: -0.8, wrist: 0 }
            },
            '四': { 
                thumb: 1.3, index: 0.1, middle: 0.1, ring: 0.1, pinky: 0.1,
                arm: { shoulder: -0.3, elbow: -0.8, wrist: 0 }
            },
            '五': { 
                thumb: 0.2, index: 0.1, middle: 0.1, ring: 0.1, pinky: 0.1,
                arm: { shoulder: -0.3, elbow: -0.8, wrist: 0 }
            },
            '梦想': { 
                thumb: 0.5, index: 0.8, middle: 0.9, ring: 0.7, pinky: 0.6,
                arm: { shoulder: -0.7, elbow: -1.4, wrist: 0.2 }
            },
            '希望': { 
                thumb: 0.4, index: 1.0, middle: 1.1, ring: 0.9, pinky: 0.7,
                arm: { shoulder: -0.6, elbow: -1.2, wrist: 0.1 }
            },
            '喜欢': { 
                thumb: 1.0, index: 1.3, middle: 0.2, ring: 0.2, pinky: 1.0,
                arm: { shoulder: -0.6, elbow: -1.3, wrist: 0.2 }
            },
            '中国': { 
                thumb: 0.3, index: 1.4, middle: 1.4, ring: 1.4, pinky: 1.4,
                arm: { shoulder: -0.4, elbow: -1.0, wrist: 0 }
            },
            '早上': { thumb: 0.5, index: 1.0, middle: 1.1, ring: 0.9, pinky: 0.7 },
            '晚上': { thumb: 0.3, index: 0.8, middle: 0.9, ring: 0.7, pinky: 0.5 },
            '晚安': { thumb: 0.2, index: 0.4, middle: 0.5, ring: 0.3, pinky: 0.2 },
            '生日': { thumb: 0.7, index: 1.3, middle: 1.4, ring: 1.2, pinky: 1.0 },
            '快乐': { thumb: 0.8, index: 1.4, middle: 1.5, ring: 1.3, pinky: 1.1 },
            '高兴': { thumb: 0.8, index: 1.4, middle: 1.5, ring: 1.3, pinky: 1.1 },
            '新': { thumb: 0.6, index: 1.2, middle: 1.3, ring: 1.1, pinky: 0.9 },
            '祝': { thumb: 0.7, index: 1.3, middle: 1.4, ring: 1.2, pinky: 1.0 },
            '请': { thumb: 0.5, index: 1.1, middle: 1.2, ring: 1.0, pinky: 0.8 },
            '路': { thumb: 0.4, index: 1.0, middle: 1.1, ring: 0.9, pinky: 0.7 },
            '门': { thumb: 0.6, index: 0.9, middle: 1.0, ring: 0.8, pinky: 0.6 },
            '停': { thumb: 0.2, index: 0.2, middle: 0.2, ring: 0.2, pinky: 0.2 },
            '慢': { thumb: 0.3, index: 0.5, middle: 0.6, ring: 0.4, pinky: 0.3 },
            '走': { thumb: 0.4, index: 0.9, middle: 1.0, ring: 0.8, pinky: 0.6 },
            '晚': { thumb: 0.3, index: 0.7, middle: 0.8, ring: 0.6, pinky: 0.4 },
            '人': { thumb: 0.5, index: 1.1, middle: 1.2, ring: 1.0, pinky: 0.8 },
            '什么': { thumb: 0.4, index: 0.8, middle: 0.9, ring: 0.7, pinky: 0.5 },
            '名字': { thumb: 0.5, index: 1.0, middle: 1.1, ring: 0.9, pinky: 0.7 },
            '介绍': { thumb: 0.6, index: 1.1, middle: 1.2, ring: 1.0, pinky: 0.8 },
            '认识': { thumb: 0.5, index: 1.0, middle: 1.1, ring: 0.9, pinky: 0.7 },
            '名片': { thumb: 0.6, index: 0.9, middle: 1.0, ring: 0.8, pinky: 0.6 },
            '结婚': { thumb: 0.7, index: 1.2, middle: 1.3, ring: 1.1, pinky: 0.9 },
            '妻子': { thumb: 0.6, index: 1.1, middle: 1.2, ring: 1.0, pinky: 0.8 },
            '茶': { thumb: 0.7, index: 0.6, middle: 0.7, ring: 0.5, pinky: 0.4 },
            '花': { thumb: 0.8, index: 1.3, middle: 1.4, ring: 1.2, pinky: 1.0 },
            '时间': { thumb: 0.4, index: 1.0, middle: 1.1, ring: 0.9, pinky: 0.7 },
            '时候': { thumb: 0.4, index: 1.0, middle: 1.1, ring: 0.9, pinky: 0.7 },
            '平': { thumb: 0.5, index: 1.1, middle: 1.2, ring: 1.0, pinky: 0.8 },
            '安': { thumb: 0.5, index: 1.0, middle: 1.1, ring: 0.9, pinky: 0.7 },
            '国家': { thumb: 0.4, index: 1.2, middle: 1.3, ring: 1.1, pinky: 0.9 },
            '家': { thumb: 0.5, index: 1.0, middle: 1.1, ring: 0.9, pinky: 0.7 },
            '大': { thumb: 0.3, index: 1.4, middle: 1.5, ring: 1.4, pinky: 1.3 },
            '小': { thumb: 0.2, index: 0.4, middle: 0.5, ring: 0.4, pinky: 0.3 },
            '多': { thumb: 0.6, index: 1.2, middle: 1.3, ring: 1.1, pinky: 0.9 },
            '少': { thumb: 0.3, index: 0.6, middle: 0.7, ring: 0.5, pinky: 0.4 },
            '来': { thumb: 0.5, index: 1.1, middle: 1.2, ring: 1.0, pinky: 0.8 },
            '去': { thumb: 0.5, index: 1.0, middle: 1.1, ring: 0.9, pinky: 0.7 },
            '看': { thumb: 0.3, index: 1.3, middle: 1.4, ring: 0.3, pinky: 0.3 },
            '听': { thumb: 0.5, index: 0.3, middle: 0.3, ring: 0.3, pinky: 0.3 },
            '说': { thumb: 0.6, index: 1.2, middle: 1.3, ring: 1.1, pinky: 0.9 },
            '做': { thumb: 0.7, index: 1.1, middle: 1.2, ring: 1.0, pinky: 0.8 },
            '学': { thumb: 0.4, index: 1.0, middle: 1.1, ring: 0.9, pinky: 0.7 },
            '工作': { thumb: 0.5, index: 1.1, middle: 1.2, ring: 1.0, pinky: 0.8 },
            '帮助': { thumb: 0.6, index: 1.2, middle: 1.3, ring: 1.1, pinky: 0.9 },
            '喜欢': { thumb: 1.0, index: 1.3, middle: 0.2, ring: 0.2, pinky: 1.0 },
            '知道': { thumb: 0.5, index: 1.0, middle: 1.1, ring: 0.9, pinky: 0.7 },
            '理解': { thumb: 0.4, index: 1.0, middle: 1.1, ring: 0.9, pinky: 0.7 },
            '对不起': { thumb: 0.5, index: 0.8, middle: 0.9, ring: 0.7, pinky: 0.5 },
            '没关系': { thumb: 0.6, index: 1.1, middle: 1.2, ring: 1.0, pinky: 0.8 },
            '再见': { thumb: 0.3, index: 1.3, middle: 1.4, ring: 1.2, pinky: 1.0 },
            '欢迎': { thumb: 0.6, index: 1.2, middle: 1.3, ring: 1.1, pinky: 0.9 },
            '一': { thumb: 1.3, index: 0.1, middle: 1.4, ring: 1.4, pinky: 1.4 },
            '二': { thumb: 1.3, index: 0.1, middle: 0.1, ring: 1.4, pinky: 1.4 },
            '三': { thumb: 1.3, index: 0.1, middle: 0.1, ring: 0.1, pinky: 1.4 },
            '四': { thumb: 1.3, index: 0.1, middle: 0.1, ring: 0.1, pinky: 0.1 },
            '五': { thumb: 0.2, index: 0.1, middle: 0.1, ring: 0.1, pinky: 0.1 },
            '0': { 
                thumb: 1.2, 
                index: 1.2, 
                middle: 1.4, 
                ring: 1.4, 
                pinky: 1.4,
                thumbZ: 0.8,
                indexZ: -0.5
            },
            '六': { thumb: 0.3, index: 0.1, middle: 1.4, ring: 1.4, pinky: 1.4 },
            '七': { thumb: 0.3, index: 0.1, middle: 0.1, ring: 1.4, pinky: 1.4 },
            '八': { thumb: 0.3, index: 0.1, middle: 0.1, ring: 0.1, pinky: 1.4 },
            '九': { thumb: 0.3, index: 0.1, middle: 0.1, ring: 0.1, pinky: 0.1 },
            '个': { thumb: 1.3, index: 0.1, middle: 1.4, ring: 1.4, pinky: 1.4 },
            '梦想': { thumb: 0.5, index: 0.8, middle: 0.9, ring: 0.7, pinky: 0.6 },
            '希望': { thumb: 0.4, index: 1.0, middle: 1.1, ring: 0.9, pinky: 0.7 },
            '美丽': { thumb: 0.6, index: 1.2, middle: 1.3, ring: 1.1, pinky: 0.9 },
            '勇敢': { thumb: 0.5, index: 1.1, middle: 1.2, ring: 1.0, pinky: 0.8 },
            '努力': { thumb: 0.6, index: 1.1, middle: 1.2, ring: 1.0, pinky: 0.8 },
            '成功': { thumb: 0.4, index: 1.3, middle: 1.4, ring: 1.2, pinky: 1.0 },
            '失败': { thumb: 0.3, index: 0.5, middle: 0.6, ring: 0.4, pinky: 0.3 },
            '坚持': { thumb: 0.5, index: 1.0, middle: 1.1, ring: 0.9, pinky: 0.7 },
            '永远': { thumb: 0.4, index: 1.2, middle: 1.3, ring: 1.1, pinky: 0.9 },
            '幸福': { thumb: 0.7, index: 1.3, middle: 1.4, ring: 1.2, pinky: 1.0 },
            '健康': { thumb: 0.5, index: 1.1, middle: 1.2, ring: 1.0, pinky: 0.8 },
            '平安': { thumb: 0.5, index: 1.0, middle: 1.1, ring: 0.9, pinky: 0.7 },
            '顺利': { thumb: 0.6, index: 1.2, middle: 1.3, ring: 1.1, pinky: 0.9 },
            '开心': { thumb: 0.8, index: 1.4, middle: 1.5, ring: 1.3, pinky: 1.1 },
            '难过': { thumb: 0.3, index: 0.6, middle: 0.7, ring: 0.5, pinky: 0.4 },
            '生气': { thumb: 0.4, index: 0.9, middle: 1.0, ring: 0.8, pinky: 0.6 },
            '害怕': { thumb: 0.5, index: 0.7, middle: 0.8, ring: 0.6, pinky: 0.5 },
            '惊讶': { thumb: 0.3, index: 0.3, middle: 0.3, ring: 0.3, pinky: 0.3 },
            '期待': { thumb: 0.5, index: 1.0, middle: 1.1, ring: 0.9, pinky: 0.7 },
            '相信': { thumb: 0.5, index: 1.0, middle: 1.1, ring: 0.9, pinky: 0.7 },
            '支持': { thumb: 0.6, index: 1.1, middle: 1.2, ring: 1.0, pinky: 0.8 },
            '关心': { thumb: 0.5, index: 1.0, middle: 1.1, ring: 0.9, pinky: 0.7 },
            '照顾': { thumb: 0.6, index: 1.1, middle: 1.2, ring: 1.0, pinky: 0.8 },
            '陪伴': { thumb: 0.5, index: 1.0, middle: 1.1, ring: 0.9, pinky: 0.7 },
            '未来': { thumb: 0.4, index: 1.2, middle: 1.3, ring: 1.1, pinky: 0.9 },
            '过去': { thumb: 0.4, index: 1.0, middle: 1.1, ring: 0.9, pinky: 0.7 },
            '现在': { thumb: 0.5, index: 1.1, middle: 1.2, ring: 1.0, pinky: 0.8 },
            '开始': { thumb: 0.4, index: 1.2, middle: 1.3, ring: 1.1, pinky: 0.9 },
            '结束': { thumb: 0.5, index: 1.0, middle: 1.1, ring: 0.9, pinky: 0.7 },
            '学习': { thumb: 0.4, index: 1.0, middle: 1.1, ring: 0.9, pinky: 0.7 },
            '生活': { thumb: 0.5, index: 1.1, middle: 1.2, ring: 1.0, pinky: 0.8 },
            '世界': { thumb: 0.4, index: 1.2, middle: 1.3, ring: 1.1, pinky: 0.9 },
            '社会': { thumb: 0.5, index: 1.1, middle: 1.2, ring: 1.0, pinky: 0.8 },
            '自然': { thumb: 0.6, index: 1.2, middle: 1.3, ring: 1.1, pinky: 0.9 }
        };

        const dualHandPoses = {
            '你好': {
                left: { thumb: 0.3, index: 1.2, middle: 1.3, ring: 1.1, pinky: 0.8 },
                right: { thumb: 0.3, index: 1.2, middle: 1.3, ring: 1.1, pinky: 0.8 },
                leftArm: { shoulder: -0.3, elbow: -0.8, wrist: 0 },
                rightArm: { shoulder: -0.3, elbow: -0.8, wrist: 0 },
                leftOffset: { x: -1.5, y: 0, z: 0 },
                rightOffset: { x: 1.5, y: 0, z: 0 }
            },
            '谢谢': {
                left: { thumb: 0.5, index: 0.8, middle: 0.9, ring: 0.7, pinky: 0.6 },
                right: { thumb: 0.5, index: 0.8, middle: 0.9, ring: 0.7, pinky: 0.6 },
                leftArm: { shoulder: -0.5, elbow: -1.2, wrist: 0.2 },
                rightArm: { shoulder: -0.5, elbow: -1.2, wrist: 0.2 },
                leftOffset: { x: -1.2, y: -0.5, z: 0.3 },
                rightOffset: { x: 1.2, y: -0.5, z: 0.3 }
            },
            '爱': {
                left: { thumb: 1.0, index: 1.3, middle: 0.2, ring: 0.2, pinky: 1.0 },
                right: { thumb: 1.0, index: 1.3, middle: 0.2, ring: 0.2, pinky: 1.0 },
                leftArm: { shoulder: -0.8, elbow: -1.5, wrist: 0.3 },
                rightArm: { shoulder: -0.8, elbow: -1.5, wrist: 0.3 },
                leftOffset: { x: -1.0, y: 0, z: 0.5 },
                rightOffset: { x: 1.0, y: 0, z: 0.5 }
            },
            '朋友': {
                left: { thumb: 0.6, index: 1.2, middle: 1.3, ring: 1.1, pinky: 0.9 },
                right: { thumb: 0.6, index: 1.2, middle: 1.3, ring: 1.1, pinky: 0.9 },
                leftArm: { shoulder: -0.4, elbow: -1.0, wrist: 0 },
                rightArm: { shoulder: -0.4, elbow: -1.0, wrist: 0 },
                leftOffset: { x: -1.8, y: 0, z: 0 },
                rightOffset: { x: 1.8, y: 0, z: 0 }
            }
        };

        if (dualHandPoses[gestureName]) {
            return { type: 'dual', pose: dualHandPoses[gestureName] };
        }

        if (singleHandPoses[gestureName]) {
            return { type: 'single', pose: singleHandPoses[gestureName] };
        }

        return null;
    }

    async generatePoseFromLLM(gestureName) {
        if (this.poseCache[gestureName]) {
            console.log(`🎯 [HandModel] 使用缓存姿势: ${gestureName}`);
            return this.poseCache[gestureName];
        }

        if (this.isGeneratingPose) {
            console.log('⏳ [HandModel] 正在生成其他姿势，请稍候...');
            return null;
        }

        this.isGeneratingPose = true;
        console.log(`🤖 [HandModel] LLM生成手势姿势: ${gestureName}`);

        const prompt = `你是中国手语专家。请为手语词汇"${gestureName}"生成手指姿势参数。

规则：
1. 每个手指弯曲角度范围：0（完全伸直）到 1.5（完全弯曲）
2. thumb（拇指）、index（食指）、middle（中指）、ring（无名指）、pinky（小指）
3. 根据中国手语标准姿势判断

请直接返回JSON格式，不要任何解释：
{"thumb":数值,"index":数值,"middle":数值,"ring":数值,"pinky":数值}`;

        try {
            const response = await SignAPI.chat(prompt);
            
            if (response && response.response) {
                const jsonMatch = response.response.match(/\{[^{}]*"thumb"[^{}]*\}/s);
                if (jsonMatch) {
                    const pose = JSON.parse(jsonMatch[0]);
                    
                    const validPose = {
                        thumb: Math.max(0, Math.min(1.5, parseFloat(pose.thumb) || 0.2)),
                        index: Math.max(0, Math.min(1.5, parseFloat(pose.index) || 0.1)),
                        middle: Math.max(0, Math.min(1.5, parseFloat(pose.middle) || 0.1)),
                        ring: Math.max(0, Math.min(1.5, parseFloat(pose.ring) || 0.1)),
                        pinky: Math.max(0, Math.min(1.5, parseFloat(pose.pinky) || 0.1))
                    };
                    
                    this.poseCache[gestureName] = validPose;
                    console.log(`✅ [HandModel] LLM生成成功:`, validPose);
                    
                    return validPose;
                }
            }
        } catch (error) {
            console.error('❌ [HandModel] LLM生成失败:', error);
        } finally {
            this.isGeneratingPose = false;
        }

        return null;
    }

    async setPose(gestureName) {
        let gestureData = this.getPredefinedPose(gestureName);

        if (!gestureData) {
            const llmPose = await this.generatePoseFromLLM(gestureName);
            if (llmPose) {
                gestureData = { type: 'single', pose: llmPose };
            } else {
                gestureData = { 
                    type: 'single', 
                    pose: { thumb: 0.2, index: 0.1, middle: 0.1, ring: 0.1, pinky: 0.1 }
                };
                console.warn(`⚠️ [HandModel] 使用默认姿势: ${gestureName}`);
            }
        }

        this.targetPose = gestureName;
        this.animationProgress = 0;
        this.isAnimating = true;

        if (gestureData.type === 'dual') {
            const { left, right, leftArm, rightArm, leftOffset, rightOffset } = gestureData.pose;
            
            Object.keys(this.leftFingers).forEach(fingerName => {
                const targetRotation = left[fingerName] || 0;
                this.animateFinger(this.leftFingers[fingerName], targetRotation, 500);
            });

            Object.keys(this.rightFingers).forEach(fingerName => {
                const targetRotation = right[fingerName] || 0;
                this.animateFinger(this.rightFingers[fingerName], targetRotation, 500);
            });

            if (leftArm && this.leftArm.shoulder) {
                this.animateArm(this.leftArm, leftArm, 500);
            }
            if (rightArm && this.rightArm.shoulder) {
                this.animateArm(this.rightArm, rightArm, 500);
            }

            if (leftOffset) {
                this.animateHandPosition(this.leftHandGroup, leftOffset, 500);
            }
            if (rightOffset) {
                this.animateHandPosition(this.rightHandGroup, rightOffset, 500);
            }
        } else {
            const pose = gestureData.pose;
            
            Object.keys(this.leftFingers).forEach(fingerName => {
                const targetRotation = pose[fingerName] || 0;
                this.animateFinger(this.leftFingers[fingerName], targetRotation, 500);
                
                const zKey = fingerName + 'Z';
                if (pose[zKey] !== undefined) {
                    this.animateFingerZ(this.leftFingers[fingerName], pose[zKey], 500);
                }
            });

            Object.keys(this.rightFingers).forEach(fingerName => {
                const targetRotation = pose[fingerName] || 0;
                this.animateFinger(this.rightFingers[fingerName], targetRotation, 500);
                
                const zKey = fingerName + 'Z';
                if (pose[zKey] !== undefined) {
                    this.animateFingerZ(this.rightFingers[fingerName], pose[zKey], 500);
                }
            });

            if (pose.arm) {
                if (this.leftArm.shoulder) {
                    this.animateArm(this.leftArm, pose.arm, 500);
                }
                if (this.rightArm.shoulder) {
                    this.animateArm(this.rightArm, pose.arm, 500);
                }
            } else {
                this.resetArmPose(this.leftArm, 500);
                this.resetArmPose(this.rightArm, 500);
            }
        }
    }

    animateArm(armObj, targetAngles, duration) {
        if (armObj.shoulder) {
            this.animateJoint(armObj.shoulder, 'z', targetAngles.shoulder || 0, duration);
        }
        if (armObj.elbow) {
            this.animateJoint(armObj.elbow, 'x', targetAngles.elbow || 0, duration);
        }
        if (armObj.wrist) {
            this.animateJoint(armObj.wrist, 'x', targetAngles.wrist || 0, duration);
        }
    }

    animateJoint(joint, axis, targetAngle, duration) {
        const startAngle = joint.rotation[axis];
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            
            joint.rotation[axis] = startAngle + (targetAngle - startAngle) * eased;

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        animate();
    }

    resetArmPose(armObj, duration) {
        if (armObj.shoulder) {
            this.animateJoint(armObj.shoulder, 'z', 0, duration);
        }
        if (armObj.elbow) {
            this.animateJoint(armObj.elbow, 'x', 0, duration);
        }
        if (armObj.wrist) {
            this.animateJoint(armObj.wrist, 'x', 0, duration);
        }
    }

    animateFinger(finger, targetRotation, duration) {
        const startRotation = finger.rotation.x;
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            
            finger.rotation.x = startRotation + (targetRotation - startRotation) * eased;

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        animate();
    }

    animateFingerZ(finger, targetRotation, duration) {
        const startRotation = finger.rotation.z || 0;
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            
            finger.rotation.z = startRotation + (targetRotation - startRotation) * eased;

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        animate();
    }

    animateHandPosition(handGroup, targetOffset, duration) {
        const startX = handGroup.position.x;
        const startY = handGroup.position.y;
        const startZ = handGroup.position.z;
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            
            handGroup.position.x = startX + (targetOffset.x - startX) * eased;
            handGroup.position.y = startY + (targetOffset.y - startY) * eased;
            handGroup.position.z = startZ + (targetOffset.z - startZ) * eased;

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        animate();
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        if (!this.canvas) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const width = rect.width || this.canvas.clientWidth || 800;
        const height = rect.height || this.canvas.clientHeight || 450;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    dispose() {
        if (this.renderer) {
            this.renderer.dispose();
        }
    }
}

window.HandModel3D = HandModel3D;
