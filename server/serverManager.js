const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');

// Helper to unzip file (requires 'unzip' on Linux or PowerShell on Windows, but let's use a simple JS unzipper or system command)
// For Azure VM (Linux), 'unzip' command is best.
const unzipFile = (zipPath, destPath) => {
    return new Promise((resolve, reject) => {
        const unzip = spawn('unzip', ['-o', zipPath, '-d', destPath]);
        unzip.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Unzip process exited with code ${code}`));
        });
        unzip.on('error', reject);
    });
};

const downloadFile = (url, destPath) => {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        https.get(url, function (response) {
            response.pipe(file);
            file.on('finish', function () {
                file.close(resolve);
            });
        }).on('error', function (err) {
            fs.unlink(destPath, () => { }); // Delete the file async. (But we don't check result)
            reject(err);
        });
    });
};

class ServerManager {
    constructor(configPath) {
        this.configPath = configPath;
        this.config = this.loadConfig();
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

    async installServer(id, name, downloadUrl, iconUrl) {
        // check if exists
        if (this.getServer(id)) throw new Error("Server ID already exists");

        const serversDir = path.join(__dirname, '..'); // Parent of server/
        const serverDir = path.join(serversDir, id);

        if (!fs.existsSync(serverDir)) {
            fs.mkdirSync(serverDir, { recursive: true });
        }

        const zipPath = path.join(serverDir, 'server_pack.zip');

        try {
            console.log(`Downloading ${name} to ${zipPath}...`);
            await downloadFile(downloadUrl, zipPath);

            console.log(`Unzipping...`);
            await unzipFile(zipPath, serverDir);

            // Clean up zip
            fs.unlinkSync(zipPath);

            // Try to find the start script
            let jarName = 'run.sh';
            // Simple heuristic to find a .sh or .bat file if run.sh doesn't exist
            if (!fs.existsSync(path.join(serverDir, 'run.sh'))) {
                const files = fs.readdirSync(serverDir);
                const script = files.find(f => f.endsWith('.sh') || f.endsWith('.bat'));
                if (script) jarName = script;
                // If forge installer exists, we might need to run it? 
                // For now assumption is "Server Pack" contains ready-to-run scripts.
            }

            // Accept EULA automatically
            fs.writeFileSync(path.join(serverDir, 'eula.txt'), 'eula=true');

            // Ensure script is executable
            if (jarName.endsWith('.sh')) {
                // We'll use fs.chmodSync
                fs.chmodSync(path.join(serverDir, jarName), '755');
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
            // Cleanup on failure?
            throw err;
        }
    }
}

module.exports = ServerManager;
