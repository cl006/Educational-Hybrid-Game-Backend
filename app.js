//1. Import Dependencies:
const express = require("express");
const path = require("path");
const bodyParser = require('body-parser');
const session = require('express-session');
const mysql = require('mysql2');
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Aa@050106',
    database: 'gameDB',
});
db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err);
    } else {
        console.log('Connected to the database');
    }
});
const registerRoute = require('./routes/register')(db);
const loginRoute = require('./routes/login')(db);
const sessionRouter = require('./routes/session')(db);
const gameRoutes = require('./routes/game')(db);

//2. Initialize the App:
const app = express();
app.set('trust proxy', true);

//3. Set Up Middleware:
// 在 app.set('trust proxy', true); 之后添加
app.use((req, res, next) => {
    res.setHeader('ngrok-skip-browser-warning', 'true');
    next();
});
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}))
app.use('/', registerRoute);
app.use('/', loginRoute);
app.use('/', sessionRouter)
app.use('/', gameRoutes)

//4. Set Up View Engine:
app.set("views", path.join(__dirname, "main"));
app.set("view engine", "pug");

//5. Define Routes:
app.get("/", function (req, res) {
    const sessionUser = req.session.username || null;
    console.log("--- Home Route Access ---");
    console.log("User in session:", sessionUser);

    res.render("home", {
        title: "Game Menu",
        username: sessionUser
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) console.log(err);
        res.redirect('/');
    });
});

app.post('/game/end-session', (req, res) => {
    const { sessionId } = req.body;
    const sql = "UPDATE game_sessions SET status = 'ended', ended_at = NOW() WHERE session_id = ?";

    db.query(sql, [sessionId], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true });
    });
});

// Session Authentication Check
function checkLoggedIn(req, res, next) {
    if (req.session.loggedin) {
        next();
    } else {
        req.session.error = 'Please Login!';
        res.redirect('/login');
    }
}

//6. Start the Server:
app.listen(3000, function () {
    console.log("Example app listening on port 3000!")
});
