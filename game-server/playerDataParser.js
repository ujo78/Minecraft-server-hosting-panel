const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const nbt = require('nbt');

const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);
// Custom promisify to ensure we catch all errors and preserve context
const parseNbt = (data) => new Promise((resolve, reject) => {
    try {
        nbt.parse(data, (error, result) => {
            if (error) return reject(error);
            resolve(result);
        });
    } catch (err) {
        reject(err);
    }
});

class PlayerDataParser {
    constructor(serverDir) {
        this.serverDir = serverDir;
        this.worldDir = path.join(serverDir, 'world');
        this.statsDir = path.join(this.worldDir, 'stats');
        this.playerDataDir = path.join(this.worldDir, 'playerdata');
    }
    // ... (rest of methods)

    // ...

    async getPlayerNBTData(username) {
        try {
            const uuid = await this.getPlayerUUID(username);
            if (!uuid) return null;

            const playerFile = path.join(this.playerDataDir, `${uuid}.dat`);
            if (!fs.existsSync(playerFile)) return null;

            // Check file size - empty files cause crashes
            const stats = fs.statSync(playerFile);
            if (stats.size === 0) return null;

            const data = await readFile(playerFile);

            try {
                const parsed = await parseNbt(data);
                return this.parseNBT(parsed);
            } catch (parseErr) {
                console.error(`Error parsing NBT for ${username} (${uuid}):`, parseErr.message);
                return null; // Return null instead of crashing
            }
        } catch (err) {
            console.error('Error reading player NBT:', err);
            return null;
        }
    }

    parseNBT(nbtData) {
        try {
            const player = nbtData.value || {};

            const pos = player.Pos?.value || [];
            const dimension = player.Dimension?.value || 'minecraft:overworld';

            return {
                position: {
                    x: Math.floor(pos[0]?.value || 0),
                    y: Math.floor(pos[1]?.value || 0),
                    z: Math.floor(pos[2]?.value || 0),
                },
                dimension: dimension.replace('minecraft:', ''),
                health: player.Health?.value || 0,
                foodLevel: player.foodLevel?.value || 0,
                xpLevel: player.XpLevel?.value || 0,
                gameMode: player.playerGameType?.value || 0,
            };
        } catch (err) {
            console.error('Error parsing NBT:', err);
            return null;
        }
    }

    async getFTBData(username) {
        try {
            const uuid = await this.getPlayerUUID(username);
            if (!uuid) return null;

            const ftbTeamsDir = path.join(this.worldDir, 'data', 'ftbteams');
            if (!fs.existsSync(ftbTeamsDir)) return null;

            const playerTeamId = await this.getPlayerTeamId(uuid, ftbTeamsDir);
            if (!playerTeamId) {
                return {
                    inTeam: false,
                    teamName: null,
                    memberCount: 0,
                    members: [],
                };
            }

            const teamData = await this.getTeamData(playerTeamId, ftbTeamsDir);

            return {
                inTeam: true,
                teamId: playerTeamId,
                teamName: teamData?.name || 'Unknown Team',
                memberCount: teamData?.members?.length || 0,
                members: teamData?.members || [],
                isOwner: teamData?.owner === uuid,
            };
        } catch (err) {
            console.error('Error reading FTB data:', err);
            return null;
        }
    }

    async getPlayerTeamId(uuid, ftbTeamsDir) {
        try {
            const playerCacheFile = path.join(ftbTeamsDir, 'player_cache.snbt');
            if (fs.existsSync(playerCacheFile)) {
                const data = await readFile(playerCacheFile, 'utf8');
                const match = data.match(new RegExp(`${uuid}\\s*:\\s*"([^"]+)"`));
                if (match) return match[1];
            }

            const teamsDir = path.join(ftbTeamsDir, 'teams');
            if (!fs.existsSync(teamsDir)) return null;

            const teamFiles = await readdir(teamsDir);
            for (const file of teamFiles) {
                if (file.endsWith('.snbt')) {
                    const content = await readFile(path.join(teamsDir, file), 'utf8');
                    if (content.includes(uuid)) {
                        return file.replace('.snbt', '');
                    }
                }
            }

            return null;
        } catch (err) {
            console.error('Error finding player team:', err);
            return null;
        }
    }

    async getTeamData(teamId, ftbTeamsDir) {
        try {
            const teamFile = path.join(ftbTeamsDir, 'teams', `${teamId}.snbt`);
            if (!fs.existsSync(teamFile)) return null;

            const data = await readFile(teamFile, 'utf8');

            const nameMatch = data.match(/display_name:\s*"([^"]+)"/);
            const ownerMatch = data.match(/owner:\s*\[I;\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+)\]/);

            const members = [];
            const memberMatches = data.matchAll(/\[I;\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+)\]/g);
            for (const match of memberMatches) {
                const uuid = this.intArrayToUUID([
                    parseInt(match[1]),
                    parseInt(match[2]),
                    parseInt(match[3]),
                    parseInt(match[4])
                ]);
                members.push(uuid);
            }

            return {
                name: nameMatch ? nameMatch[1] : teamId,
                owner: ownerMatch ? this.intArrayToUUID([
                    parseInt(ownerMatch[1]),
                    parseInt(ownerMatch[2]),
                    parseInt(ownerMatch[3]),
                    parseInt(ownerMatch[4])
                ]) : null,
                members: members,
            };
        } catch (err) {
            console.error('Error reading team data:', err);
            return null;
        }
    }

    intArrayToUUID(intArray) {
        const hex = intArray.map(i => {
            const unsigned = i >>> 0;
            return unsigned.toString(16).padStart(8, '0');
        }).join('');

        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
    }

    async getEnhancedPlayerData(username) {
        const [stats, nbtData, ftbData] = await Promise.all([
            this.getPlayerStatistics(username),
            this.getPlayerNBTData(username),
            this.getFTBData(username),
        ]);

        return {
            username,
            statistics: stats,
            playerData: nbtData,
            ftb: ftbData,
        };
    }
}

module.exports = PlayerDataParser;
