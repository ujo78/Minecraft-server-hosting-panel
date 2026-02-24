const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const path = require('path');
require('dotenv').config();

// Polyfill global crypto for Azure SDKs in older Node/PM2 environments
if (!globalThis.crypto) {
    globalThis.crypto = require('crypto').webcrypto || require('crypto');
}

const VMManager = require('./vmManager');
const { createGameProxy } = require('./proxyMiddleware');
const InactivityTimer = require('./inactivityTimer');

// ─── Web VM Server ────────────────────────────────────────────
// Lightweight proxy that runs 24/7 on the Web VM.
// - Serves the React frontend
// - Handles authentication (Google OAuth)
// - Proxies API calls to Game VM
// - Manages Game VM lifecycle (start/stop via GCP)
// - Tracks dual inactivity (web + Minecraft players)
// ──────────────────────────────────────────────────────────────

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: true,
        credentials: true
    }
});

const PORT = process.env.PORT || 3000;
const IS_LOCAL = process.env.NODE_ENV !== 'production';

// ─── Initialize VM Manager ───────────────────────────────────

let vmManager;
if (IS_LOCAL) {
    console.log('🔧 Running in LOCAL mode — skipping Azure API calls');
    vmManager = VMManager.createLocal(process.env.GAME_AGENT_PORT || 4000);
} else {
    vmManager = new VMManager();
    vmManager.startPolling(30000); // Poll VM status every 30s
}

// ─── Initialize Inactivity Timer ──────────────────────────────

const inactivityTimer = new InactivityTimer(vmManager, {
    timeoutMinutes: parseInt(process.env.INACTIVITY_TIMEOUT_MINUTES) || 30,
    warningMinutes: parseInt(process.env.INACTIVITY_WARNING_MINUTES) || 5
});

inactivityTimer.on('warning', (data) => {
    console.log(`⚠️ Inactivity warning: ${data.message}`);
    io.emit('vmWarning', data);
});

inactivityTimer.on('shuttingDown', (data) => {
    console.log(`🛑 Inactivity shutdown: ${data.message}`);
    io.emit('vmStatus', { status: 'stopping', reason: 'inactivity', ...data });
});

inactivityTimer.on('shutdown', (result) => {
    console.log('Game VM shutdown complete:', result);
    io.emit('vmStatus', { status: 'stopped', reason: 'inactivity' });
    inactivityTimer.stop();
});

inactivityTimer.on('playerCountChanged', (data) => {
    io.emit('playerCount', data);
});

// ─── Middleware ────────────────────────────────────────────────

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

// Trust Nginx proxy (needed for correct HTTPS redirect in OAuth)
app.set('trust proxy', 1);

// Serve React frontend (production build)
app.use(express.static(path.join(__dirname, '../client/dist')));

// ─── Google OAuth ─────────────────────────────────────────────

const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.OAUTH_CALLBACK_URL || '/auth/google/callback',
        proxy: true
    }, (accessToken, refreshToken, profile, done) => {
        const email = profile.emails && profile.emails[0] ? profile.emails[0].value : '';
        done(null, { id: profile.id, email, name: profile.displayName, photo: profile.photos?.[0]?.value });
    }));

    passport.serializeUser((user, done) => done(null, user));
    passport.deserializeUser((user, done) => done(null, user));
} else {
    console.warn('⚠️ Google OAuth credentials missing from .env. Authentication routes will fail if accessed.');
}

// Simple auth middleware using cookies
function requireAuth(req, res, next) {
    const userCookie = req.cookies?.user;
    if (!userCookie) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
        req.user = JSON.parse(userCookie);
        next();
    } catch {
        return res.status(401).json({ error: 'Invalid auth cookie' });
    }
}

app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/', session: false }),
    (req, res) => {
        if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(req.user.email)) {
            return res.redirect('/?error=unauthorized');
        }
        res.cookie('user', JSON.stringify(req.user), {
            httpOnly: false,
            maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
            sameSite: 'lax'
        });
        res.redirect('/');
    }
);

app.get('/auth/user', (req, res) => {
    const userCookie = req.cookies?.user;
    if (!userCookie) return res.json({ user: null });
    try {
        res.json({ user: JSON.parse(userCookie) });
    } catch {
        res.json({ user: null });
    }
});

app.get('/auth/logout', (req, res) => {
    res.clearCookie('user');
    res.redirect('/');
});

// ─── VM Lifecycle API ─────────────────────────────────────────

