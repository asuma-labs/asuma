// src/lib/handle.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

let pluginCache = null;
let lastLoadTime = 0;
const CACHE_TTL = 5000;

const getPluginsDir = () => path.join(__dirname, '../plugins');

const getAllPluginFiles = (dir) => {
    const files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
            files.push(...getAllPluginFiles(fullPath));
        } else if (/\.(js|mjs|cjs)$/.test(entry.name)) {
            files.push(fullPath);
        }
    }
    return files;
};

const loadPlugin = async (filePath) => {
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath);

    try {
        if (ext === '.cjs') {
            const resolved = require.resolve(filePath);
            if (require.cache[resolved]) delete require.cache[resolved];
            return require(filePath);
        }

        // ESM (.mjs or .js)
        const importPath = pathToFileURL(filePath).href + `?t=${Date.now()}`;
        const imported = await import(importPath);
        return imported.default || imported;
    } catch (error) {
        console.error(`[Plugin] Failed to load ${fileName}:`, error.message);
        return null;
    }
};

const loadAllPlugins = async (force = false) => {
    const now = Date.now();
    if (!force && pluginCache && (now - lastLoadTime) < CACHE_TTL) {
        return pluginCache;
    }

    const pluginsDir = getPluginsDir();
    if (!fs.existsSync(pluginsDir)) {
        pluginCache = [];
        lastLoadTime = now;
        return [];
    }

    const files = getAllPluginFiles(pluginsDir);
    const plugins = [];

    for (const filePath of files) {
        const plugin = await loadPlugin(filePath);
        if (!plugin) continue;

        const isValid = typeof plugin === 'function' && 
                       plugin.command && 
                       (Array.isArray(plugin.command) || plugin.command instanceof RegExp);

        if (isValid) {
            plugins.push(plugin);
        }
    }

    pluginCache = plugins;
    lastLoadTime = now;
    return plugins;
};

export const clearPluginCache = () => {
    pluginCache = null;
    lastLoadTime = 0;
};

export const handleMessage = async (message, commandText, context) => {
    const plugins = await loadAllPlugins();

    if (!plugins.length) return;

    for (const plugin of plugins) {
        let match = false;

        if (plugin.command instanceof RegExp) {
            match = plugin.command.test(commandText);
        } else if (Array.isArray(plugin.command)) {
            match = plugin.command.some(cmd => 
                cmd.toLowerCase() === commandText.toLowerCase()
            );
        }

        if (!match) continue;
        if (plugin.owner && !context.isOwn) {
            context.reply?.('❌ Owner only!');
            return;
        }
        if (plugin.premium && !context.isPrem) {
            context.reply?.('❌ Premium only!');
            return;
        }
        if (plugin.group && !context.isGroup) {
            context.reply?.('❌ Group only!');
            return;
        }
        if (plugin.private && !context.isPrivate) {
            context.reply?.('❌ Private only!');
            return;
        }

        try {
            await plugin(message, context);
        } catch (error) {
            console.error(`[Plugin Error] ${plugin.command?.[0] || 'unknown'}:`, error);
            context.reply?.('❌ Error saat menjalankan command!');
        }
        return;
    }
};

export default handleMessage;
