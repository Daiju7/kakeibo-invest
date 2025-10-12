const express = require('express');
const mysql = require('mysql2');
const app = express();
const cors = require('cors');
const PORT = 3000;


app.use(express.json());
app.use(cors()); //corsとはブラウザがセキュリティのために、別のドメイン（またはポート）からの通信を制限する仕組みのこと、これを解除するためにcorsミドルウェアを使用

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



// ① すべてのデータを取得
app.get('/api/kakeibo', (req, res) => {
  connection.query('SELECT * FROM kakeibo_data', (error, results) => {
    if (error) return res.status(500).json({ error });
    res.json(results);
    console.log('取得できたよ');
    });
});

// ② 新しいデータを追加
app.post('/api/kakeibo', (req, res) => {
    const { title, amount, date } = req.body;
    connection.query(
        'INSERT INTO kakeibo_data (title, amount, date) VALUES (?, ?, ?)',
        [title, amount, date],
        (error, results) => {
        if (error) return res.status(500).json({ error });
        res.json({ message: '追加しました！', id: results.insertId });
        }
    );
});

// ③ データを削除
app.delete('/api/kakeibo/:id', (req, res) => {
    const { id } = req.params;
    connection.query(
        'DELETE FROM kakeibo_data WHERE id = ?',
        [id],
        (error, results) => {
        if (error) return res.status(500).json({ error });
        res.json({ message: '🗑️削除しました！' });
        console.log('削除できたよ');
        }
    );
});











