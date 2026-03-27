/**
 * 自定义弹窗辅助函数
 * @param {string} title - 标题
 * @param {string} msg - 消息内容
 * @param {boolean} isPrompt - 是否需要输入框
 * @returns {Promise} - 返回输入内容或布尔值
 */
function showModal(title, msg, isPrompt = false) {
    return new Promise((resolve) => {
        const modal = document.getElementById('customModal');
        const inputContainer = document.getElementById('modalInputContainer');
        const inputField = document.getElementById('modalInput');

        document.getElementById('modalTitle').innerText = title;
        document.getElementById('modalMessage').innerText = msg;
        inputContainer.style.display = isPrompt ? 'block' : 'none';
        inputField.value = ""; // 重置输入框内容

        modal.style.display = 'flex';

        // 确认点击
        document.getElementById('modalConfirm').onclick = () => {
            modal.style.display = 'none';
            resolve(isPrompt ? inputField.value : true);
        };

        // 取消点击
        document.getElementById('modalCancel').onclick = () => {
            modal.style.display = 'none';
            resolve(null); // 返回空表示取消
        };
    });
}

// --- EXIT 按钮逻辑 ---
document.getElementById('exitBtn').onclick = async () => {
    // 替代第一个 confirm
    const wantToEnd = await showModal("TERMINATE SESSION?", "Do you want to END the game permanently and record the time?");

    if (wantToEnd) {
        try {
            const response = await fetch('/end-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: roomSessionId })
            });
            const data = await response.json();
            if (data.success) {
                await showModal("GAME ENDED", "Final results recorded. Goodbye!");
                window.location.href = '/';
            }
        } catch (err) {
            console.error("Error:", err);
        }
    } else {
        // 替代第二个 confirm
        const wantToLeave = await showModal("PAUSE GAME?", "Temporary leave the dashboard? (Players can stay)");

        if (wantToLeave) {
            window.location.href = '/';
        } else {
            console.log("Host chose to stay.");
        }
    }
};

// --- NEXT ROUND 按钮逻辑 ---
// --- NEXT ROUND 按钮逻辑 (优化版) ---
document.getElementById('nextRoundBtn').onclick = async () => {
    // 1. 确认所有玩家是否完成
    const isFinished = await showModal("NEXT ROUND", "Does everyone finish their round?");

    if (isFinished === true) {
        // 2. 身份验证：输入 Host ID
        const hostIdInput = await showModal("SECURITY CHECK", "Please enter Host User ID to confirm:", true);

        // 如果用户点击取消或未输入任何内容，直接退出
        if (!hostIdInput) return;

        if (!roomSessionId) {
            await showModal("ERROR", "Session ID missing. Please refresh the page.");
            return;
        }

        try {
            const response = await fetch('/next-round-trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: roomSessionId,
                    hostId: hostIdInput
                })
            });

            const data = await response.json();

            if (data.success) {
                // 3. 更新界面上的回合数显示
                const inputField = document.getElementById('roundInput');
                if (inputField) {
                    inputField.value = data.newRound;

                    // 💡 关键：回合数更新后，立即触发底部按钮状态检查
                    // 这样如果到了 Round 7，END GAME 按钮会立刻显示
                    updateBottomButtons();
                }

                await showModal("SUCCESS", `Round ${data.newRound} has officially started!`);
            } else {
                // 如果后端验证失败（比如 Host ID 错误）
                await showModal("DENIED", data.message || "Unauthorized access.");
            }
        } catch (err) {
            console.error("Next Round Error:", err);
            await showModal("SYSTEM ERROR", "Connection failed. Please check your server status.");
        }
    }
};

async function openSpecialModal() {
    const modal = document.getElementById('specialCellModal');
    const container = document.getElementById('cellTableBody');

    modal.style.display = 'flex';
    container.innerHTML = '<div style="text-align:center; color:#D8B56A; padding:20px;">Loading...</div>';

    try {
        const response = await fetch(`/special-cells/${roomSessionId}`);
        const data = await response.json();

        if (data.success) {
            // 使用 div 结构配合 flex 布局实现左右分布
            container.innerHTML = data.cells.map(item => `
                <div class="cell-row">
                    <span class="cell-name">${item.cell_no}</span>
                    <span class="code-red">${item.verify_code}</span>
                </div>
            `).join('');
        }
    } catch (err) {
        console.error("Fetch Error:", err);
    }
}

function filterCells() {
    const query = document.getElementById('cellSearchInput').value.trim().toUpperCase();
    const rows = document.querySelectorAll('.cell-row');

    rows.forEach(row => {
        const cellNo = row.querySelector('.cell-name').innerText.toUpperCase();
        row.style.display = cellNo.includes(query) ? "flex" : "none";
    });
}

function closeSpecialModal() {
    document.getElementById('specialCellModal').style.display = 'none';
}

async function openTreasureModal() {
    const modal = document.getElementById('treasureModal');
    const container = document.getElementById('treasureTableBody');

    modal.style.display = 'flex';
    container.innerHTML = '<div style="text-align:center; color:#D8B56A; padding:20px;">SCANNING SENSORS...</div>';

    try {
        const response = await fetch(`/treasures/${roomSessionId}`);
        const data = await response.json();

        if (data.success) {
            container.innerHTML = data.treasures.map(item => {
                // 根据真假判断颜色和文字
                const statusText = item.is_real ? "REAL" : "FAKE";
                const statusColor = item.is_real ? "#2ecc71" : "#95a5a6"; // 真为绿色，假为灰色

                return `
                    <div class="cell-row treasure-row">
                        <div class="cell-name">
                            <span style="display:block; font-size:0.8rem; opacity:0.7;">${item.treasure_id}</span>
                            <span>${item.cell_code}</span>
                        </div>
                        <span style="color: ${statusColor}; font-weight: bold; font-family: 'Courier New';">${statusText}</span>
                    </div>
                `;
            }).join('');
        }
    } catch (err) {
        container.innerHTML = '<div style="color:red; text-align:center;">SCANNER ERROR</div>';
    }
}

