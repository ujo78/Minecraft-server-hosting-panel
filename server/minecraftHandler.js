const { spawn } = require('child_process');
const EventEmitter = require('events');
const path = require('path');

class MinecraftHandler extends EventEmitter {
    constructor(serverJarPath, serverDir, options = {}) {
        super();
        this.serverJarPath = serverJarPath;
        this.serverDir = serverDir;
        this.memory = options.memory || 1024; // Configurable memory in MB
        this.port = options.port || 25565;     // For logging/tracking
        this.process = null;
        this.status = 'offline';
        this.players = new Map();
    }

    start() {
        if (this.status !== 'offline') return;

        console.log('Starting Minecraft Server...');
        this.status = 'starting';
        this.emit('status', this.status);

        const isScript = this.serverJarPath.endsWith('.sh') || this.serverJarPath.endsWith('.bat');

        let cmd, args;

        if (isScript) {
            const scriptName = path.basename(this.serverJarPath);
            cmd = 'bash';
            args = [scriptName];
        } else {
            cmd = 'java';
            args = [
                `-Xmx${this.memory}M`,  // Dynamic max memory
                `-Xms${this.memory}M`,  // Dynamic min memory
                '-jar',
                this.serverJarPath,
                'nogui'
            ];
        }

        this.process = spawn(cmd, args, {
            cwd: this.serverDir,
            shell: false
        });

        this.process.stdout.on('data', (data) => {
            const line = data.toString();
            this.emit('console', line);

            if (line.includes('Done') && line.includes('! For help, type "help"')) {
                this.status = 'online';
                this.emit('status', this.status);
            }

            this.parsePlayerEvents(line);
        });

        this.process.stderr.on('data', (data) => {
            this.emit('console', data.toString());
        });

        this.process.on('close', (code) => {
            console.log(`Minecraft server process exited with code ${code}`);

            // Detect crashes vs normal shutdown
            if (code !== 0 && this.status !== 'stopping') {
                this.status = 'crashed';
                this.emit('console', `[ERROR] Server crashed with exit code ${code}\n`);
            } else {
                this.status = 'offline';
            }

            this.process = null;
            this.emit('status', this.status);
            this.emit('console', `Server process exited with code ${code}\n`);
        });
    }

    stop() {
        if (this.status === 'offline' || !this.process) return;

        this.status = 'stopping';
        this.emit('status', this.status);
        this.command('stop');
    }

    command(cmd) {
        if (this.process) {
            this.process.stdin.write(cmd + '\n');
        }
    }

    sendCommand(cmd) {
        this.command(cmd);
    }

    getStatus() {
        return this.status;
    }

    parsePlayerEvents(line) {
        const joinMatch = line.match(/(\w+)\[.*?\] logged in/i) ||
            line.match(/(\w+) joined the game/i);
        if (joinMatch) {
            const username = joinMatch[1];
            this.players.set(username, {
                username,
                joinedAt: new Date().toISOString(),
            });
            this.emit('players', Array.from(this.players.values()));
            return;
        }

        const leaveMatch = line.match(/(\w+) left the game/i) ||
            line.match(/(\w+) lost connection/i);
        if (leaveMatch) {
            const username = leaveMatch[1];
            this.players.delete(username);
            this.emit('players', Array.from(this.players.values()));
            return;
        }
    }

    getPlayers() {
        return Array.from(this.players.values());
    }

    getPlayerData(username) {
        return this.players.get(username) || null;
    }
}

module.exports = MinecraftHandler;
