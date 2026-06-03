document.addEventListener("DOMContentLoaded", async () => {
    console.log('📊 学习统计页面初始化');
    
    // 从 localStorage 加载历史数据（兼容旧版）
    loadHistoryData();
    
    // 尝试从后端加载真实数据
    try {
        await loadRealTimeStats();
    } catch (error) {
        console.error('加载实时数据失败，使用本地数据:', error);
    }
});

// 从后端加载实时统计数据
async function loadRealTimeStats() {
    try {
        const response = await fetch('/api/learning/stats', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const result = await response.json();
        console.log('📊 后端返回的学习统计:', result);
        
        if (result.success && result.data) {
            const data = result.data;
            
            // 更新总体统计
            if (data.totalRecognitions !== undefined) {
                document.getElementById('totalRecognitions').textContent = data.totalRecognitions;
            }
            if (data.masteredCount !== undefined) {
                document.getElementById('masteredCount').textContent = data.masteredCount;
                document.getElementById('masteredCount2').textContent = data.masteredCount;
            }
            if (data.learningCount !== undefined) {
                document.getElementById('learningCount').textContent = data.learningCount;
                document.getElementById('learningCount2').textContent = data.learningCount;
            }
            
            // 计算未开始的手势数量
            const notStarted = 35 - data.masteredCount - data.learningCount;
            document.getElementById('notStartedCount').textContent = notStarted;
            
            // 更新进度条
            const totalGestures = 35;
            const progressPercent = ((data.masteredCount + data.learningCount) / totalGestures * 100).toFixed(1);
            document.getElementById('progressPercent').textContent = `${progressPercent}%`;
            document.getElementById('overallProgress').style.width = `${progressPercent}%`;
            
            // 更新趋势图
            if (data.weekData) {
                updateTrendChartWithData(data.weekData);
            }
            
            console.log('✅ 实时数据加载成功');
        }
    } catch (error) {
        console.warn('⚠️ 无法从后端加载数据，使用本地缓存:', error.message);
        // 如果后端不可用，继续使用本地数据
        calculateStats();
    }
}

// 使用趋势数据更新图表
function updateTrendChartWithData(weekData) {
    const labels = weekData.map(item => item.day || item.date);
    const values = weekData.map(item => item.count || 0);
    
    if (trendChart) {
        trendChart.data.labels = labels;
        trendChart.data.datasets[0].data = values;
        trendChart.update();
    } else {
        const ctx = document.getElementById('trendChart').getContext('2d');
        trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '识别次数',
                    data: values,
                    borderColor: '#d88932',
                    backgroundColor: 'rgba(216, 137, 50, 0.1)',
                    tension: 0.3,
                    fill: true,
                    pointBackgroundColor: '#d88932',
                    pointBorderColor: '#fff',
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
                    }
                }
            }
        });
    }
}




// 35类手语词汇（与后端保持一致）
const CLASS_NAMES = [
    "时间/时候", "你/您/你的/这", "早上", "9", "0",
    "快乐/高兴", "新", "祝", "请", "路",
    "生日", "平", "安", "朋友", "8",
    "认识", "名片", "结婚/妻子", "茶", "有",
    "花", "今天", "门", "停", "谢谢",
    "慢", "走", "晚", "我", "爱",
    "好", "人", "什么", "名字", "介绍"
];

// 全局变量
let recognitionHistory = [];
let gestureStats = {};
let trendChart = null;
let currentRange = 'week';

// 加载历史数据
function loadHistoryData() {
    const saved = localStorage.getItem('upload_recognition_history');
    if (saved) {
        recognitionHistory = JSON.parse(saved);
    }
    // 同时从 localStorage 加载学习统计（如果有）
    const savedStats = localStorage.getItem('learning_stats');
    if (savedStats) {
        gestureStats = JSON.parse(savedStats);
    }
    calculateStats();
}

// 计算统计数据
function calculateStats() {
    // 初始化手势统计
    const gestureCount = {};
    CLASS_NAMES.forEach(gesture => {
        gestureCount[gesture] = 0;
    });

    // 统计每个手势的出现次数
    recognitionHistory.forEach(item => {
        if (item.gesture && gestureCount[item.gesture] !== undefined) {
            gestureCount[item.gesture]++;
        }
    });

    // 计算掌握度（出现次数 >= 3 视为掌握，>=1 视为学习中）
    let mastered = 0;
    let learning = 0;
    let notStarted = 0;

    CLASS_NAMES.forEach(gesture => {
        const count = gestureCount[gesture] || 0;
        if (count >= 3) {
            mastered++;
        } else if (count >= 1) {
            learning++;
        } else {
            notStarted++;
        }
    });

    // 更新页面
    const total = recognitionHistory.length;
    const avgAccuracy = total > 0
        ? (recognitionHistory.reduce((sum, item) => sum + (item.confidence || 0.8), 0) / total * 100).toFixed(1)
        : 0;

    document.getElementById('totalRecognitions').textContent = total;
    document.getElementById('masteredCount').textContent = mastered;
    document.getElementById('learningCount').textContent = learning;
    document.getElementById('avgAccuracy').textContent = `${avgAccuracy}%`;

    document.getElementById('masteredCount2').textContent = mastered;
    document.getElementById('learningCount2').textContent = learning;
    document.getElementById('notStartedCount').textContent = notStarted;

    const progressPercent = (mastered / CLASS_NAMES.length * 100).toFixed(1);
    document.getElementById('progressPercent').textContent = `${progressPercent}%`;
    document.getElementById('overallProgress').style.width = `${progressPercent}%`;

    // 找出最高频手势
    let topGesture = '暂无';
    let topCount = 0;
    for (const [gesture, count] of Object.entries(gestureCount)) {
        if (count > topCount) {
            topCount = count;
            topGesture = gesture;
        }
    }

    // 渲染手势网格
    renderGestureGrid(gestureCount, mastered, learning);

    // 生成学习建议
    generateTips(mastered, learning, notStarted, topGesture);

    // 更新趋势图
    updateTrendChart();
}

