/**
 * 🏠💰 Backend Server - Express.js + PostgreSQL 家計簿サーバー
 * 
 * 【ファイルの役割】
 * - 家計簿データのCRUD操作（作成・読み取り・削除）
 * - PostgreSQL データベースとの接続管理（Render対応）
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
 * カラム: id (SERIAL), title (VARCHAR), category (VARCHAR), amount (INT), date (DATE)
 */

// 【依存関係のインポート】
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");      // PostgreSQLクライアント
const express = require("express");
const app = express();
const cors = require("cors");
const fetch = require("node-fetch"); // Alpha Vantage API 用HTTPクライアント
require("dotenv").config();          // 環境変数の読み込み
const PORT = process.env.PORT || 3000;

// ----------------------------------------
// 【PostgreSQL 接続設定】Render対応
// ----------------------------------------
const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }, // RenderはSSL必須
});

// SQL実行を簡略化するラッパ関数
const query = (text, params = []) => pool.query(text, params);

// PostgreSQL接続確認
pool.connect()
    .then(client => {
        console.log("✅ Connected to PostgreSQL Database");
        client.release();
    })
    .catch(err => {
        console.error("❌ PostgreSQL connection error:", err);
        process.exit(1);
    });

// ----------------------------------------
// 【ミドルウェア設定】
// ----------------------------------------
app.use(express.json());
app.use(cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:3001",
    credentials: true
}));

// リクエストログ記録
const logPath = path.join(__dirname, "requests.log");
app.use((req, res, next) => {
    const log = `${new Date().toISOString()} ${req.method} ${req.url}\n`;
    fs.appendFileSync(logPath, log);
    next();
});

// ----------------------------------------
// 【APIエンドポイント定義】
// ----------------------------------------

/**
 * ① 全ての家計簿データを取得
 * エンドポイント: GET /api/kakeibo
 */
app.get("/api/kakeibo", async (req, res) => {
    try {
        const { rows } = await query("SELECT * FROM kakeibo_data ORDER BY date DESC");
        res.json(rows);
        console.log("📦 家計簿データを取得しました。");
    } catch (error) {
        console.error("❌ Get kakeibo failed:", error);
        res.status(500).json({ error: "家計簿データの取得に失敗しました。" });
    }
});

/**
 * ② 新しい支出データを追加
 * エンドポイント: POST /api/kakeibo
 */
app.post("/api/kakeibo", async (req, res) => {
    const { title, category, amount, date } = req.body;

    if (!title || !category || !amount || !date) {
        return res.status(400).json({ error: "タイトル、カテゴリ、金額、日付は必須です。" });
    }

    try {
        const result = await query(
        "INSERT INTO kakeibo_data (title, category, amount, date) VALUES ($1, $2, $3, $4) RETURNING id",
        [title, category, amount, date]
        );
        res.json({ message: "✅ 追加しました！", id: result.rows[0].id });
    } catch (error) {
        console.error("❌ Insert kakeibo failed:", error);
        res.status(500).json({ error: "家計簿データの追加に失敗しました。" });
    }
});

/**
 * ③ 指定IDの支出データを削除
 * エンドポイント: DELETE /api/kakeibo/:id
 */
app.delete("/api/kakeibo/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const result = await query("DELETE FROM kakeibo_data WHERE id = $1 RETURNING id", [id]);
        if (result.rowCount === 0) {
        return res.status(404).json({ error: "対象データが見つかりません。" });
        }
        res.json({ message: "🗑️ 削除しました！" });
    } catch (error) {
        console.error("❌ Delete failed:", error);
        res.status(500).json({ error: "削除に失敗しました。" });
    }
});

/**
 * ④ 全支出データを取得（投資シミュレーション用）
 */
app.get("/expenses", async (req, res) => {
    try {
        const { rows } = await query("SELECT * FROM kakeibo_data ORDER BY date DESC");
        const investmentData = rows.filter(item => item.category === "investment");

        console.log(`📊 全データ ${rows.length} 件, 投資カテゴリー ${investmentData.length} 件`);
        res.json(rows);
    } catch (error) {
        console.error("❌ Expenses query failed:", error);
        res.status(500).json({ error: "支出データの取得に失敗しました。" });
    }
});

/**
 * ⑤ 投資カテゴリーのみ取得（デバッグ用）
 */
app.get("/expenses/investment", async (req, res) => {
    try {
        const { rows } = await query(
        "SELECT * FROM kakeibo_data WHERE category = $1 ORDER BY date DESC",
        ["investment"]
        );
        console.log(`💰 投資データ ${rows.length} 件を取得しました。`);
        res.json(rows);
    } catch (error) {
        console.error("❌ Investment query failed:", error);
        res.status(500).json({ error: "投資データの取得に失敗しました。" });
    }
});

