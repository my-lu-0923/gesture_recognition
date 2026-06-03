document.addEventListener("DOMContentLoaded", async () => {
    const body = document.getElementById("libraryBody");
    const loadingHtml = `<tr><td colspan="5" style="text-align:center;color:#888;">加载中...</td></tr>`;
    body.innerHTML = loadingHtml;
    
    try {
        const res = await SignAPI.getGestureLibrary();
        if (!res.success || !res.data || res.data.length === 0) {
            body.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#888;">暂无数据</td></tr>`;
            return;
        }
        body.innerHTML = res.data.map(i => `
            <tr>
                <td>${i.gestureName || "-"}</td>
                <td>${i.category || i.description || "-"}</td>
                <td>${i.difficulty || 1}</td>
                <td>${i.usageCount || i.studyCount || 0}</td>
                <td>${i.masteryLevel || 0}</td>
            </tr>
        `).join("");
    } catch (error) {
        console.error('加载手势库失败:', error);
        body.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#f00;">加载失败</td></tr>`;
    }
});
