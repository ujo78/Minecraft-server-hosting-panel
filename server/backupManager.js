const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const extract = require('extract-zip');

class BackupManager {
    constructor(backupsDir = path.join(__dirname, '../backups')) {
        this.backupsDir = backupsDir;

        // Ensure backups directory exists
        if (!fs.existsSync(this.backupsDir)) {
            fs.mkdirSync(this.backupsDir, { recursive: true });
        }
    }

    /**
     * Create a backup of a server
     * @param {string} serverId - Server ID
     * @param {string} serverPath - Absolute path to server directory
     * @param {string} name - Optional backup name
     * @returns {Promise<Object>} Backup metadata
     */
    async createBackup(serverId, serverPath, name = null) {
        return new Promise((resolve, reject) => {
            try {
                const timestamp = Date.now();
                const backupName = name || `backup-${timestamp}`;
                const serverBackupDir = path.join(this.backupsDir, serverId);

                // Create server backup directory if doesn't exist
                if (!fs.existsSync(serverBackupDir)) {
                    fs.mkdirSync(serverBackupDir, { recursive: true });
                }

                const backupFilePath = path.join(serverBackupDir, `${backupName}.zip`);
                const output = fs.createWriteStream(backupFilePath);
                const archive = archiver('zip', {
                    zlib: { level: 9 } // Maximum compression
                });

                output.on('close', () => {
                    const stats = fs.statSync(backupFilePath);
                    resolve({
                        id: `${backupName}`,
                        name: backupName,
                        date: new Date(timestamp).toISOString(),
                        size: stats.size,
                        path: backupFilePath
                    });
                });

                archive.on('error', (err) => {
                    reject(err);
                });

                archive.pipe(output);

                // Add server directory to archive, excluding certain patterns
                archive.glob('**/*', {
                    cwd: serverPath,
                    ignore: [
                        'logs/**',           // Exclude logs
                        '*.log',             // Exclude log files
                        'crash-reports/**',  // Exclude crash reports
                        'cache/**'           // Exclude cache
                    ]
                });

                archive.finalize();
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * List all backups for a server
     * @param {string} serverId - Server ID
     * @returns {Array} Array of backup metadata
     */
    listBackups(serverId) {
        const serverBackupDir = path.join(this.backupsDir, serverId);

        if (!fs.existsSync(serverBackupDir)) {
            return [];
        }

        const files = fs.readdirSync(serverBackupDir);
        const backups = files
            .filter(file => file.endsWith('.zip'))
            .map(file => {
                const filePath = path.join(serverBackupDir, file);
                const stats = fs.statSync(filePath);
                const name = file.replace('.zip', '');

                return {
                    id: name,
                    name: name,
                    date: stats.mtime.toISOString(),
                    size: stats.size,
                    path: filePath
                };
            })
            .sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by date, newest first

        return backups;
    }

    /**
     * Get backup file path
     * @param {string} serverId - Server ID
     * @param {string} backupId - Backup ID
     * @returns {string|null} Full path to backup file or null if not found
     */
    getBackupPath(serverId, backupId) {
        const backupPath = path.join(this.backupsDir, serverId, `${backupId}.zip`);
        return fs.existsSync(backupPath) ? backupPath : null;
    }

    /**
     * Restore a backup
     * @param {string} serverId - Server ID
     * @param {string} backupId - Backup ID
     * @param {string} serverPath - Absolute path to server directory
     * @param {boolean} clearExisting - Whether to clear existing files first
     * @returns {Promise<boolean>} Success status
     */
    async restoreBackup(serverId, backupId, serverPath, clearExisting = true) {
        const backupPath = this.getBackupPath(serverId, backupId);

        if (!backupPath) {
            throw new Error('Backup not found');
        }

        try {
            // Clear existing files if requested (except certain critical files)
            if (clearExisting && fs.existsSync(serverPath)) {
                const preserveFiles = ['eula.txt']; // Files to preserve
                const files = fs.readdirSync(serverPath);

                for (const file of files) {
                    if (!preserveFiles.includes(file)) {
                        const filePath = path.join(serverPath, file);
                        const stat = fs.statSync(filePath);

                        if (stat.isDirectory()) {
                            fs.rmSync(filePath, { recursive: true, force: true });
                        } else {
                            fs.unlinkSync(filePath);
                        }
                    }
                }
            }

            // Extract backup
            await extract(backupPath, { dir: serverPath });

            return true;
        } catch (err) {
            throw new Error(`Restore failed: ${err.message}`);
        }
    }

    /**
     * Delete a backup
     * @param {string} serverId - Server ID
     * @param {string} backupId - Backup ID
     * @returns {boolean} Success status
     */
    deleteBackup(serverId, backupId) {
        const backupPath = this.getBackupPath(serverId, backupId);

        if (!backupPath) {
            return false;
        }

        try {
            fs.unlinkSync(backupPath);
            return true;
        } catch (err) {
            console.error('Failed to delete backup:', err);
            return false;
        }
    }

    /**
     * Get backup statistics for a server
     * @param {string} serverId - Server ID
     * @returns {Object} Stats with total backups and total size
     */
    getBackupStats(serverId) {
        const backups = this.listBackups(serverId);
        const totalSize = backups.reduce((sum, backup) => sum + backup.size, 0);

        return {
            totalBackups: backups.length,
            totalSize: totalSize,
            totalSizeFormatted: this.formatBytes(totalSize)
        };
    }

    /**
     * Format bytes to human-readable string
     * @param {number} bytes - Bytes
     * @returns {string} Formatted string
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }
}

module.exports = BackupManager;
