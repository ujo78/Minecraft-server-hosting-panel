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

const SERVER_DIR = path.join(__dirname, '..', 'stoneblock4');
const JAR_NAME = 'run.sh';

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

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Control Panel Server running on port ${PORT}`);
    console.log(`Minecraft Directory: ${SERVER_DIR}`);
});
