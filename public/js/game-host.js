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
            const response = await fetch('/game/end-session', {
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
document.getElementById('nextRoundBtn').onclick = async () => {
    // 替代确认进度 confirm
    const isFinished = await showModal("NEXT ROUND", "Does everyone finish their round?");

    if (isFinished) {
        // 替代 prompt
        const hostIdInput = await showModal("SECURITY CHECK", "Please enter Host User ID to confirm:", true);

        if (!hostIdInput) return; // 取消或未输入

        if (!roomSessionId) {
            await showModal("ERROR", "Session ID missing. Please refresh.");
            return;
        }

        try {
            const response = await fetch('/game/next-round-trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: roomSessionId,
                    hostId: hostIdInput
                })
            });

            const data = await response.json();
            if (data.success) {
                const inputField = document.getElementById('roundInput');
                if (inputField) inputField.value = data.newRound;
                await showModal("SUCCESS", "Round " + data.newRound + " has officially started!");
            } else {
                await showModal("DENIED", data.message);
            }
        } catch (err) {
            await showModal("SYSTEM ERROR", "Connection failed. Please check your server.");
        }
    }
};

async function openSpecialModal() {
    const modal = document.getElementById('specialCellModal');
    const container = document.getElementById('cellTableBody');

    modal.style.display = 'flex';
    container.innerHTML = '<div style="text-align:center; color:#D8B56A; padding:20px;">Loading...</div>';

    try {
        const response = await fetch(`/game/special-cells/${roomSessionId}`);
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
        const response = await fetch(`/game/treasures/${roomSessionId}`);
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
        // 确保你的后端有这个 /game/shop-code/ 接口
        const response = await fetch(`/game/shop-code/${roomSessionId}`);
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