const express = require('express');
const router = express.Router();

module.exports = (db) => {
    // --- 辅助函数：统一 ID 格式 ---
    function formatId(prefix, num) {
        return prefix + num.toString().padStart(4, '0');
    }

    // --- 逻辑 A: 获取下一个逻辑 Host ID ---
    router.get('/get-next-host-id', async (req, res) => {
        try {
            const [rows] = await db.promise().execute(
                'SELECT host_user_id FROM game_session ORDER BY host_user_id DESC LIMIT 1'
            );

            let nextH = 1;
            if (rows.length > 0 && rows[0].host_user_id) {
                const lastId = rows[0].host_user_id;
                const numericPart = parseInt(lastId.replace(/[^\d]/g, ''));
                nextH = numericPart + 1;
            }
            res.json({ nextHostId: formatId('H', nextH) });
        } catch (err) {
            console.error("ID Fetch Error:", err);
            res.status(500).json({ error: "Could not retrieve Host ID" });
        }
    });

    // --- 逻辑 B: 检查房主是否有未结束的旧会话 (纯 Session 表校验) ---
    router.get('/check-active-session', async (req, res) => {
        try {
            const currentUserId = req.session.user_id;
            if (!currentUserId) return res.json({ hasActive: false });

            // 直接查询 game_session，看该用户是否作为 Host 拥有未结束的房间
            const [rows] = await db.promise().execute(
                `SELECT session_access_code 
                 FROM game_session 
                 WHERE user_id = ? AND ended_at IS NULL LIMIT 1`,
                [currentUserId]
            );

            if (rows.length > 0) {
                res.json({ hasActive: true, code: rows[0].session_access_code });
            } else {
                res.json({ hasActive: false });
            }
        } catch (err) {
            console.error("CHECK ERROR:", err);
            res.status(500).json({ success: false });
        }
    });

    // --- 逻辑 C: 创建新游戏会话 (仅 Host，不存 Player 表) ---
    router.post('/create-session', async (req, res) => {
        try {
            const realUserId = req.session.user_id;
            const { maxPlayers } = req.body;

            if (!realUserId) return res.status(401).json({ success: false, message: "Please Login" });

            // 1. 生成逻辑 Host ID (H000x)
            const [hRows] = await db.promise().execute('SELECT host_user_id FROM game_session ORDER BY host_user_id DESC LIMIT 1');
            let nextHNum = 1;
            if (hRows.length > 0 && hRows[0].host_user_id && hRows[0].host_user_id.startsWith('H')) {
                nextHNum = parseInt(hRows[0].host_user_id.substring(1)) + 1;
            }
            const logicalHostId = 'H' + nextHNum.toString().padStart(4, '0');

            // 2. 生成 Session ID (S000x)
            const [sRows] = await db.promise().execute('SELECT session_id FROM game_session ORDER BY session_id DESC LIMIT 1');
            let nextSNum = 1;
            if (sRows.length > 0 && sRows[0].session_id) {
                nextSNum = parseInt(sRows[0].session_id.substring(1)) + 1;
            }
            const newSessionId = 'S' + nextSNum.toString().padStart(4, '0');

            const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            const shopCode = 'SHOP-' + accessCode;

            // 3. 插入数据
            await db.promise().execute(
                `INSERT INTO game_session 
                (session_id, user_id, host_user_id, session_access_code, shop_access_code, created_at, round_number, max_players) 
                VALUES (?, ?, ?, ?, ?, NOW(), 0, ?)`,
                [newSessionId, realUserId, logicalHostId, accessCode, shopCode, maxPlayers]
            );

            // --- 此处已删除向 players 表插入房主的代码 ---

            res.json({ success: true, code: accessCode });

        } catch (err) {
            console.error("SQL Error:", err);
            res.status(500).json({ success: false, message: err.sqlMessage || "Database Error" });
        }
    });

    // --- 逻辑 D: 触发游戏开始 ---
    // --- 逻辑 D: 触发游戏开始 (完整初始化版) ---
    router.post('/start-game-trigger', async (req, res) => {
        const { sessionId } = req.body;
        const currentUserId = req.session.user_id;

        try {
            // 1. 获取房间信息
            const [rooms] = await db.promise().execute(
                'SELECT user_id, max_players, started_at FROM game_session WHERE session_id = ?',
                [sessionId]
            );

            if (rooms.length === 0) return res.status(404).json({ success: false, message: "Room not found." });
            const room = rooms[0];

            // 2. 权限检查
            if (room.user_id !== currentUserId) {
                return res.status(403).json({ success: false, message: "Unauthorized: Only Host can start." });
            }

            // 3. 人数检查 (至少2人)
            const [players] = await db.promise().execute(
                'SELECT COUNT(*) as count FROM players WHERE session_id = ?', [sessionId]
            );
            if (players[0].count < 2) {
                return res.json({ success: false, message: `At least 2 players required. (Current: ${players[0].count})` });
            }

            // 4. 检查是否已经有初始化数据
            const [checkData] = await db.promise().execute(
                'SELECT COUNT(*) as count FROM special_cell_verification WHERE session_id = ?',
                [sessionId]
            );
            const hasData = checkData[0].count > 0;

            // 如果已经开始过且有数据，直接放行
            if (room.started_at !== null && hasData) {
                return res.json({ success: true, message: "Game restored." });
            }

            // ====================================================================
            // --- 核心初始化逻辑：事务处理 ---
            // ====================================================================
            await db.promise().query('START TRANSACTION');

            try {
                if (!hasData) {
                    // A. 获取 28 个 Special 格子
                    const [allCells] = await db.promise().execute(
                        'SELECT cell_code FROM cells WHERE cell_type = "Special"'
                    );

                    if (allCells.length === 0) {
                        throw new Error("Init Failed: No cells with type 'Special' found. Check your database.");
                    }

                    // B. 插入 28 个验证码 (必须先插这张表，因为有外键约束)
                    const outcomes = ['treasure', 'movement', 'swap', 'empty'];
                    const vInserts = allCells.map(c => [
                        sessionId,
                        c.cell_code,
                        Math.random().toString(36).substring(2, 6).toUpperCase(),
                        outcomes[Math.floor(Math.random() * outcomes.length)]
                    ]);

                    await db.promise().query(
                        'INSERT INTO special_cell_verification (session_id, cell_code, verify_code, outcome_type) VALUES ?',
                        [vInserts]
                    );

                    // C. 插入 10 个宝藏 (确保 ID 不重复)
                    const [templates] = await db.promise().execute('SELECT treasure_id FROM treasures_map');
                    if (templates.length < 10) {
                        throw new Error(`Init Failed: Need at least 10 treasures in treasures_map. (Found: ${templates.length})`);
                    }

                    // 洗牌算法：确保宝藏 ID 和格子都不重复
                    const shuffledT = [...templates].sort(() => 0.5 - Math.random());
                    const shuffledC = [...allCells].sort(() => 0.5 - Math.random()).slice(0, 10);

                    const tInserts = shuffledC.map((cell, i) => [
                        sessionId,
                        shuffledT[i].treasure_id,
                        cell.cell_code,
                        i < 5 ? 1 : 0 // 5真5假
                    ]);

                    await db.promise().query(
                        'INSERT INTO session_treasures (session_id, treasure_id, cell_code, is_real) VALUES ?',
                        [tInserts]
                    );
                }

                // D. 更新游戏状态
                await db.promise().execute(
                    `UPDATE game_session 
                     SET started_at = IFNULL(started_at, NOW()), round_number = 1 
                     WHERE session_id = ?`,
                    [sessionId]
                );

                await db.promise().query('COMMIT');
                console.log(`>>> SUCCESS: Session ${sessionId} world initialized.`);

            } catch (innerErr) {
                await db.promise().query('ROLLBACK');
                throw innerErr; // 抛出让外层 catch 处理
            }

            res.json({ success: true });

        } catch (err) {
            console.error("!!! START GAME CRITICAL ERROR !!!");
            console.error(err.message);
            res.status(500).json({ success: false, message: err.message });
        }
    });

    // --- 逻辑 E: 渲染房主管理页 (权限校验已修改) ---
    router.get('/session-host/:code', async (req, res) => {
        try {
            const accessCode = req.params.code;
            const currentUserId = req.session.user_id;

            const [sessions] = await db.promise().execute(
                'SELECT * FROM game_session WHERE session_access_code = ?', [accessCode]
            );

            if (sessions.length === 0) return res.send("Room not found!");
            const sessionData = sessions[0];

            // 校验：当前用户 ID 是否是该 Session 的创建者 (Host)
            if (sessionData.user_id !== currentUserId) {
                return res.status(403).send("Unauthorized access. Only the host can view this page.");
            }

            res.render('session-host', {
                room: sessionData,
                roomCode: accessCode,
                username: req.session.username
            });
        } catch (err) {
            res.status(500).send("Internal Server Error");
        }
    });

    // --- 逻辑 F: 加入游戏 (包含登录、状态、1-12随机图及人数上限校验) ---
    router.post('/join-session', async (req, res) => {
        try {
            const { playerName, accessCode } = req.body;
            const currentUserId = req.session.user_id;

            if (!currentUserId) {
                return res.status(401).json({ success: false, message: "Please sign in first!" });
            }

            const [rooms] = await db.promise().execute(
                `SELECT session_id, user_id, started_at, ended_at, max_players 
                FROM game_session WHERE session_access_code = ?`,
                [accessCode.toUpperCase()]
            );

            if (rooms.length === 0) return res.json({ success: false, message: "Room not found!" });
            const room = rooms[0];

            // --- 1. 检查游戏是否彻底结束 ---
            if (room.ended_at !== null) {
                return res.json({ success: false, message: "This game has already ended." });
            }

            // --- 2. 核心：优先检查“重连”逻辑 ---
            const [existing] = await db.promise().execute(
                'SELECT player_name FROM players WHERE session_id = ? AND user_id = ?',
                [room.session_id, currentUserId]
            );

            if (existing.length > 0) {
                const players_Name = existing[0].player_name;

                // A. 如果游戏还没开始 (Waiting Session)
                if (room.started_at === null) {
                    if (players_Name !== playerName) {
                        // 玩家输入了新名字，执行更新
                        await db.promise().execute(
                            'UPDATE players SET player_name = ? WHERE session_id = ? AND user_id = ?',
                            [playerName, room.session_id, currentUserId]
                        );
                        console.log(`Player ${currentUserId} changed name to ${playerName}`);
                    }
                    return res.json({
                        success: true,
                        message: "Rejoining and updated name...",
                        alreadyJoined: true
                    });
                }

                // B. 如果游戏已经开始 (Game Started)
                else {
                    // 强制检查名字是否一致
                    if (players_Name !== playerName) {
                        return res.json({
                            success: false,
                            message: `Game in progress! You must use your original name: "${sqlName}" to rejoin.`
                        });
                    }
                    // 名字一致，允许重连进入
                    return res.json({
                        success: true,
                        message: "Reconnecting to active game...",
                        alreadyJoined: true
                    });
                }
            }

            // --- 3. 拦截：非重连玩家在游戏开始后禁止进入 ---
            if (room.started_at !== null) {
                return res.json({ success: false, message: "Game already in progress. You cannot join now." });
            }

            // --- 4. 拦截：房主不能作为玩家加入 ---
            if (currentUserId === room.user_id) {
                return res.json({ success: false, message: "You are the Host!" });
            }

            // --- 5. 人数上限检查 ---
            const [occupied] = await db.promise().execute(
                'SELECT img_id FROM players WHERE session_id = ?',
                [room.session_id]
            );
            const maxAllowed = room.max_players || 6;

            if (occupied.length >= maxAllowed) {
                return res.json({ success: false, message: `Room full (${maxAllowed} max).` });
            }

            // --- 6. 随机 img_id 分配 ---
            const usedIds = occupied.map(row => row.img_id);
            let available = [];
            for (let i = 1; i <= 12; i++) {
                if (!usedIds.includes(i)) available.push(i);
            }
            const randomImgId = available[Math.floor(Math.random() * available.length)];

            // --- 7. 插入新玩家 ---
            const [pRows] = await db.promise().execute('SELECT player_id FROM players ORDER BY player_id DESC LIMIT 1');
            const nextP = pRows.length > 0 ? parseInt(pRows[0].player_id.substring(2)) + 1 : 1;

            await db.promise().execute(
                `INSERT INTO players (player_id, user_id, session_id, player_name, current_cell, coins, img_id) 
                VALUES (?, ?, ?, ?, 'Start', 100, ?)`,
                [formatId('PL', nextP), currentUserId, room.session_id, playerName, randomImgId]
            );

            res.json({ success: true });

        } catch (err) {
            console.error(err);
            res.status(500).json({ success: false, message: "Server error." });
        }
    });

    // --- 逻辑 G: 渲染玩家页面 (新添加) ---
    router.get('/session-player/:code', async (req, res) => {
        try {
            const accessCode = req.params.code;
            const currentUserId = req.session.user_id;

            if (!currentUserId) return res.redirect('/login');

            // --- 核心修改：在 SELECT 中增加 s.user_id AS host_user_id ---
            const [rows] = await db.promise().execute(
                `SELECT p.*, s.session_access_code, s.host_user_id
                FROM players p 
                JOIN game_session s ON p.session_id = s.session_id 
                WHERE s.session_access_code = ? AND p.user_id = ?`,
                [accessCode.toUpperCase(), currentUserId]
            );

            if (rows.length === 0) {
                // 如果玩家还没在 players 表里，说明他没点过 Join，直接踢回首页
                return res.redirect('/');
            }

            // 渲染页面
            res.render('session-player', {
                player: rows[0], // 此时 player 对象里已经包含了 host_user_id
                room: {
                    session_id: rows[0].session_id,
                    user_id: rows[0].host_user_id
                },
                roomCode: accessCode,
                username: req.session.username
            });
        } catch (err) {
            console.error("Session Player Route Error:", err);
            res.status(500).send("Error loading player page");
        }
    });

    // 逻辑 H: 正式结束游戏会话
    router.post('/end-session', async (req, res) => {
        try {
            const { sessionId } = req.body;
            const currentUserId = req.session.user_id;

            // 只有房主本人有权结束
            await db.promise().execute(
                'UPDATE game_session SET ended_at = NOW() WHERE session_id = ? AND user_id = ?',
                [sessionId, currentUserId]
            );
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ success: false });
        }
    });

    // --- 逻辑 I: 获取房间内的玩家列表 (必须包含 img_id) ---
    router.get('/get-players/:sid', async (req, res) => {
        try {
            // 修改这里：增加 img_id
            const [rows] = await db.promise().execute(
                'SELECT player_name, img_id FROM players WHERE session_id = ?',
                [req.params.sid]
            );
            res.json({ players: rows });
        } catch (err) {
            console.error("Fetch players error:", err);
            res.status(500).json({ players: [] });
        }
    });

    // --- 逻辑 J: 检查游戏状态 (供玩家页面轮询，实现自动跳转) ---
    router.get('/check-game-status/:sid', async (req, res) => {
        try {
            const sessionId = req.params.sid;
            // 检查 started_at 是否有值 (逻辑 D 会更新这个字段)
            const [rows] = await db.promise().execute(
                'SELECT started_at, session_access_code FROM game_session WHERE session_id = ?',
                [sessionId]
            );

            if (rows.length > 0 && rows[0].started_at !== null) {
                // 如果已开始，返回 true 并告知 Room Code
                res.json({
                    started: true,
                    roomCode: rows[0].session_access_code
                });
            } else {
                res.json({ started: false });
            }
        } catch (err) {
            res.json({ started: false });
        }
    });

    // --- 逻辑 K: 核心游戏页面跳转 (分流房主与玩家) ---
    router.get('/game-start/:code', async (req, res) => {
        try {
            const currentUserId = req.session.user_id;
            const roomCodeParam = req.params.code;

            if (!currentUserId) return res.redirect('/login');

            // 1. 获取房间信息
            const [rooms] = await db.promise().execute(
                'SELECT * FROM game_session WHERE session_access_code = ?',
                [roomCodeParam.toUpperCase()]
            );

            if (rooms.length === 0) return res.send("Room not found!");
            const roomData = rooms[0];

            // --- 安全检查：如果游戏已彻底结束 (ended_at 不为 null) ---
            if (roomData.ended_at !== null) {
                return res.send("This game session has already ended.");
            }

            // 2. 判断当前用户身份
            if (currentUserId === roomData.user_id) {
                // --- A. 如果是房主 (Host) ---
                if (roomData.started_at === null) {
                    // 还没点开始 -> 去等待大厅 (Lobby)
                    return res.render('session-host', {
                        room: roomData,    // 【关键修改】改为 session，修复 Pug 报错
                        roomCode: roomCodeParam,
                        username: req.session.username
                    });
                } else {
                    // 已经点过开始 -> 去正式游戏主控台 (Game Map)
                    return res.render('game-start-host', {
                        room: roomData,    // 【统一变量名】
                        roomCode: roomCodeParam,
                        username: req.session.username
                    });
                }
            } else {
                // --- B. 如果是加入的玩家 (Player) ---
                const [players] = await db.promise().execute(
                    'SELECT * FROM players WHERE session_id = ? AND user_id = ?',
                    [roomData.session_id, currentUserId]
                );

                if (players.length === 0) {
                    return res.send("You are not part of this session.");
                }

                if (roomData.started_at === null) {
                    // 还没开始 -> 去玩家等待页 (Waiting Room)
                    return res.render('session-player', {
                        player: players[0],
                        room: roomData,    // 【新增】方便玩家页读取 host_user_id
                        roomCode: roomCodeParam,
                        username: req.session.username
                    });
                } else {
                    // 已经开始游戏 -> 去手机操作面板 (Controller)
                    return res.render('game-start-player', {
                        player: players[0],
                        room: roomData,    // 【新增】
                        roomCode: roomCodeParam,
                        username: req.session.username
                    });
                }
            }
        } catch (err) {
            console.error("Game Start Route Error:", err);
            res.status(500).send("Error loading game page");
        }
    });

    // --- 逻辑 L: 玩家主动退出房间并删除记录 ---
    router.delete('/exit-session', async (req, res) => {
        try {
            const { sessionId, userId } = req.body;

            // 核心：从数据库物理删除该玩家
            // 这样他就不再占用房间名额，img_id 也会被释放
            const [result] = await db.promise().execute(
                'DELETE FROM players WHERE session_id = ? AND user_id = ?',
                [sessionId, userId]
            );

            if (result.affectedRows > 0) {
                res.json({ success: true, message: "Player removed successfully." });
            } else {
                res.json({ success: false, message: "No record found to delete." });
            }
        } catch (err) {
            console.error("Exit Session Error:", err);
            res.status(500).json({ success: false, message: "Server error during exit." });
        }
    });

    return router;
};