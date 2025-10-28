require('dotenv').config();

/**
 * 🏠💰 Backend Server - Express.js + MySQL家計簿サーバー
 * 
 * 【ファイルの役割】
 * - 家計簿データのCRUD操作（作成・読み取り・削除）
 * - MySQL データベースとの接続管理
 * - フロントエンドからのHTTPリクエストの処理
 * - CORS設定によるクロスオリジン通信の許可
 * - 投資シミュレーション用の家計簿データ提供
 * 
 * 【API エンドポイント一覧】
 * GET  /api/kakeibo        - 全ての家計簿データを取得
 * POST /api/kakeibo        - 新しい支出データを追加
 * DELETE /api/kakeibo/:id  - 指定IDの支出データを削除
 * GET  /expenses           - 全支出データ取得（投資シミュレーション用）
 * GET  /expenses/investment - 投資カテゴリーのみ取得（デバッグ用）
 * 
 * 【データベース構造】
 * テーブル名: kakeibo_data
 * カラム: id (INT), title (VARCHAR), category (VARCHAR), amount (INT), date (DATE)
 */

// 【依存関係のインポート】
// ファイル操作用のモジュールを読み込み

const fs = require('fs');
const path = require('path');
// ミドルウェアの上の方にこれを追加
const logPath = path.join(__dirname, 'requests.log');

const express = require('express');   // Web フレームワーク
const mysql = require('mysql2');      // MySQL データベースドライバー
const app = express();               // Express アプリケーションインスタンス
const cors = require('cors');        // Cross-Origin Resource Sharing
const fetch = require('node-fetch');  // HTTP requests for Alpha Vantage API
require('dotenv').config();          // 環境変数の読み込み
const PORT = 3000;                   // サーバーポート番号
const bcrypt = require('bcrypt');    // パスワードハッシュ化ライブラリ
const SALT_ROUNDS = 10;              // bcryptのソルトラウンド数 ラウンドとは、ハッシュ化の計算コストを示す。数値が大きいほどセキュリティは高まるが、処理時間も増加する
const session = require('express-session');
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-session-secret';

// 【ミドルウェアの設定】
app.use(express.json()); // JSON形式のリクエストボディを解析

// CORS設定 - フロントエンド(port 3001)からのアクセスを許可
// Same-Origin Policyによる制限を回避し、異なるポート間の通信を可能にする
app.use(cors({
    origin: 'http://localhost:3001',
    credentials: true
}));

app.use(session({
    name: 'kakeibo.sid',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 // 1 day
    }
}));

// ミドルウェア内で使用
app.use((req, res, next) => {
    const log = `${new Date().toISOString()} ${req.method} ${req.url}\n`;
    fs.appendFileSync(logPath, log);
    next();
});

const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'ログインが必要です。' });
    }
    next();
};

// 【MySQL データベース接続設定】
const connectionConfig = {
    host: 'localhost',     // データベースサーバー
    user: 'root',          // MySQLユーザー名
    password: '',          // MySQLパスワード（空の場合はXAMPP等のローカル環境）
    database: 'kakeibo'    // 使用するデータベース名
};

if (process.platform === 'darwin') {
    connectionConfig.socketPath = '/tmp/mysql.sock';
}

const connection = mysql.createConnection(connectionConfig);

// 【データベース接続の確立】
connection.connect(err => {
    if (err) {
        console.error('MySQL connection error:', err);
        process.exit(1); // 接続失敗時はプロセス終了
    } else {
        console.log('Connected to MySQL');
    }
});

const query = (sql, params = []) => new Promise((resolve, reject) => {
    connection.query(sql, params, (error, results) => {
        if (error) {
            reject(error);
        } else {
            resolve(results);
        }
    });
});

// 【サーバー起動】
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

// ========================================
// 【API エンドポイント定義】
// ========================================

/**
 * ① 全ての家計簿データを取得
 * エンドポイント: GET /api/kakeibo
 * 用途: メイン家計簿ページでの支出一覧表示
 */
app.get('/api/kakeibo', requireAuth, async (req, res) => {
    try {
        const rows = await query(
            'SELECT * FROM kakeibo_data WHERE user_id = ? ORDER BY date DESC',
            [req.session.user.id]
        );
        res.json(rows);
    } catch (error) {
        console.error('Get kakeibo failed:', error);
        res.status(500).json({ error: '家計簿データの取得に失敗しました。' });
    }
});

/**
 * ② 新しい支出データを追加
 * エンドポイント: POST /api/kakeibo
 * リクエストボディ: { title, category, amount, date }
 * 用途: 家計簿アプリでの新規支出入力
 */
