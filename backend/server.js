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
    saveUninitialized: false,
    proxy: process.env.NODE_ENV === 'production', // 本番環境でのみproxy: true
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 1000 * 60 * 60 * 24, // 24時間
        domain: process.env.NODE_ENV === 'production' ? undefined : undefined
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
    
    if (!req.session.user) {
        console.log('❌ Auth failed - No session user');
        return res.status(401).json({ error: 'ログインが必要です。' });
    }
    
    console.log('✅ Auth success - User:', req.session.user);
    next();
};

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

app.get('/api/kakeibo', requireAuth, async (req, res) => {
    try {
        const { rows } = await query(
            'SELECT * FROM kakeibo_data WHERE user_id = $1 ORDER BY date DESC',
            [req.session.user.id]
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
        const { rows } = await query(
            'INSERT INTO kakeibo_data (title, category, amount, date, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [title, category, parsedAmount, date, req.session.user.id]
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
        const result = await query(
            'DELETE FROM kakeibo_data WHERE id = $1 AND user_id = $2 RETURNING id',
            [id, req.session.user.id]
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

        // デバッグ用ログ
        console.log('🔐 Login successful - Session ID:', req.sessionID);
        console.log('🔐 Session user set:', sessionUser);
        console.log('🔐 Session cookie options:', req.session.cookie);

        return res.json({ message: 'ログイン成功', user: sessionUser });
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
