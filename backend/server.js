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
const express = require('express');   // Web フレームワーク
const mysql = require('mysql2');      // MySQL データベースドライバー
const app = express();               // Express アプリケーションインスタンス
const cors = require('cors');        // Cross-Origin Resource Sharing
const PORT = 3000;                   // サーバーポート番号

// 【ミドルウェアの設定】
app.use(express.json()); // JSON形式のリクエストボディを解析
// CORS設定 - フロントエンド(port 3001)からのアクセスを許可
// Same-Origin Policyによる制限を回避し、異なるポート間の通信を可能にする
app.use(cors());

// 【MySQL データベース接続設定】
const connection = mysql.createConnection({
    host: 'localhost',     // データベースサーバー
    user: 'root',          // MySQLユーザー名
    password: '',          // MySQLパスワード（空の場合はXAMPP等のローカル環境）
    database: 'kakeibo'    // 使用するデータベース名
});

// 【データベース接続の確立】
connection.connect(err => {
    if (err) {
        console.error('MySQL connection error:', err);
        process.exit(1); // 接続失敗時はプロセス終了
    } else {
        console.log('Connected to MySQL');
    }
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
app.get('/api/kakeibo', (req, res) => {
    // SELECT文で全てのレコードを取得
    connection.query('SELECT * FROM kakeibo_data', (error, results) => {
        if (error) return res.status(500).json({ error });
        res.json(results); // JSON形式でレスポンス
        console.log('取得できたよ');
    });
});

/**
 * ② 新しい支出データを追加
 * エンドポイント: POST /api/kakeibo
 * リクエストボディ: { title, category, amount, date }
 * 用途: 家計簿アプリでの新規支出入力
 */
app.post('/api/kakeibo', (req, res) => {
    // リクエストボディから必要なデータを分割代入で取得
    const { title, category, amount, date } = req.body;
    
    // INSERT文でデータベースに新規レコード挿入
    connection.query(
        'INSERT INTO kakeibo_data (title, category, amount, date) VALUES (?, ?, ?, ?)',
        [title, category, amount, date], // プレースホルダーによるSQLインジェクション対策
        (error, results) => {
            if (error) return res.status(500).json({ error });
            // 挿入成功時は新規作成されたレコードのIDを返す
            res.json({ message: '追加しました！', id: results.insertId });
        }
    );
});

/**
 * ③ 指定IDの支出データを削除
 * エンドポイント: DELETE /api/kakeibo/:id
 * パラメータ: id - 削除対象のレコードID
 * 用途: 家計簿アプリでの支出削除機能
 */
app.delete('/api/kakeibo/:id', (req, res) => {
    // URLパラメータからIDを取得
    const { id } = req.params;
    
    // DELETE文で指定IDのレコードを削除
    connection.query(
        'DELETE FROM kakeibo_data WHERE id = ?',
        [id], // SQLインジェクション対策
        (error, results) => {
            if (error) return res.status(500).json({ error });
            res.json({ message: '🗑️削除しました！' });
            console.log('削除できたよ');
        }
    );
});

/**
 * ④ 全支出データを取得（投資シミュレーション用）
 * エンドポイント: GET /expenses
 * 用途: Next.js API Routes経由での家計簿データ取得
 * 特徴: 投資カテゴリーの詳細ログ出力付き
 */
app.get('/expenses', (req, res) => {
    // 日付降順で全レコードを取得
    connection.query('SELECT * FROM kakeibo_data ORDER BY date DESC', (error, results) => {
        if (error) {
            console.error('Database query error:', error);
            return res.status(500).json({ error: error.message });
        }
        console.log('Expenses data fetched:', results.length, 'records');
        
        // 【デバッグ機能】投資カテゴリーのデータのみを抽出してログ出力
        const investmentData = results.filter(item => item.category === 'investment');
        console.log('Investment records found:', investmentData.length);
        investmentData.forEach(item => {
            console.log(`- ${item.date}: ¥${item.amount} (${item.title})`);
        });
        
        res.json(results); // 全データを返却（フィルタリングはフロントエンド側で実行）
    });
});

/**
 * ⑤ 投資カテゴリーのデータのみを取得（デバッグ用）
 * エンドポイント: GET /expenses/investment
 * 用途: 投資データの確認・デバッグ
 * 特徴: サーバー側で投資カテゴリーのみをフィルタリング
 */
app.get('/expenses/investment', (req, res) => {
    // WHERE句で投資カテゴリーのみを絞り込み
    connection.query(
        'SELECT * FROM kakeibo_data WHERE category = ? ORDER BY date DESC', 
        ['investment'], // categoryカラムが'investment'のレコードのみ
        (error, results) => {
            if (error) {
                console.error('Database query error:', error);
                return res.status(500).json({ error: error.message });
            }
            console.log('Investment-only data fetched:', results.length, 'records');
            res.json(results);
        }
    );
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

        // キャッシュミス時: ダミーデータを使用（テスト用）
        console.log(`🧪 Cache miss for ${symbol}, using dummy data`);
        const dummyData = {
            "Meta Data": {
                "1. Information": "Monthly Prices (open, high, low, close) and Volumes",
                "2. Symbol": symbol,
                "3. Last Refreshed": "2024-01-31",
                "4. Time Zone": "US/Eastern"
            },
            "Monthly Time Series": {
                "2024-01-31": { "1. open": "480.00", "2. high": "490.00", "3. low": "470.00", "4. close": "485.50", "5. volume": "1000000" },
                "2023-12-31": { "1. open": "470.00", "2. high": "480.00", "3. low": "460.00", "4. close": "475.20", "5. volume": "950000" },
                "2023-11-30": { "1. open": "460.00", "2. high": "470.00", "3. low": "450.00", "4. close": "465.80", "5. volume": "900000" }
            }
        };

        // ダミーデータをキャッシュに保存
        await new Promise((resolve, reject) => {
            connection.query(`
                INSERT INTO stock_cache (symbol, data) 
                VALUES (?, ?)
            `, [symbol, JSON.stringify(dummyData)], (error) => {
                if (error) reject(error);
                else resolve();
            });
        });

        console.log(`💾 Saved dummy data for ${symbol} to cache`);
        res.json({
            data: dummyData,
            cached: false,
            testMode: true
        });

    } catch (error) {
        console.error('Cache error:', error);
        res.status(500).json({ error: error.message });
    }
});