app.post('/api/kakeibo', requireAuth, async (req, res) => {
    const { title, category, amount, date } = req.body || {};

    if (!title || !category || !amount || !date) {
        return res.status(400).json({ error: 'タイトル、カテゴリ、金額、日付は必須です。' });
    }

    const parsedAmount = Number(amount);
    if (Number.isNaN(parsedAmount)) {
        return res.status(400).json({ error: '金額は数値で指定してください。' });
    }

    try {
        const result = await query(
            'INSERT INTO kakeibo_data (title, category, amount, date, user_id) VALUES (?, ?, ?, ?, ?)',
            [title, category, parsedAmount, date, req.session.user.id]
        );
        res.json({ message: '追加しました！', id: result.insertId });
    } catch (error) {
        console.error('Insert kakeibo failed:', error);
        res.status(500).json({ error: '家計簿データの追加に失敗しました。' });
    }
});

/**
 * ③ 指定IDの支出データを削除
 * エンドポイント: DELETE /api/kakeibo/:id
 * パラメータ: id - 削除対象のレコードID
 * 用途: 家計簿アプリでの支出削除機能
 */
app.delete('/api/kakeibo/:id', requireAuth, async (req, res) => {
    const { id } = req.params;

    try {
        const result = await query(
            'DELETE FROM kakeibo_data WHERE id = ? AND user_id = ?',
            [id, req.session.user.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: '対象データが見つかりませんでした。' });
        }

        res.json({ message: '🗑️削除しました！' });
    } catch (error) {
        console.error('Delete kakeibo failed:', error);
        res.status(500).json({ error: '家計簿データの削除に失敗しました。' });
    }
});

/**
 * ④ 全支出データを取得（投資シミュレーション用）
 * エンドポイント: GET /expenses
 * 用途: Next.js API Routes経由での家計簿データ取得
 * 特徴: 投資カテゴリーの詳細ログ出力付き
 */
app.get('/expenses', requireAuth, async (req, res) => {
    try {
        const rows = await query(
            'SELECT * FROM kakeibo_data WHERE user_id = ? ORDER BY date DESC',
            [req.session.user.id]
        );

        const investmentData = rows.filter(item => item.category === 'investment');
        console.log('Expenses data fetched:', rows.length, 'records');
        console.log('Investment records found:', investmentData.length);
        investmentData.forEach(item => {
            console.log(`- ${item.date}: ¥${item.amount} (${item.title})`);
        });

        res.json(rows);
    } catch (error) {
        console.error('Expenses query failed:', error);
        res.status(500).json({ error: '支出データの取得に失敗しました。' });
    }
});

/**
 * ⑤ 投資カテゴリーのデータのみを取得（デバッグ用）
 * エンドポイント: GET /expenses/investment
 * 用途: 投資データの確認・デバッグ
 * 特徴: サーバー側で投資カテゴリーのみをフィルタリング
 */
app.get('/expenses/investment', requireAuth, async (req, res) => {
    try {
        const rows = await query(
            'SELECT * FROM kakeibo_data WHERE category = ? AND user_id = ? ORDER BY date DESC',
            ['investment', req.session.user.id]
        );
        console.log('Investment-only data fetched:', rows.length, 'records');
        res.json(rows);
    } catch (error) {
        console.error('Investment expenses query failed:', error);
        res.status(500).json({ error: '投資データの取得に失敗しました。' });
    }
});

// ========================================
// 【ALPHA VANTAGE API キャッシュ機能】
// ========================================

/**
 * Alpha Vantage APIキャッシュ付き株価データ取得
 * エンドポイント: GET /api/stock-cached/:symbol
 * 用途: Alpha Vantage API制限回避のため、MySQLキャッシュを使用
 */
