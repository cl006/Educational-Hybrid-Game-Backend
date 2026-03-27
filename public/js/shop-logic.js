let selectedItemId = null;
let currentItems = [];

// 1. 初始化加载
async function initShop() {
    try {
        // 如果是 Clue Shop，从后端获取该 Session 里的真实宝藏图片
        let url = `/shop-items/${SHOP_TYPE}?session=${SESSION_ID}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.success) {
            currentItems = data.items;
            renderItems();
        }
    } catch (err) {
        console.error("Load failed", err);
    }
}

// 2. 渲染卡片
function renderItems() {
    const container = document.getElementById('itemsContainer');
    container.innerHTML = currentItems.map(item => `
        <div class="shop-card" onclick="selectItem('${item.id}', this)">
            <img class="card-img" src="${item.img || '/images/default-item.png'}" />
            <div class="card-info">
                <h3>${item.name}</h3>
                <p class="price">${item.price} Coins</p>
                <p style="font-size:0.7rem; color:#666;">${item.description || ''}</p>
            </div>
        </div>
    `).join('');
}

// 3. 选择逻辑
function selectItem(id, el) {
    selectedItemId = id;
    document.querySelectorAll('.shop-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
}

//4. purchase
async function processPurchase() {
    // 1. 检查是否选择了物品
    if (!selectedItemId) return alert("Please select a treasure first!");

    // 2. 获取 UI 元素用于反馈
    const btn = document.querySelector('.btn-purchase');
    const selectedCard = document.querySelector('.shop-card.selected');
    const treasureName = selectedCard ? selectedCard.querySelector('h3').innerText : "The treasure";

    // 💡 调试日志
    console.log("Purchase Initialized:", {
        sessionId: SESSION_ID,
        itemId: selectedItemId,
        shopType: SHOP_TYPE
    });

    // 3. 视觉反馈：禁用按钮防止重复提交
    btn.disabled = true;
    btn.innerText = "Processing...";

    try {
        // 4. 发起请求
        // 注意：我们不再发送 playerId，后端会从 Session 获取
        const res = await fetch('/purchase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: SESSION_ID,
                itemId: selectedItemId,
                shopType: SHOP_TYPE
            })
        });

        // 5. 解析响应
        const result = await res.json();

        if (result.success) {
            // A. 更新商店页面的金币余额显示
            const coinEl = document.getElementById('coinCount');
            if (coinEl) {
                coinEl.innerText = result.newBalance;
            }

            // B. 如果是线索商店，显示具体的随机坐标范围
            let msg = "Item purchased successfully!";
            if (SHOP_TYPE === 'clue' && result.clueData) {
                msg = `📜 NEW CLUE REVEALED!\n\n${treasureName}\nis hidden between Cell ${result.clueData.min} and ${result.clueData.max}.\n\n(This has been saved to your BAG)`;
            }

            alert(msg);

            // C. 延迟跳转回游戏主页，确保玩家看到了金币变动
            setTimeout(() => {
                window.location.href = `/game-start-player/${SESSION_ID}`;
            }, 800);

        } else {
            // 处理后端返回的逻辑错误 (如金币不足、Session 过期)
            alert("Error: " + result.message);
            btn.disabled = false;
            btn.innerText = "PURCHASE";
        }

    } catch (err) {
        console.error("Purchase failed:", err);
        alert("Connection Error: Could not reach the server.");
        btn.disabled = false;
        btn.innerText = "PURCHASE";
    }
}

function renderItems() {
    const container = document.getElementById('itemsContainer');
    if (!container) return;

    container.innerHTML = currentItems.map(item => {
        // --- 情况 A: 移动卡或道具卡商店 (没有图片，使用图标和颜色) ---
        if (SHOP_TYPE === 'card' || SHOP_TYPE === 'movement') {
            // 自动判断是 Buff(加) 还是 Debuff(减)
            const isNegative = item.description.includes('-');
            const badgeColor = isNegative ? '#ff4757' : '#2ed573';
            const badgeText = isNegative ? 'DEBUFF' : 'BUFF';

            return `
                <div class="shop-card card-item-style" onclick="selectItem('${item.id}', this)" style="border-top: 6px solid ${item.color || '#ccc'}">
                    <div class="card-visual" style="background: ${item.color}22;">
                        <span class="card-emoji">${item.icon || '📦'}</span>
                    </div>
                    <div class="card-info">
                        <span class="type-badge" style="background:${badgeColor}">${badgeText}</span>
                        <h3>${item.name}</h3>
                        <p class="price">${item.price} Coins</p>
                        <p class="desc">${item.description}</p>
                    </div>
                </div>
            `;
        }

        // --- 情况 B: 宝藏线索商店 (有图片展示) ---
        return `
            <div class="shop-card" onclick="selectItem('${item.id}', this)">
                <div class="img-container">
                    <img class="card-img" src="${item.img}" onerror="this.src='/images/default_treasure.png'" />
                </div>
                <div class="card-info">
                    <h3>${item.name}</h3>
                    <p class="price">${item.price} Coins</p>
                    <p class="desc">${item.description || 'Click to buy a location clue'}</p>
                </div>
            </div>
        `;
    }).join('');
}

function scrollShop(dir) {
    document.getElementById('itemsContainer').scrollBy({ left: dir * 250, behavior: 'smooth' });
}

initShop();