// ----------------------------------------
// 【Alpha Vantage API キャッシュ機能】
// ----------------------------------------

/**
 * Alpha Vantage APIキャッシュ付き株価データ取得
 * エンドポイント: GET /api/stock-cached/:symbol
 */
app.get("/api/stock-cached/:symbol", async (req, res) => {
    const { symbol } = req.params;
    const CACHE_EXPIRY_HOURS = 24;

    try {
        const { rows: cached } = await query(
        `
        SELECT data, fetched_at
        FROM stock_cache
        WHERE symbol = $1
            AND fetched_at > NOW() - INTERVAL '${CACHE_EXPIRY_HOURS} hours'
        ORDER BY fetched_at DESC
        LIMIT 1
        `,
        [symbol]
    );

    // キャッシュがあれば返す
    if (cached.length > 0) {
        console.log(`📦 Cache hit for ${symbol}`);
        const data = typeof cached[0].data === "string" ? JSON.parse(cached[0].data) : cached[0].data;
        return res.json({ data, cached: true, fetchedAt: cached[0].fetched_at });
    }

    console.log(`🌐 Cache miss for ${symbol}, fetching from Alpha Vantage API`);

    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    const apiUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_MONTHLY&symbol=${symbol}&apikey=${apiKey}`;
    const response = await fetch(apiUrl);
    const apiData = await response.json();

    if (apiData["Error Message"] || apiData["Note"]) {
        throw new Error(apiData["Error Message"] || apiData["Note"] || "API limit reached");
    }

    await query(
        `
        INSERT INTO stock_cache (symbol, data, fetched_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (symbol)
        DO UPDATE SET data = EXCLUDED.data, fetched_at = EXCLUDED.fetched_at
        `,
        [symbol, JSON.stringify(apiData)]
    );

    console.log(`💾 Saved real data for ${symbol} to cache`);
    res.json({ data: apiData, cached: false });
    } catch (error) {
    console.error("❌ Stock cache error:", error);
    res.status(500).json({ error: error.message });
    }
});

// ----------------------------------------
// 【サーバー起動】
// ----------------------------------------
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});









// /**
//  * 🏠💰 Backend Server - Express.js + MySQL家計簿サーバー
//  * 
//  * 【ファイルの役割】
//  * - 家計簿データのCRUD操作（作成・読み取り・削除）
//  * - MySQL データベースとの接続管理
//  * - フロントエンドからのHTTPリクエストの処理
//  * - CORS設定によるクロスオリジン通信の許可
//  * - 投資シミュレーション用の家計簿データ提供
//  * 
//  * 【API エンドポイント一覧】
//  * GET  /api/kakeibo        - 全ての家計簿データを取得
//  * POST /api/kakeibo        - 新しい支出データを追加
//  * DELETE /api/kakeibo/:id  - 指定IDの支出データを削除
//  * GET  /expenses           - 全支出データ取得（投資シミュレーション用）
//  * GET  /expenses/investment - 投資カテゴリーのみ取得（デバッグ用）
//  * 
//  * 【データベース構造】
//  * テーブル名: kakeibo_data
//  * カラム: id (INT), title (VARCHAR), category (VARCHAR), amount (INT), date (DATE)
//  */

// // 【依存関係のインポート】
// // ファイル操作用のモジュールを読み込み

// const fs = require('fs');
// const path = require('path');
// const { Pool } = require('pg');
// const express = require('express');   // Web フレームワーク
// const app = express();               // Express アプリケーションインスタンス
// const cors = require('cors');        // Cross-Origin Resource Sharing
// const fetch = require('node-fetch');  // HTTP requests for Alpha Vantage API
// require('dotenv').config();          // 環境変数の読み込み
// const PORT = 3000;                   // サーバーポート番号
// const bcrypt = require('bcrypt');    // パスワードハッシュ化ライブラリ
// const SALT_ROUNDS = 10;              // bcryptのソルトラウンド数 ラウンドとは、ハッシュ化の計算コストを示す。数値が大きいほどセキュリティは高まるが、処理時間も増加する
// const session = require('express-session');
// const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-session-secret';

// const logPath = path.join(__dirname, 'requests.log');

// const pool = new Pool({
//     host: process.env.DB_HOST || 'localhost',
//     port: Number(process.env.DB_PORT) || 5432,
//     user: process.env.DB_USER || 'postgres',
//     password: process.env.DB_PASSWORD || '',
//     database: process.env.DB_NAME || process.env.DB_NAME || 'kakeibo',
//     ssl: (process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production')
//         ? { rejectUnauthorized: false }
//         : undefined,
// });

// const query = (text, params = []) => pool.query(text, params);

// pool.connect()
//     .then(client => {
//         console.log('Connected to PostgreSQL');
//         client.release();
//     })
//     .catch(err => {
//         console.error('PostgreSQL connection error:', err);
//         process.exit(1);
//     });

// // 【ミドルウェアの設定】
// app.use(express.json()); // JSON形式のリクエストボディを解析

// // CORS設定 - フロントエンド(port 3001)からのアクセスを許可
// // Same-Origin Policyによる制限を回避し、異なるポート間の通信を可能にする
// app.use(cors({
//     origin: process.env.CLIENT_ORIGIN || 'http://localhost:3001',
//     credentials: true
// }));

// app.use(session({
//     name: 'kakeibo.sid',
//     secret: SESSION_SECRET,
//     resave: false,
//     saveUninitialized: false,
//     cookie: {
//         httpOnly: true,
//         secure: process.env.NODE_ENV === 'production',
//         sameSite: 'lax',
//         maxAge: 1000 * 60 * 60 * 24 // 1 day
//     }
// }));

// // ミドルウェア内で使用
// app.use((req, res, next) => {
//     const log = `${new Date().toISOString()} ${req.method} ${req.url}\n`;
//     fs.appendFileSync(logPath, log);
//     next();
// });

// const requireAuth = (req, res, next) => {
//     if (!req.session.user) {
//         return res.status(401).json({ error: 'ログインが必要です。' });
//     }
//     next();
// };
// // 【サーバー起動】
// app.listen(PORT, () => {
//     console.log(`Server running at http://localhost:${PORT}`);
// });

// // ========================================
// // 【API エンドポイント定義】
// // ========================================

// /**
//  * ① 全ての家計簿データを取得
//  * エンドポイント: GET /api/kakeibo
//  * 用途: メイン家計簿ページでの支出一覧表示
//  */
// app.get('/api/kakeibo', requireAuth, async (req, res) => {
//     try {
//         const { rows } = await query(
//             'SELECT * FROM kakeibo_data WHERE user_id = $1 ORDER BY date DESC',
//             [req.session.user.id]
//         );
//         res.json(rows);
//     } catch (error) {
//         console.error('Get kakeibo failed:', error);
//         res.status(500).json({ error: '家計簿データの取得に失敗しました。' });
//     }
// });

// /**
//  * ② 新しい支出データを追加
//  * エンドポイント: POST /api/kakeibo
//  * リクエストボディ: { title, category, amount, date }
//  * 用途: 家計簿アプリでの新規支出入力
//  */
// app.post('/api/kakeibo', requireAuth, async (req, res) => {
//     const { title, category, amount, date } = req.body || {};

//     if (!title || !category || !amount || !date) {
//         return res.status(400).json({ error: 'タイトル、カテゴリ、金額、日付は必須です。' });
//     }

//     const parsedAmount = Number(amount);
//     if (Number.isNaN(parsedAmount)) {
//         return res.status(400).json({ error: '金額は数値で指定してください。' });
//     }

//     try {
//         const { rows } = await query(
//             'INSERT INTO kakeibo_data (title, category, amount, date, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
//             [title, category, parsedAmount, date, req.session.user.id]
//         );
//         res.json({ message: '追加しました！', id: rows[0].id });
//     } catch (error) {
//         console.error('Insert kakeibo failed:', error);
//         res.status(500).json({ error: '家計簿データの追加に失敗しました。' });
//     }
// });

// /**
//  * ③ 指定IDの支出データを削除
//  * エンドポイント: DELETE /api/kakeibo/:id
//  * パラメータ: id - 削除対象のレコードID
//  * 用途: 家計簿アプリでの支出削除機能
//  */
// app.delete('/api/kakeibo/:id', requireAuth, async (req, res) => {
//     const { id } = req.params;

//     try {
//         const result = await query(
//             'DELETE FROM kakeibo_data WHERE id = $1 AND user_id = $2 RETURNING id',
//             [id, req.session.user.id]
//         );

//         if (result.rowCount === 0) {
//             return res.status(404).json({ error: '対象データが見つかりませんでした。' });
//         }

//         res.json({ message: '🗑️削除しました！' });
//     } catch (error) {
//         console.error('Delete kakeibo failed:', error);
//         res.status(500).json({ error: '家計簿データの削除に失敗しました。' });
//     }
// });

// /**
//  * ④ 全支出データを取得（投資シミュレーション用）
//  * エンドポイント: GET /expenses
//  * 用途: Next.js API Routes経由での家計簿データ取得
//  * 特徴: 投資カテゴリーの詳細ログ出力付き
//  */
// app.get('/expenses', requireAuth, async (req, res) => {
//     try {
//         const { rows } = await query(
//             'SELECT * FROM kakeibo_data WHERE user_id = $1 ORDER BY date DESC',
//             [req.session.user.id]
//         );

//         const investmentData = rows.filter(item => item.category === 'investment');
//         console.log('Expenses data fetched:', rows.length, 'records');
//         console.log('Investment records found:', investmentData.length);
//         investmentData.forEach(item => {
//             console.log(`- ${item.date}: ¥${item.amount} (${item.title})`);
//         });

//         res.json(rows);
//     } catch (error) {
//         console.error('Expenses query failed:', error);
//         res.status(500).json({ error: '支出データの取得に失敗しました。' });
//     }
// });

// /**
//  * ⑤ 投資カテゴリーのデータのみを取得（デバッグ用）
//  * エンドポイント: GET /expenses/investment
//  * 用途: 投資データの確認・デバッグ
//  * 特徴: サーバー側で投資カテゴリーのみをフィルタリング
//  */
// app.get('/expenses/investment', requireAuth, async (req, res) => {
//     try {
//         const { rows } = await query(
//             'SELECT * FROM kakeibo_data WHERE category = $1 AND user_id = $2 ORDER BY date DESC',
//             ['investment', req.session.user.id]
//         );
//         console.log('Investment-only data fetched:', rows.length, 'records');
//         res.json(rows);
//     } catch (error) {
//         console.error('Investment expenses query failed:', error);
//         res.status(500).json({ error: '投資データの取得に失敗しました。' });
//     }
// });

// // ========================================
// // 【ALPHA VANTAGE API キャッシュ機能】
// // ========================================

// /**
//  * Alpha Vantage APIキャッシュ付き株価データ取得
//  * エンドポイント: GET /api/stock-cached/:symbol
//  * 用途: Alpha Vantage API制限回避のため、MySQLキャッシュを使用
//  */
// app.get('/api/stock-cached/:symbol', async (req, res) => {
//     const { symbol } = req.params;
//     const CACHE_EXPIRY_HOURS = 24;
    
//     try {
//         const { rows: cachedRows } = await query(
//             `
//             SELECT data, fetched_at
//             FROM stock_cache
//             WHERE symbol = $1
//               AND fetched_at > NOW() - $2 * INTERVAL '1 hour'
//             ORDER BY fetched_at DESC
//             LIMIT 1
//             `,
//             [symbol, CACHE_EXPIRY_HOURS]
//         );

//         const cachedEntry = cachedRows[0];

//         if (cachedEntry) {
//             const payload = typeof cachedEntry.data === 'string'
//                 ? JSON.parse(cachedEntry.data)
//                 : cachedEntry.data;

//             console.log(`📦 Cache hit for ${symbol}`);
//             return res.json({
//                 data: payload,
//                 cached: true,
//                 fetchedAt: cachedEntry.fetched_at
//             });
//         }

//         console.log(`🌐 Cache miss for ${symbol}, fetching from Alpha Vantage API`);
        
//         const apiKey = process.env.ALPHA_VANTAGE_API_KEY || process.env.ALPHAVANTAGE_API_KEY;
//         if (!apiKey) {
//             throw new Error('Alpha Vantage API key not found in environment variables');
//         }

//         const apiUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_MONTHLY&symbol=${symbol}&apikey=${apiKey}`;
//         console.log(`📡 Fetching from Alpha Vantage: ${symbol}`);
        
//         const response = await fetch(apiUrl);
//         const apiData = await response.json();
        
//         if (apiData['Error Message'] || apiData['Note']) {
//             console.error('Alpha Vantage API error:', apiData);
//             throw new Error(apiData['Error Message'] || apiData['Note'] || 'API limit reached');
//         }

//         await query(
//             `
//             INSERT INTO stock_cache (symbol, data, fetched_at)
//             VALUES ($1, $2, NOW())
//             ON CONFLICT (symbol)
//             DO UPDATE SET data = EXCLUDED.data, fetched_at = EXCLUDED.fetched_at
//             `,
//             [symbol, JSON.stringify(apiData)]
//         );

//         console.log(`💾 Saved real data for ${symbol} to cache`);
//         res.json({
//             data: apiData,
//             cached: false,
//             realData: true
//         });

//     } catch (error) {
//         console.error('Cache error:', error);
//         res.status(500).json({ error: error.message });
//     }
// });


// // ========================================
// // 【認証API 入力値の検証】
// // ========================================

// app.post('/api/auth/register', async (req, res) => {
//     const { email, password, name } = req.body || {}; //リクエストボディからemail, password, nameを取得。bodyがundefinedの場合に備えて空オブジェクトをデフォルト値として設定

//     // 入力値の基本的な検証 - メールアドレスとパスワードの存在チェック
//     if (!email || typeof email !== 'string' || email.trim() === '') {
//         return res.status(400).json({ error: 'メールアドレスは必須です。' });
//     }

//     if (!password || typeof password !== 'string' || password.trim() === '') {
//         return res.status(400).json({ error: 'パスワードは必須です。' });
//     }

//     const normalizedEmail = email.trim();
//     const normalizedPassword = password.trim();
//     const normalizedName = typeof name === 'string' && name.trim() !== '' ? name.trim() : null;

//     try {
//         const { rows: existingUsers } = await query(
//             'SELECT id FROM users WHERE email = $1',
//             [normalizedEmail]
//         );

//         if (existingUsers.length > 0) {
//             return res.status(409).json({ error: 'このメールアドレスは既に登録されています。' });
//         }
//     } catch (error) {
//         console.error('User lookup failed:', error);
//         return res.status(500).json({ error: 'サーバーエラーが発生しました。' });
//     }

//     let passwordHash;
//     try {
//         passwordHash = await bcrypt.hash(normalizedPassword, SALT_ROUNDS);
//     } catch (error) {
//         console.error('Password hashing failed:', error);
//         return res.status(500).json({ error: 'パスワードのハッシュ化に失敗しました。' });
//     }

//     try {
//         const { rows } = await query(
//             'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name',
//             [normalizedEmail, passwordHash, normalizedName]
//         );

//         const sessionUser = rows[0];

//         req.session.user = sessionUser;

//         return res.status(201).json({
//             message: 'ユーザー登録が完了しました。',
//             user: sessionUser
//         });
//     } catch (error) {
//         console.error('User insert failed:', error);
//         return res.status(500).json({ error: 'ユーザー登録に失敗しました。' });
//     }
// });

// // ========================================
// // 【認証API - ログイン】
// // ========================================

// app.post('/api/auth/login', async (req, res) => {
//     const { email, password } = req.body || {};

//     if (!email || typeof email !== 'string' || email.trim() === '') {
//         return res.status(400).json({ error: 'メールアドレスは必須です。' });
//     }

//     if (!password || typeof password !== 'string' || password.trim() === '') {
//         return res.status(400).json({ error: 'パスワードは必須です。' });
//     }

//     const normalizedEmail = email.trim();
//     const rawPassword = password.trim();

//     let user;
//     try {
//         const { rows } = await query(
//             'SELECT id, password_hash, name FROM users WHERE email = $1',
//             [normalizedEmail]
//         );

//         if (rows.length === 0) {
//             return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません。' });
//         }

//         user = rows[0];
//     } catch (error) {
//         console.error('Login lookup failed:', error);
//         return res.status(500).json({ error: 'サーバーエラーが発生しました。' });
//     }

//     try {
//         const match = await bcrypt.compare(rawPassword, user.password_hash);
//         if (!match) {
//             return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません。' });
//         }
//     } catch (error) {
//         console.error('Password comparison failed:', error);
//         return res.status(500).json({ error: 'サーバーエラーが発生しました。' });
//     }

//     const sessionUser = {
//         id: user.id,
//         email: normalizedEmail,
//         name: user.name || null
//     };

//     req.session.user = sessionUser;

//     return res.status(200).json({
//         message: 'ログインに成功しました。',
//         user: sessionUser
//     });
// });

// app.post('/api/auth/logout', (req, res) => {
//     req.session.destroy(err => {
//         if (err) {
//             console.error('Logout failed:', err);
//             return res.status(500).json({ error: 'ログアウトに失敗しました。' });
//         }
//         res.clearCookie('kakeibo.sid');
//         return res.json({ message: 'ログアウトしました。' });
//     });
// });

// app.get('/api/auth/me', (req, res) => {
//     if (!req.session.user) {
//         return res.status(401).json({ error: 'ログインしていません。' });
//     }
//     return res.json({ user: req.session.user });
// });
