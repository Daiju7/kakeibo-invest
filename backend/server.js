const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const bcrypt = require('bcrypt');
// セッションストア用のconnect-pgを追加する必要があります
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { generateToken, verifyToken, getTokenFromRequest, requireAuthJWT } = require('./auth-token');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;
const SALT_ROUNDS = 10;
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-session-secret';
const logPath = path.join(__dirname, 'requests.log');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'false' ? undefined : { rejectUnauthorized: false }
});

const query = (text, params = []) => pool.query(text, params);

pool.connect()
    .then(client => {
        console.log('✅ Connected to PostgreSQL');
        client.release();
    })
    .catch(err => {
        console.error('❌ PostgreSQL connection error:', err);
        process.exit(1);
    });

app.set('trust proxy', 1);
app.use(express.json());

// 本番環境用の改良されたCORS設定
const corsOptions = {
    origin: function (origin, callback) {
        // 開発環境または許可されたドメインからのリクエストを許可
        const allowedOrigins = [
            'http://localhost:3001',
            'https://kakeibo-invest.vercel.app', // 明示的にVercelドメインを追加
            process.env.CLIENT_ORIGIN,
            process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
            ...(process.env.CLIENT_ORIGINS ? process.env.CLIENT_ORIGINS.split(',').map(o => o.trim()) : [])
        ].filter(Boolean);

        console.log('🔍 CORS Check - Origin:', origin, 'Allowed Origins:', allowedOrigins);

        // originがnull/undefinedの場合（モバイルアプリなど）も許可
        if (!origin) {
            console.log('✅ CORS: No origin (mobile/postman), allowing');
            return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
            console.log('✅ CORS: Origin allowed');
            return callback(null, true);
        } else {
            console.warn(`❌ CORS rejected origin: ${origin}`);
            return callback(new Error('Not allowed by CORS'), false);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    exposedHeaders: ['Set-Cookie'],
    optionsSuccessStatus: 200 // IE11対応
};

app.use(cors(corsOptions));

// セッション設定を本番環境対応に修正
app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'session',
        createTableIfMissing: true
    }),
    name: 'kakeibo.sid',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: true, // trueに変更してセッション生成を強制
    proxy: process.env.NODE_ENV === 'production',
    cookie: {
        httpOnly: false, // デバッグのためfalseに変更
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 1000 * 60 * 60 * 24, // 24時間
        domain: undefined // domainを明示的にundefinedに
    }
}));

// セッションデバッグミドルウェア
app.use((req, res, next) => {
    console.log('📝 Session Debug:', {
        sessionID: req.sessionID,
        hasUser: !!req.session?.user,
        userInfo: req.session?.user ? { id: req.session.user.id, email: req.session.user.email } : null,
        cookieHeader: req.headers.cookie,
        userAgent: req.headers['user-agent']
    });
    next();
});

app.use((req, res, next) => {
    const log = `${new Date().toISOString()} ${req.method} ${req.url}\n`;
    fs.appendFileSync(logPath, log);
    next();
});

const requireAuth = (req, res, next) => {
    console.log('🔍 Auth check - Session ID:', req.sessionID);
    console.log('🔍 Auth check - Session user:', req.session.user);
    console.log('🔍 Auth check - Session:', req.session);
    console.log('🔍 Auth check - Authorization header:', req.headers.authorization);
    
    // JWT認証を優先して試す
    const token = getTokenFromRequest(req);
    if (token) {
        const user = verifyToken(token);
        if (user) {
            console.log('✅ JWT Auth success - User:', user);
            req.user = user;
            return next();
        } else {
            console.log('❌ JWT token invalid');
        }
    }
    
    // フォールバックとしてセッション認証
    if (!req.session.user) {
        console.log('❌ Auth failed - No session user');
        return res.status(401).json({ error: 'ログインが必要です。' });
    }
    
    console.log('✅ Session Auth success - User:', req.session.user);
    req.user = req.session.user;
    next();
};

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

