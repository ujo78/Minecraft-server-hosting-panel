const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const MinecraftHandler = require('./minecraftHandler');
const PlayerDataParser = require('./playerDataParser');
const ServerManager = require('./serverManager');
const BackupManager = require('./backupManager');
const MetricsCollector = require('./metricsCollector');
const ModSearcher = require('./modSearcher');
const PluginManager = require('./pluginManager');
const ResourceTracker = require('./resourceTracker');

// ─── Game Agent ───────────────────────────────────────────────
// This runs on the Game VM. It exposes Minecraft management APIs
// internally (no auth — the Web VM handles all authentication).
// ──────────────────────────────────────────────────────────────

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

const PORT = process.env.GAME_AGENT_PORT || 4000;
const MCPANEL_DIR = process.env.MCPANEL_DIR || '/home/rajrakshit838/McPanel';

// ─── Initialize Managers ──────────────────────────────────────

const serverManager = new ServerManager(path.join(__dirname, 'config.json'), MCPANEL_DIR);
const backupManager = new BackupManager(path.join(__dirname, '../backups'));
const modSearcher = new ModSearcher();

let metricsCollector = null;

// ─── Active Server State ──────────────────────────────────────

let activeServer = serverManager.getActiveServer();
let SERVER_DIR = activeServer ? path.resolve(__dirname, activeServer.path) : null;
let JAR_NAME = activeServer ? activeServer.jar : null;
let mc = null;

// Helper to resolve server paths (handles both absolute and relative)
function resolveServerPath(srvPath, ...extra) {
    const base = path.isAbsolute(srvPath) ? srvPath : path.resolve(__dirname, srvPath);
    return extra.length > 0 ? path.join(base, ...extra) : base;
}

function initMinecraftHandler() {
    if (!activeServer) return null;

    // Support both absolute paths (from Mcpanel/) and relative paths (legacy)
    SERVER_DIR = path.isAbsolute(activeServer.path) ? activeServer.path : path.resolve(__dirname, activeServer.path);
    JAR_NAME = activeServer.jar;

    if (!fs.existsSync(SERVER_DIR)) {
        fs.mkdirSync(SERVER_DIR, { recursive: true });
    }

    const options = {
        memory: activeServer.memory || 1024,
        port: activeServer.port || 25565
    };

    if (metricsCollector) {
        metricsCollector.stopCollecting();
    }

    mc = new MinecraftHandler(JAR_NAME, SERVER_DIR, options);
    metricsCollector = new MetricsCollector(mc);
    metricsCollector.startCollecting();

    mc.on('console', (data) => {
        io.emit('console', data);
    });

    mc.on('status', (status) => {
        serverManager.updateServerStatus(activeServer.id, status);
        io.emit('status', status);
        io.emit('serverStatus', { id: activeServer.id, status });
    });

    mc.on('players', (players) => {
        io.emit('players', players);
    });

    metricsCollector.on('metricsUpdate', (metrics) => {
        io.emit('metrics', metrics);
    });

    return mc;
}

// Initialize on startup
if (activeServer) {
    initMinecraftHandler();
}

// ─── Multer for mod uploads ───────────────────────────────────

const modsStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const modsDir = path.join(SERVER_DIR, 'mods');
        if (!fs.existsSync(modsDir)) {
            fs.mkdirSync(modsDir, { recursive: true });
        }
        cb(null, modsDir);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: modsStorage });

// ─── Socket.IO ────────────────────────────────────────────────

io.on('connection', (socket) => {
    console.log('Web VM connected via Socket.IO');
    if (mc) {
        socket.emit('status', mc.getStatus());
    } else {
        socket.emit('status', 'offline');
    }

    socket.on('command', (cmd) => {
        if (mc) mc.command(cmd);
    });
});

// ─── Health / Heartbeat ───────────────────────────────────────

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        activeServer: activeServer ? activeServer.id : null,
        mcStatus: mc ? mc.getStatus() : 'no-handler'
    });
});

// ─── Player Count (for inactivity checks) ─────────────────────

app.get('/api/player-count', (req, res) => {
    const count = mc ? mc.getPlayers().length : 0;
    res.json({ count });
});

// ─── Server Discovery / Refresh ───────────────────────────────
// Scans the current working directory (and parent) for valid
// Minecraft server directories (ones with run.sh, server.jar, etc.)

app.post('/api/refresh-servers', (req, res) => {
    try {
        const discovered = discoverServers();
        res.json({
            success: true,
            discovered,
            registeredServers: serverManager.getServers().length,
            scanDirectory: MCPANEL_DIR
        });
    } catch (err) {
        console.error('Server discovery failed:', err);
        res.status(500).json({ error: err.message });
    }
});

