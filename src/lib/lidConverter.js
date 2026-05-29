// src/lib/lidConverter.js
class LidConverter {
    constructor() {
        this.cache = new Map();      
        this.mapping = new Map();          
        this.reverseMapping = new Map();       

        this.githubUrl = 'https://raw.githubusercontent.com/asuma-labs/database/refs/heads/main/userLinks-2.json';
        
        this.lastFetch = 0;
        this.fetchInterval = 60 * 60 * 1000;   
        this.cacheTimeout = 10 * 60 * 1000;  

        this.isFetching = false;
    }

    async fetchFromGitHub(force = false) {
        if (this.isFetching) return;
        if (!force && Date.now() - this.lastFetch < this.fetchInterval) return;

        this.isFetching = true;

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);

            const res = await fetch(this.githubUrl, {
                signal: controller.signal,
                headers: { 'User-Agent': 'AsumaBot/1.0' }
            });

            clearTimeout(timeout);

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();
            this.mapping.clear();
            this.reverseMapping.clear();

            for (const [key, value] of Object.entries(data || {})) {
                const lid = value.lid || key;
                const jid = value.jid;

                if (lid && jid) {
                    this.mapping.set(lid, jid);
                    this.reverseMapping.set(jid, lid);
                }
            }

            this.lastFetch = Date.now();
            console.log(`✅ LidConverter: Loaded ${this.mapping.size} mappings`);
        } catch (err) {
            console.error('❌ LidConverter fetch failed:', err.message);
        } finally {
            this.isFetching = false;
        }
    }

    async ensureLoaded() {
        if (this.mapping.size === 0 || Date.now() - this.lastFetch > this.fetchInterval) {
            await this.fetchFromGitHub();
        }
    }

    async lidToJid(lid) {
        if (!lid || typeof lid !== 'string') return lid;
        
        if (lid.endsWith('@s.whatsapp.net') || lid.endsWith('@g.us')) {
            return lid;
        }
        
        const cached = this.cache.get(lid);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.jid;
        }

        await this.ensureLoaded();

        let jid = this.mapping.get(lid);
        if (!jid && lid.endsWith('@lid')) {
            jid = this.mapping.get(lid.replace('@lid', ''));
        }
        if (!jid && global.db?.userLinks?.[lid]?.jid) {
            jid = global.db.userLinks[lid].jid;
        }

        if (jid) {
            this.cache.set(lid, { jid, timestamp: Date.now() });
        }

        return jid || lid;
    }

    async jidToLid(jid) {
        if (!jid || typeof jid !== 'string') return jid;
        
        if (jid.endsWith('@lid')) return jid;

        await this.ensureLoaded();

        let lid = this.reverseMapping.get(jid);

        if (!lid && jid.endsWith('@s.whatsapp.net')) {
            const number = jid.replace('@s.whatsapp.net', '');
            for (const [l, j] of this.mapping) {
                if (j.includes(number)) {
                    lid = l;
                    break;
                }
            }
        }

        if (!lid && global.db?.userLinks) {
            for (const [l, data] of Object.entries(global.db.userLinks)) {
                if (data.jid === jid) {
                    lid = l;
                    break;
                }
            }
        }

        return lid || jid;
    }

    async getPushName(lid) {
        await this.ensureLoaded();
        return global.db?.userLinks?.[lid]?.pushName || null;
    }

    async hasLid(lid) {
        if (!lid) return false;
        await this.ensureLoaded();
        try {
            if (this.mapping.has(lid)) return true;
            if (lid.endsWith('@lid')) {
                const withoutSuffix = lid.replace('@lid', '');
                if (this.mapping.has(withoutSuffix)) return true;
            }
            return false;
        } catch (err) {
            console.error('hasLid error:', err);
            return false;
        }
    }

    async batchToJid(ids) {
        await this.ensureLoaded();
        return Promise.all(ids.map(id => this.lidToJid(id)));
    }

    async batchToLid(ids) {
        await this.ensureLoaded();
        return Promise.all(ids.map(id => this.jidToLid(id)));
    }

    async refresh() {
        await this.fetchFromGitHub(true);
    }

    clearCache() {
        this.cache.clear();
    }
}

const lidConverter = new LidConverter();

export { lidConverter };
export default lidConverter;