app.get('/api/stock-cached/:symbol', async (req, res) => {
    const { symbol } = req.params;
    const CACHE_EXPIRY_HOURS = 24;
    
    try {
        // キャッシュから最新データを確認
        const cachedData = await new Promise((resolve, reject) => {
            connection.query(`
                SELECT data, fetched_at 
                FROM stock_cache 
                WHERE symbol = ? 
                AND fetched_at > DATE_SUB(NOW(), INTERVAL ? HOUR)
                ORDER BY fetched_at DESC 
                LIMIT 1
            `, [symbol, CACHE_EXPIRY_HOURS], (error, results) => {
                if (error) reject(error);
                else resolve(results[0] || null);
            });
        });

        // キャッシュヒット時
        if (cachedData) {
            console.log(`📦 Cache hit for ${symbol}`);
            return res.json({
                data: cachedData.data,
                cached: true,
                fetchedAt: cachedData.fetched_at
            });
        }

        // キャッシュミス時: Alpha Vantage APIから実データを取得
        console.log(`🌐 Cache miss for ${symbol}, fetching from Alpha Vantage API`);
        
        const apiKey = process.env.ALPHAVANTAGE_API_KEY;
        if (!apiKey) {
            throw new Error('Alpha Vantage API key not found in environment variables');
        }

        // Alpha Vantage APIから月次データを取得
        const apiUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_MONTHLY&symbol=${symbol}&apikey=${apiKey}`;
        console.log(`📡 Fetching from Alpha Vantage: ${symbol}`);
        
        const response = await fetch(apiUrl);
        const apiData = await response.json();
        
        // APIエラーチェック
        if (apiData['Error Message'] || apiData['Note']) {
            console.error('Alpha Vantage API error:', apiData);
            throw new Error(apiData['Error Message'] || apiData['Note'] || 'API limit reached');
        }

        // APIから取得したデータをキャッシュに保存
        await new Promise((resolve, reject) => {
            connection.query(`
                REPLACE INTO stock_cache (symbol, data, fetched_at) 
                VALUES (?, ?, NOW())
            `, [symbol, JSON.stringify(apiData)], (error) => {
                if (error) reject(error);
                else resolve();
            });
        });

        console.log(`💾 Saved real data for ${symbol} to cache`);
        res.json({
            data: apiData,
            cached: false,
            realData: true
        });

    } catch (error) {
        console.error('Cache error:', error);
        res.status(500).json({ error: error.message });
    }
});


// ========================================
// 【認証API 入力値の検証】
// ========================================

app.post('/api/auth/register', async (req, res) => {
    const { email, password, name } = req.body || {}; //リクエストボディからemail, password, nameを取得。bodyがundefinedの場合に備えて空オブジェクトをデフォルト値として設定

    // 入力値の基本的な検証 - メールアドレスとパスワードの存在チェック
    if (!email || typeof email !== 'string' || email.trim() === '') {
        return res.status(400).json({ error: 'メールアドレスは必須です。' });
    }

    if (!password || typeof password !== 'string' || password.trim() === '') {
        return res.status(400).json({ error: 'パスワードは必須です。' });
    }

    const normalizedEmail = email.trim();
    const normalizedPassword = password.trim();
    const normalizedName = typeof name === 'string' && name.trim() !== '' ? name.trim() : null;

    try {
        const existingUsers = await query(
            'SELECT id FROM users WHERE email = ?',
            [normalizedEmail]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({ error: 'このメールアドレスは既に登録されています。' });
        }
    } catch (error) {
        console.error('User lookup failed:', error);
        return res.status(500).json({ error: 'サーバーエラーが発生しました。' });
    }

    let passwordHash;
    try {
        passwordHash = await bcrypt.hash(normalizedPassword, SALT_ROUNDS);
    } catch (error) {
        console.error('Password hashing failed:', error);
        return res.status(500).json({ error: 'パスワードのハッシュ化に失敗しました。' });
    }

    try {
        const insertResult = await query(
            'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
            [normalizedEmail, passwordHash, normalizedName]
        );

        const sessionUser = {
            id: insertResult.insertId,
            email: normalizedEmail,
            name: normalizedName
        };

        req.session.user = sessionUser;

        return res.status(201).json({
            message: 'ユーザー登録が完了しました。',
            user: sessionUser
        });
    } catch (error) {
        console.error('User insert failed:', error);
        return res.status(500).json({ error: 'ユーザー登録に失敗しました。' });
    }
});

// ========================================
// 【認証API - ログイン】
// ========================================

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body || {};

    if (!email || typeof email !== 'string' || email.trim() === '') {
        return res.status(400).json({ error: 'メールアドレスは必須です。' });
    }

    if (!password || typeof password !== 'string' || password.trim() === '') {
        return res.status(400).json({ error: 'パスワードは必須です。' });
    }

    const normalizedEmail = email.trim();
    const rawPassword = password.trim();

    let user;
    try {
        const rows = await query(
            'SELECT id, password_hash, name FROM users WHERE email = ?',
            [normalizedEmail]
        );

        if (rows.length === 0) {
            return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません。' });
        }

        user = rows[0];
    } catch (error) {
        console.error('Login lookup failed:', error);
        return res.status(500).json({ error: 'サーバーエラーが発生しました。' });
    }

    try {
        const match = await bcrypt.compare(rawPassword, user.password_hash);
        if (!match) {
            return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません。' });
        }
    } catch (error) {
        console.error('Password comparison failed:', error);
        return res.status(500).json({ error: 'サーバーエラーが発生しました。' });
    }

    const sessionUser = {
        id: user.id,
        email: normalizedEmail,
        name: user.name || null
    };

    req.session.user = sessionUser;

    return res.status(200).json({
        message: 'ログインに成功しました。',
        user: sessionUser
    });
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Logout failed:', err);
            return res.status(500).json({ error: 'ログアウトに失敗しました。' });
        }
        res.clearCookie('kakeibo.sid');
        return res.json({ message: 'ログアウトしました。' });
    });
});

app.get('/api/auth/me', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'ログインしていません。' });
    }
    return res.json({ user: req.session.user });
});
