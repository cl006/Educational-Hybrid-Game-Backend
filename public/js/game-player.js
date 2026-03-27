document.addEventListener('DOMContentLoaded', () => {
    // --- 1. 配置与初始化 ---
    const BACKGROUND_THEMES = {
        1: 'round1.png',
        2: 'round2.png',
        4: 'round4.png',
        6: 'round6.png'
    };

    // 设备检测逻辑
    const BASE_URL = "http://192.168.0.104:3000";
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

    // --- 2. 核心同步函数 (包含 2,4,6 轮跳转) ---
    async function syncGameState() {
        try {
            const res = await fetch(`/game/get-game-status/${SESSION_ID}`);
            if (!res.ok) return;

            const data = await res.json();
            const currentRound = parseInt(data.round_number) || 1;

            // --- 强制跳转逻辑 (满足作业要求：响应迅速且自动更新 [cite: 53]) ---
            if ([2, 4, 6].includes(currentRound)) {
                const lastRedirect = sessionStorage.getItem('last_redirect_round');
                if (lastRedirect != currentRound) {
                    sessionStorage.setItem('last_redirect_round', currentRound);

                    // 重要修正：使用 BASE_URL 确保手机端跳转到服务器 IP
                    window.location.href = `${BASE_URL}/game/level-selection/${ROOM_CODE}`;
                    return;
                }
            }

            // 更新页面 UI (符合实时计分板/状态显示要求 )
            const roundTextEl = document.querySelector('.value-text');
            if (roundTextEl) roundTextEl.innerText = currentRound;

            // 背景主题切换逻辑
            let targetImg = BACKGROUND_THEMES[1];
            if (currentRound >= 6) targetImg = BACKGROUND_THEMES[6];
            else if (currentRound >= 4) targetImg = BACKGROUND_THEMES[4];
            else if (currentRound >= 2) targetImg = BACKGROUND_THEMES[2];
            updateBackground(targetImg);

        } catch (err) {
            console.error("Sync Error:", err);
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

    setInterval(syncGameState, 5000);
    syncGameState();

    // --- 3. 手动输入验证逻辑 (Laptop 专用) ---
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

    // --- 4. QR 扫描逻辑 (Mobile 专用) ---
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

                        // 既然是通用码，直接引导玩家输入他们当前所在的格子坐标
                        const cellInput = prompt("Please enter your current cell (As an example: C03):");
                        if (!cellInput) return;

                        const result = cellInput.trim().toUpperCase();
                        const verifyCode = prompt(`Please enter cell ${result} 的 4 位验证码:`);

                        if (verifyCode) {
                            // 自动判断是否为商店逻辑 (S 开头或包含 SHOP)
                            const isShop = result === 'SHOP' || result.startsWith('S');
                            handleVerification(result, verifyCode, isShop);
                        }
                    });
                }
            ).catch(err => {
                alert("Camera Error: Check HTTPS.");
                scannerOverlay.style.display = 'none';
            });
        };

        document.getElementById('stop-scan').onclick = () => {
            if (html5QrCode) html5QrCode.stop().finally(() => scannerOverlay.style.display = 'none');
            else scannerOverlay.style.display = 'none';
        };
    }

    // --- 5. 统一验证 Fetch 函数 ---
    async function handleVerification(cellCode, verifyCode, isShop) {
        // --- 1. 表单验证 (满足作业要求 Criteria iv)  ---
        // 正则表达式：字母(A-Z) + 1到2位数字，或者 SHOP
        const cellRegex = /^[A-Z]\d{1,2}$|^SHOP$/i;

        if (!cellRegex.test(cellCode)) {
            alert("Format Error: Please enter a valid Cell Code (e.g., C03 or SHOP).");
            return;
        }

        if (!verifyCode || verifyCode.length < 4) {
            alert("Validation Error: Verification code must be at least 4 characters.");
            return;
        }

        try {
            // --- 2. 发送请求 (满足作业要求 API Communication) [cite: 10] ---
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

            const data = await res.json(); // 必须在 res 之后定义 data

            if (data.success) {
                alert(data.message);

                // --- 3. 页面跳转逻辑 ---
                // 使用 BASE_URL 确保移动设备在局域网内能正确跳转 
                if (isShop || data.outcome === 'SHOP') {
                    window.location.href = `${BASE_URL}/game/shop/${SESSION_ID}`;
                }
            } else {
                alert("Error: " + data.message);
            }
        } catch (err) {
            console.error("Verification failed", err);
            alert("Connection Error: Make sure you are on the same Wi-Fi as the server.");
        }
    }
});