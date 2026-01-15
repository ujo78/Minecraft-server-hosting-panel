const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const MinecraftHandler = require('./minecraftHandler');
const PlayerDataParser = require('./playerDataParser');

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

app.use(express.static(path.join(__dirname, '../client/dist')));

const ServerManager = require('./serverManager');
const BackupManager = require('./backupManager');
const MetricsCollector = require('./metricsCollector');
const ModSearcher = require('./modSearcher');
const PluginManager = require('./pluginManager');
const ResourceTracker = require('./resourceTracker');

const serverManager = new ServerManager(path.join(__dirname, 'config.json'));
const backupManager = new BackupManager(path.join(__dirname, '../backups'));
const modSearcher = new ModSearcher();

// Metrics collector will be initialized per server/handler
let metricsCollector = null;

let activeServer = serverManager.getActiveServer();
if (!activeServer) {
    // Fallback if config is empty or invalid
    console.error("No active server found in config!");
    process.exit(1);
}

let SERVER_DIR = path.resolve(__dirname, activeServer.path);
let JAR_NAME = activeServer.jar;

// Ensure server directory exists (might be just ../servers/stoneblock4 or similar)
if (!fs.existsSync(SERVER_DIR)) {
    fs.mkdirSync(SERVER_DIR, { recursive: true });
}

// Function to reload MC handler when switching servers
const reloadMinecraftHandler = () => {
    activeServer = serverManager.getActiveServer();
    if (!activeServer) return null;

    SERVER_DIR = path.resolve(__dirname, activeServer.path);
    JAR_NAME = activeServer.jar;

    // Re-initialize MinecraftHandler
    const options = {
        memory: activeServer.memory || 1024,
        port: activeServer.port || 25565
    };

    // Stop existing metrics
    if (metricsCollector) {
        metricsCollector.stopCollecting();
    }

    // Ensure server directory exists for the new server
    if (!fs.existsSync(SERVER_DIR)) {
        fs.mkdirSync(SERVER_DIR, { recursive: true });
    }

    // Re-assign the global 'mc' instance
    mc = new MinecraftHandler(JAR_NAME, SERVER_DIR, options);
    metricsCollector = new MetricsCollector(mc);
    metricsCollector.startCollecting();

    // Re-bind events
    mc.on('line', (line) => {
        io.emit('console', line);
    });

    mc.on('status', (status) => {
        serverManager.updateServerStatus(activeServer.id, status);
        io.emit('status', status); // Emit general status
        io.emit('serverStatus', { id: activeServer.id, status }); // Emit server-specific status
    });

    mc.on('players', (players) => {
        io.emit('players', players);
    });

    metricsCollector.on('metricsUpdate', (metrics) => {
        io.emit('metrics', metrics);
    });

    return mc; // Return the new mc instance
};

if (!fs.existsSync(SERVER_DIR)) {
    fs.mkdirSync(SERVER_DIR, { recursive: true });
}

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

const options = {
    // defaults if not in config
    memory: activeServer.memory || 1024,
    port: activeServer.port || 25565
};

let mc = new MinecraftHandler(JAR_NAME, SERVER_DIR, options);
metricsCollector = new MetricsCollector(mc);
metricsCollector.startCollecting();

mc.on('line', (line) => {
    io.emit('console', line);
});

// Emit metrics updates
metricsCollector.on('metricsUpdate', (metrics) => {
    io.emit('metrics', metrics);
});
const playerDataParser = new PlayerDataParser(SERVER_DIR);

io.on('connection', (socket) => {
    console.log('Client connected');
    socket.emit('status', mc.getStatus());

    socket.on('command', (cmd) => {
        mc.command(cmd);
    });
});

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

app.get('/api/status', (req, res) => {
    res.json({ status: mc.getStatus() });
});

app.post('/api/control', (req, res) => {
    const { action } = req.body;
    if (action === 'start') {
        mc.start();
    } else if (action === 'stop') {
        mc.stop();
    }
    res.json({ success: true, status: mc.getStatus() });
});

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

app.get('/api/players', (req, res) => {
    res.json({ players: mc.getPlayers() });
});