app.get('/api/kakeibo', requireAuth, async (req, res) => {
    try {
        // JWTとセッション両方に対応
        const userId = req.user?.id || req.session?.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'ユーザー認証が必要です。' });
        }
        
        const { rows } = await query(
            'SELECT * FROM kakeibo_data WHERE user_id = $1 ORDER BY date DESC',
            [userId]
        );
        res.json(rows);
    } catch (error) {
        console.error('Get kakeibo failed:', error);
        res.status(500).json({ error: '家計簿データの取得に失敗しました。' });
    }
});

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
        // JWTとセッション両方に対応
        const userId = req.user?.id || req.session?.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'ユーザー認証が必要です。' });
        }
        
        const { rows } = await query(
            'INSERT INTO kakeibo_data (title, category, amount, date, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [title, category, parsedAmount, date, userId]
        );
        res.json({ message: '追加しました！', id: rows[0].id });
    } catch (error) {
        console.error('Insert kakeibo failed:', error);
        res.status(500).json({ error: '家計簿データの追加に失敗しました。' });
    }
});

app.delete('/api/kakeibo/:id', requireAuth, async (req, res) => {
    const { id } = req.params;

    try {
        // JWTとセッション両方に対応
        const userId = req.user?.id || req.session?.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'ユーザー認証が必要です。' });
        }
        
        const result = await query(
            'DELETE FROM kakeibo_data WHERE id = $1 AND user_id = $2 RETURNING id',
            [id, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: '対象データが見つかりませんでした。' });
        }

        res.json({ message: '🗑️削除しました！' });
    } catch (error) {
        console.error('Delete kakeibo failed:', error);
        res.status(500).json({ error: '家計簿データの削除に失敗しました。' });
    }
});

app.get('/expenses', requireAuth, async (req, res) => {
    try {
        const { rows } = await query(
            'SELECT * FROM kakeibo_data WHERE user_id = $1 ORDER BY date DESC',
            [req.session.user.id]
        );
        res.json(rows);
    } catch (error) {
        console.error('Expenses query failed:', error);
        res.status(500).json({ error: '支出データの取得に失敗しました。' });
    }
});

app.get('/expenses/investment', requireAuth, async (req, res) => {
    try {
        const { rows } = await query(
            'SELECT * FROM kakeibo_data WHERE category = $1 AND user_id = $2 ORDER BY date DESC',
            ['investment', req.session.user.id]
        );
        res.json(rows);
    } catch (error) {
        console.error('Investment expenses query failed:', error);
        res.status(500).json({ error: '投資データの取得に失敗しました。' });
    }
});

// デフォルトの株価データエンドポイント（SPY）
app.get('/api/stock', async (req, res) => {
    const symbol = 'SPY'; // デフォルトでS&P500のETF
    
    try {
        console.log(`📊 Fetching stock data for ${symbol}...`);
        
        // キャッシュから取得を試行
        const { rows: cachedRows } = await query(
            `
            SELECT data, fetched_at
            FROM stock_cache
            WHERE symbol = $1
              AND fetched_at > NOW() - 24 * INTERVAL '1 hour'
            ORDER BY fetched_at DESC
            LIMIT 1
            `,
            [symbol]
        );

        if (cachedRows.length > 0) {
            const cachedEntry = cachedRows[0];
            let payload = typeof cachedEntry.data === 'string'
                ? JSON.parse(cachedEntry.data)
                : cachedEntry.data;

            // API制限エラーの場合はモックデータを返す
            if (payload && payload.Information && payload.Information.includes('rate limit')) {
                console.log(`⚠️ API rate limit detected, using mock data for ${symbol}`);
                payload = generateMockStockData(symbol);
            }

            console.log(`✅ Returning cached ${symbol} data`);
            return res.json({
                data: payload,
                symbol: symbol,
                cached: true,
                fetchedAt: cachedEntry.fetched_at
            });
        }

        // キャッシュにない場合は新規取得
        console.log(`🔄 Fetching fresh ${symbol} data from Alpha Vantage...`);
        const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
        const response = await fetch(url);
        const result = await response.json();

        // API制限チェック
        if (result['Information'] && result['Information'].includes('rate limit')) {
            console.log(`⚠️ Alpha Vantage API rate limit reached, using mock data for ${symbol}`);
            const mockData = generateMockStockData(symbol);
            
            // モックデータをキャッシュに保存
            await query(
                'INSERT INTO stock_cache (symbol, data, fetched_at) VALUES ($1, $2, NOW()) ON CONFLICT (symbol) DO UPDATE SET data = $2, fetched_at = NOW()',
                [symbol, JSON.stringify(mockData)]
            );
            
            return res.json({
                data: mockData,
                symbol: symbol,
                cached: false,
                mock: true,
                message: 'Using mock data (API rate limit reached)',
                fetchedAt: new Date()
            });
        }

        if (result['Error Message']) {
            throw new Error(`Alpha Vantage API error: ${result['Error Message']}`);
        }

        if (result['Note']) {
            throw new Error(`Alpha Vantage API limit: ${result['Note']}`);
        }

        if (!result['Time Series (Daily)']) {
            console.log(`⚠️ Invalid API response format, using mock data for ${symbol}`);
            const mockData = generateMockStockData(symbol);
            return res.json({
                data: mockData,
                symbol: symbol,
                cached: false,
                mock: true,
                message: 'Using mock data (invalid API response)',
                fetchedAt: new Date()
            });
        }

        // データをキャッシュに保存
        await query(
            'INSERT INTO stock_cache (symbol, data, fetched_at) VALUES ($1, $2, NOW()) ON CONFLICT (symbol) DO UPDATE SET data = $2, fetched_at = NOW()',
            [symbol, JSON.stringify(result)]
        );

        console.log(`✅ Fresh ${symbol} data fetched and cached`);
        res.json({
            data: result,
            symbol: symbol,
            cached: false,
            fetchedAt: new Date()
        });

    } catch (error) {
        console.error(`❌ Error fetching ${symbol} data:`, error);
        
        // エラーの場合もモックデータで対応
        console.log(`🔄 Falling back to mock data for ${symbol}`);
        const mockData = generateMockStockData(symbol);
        
        res.json({
            data: mockData,
            symbol: symbol,
            cached: false,
            mock: true,
            message: 'Using mock data (API limit reached)',
            fetchedAt: new Date()
        });
    }
});

