const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const nbt = require('nbt');

const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);
const parseNbt = promisify(nbt.parse);

class PlayerDataParser {
    constructor(serverDir) {
        this.serverDir = serverDir;
        this.worldDir = path.join(serverDir, 'world');
        this.statsDir = path.join(this.worldDir, 'stats');
        this.playerDataDir = path.join(this.worldDir, 'playerdata');
    }

    async getPlayerUUID(username) {
        try {
            const userCachePath = path.join(this.serverDir, 'usercache.json');
            if (!fs.existsSync(userCachePath)) return null;

            const cache = JSON.parse(await readFile(userCachePath, 'utf8'));
            const player = cache.find(p => p.name.toLowerCase() === username.toLowerCase());
            return player ? player.uuid : null;
        } catch (err) {
            console.error('Error reading usercache:', err);
            return null;
        }
    }

    async getPlayerStatistics(username) {
        try {
            const uuid = await this.getPlayerUUID(username);
            if (!uuid) return null;

            const statsFile = path.join(this.statsDir, `${uuid}.json`);
            if (!fs.existsSync(statsFile)) return null;

            const stats = JSON.parse(await readFile(statsFile, 'utf8'));
            return this.parseStats(stats);
        } catch (err) {
            console.error('Error reading player stats:', err);
            return null;
        }
    }

    parseStats(rawStats) {
        const stats = rawStats.stats || {};

        return {
            deaths: stats['minecraft:custom']?.['minecraft:deaths'] || 0,
            playTime: stats['minecraft:custom']?.['minecraft:play_time'] || 0,
            timeSinceDeath: stats['minecraft:custom']?.['minecraft:time_since_death'] || 0,
            mobKills: stats['minecraft:custom']?.['minecraft:mob_kills'] || 0,
            playerKills: stats['minecraft:custom']?.['minecraft:player_kills'] || 0,
            damageDealt: stats['minecraft:custom']?.['minecraft:damage_dealt'] || 0,
            damageTaken: stats['minecraft:custom']?.['minecraft:damage_taken'] || 0,
            jumps: stats['minecraft:custom']?.['minecraft:jump'] || 0,
            distanceWalked: stats['minecraft:custom']?.['minecraft:walk_one_cm'] || 0,
            distanceFlown: stats['minecraft:custom']?.['minecraft:fly_one_cm'] || 0,
        };
    }

    async getPlayerNBTData(username) {
        try {
            const uuid = await this.getPlayerUUID(username);
            if (!uuid) return null;

            const playerFile = path.join(this.playerDataDir, `${uuid}.dat`);
            if (!fs.existsSync(playerFile)) return null;

            const data = await readFile(playerFile);
            const parsed = await parseNbt(data);

            return this.parseNBT(parsed);
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
