const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    // 1. Check for token in cookies first (preferred for web)
    let token = req.cookies?.token;

    // 2. Fallback to Authorization header (Bearer token)
    if (!token && req.headers['authorization']) {
        const authHeader = req.headers['authorization'];
        if (authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7, authHeader.length);
        }
    }

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.SESSION_SECRET || 'dev-secret-key');
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token.' });
    }
};

module.exports = verifyToken;
