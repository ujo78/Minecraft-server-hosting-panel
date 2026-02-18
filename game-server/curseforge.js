const https = require('https');

const API_KEY = '$2a$10$p/9qTcoJvw0EjurhyX0zyuGCYECaRkVeo0oo8jLb7edNSHEgtLHZ2'; // Public API key for testing, user should ideally provide their own
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
                console.log('CurseForge API Response Status:', res.statusCode);
                console.log('CurseForge API Response:', data.substring(0, 200)); // Log first 200 chars

                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    console.error('Failed to parse CurseForge response:', data);
                    reject(new Error(`API returned non-JSON response: ${data.substring(0, 100)}`));
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
