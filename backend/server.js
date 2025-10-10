const express = require('express');
const mysql = require('mysql2');
const app = express();
const PORT = 3000;

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

// サンプルAPI
app.get('/api/kakeibo', (req, res) => {
    connection.query('SELECT * FROM kakeibo', (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
    });
});


app.get('/', (req, res) => {
  res.send('家計簿APIサーバー稼働中');
});


app.post('/api/expenses', (req, res) => {
    const { title, amount, date } = req.body;
    
    connection.query(
        'INSERT INTO kakeibo (title, amount, date) VALUES (?, ?, ?)',
        [title, amount, date],
        (err, results) => {
        if (err) return res.status(500).json({ error: err });
        res.json({ id: results.insertId, title, amount, date });
        }
    );
});




// サーバー起動
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});




