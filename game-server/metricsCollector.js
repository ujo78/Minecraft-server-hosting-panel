const si = require('systeminformation');
const EventEmitter = require('events');

class MetricsCollector extends EventEmitter {
    constructor(minecraftHandler) {
        super();
        this.mc = minecraftHandler;
        this.metrics = {
            tps: [],
            cpu: [],
            memory: [],
            players: [],
            timestamps: []
        };
        this.maxDataPoints = 300; // Keep last 5 minutes (1 per second)
        this.isCollecting = false;
        this.collectionInterval = null;
        this.currentTPS = 20.0;
    }

    /**
     * Start collecting metrics
     */
    startCollecting() {
        if (this.isCollecting) return;

        this.isCollecting = true;

        // Collect metrics every second
        this.collectionInterval = setInterval(async () => {
            await this.collectMetrics();
        }, 1000);

        // Listen for TPS updates from console
        if (this.mc) {
            this.mc.on('console', (data) => {
                this.parseTPS(data);
            });
        }

        console.log('📊 Metrics collection started');
    }

    /**
     * Stop collecting metrics
     */
    stopCollecting() {
        if (!this.isCollecting) return;

        this.isCollecting = false;

        if (this.collectionInterval) {
            clearInterval(this.collectionInterval);
            this.collectionInterval = null;
        }

        console.log('📊 Metrics collection stopped');
    }

    /**
     * Collect current metrics
     */
    async collectMetrics() {
        try {
            const timestamp = Date.now();

            // Get CPU usage
            const cpu = await si.currentLoad();
            const cpuPercent = Math.round(cpu.currentLoad);

            // Get memory usage
            const mem = await si.mem();
            const memPercent = Math.round((mem.used / mem.total) * 100);
            const memUsedGB = (mem.used / (1024 * 1024 * 1024)).toFixed(2);
            const memTotalGB = (mem.total / (1024 * 1024 * 1024)).toFixed(2);

            // Get player count from Minecraft handler
            const playerCount = this.mc && this.mc.players ? this.mc.players.size : 0;

            // Store metrics
            this.metrics.timestamps.push(timestamp);
            this.metrics.tps.push(this.currentTPS);
            this.metrics.cpu.push(cpuPercent);
            this.metrics.memory.push({
                percent: memPercent,
                used: memUsedGB,
                total: memTotalGB
            });
            this.metrics.players.push(playerCount);

            // Trim old data
            if (this.metrics.timestamps.length > this.maxDataPoints) {
                this.metrics.timestamps.shift();
                this.metrics.tps.shift();
                this.metrics.cpu.shift();
                this.metrics.memory.shift();
                this.metrics.players.shift();
            }

            // Emit metrics update event
            this.emit('metricsUpdate', {
                tps: this.currentTPS,
                cpu: cpuPercent,
                memory: { percent: memPercent, used: memUsedGB, total: memTotalGB },
                players: playerCount,
                timestamp
            });

        } catch (err) {
            console.error('Failed to collect metrics:', err);
        }
    }

    /**
     * Parse TPS from console output
     * Looks for patterns like "Current TPS: 19.95" or similar
     */
    parseTPS(consoleOutput) {
        // Common TPS patterns in console output
        const tpsPatterns = [
            /TPS:\s*(\d+\.?\d*)/i,
            /ticks per second:\s*(\d+\.?\d*)/i,
            /(\d+\.?\d*)\s*TPS/i
        ];

        for (const pattern of tpsPatterns) {
            const match = consoleOutput.match(pattern);
            if (match) {
                const tps = parseFloat(match[1]);
                if (!isNaN(tps) && tps <= 20) {
                    this.currentTPS = Math.round(tps * 100) / 100;
                    return;
                }
            }
        }

        // If server is offline, TPS is 0
        if (this.mc && this.mc.getStatus() === 'offline') {
            this.currentTPS = 0;
        }
    }

    /**
     * Get recent metrics
     * @param {number} minutes - Number of minutes of data
     */
    getRecentMetrics(minutes = 5) {
        const cutoffTime = Date.now() - (minutes * 60 * 1000);
        const startIndex = this.metrics.timestamps.findIndex(ts => ts >= cutoffTime);

        if (startIndex === -1) {
            return {
                timestamps: [],
                tps: [],
                cpu: [],
                memory: [],
                players: []
            };
        }

        return {
            timestamps: this.metrics.timestamps.slice(startIndex),
            tps: this.metrics.tps.slice(startIndex),
            cpu: this.metrics.cpu.slice(startIndex),
            memory: this.metrics.memory.slice(startIndex),
            players: this.metrics.players.slice(startIndex)
        };
    }

    /**
     * Get current metrics snapshot
     */
    getCurrentMetrics() {
        const len = this.metrics.timestamps.length;
        if (len === 0) {
            return {
                tps: 0,
                cpu: 0,
                memory: { percent: 0, used: 0, total: 0 },
                players: 0,
                timestamp: Date.now()
            };
        }

        return {
            tps: this.metrics.tps[len - 1],
            cpu: this.metrics.cpu[len - 1],
            memory: this.metrics.memory[len - 1],
            players: this.metrics.players[len - 1],
            timestamp: this.metrics.timestamps[len - 1]
        };
    }

    /**
     * Get average values
     * @param {number} minutes - Number of minutes to average
     */
    getAverages(minutes = 5) {
        const recent = this.getRecentMetrics(minutes);

        if (recent.timestamps.length === 0) {
            return {
                avgTPS: 0,
                avgCPU: 0,
                avgMemory: 0,
                avgPlayers: 0
            };
        }

        const sum = (arr) => arr.reduce((a, b) => a + b, 0);
        const avg = (arr) => arr.length > 0 ? sum(arr) / arr.length : 0;

        return {
            avgTPS: Math.round(avg(recent.tps) * 100) / 100,
            avgCPU: Math.round(avg(recent.cpu)),
            avgMemory: Math.round(avg(recent.memory.map(m => m.percent))),
            avgPlayers: Math.round(avg(recent.players))
        };
    }

    /**
     * Detect performance issues
     */
    getPerformanceAlerts() {
        const current = this.getCurrentMetrics();
        const alerts = [];

        // Low TPS
        if (current.tps < 18 && current.tps > 0) {
            alerts.push({
                severity: current.tps < 15 ? 'critical' : 'warning',
                message: `Low TPS: ${current.tps} (target: 20)`,
                type: 'tps'
            });
        }

        // High CPU
        if (current.cpu > 80) {
            alerts.push({
                severity: current.cpu > 95 ? 'critical' : 'warning',
                message: `High CPU usage: ${current.cpu}%`,
                type: 'cpu'
            });
        }

        // High Memory
        if (current.memory.percent > 85) {
            alerts.push({
                severity: current.memory.percent > 95 ? 'critical' : 'warning',
                message: `High memory usage: ${current.memory.percent}%`,
                type: 'memory'
            });
        }

        return alerts;
    }

    /**
     * Clear all metrics
     */
    clearMetrics() {
        this.metrics = {
            tps: [],
            cpu: [],
            memory: [],
            players: [],
            timestamps: []
        };
    }
}

module.exports = MetricsCollector;