// Helper: scan MCPANEL_DIR for valid server directories
function discoverServers() {
    const startupPatterns = [
        'run.sh', 'start.sh', 'startserver.sh', 'ServerStart.sh',
        'start-server.sh', 'run-server.sh', 'launch.sh',
        'run.bat', 'start.bat',
        'server.jar', 'forge.jar', 'paper.jar', 'spigot.jar'
    ];

    const discovered = [];

    if (!fs.existsSync(MCPANEL_DIR)) {
        console.warn(`⚠️ MCPANEL_DIR not found: ${MCPANEL_DIR}`);
        return discovered;
    }

    const entries = fs.readdirSync(MCPANEL_DIR, { withFileTypes: true });

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        // Skip known non-server directories
        const skipDirs = ['node_modules', '.git', 'backups'];
        if (skipDirs.includes(entry.name)) continue;

        const dirPath = path.join(MCPANEL_DIR, entry.name);
        let files;
        try {
            files = fs.readdirSync(dirPath);
        } catch (e) {
            continue; // skip unreadable dirs
        }

        // Check if this directory contains a valid Minecraft server
        let foundStartup = null;
        for (const pattern of startupPatterns) {
            if (files.includes(pattern)) {
                foundStartup = pattern;
                break;
            }
        }

        // Fallback: check for any .jar file
        if (!foundStartup) {
            const jar = files.find(f => f.endsWith('.jar'));
            if (jar) foundStartup = jar;
        }

        if (foundStartup) {
            const existingServer = serverManager.getServers().find(s => {
                return path.resolve(s.path) === dirPath || s.id === entry.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
            });

            discovered.push({
                directory: entry.name,
                path: dirPath,
                startupFile: foundStartup,
                alreadyRegistered: !!existingServer,
                registeredId: existingServer ? existingServer.id : null,
                hasEula: files.includes('eula.txt'),
                hasServerProperties: files.includes('server.properties'),
                hasMods: files.includes('mods'),
                hasPlugins: files.includes('plugins')
            });
        }
    }

    return discovered;
}

// Read actual RAM allocation from user_jvm_args.txt
function readJvmMemory(serverPath) {
    const jvmFiles = ['user_jvm_args.txt', 'jvm_args.txt'];
    for (const file of jvmFiles) {
        const jvmPath = path.join(serverPath, file);
        if (fs.existsSync(jvmPath)) {
            try {
                const content = fs.readFileSync(jvmPath, 'utf8');
                // Filter out comment lines (starting with #)
                const activeLines = content.split('\n')
                    .filter(line => !line.trim().startsWith('#'))
                    .join('\n');
                const xmxMatch = activeLines.match(/-Xmx(\d+)([MmGg])/);
                if (xmxMatch) {
                    const value = parseInt(xmxMatch[1]);
                    const unit = xmxMatch[2].toUpperCase();
                    return unit === 'G' ? value * 1024 : value;
                }
            } catch (e) { /* ignore */ }
        }
    }

    // Fallback: check run.sh for -Xmx
    const runSh = path.join(serverPath, 'run.sh');
    if (fs.existsSync(runSh)) {
        try {
            const content = fs.readFileSync(runSh, 'utf8');
            const activeLines = content.split('\n')
                .filter(line => !line.trim().startsWith('#'))
                .join('\n');
            const xmxMatch = activeLines.match(/-Xmx(\d+)([MmGg])/);
            if (xmxMatch) {
                const value = parseInt(xmxMatch[1]);
                const unit = xmxMatch[2].toUpperCase();
                return unit === 'G' ? value * 1024 : value;
            }
        } catch (e) { /* ignore */ }
    }

    return 2048; // default
}

