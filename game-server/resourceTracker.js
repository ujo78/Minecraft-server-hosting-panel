const fs = require('fs');
const path = require('path');
const disk = require('diskusage');

class ResourceTracker {
    constructor(serverPath) {
        this.serverPath = serverPath;
    }

    /**
     * Get disk usage statistics
     * @returns {Promise<Object>} Disk usage data
     */
    async getDiskUsage() {
        try {
            // Get disk info for the drive containing the server
            const info = await disk.check(this.serverPath);

            // Calculate size of server directory recursively
            const serverSize = this.getDirectorySize(this.serverPath);

            return {
                total: info.total,
                free: info.free,
                used: info.total - info.free,
                serverSize: serverSize,
                percent: Math.round(((info.total - info.free) / info.total) * 100)
            };
        } catch (err) {
            console.error('Failed to get disk usage:', err);
            return null;
        }
    }

    /**
     * Get breakdown of server directory sizes
     * @returns {Object} Sizes of specific subdirectories
     */
    getDirectoryBreakdown() {
        const breakdown = {
            world: 0,
            mods: 0,
            plugins: 0,
            logs: 0,
            backups: 0,
            other: 0,
            total: 0
        };

        if (!fs.existsSync(this.serverPath)) {
            return breakdown;
        }

        const items = fs.readdirSync(this.serverPath);
        let totalSize = 0;

        for (const item of items) {
            const fullPath = path.join(this.serverPath, item);
            const size = this.getDirectorySize(fullPath);
            totalSize += size;

            if (item === 'world' || item.startsWith('world_')) {
                breakdown.world += size;
            } else if (item === 'mods') {
                breakdown.mods += size;
            } else if (item === 'plugins') {
                breakdown.plugins += size;
            } else if (item === 'logs') {
                breakdown.logs += size;
            } else if (item === 'backups') { // If backups are stored inside server dir
                breakdown.backups += size;
            } else {
                breakdown.other += size;
            }
        }

        breakdown.total = totalSize;
        return breakdown;
    }

    /**
     * Calculate size of directory recursively
     * @param {string} dirPath - Directory path
     * @returns {number} Size in bytes
     */
    getDirectorySize(dirPath) {
        let size = 0;

        try {
            const stat = fs.statSync(dirPath);

            if (stat.isFile()) {
                return stat.size;
            }

            if (stat.isDirectory()) {
                const files = fs.readdirSync(dirPath);
                for (const file of files) {
                    size += this.getDirectorySize(path.join(dirPath, file));
                }
            }
        } catch (err) {
            // Ignore errors (e.g. permission denied, file moved)
        }

        return size;
    }
}

module.exports = ResourceTracker;
