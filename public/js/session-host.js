document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('qrCanvas');
    const exitBtn = document.getElementById('exitBtn');
    const startBtn = document.getElementById('startBtn');

    // --- 1. 生成 QR 码 ---
    if (canvas) {
        // 核心修改：生成包含房间代码的完整 URL
        const joinUrl = `${window.location.origin}/?joinCode=${ROOM_CODE}`;
        console.log("the code url", joinUrl); // 调试用

        QRCode.toCanvas(canvas, joinUrl, {
            width: 150,
            margin: 2,
            color: {
                dark: "#D8B56A", // 金色二维码
                light: "#FFFFFF"
            }
        }, (error) => {
            if (error) console.error("二维码生成失败:", error);
        });
    }

    // --- 2. 轮询获取玩家列表 ---
    async function updatePlayerList() {
        try {
            const res = await fetch(`/get-players/${SESSION_ID}`);
            const data = await res.json();

            const players = data.players; // 这是一个包含 {player_name, img_id} 的数组
            const maxSlots = 6;

            // 更新顶部人数显示
            const titleEl = document.querySelector('.title-group h1');
            if (titleEl) {
                titleEl.innerText = `Players Joined: ${players.length}`;
            }

            // 遍历 6 个格子
            for (let i = 1; i <= maxSlots; i++) {
                const slot = document.getElementById(`slot-${i}`);
                const player = players[i - 1]; // 获取对应位置的玩家数据

                // 在 updatePlayerList 函数内部的循环里：
                if (player) {
                    if (!slot.classList.contains('occupied') || slot.dataset.playerId !== player.player_name) {
                        slot.classList.add('occupied');
                        slot.dataset.playerId = player.player_name;

                        // 确保路径是 /images/数字.png
                        slot.innerHTML = `
                            <img src="/images/${player.img_id}.png" class="slot-bg-img">
                            <div class="name-label">${player.player_name}</div>
                        `;
                    }
                } else {
                    // --- 情况 B: 还是空位 ---
                    if (slot.classList.contains('occupied') || slot.innerHTML === "") {
                        slot.classList.remove('occupied');
                        slot.removeAttribute('data-player-id');
                        slot.innerHTML = `<span class="waiting-text">Waiting...</span>`;
                    }
                }
            }
        } catch (err) {
            console.error("实时更新失败:", err);
        }
    }

    // 每 2 秒检查一次新玩家
    const pollInterval = setInterval(updatePlayerList, 2000);

    // --- 3. EXIT 按钮逻辑 ---
    if (exitBtn) {
        exitBtn.onclick = async () => {
            if (confirm("Are you sure you want to close this session? All players will be kicked.")) {
                try {
                    const res = await fetch('/end-session', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sessionId: SESSION_ID })
                    });
                    if (res.ok) {
                        clearInterval(pollInterval);
                        window.location.href = '/';
                    }
                } catch (err) {
                    alert("Failed to end session");
                }
            }
        };
    }

    // --- 4. START 按钮逻辑 ---
    if (startBtn) {
        startBtn.onclick = async () => {
            try {
                const res = await fetch('/start-game-trigger', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId: SESSION_ID })
                });
                const data = await res.json();
                if (data.success) {
                    clearInterval(pollInterval);
                    window.location.href = `/game-start/${ROOM_CODE}`;
                } else {
                    alert("Could not start game. Ensure players have joined.");
                }
            } catch (err) {
                alert("Error starting game");
            }
        };
    }
});