// 渲染手势网格
function renderGestureGrid(gestureCount, mastered, learning) {
    const grid = document.getElementById('gestureGrid');
    if (!grid) return;

    const gestureList = CLASS_NAMES.map(gesture => {
        const count = gestureCount[gesture] || 0;
        let status = 'not-started';
        if (count >= 3) status = 'mastered';
        else if (count >= 1) status = 'learning';

        let statusText = '';
        if (status === 'mastered') statusText = '已掌握';
        else if (status === 'learning') statusText = '学习中';
        else statusText = '未开始';

        const progressPercent = Math.min(100, (count / 3) * 100);

        return `
                <div class="gesture-item" onclick="showGestureDetail('${gesture.replace(/'/g, "\\'")}', ${count})">
                    <div class="gesture-name">${gesture}</div>
                    <div class="gesture-progress">
                        <div class="gesture-progress-fill" style="width: ${progressPercent}%"></div>
                    </div>
                    <div class="gesture-count">练习 ${count} 次</div>
                    <span class="gesture-badge ${status}">${statusText}</span>
                </div>
            `;
    }).join('');

    grid.innerHTML = gestureList;
}

// 显示手势详情
window.showGestureDetail = function(gesture, count) {
    const status = count >= 3 ? '已掌握' : (count >= 1 ? '学习中' : '未开始');
    const needCount = Math.max(0, 3 - count);
    const message = `手势：${gesture}\n练习次数：${count} 次\n状态：${status}\n${needCount > 0 ? `还需练习 ${needCount} 次即可掌握` : '恭喜！已熟练掌握此手势'}`;
    alert(message);
};

// 生成学习建议
function generateTips(mastered, learning, notStarted, topGesture) {
    const tipsList = document.getElementById('tipsList');
    if (!tipsList) return;

    const tips = [];

    if (learning > 0) {
        tips.push(`📖 你还有 ${learning} 个手势正在学习中，每天练习5分钟效果更好`);
    }
    if (notStarted > 0) {
        tips.push(`🎯 有 ${notStarted} 个手势还未开始学习，可以从简单的开始尝试`);
    }
    if (topGesture !== '暂无') {
        tips.push(`⭐ 你最常用的手势是"${topGesture}"，继续加油！`);
    }
    if (mastered === CLASS_NAMES.length) {
        tips.push(`🏆 太棒了！你已经掌握了所有手势，继续练习保持熟练度`);
    } else {
        const remaining = CLASS_NAMES.length - mastered;
        tips.push(`🚀 距离掌握全部手势还差 ${remaining} 个，坚持下去！`);
    }

    tips.push('💪 定期复习已掌握的手势，可以保持熟练度');

    tipsList.innerHTML = tips.map(tip => `<li><span class="tips-icon">•</span> ${tip}</li>`).join('');
}

// 获取趋势数据
function getTrendData() {
    const now = new Date();
    const data = {};

    recognitionHistory.forEach(item => {
        const date = new Date(item.time);
        let key = '';

        if (currentRange === 'week') {
            const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
            if (diffDays < 7) {
                const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
                key = dayNames[date.getDay()];
            }
        } else if (currentRange === 'month') {
            const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
            if (diffDays < 30) {
                key = `${date.getMonth() + 1}/${date.getDate()}`;
            }
        } else {
            key = `${date.getFullYear()}-${date.getMonth() + 1}`;
        }

        if (key) {
            data[key] = (data[key] || 0) + 1;
        }
    });

    return data;
}

// 更新趋势图表
function updateTrendChart() {
    const data = getTrendData();
    const labels = Object.keys(data);
    const values = Object.values(data);

    if (labels.length === 0) {
        if (trendChart) {
            trendChart.data.labels = ['暂无数据'];
            trendChart.data.datasets[0].data = [0];
            trendChart.update();
        }
        return;
    }

    const ctx = document.getElementById('trendChart').getContext('2d');

    if (trendChart) {
        trendChart.data.labels = labels;
        trendChart.data.datasets[0].data = values;
        trendChart.update();
    } else {
        trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '识别次数',
                    data: values,
                    borderColor: '#d88932',
                    backgroundColor: 'rgba(216, 137, 50, 0.1)',
                    tension: 0.3,
                    fill: true,
                    pointBackgroundColor: '#d88932',
                    pointBorderColor: '#fff',
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `识别次数: ${context.raw}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }
}

// 切换时间范围
document.querySelectorAll('.range-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentRange = btn.dataset.range;
        updateTrendChart();
    });
});