// Auto-register a discovered server
app.post('/api/refresh-servers/register', (req, res) => {
    try {
        const { directory, name, memory } = req.body;
        if (!directory || !name) {
            return res.status(400).json({ error: 'directory and name are required' });
        }

        const targetPath = path.join(MCPANEL_DIR, directory);
        if (!fs.existsSync(targetPath)) {
            return res.status(404).json({ error: `Directory '${directory}' not found in ${MCPANEL_DIR}` });
        }

        const files = fs.readdirSync(targetPath);
        const startupPatterns = [
            'run.sh', 'start.sh', 'startserver.sh', 'ServerStart.sh',
            'start-server.sh', 'run-server.sh', 'launch.sh',
            'run.bat', 'start.bat',
            'server.jar', 'forge.jar', 'paper.jar', 'spigot.jar'
        ];

        let jarName = 'server.jar';
        for (const pattern of startupPatterns) {
            if (files.includes(pattern)) {
                jarName = pattern;
                break;
            }
        }
        if (jarName === 'server.jar') {
            const jar = files.find(f => f.endsWith('.jar'));
            if (jar) jarName = jar;
        }

        const id = directory.toLowerCase().replace(/[^a-z0-9-]/g, '-');

        serverManager.addServer({
            id,
            name,
            path: targetPath,  // absolute path
            jar: jarName,
            memory: memory || 2048,
            port: serverManager.findAvailablePort()
        });

        res.json({ success: true, id });
    } catch (err) {
        console.error('Server registration failed:', err);
        res.status(500).json({ error: err.message });
    }
});

// ─── Server Status & Control ──────────────────────────────────

app.get('/api/status', (req, res) => {
    res.json({ status: mc ? mc.getStatus() : 'offline' });
});

app.post('/api/control', (req, res) => {
    const { action } = req.body;
    if (!mc) {
        return res.status(400).json({ error: 'No active server handler' });
    }
    if (action === 'start') {
        mc.start();
    } else if (action === 'stop') {
        mc.stop();
    }
    res.json({ success: true, status: mc.getStatus() });
});

// ─── Mod Management ───────────────────────────────────────────

app.post('/api/upload-mod', upload.single('mod'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    console.log(`Mod uploaded: ${req.file.originalname}`);
    res.json({ success: true, filename: req.file.originalname });
});

app.get('/api/mods', (req, res) => {
    const modsDir = path.join(SERVER_DIR, 'mods');
    if (!fs.existsSync(modsDir)) return res.json({ mods: [] });

    fs.readdir(modsDir, (err, files) => {
        if (err) return res.status(500).json({ error: 'Failed to list mods' });
        res.json({ mods: files.filter(f => f.endsWith('.jar')) });
    });
});

app.post('/api/delete-mod', (req, res) => {
    const { filename } = req.body;
    const filePath = path.join(SERVER_DIR, 'mods', filename);

    if (!filePath.startsWith(path.join(SERVER_DIR, 'mods'))) {
        return res.status(403).json({ error: 'Invalid file path' });
    }

    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'File not found' });
    }
});

// ─── Player Management ────────────────────────────────────────

app.get('/api/players', (req, res) => {
    res.json({ players: mc ? mc.getPlayers() : [] });
});

app.get('/api/players/:username', async (req, res) => {
    try {
        const { username } = req.params;
        if (!mc) return res.status(400).json({ error: 'No active server' });

        const player = mc.getPlayerData(username);
        if (!player) {
            return res.status(404).json({ error: 'Player not found or offline' });
        }

        const playerDataParser = new PlayerDataParser(SERVER_DIR);
        const enhancedData = await playerDataParser.getEnhancedPlayerData(username);

        res.json({ ...player, ...enhancedData });
    } catch (err) {
        console.error('Error fetching player data:', err);
        res.status(500).json({ error: 'Failed to fetch player data' });
    }
});

app.post('/api/players/action', async (req, res) => {
    try {
        const { action, username, reason } = req.body;
        if (!mc) return res.status(400).json({ error: 'No active server' });

        if (!['op', 'deop', 'kick', 'ban'].includes(action)) {
            return res.status(400).json({ error: 'Invalid action' });
        }

        let command = `${action} ${username}`;
        if ((action === 'kick' || action === 'ban') && reason) {
            command += ` ${reason}`;
        }

        mc.sendCommand(command);
        res.json({ success: true, message: `Executed ${action} on ${username}` });
    } catch (err) {
        console.error('Error executing player action:', err);
        res.status(500).json({ error: 'Failed to execute action' });
    }
});

// ─── Server Management ────────────────────────────────────────

app.get('/api/servers', (req, res) => {
    const servers = serverManager.getServers();
    const active = serverManager.getActiveServer();
    res.json({ servers, activeId: active ? active.id : null });
});

app.post('/api/servers/switch', async (req, res) => {
    const { id, force } = req.body;

    const currentStatus = mc ? mc.getStatus() : 'offline';
    if (currentStatus !== 'offline' && currentStatus !== 'crashed' && !force) {
        return res.status(400).json({ error: 'Server must be offline to switch' });
    }

    if (currentStatus !== 'offline' && mc) {
        mc.stop();
    }

    if (serverManager.setActiveServer(id)) {
        activeServer = serverManager.getActiveServer();
        initMinecraftHandler();
        res.json({ success: true, activeId: id });
    } else {
        res.status(404).json({ error: 'Server not found' });
    }
});