app.get('/api/players/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const player = mc.getPlayerData(username);

        if (!player) {
            return res.status(404).json({ error: 'Player not found or offline' });
        }

        const enhancedData = await playerDataParser.getEnhancedPlayerData(username);

        res.json({
            ...player,
            ...enhancedData,
        });
    } catch (err) {
        console.error('Error fetching player data:', err);
        res.status(500).json({ error: 'Failed to fetch player data' });
    }
});

app.post('/api/players/action', async (req, res) => {
    try {
        const { action, username, reason } = req.body;

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




// --- Server Management APIs ---

app.get('/api/servers', (req, res) => {
    const servers = serverManager.getServers();
    const active = serverManager.getActiveServer();
    res.json({ servers, activeId: active ? active.id : null });
});

app.post('/api/servers/switch', async (req, res) => {
    const { id, force } = req.body;

    const currentStatus = mc.getStatus();
    // Allow switch if offline OR crashed. If online/starting, require 'force' or explicit stop first.
    // For now, let's allow switching if 'crashed' too.
    if (currentStatus !== 'offline' && currentStatus !== 'crashed' && !force) {
        return res.status(400).json({ error: 'Server must be offline to switch' });
    }

    // Force stop if needed (e.g. if we add a force flag later, or just safety)
    if (currentStatus !== 'offline') {
        mc.stop(); // Try to stop gracefully
        // If it was 'crashed', the process might already be gone, but this updates state
    }

    if (serverManager.setActiveServer(id)) {
        // Reload the active server variables
        const newActiveServer = serverManager.getActiveServer();
        SERVER_DIR = path.resolve(__dirname, newActiveServer.path);
        JAR_NAME = newActiveServer.jar;

        // Reinitialize MinecraftHandler with correct parameters
        mc.removeAllListeners(); // Clean up old listeners
        const newInstance = new MinecraftHandler(
            JAR_NAME,
            SERVER_DIR,
            {
                memory: newActiveServer.memory || 1024,
                port: newActiveServer.port || 25565
            }
        );
        Object.assign(mc, newInstance);

        // Re-attach event listeners
        mc.on('console', (data) => {
            io.emit('console', data);
        });
        mc.on('status', (status) => {
            serverManager.updateServerStatus(id, status);
            io.emit('status', status);
            io.emit('serverStatus', { id, status });
        });
        mc.on('players', (players) => {
            io.emit('players', players);
        });

        activeServer = newActiveServer;
        res.json({ success: true, activeId: id });
    } else {
        res.status(404).json({ error: 'Server not found' });
    }
});

app.delete('/api/servers/:id', (req, res) => {
    const { id } = req.params;
    if (serverManager.getActiveServer().id === id) {
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

        // Validate memory allocation
        let allocatedMemory = memory || 2048; // Default 2GB
        if (typeof allocatedMemory !== 'number' || allocatedMemory < 512 || allocatedMemory > 8192) {
            return res.status(400).json({
                error: 'Invalid memory allocation. Must be between 512 and 8192 MB'
            });
        }

        console.log(`Install request for: ${name} (ID: ${id}) from template: ${templateId} with ${allocatedMemory}MB RAM`);
        if (serverAddress) {
            console.log(`  Custom join address: ${serverAddress}`);
        }

        await serverManager.installServer(id, name, templateId, allocatedMemory, serverAddress);

        res.json({ success: true });
    } catch (err) {
        console.error("Install failed:", err);
        res.status(500).json({ error: err.message });
    }
});

// --- Backup Management APIs ---

// Create a backup
app.post('/api/servers/:id/backups', async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        const server = serverManager.getServer(id);

        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }

        const serverPath = path.resolve(__dirname, server.path);
        const backup = await backupManager.createBackup(id, serverPath, name);

        res.json({ success: true, backup });
    } catch (err) {
        console.error('Backup creation failed:', err);
        res.status(500).json({ error: err.message });
    }
});

// List backups for a server
app.get('/api/servers/:id/backups', (req, res) => {
    try {
        const { id } = req.params;
        const server = serverManager.getServer(id);

        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }

        const backups = backupManager.listBackups(id);
        const stats = backupManager.getBackupStats(id);

        res.json({ backups, stats });
    } catch (err) {
        console.error('Failed to list backups:', err);
        res.status(500).json({ error: err.message });
    }
});

