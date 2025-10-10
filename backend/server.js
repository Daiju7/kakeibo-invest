const express = require('express');
const mysql = require('mysql2');
const app = express();
const cors = require('cors');
const PORT = 3000;

app.use(express.json());
app.use(cors());
app.use(express.json());

// MySQL接続設定
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',       // MySQLユーザー名
    password: '', // MySQLパスワード
    database: 'kakeibo'
});

connection.connect(err => {
    if (err) {
        console.error('MySQL connection error:', err);
    } else {
        console.log('Connected to MySQL');
    }
});

// サーバー起動
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});



app.get('/', (req, res) => {
    res.send('家計簿APIサーバー稼働中');
});


app.get('/a', (req, res) => {
    return res.json('hello express')
});











