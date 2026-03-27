module.exports = (db) => {
    const express = require('express');
    const router = express.Router();

    /**
     * --- HELPER: Clue Text Generator ---
     * Generates variety in clue descriptions to make the game more interesting.
     */
    function generateClueHint(cellCode) {
        const cellNum = parseInt(cellCode.replace('C', ''));
        const randomType = Math.random();

        if (randomType < 0.4) {
            // Type 1: Regional Hint
            return cellNum <= 36
                ? "Intelligence: The treasure is buried in the **Northern territories**."
                : "Intelligence: The treasure is buried in the **Southern territories**.";
        } else if (randomType < 0.7) {
            // Type 2: Parity Hint
            return cellNum % 2 === 0
                ? "Hint: Ancient scrolls suggest the cell number is **Even**."
                : "Hint: Ancient scrolls suggest the cell number is **Odd**.";
        } else {
            // Type 3: Last Digit Hint
            const lastDigit = cellNum % 10;
            return `Rumor: A traveler mentions the cell code ends with the digit **${lastDigit}**.`;
        }
    }

    // 1. Render Verification Page (The page players see after scanning the QR)
    router.get('/verify-page/:roomCode', async (req, res) => {
        try {
            const roomCode = req.params.roomCode;
            // Get session_id based on the Room Access Code
            const [sessions] = await db.promise().execute(
                'SELECT session_id FROM game_session WHERE session_access_code = ?',
                [roomCode]
            );

            if (sessions.length === 0) return res.status(404).send("Invalid Room");

            res.render('game-verify', {
                sessionId: sessions[0].session_id,
                roomCode: roomCode,
                cellCode: req.query.cell || "" // Pre-fills if scanned from a specific cell QR
            });
        } catch (err) {
            console.error(err);
            res.status(500).send("Error loading verification page");
        }
    });

    // 2. Get Player's Bag (Clues they have purchased/found)
    router.get('/get-my-clues/:sessionId', async (req, res) => {
        const { sessionId } = req.params;
        const userId = req.session.user_id;

        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

        try {
            const [playerRows] = await db.promise().execute(
                'SELECT player_id FROM players WHERE session_id = ? AND user_id = ?',
                [sessionId, userId]
            );

            if (playerRows.length === 0) return res.json({ success: true, clues: [] });
            const playerId = playerRows[0].player_id;

            const [clues] = await db.promise().execute(
                `SELECT clue_text, source, obtained_round 
                 FROM player_clues 
                 WHERE session_id = ? AND player_id = ? 
                 ORDER BY obtained_round DESC`,
                [sessionId, playerId]
            );

            res.json({ success: true, clues });
        } catch (err) {
            console.error(err);
            res.status(500).json({ success: false, message: "Server Error" });
        }
    });

    // 3. Get Game Status (Synchronize Round Number)
    router.get('/get-game-status/:sessionId', async (req, res) => {
        try {
            const [rows] = await db.promise().execute(
                'SELECT round_number, started_at FROM game_session WHERE session_id = ?',
                [req.params.sessionId]
            );
            if (rows.length === 0) return res.status(404).json({ error: "Session not found" });
            res.json(rows[0]);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // --- 4. 统一验证逻辑 (核心分流引擎) ---
    router.post('/submit-verification', async (req, res) => {
        const { sessionId, cellCode, verifyCode, isShop } = req.body;
        const cleanCell = cellCode.trim().toUpperCase();

        try {
            // --- 第一步：Shop 逻辑优先 ---
            if (cleanCell === 'SHOP' || isShop) {
                const [sessionRows] = await db.promise().execute(
                    'SELECT shop_access_code FROM game_session WHERE session_id = ?',
                    [sessionId]
                );

                if (sessionRows.length > 0 && sessionRows[0].shop_access_code === verifyCode) {
                    return res.json({
                        success: true,
                        outcome: 'SHOP',
                        message: "Welcome to the Secret Shop!"
                    });
                } else {
                    return res.json({ success: false, message: "Invalid Shop Access Code!" });
                }
            }

            // --- 第二步：Special Cell 逻辑 ---
            const [rows] = await db.promise().execute(
                `SELECT outcome_type FROM special_cell_verification 
                WHERE session_id = ? AND cell_code = ? AND verify_code = ?`,
                [sessionId, cleanCell, verifyCode.toUpperCase()]
            );

            if (rows.length === 0) {
                return res.json({ success: false, message: "Invalid Grid ID or Verification Code!" });
            }

            const outcome = rows[0].outcome_type.toUpperCase();
            let isReal = false;
            let redirectType = '';
            let statusMsg = `Discovered: ${outcome}`;

            // --- 第三步：分流难度分配 ---
            switch (outcome) {
                case 'TREASURE':
                    const [treasure] = await db.promise().execute(
                        'SELECT is_real FROM session_treasures WHERE session_id = ? AND cell_code = ?',
                        [sessionId, cleanCell]
                    );
                    isReal = treasure.length > 0 && treasure[0].is_real;
                    redirectType = 'HARD';
                    statusMsg = isReal ? "REAL TREASURE FOUND!" : "It's a fake treasure!";
                    break;

                case 'SWAP':
                    redirectType = 'MEDIUM';
                    break;

                case 'MOVEMENT':
                    redirectType = 'EASY';
                    break;

                case 'EMPTY':
                    redirectType = 'NONE';
                    statusMsg = "Just dust and echoes here.";
                    break;
            }

            res.json({
                success: true,
                outcome: outcome,
                isReal: isReal,
                redirectType: redirectType,
                message: statusMsg
            });

        } catch (err) {
            console.error(err);
            res.status(500).json({ success: false, message: "System Verification Error" });
        }
    });

    // --- 5. 随机题目获取 (带选项) ---
    router.get('/game/get-question/:level', async (req, res) => {
        const { level } = req.params;
        try {
            const [qRows] = await db.promise().execute(
                'SELECT * FROM questions WHERE level = ? ORDER BY RAND() LIMIT 1',
                [level.toUpperCase()]
            );

            if (qRows.length === 0) return res.json({ success: false, message: "No questions." });

            const question = qRows[0];
            // 抓取选项，并包含 is_answer 字段以便前端校验
            const [cRows] = await db.promise().execute(
                'SELECT choice_id, choice_text, is_answer FROM question_choices WHERE question_id = ?',
                [question.question_id]
            );

            res.json({ success: true, question, choices: cRows });
        } catch (err) {
            res.status(500).json({ success: false });
        }
    });

    // 5. Buy Clue Logic (Spend coins to get a hint about a real treasure)
    router.post('/buy-clue', async (req, res) => {
        const { sessionId } = req.body;
        const userId = req.session.user_id;

        try {
            // Check player balance
            const [players] = await db.promise().execute(
                'SELECT player_id, coins FROM players WHERE session_id = ? AND user_id = ?',
                [sessionId, userId]
            );
            if (players.length === 0) return res.json({ success: false, message: "Player not found" });

            const player = players[0];
            const cluePrice = 50;

            if (player.coins < cluePrice) {
                return res.json({ success: false, message: `Not enough coins! (Need ${cluePrice})` });
            }

            // Find a random REAL treasure that hasn't been found (optional logic)
            const [realTreasures] = await db.promise().execute(
                'SELECT cell_code, treasure_id FROM session_treasures WHERE session_id = ? AND is_real = 1 ORDER BY RAND() LIMIT 1',
                [sessionId]
            );

            if (realTreasures.length === 0) {
                return res.json({ success: false, message: "No more treasure clues available!" });
            }

            const treasure = realTreasures[0];
            const hintText = generateClueHint(treasure.cell_code);

            // Transaction: Deduct coins and record the clue
            await db.promise().query('START TRANSACTION');
            try {
                await db.promise().execute(
                    'UPDATE players SET coins = coins - ? WHERE player_id = ?',
                    [cluePrice, player.player_id]
                );

                const clueId = 'CL' + Date.now().toString().slice(-4);
                await db.promise().execute(
                    `INSERT INTO player_clues (clue_id, player_id, session_id, treasure_id, clue_text, obtained_round, source) 
                     VALUES (?, ?, ?, ?, ?, (SELECT round_number FROM game_session WHERE session_id = ?), 'Shop')`,
                    [clueId, player.player_id, sessionId, treasure.treasure_id, hintText, sessionId]
                );

                await db.promise().query('COMMIT');
                res.json({ success: true, hint: hintText });

            } catch (innerErr) {
                await db.promise().query('ROLLBACK');
                throw innerErr;
            }

        } catch (err) {
            console.error(err);
            res.status(500).json({ success: false, message: "Transaction Failed" });
        }
    });

    // --- New Route: Render Level Selection Page ---
    router.get('/level-selection/:roomCode', (req, res) => {
        res.render('question-level', { roomCode: req.params.roomCode });
    });

    // --- Updated Submit Verification ---
    router.post('/submit-verification', async (req, res) => {
        const { sessionId, cellCode, verifyCode, isShop } = req.body;
        try {
            if (isShop) {
                // Logic for Shop Verification
                const [rows] = await db.promise().execute(
                    'SELECT shop_access_code FROM game_session WHERE session_id = ?',
                    [sessionId]
                );
                if (rows[0].shop_access_code === verifyCode.toUpperCase()) {
                    return res.json({ success: true, redirect: `/game-shop/${sessionId}` });
                }
                return res.json({ success: false, message: "Invalid Shop Code!" });
            } else {
                // Standard Special Cell Logic
                const [rows] = await db.promise().execute(
                    'SELECT outcome_type FROM special_cell_verification WHERE session_id = ? AND cell_code = ? AND verify_code = ?',
                    [sessionId, cellCode.toUpperCase(), verifyCode.toUpperCase()]
                );
                if (rows.length === 0) return res.json({ success: false, message: "Invalid Codes!" });

                res.json({ success: true, outcome: rows[0].outcome_type });
            }
        } catch (err) { res.status(500).json({ success: false }); }
    });

    router.get('/play', (req, res) => {
        const { type } = req.query; // 获取是 'special' 还是 'shop'

        const sql = "SELECT room_code FROM game_session WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1";

        db.query(sql, (err, results) => {
            if (err || results.length === 0) return res.redirect('/');

            const roomCode = results[0].room_code;

            // 重定向时带上参数：/game/join/ABCD?auto=shop 或 ?auto=special
            const redirectUrl = `/game/join/${roomCode}?auto=${type || 'special'}`;
            res.redirect(redirectUrl);
        });
    });

    router.post('/game/next-round-trigger', (req, res) => {
        const { sessionId, hostId } = req.body;

        // 调试用：在终端打印一下收到的数据
        console.log("Checking Session:", sessionId, "Input HostId:", hostId);

        // 步骤 1: 验证。确保 SELECT 的字段名和后面 if 判断的名字一模一样
        const checkSql = "SELECT host_user_id FROM game_session WHERE session_id = ?";

        db.query(checkSql, [sessionId], (err, results) => {
            // 如果这里报错，通常是数据库没连上或者表名写错
            if (err) return res.json({ success: false, message: "DB Error: " + err.message });

            // 如果查不到结果，说明 sessionId 传错了
            if (results.length === 0) {
                return res.json({ success: false, message: "Session not found in Database" });
            }

            // --- 核心修正点：字段名必须匹配 ---
            const dbHostId = results[0].host_user_id; // 这里改成了 host_user_id

            if (!dbHostId || dbHostId.toString() !== hostId.toString()) {
                return res.json({ success: false, message: "Invalid Host ID. Unauthorized action." });
            }

            // 步骤 2: 执行自增
            const updateSql = "UPDATE game_session SET round_number = round_number + 1 WHERE session_id = ?";
            db.query(updateSql, [sessionId], (err) => {
                if (err) return res.json({ success: false, message: "Update Error" });

                // 步骤 3: 返回新回合数
                const getNewSql = "SELECT round_number FROM game_session WHERE session_id = ?";
                db.query(getNewSql, [sessionId], (err, roundResults) => {
                    res.json({
                        success: true,
                        newRound: roundResults[0].round_number
                    });
                });
            });
        });
    });

    // 获取特定 Session 的所有特殊格验证码
    router.get('/game/special-cells/:sessionId', (req, res) => {
        const sessionId = req.params.sessionId;

        // SQL: 从你的验证表中查询数据
        const sql = "SELECT cell_code AS cell_no, verify_code FROM special_cell_verification WHERE session_id = ?";

        db.query(sql, [sessionId], (err, results) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            res.json({ success: true, cells: results });
        });
    });

    router.get('/game/treasures/:sessionId', (req, res) => {
        const sessionId = req.params.sessionId;
        const sql = `
            SELECT treasure_id, cell_code, is_real 
            FROM session_treasures 
            WHERE session_id = ?
        `;

        db.query(sql, [sessionId], (err, results) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            res.json({ success: true, treasures: results });
        });
    });

    router.get('/game/shop-code/:sessionId', (req, res) => {
        const sessionId = req.params.sessionId;
        // 假设 shop_access_code 存在于 game_sessions 表中
        const sql = "SELECT shop_access_code FROM game_session WHERE session_id = ?";

        db.query(sql, [sessionId], (err, results) => {
            if (err || results.length === 0) return res.json({ success: false, message: "Not found" });
            res.json({ success: true, shopCode: results[0].shop_access_code });
        });
    });

    // 在 routes/game.js 内部
    router.post('/game/end-session', (req, res) => {
        const { sessionId } = req.body;

        // SQL：更新状态为 ended，并记录当前时间
        const sql = "UPDATE game_sessions SET status = 'ended', ended_at = NOW() WHERE session_id = ?";

        db.query(sql, [sessionId], (err, result) => {
            if (err) {
                console.error("Database Error:", err);
                return res.status(500).json({ success: false, message: err.message });
            }
            res.json({ success: true, message: "Game finalized successfully." });
        });
    });

    return router;
};