app.get('/api/vm/status', requireAuth, async (req, res) => {
    try {
        const status = await vmManager.getVMStatus();
        const inactivity = inactivityTimer.getStatus();
        res.json({
            vmStatus: status,
            agentReady: vmManager.agentReady,
            gameAgentUrl: vmManager.gameAgentUrl,
            inactivity
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/vm/start', requireAuth, async (req, res) => {
    try {
        io.emit('vmStatus', { status: 'starting' });

        const result = await vmManager.ensureRunning();

        if (result.success) {
            io.emit('vmStatus', { status: 'running', agentReady: vmManager.agentReady });
            // Start inactivity timer once VM is up
            inactivityTimer.start();
        }

        res.json(result);
    } catch (err) {
        io.emit('vmStatus', { status: 'error', message: err.message });
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/vm/stop', requireAuth, async (req, res) => {
    try {
        io.emit('vmStatus', { status: 'stopping' });
        inactivityTimer.stop();

        const result = await vmManager.stopVM();

        io.emit('vmStatus', { status: 'stopped' });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Proxy All /api/* to Game VM ──────────────────────────────
// This MUST come after the local routes (/api/vm/*, /auth/*)

app.use(createGameProxy(vmManager, inactivityTimer));

// ─── Socket.IO (relay between frontend and Game VM) ───────────

const { io: ioClient } = require('socket.io-client');
let gameSocket = null;
let lastGameStatus = 'offline';

function connectToGameAgent() {
    if (!vmManager.agentReady || !vmManager.gameAgentUrl) {
        return;
    }

    if (gameSocket && gameSocket.connected) {
        return; // Already connected
    }

    const url = vmManager.gameAgentUrl;
    console.log(`🔌 Connecting Socket.IO relay to Game Agent at ${url}`);

    gameSocket = ioClient(url, {
        reconnection: true,
        reconnectionDelay: 3000,
        reconnectionAttempts: 10
    });

    // Relay events from Game VM to all browser clients
    const relayEvents = ['console', 'status', 'players', 'metrics', 'serverStatus'];

    relayEvents.forEach(event => {
        gameSocket.on(event, (data) => {
            // Cache the last known status
            if (event === 'status') {
                lastGameStatus = data;
            }

            io.emit(event, data);

            // Player join/leave resets the inactivity timer
            if (event === 'players' && data && data.length > 0) {
                inactivityTimer.recordPlayerActivity();
            }
        });
    });

    gameSocket.on('connect', () => {
        console.log('🔌 Socket.IO relay connected to Game Agent');
        // Ask for status immediately upon connection
        // (The game agent sends it automatically on connect, but this is safe)
    });

    gameSocket.on('disconnect', (reason) => {
        console.log(`🔌 Socket.IO relay disconnected: ${reason}`);
        lastGameStatus = 'offline'; // Reset when agent disconnects
        io.emit('status', 'offline');
    });
}

// Reconnect when VM status changes
setInterval(() => {
    if (vmManager.agentReady && (!gameSocket || !gameSocket.connected)) {
        connectToGameAgent();
    }
}, 5000);

// Handle frontend Socket.IO connections
io.on('connection', (socket) => {
    console.log('👤 Browser client connected');

    // Record web activity
    inactivityTimer.recordWebActivity();

    // Send current VM status
    socket.emit('vmStatus', {
        status: vmManager.status,
        agentReady: vmManager.agentReady
    });

    // Send last known Game Server status immediately
    socket.emit('status', lastGameStatus);

    // Relay commands from browser → Game VM
    socket.on('command', (cmd) => {
        if (gameSocket && gameSocket.connected) {
            gameSocket.emit('command', cmd);
        }
        inactivityTimer.recordWebActivity();
    });

    // Any socket event = web activity
    socket.onAny(() => {
        inactivityTimer.recordWebActivity();
    });

    socket.on('disconnect', () => {
        console.log('👤 Browser client disconnected');
    });
});

// ─── SPA Fallback ─────────────────────────────────────────────

app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// ─── Start Server ─────────────────────────────────────────────

server.listen(PORT, () => {
    console.log(`\n🌐 Web VM running on port ${PORT}`);
    console.log(`   Mode: ${IS_LOCAL ? 'LOCAL (Game Agent on localhost)' : 'PRODUCTION (Azure)'}`);
    console.log(`   Game VM status: ${vmManager.status}`);
    if (vmManager.gameAgentUrl) {
        console.log(`   Game Agent URL: ${vmManager.gameAgentUrl}`);
    }
    console.log('');

    // In production, do initial VM status check
    if (!IS_LOCAL) {
        vmManager.getVMStatus().then(status => {
            console.log(`Initial Game VM status: ${status}`);
            if (status === 'running') {
                inactivityTimer.start();
                connectToGameAgent();
            }
        });
    } else {
        // In local mode, connect immediately
        inactivityTimer.start();
        connectToGameAgent();
    }
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use.`);
    } else {
        console.error(err);
    }
});
