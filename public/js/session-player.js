document.addEventListener('DOMContentLoaded', () => {

    // 声明一个变量来存储定时器 ID，方便跳转时清除它
    let syncInterval = null;

    async function updateWaitingRoom() {
        try {
            // 1. 获取并渲染玩家列表
            const res = await fetch(`/get-players/${SESSION_ID}`);
            const data = await res.json();
            const listEl = document.getElementById('playersList');

            if (listEl) {
                listEl.innerHTML = '';
                data.players.forEach(p => {
                    const pill = document.createElement('div');
                    pill.className = 'player-pill';
                    pill.innerHTML = `
                        <img src="/images/${p.img_id}.png" class="pill-bg-img">
                        <span class="pill-name">${p.player_name}</span>
                    `;
                    listEl.appendChild(pill);
                });
            }

            // 2. 检查游戏是否已经开始
            const statusRes = await fetch(`/check-game-status/${SESSION_ID}`);
            const statusData = await statusRes.json();

            // 【核心修改点】：当检测到 started 为 true 时
            if (statusData && statusData.started) {

                // A. 立即停止轮询，防止重复触发跳转
                if (syncInterval) clearInterval(syncInterval);

                // B. 显示我们在 Pug 里准备好的 Loading 遮罩
                const overlay = document.getElementById('loadingOverlay');
                if (overlay) {
                    overlay.style.display = 'flex';
                }

                // C. 稍微延迟 1.2s - 1.5s，让玩家有心理准备，也让“透明感”动画播完
                setTimeout(() => {
                    // 跳转到你后端路由定义的路径
                    window.location.href = `/game-start/${statusData.roomCode}`;
                }, 1200);
            }
        } catch (err) {
            console.error("Sync error:", err);
        }
    }

    // 每 2 秒同步一次
    syncInterval = setInterval(updateWaitingRoom, 2000);

    // 退出按钮
    const exitBtn = document.getElementById('exitBtn');
    if (exitBtn) {
        exitBtn.onclick = async () => {
            const sure = confirm("Are you sure you want to exit? Your progress will be DELETED from the server.");

            if (sure) {
                try {
                    const response = await fetch('/exit-session', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            sessionId: SESSION_ID,
                            userId: MY_USER_ID
                        })
                    });

                    const result = await response.json();
                    if (result.success) {
                        // 物理删除成功后，才跳转回首页
                        window.location.href = '/';
                    } else {
                        alert("Could not exit: " + (result.message || "Unknown error"));
                    }
                } catch (err) {
                    console.error("Exit request failed:", err);
                    alert("Network error. Could not delete your session.");
                }
            }
        };
    }
});