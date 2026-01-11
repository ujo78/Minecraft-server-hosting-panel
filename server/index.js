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
const serverManager = new ServerManager(path.join(__dirname, 'config.json'));

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
    SERVER_DIR = path.resolve(__dirname, activeServer.path);
    JAR_NAME = activeServer.jar;

    // We'll re-instantiate, but we need to handle the old listeners?
    // Actually, simple way: we just create a new one.
    // Ideally we should CLEANUP listeners from old 'mc' if we reuse variable
    // But index.js attaches listeners to 'mc' right after creation.
    // We should enable wrapping this logic.
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

const mc = new MinecraftHandler(JAR_NAME, SERVER_DIR);
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
    io.emit('status', status);
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




// --- Server Management & CurseForge APIs ---

const CurseForge = require('./curseforge');
const curseForge = new CurseForge(); // Uses default key

app.get('/api/servers', (req, res) => {
    const servers = serverManager.getServers();
    const active = serverManager.getActiveServer();
    res.json({ servers, activeId: active ? active.id : null });
});

app.post('/api/servers/switch', async (req, res) => {
    const { id } = req.body;

    if (mc.getStatus() !== 'offline') {
        return res.status(400).json({ error: 'Server must be offline to switch' });
    }

    if (serverManager.setActiveServer(id)) {
        reloadMinecraftHandler();

        // Create new instance
        // Remove old listeners? simple overwrite for now
        mc = new MinecraftHandler(path.join(SERVER_DIR, JAR_NAME), SERVER_DIR);
        setupMcListeners(mc);

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

app.get('/api/modpacks/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.json({ data: [] });
        const results = await curseForge.searchModpacks(q);
        res.json(results);
    } catch (err) {
        console.error("Search failed:", err);
        res.status(500).json({ error: 'Search failed' });
    }
});

app.post('/api/servers/install', async (req, res) => {
    try {
        const { id, name, fileId, modId, iconUrl } = req.body;

        // 1. Get download URL from CurseForge
        const fileData = await curseForge.getFile(modId, fileId);
        const downloadUrl = fileData.data.downloadUrl;

        if (!downloadUrl) {
            return res.status(400).json({ error: 'No download URL found for this file' });
        }

        // 2. Start installation (Async? For now we await it)
        await serverManager.installServer(id, name, downloadUrl, iconUrl);

        res.json({ success: true });
    } catch (err) {
        console.error("Install failed:", err);
        res.status(500).json({ error: err.message });
    }
});

app.use((req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Control Panel Server running on port ${PORT}`);
    console.log(`Minecraft Directory: ${SERVER_DIR}`);
});
