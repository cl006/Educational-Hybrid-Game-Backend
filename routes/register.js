const express = require('express');
const router = express.Router();

module.exports = (db) => {
    router.get('/register', (req, res) => {
        res.render('register');
    });

    router.post('/register', (req, res) => {
        const { username, user_email, password, age, gender } = req.body;

        db.query('SELECT COUNT(*) AS count FROM users', (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Database Error");
            }

            const nextNum = result[0].count + 1;
            const newUserId = "U" + nextNum.toString().padStart(4, '0');

            const sql = "INSERT INTO users (user_id, username, user_email, password, age, gender) VALUES (?, ?, ?, ?, ?, ?)";

            db.query(sql, [newUserId, username, user_email, password, age, gender], (err, row) => {
                if (err) {
                    console.error(err);
                    return res.render('register', { error: 'Email already registered!' });
                }

                res.render('register', { success: true });
            });
        });
    });

    return router;
};