const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class ServerManager {
    constructor(configPath) {
        this.configPath = configPath;
        this.config = this.loadConfig();
        this.availableServersDir = path.resolve(__dirname, '../available-servers');
    }

    loadConfig() {
        if (!fs.existsSync(this.configPath)) {
            return { active: null, servers: [] };
        }
        return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
    }

    saveConfig() {
        fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 4));
    }

    getServers() {
        return this.config.servers;
    }

    getActiveServer() {
        if (!this.config.active) return null;
        return this.config.servers.find(s => s.id === this.config.active);
    }

    getServer(id) {
        return this.config.servers.find(s => s.id === id);
    }

    setActiveServer(id) {
        if (this.getServer(id)) {
            this.config.active = id;
            this.saveConfig();
            return true;
        }
        return false;
    }

    addServer(serverData) {
        // serverData: { id, name, path, jar, icon }
        if (this.getServer(serverData.id)) {
            return false;
        }
        this.config.servers.push(serverData);
        // If it's the first server, make it active
        if (!this.config.active) {
            this.config.active = serverData.id;
        }
        this.saveConfig();
        return true;
    }

    deleteServer(id) {
        const index = this.config.servers.findIndex(s => s.id === id);
        if (index !== -1) {
            this.config.servers.splice(index, 1);
            if (this.config.active === id) {
                this.config.active = this.config.servers.length > 0 ? this.config.servers[0].id : null;
            }
            this.saveConfig();
            return true;
        }
        return false;
    }

    getInstallableServers() {
        if (!fs.existsSync(this.availableServersDir)) {
            return [];
        }

        const entries = fs.readdirSync(this.availableServersDir, { withFileTypes: true });
        const templates = [];

        for (const entry of entries) {
            if (entry.isDirectory()) {
                const templateId = entry.name;
                const templatePath = path.join(this.availableServersDir, templateId);
                const metadataPath = path.join(templatePath, 'metadata.json');

                let metadata = {
                    id: templateId,
                    name: templateId,
                    description: 'No description provided',
                    icon: null
                };

                if (fs.existsSync(metadataPath)) {
                    try {
                        const parsed = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
                        metadata = { ...metadata, ...parsed, id: templateId };
                    } catch (e) {
                        console.error(`Failed to parse metadata for ${templateId}`, e);
                    }
                }

                templates.push(metadata);
            }
        }
        return templates;
    }

    async installServer(id, name, templateId) {
        if (this.getServer(id)) throw new Error("Server ID already exists");

        const templatePath = path.join(this.availableServersDir, templateId);
        if (!fs.existsSync(templatePath)) {
            throw new Error(`Template '${templateId}' not found in available-servers`);
        }

        const serversDir = path.resolve(__dirname, '..');
        const serverDir = path.join(serversDir, id);

        if (fs.existsSync(serverDir)) {
            throw new Error(`Target directory '${serverDir}' already exists. Please verify.`);
        }

        try {
            console.log(`Installing '${name}' from template '${templateId}'...`);

            // 1. Copy files
            // Check if node version supports fs.cpSync (Node 16.7+). If not, we might need a meaningful error or polyfill.
            // Assuming modern environment as per instructions.
            fs.cpSync(templatePath, serverDir, { recursive: true });
            console.log(`Copied files to ${serverDir}`);

            // Remove metadata.json from instance
            const metaFile = path.join(serverDir, 'metadata.json');
            if (fs.existsSync(metaFile)) fs.unlinkSync(metaFile);

            // 2. Scan for jar
            const files = fs.readdirSync(serverDir);
            let jarName = 'server.jar';

            const startupPatterns = [
                'run.sh', 'start.sh', 'startserver.sh', 'ServerStart.sh',
                'start-server.sh', 'run-server.sh', 'launch.sh',
                'run.bat', 'start.bat',
                'server.jar', 'forge.jar', 'paper.jar', 'spigot.jar'
            ];

            let foundStartup = false;
            for (const pattern of startupPatterns) {
                if (files.includes(pattern)) {
                    jarName = pattern;
                    foundStartup = true;
                    break;
                }
            }
            if (!foundStartup) {
                const jar = files.find(f => f.endsWith('.jar'));
                if (jar) jarName = jar;
            }

            // 3. Handle install.sh
            if (files.includes('install.sh')) {
                console.log('Found install.sh, executing...');
                const installScript = path.join(serverDir, 'install.sh');

                fs.chmodSync(installScript, '755');

                await new Promise((resolve, reject) => {
                    // Windows handling for .sh?
                    // If on windows, we might need bash or just try spawning.
                    // User OS is windows. but install.sh implies unix tools (git bash/wsl).
                    // If windows, we should prefer .bat or maybe simple spawn.
                    // The prompt said "Operating System: windows".
                    // However, user prompt said "If an install.sh exists, execute it safely"
                    // If the user is on windows, usually `bash` is invalid unless they have WSL/Git Bash in path.
                    // I will try `bash` first, but catch error.
                    // Or maybe check platform.

                    const cmd = process.platform === 'win32' ? 'bash' : './install.sh';
                    const args = process.platform === 'win32' ? ['install.sh'] : [];

                    const child = spawn('bash', ['install.sh'], {
                        cwd: serverDir,
                        stdio: 'inherit',
                        shell: true
                    });

                    child.on('close', (code) => {
                        if (code === 0) resolve();
                        else reject(new Error(`install.sh failed with code ${code}`));
                    });
                    child.on('error', (err) => reject(err));
                });
            }

            // 4. EULA
            fs.writeFileSync(path.join(serverDir, 'eula.txt'), 'eula=true');

            // 5. Ensure permissions
            if (jarName.endsWith('.sh')) {
                const diffPath = path.join(serverDir, jarName);
                if (fs.existsSync(diffPath)) fs.chmodSync(diffPath, '755');
            }

            // Get icon from metadata for the config
            let iconUrl = null;
            const originalMeta = path.join(templatePath, 'metadata.json');
            if (fs.existsSync(originalMeta)) {
                try {
                    const meta = JSON.parse(fs.readFileSync(originalMeta, 'utf8'));
                    iconUrl = meta.icon;
                } catch (e) { }
            }

            this.addServer({
                id,
                name,
                path: `../${id}`,
                jar: jarName,
                icon: iconUrl
            });

            return true;

        } catch (err) {
            console.error("Install failed:", err);
            try {
                if (fs.existsSync(serverDir) && serverDir.includes(id)) {
                    console.log(`Cleaning up: ${serverDir}`);
                    fs.rmSync(serverDir, { recursive: true, force: true });
                }
            } catch (cleanupErr) {
                console.error('Cleanup failed:', cleanupErr);
            }
            throw err;
        }
    }
}

module.exports = ServerManager;
