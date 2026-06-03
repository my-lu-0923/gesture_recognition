document.addEventListener("DOMContentLoaded", async () => {
    try {
        const res = await SignAPI.getLearningStats();
        if (!res.success || !res.data) {
            showError();
            return;
        }
        const data = res.data;
        document.getElementById("totalRecognitions").textContent = data.totalRecognitions || data.totalRecognitions === 0 ? data.totalRecognitions : 0;
        document.getElementById("masteredCount").textContent = data.masteredCount || data.masteredCount === 0 ? data.masteredCount : 0;
        document.getElementById("learningCount").textContent = data.learningCount || data.learningCount === 0 ? data.learningCount : 0;
        document.getElementById("topGesture").textContent = data.topGesture || "-";
    } catch (error) {
        console.error('加载学习统计失败:', error);
        showError();
    }
});

function showError() {
    document.getElementById("totalRecognitions").textContent = "0";
    document.getElementById("masteredCount").textContent = "0";
    document.getElementById("learningCount").textContent = "0";
    document.getElementById("topGesture").textContent = "-";
}

function setProfile() {
    if (typeof auth === "undefined") return;
    const user = auth.getUser();
    if (!user) return;
    document.getElementById("username").textContent = user.name || "演示用户";
    document.getElementById("avatar").textContent = (user.avatar || "用").slice(0, 1);
}

async function loadStats() {
    const stats = await SignAPI.getHistoryStats();
    if (!stats.success) return;
    document.getElementById("totalCount").textContent = stats.totalCount || 0;
    document.getElementById("todayCount").textContent = stats.todayCount || 0;
    document.getElementById("topGesture").textContent = stats.topGesture || "-";
}

async function loadHistory() {
    const res = await SignAPI.getHistoryList(0, 100);
    const tbody = document.getElementById("historyTableBody");
    if (!res.success || !res.data || res.data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#888;">暂无记录</td></tr>`;
        return;
    }
    tbody.innerHTML = res.data.map(row => `
        <tr>
            <td>${row.formattedTime || ""}</td>
            <td><span class="badge success">${row.gesture || "-"}</span></td>
            <td>${Math.round((row.confidence || 0) * 100)}%</td>
            <td>${row.aiReply || "-"}</td>
            <td><button class="btn btn-small btn-danger" onclick="deleteRow(${row.id})">删除</button></td>
        </tr>
    `).join("");
}

async function deleteRow(id) {
    await SignAPI.deleteHistoryItem(id);
    await loadHistory();
    await loadStats();
}

async function clearAll() {
    await SignAPI.clearHistory();
    await loadHistory();
    await loadStats();
}

async function exportAll() {
    const res = await SignAPI.exportHistory();
    if (!res.success || !res.data) return;
    const header = "时间，手势，置信度，回复";
    const rows = res.data.map(i => `${i.formattedTime || ""},${i.gesture || ""},${Math.round((i.confidence || 0) * 100)}%,${(i.aiReply || "").replaceAll(",", "，")}`);
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "history.csv";
    a.click();
}

let refreshInterval = null;

async function startAutoRefresh() {
    await loadHistory();
    await loadStats();
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(async () => {
        await loadHistory();
        await loadStats();
    }, 3000);
}

document.addEventListener("DOMContentLoaded", async () => {
    setProfile();
    document.getElementById("clearBtn").addEventListener("click", clearAll);
    document.getElementById("exportBtn").addEventListener("click", exportAll);
    await startAutoRefresh();
});

window.addEventListener('beforeunload', () => {
    if (refreshInterval) clearInterval(refreshInterval);
});
