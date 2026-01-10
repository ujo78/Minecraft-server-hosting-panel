const { spawn } = require('child_process');
const EventEmitter = require('events');
const path = require('path');

class MinecraftHandler extends EventEmitter {
    constructor(serverJarPath, serverDir) {
        super();
        this.serverJarPath = serverJarPath;
        this.serverDir = serverDir;
        this.process = null;
        this.status = 'offline';
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
            args = ['-Xmx1024M', '-Xms1024M', '-jar', this.serverJarPath, 'nogui'];
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
        });

        this.process.stderr.on('data', (data) => {
            this.emit('console', data.toString());
        });

        this.process.on('close', (code) => {
            console.log(`Minecraft server process exited with code ${code}`);
            this.status = 'offline';
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

    getStatus() {
        return this.status;
    }
}

module.exports = MinecraftHandler;