// モックデータ生成関数
function generateMockStockData(symbol) {
    const today = new Date();
    const dailyTimeSeries = {};
    const monthlyTimeSeries = {};
    
    // 過去60ヶ月（5年分）のモックデータを生成 + 現在の月も含む
    for (let i = 0; i <= 60; i++) { // 0から開始して現在月も含む
        const date = new Date(today);
        date.setMonth(date.getMonth() - i);
        const monthStr = date.toISOString().substring(0, 7) + '-01'; // YYYY-MM-01 形式
        
        // SPYの実際の価格帯（約400-600ドル）でランダムに生成
        const basePrice = 500;
        const variation = (Math.random() - 0.5) * 50; // ±25ドルの変動
        const price = basePrice + variation;
        
        monthlyTimeSeries[monthStr] = {
            "1. open": (price * 0.995).toFixed(2),
            "2. high": (price * 1.01).toFixed(2),
            "3. low": (price * 0.99).toFixed(2),
            "4. close": price.toFixed(2),
            "5. volume": Math.floor(Math.random() * 500000000 + 100000000).toString()
        };
    }
    
    // 過去30日分のデイリーデータも生成
    for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const basePrice = 500;
        const variation = (Math.random() - 0.5) * 20; // ±10ドルの変動
        const price = basePrice + variation + (Math.random() - 0.5) * 5; // 日次変動
        
        dailyTimeSeries[dateStr] = {
            "1. open": (price * 0.999).toFixed(2),
            "2. high": (price * 1.005).toFixed(2),
            "3. low": (price * 0.995).toFixed(2),
            "4. close": price.toFixed(2),
            "5. volume": Math.floor(Math.random() * 50000000 + 10000000).toString()
        };
    }
    
    console.log(`📊 Generated mock data - Monthly keys:`, Object.keys(monthlyTimeSeries).slice(0, 5));
    
    return {
        "Meta Data": {
            "1. Information": "Daily Prices and Monthly Prices (Mock Data)",
            "2. Symbol": symbol,
            "3. Last Refreshed": today.toISOString().split('T')[0],
            "4. Output Size": "Compact",
            "5. Time Zone": "US/Eastern"
        },
        "Time Series (Daily)": dailyTimeSeries,
        "Monthly Time Series": monthlyTimeSeries
    };
}

