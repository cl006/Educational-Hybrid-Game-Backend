document.addEventListener('DOMContentLoaded', () => {
    const username = document.querySelector('.user-name')?.innerText || "";
    console.log("HOME-UI: Script Loaded and Ready");

    // --- 1. 获取所有 Modal 元素 ---
    const createModal = document.getElementById('createModal');
    const joinModal = document.getElementById('joinModal');
    const recoveryModal = document.getElementById('recoveryModal');
    const hostDisplayID = document.getElementById('hostDisplayID');

    // 获取主屏幕按钮
    const createBtn = document.querySelector('.hero-box .btn-pill:nth-of-type(2)');
    const joinBtn = document.querySelector('.hero-box .btn-pill:nth-of-type(1)');

    // 获取弹窗内的功能按钮
    const confirmCreateBtn = document.getElementById('confirmCreate');
    const startNewBtn = document.getElementById('startNewSession');
    const continueBtn = document.getElementById('continueSession');
    const confirmJoinBtn = document.getElementById('confirmJoin');

    const getEl = (id) => document.getElementById(id) || { style: {}, onclick: null };

    const avatar = document.querySelector('.avatar-wrapper');
    if (avatar) {
        avatar.addEventListener('click', (e) => {
            const tooltip = avatar.querySelector('.account-tooltip');
            if (tooltip) {
                tooltip.style.visibility = (tooltip.style.visibility === 'visible') ? 'hidden' : 'visible';
                tooltip.style.opacity = (tooltip.style.opacity === '1') ? '0' : '1';
                tooltip.style.pointerEvents = (tooltip.style.pointerEvents === 'auto') ? 'none' : 'auto';
            }
        });
    }

    // 【关键修复】获取扫码相关元素 (即使 HTML 里没写，定义为 null 也不会报错)
    const startScanBtn = document.getElementById('startScan');
    const readerDiv = document.getElementById('reader');

    // 登录状态
    const userStatusEl = document.getElementById('userStatus');
    const isLoggedIn = userStatusEl && userStatusEl.getAttribute('data-logged-in') === 'true';

    let activeRoomCode = "";

    const urlParams = new URLSearchParams(window.location.search);
    const quickJoinCode = urlParams.get('joinCode'); // 检查网址是否有 ?joinCode=XXXXXX

    if (quickJoinCode) {
        if (!isLoggedIn) {
            alert("Please sign in first!");
            window.location.href = '/login';
        } else {
            // --- 核心修改：尝试自动加入 ---
            // 1. 获取本地存储的用户名（或弹出简单的输入框）
            let playerName = localStorage.getItem('lastPlayerName') || username;

            if (!playerName) {
                // 如果实在没有名字，再打开弹窗让用户填
                joinModal.classList.remove('hidden');
                document.getElementById('sessionCode').value = quickJoinCode.toUpperCase();
            } else {
                // 2. 直接发送加入请求，不经过弹窗确认
                autoJoinSession(playerName, quickJoinCode.toUpperCase());
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        }
    }

    // 新增一个自动加入函数
    async function autoJoinSession(playerName, code) {
        try {
            console.log(`Attempting join for ${playerName} in room ${code}`);

            const response = await fetch('/join-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // CRITICAL: Bypass the Ngrok warning page for mobile fetch
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify({ playerName, accessCode: code })
            });

            const data = await response.json();

            if (data.success) {
                console.log("Join successful, redirecting...");
                // Clear URL parameters to prevent loops
                window.history.replaceState({}, document.title, window.location.pathname);
                // Redirect to the player wait room
                window.location.href = `/session-player/${code}`;
            } else {
                alert("Join Error: " + data.message);
            }
        } catch (err) {
            console.error("Fetch Error:", err);
            alert("Connection failed. Please ensure you are using HTTPS.");
        }
    }

    // 检测是否为移动设备
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    // --- 2. 核心函数：打开创建设置窗 ---
    async function openCreateSetup() {
        console.log("Action: Fetching ID and Opening Setup Modal");
        try {
            const response = await fetch('/get-next-host-id');
            const data = await response.json();
            if (hostDisplayID) {
                hostDisplayID.value = data.nextHostId || "H0001";
            }
        } catch (err) {
            console.warn("Fetch ID failed, using default H0001");
            if (hostDisplayID) hostDisplayID.value = "H0001";
        }

        if (recoveryModal) recoveryModal.classList.add('hidden');
        if (createModal) createModal.classList.remove('hidden');
    }

    // --- 3. 点击主屏幕 CREATE ---
    if (createBtn) {
        createBtn.onclick = async () => {
            if (!isLoggedIn) {
                alert("Please sign in first before create session!");
                window.location.href = '/login';
                return;
            }
            try {
                const res = await fetch('/check-active-session');
                const data = await res.json();
                if (data.hasActive) {
                    activeRoomCode = data.code;
                    recoveryModal.classList.remove('hidden');
                } else {
                    await openCreateSetup();
                }
            } catch (err) {
                await openCreateSetup();
            }
        };
    }

    // --- 4. 恢复弹窗逻辑 ---
    if (startNewBtn) {
        // 使用 addEventListener 替代 onclick 以防被后面的通用逻辑覆盖
        startNewBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation(); // 阻止事件冒泡
            console.log("Action: Starting New Session (Manual Override)");

            // 隐藏恢复弹窗并打开设置弹窗
            if (recoveryModal) recoveryModal.classList.add('hidden');
            await openCreateSetup();
        });
    }

    if (continueBtn) {
        continueBtn.onclick = () => {
            if (activeRoomCode) {
                // 逻辑 K 会自动根据数据库里的 started_at 判断：
                // 还没开始 -> 送你去 /session-host (等待界面)
                // 已经开始 -> 送你去 /game-start-host (正式地图)
                window.location.href = `/game-start/${activeRoomCode}`;
            }
        };
    }

    // --- 5. 提交创建会话 ---
    if (confirmCreateBtn) {
        confirmCreateBtn.onclick = async () => {
            const maxPlayers = document.getElementById('maxPlayers').value;
            try {
                const response = await fetch('/create-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ maxPlayers: parseInt(maxPlayers) })
                });
                const data = await response.json();
                if (data.success && data.code) {
                    window.location.href = `/session-host/${data.code}`;
                } else {
                    alert("Failed: " + (data.message || "Error"));
                }
            } catch (err) {
                alert("Network Error during creation");
            }
        };
    }

    // --- 6. 加入游戏 (JOIN) ---
    if (joinBtn) {
        joinBtn.onclick = () => {
            if (!isLoggedIn) {
                alert("Please sign in first before join session!");
                window.location.href = '/login';
                return;
            }

            joinModal.classList.remove('hidden');

            // 手机端且扫码按钮存在时显示
            if (isMobile && startScanBtn) {
                startScanBtn.style.display = 'block';
            }
        };
    }

    if (startScanBtn) {
        startScanBtn.onclick = () => {
            if (typeof Html5Qrcode === 'undefined') {
                alert("QR Library missing!");
                return;
            }

            if (readerDiv) {
                readerDiv.style.display = 'block';
                readerDiv.style.border = "3px solid #D8B56A";
            }

            const html5QrCode = new Html5Qrcode("reader");

            // 1. Define the Scan Success Logic
            const onScanSuccess = (decodedText) => {
                console.log("Scanned:", decodedText);
                let code = decodedText.includes('joinCode=') ?
                    decodedText.split('joinCode=')[1].substring(0, 6) :
                    decodedText.trim().substring(0, 6);

                const finalCode = code.toUpperCase();
                document.getElementById('sessionCode').value = finalCode;

                html5QrCode.stop().then(() => {
                    readerDiv.style.display = 'none';
                    const playerName = document.getElementById('playerName').value.trim();
                    if (playerName) {
                        autoJoinSession(playerName, finalCode);
                    } else {
                        alert("Room " + finalCode + " detected! Enter your name.");
                        document.getElementById('playerName').focus();
                    }
                });
            };

            const config = { fps: 30, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 };

            // 2. THE FIX: Try "Smart" detection first, then Fallback to "Hard-coded" back camera
            Html5Qrcode.getCameras().then(devices => {
                if (devices && devices.length > 0) {
                    // Look for "back" or "rear". If not found, pick the LAST one in the list.
                    const backCamera = devices.find(d => /back|rear|environment/i.test(d.label));
                    const cameraId = backCamera ? backCamera.id : devices[devices.length - 1].id;

                    html5QrCode.start(cameraId, config, onScanSuccess)
                        .catch(err => {
                            console.warn("ID Start failed, trying generic environment mode...", err);
                            // Final Fallback: The standard environment string
                            html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess);
                        });
                } else {
                    // If no devices listed, try the standard string immediately
                    html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess);
                }
            }).catch(() => {
                // If getCameras is blocked, use the standard string
                html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess);
            });
        };
    }

    // 确认加入请求
    if (confirmJoinBtn) {
        confirmJoinBtn.onclick = async () => {
            const playerName = document.getElementById('playerName').value;
            const sessionCode = document.getElementById('sessionCode').value.toUpperCase();

            localStorage.setItem('lastPlayerName', playerName);

            if (!playerName || !sessionCode) {
                alert("Please enter Name and Code");
                return;
            }
            if (!sessionCode || sessionCode.length !== 6) {
                alert("Please enter a valid 6-digit Room Code!");
                return;
            }

            try {
                const response = await fetch('/join-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ playerName, accessCode: sessionCode })
                });

                const data = await response.json();

                if (data.success) {
                    // 【关键跳转】加入成功后，直接送玩家去对应的 player 页面
                    // 这里的 URL 必须匹配你在后端定义的 router.get('/session-player/:code')
                    console.log("Join successful! Redirecting to player dashboard...");
                    window.location.href = `/session-player/${sessionCode}`;
                } else {
                    // 如果后端返回了“房间已满”、“房主不能加入”或“未登录”，在这里弹窗提示
                    alert(data.message || "Join failed");

                    // 如果提示未登录，直接送去登录页
                    if (data.message && data.message.includes("sign in")) {
                        window.location.href = '/login';
                    }
                }
            } catch (err) {
                console.error("Join error:", err);
                alert("Network error. Please try again.");
            }
        };
    }

    // --- 7. 通用关闭逻辑 (放在最后确保执行) ---
    const closeButtons = document.querySelectorAll('#closeModal, #closeCreateModal, .btn-cancel');
    closeButtons.forEach(btn => {
        btn.onclick = () => {
            console.log("Closing all modals");
            if (createModal) createModal.classList.add('hidden');
            if (joinModal) joinModal.classList.add('hidden');
            if (recoveryModal) recoveryModal.classList.add('hidden');

            // 如果开启了相机，尝试停止它（可选）
            if (readerDiv) readerDiv.style.display = 'none';
        };
    });
});