// Restore a backup
app.post('/api/servers/:id/backups/:backupId/restore', async (req, res) => {
    try {
        const { id, backupId } = req.params;
        const server = serverManager.getServer(id);

        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }

        // Server must be offline to restore
        if (server.status !== 'offline') {
            return res.status(400).json({ error: 'Server must be offline to restore backup' });
        }

        const serverPath = path.resolve(__dirname, server.path);
        await backupManager.restoreBackup(id, backupId, serverPath);

        res.json({ success: true, message: 'Backup restored successfully' });
    } catch (err) {
        console.error('Backup restore failed:', err);
        res.status(500).json({ error: err.message });
    }
});

// Delete a backup
app.delete('/api/servers/:id/backups/:backupId', (req, res) => {
    try {
        const { id, backupId } = req.params;
        const server = serverManager.getServer(id);

        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }

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

// Download a backup
app.get('/api/servers/:id/backups/:backupId/download', (req, res) => {
    try {
        const { id, backupId } = req.params;
        const server = serverManager.getServer(id);

        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }

        const backupPath = backupManager.getBackupPath(id, backupId);

        if (!backupPath) {
            return res.status(404).json({ error: 'Backup not found' });
        }

        res.download(backupPath, `${id}-${backupId}.zip`);
    } catch (err) {
        console.error('Failed to download backup:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- Server Properties Editor APIs ---

// Helper function to parse server.properties
function parseProperties(filePath) {
    if (!fs.existsSync(filePath)) {
        return {};
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const props = {};

    content.split('\n').forEach(line => {
        line = line.trim();
        if (line && !line.startsWith('#')) {
            const eqIndex = line.indexOf('=');
            if (eqIndex !== -1) {
                const key = line.substring(0, eqIndex).trim();
                const value = line.substring(eqIndex + 1).trim();
                props[key] = value;
            }
        }
    });

    return props;
}

// Helper function to write server.properties
function writeProperties(filePath, props) {
    let content = '# Minecraft server properties\n';
    content += `# Last modified: ${new Date().toISOString()}\n\n`;

    for (const [key, value] of Object.entries(props)) {
        content += `${key}=${value}\n`;
    }

    fs.writeFileSync(filePath, content, 'utf8');
}

// Get server properties
app.get('/api/servers/:id/properties', (req, res) => {
    try {
        const { id } = req.params;
        const server = serverManager.getServer(id);

        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }

        const propsPath = path.resolve(__dirname, server.path, 'server.properties');
        const properties = parseProperties(propsPath);

        res.json({ properties });
    } catch (err) {
        console.error('Failed to read properties:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update server properties
app.put('/api/servers/:id/properties', (req, res) => {
    try {
        const { id } = req.params;
        const { properties } = req.body;
        const server = serverManager.getServer(id);

        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }

        const propsPath = path.resolve(__dirname, server.path, 'server.properties');
        writeProperties(propsPath, properties);

        res.json({ success: true, message: 'Properties updated' });
    } catch (err) {
        console.error('Failed to update properties:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- Whitelist Management APIs ---

// Get whitelist
app.get('/api/servers/:id/whitelist', (req, res) => {
    try {
        const { id } = req.params;
        const server = serverManager.getServer(id);

        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }

        const whitelistPath = path.resolve(__dirname, server.path, 'whitelist.json');
        let whitelist = [];

        if (fs.existsSync(whitelistPath)) {
            whitelist = JSON.parse(fs.readFileSync(whitelistPath, 'utf8'));
        }

        // Check if whitelist is enabled in properties
        const propsPath = path.resolve(__dirname, server.path, 'server.properties');
        const props = parseProperties(propsPath);
        const enabled = props['white-list'] === 'true';

        res.json({ whitelist, enabled });
    } catch (err) {
        console.error('Failed to read whitelist:', err);
        res.status(500).json({ error: err.message });
    }
});

// Add player to whitelist
app.post('/api/servers/:id/whitelist', async (req, res) => {
    try {
        const { id } = req.params;
        const { username } = req.body;
        const server = serverManager.getServer(id);

        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }

        // Lookup UUID from Mojang API
        const response = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`);
        if (!response.ok) {
            return res.status(404).json({ error: 'Player not found' });
        }

        const playerData = await response.json();
        const uuid = playerData.id;
        const name = playerData.name;

        // Format UUID with dashes
        const formattedUuid = uuid.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');

        const whitelistPath = path.resolve(__dirname, server.path, 'whitelist.json');
        let whitelist = [];

        if (fs.existsSync(whitelistPath)) {
            whitelist = JSON.parse(fs.readFileSync(whitelistPath, 'utf8'));
        }

        // Check if player already whitelisted
        if (whitelist.some(p => p.uuid === formattedUuid)) {
            return res.status(400).json({ error: 'Player already whitelisted' });
        }

        whitelist.push({ uuid: formattedUuid, name });
        fs.writeFileSync(whitelistPath, JSON.stringify(whitelist, null, 2));

        // Reload whitelist if server is running
        if (mc && mc.getStatus() === 'online') {
            mc.sendCommand('whitelist reload');
        }

        res.json({ success: true, player: { uuid: formattedUuid, name } });
    } catch (err) {
        console.error('Failed to add to whitelist:', err);
        res.status(500).json({ error: err.message });
    }
});

// Remove player from whitelist
app.delete('/api/servers/:id/whitelist/:username', (req, res) => {
    try {
        const { id, username } = req.params;
        const server = serverManager.getServer(id);

        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }

        const whitelistPath = path.resolve(__dirname, server.path, 'whitelist.json');

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

        // Reload whitelist if server is running
        if (mc && mc.getStatus() === 'online') {
            mc.sendCommand('whitelist reload');
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Failed to remove from whitelist:', err);
        res.status(500).json({ error: err.message });
    }
});

// Toggle whitelist enabled/disabled
app.put('/api/servers/:id/whitelist/toggle', (req, res) => {
    try {
        const { id } = req.params;
        const { enabled } = req.body;
        const server = serverManager.getServer(id);

        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }

        const propsPath = path.resolve(__dirname, server.path, 'server.properties');
        const props = parseProperties(propsPath);
        props['white-list'] = enabled ? 'true' : 'false';
        writeProperties(propsPath, props);

        // Execute whitelist on/off command if server is running
        if (mc && mc.getStatus() === 'online') {
            mc.sendCommand(`whitelist ${enabled ? 'on' : 'off'}`);
        }

        res.json({ success: true, enabled });
    } catch (err) {
        console.error('Failed to toggle whitelist:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- File Browser APIs ---

// Helper to validate and sanitize paths
function validatePath(basePath, requestedPath) {
    const fullPath = path.resolve(basePath, requestedPath || '.');

    // Ensure path is within base directory
    if (!fullPath.startsWith(basePath)) {
        throw new Error('Invalid path');
    }

    return fullPath;
}

// List directory contents
app.get('/api/servers/:id/files', (req, res) => {
    try {
        const { id } = req.params;
        const { path: requestedPath } = req.query;
        const server = serverManager.getServer(id);

        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }

        const serverPath = path.resolve(__dirname, server.path);
        const fullPath = validatePath(serverPath, requestedPath);

        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ error: 'Path not found' });
        }

        const stat = fs.statSync(fullPath);

        if (!stat.isDirectory()) {
            return res.status(400).json({ error: 'Path is not a directory' });
        }

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

// Read file content
app.get('/api/servers/:id/files/read', (req, res) => {
    try {
        const { id } = req.params;
        const { path: requestedPath } = req.query;
        const server = serverManager.getServer(id);

        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }

        const serverPath = path.resolve(__dirname, server.path);
        const fullPath = validatePath(serverPath, requestedPath);

        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            return res.status(400).json({ error: 'Path is a directory' });
        }

        // Limit file size for editing (1MB)
        if (stat.size > 1024 * 1024) {
            return res.status(400).json({ error: 'File too large to edit (max 1MB)' });
        }

        const content = fs.readFileSync(fullPath, 'utf8');

        res.json({ content, path: requestedPath });
    } catch (err) {
        console.error('Failed to read file:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update file content
app.put('/api/servers/:id/files/write', (req, res) => {
    try {
        const { id } = req.params;
        const { path: requestedPath, content } = req.body;
        const server = serverManager.getServer(id);

        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }

        const serverPath = path.resolve(__dirname, server.path);
        const fullPath = validatePath(serverPath, requestedPath);

        // Don't allow editing certain file types
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

// --- Phase 4: Advanced Features APIs ---

// 1. Metrics & Monitoring
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
            const history = metricsCollector.getRecentMetrics(15); // Last 15 minutes
            res.json(history);
        } else {
            res.json({ error: 'Metrics collector not initialized' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Enhanced Mod Manager (Search & Install)
app.get('/api/mods/search', async (req, res) => {
    try {
        const { query, version, loader } = req.query;
        if (!query) {
            return res.status(400).json({ error: 'Query required' });
        }

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
        const server = serverManager.getServer(id);

        if (!server) return res.status(404).json({ error: 'Server not found' });

        const modsDir = path.join(__dirname, server.path, 'mods');
        if (!fs.existsSync(modsDir)) {
            fs.mkdirSync(modsDir, { recursive: true });
        }

        const destPath = path.join(modsDir, filename);
        await modSearcher.downloadMod(url, destPath);

        res.json({ success: true, message: 'Mod installed' });
    } catch (err) {
        console.error('Mod install failed:', err);
        res.status(500).json({ error: err.message });
    }
});

// 3. Plugin System
app.get('/api/servers/:id/plugins', (req, res) => {
    try {
        const { id } = req.params;
        const server = serverManager.getServer(id);
        if (!server) return res.status(404).json({ error: 'Server not found' });

        const pm = new PluginManager(path.join(__dirname, server.path));
        const plugins = pm.listPlugins();
        res.json({ plugins });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/servers/:id/plugins/install', async (req, res) => {
    try {
        const { id } = req.params;
        const { url, filename } = req.body;
        const server = serverManager.getServer(id);
        if (!server) return res.status(404).json({ error: 'Server not found' });

        const pm = new PluginManager(path.join(__dirname, server.path));
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
        const server = serverManager.getServer(id);
        if (!server) return res.status(404).json({ error: 'Server not found' });

        const pm = new PluginManager(path.join(__dirname, server.path));
        const success = pm.togglePlugin(name, enabled);
        res.json({ success });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/servers/:id/plugins/:name', (req, res) => {
    try {
        const { id, name } = req.params;
        const server = serverManager.getServer(id);
        if (!server) return res.status(404).json({ error: 'Server not found' });

        const pm = new PluginManager(path.join(__dirname, server.path));
        // Need to handle extension (jar or jar.disabled)
        // Simple approach: try both or check via listPlugins
        // For now, assuming basic deletePlugin handles filename
        // But the API receives 'name' (without extension maybe?)
        // Let's assume the frontend sends the full filename or we find it

        // Better: frontend sends filename
        const filename = req.query.filename || name + '.jar';
        const success = pm.deletePlugin(filename);

        // Also try disabled one if first failed
        if (!success) {
            pm.deletePlugin(name + '.jar.disabled');
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Resource Usage Tracking
app.get('/api/servers/:id/resources', async (req, res) => {
    try {
        const { id } = req.params;
        const server = serverManager.getServer(id);
        if (!server) return res.status(404).json({ error: 'Server not found' });

        const tracker = new ResourceTracker(path.join(__dirname, server.path));
        const diskUsage = await tracker.getDiskUsage();
        const breakdown = tracker.getDirectoryBreakdown();

        res.json({ diskUsage, breakdown });
    } catch (err) {
        console.error('Resource tracking failed:', err);
        res.status(500).json({ error: err.message });
    }
});

app.use((req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Control Panel Server running on port ${PORT}`);
    console.log(`Minecraft Directory: ${SERVER_DIR}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`UNKNOWN ERROR: Port ${PORT} is already in use.`);
        console.error(`Please run 'kill -9 <PID>' on the process using port ${PORT} or change the port.`);
        process.exit(1);
    } else {
        console.error(err);
    }
});
