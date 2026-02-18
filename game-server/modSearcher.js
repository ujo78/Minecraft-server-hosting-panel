const fs = require('fs');
const path = require('path');
const https = require('https');

class ModSearcher {
    constructor() {
        // CurseForge requires API key, but we can use public endpoints for search
        this.curseforgeApiBase = 'https://api.curseforge.com/v1';
        this.modrinthApiBase = 'https://api.modrinth.com/v2';
    }

    /**
     * Search both CurseForge and Modrinth
     * @param {string} query - Search query
     * @param {string} mcVersion - Minecraft version (e.g., "1.20.1")
     * @param {string} modLoader - forge, fabric, etc.
     */
    async searchAll(query, mcVersion = null, modLoader = null) {
        const [curseforgeResults, modrinthResults] = await Promise.all([
            this.searchCurseForge(query, mcVersion, modLoader).catch(() => []),
            this.searchModrinth(query, mcVersion, modLoader).catch(() => [])
        ]);

        return {
            curseforge: curseforgeResults,
            modrinth: modrinthResults,
            total: curseforgeResults.length + modrinthResults.length
        };
    }

    /**
     * Search CurseForge (simplified without API key)
     */
    async searchCurseForge(query, mcVersion, modLoader) {
        // Note: Full CurseForge API requires API key
        // For demo, return placeholder or use public search
        return [];
    }

    /**
     * Search Modrinth
     */
    async searchModrinth(query, mcVersion, modLoader) {
        try {
            let url = `${this.modrinthApiBase}/search?query=${encodeURIComponent(query)}&limit=20`;

            // Add facets for filtering
            const facets = [];
            facets.push('["project_type:mod"]');

            if (modLoader) {
                facets.push(`["categories:${modLoader}"]`);
            }

            if (mcVersion) {
                facets.push(`["versions:${mcVersion}"]`);
            }

            if (facets.length > 0) {
                url += `&facets=[${facets.join(',')}]`;
            }

            const data = await this.fetchJSON(url);

            return (data.hits || []).map(mod => ({
                id: mod.project_id,
                slug: mod.slug,
                name: mod.title,
                description: mod.description,
                author: mod.author,
                downloads: mod.downloads,
                iconUrl: mod.icon_url,
                source: 'modrinth',
                url: `https://modrinth.com/mod/${mod.slug}`,
                categories: mod.categories || []
            }));
        } catch (err) {
            console.error('Modrinth search failed:', err.message);
            return [];
        }
    }

    /**
     * Download mod file
     * @param {string} downloadUrl - Direct download URL
     * @param {string} destinationPath - Where to save the file
     */
    async downloadMod(downloadUrl, destinationPath) {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(destinationPath);

            https.get(downloadUrl, (response) => {
                if (response.statusCode === 302 || response.statusCode === 301) {
                    // Follow redirect
                    return https.get(response.headers.location, (redirectResponse) => {
                        redirectResponse.pipe(file);
                        file.on('finish', () => {
                            file.close();
                            resolve(destinationPath);
                        });
                    }).on('error', reject);
                }

                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve(destinationPath);
                });
            }).on('error', (err) => {
                fs.unlink(destinationPath, () => { });
                reject(err);
            });
        });
    }

    /**
     * Get mod versions from Modrinth
     */
    async getModrinthVersions(projectId, mcVersion, modLoader) {
        try {
            let url = `${this.modrinthApiBase}/project/${projectId}/version`;
            const params = [];

            if (mcVersion) {
                params.push(`game_versions=["${mcVersion}"]`);
            }
            if (modLoader) {
                params.push(`loaders=["${modLoader}"]`);
            }

            if (params.length > 0) {
                url += '?' + params.join('&');
            }

            const versions = await this.fetchJSON(url);

            return versions.map(v => ({
                id: v.id,
                name: v.name,
                versionNumber: v.version_number,
                downloads: v.downloads,
                datePublished: v.date_published,
                files: v.files.map(f => ({
                    url: f.url,
                    filename: f.filename,
                    size: f.size,
                    primary: f.primary
                }))
            }));
        } catch (err) {
            console.error('Failed to get Modrinth versions:', err.message);
            return [];
        }
    }

    /**
     * List installed mods in a directory
     */
    listInstalledMods(modsDirectory) {
        if (!fs.existsSync(modsDirectory)) {
            return [];
        }

        const files = fs.readdirSync(modsDirectory);
        const mods = files
            .filter(file => file.endsWith('.jar'))
            .map(file => {
                const stats = fs.statSync(path.join(modsDirectory, file));
                return {
                    filename: file,
                    name: file.replace('.jar', ''),
                    size: stats.size,
                    modified: stats.mtime
                };
            });

        return mods;
    }

    /**
     * Delete a mod file
     */
    deleteMod(modsDirectory, filename) {
        const filePath = path.join(modsDirectory, filename);

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return true;
        }

        return false;
    }

    /**
     * Helper to fetch JSON from URL
     */
    fetchJSON(url) {
        return new Promise((resolve, reject) => {
            https.get(url, {
                headers: {
                    'User-Agent': 'MinecraftServerPanel/1.0'
                }
            }, (res) => {
                let data = '';

                res.on('data', chunk => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (err) {
                        reject(err);
                    }
                });
            }).on('error', reject);
        });
    }
}

module.exports = ModSearcher;