app.delete('/api/servers/:id', (req, res) => {
    const { id } = req.params;
    const active = serverManager.getActiveServer();
    if (active && active.id === id) {
        return res.status(400).json({ error: 'Cannot delete active server' });
    }

    if (serverManager.deleteServer(id)) {
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Server not found' });
    }
});

app.get('/api/available-servers', (req, res) => {
    try {
        const templates = serverManager.getInstallableServers();
        res.json(templates);
    } catch (err) {
        console.error('Failed to list templates:', err);
        res.status(500).json({ error: 'Failed to list available servers' });
    }
});

app.post('/api/servers/install', async (req, res) => {
    try {
        const { id, name, templateId, memory, serverAddress } = req.body;

        if (!id || !name || !templateId) {
            return res.status(400).json({
                error: 'Missing required fields: id, name, and templateId are required'
            });
        }

        let allocatedMemory = memory || 2048;
        if (typeof allocatedMemory !== 'number' || allocatedMemory < 512 || allocatedMemory > 8192) {
            return res.status(400).json({
                error: 'Invalid memory allocation. Must be between 512 and 8192 MB'
            });
        }

        console.log(`Install request for: ${name} (ID: ${id}) from template: ${templateId} with ${allocatedMemory}MB RAM`);

        await serverManager.installServer(id, name, templateId, allocatedMemory, serverAddress);
        res.json({ success: true });
    } catch (err) {
        console.error("Install failed:", err);
        res.status(500).json({ error: err.message });
    }
});

// ─── Backup Management ────────────────────────────────────────

