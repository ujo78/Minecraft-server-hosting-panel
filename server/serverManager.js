const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');

// Helper to unzip file (requires 'unzip' on Linux or PowerShell on Windows, but let's use a simple JS unzipper or system command)
// For Azure VM (Linux), 'unzip' command is best.
const unzipFile = (zipPath, destPath) => {
    return new Promise((resolve, reject) => {
        console.log(`Attempting to unzip: ${zipPath} to ${destPath}`);
        const unzip = spawn('unzip', ['-o', zipPath, '-d', destPath]);

        let stdout = '';
        let stderr = '';

        unzip.stdout.on('data', (data) => {
            stdout += data.toString();
            console.log('Unzip stdout:', data.toString());
        });

        unzip.stderr.on('data', (data) => {
            stderr += data.toString();
            console.error('Unzip stderr:', data.toString());
        });

        unzip.on('close', (code) => {
            console.log(`Unzip process exited with code ${code}`);
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Unzip failed with code ${code}. Stderr: ${stderr}`));
            }
        });

        unzip.on('error', (err) => {
            console.error('Unzip spawn error:', err);
            reject(err);
        });
    });
};

const downloadFile = (url, destPath) => {
    return new Promise((resolve, reject) => {
        console.log(`Starting download from: ${url}`);
        const file = fs.createWriteStream(destPath);

        const download = (downloadUrl) => {
            https.get(downloadUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            }, function (response) {
                console.log(`Response status: ${response.statusCode}`);
                console.log(`Response headers:`, response.headers);

                // Handle redirects
                if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308) {
                    const redirectUrl = response.headers.location;
                    console.log(`Following redirect to: ${redirectUrl}`);
                    file.close();

                    // Recursively download from redirect - properly chain the promise!
                    downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
                    return;
                }

                if (response.statusCode !== 200) {
                    file.close();
                    fs.unlinkSync(destPath);
                    reject(new Error(`Download failed with status ${response.statusCode}`));
                    return;
                }

                response.pipe(file);
                file.on('finish', function () {
                    file.close(() => {
                        console.log(`Download complete: ${destPath}`);
                        resolve();
                    });
                });
            }).on('error', function (err) {
                file.close();
                fs.unlink(destPath, () => { });
                reject(err);
            });
        };

        download(url);
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
            // CRITICAL: Detect if this is a client pack (not a server pack)
            const files = fs.readdirSync(serverDir);
            console.log(`Files in extracted server pack:`, files);

            // Client packs have manifest.json + overrides folder
            if (files.includes('manifest.json') && files.includes('overrides')) {
                console.error('Detected client pack (manifest.json + overrides)');

                // Cleanup the extracted files
                fs.rmSync(serverDir, { recursive: true, force: true });

                throw new Error('Downloaded file is a client pack, not a server pack. Cannot run as a server.');
            }
            // Try to find the start script - expanded patterns
            let jarName = 'run.sh';

            const startupPatterns = [
                'run.sh', 'start.sh', 'startserver.sh', 'ServerStart.sh',
                'start-server.sh', 'run-server.sh', 'launch.sh',
                'run.bat', 'start.bat', 'startserver.bat'
            ];

            // Check for known patterns first
            for (const pattern of startupPatterns) {
                if (files.includes(pattern)) {
                    jarName = pattern;
                    console.log(`Found startup script: ${pattern}`);
                    break;
                }
            }

            // If no known pattern, search for any .sh or .bat file
            if (jarName === 'run.sh' && !files.includes('run.sh')) {
                const script = files.find(f => f.endsWith('.sh') || f.endsWith('.bat'));
                if (script) {
                    jarName = script;
                    console.log(`Found startup script by extension: ${script}`);
                }
            }

            // Accept EULA automatically
            fs.writeFileSync(path.join(serverDir, 'eula.txt'), 'eula=true');

            // Ensure script is executable (only if file exists)
            const scriptPath = path.join(serverDir, jarName);
            if (jarName.endsWith('.sh') && fs.existsSync(scriptPath)) {
                fs.chmodSync(scriptPath, '755');
                console.log(`Made ${jarName} executable`);
            } else if (!fs.existsSync(scriptPath)) {
                console.warn(`Warning: Startup script ${jarName} not found - this might be a client pack or require manual setup`);
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

            // Cleanup on failure - remove the server directory
            try {
                if (fs.existsSync(serverDir)) {
                    console.log(`Cleaning up failed installation: ${serverDir}`);
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
