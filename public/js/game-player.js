document.addEventListener('DOMContentLoaded', () => {
    // --- 1. 配置与初始化 (Hybrid Cloud Architecture) ---
    const BACKGROUND_THEMES = {
        1: 'round1.png',
        2: 'round2.png',
        4: 'round4.png',
        6: 'round6.png'
    };

    // 关键修正：自动获取当前域名（Cloudflare Pages 或 Tunnel 域名）
    const BASE_URL = window.location.origin;

    // 设备检测逻辑
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const mobileZone = document.querySelector('.mobile-only');
    const desktopZone = document.querySelector('.desktop-only');

    if (isMobile) {
        if (mobileZone) mobileZone.style.display = 'block';
        if (desktopZone) desktopZone.style.display = 'none';
    } else {
        if (mobileZone) mobileZone.style.display = 'none';
        if (desktopZone) desktopZone.style.display = 'block';
    }

    // --- 2. 核心同步函数 (Cloudflare Tunnel 兼容版) ---
    async function syncGameState() {
        try {
            // 使用相对路径，确保请求通过 Cloudflare Proxy 转发到本地后端
            const res = await fetch(`/game/get-game-status/${SESSION_ID}`);
            if (!res.ok) return;

            const data = await res.json();
            const currentRound = parseInt(data.round_number) || 1;

            // --- 强制跳转逻辑 (满足作业要求：响应迅速且自动更新) ---
            if ([2, 4, 6].includes(currentRound)) {
                const lastRedirect = sessionStorage.getItem('last_redirect_round');
                if (lastRedirect != currentRound) {
                    sessionStorage.setItem('last_redirect_round', currentRound);

                    // 动态跳转至级别选择页面
                    window.location.href = `${BASE_URL}/game/level-selection/${ROOM_CODE}`;
                    return;
                }
            }

            // 更新 UI
            const roundTextEl = document.querySelector('.value-text');
            if (roundTextEl) roundTextEl.innerText = currentRound;

            // 背景主题切换
            let targetImg = BACKGROUND_THEMES[1];
            if (currentRound >= 6) targetImg = BACKGROUND_THEMES[6];
            else if (currentRound >= 4) targetImg = BACKGROUND_THEMES[4];
            else if (currentRound >= 2) targetImg = BACKGROUND_THEMES[2];
            updateBackground(targetImg);

        } catch (err) {
            console.warn("Sync temporarily unavailable (Tunnel Check):", err);
        }
    }

    function updateBackground(imgName) {
        const bgImg = document.querySelector('.media-background img');
        if (!bgImg || bgImg.src.includes(imgName)) return;
        bgImg.style.transition = 'opacity 0.8s ease-in-out';
        bgImg.style.opacity = '0';
        setTimeout(() => {
            bgImg.src = `/images/${imgName}`;
            bgImg.onload = () => { bgImg.style.opacity = '0.6'; };
        }, 800);
    }

    // 轮询时间保持在 5 秒，平衡 Cloudflare 流量负载与实时性
    setInterval(syncGameState, 5000);
    syncGameState();

    // --- 3. 手动输入验证逻辑 ---
    const manualBtn = document.getElementById('manualSubmit');
    if (manualBtn) {
        manualBtn.onclick = () => {
            const cell = document.getElementById('manualCell').value.trim().toUpperCase();
            const verify = document.getElementById('manualVerify').value.trim();
            if (!cell || !verify) return alert("Please enter both codes.");

            const isShop = cell === 'SHOP' || cell.startsWith('S');
            handleVerification(cell, verify, isShop);
        };
    }

    // --- 4. QR 扫描逻辑 (配合 Cloudflare Pages 静态部署) ---
    const scanBtn = document.querySelector('.mobile-only .btn-scan');
    if (scanBtn) {
        const scannerOverlay = document.createElement('div');
        scannerOverlay.id = 'scanner-overlay';
        scannerOverlay.style = "display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:10000; flex-direction:column; align-items:center; justify-content:center;";
        scannerOverlay.innerHTML = `
            <div id="reader" style="width:300px; background:white; border-radius:15px; overflow:hidden; border: 4px solid #D8B56A;"></div>
            <button id="stop-scan" class="btn-pill" style="margin-top:20px; background:#ff4757; color:white; padding:10px 30px; border:none; cursor:pointer;">CANCEL</button>
        `;
        document.body.appendChild(scannerOverlay);

        let html5QrCode = null;
        scanBtn.onclick = () => {
            scannerOverlay.style.display = 'flex';
            if (html5QrCode) html5QrCode.clear();
            html5QrCode = new Html5Qrcode("reader");
            html5QrCode.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: 250 },
                (decodedText) => {
                    html5QrCode.stop().then(() => {
                        scannerOverlay.style.display = 'none';

                        // 连续弹窗引导输入
                        const cellInput = prompt("SCAN SUCCESS! Enter Grid ID (e.g., C03 or SHOP):");
                        if (!cellInput) return;

                        const verifyInput = prompt(`Enter 4-digit code for [${cellInput.toUpperCase()}]:`);
                        if (!verifyInput) return;

                        const isShop = (cellInput.toUpperCase() === 'SHOP');
                        handleVerification(cellInput, verifyInput, isShop);
                    });
                }
            ).catch(err => {
                alert("Camera Error: Ensure you are on HTTPS (Cloudflare).");
                scannerOverlay.style.display = 'none';
            });
        };

        document.getElementById('stop-scan').onclick = () => {
            if (html5QrCode) html5QrCode.stop().finally(() => scannerOverlay.style.display = 'none');
            else scannerOverlay.style.display = 'none';
        };
    }

    // --- 5. 统一验证 Fetch 函数 (关键：处理 Cloudflare Proxy) ---
    async function handleVerification(cellCode, verifyCode, isShop) {
        if (manualBtn) manualBtn.innerText = "VERIFYING...";

        try {
            const res = await fetch('/game/submit-verification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: SESSION_ID,
                    cellCode: cellCode.toUpperCase(),
                    verifyCode,
                    isShop
                })
            });

            const data = await res.json();

            if (data.success) {
                // --- A. 商店跳转逻辑 ---
                if (data.outcome === 'SHOP') {
                    alert("SHOP AUTHORIZED!");
                    window.location.href = `${BASE_URL}/game/shop/${SESSION_ID}`;
                    return;
                }

                // --- B. 空格子逻辑 ---
                if (data.redirectType === 'NONE') {
                    alert("🕳️ This cell is empty. Reward: Nothing happens.");
                    return;
                }

                // --- C. 挑战分流逻辑 (TREASURE, MOVEMENT, SWAP) ---
                if (data.redirectType) {
                    const level = data.redirectType.toLowerCase(); // easy, medium, hard
                    const eventName = data.outcome; // TREASURE, etc.

                    alert(`${eventName} DETECTED!\nStarting ${data.redirectType} challenge...`);

                    // 跳转到统一的题目页面，带上难度参数
                    window.location.href = `${BASE_URL}/game/question-page/${SESSION_ID}?level=${level}&cell=${cellCode.toUpperCase()}`;
                }

            } else {
                alert(" DENIED: " + data.message);
            }
        } catch (err) {
            console.error("Verification failed", err);
            alert("Connection Error: Cloudflare Tunnel could not reach the local server.");
        } finally {
            if (manualBtn) manualBtn.innerText = "SUBMIT";
        }
    }
});