function filterTreasures() {
    const query = document.getElementById('treasureSearchInput').value.trim().toUpperCase();
    const rows = document.querySelectorAll('.treasure-row');

    rows.forEach(row => {
        const text = row.innerText.toUpperCase();
        row.style.display = text.includes(query) ? "flex" : "none";
    });
}

function closeTreasureModal() {
    document.getElementById('treasureModal').style.display = 'none';
}

// --- Shop Modal 逻辑 ---
async function openShopModal() {
    const modal = document.getElementById('shopModal');
    const display = document.getElementById('displayShopCode');

    // 显示弹窗并重置文字
    modal.style.display = 'flex';
    display.innerText = "....";

    try {
        // 确保你的后端有这个 /shop-code/ 接口
        const response = await fetch(`/shop-code/${roomSessionId}`);
        const data = await response.json();

        if (data.success) {
            display.innerText = data.shopCode; // 数据库中的验证码
        } else {
            display.innerText = "N/A";
        }
    } catch (err) {
        console.error("Shop Code Fetch Error:", err);
        display.innerText = "ERR";
    }
}

function closeShopModal() {
    document.getElementById('shopModal').style.display = 'none';
}

let monitorInterval;

function openMonitorModal() {
    document.getElementById('monitorModal').style.display = 'flex';
    updateMonitor(); // Initial load
    // Start real-time refresh every 3 seconds
    monitorInterval = setInterval(updateMonitor, 3000);
}

function closeMonitorModal() {
    document.getElementById('monitorModal').style.display = 'none';
    clearInterval(monitorInterval); // Stop refresh when closed
}

async function updateMonitor() {
    const round = document.getElementById('monitorRoundPicker').value;
    try {
        // 注意：确保 roomSessionId 在前端已经定义（通常在 Pug 的 script 标签里）
        const response = await fetch(`/host/monitor/${roomSessionId}?round=${round}`);
        const result = await response.json();

        if (result.success) {
            const tbody = document.getElementById('monitorTableBody');

            if (result.data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Waiting for players to join...</td></tr>`;
                return;
            }

            tbody.innerHTML = result.data.map(p => `
                <tr>
                    <td>${p.player_id}</td>
                    <td><strong>${p.player_name}</strong></td>
                    <td>${p.cards_held || '<span style="color: #555">None</span>'}</td>
                    <td>${p.treasures_found || '<span style="color: #555">None</span>'}</td>
                    <td class="stat-real" style="color: ${p.real_count > 0 ? '#2ecc71' : '#555'}">${p.real_count}</td>
                    <td class="stat-fake" style="color: ${p.fake_count > 0 ? '#e74c3c' : '#555'}">${p.fake_count}</td>
                </tr>
            `).join('');

            // 更新下拉框：只有当选项数量不够时才添加
            const picker = document.getElementById('monitorRoundPicker');
            const currentOptionsCount = picker.options.length - 1; // 减去 "All Rounds"
            if (currentOptionsCount < result.currentRound) {
                for (let i = currentOptionsCount + 1; i <= result.currentRound; i++) {
                    picker.add(new Option(`Round ${i}`, i));
                }
            }
        }
    } catch (err) {
        console.error("Monitor refresh failed", err);
    }
}

// 处理结束游戏的点击
async function confirmEndGame() {
    // 1. 弹出确认框
    const isSure = await showModal("FINAL SETTLEMENT", "Are you sure you want to END the game? This will calculate rankings based on treasures and coins.", false);

    if (isSure) {
        try {
            // 2. 调用带有排名计算逻辑的后端接口
            const response = await fetch(`/end/${roomSessionId}`, { method: 'POST' });
            const result = await response.json();

            if (result.success) {
                await showModal("GAME CONCLUDED", "Rankings have been calculated. Moving to the results hall...");
                // 3. 跳转到结果页
                window.location.href = `/results/${roomSessionId}`;
            } else {
                await showModal("ERROR", "Failed to finalize game data.");
            }
        } catch (err) {
            console.error("End game failed:", err);
            await showModal("SYSTEM ERROR", "Connection lost. Please check server console.");
        }
    }
}

// 修改你的 updateBottomButtons 确保它能响应 Round 变化
function updateBottomButtons() {
    const roundInput = document.getElementById('roundInput');
    if (!roundInput) return;

    const currentRound = parseInt(roundInput.value);
    const exitBtn = document.getElementById('exitBtn');
    const endBtn = document.getElementById('endGameBtn');

    // 💡 只有在第 7 轮或以上时切换按钮
    if (currentRound >= 7) {
        if (exitBtn) exitBtn.style.display = 'none';
        if (endBtn) endBtn.style.display = 'block';
    } else {
        if (exitBtn) exitBtn.style.display = 'block';
        if (endBtn) endBtn.style.display = 'none';
    }
}
document.addEventListener('DOMContentLoaded', () => {
    // 1. 初始化底部按钮状态
    updateBottomButtons();

    // 2. 绑定 Next Round 按钮（因为你之前是用 .onclick 绑定的，这里确保 ID 正确）
    const nextBtn = document.getElementById('nextRoundBtn');
    // 如果你在上面的代码中已经写了 nextBtn.onclick，这里可以省略，
    // 但建议检查是否所有的按钮都在 DOM 加载后正确绑定。
});