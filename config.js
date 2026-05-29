import fs from 'fs';
import axios from 'axios';
import { fileURLToPath } from 'url';

export const config = {
    prefa: ['!', '.', ',', '🐤', '🗿'],
    owner: ['6285162822778', '447920601019'],
    thumbnail: "https://raw.githubusercontent.com/WJayadana/WJayadana/refs/heads/main/Thumbnail.png",
    name: "Asuma Bot",
    version: "1.0",
    
    // API Fetcher Asuma
    fetchApi: async function(endpoint, options = {}) {
        try {
            const defaultBaseURL = 'https://apii.asuma.my.id';
            const { method = 'GET', params = null, headers = {}, responseType = 'json' } = options;

            const defaultHeaders = { 
                'User-Agent': 'Mozilla/5.0 (compatible; AsumaBot/1.0; +https://www.asuma.my.id)' 
            };

            let url;
            if (endpoint.startsWith('/')) {
                url = `${defaultBaseURL}${endpoint}`;
            } else if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
                url = endpoint;
            } else {
                url = `${defaultBaseURL}/${endpoint}`;
            }

            const response = await axios({ 
                method, 
                url, 
                headers: { ...defaultHeaders, ...headers }, 
                params, 
                responseType, 
                timeout: 100000 
            });
            
            return response.data;
        } catch (error) {
            if (error.response) {
                throw { 
                    status: error.response.status, 
                    message: error.response.data?.error || error.response.statusText, 
                    data: error.response.data 
                };
            }
            if (error.request) {
                throw { 
                    status: 503, 
                    message: 'Service unavailable', 
                    error: error.message 
                };
            }
            throw { 
                status: 500, 
                message: error.message 
            };
        }
    }
};

export const init = {
    session: "./session",
    customPair: "ASUMA"
};

const __filename = fileURLToPath(import.meta.url);

// Optional: Auto-reload on file changes (for development)
fs.watchFile(__filename, () => {
    fs.unwatchFile(__filename);
    console.log('\x1b[0;32m' + __filename + ' \x1b[1;32mupdated!\x1b[0m');
});
