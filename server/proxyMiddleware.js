const { createProxyMiddleware } = require('http-proxy-middleware');

// ─── Proxy Middleware ─────────────────────────────────────────
// Forwards all /api/* requests from the Web VM to the Game Agent.
// Before proxying, checks if the Game VM is up and auto-starts it.
// ──────────────────────────────────────────────────────────────

function createGameProxy(vmManager, inactivityTimer) {

    // Routes that the Web VM handles directly (don't proxy these)
    const localRoutes = [
        '/api/vm/',           // VM lifecycle endpoints
        '/auth/',             // Authentication
        '/api/auth',          // Auth endpoints
    ];

    function isLocalRoute(path) {
        return localRoutes.some(route => path.startsWith(route));
    }

    // Dynamic proxy — target changes based on VM IP
    const proxy = createProxyMiddleware({
        target: 'http://127.0.0.1:4000', // Default / fallback
        changeOrigin: true,
        ws: false, // We handle Socket.IO separately
        router: () => {
            const url = vmManager.gameAgentUrl;
            return url || 'http://127.0.0.1:4000';
        },
        on: {
            proxyReq: (proxyReq, req, res) => {
                // Reset inactivity timer on every proxied request
                if (inactivityTimer) {
                    inactivityTimer.recordWebActivity();
                }
            },
            proxyRes: (proxyRes, req, res) => {
                // Add header so frontend knows this was proxied
                proxyRes.headers['x-proxied-via'] = 'web-vm';
            },
            error: (err, req, res) => {
                console.error('Proxy error:', err.message);
                if (!res.headersSent) {
                    res.status(502).json({
                        error: 'Game VM is not reachable',
                        vmStatus: vmManager.status,
                        agentReady: vmManager.agentReady
                    });
                }
            }
        }
    });

    // Middleware that wraps the proxy with VM readiness checks
    return async function gameProxyMiddleware(req, res, next) {
        // Skip local routes
        if (isLocalRoute(req.path)) {
            return next();
        }

        // Only proxy /api/* routes
        if (!req.path.startsWith('/api/')) {
            return next();
        }

        // Check if Game VM is ready
        if (!vmManager.agentReady) {
            // Try to start the VM automatically
            if (vmManager.status === 'stopped' || vmManager.status === 'unknown') {
                // Respond immediately with status so frontend can show "Starting VM..."
                return res.status(503).json({
                    error: 'Game VM is starting up',
                    vmStatus: 'starting',
                    message: 'The Game VM is being started. Please wait...',
                    retryAfterMs: 5000
                });
            }

            if (vmManager.status === 'starting') {
                return res.status(503).json({
                    error: 'Game VM is still booting',
                    vmStatus: 'starting',
                    message: 'Game VM is starting up, please wait...',
                    retryAfterMs: 5000
                });
            }

            if (vmManager.status === 'stopping') {
                return res.status(503).json({
                    error: 'Game VM is shutting down',
                    vmStatus: 'stopping',
                    message: 'Game VM is shutting down, please try again in a moment.',
                    retryAfterMs: 10000
                });
            }

            // VM is running but agent isn't ready
            return res.status(503).json({
                error: 'Game Agent is not ready',
                vmStatus: vmManager.status,
                message: 'Game VM is running but the agent is not responding yet.',
                retryAfterMs: 3000
            });
        }

        // Game VM is ready — proxy the request
        proxy(req, res, next);
    };
}

module.exports = { createGameProxy };
