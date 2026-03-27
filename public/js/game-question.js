let timeLeft = 60;
let correctAnswer = "";

window.onload = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const level = urlParams.get('level');

    const res = await fetch(`/game/get-question/${level}`);
    const data = await res.json();

    if (data.success) {
        // 渲染题目和解释
        document.getElementById('questionText').innerText = data.question.question_text;
        document.getElementById('explanationText').innerText = data.question.explanation;

        // 渲染 4 个选项按钮
        const optionsGrid = document.querySelector('.options-grid');
        optionsGrid.innerHTML = ''; // 清空占位符

        data.choices.forEach(choice => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.innerText = choice.choice_text;

            // 点击事件：传入该选项是否为正确答案 (is_answer)
            btn.onclick = () => checkAnswer(choice.is_answer, btn);

            optionsGrid.appendChild(btn);
        });

        startTimer();
    }
};

function checkAnswer(isCorrect, clickedBtn) {
    // 禁用所有按钮防止重复点击
    const btns = document.querySelectorAll('.option-btn');
    btns.forEach(b => b.disabled = true);

    if (isCorrect) {
        clickedBtn.style.backgroundColor = "#2ecc71"; // 变绿
        clickedBtn.style.color = "white";
        alert("✨ CORRECT! Well done.");
        // 这里可以调用加分接口
    } else {
        clickedBtn.style.backgroundColor = "#e74c3c"; // 变红
        clickedBtn.style.color = "white";
        alert("❌ WRONG! Better luck next time.");
    }

    // 显示解释栏（对应你设计稿底部的部分）
    document.getElementById('explanationBox').style.display = 'block';
}

function startTimer() {
    const timerEl = document.getElementById('timer');
    const interval = setInterval(() => {
        timeLeft--;
        timerEl.innerText = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(interval);
            alert("TIME OUT!");
            finishChallenge(false);
        }
    }, 1000);
}

function finishChallenge() {
    // 答题结束回到主页
    window.location.href = `/game/player-dashboard/${SESSION_ID}`;
}