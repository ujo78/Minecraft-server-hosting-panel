const fs = require('fs');
const path = require('path');
const https = require('https');

class PluginManager {
    constructor(serverPath) {
        this.serverPath = serverPath;
        this.pluginsDir = path.join(serverPath, 'plugins');

        if (!fs.existsSync(this.pluginsDir)) {
            try {
                fs.mkdirSync(this.pluginsDir, { recursive: true });
            } catch (err) {
                // Ignore if can't create (e.g. invalid path for non-plugin servers)
            }
        }
    }

    /**
     * List installed plugins
     * @returns {Array} List of plugin objects
     */
    listPlugins() {
        if (!fs.existsSync(this.pluginsDir)) {
            return [];
        }

        const files = fs.readdirSync(this.pluginsDir);
        const plugins = [];

        for (const file of files) {
            if (file.endsWith('.jar') || file.endsWith('.jar.disabled')) {
                const fullPath = path.join(this.pluginsDir, file);
                const stats = fs.statSync(fullPath);

                const isEnabled = file.endsWith('.jar');
                const name = isEnabled ? file.replace('.jar', '') : file.replace('.jar.disabled', '');

                plugins.push({
                    name: name,
                    filename: file,
                    enabled: isEnabled,
                    size: stats.size,
                    modified: stats.mtime
                });
            }
        }

        return plugins;
    }

    /**
     * Install plugin from URL
     * @param {string} downloadUrl - URL to download
     * @param {string} filename - Target filename
     * @returns {Promise<boolean>} Success status
     */
    async installPlugin(downloadUrl, filename) {
        if (!filename.endsWith('.jar')) {
            filename += '.jar';
        }

        const destPath = path.join(this.pluginsDir, filename);

        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(destPath);

            https.get(downloadUrl, (response) => {
                if (response.statusCode === 302 || response.statusCode === 301) {
                    // Follow redirect
                    https.get(response.headers.location, (redirectResponse) => {
                        redirectResponse.pipe(file);
                        file.on('finish', () => {
                            file.close();
                            resolve(true);
                        });
                    }).on('error', reject);
                    return;
                }

                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve(true);
                });
            }).on('error', (err) => {
                fs.unlink(destPath, () => { });
                reject(err);
            });
        });
    }

    /**
     * Toggle plugin state (enable/disable)
     * @param {string} pluginName - Name of plugin
     * @param {boolean} enabled - Desired state
     * @returns {boolean} Success status
     */
    togglePlugin(pluginName, enabled) {
        const enabledName = pluginName + '.jar';
        const disabledName = pluginName + '.jar.disabled';

        const enabledPath = path.join(this.pluginsDir, enabledName);
        const disabledPath = path.join(this.pluginsDir, disabledName);

        try {
            if (enabled) {
                if (fs.existsSync(disabledPath)) {
                    fs.renameSync(disabledPath, enabledPath);
                    return true;
                }
            } else {
                if (fs.existsSync(enabledPath)) {
                    fs.renameSync(enabledPath, disabledPath);
                    return true;
                }
            }
            return false;
        } catch (err) {
            console.error('Failed to toggle plugin:', err);
            return false;
        }
    }

    /**
     * Delete a plugin
     * @param {string} filename - Filename to delete
     * @returns {boolean} Success status
     */
    deletePlugin(filename) {
        const filePath = path.join(this.pluginsDir, filename);
        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
                return true;
            } catch (err) {
                return false;
            }
        }
        return false;
    }

    /**
     * Get list of config files for a plugin
     * @param {string} pluginName - Name of plugin
     * @returns {Array} List of config files
     */
    getPluginConfigs(pluginName) {
        const configDir = path.join(this.pluginsDir, pluginName);
        if (!fs.existsSync(configDir) || !fs.statSync(configDir).isDirectory()) {
            return [];
        }

        return fs.readdirSync(configDir)
            .filter(f => f.endsWith('.yml') || f.endsWith('.json') || f.endsWith('.properties'));
    }
}

module.exports = PluginManager;
