const EventEmitter = require('events');

// ─── Inactivity Timer ─────────────────────────────────────────
// Tracks DUAL inactivity — VM shuts down only when both:
//   1. Web panel is idle (no API calls / Socket.IO from browser)
//   2. Minecraft server is idle (no players online)
// Timer resets on any web activity OR player join.
// ──────────────────────────────────────────────────────────────

class InactivityTimer extends EventEmitter {
    constructor(vmManager, options = {}) {
        super();
        this.vmManager = vmManager;

        // Config
        this.timeoutMs = (options.timeoutMinutes || 30) * 60 * 1000;   // default 30 min
        this.warningMs = (options.warningMinutes || 5) * 60 * 1000;    // warn 5 min before
        this.playerPollIntervalMs = options.playerPollInterval || 60000; // check players every 60s

        // State
        this.lastWebActivity = Date.now();
        this.lastPlayerActivity = Date.now();
        this.lastPlayerCount = 0;
        this._timer = null;
        this._warningTimer = null;
        this._playerPoller = null;
        this._isRunning = false;
        this._warningEmitted = false;
    }

    // ─── Start / Stop ─────────────────────────────────────────

    start() {
        if (this._isRunning) return;
        this._isRunning = true;

        this.lastWebActivity = Date.now();
        this.lastPlayerActivity = Date.now();
        this._warningEmitted = false;

        // Check inactivity every 30 seconds
        this._timer = setInterval(() => this._checkInactivity(), 30000);

        // Poll Game Agent for player count
        this._playerPoller = setInterval(() => this._pollPlayerCount(), this.playerPollIntervalMs);

        console.log(`⏱️ Inactivity timer started (${this.timeoutMs / 60000} min timeout)`);
    }

    stop() {
        if (!this._isRunning) return;
        this._isRunning = false;

        if (this._timer) { clearInterval(this._timer); this._timer = null; }
        if (this._warningTimer) { clearTimeout(this._warningTimer); this._warningTimer = null; }
        if (this._playerPoller) { clearInterval(this._playerPoller); this._playerPoller = null; }

        console.log('⏱️ Inactivity timer stopped');
    }

    // ─── Activity Recording ───────────────────────────────────

    recordWebActivity() {
        this.lastWebActivity = Date.now();
        this._warningEmitted = false;
    }

    recordPlayerActivity() {
        this.lastPlayerActivity = Date.now();
        this._warningEmitted = false;
    }

    // ─── Inactivity Check ─────────────────────────────────────

    _checkInactivity() {
        if (!this._isRunning) return;

        // Don't shut down if VM isn't running
        if (this.vmManager.status !== 'running') return;

        const now = Date.now();
        const webIdleTime = now - this.lastWebActivity;
        const playerIdleTime = now - this.lastPlayerActivity;

        // BOTH must be idle for the timeout period
        const bothIdle = webIdleTime >= this.timeoutMs && playerIdleTime >= this.timeoutMs;
        const timeUntilShutdown = this.timeoutMs - Math.min(webIdleTime, playerIdleTime);

        // Emit warning if approaching timeout
        if (timeUntilShutdown > 0 && timeUntilShutdown <= this.warningMs && !this._warningEmitted) {
            this._warningEmitted = true;
            const minutesLeft = Math.ceil(timeUntilShutdown / 60000);
            this.emit('warning', {
                minutesLeft,
                message: `Game VM will shut down in ~${minutesLeft} minutes due to inactivity`,
                webIdleMinutes: Math.floor(webIdleTime / 60000),
                playerIdleMinutes: Math.floor(playerIdleTime / 60000)
            });
        }

        // Shutdown if both are idle
        if (bothIdle) {
            console.log(`⏱️ Inactivity timeout reached — web idle ${Math.floor(webIdleTime / 60000)}m, players idle ${Math.floor(playerIdleTime / 60000)}m`);
            this._triggerShutdown();
        }
    }

    // ─── Poll Player Count from Game Agent ────────────────────

    async _pollPlayerCount() {
        if (!this._isRunning) return;
        if (!this.vmManager.agentReady || !this.vmManager.gameAgentUrl) return;

        try {
            const response = await fetch(`${this.vmManager.gameAgentUrl}/api/player-count`, {
                signal: AbortSignal.timeout(5000)
            });

            if (response.ok) {
                const data = await response.json();
                const count = data.count || 0;

                if (count > 0) {
                    // Players are online — reset player activity
                    this.recordPlayerActivity();
                }

                // If player count changed, emit update
                if (count !== this.lastPlayerCount) {
                    this.emit('playerCountChanged', { count, previous: this.lastPlayerCount });
                }

                this.lastPlayerCount = count;
            }
        } catch (err) {
            // Agent unreachable — don't reset timer
        }
    }

    // ─── Trigger Shutdown ─────────────────────────────────────

    async _triggerShutdown() {
        this.stop(); // Stop the timer to prevent re-triggering

        this.emit('shuttingDown', {
            message: 'Game VM shutting down due to inactivity',
            webIdleMinutes: Math.floor((Date.now() - this.lastWebActivity) / 60000),
            playerIdleMinutes: Math.floor((Date.now() - this.lastPlayerActivity) / 60000)
        });

        try {
            const result = await this.vmManager.stopVM();
            this.emit('shutdown', result);
        } catch (err) {
            console.error('Inactivity shutdown failed:', err);
            this.emit('shutdownError', err);
            // Restart the timer to try again later
            this.start();
        }
    }

    // ─── Status ───────────────────────────────────────────────

    getStatus() {
        const now = Date.now();
        return {
            running: this._isRunning,
            timeoutMinutes: this.timeoutMs / 60000,
            webIdleMinutes: Math.floor((now - this.lastWebActivity) / 60000),
            playerIdleMinutes: Math.floor((now - this.lastPlayerActivity) / 60000),
            lastPlayerCount: this.lastPlayerCount,
            timeUntilShutdownMinutes: this._isRunning
                ? Math.max(0, Math.ceil(
                    (this.timeoutMs - Math.max(now - this.lastWebActivity, now - this.lastPlayerActivity)) / 60000
                ))
                : null
        };
    }
}

module.exports = InactivityTimer;
