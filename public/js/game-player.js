document.addEventListener('DOMContentLoaded', () => {
    // --- 1. 配置与初始化 ---
    const BACKGROUND_THEMES = {
        1: 'round1.png',
        2: 'round2.png',
        4: 'round4.png',
        6: 'round6.png'
    };

    const BASE_URL = window.location.origin;

    // 关键变量：从全局或 Pug 传入的变量获取
    // 确保你的 Pug 里有 script. const SESSION_ID = "#{room.session_id}";
    const session_id = typeof SESSION_ID !== 'undefined' ? SESSION_ID : "";
    const room_code = typeof ROOM_ACCESS_CODE !== 'undefined' ? ROOM_ACCESS_CODE : "";

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
        if (!session_id) return;
        try {
            const res = await fetch(`/get-game-status/${session_id}`);
            if (!res.ok) return;

            const data = await res.json();
            const currentRound = parseInt(data.round_number) || 1;

            // 在 syncGameState 内部
            if ([2, 4, 6].includes(currentRound)) {
                const lastRedirect = sessionStorage.getItem('last_redirect_round');
                if (lastRedirect != currentRound) {
                    sessionStorage.setItem('last_redirect_round', currentRound);

                    // ✅ 修正跳转路径为 question-level
                    window.location.href = `/question-level/${session_id}?mode=ROUND&round=${currentRound}`;
                }
            }

            // 更新 UI 轮次文本
            const roundTextEl = document.querySelector('.value-text');
            if (roundTextEl) roundTextEl.innerText = currentRound;

            // 背景主题切换
            let targetImg = BACKGROUND_THEMES[1];
            if (currentRound >= 6) targetImg = BACKGROUND_THEMES[6];
            else if (currentRound >= 4) targetImg = BACKGROUND_THEMES[4];
            else if (currentRound >= 2) targetImg = BACKGROUND_THEMES[2];
            updateBackground(targetImg);

        } catch (err) {
            console.warn("Sync temporarily unavailable:", err);
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

    // --- 4. QR 扫描逻辑 (对接 Pug 中的 #qr-reader-container) ---
    const scanBtn = document.querySelector('.btn-scan');
    const scannerOverlay = document.getElementById('qr-reader-container');
    const closeScannerBtn = document.getElementById('close-scanner');
    let html5QrCode = null;

    if (scanBtn && scannerOverlay) {
        scanBtn.onclick = () => {
            scannerOverlay.style.display = 'flex';

            if (!html5QrCode) {
                // 对接到 Pug 里的 id="qr-reader"
                html5QrCode = new Html5Qrcode("qr-reader");
            }

            html5QrCode.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: 250 },
                (decodedText) => {
                    html5QrCode.stop().then(() => {
                        scannerOverlay.style.display = 'none';
                        const qrType = decodedText.trim().toUpperCase();

                        let promptTitle = "";
                        let shopFlag = false;

                        if (qrType === 'SHOP') {
                            promptTitle = "SHOP Cell";
                            shopFlag = true;
                        } else if (qrType === 'SPECIAL') {
                            promptTitle = "SPECIAL Cell Code (e.g., C05)";
                            shopFlag = false;
                        } else {
                            // 如果扫到无关的东西（如广告），直接拦截
                            alert("Invalid QR Code! Please scan the official Medieval Map QR.");
                            return;
                        }

                        const cellInput = prompt(`SCAN SUCCESS!\nType: ${qrType}\nEnter ${promptTitle}:`);
                        if (!cellInput) return;

                        const verifyInput = prompt(`Enter digit code for [${cellInput.toUpperCase()}]:`);
                        if (!verifyInput) return;

                        handleVerification(cellInput, verifyInput, shopFlag);
                    });
                }
            ).catch(err => {
                alert("Camera Error: Ensure you are on HTTPS.");
                scannerOverlay.style.display = 'none';
            });
        };

        if (closeScannerBtn) {
            closeScannerBtn.onclick = () => {
                if (html5QrCode && html5QrCode.isScanning) {
                    html5QrCode.stop().then(() => {
                        scannerOverlay.style.display = 'none';
                    });
                } else {
                    scannerOverlay.style.display = 'none';
                }
            };
        }
    }

    // 记录旧的金币值，用于判断是否需要触发数字滚动动画
    let lastCoins = -1;

    async function refreshStats() {
        if (!session_id) return;
        try {
            const response = await fetch(`/player-stats/${session_id}`);
            const data = await response.json();

            if (data.success) {
                // 1. 精确查找显示金币的 span
                const allLabels = document.querySelectorAll('.stat-item .label');
                let coinLabel = null;
                allLabels.forEach(el => {
                    if (el.innerText.includes('Coins')) coinLabel = el;
                });

                if (coinLabel) {
                    const newCoins = parseInt(data.coins);

                    // 2. 如果金币变了，触发滚动动画
                    if (lastCoins !== -1 && lastCoins !== newCoins) {
                        animateValue(coinLabel, lastCoins, newCoins, 1000);
                    } else if (lastCoins === -1) {
                        // 第一次加载，直接显示
                        coinLabel.innerText = `Coins: ${newCoins}`;
                    }
                    lastCoins = newCoins;
                }
            }
        } catch (err) {
            console.warn("Stats sync temporarily unavailable");
        }
    }

    // 数字滚动核心算法
    function animateValue(obj, start, end, duration) {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const currentCount = Math.floor(progress * (end - start) + start);
            obj.innerText = `Coins: ${currentCount}`;
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }

    // 每 5 秒同步一次金币和状态
    setInterval(refreshStats, 5000);
    refreshStats(); // 初始加载执行一次

    let inventoryData = { cards: [], clues: [], treasures: [] };

    async function openBag() {
        console.log("🎒 Opening Bag...");
        const modal = document.getElementById('bag-modal');
        if (!modal) return console.error("#bag-modal not found");

        try {
            const response = await fetch(`/get-inventory/${session_id}`);
            const data = await response.json();

            if (data.success) {
                inventoryData = data;
                modal.style.display = 'flex';
                switchTab('cards');
            }
        } catch (err) {
            console.error("Failed to load inventory:", err);
        }
    }

    function switchTab(type) {
        // 视觉切换按钮状态
        document.querySelectorAll('.tab-btn').forEach(btn => {
            const isMatch = btn.innerText.toLowerCase().includes(type.replace('s', ''));
            btn.classList.toggle('active', isMatch);
        });

        const grid = document.getElementById('bag-grid');
        grid.innerHTML = '';
        const items = inventoryData[type] || [];

        if (items.length === 0) {
            grid.innerHTML = `<div style="grid-column: 1/-1; padding: 40px; color: #999;">Empty...</div>`;
            return;
        }

        items.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'inventory-item';

            if (type === 'cards') {
                itemDiv.innerHTML = `
                    <div class="item-img">🎴</div>
                    <h4 style="color:#3C0A0A;">${item.card_type}</h4>
                    <p>Value: ${item.card_value}</p>
                    <div style="font-weight:bold;">x${item.quantity}</div>
                    <button class="btn-pill" style="font-size:0.7rem; padding:5px; margin-top:10px;" onclick="useCard('${item.card_type}', ${item.card_value})">USE</button>
                `;
            } else if (type === 'clues') {
                itemDiv.innerHTML = `<div class="item-img">📜</div><p style="font-size:0.8rem;">${item.clue_text}</p>`;
            } else if (type === 'treasures') {
                itemDiv.innerHTML = `<div class="item-img">💎</div><h4 style="color:#3C0A0A;">${item.treasure_name}</h4>`;
            }
            grid.appendChild(itemDiv);
        });
    }

    function closeBag() {
        document.getElementById('bag-modal').style.display = 'none';
    }

    function useCard(cardName, value) {
        alert(`Using ${cardName} (Value: ${value}). Feature coming soon!`);
        closeBag();
    }

    // --- 5. 统一验证 Fetch 函数 ---
    async function handleVerification(cellCode, verifyCode, isShop) {
        if (manualBtn) manualBtn.innerText = "VERIFYING...";

        try {
            const res = await fetch('/submit-verification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: session_id,
                    cellCode: cellCode.toUpperCase(),
                    verifyCode,
                    isShop
                })
            });

            const data = await res.json();

            if (data.success) {
                // A. 商店跳转
                if (data.outcome === 'SHOP') {
                    alert(data.message);
                    window.location.href = `${BASE_URL}/shop/${session_id}?type=${data.shopType}`;
                }
                // B. 空格子逻辑
                else if (data.redirectType === 'NONE') {
                    alert("🕳️ This cell is empty. Nothing happens.");
                }
                // 修改 C. 挑战分流逻辑 部分
                else if (data.redirectType) {
                    // 强制转换为数据库匹配的大小写 (Easy, Middle, Hard)
                    let level = "Easy";
                    if (data.redirectType === 'MEDIUM') level = "Middle";
                    if (data.redirectType === 'HARD') level = "Challenge"; // 或者保持 Hard，取决于你 SQL 里的 level 叫什么

                    alert(`${data.outcome} DETECTED!\nStarting ${level} challenge...`);

                    // 💡 关键：加上 &mode=SPECIAL 和 &count=1
                    window.location.href = `${BASE_URL}/question-page/${session_id}?level=${level}&mode=SPECIAL&count=1&cell=${cellCode.toUpperCase()}`;
                }
            } else {
                alert("DENIED: " + data.message);
            }
        } catch (err) {
            console.error("Verification failed", err);
            alert("Connection Error: Local server is unreachable.");
        } finally {
            if (manualBtn) manualBtn.innerText = "SUBMIT";
        }
    }

    window.openBag = openBag;
    window.switchTab = switchTab;
    window.closeBag = closeBag;
    window.useCard = useCard;
});