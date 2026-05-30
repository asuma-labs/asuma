const fs = require('fs');
const path = require('path');

const getPluginsDir = () => path.join(process.cwd(), 'src', 'plugins');

const getAllPluginFiles = (dir, fileList = []) => {
    if (!fs.existsSync(dir)) return fileList;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            getAllPluginFiles(fullPath, fileList);
        } else if (/\.(js|mjs|cjs)$/.test(entry.name)) {
            fileList.push({
                name: entry.name,
                relativePath: path.relative(getPluginsDir(), fullPath),
                fullPath: fullPath
            });
        }
    }
    return fileList;
};

const handler = async (m, { reply, isOwner, text, command, quoted }) => {
    if (!isOwner) return reply('❌ Owner only!');
    
    const plugins = getAllPluginFiles(getPluginsDir());
    const cmd = command.toLowerCase();
    
    if (cmd === 'listplugin' || cmd === 'listp' || cmd === 'listplugins') {
        if (plugins.length === 0) return reply('❌ Tidak ada file plugin');
        let teks = `📜 *DAFTAR PLUGIN*\n📦 Total: ${plugins.length} file\n\n`;
        plugins.forEach((p, i) => {
            teks += `${i + 1}. ${p.relativePath}\n`;
        });
        return reply(teks);
    }
    
    if (cmd === 'getp' || cmd === 'gp' || cmd === 'getplugin' || cmd === 'getplugins') {
        if (!text) return reply('❌ Masukkan nama file plugin!\nContoh: .getp general/ping.js');
        let target = text.toLowerCase().trim();
        const plugin = plugins.find(p => p.relativePath.toLowerCase() === target || p.name.toLowerCase() === target);
        if (!plugin) return reply(`❌ Plugin "${text}" tidak ditemukan!`);
        const content = fs.readFileSync(plugin.fullPath, 'utf-8');
        const maxLength = 4000;
        if (content.length > maxLength) {
            await reply(`📄 *${plugin.relativePath}*\n\n${content.slice(0, maxLength)}\n\n... (file terlalu panjang, terpotong)`);
        } else {
            await reply(`📄 *${plugin.relativePath}*\n\n${content}`);
        }
        return;
    }
    
    if (cmd === 'delp' || cmd === 'dp' || cmd === 'delplugin' || cmd === 'delplugins') {
        if (!text) return reply('❌ Masukkan nama file plugin!\nContoh: .delp general/ping.js');
        let target = text.toLowerCase().trim();
        const plugin = plugins.find(p => p.relativePath.toLowerCase() === target || p.name.toLowerCase() === target);
        if (!plugin) return reply(`❌ Plugin "${text}" tidak ditemukan!`);
        fs.unlinkSync(plugin.fullPath);
        const parentDir = path.dirname(plugin.fullPath);
        if (fs.readdirSync(parentDir).length === 0) {
            fs.rmdirSync(parentDir);
        }
        if (global.clearPluginCache) global.clearPluginCache();
        return reply(`✅ Plugin *${plugin.relativePath}* berhasil dihapus!`);
    }
    
    if (cmd === 'addp' || cmd === 'addplugin' || cmd === 'addplugins' || cmd === 'saveplugin' || cmd === 'saveplugins' || cmd === 'svp' || cmd === 'sp') {
        const quotedMessage = m.quoted;
        if (!text || !quotedMessage || !quotedMessage.text) {
            return reply(`📝 Cara penggunaan:\nReply kode plugin dengan command ${command} path/ke/plugin.js\n\nContoh: ${command} tools/get.js lalu reply pesan berisi kode plugin`);
        }
        
        let filePath = text.trim();
        const validExt = ['.js', '.mjs', '.cjs'];
        let ext = path.extname(filePath);
        if (!validExt.includes(ext)) {
            filePath += '.js';
            ext = '.js';
        }
        
        if (filePath.includes('..')) {
            return reply('❌ Path tidak valid! Tidak boleh menggunakan ".."');
        }
        
        const fullPath = path.join(getPluginsDir(), filePath);
        const dirName = path.dirname(fullPath);
        
        if (!fs.existsSync(dirName)) {
            fs.mkdirSync(dirName, { recursive: true });
        }
        
        if (fs.existsSync(fullPath)) {
            return reply(`⚠️ Plugin ${filePath} sudah ada! Hapus dulu atau gunakan nama lain.`);
        }
        
        const pluginCode = quotedMessage.text;
        fs.writeFileSync(fullPath, pluginCode);
        
        if (global.clearPluginCache) {
            global.clearPluginCache();
        }
        
        return reply(`✅ Berhasil menambah plugin *${filePath}*`);
    }
    
    reply(`❌ Command tidak dikenal!\n\n📋 Command yang tersedia:\n.addplugin <path> - Tambah plugin\n.listplugin - Lihat semua plugin\n.getplugin <path> - Lihat isi plugin\n.delplugin <path> - Hapus plugin`);
};

handler.command = [
    "listplugin", "listp", "listplugins",
    "getp", "gp", "getplugin", "getplugins",
    "delp", "dp", "delplugin", "delplugins",
    "addp", "addplugin", "addplugins", "saveplugin", "saveplugins", "svp", "sp"
];
handler.owner = true;

module.exports = handler;