app.post('/api/servers/:id/backups', async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        const srv = serverManager.getServer(id);
        if (!srv) return res.status(404).json({ error: 'Server not found' });

        const serverPath = resolveServerPath(srv.path);
        const backup = await backupManager.createBackup(id, serverPath, name);
        res.json({ success: true, backup });
    } catch (err) {
        console.error('Backup creation failed:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/servers/:id/backups', (req, res) => {
    try {
        const { id } = req.params;
        const srv = serverManager.getServer(id);
        if (!srv) return res.status(404).json({ error: 'Server not found' });

        const backups = backupManager.listBackups(id);
        const stats = backupManager.getBackupStats(id);
        res.json({ backups, stats });
    } catch (err) {
        console.error('Failed to list backups:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/servers/:id/backups/:backupId/restore', async (req, res) => {
    try {
        const { id, backupId } = req.params;
        const srv = serverManager.getServer(id);
        if (!srv) return res.status(404).json({ error: 'Server not found' });

        if (srv.status !== 'offline') {
            return res.status(400).json({ error: 'Server must be offline to restore backup' });
        }

        const serverPath = resolveServerPath(srv.path);
        await backupManager.restoreBackup(id, backupId, serverPath);
        res.json({ success: true, message: 'Backup restored successfully' });
    } catch (err) {
        console.error('Backup restore failed:', err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/servers/:id/backups/:backupId', (req, res) => {
    try {
        const { id, backupId } = req.params;
        const srv = serverManager.getServer(id);
        if (!srv) return res.status(404).json({ error: 'Server not found' });

        const success = backupManager.deleteBackup(id, backupId);
        if (success) {
            res.json({ success: true, message: 'Backup deleted' });
        } else {
            res.status(404).json({ error: 'Backup not found' });
        }
    } catch (err) {
        console.error('Failed to delete backup:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/servers/:id/backups/:backupId/download', (req, res) => {
    try {
        const { id, backupId } = req.params;
        const srv = serverManager.getServer(id);
        if (!srv) return res.status(404).json({ error: 'Server not found' });

        const backupPath = backupManager.getBackupPath(id, backupId);
        if (!backupPath) return res.status(404).json({ error: 'Backup not found' });

        res.download(backupPath, `${id}-${backupId}.zip`);
    } catch (err) {
        console.error('Failed to download backup:', err);
        res.status(500).json({ error: err.message });
    }
});

// ─── Server Properties ───────────────────────────────────────

function parseProperties(filePath) {
    if (!fs.existsSync(filePath)) return {};
    const content = fs.readFileSync(filePath, 'utf8');
    const props = {};
    content.split('\n').forEach(line => {
        line = line.trim();
        if (line && !line.startsWith('#')) {
            const eqIndex = line.indexOf('=');
            if (eqIndex !== -1) {
                props[line.substring(0, eqIndex).trim()] = line.substring(eqIndex + 1).trim();
            }
        }
    });
    return props;
}

function writeProperties(filePath, props) {
    let content = '# Minecraft server properties\n';
    content += `# Last modified: ${new Date().toISOString()}\n\n`;
    for (const [key, value] of Object.entries(props)) {
        content += `${key}=${value}\n`;
    }
    fs.writeFileSync(filePath, content, 'utf8');
}

app.get('/api/servers/:id/properties', (req, res) => {
    try {
        const { id } = req.params;
        const srv = serverManager.getServer(id);
        if (!srv) return res.status(404).json({ error: 'Server not found' });

        const propsPath = resolveServerPath(srv.path, 'server.properties');
        const properties = parseProperties(propsPath);
        res.json({ properties });
    } catch (err) {
        console.error('Failed to read properties:', err);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/servers/:id/properties', (req, res) => {
    try {
        const { id } = req.params;
        const { properties } = req.body;
        const srv = serverManager.getServer(id);
        if (!srv) return res.status(404).json({ error: 'Server not found' });

        const propsPath = resolveServerPath(srv.path, 'server.properties');
        writeProperties(propsPath, properties);
        res.json({ success: true, message: 'Properties updated' });
    } catch (err) {
        console.error('Failed to update properties:', err);
        res.status(500).json({ error: err.message });
    }
});

// ─── JVM Args Management ──────────────────────────────────────

app.get('/api/servers/:id/jvm-args', (req, res) => {
    try {
        const { id } = req.params;
        const srv = serverManager.getServer(id);
        if (!srv) return res.status(404).json({ error: 'Server not found' });

        const jvmPath = resolveServerPath(srv.path, 'user_jvm_args.txt');
        let content = '';
        let memory = { xmx: null, xms: null };

        if (fs.existsSync(jvmPath)) {
            content = fs.readFileSync(jvmPath, 'utf8');

            // Parse Xmx (max memory)
            const xmxMatch = content.match(/-Xmx(\d+)([MmGg])/);
            if (xmxMatch) {
                const value = parseInt(xmxMatch[1]);
                const unit = xmxMatch[2].toUpperCase();
                memory.xmx = unit === 'G' ? value * 1024 : value; // normalize to MB
            }

            // Parse Xms (min memory)
            const xmsMatch = content.match(/-Xms(\d+)([MmGg])/);
            if (xmsMatch) {
                const value = parseInt(xmsMatch[1]);
                const unit = xmsMatch[2].toUpperCase();
                memory.xms = unit === 'G' ? value * 1024 : value;
            }
        }

        res.json({ content, memory, exists: fs.existsSync(jvmPath) });
    } catch (err) {
        console.error('Failed to read JVM args:', err);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/servers/:id/jvm-args', (req, res) => {
    try {
        const { id } = req.params;
        const { content, memory } = req.body;
        const srv = serverManager.getServer(id);
        if (!srv) return res.status(404).json({ error: 'Server not found' });

        const jvmPath = resolveServerPath(srv.path, 'user_jvm_args.txt');

        if (content !== undefined) {
            // Raw content mode — write directly
            fs.writeFileSync(jvmPath, content, 'utf8');
        } else if (memory) {
            // Structured mode — update or create with Xmx/Xms
            let existing = '';
            if (fs.existsSync(jvmPath)) {
                existing = fs.readFileSync(jvmPath, 'utf8');
            }

            const xmx = memory.xmx || memory.max || 4096;
            const xms = memory.xms || memory.min || xmx;

            if (existing) {
                // Replace existing Xmx/Xms values
                if (existing.match(/-Xmx\d+[MmGg]/)) {
                    existing = existing.replace(/-Xmx\d+[MmGg]/, `-Xmx${xmx}M`);
                } else {
                    existing += `\n-Xmx${xmx}M`;
                }
                if (existing.match(/-Xms\d+[MmGg]/)) {
                    existing = existing.replace(/-Xms\d+[MmGg]/, `-Xms${xms}M`);
                } else {
                    existing += `\n-Xms${xms}M`;
                }
                fs.writeFileSync(jvmPath, existing, 'utf8');
            } else {
                // Create new file
                fs.writeFileSync(jvmPath, `# JVM Arguments\n-Xmx${xmx}M\n-Xms${xms}M\n`, 'utf8');
            }

            // Also update the server config
            serverManager.updateServerMemory(id, xmx);
        }

        res.json({ success: true, message: 'JVM args updated' });
    } catch (err) {
        console.error('Failed to update JVM args:', err);
        res.status(500).json({ error: err.message });
    }
});

// ─── Whitelist Management ─────────────────────────────────────

app.get('/api/servers/:id/whitelist', (req, res) => {
    try {
        const { id } = req.params;
        const srv = serverManager.getServer(id);
        if (!srv) return res.status(404).json({ error: 'Server not found' });

        const whitelistPath = resolveServerPath(srv.path, 'whitelist.json');
        let whitelist = [];
        if (fs.existsSync(whitelistPath)) {
            whitelist = JSON.parse(fs.readFileSync(whitelistPath, 'utf8'));
        }

        const propsPath = resolveServerPath(srv.path, 'server.properties');
        const props = parseProperties(propsPath);
        const enabled = props['white-list'] === 'true';

        res.json({ whitelist, enabled });
    } catch (err) {
        console.error('Failed to read whitelist:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/servers/:id/whitelist', async (req, res) => {
    try {
        const { id } = req.params;
        const { username } = req.body;
        const srv = serverManager.getServer(id);
        if (!srv) return res.status(404).json({ error: 'Server not found' });

        const response = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`);
        if (!response.ok) return res.status(404).json({ error: 'Player not found' });

        const playerData = await response.json();
        const uuid = playerData.id;
        const name = playerData.name;
        const formattedUuid = uuid.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');

        const whitelistPath = resolveServerPath(srv.path, 'whitelist.json');
        let whitelist = [];
        if (fs.existsSync(whitelistPath)) {
            whitelist = JSON.parse(fs.readFileSync(whitelistPath, 'utf8'));
        }

        if (whitelist.some(p => p.uuid === formattedUuid)) {
            return res.status(400).json({ error: 'Player already whitelisted' });
        }

        whitelist.push({ uuid: formattedUuid, name });
        fs.writeFileSync(whitelistPath, JSON.stringify(whitelist, null, 2));

        if (mc && mc.getStatus() === 'online') {
            mc.sendCommand('whitelist reload');
        }

        res.json({ success: true, player: { uuid: formattedUuid, name } });
    } catch (err) {
        console.error('Failed to add to whitelist:', err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/servers/:id/whitelist/:username', (req, res) => {
    try {
        const { id, username } = req.params;
        const srv = serverManager.getServer(id);
        if (!srv) return res.status(404).json({ error: 'Server not found' });

        const whitelistPath = resolveServerPath(srv.path, 'whitelist.json');
        if (!fs.existsSync(whitelistPath)) {
            return res.status(404).json({ error: 'Whitelist not found' });
        }

        let whitelist = JSON.parse(fs.readFileSync(whitelistPath, 'utf8'));
        const originalLength = whitelist.length;
        whitelist = whitelist.filter(p => p.name.toLowerCase() !== username.toLowerCase());

        if (whitelist.length === originalLength) {
            return res.status(404).json({ error: 'Player not in whitelist' });
        }

        fs.writeFileSync(whitelistPath, JSON.stringify(whitelist, null, 2));

        if (mc && mc.getStatus() === 'online') {
            mc.sendCommand('whitelist reload');
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Failed to remove from whitelist:', err);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/servers/:id/whitelist/toggle', (req, res) => {
    try {
        const { id } = req.params;
        const { enabled } = req.body;
        const srv = serverManager.getServer(id);
        if (!srv) return res.status(404).json({ error: 'Server not found' });

        const propsPath = resolveServerPath(srv.path, 'server.properties');
        const props = parseProperties(propsPath);
        props['white-list'] = enabled ? 'true' : 'false';
        writeProperties(propsPath, props);

        if (mc && mc.getStatus() === 'online') {
            mc.sendCommand(`whitelist ${enabled ? 'on' : 'off'}`);
        }

        res.json({ success: true, enabled });
    } catch (err) {
        console.error('Failed to toggle whitelist:', err);
        res.status(500).json({ error: err.message });
    }
});

// ─── File Browser ─────────────────────────────────────────────

function validatePath(basePath, requestedPath) {
    const fullPath = path.resolve(basePath, requestedPath || '.');
    if (!fullPath.startsWith(basePath)) {
        throw new Error('Invalid path');
    }
    return fullPath;
}

app.get('/api/servers/:id/files', (req, res) => {
    try {
        const { id } = req.params;
        const { path: requestedPath } = req.query;
        const srv = serverManager.getServer(id);
        if (!srv) return res.status(404).json({ error: 'Server not found' });

        const serverPath = resolveServerPath(srv.path);
        const fullPath = validatePath(serverPath, requestedPath);

        if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'Path not found' });

        const stat = fs.statSync(fullPath);
        if (!stat.isDirectory()) return res.status(400).json({ error: 'Path is not a directory' });

        const items = fs.readdirSync(fullPath).map(name => {
            const itemPath = path.join(fullPath, name);
            const itemStat = fs.statSync(itemPath);
            return {
                name,
                type: itemStat.isDirectory() ? 'directory' : 'file',
                size: itemStat.size,
                modified: itemStat.mtime
            };
        });

        res.json({ items, path: requestedPath || '/' });
    } catch (err) {
        console.error('Failed to list files:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/servers/:id/files/read', (req, res) => {
    try {
        const { id } = req.params;
        const { path: requestedPath } = req.query;
        const srv = serverManager.getServer(id);
        if (!srv) return res.status(404).json({ error: 'Server not found' });

        const serverPath = resolveServerPath(srv.path);
        const fullPath = validatePath(serverPath, requestedPath);

        if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'File not found' });

        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) return res.status(400).json({ error: 'Path is a directory' });
        if (stat.size > 1024 * 1024) return res.status(400).json({ error: 'File too large to edit (max 1MB)' });

        const content = fs.readFileSync(fullPath, 'utf8');
        res.json({ content, path: requestedPath });
    } catch (err) {
        console.error('Failed to read file:', err);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/servers/:id/files/write', (req, res) => {
    try {
        const { id } = req.params;
        const { path: requestedPath, content } = req.body;
        const srv = serverManager.getServer(id);
        if (!srv) return res.status(404).json({ error: 'Server not found' });

        const serverPath = resolveServerPath(srv.path);
        const fullPath = validatePath(serverPath, requestedPath);

        const ext = path.extname(fullPath);
        const blockedExtensions = ['.jar', '.dat', '.mca'];
        if (blockedExtensions.includes(ext)) {
            return res.status(403).json({ error: 'File type cannot be edited' });
        }

        fs.writeFileSync(fullPath, content, 'utf8');
        res.json({ success: true, message: 'File saved' });
    } catch (err) {
        console.error('Failed to write file:', err);
        res.status(500).json({ error: err.message });
    }
});

// ─── Metrics & Monitoring ─────────────────────────────────────

app.get('/api/servers/:id/metrics', (req, res) => {
    try {
        if (metricsCollector) {
            const current = metricsCollector.getCurrentMetrics();
            const averages = metricsCollector.getAverages(5);
            const alerts = metricsCollector.getPerformanceAlerts();
            res.json({ current, averages, alerts });
        } else {
            res.json({ error: 'Metrics collector not initialized' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/servers/:id/metrics/history', (req, res) => {
    try {
        if (metricsCollector) {
            const history = metricsCollector.getRecentMetrics(15);
            res.json(history);
        } else {
            res.json({ error: 'Metrics collector not initialized' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Mod Search & Install ─────────────────────────────────────

app.get('/api/mods/search', async (req, res) => {
    try {
        const { query, version, loader } = req.query;
        if (!query) return res.status(400).json({ error: 'Query required' });

        const results = await modSearcher.searchModrinth(query, version, loader);
        res.json({ results });
    } catch (err) {
        console.error('Mod search failed:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/servers/:id/mods/install-from-url', async (req, res) => {
    try {
        const { id } = req.params;
        const { url, filename } = req.body;
        const srv = serverManager.getServer(id);
        if (!srv) return res.status(404).json({ error: 'Server not found' });

        const modsDir = path.join(__dirname, srv.path, 'mods');
        if (!fs.existsSync(modsDir)) fs.mkdirSync(modsDir, { recursive: true });

        const destPath = path.join(modsDir, filename);
        await modSearcher.downloadMod(url, destPath);
        res.json({ success: true, message: 'Mod installed' });
    } catch (err) {
        console.error('Mod install failed:', err);
        res.status(500).json({ error: err.message });
    }
});

// ─── Plugin System ────────────────────────────────────────────

app.get('/api/servers/:id/plugins', (req, res) => {
    try {
        const { id } = req.params;
        const srv = serverManager.getServer(id);
        if (!srv) return res.status(404).json({ error: 'Server not found' });

        const pm = new PluginManager(path.join(__dirname, srv.path));
        res.json({ plugins: pm.listPlugins() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/servers/:id/plugins/install', async (req, res) => {
    try {
        const { id } = req.params;
        const { url, filename } = req.body;
        const srv = serverManager.getServer(id);
        if (!srv) return res.status(404).json({ error: 'Server not found' });

        const pm = new PluginManager(path.join(__dirname, srv.path));
        await pm.installPlugin(url, filename);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/servers/:id/plugins/:name/toggle', (req, res) => {
    try {
        const { id, name } = req.params;
        const { enabled } = req.body;
        const srv = serverManager.getServer(id);
        if (!srv) return res.status(404).json({ error: 'Server not found' });

        const pm = new PluginManager(path.join(__dirname, srv.path));
        const success = pm.togglePlugin(name, enabled);
        res.json({ success });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/servers/:id/plugins/:name', (req, res) => {
    try {
        const { id, name } = req.params;
        const srv = serverManager.getServer(id);
        if (!srv) return res.status(404).json({ error: 'Server not found' });

        const pm = new PluginManager(path.join(__dirname, srv.path));
        const filename = req.query.filename || name + '.jar';
        const success = pm.deletePlugin(filename);
        if (!success) pm.deletePlugin(name + '.jar.disabled');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Resource Usage ───────────────────────────────────────────

app.get('/api/servers/:id/resources', async (req, res) => {
    try {
        const { id } = req.params;
        const srv = serverManager.getServer(id);
        if (!srv) return res.status(404).json({ error: 'Server not found' });

        const tracker = new ResourceTracker(path.join(__dirname, srv.path));
        const diskUsage = await tracker.getDiskUsage();
        const breakdown = tracker.getDirectoryBreakdown();
        res.json({ diskUsage, breakdown });
    } catch (err) {
        console.error('Resource tracking failed:', err);
        res.status(500).json({ error: err.message });
    }
});

// ─── Graceful Shutdown ────────────────────────────────────────
// Web VM can call this before stopping the Game VM

app.post('/api/shutdown', async (req, res) => {
    console.log('🛑 Shutdown requested by Web VM');

    try {
        // Stop all running Minecraft servers
        if (mc && mc.getStatus() !== 'offline') {
            console.log('Stopping Minecraft server...');
            mc.stop();

            // Wait for the server to stop (max 30 seconds)
            await new Promise((resolve) => {
                const checkInterval = setInterval(() => {
                    if (!mc || mc.getStatus() === 'offline') {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 1000);

                // Force resolve after 30 seconds
                setTimeout(() => {
                    clearInterval(checkInterval);
                    resolve();
                }, 30000);
            });
        }

        if (metricsCollector) {
            metricsCollector.stopCollecting();
        }

        res.json({ success: true, message: 'Shutdown complete' });

        // Give time for response to send, then exit
        setTimeout(() => {
            console.log('Game Agent shutting down...');
            process.exit(0);
        }, 1000);
    } catch (err) {
        console.error('Shutdown error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ─── Start Server ─────────────────────────────────────────────

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🎮 Game Agent running on port ${PORT}`);
    console.log(`📂 Scanning servers from: ${MCPANEL_DIR}`);

    // Auto-discover and register servers on startup
    try {
        const discovered = discoverServers();
        let registered = 0;
        for (const srv of discovered) {
            // Read actual RAM from user_jvm_args.txt
            const actualMemory = readJvmMemory(srv.path);

            if (!srv.alreadyRegistered) {
                const id = srv.directory.toLowerCase().replace(/[^a-z0-9-]/g, '-');
                serverManager.addServer({
                    id,
                    name: srv.directory,
                    path: srv.path,
                    jar: srv.startupFile,
                    memory: actualMemory,
                    port: serverManager.findAvailablePort()
                });
                registered++;
                console.log(`  ✅ Auto-registered: ${srv.directory} (${srv.startupFile}, ${actualMemory}MB RAM)`);
            } else {
                // Sync memory from file for already-registered servers
                serverManager.updateServerMemory(srv.registeredId, actualMemory);
                console.log(`  📋 Already registered: ${srv.directory} (synced ${actualMemory}MB RAM)`);
            }
        }
        if (discovered.length === 0) {
            console.log(`  ⚠️ No servers found in ${MCPANEL_DIR}`);
        } else {
            console.log(`  Found ${discovered.length} server(s), ${registered} newly registered`);
        }
    } catch (err) {
        console.error('Auto-discovery failed:', err);
    }

    // Re-read active server after discovery
    activeServer = serverManager.getActiveServer();
    if (activeServer) {
        initMinecraftHandler();
        console.log(`Active server: ${activeServer.name} (${activeServer.id})`);
        console.log(`Server directory: ${SERVER_DIR}`);
    } else {
        console.log('No active server configured. Use the web panel to select one.');
    }
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use.`);
        process.exit(1);
    } else {
        console.error(err);
    }
});
