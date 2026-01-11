const https = require('https');

const API_KEY = '$2a$10$bL4bIL5pMORNfc.VtNtROe.xGKofA/1qCofGy.t.M.V.x/7sg.y.q'; // Public API key for testing, user should ideally provide their own
const BASE_URL = 'https://api.curseforge.com/v1';

const getHeaders = (apiKey) => ({
    'x-api-key': apiKey || API_KEY,
    'Accept': 'application/json'
});

const fetchJson = (url, apiKey) => {
    return new Promise((resolve, reject) => {
        const req = https.get(url, { headers: getHeaders(apiKey) }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', reject);
    });
};

class CurseForge {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }

    async searchModpacks(query) {
        // gameId 432 is Minecraft
        // categoryId 4471 is Modpacks
        const url = `${BASE_URL}/mods/search?gameId=432&classId=4471&searchFilter=${encodeURIComponent(query)}&sortField=2&sortOrder=desc`;
        return fetchJson(url, this.apiKey);
    }

    async getModpackFiles(modId) {
        const url = `${BASE_URL}/mods/${modId}/files?pageSize=10`; // Get recent files
        return fetchJson(url, this.apiKey);
    }

    async getFile(modId, fileId) {
        const url = `${BASE_URL}/mods/${modId}/files/${fileId}`;
        return fetchJson(url, this.apiKey);
    }
}

module.exports = CurseForge;
