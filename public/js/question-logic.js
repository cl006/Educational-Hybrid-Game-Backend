let questionQueue = [];
let currentIdx = 0;

async function init() {
    try {
        const params = new URLSearchParams(window.location.search);

        // 1. 动态获取 Level (从 question-level 传来的可能是 'Challenge')
        const level = params.get('level') || 'Easy';

        // 2. 动态获取 Count (优先看 URL 是否传了 count=3)
        let count = params.get('count');
        if (!count) {
            count = (MODE === 'ROUND') ? 3 : 1;
        }

        console.log(`Loading ${count} questions for ${level} mode...`);

        // ✅ 发送请求
        const response = await fetch(`/get-questions?level=${level}&count=${count}`);

        if (!response.ok) throw new Error("Server error: " + response.status);

        const data = await response.json();
        console.log("📦 Received Data:", data);

        if (data.success && data.questions && data.questions.length > 0) {
            questionQueue = data.questions;
            loadQuestion(0);
        } else {
            // 如果没拿到题，把按钮隐藏，文字显示错误原因
            document.getElementById('questionText').innerText = "ERROR: " + (data.message || "No questions found");
        }
    } catch (err) {
        console.error("❌ Failed to load questions:", err);
        document.getElementById('questionText').innerText = "Connection Failed: Check F12 Console.";
    }
}

function loadQuestion(idx) {
    console.log("Loading index:", idx, "Question data:", questionQueue[idx]);
    if (!questionQueue[idx]) return finishAll();

    const q = questionQueue[idx];
    document.getElementById('questionText').innerText = q.question_text;
    document.getElementById('levelBadge').innerText = `${LEVEL.toUpperCase()} (${idx + 1}/${questionQueue.length})`;

    const btns = document.querySelectorAll('.option-btn');

    if (!q.choices || !Array.isArray(q.choices)) {
        console.error("Choices missing for:", q.question_id);
        return;
    }

    btns.forEach((btn, i) => {
        const choice = q.choices[i];
        if (choice) {
            btn.style.display = 'block';
            btn.innerText = choice.choice_text; // 对应数据库字段
            btn.className = 'option-btn';
            btn.disabled = false;
            // 重新绑定点击事件
            btn.onclick = () => handleAnswer(btn, choice.choice_id, choice.is_answer, q);
        } else {
            btn.style.display = 'none';
        }
    });
}

async function handleAnswer(selectedBtn, choiceId, isCorrect, currentQuestion) {
    const btns = document.querySelectorAll('.option-btn');
    btns.forEach(btn => btn.disabled = true);

    // 1. 视觉反馈
    if (isCorrect) {
        selectedBtn.classList.add('correct');
    } else {
        selectedBtn.classList.add('wrong');
        btns.forEach((btn, i) => {
            if (currentQuestion.choices[i].is_answer) btn.classList.add('correct');
        });
    }

    // 2. 显示解释
    const expBox = document.getElementById('explanationBox');
    if (expBox) {
        expBox.style.display = 'block';
        document.getElementById('explanationText').innerText = currentQuestion.explanation;
    }

    // 3. 提交到后端
    try {
        // 💡 自动从 URL 获取 cell 参数 (用于独占宝藏逻辑)
        const urlParams = new URLSearchParams(window.location.search);
        const cellCode = urlParams.get('cell') || '';

        const response = await fetch('/submit-attempt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                playerId: PLAYER_ID,
                sessionId: SESSION_ID,
                questionId: currentQuestion.question_id,
                selectedChoiceId: choiceId,
                isCorrect: isCorrect,
                mode: MODE,
                level: LEVEL,
                cellCode: cellCode // 👈 必须传这个，后端才能锁定 found_treasures
            })
        });

        const result = await response.json();

        // 4. 处理奖励反馈
        if (result.success && result.correct) {

            // 情况 A: 宝藏已经被别人领走了
            if (result.message && result.message.includes("already been looted")) {
                if (typeof showModal === 'function') {
                    await showModal("EMPTY CHEST", "You found the spot, but the treasure was already taken!");
                }
            }
            // 情况 B: 成功获得宝藏，显示你设计稿的 UI
            else if (result.itemsEarned && result.itemsEarned.length > 0) {
                const item = result.itemsEarned[0]; // 后端传回的是对象 {name, value}

                // 填充设计稿内容
                document.getElementById('treasure-name').innerText = item.name;
                document.getElementById('treasure-value').innerText = item.value;

                // 动态图标切换
                const iconEl = document.getElementById('treasure-icon');
                if (iconEl) {
                    if (item.name.includes('Movement')) iconEl.className = "fas fa-boot";
                    else if (item.name.includes('Verify')) iconEl.className = "fas fa-check-double";
                    else if (item.name.includes('Swap')) iconEl.className = "fas fa-exchange-alt";
                    else iconEl.className = "fas fa-scroll";
                }

                // 显示设计稿 Modal
                const treasureModal = document.getElementById('treasure-modal');
                if (treasureModal) treasureModal.style.display = 'flex';
            }
        }
    } catch (err) {
        console.error("Reward Submission Failed:", err);
    }

    // 5. 更新按钮状态
    const nextBtn = document.querySelector('.btn-continue');
    if (nextBtn) {
        nextBtn.innerText = (currentIdx === questionQueue.length - 1) ? "FINISH & CLOSE" : "NEXT QUESTION";
    }
}

// 💡 将关闭函数放在外面，确保全局可用
function closeTreasure() {
    const treasureModal = document.getElementById('treasure-modal');
    if (treasureModal) treasureModal.style.display = 'none';
}

function nextStep() {
    currentIdx++;
    if (currentIdx < questionQueue.length) {
        loadQuestion(currentIdx);
    } else {
        finishAll();
    }
}

function finishAll() {
    // 💡 调试打印：看看 SESSION_ID 是否真的拿到了值
    console.log("Redirecting to session:", SESSION_ID);

    if (SESSION_ID && SESSION_ID !== "undefined") {
        // 确保路径前面有斜杠 "/"
        window.location.href = `/game-start-player/${SESSION_ID}`;
    } else {
        console.error("SESSION_ID is missing! Falling back to home.");
        window.location.href = "/";
    }
}

window.onload = init;