app.get('/api/stock-cached/:symbol', async (req, res) => {
    const { symbol } = req.params;
    const CACHE_EXPIRY_HOURS = 24;

    try {
        const { rows: cachedRows } = await query(
            `
            SELECT data, fetched_at
            FROM stock_cache
            WHERE symbol = $1
              AND fetched_at > NOW() - $2 * INTERVAL '1 hour'
            ORDER BY fetched_at DESC
            LIMIT 1
            `,
            [symbol, CACHE_EXPIRY_HOURS]
        );

        const cachedEntry = cachedRows[0];

        if (cachedEntry) {
            const payload = typeof cachedEntry.data === 'string'
                ? JSON.parse(cachedEntry.data)
                : cachedEntry.data;

            return res.json({
                data: payload,
                cached: true,
                fetchedAt: cachedEntry.fetched_at
            });
        }

        const apiKey = process.env.ALPHA_VANTAGE_API_KEY || process.env.ALPHAVANTAGE_API_KEY;
        if (!apiKey) {
            throw new Error('Alpha Vantage API key not found in environment variables');
        }

        const apiUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_MONTHLY&symbol=${symbol}&apikey=${apiKey}`;
        const response = await fetch(apiUrl);
        const apiData = await response.json();

        if (apiData['Error Message'] || apiData['Note']) {
            throw new Error(apiData['Error Message'] || apiData['Note'] || 'API limit reached');
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

        return res.json({
            data: apiData,
            cached: false,
            realData: true
        });
    } catch (error) {
        console.error('Cache error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/register', async (req, res) => {
    const { email, password, name } = req.body || {};

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
        const { rows: existingUsers } = await query(
            'SELECT id FROM users WHERE email = $1',
            [normalizedEmail]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({ error: 'このメールアドレスは既に登録されています。' });
        }

        const passwordHash = await bcrypt.hash(normalizedPassword, SALT_ROUNDS);
        const { rows } = await query(
            'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name',
            [normalizedEmail, passwordHash, normalizedName]
        );

        const sessionUser = rows[0];
        req.session.user = sessionUser;

        return res.status(201).json({
            message: 'ユーザー登録が完了しました。',
            user: sessionUser
        });
    } catch (error) {
        console.error('Register failed:', error);
        return res.status(500).json({ error: '登録に失敗しました。' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body || {};

    if (!email || typeof email !== 'string' || email.trim() === '') {
        return res.status(400).json({ error: 'メールアドレスは必須です。' });
    }
    if (!password || typeof password !== 'string' || password.trim() === '') {
        return res.status(400).json({ error: 'パスワードは必須です。' });
    }

    const normalizedEmail = email.trim();
    const normalizedPassword = password.trim();

    try {
        const { rows } = await query(
            'SELECT id, email, name, password_hash FROM users WHERE email = $1',
            [normalizedEmail]
        );

        if (rows.length === 0) {
            return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません。' });
        }

        const user = rows[0];
        const match = await bcrypt.compare(normalizedPassword, user.password_hash);
        if (!match) {
            return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません。' });
        }

        const sessionUser = {
            id: user.id,
            email: user.email,
            name: user.name || null
        };

        req.session.user = sessionUser;

        // JWT トークン生成
        const token = generateToken(sessionUser);

        // デバッグ用ログ
        console.log('🔐 Login successful - Session ID:', req.sessionID);
        console.log('🔐 Session user set:', sessionUser);
        console.log('🔐 Session cookie options:', req.session.cookie);
        console.log('🔐 JWT token generated');

        return res.json({ 
            message: 'ログイン成功', 
            user: sessionUser,
            token: token  // トークンも返す
        });
    } catch (error) {
        console.error('Login failed:', error);
        return res.status(500).json({ error: 'ログインに失敗しました。' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Logout failed:', err);
            return res.status(500).json({ error: 'ログアウト失敗' });
        }
        res.clearCookie('kakeibo.sid', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
        });
        return res.json({ message: 'ログアウトしました。' });
    });
});

app.get('/api/auth/me', (req, res) => {
    console.log('👤 Auth check - Session ID:', req.sessionID);
    console.log('👤 Auth check - Session user:', req.session.user);
    console.log('👤 Auth check - Cookies received:', req.headers.cookie);
    console.log('👤 Auth check - Authorization header:', req.headers.authorization);
    
    // JWT認証を優先して試す
    const token = getTokenFromRequest(req);
    if (token) {
        const user = verifyToken(token);
        if (user) {
            console.log('✅ JWT auth successful:', user);
            return res.json({ user: user });
        } else {
            console.log('❌ JWT token invalid');
        }
    }
    
    // フォールバックとしてセッション認証
    if (!req.session.user) {
        console.log('❌ No session user found');
        return res.status(401).json({ error: 'ログインしていません。' });
    }
    
    console.log('✅ Session user found:', req.session.user);
    return res.json({ user: req.session.user });
});

// ヘルスチェックエンドポイント（Renderのため）
app.get('/', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Kakeibo Backend Server is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// ヘルスチェック用エンドポイント
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});
