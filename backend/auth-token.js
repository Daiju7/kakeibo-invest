// JWT トークンベース認証への移行
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-jwt-secret-for-development';

// JWTトークン生成
function generateToken(user) {
    return jwt.sign(
        { 
            id: user.id, 
            email: user.email, 
            name: user.name 
        }, 
        JWT_SECRET, 
        { expiresIn: '24h' }
    );
}

// JWTトークン検証
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

// Authorization headerからトークン取得
function getTokenFromRequest(req) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }
    return null;
}

// 認証ミドルウェア（JWT版）
function requireAuthJWT(req, res, next) {
    const token = getTokenFromRequest(req);
    
    if (!token) {
        return res.status(401).json({ error: 'ログインが必要です。' });
    }
    
    const user = verifyToken(token);
    if (!user) {
        return res.status(401).json({ error: 'トークンが無効です。' });
    }
    
    req.user = user;
    next();
}

module.exports = {
    generateToken,
    verifyToken,
    getTokenFromRequest,
    requireAuthJWT
};