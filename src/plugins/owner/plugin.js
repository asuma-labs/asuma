// src/plugins/owner/plugin.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginBaseDir = path.join(__dirname, "..");

const getAllPluginFiles = (dir, fileList = []) => {
    if (!fs.existsSync(dir)) return fileList;
    
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            getAllPluginFiles(filePath, fileList);
        } else if (file.endsWith(".js") || file.endsWith(".mjs") || file.endsWith(".cjs")) {
            if (!file.includes("pluginManager")) {
                fileList.push({ 
                    fullPath: filePath, 
                    relativePath: path.relative(pluginBaseDir, filePath) 
                });
            }
        }
    }
    return fileList;
};

const ensureDirectoryExists = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

export default async function pluginManager(m, { args, reply, isOwner, Ditss }) {
    if (!isOwner) return reply("❌ Owner only!");
    
    const sub = args[0]?.toLowerCase();
    
    if (!sub) return reply(`Usage:
.plugin list
.plugin get <nomor>
.plugin del <nomor>
.plugin reload`);
    
    const plugins = getAllPluginFiles(pluginBaseDir);
    
    switch(sub) {
        case "list":
            if (plugins.length === 0) return reply("❌ Tidak ada plugin!");
            let listText = "📜 Daftar plugin:\n";
            plugins.forEach((p, i) => {
                listText += `${i + 1}. ${p.relativePath}\n`;
            });
            reply(listText);
            break;
        
case "get":
    if (!args[1]) return reply("Usage: .plugin get <nomor>");
    const nomor = parseInt(args[1].trim(), 10);
    if (isNaN(nomor) || nomor < 1 || nomor > plugins.length) {
        return reply(`❌ Nomor tidak valid! Masukkan angka 1-${plugins.length}`);
    }
    const getIndex = nomor - 1;
    const selectedPlugin = plugins[getIndex];
    
    if (!selectedPlugin || !fs.existsSync(selectedPlugin.fullPath)) {
        return reply("❌ File plugin tidak ditemukan!");
    }
    
    const content = fs.readFileSync(selectedPlugin.fullPath, "utf-8");
    const ext = path.extname(selectedPlugin.fullPath);
    let language = 'javascript';
    if (ext === '.cjs') language = 'javascript';
    if (ext === '.mjs') language = 'javascript';
    if (ext === '.json') language = 'json';
    if (ext === '.py') language = 'python';
    if (ext === '.md') language = 'markdown';
    
    if (Ditss.sendRichCodeMessage) {
        await Ditss.sendRichCodeMessage(m.chat, content, language, {
            header: `📄 ${selectedPlugin.relativePath}`,
            footer: `📁 Path: ${selectedPlugin.fullPath} | 📦 Size: ${(content.length / 1024).toFixed(2)} KB`,
            quoted: m
        });
    } else {
        const maxLength = 4000;
        const header = `📄 Isi plugin '${selectedPlugin.relativePath}':\n\n`;
        if (content.length > maxLength) {
            await reply(header + content.slice(0, maxLength) + "\n\n... (file terlalu panjang, terpotong)");
        } else {
            await reply(header + content);
        }
    }
    break;
        
        case "del":
            if (!args[1]) return reply("Usage: .plugin del <nomor>");
            const delIndex = parseInt(args[1], 10) - 1;
            if (isNaN(delIndex) || delIndex < 0 || delIndex >= plugins.length) return reply("❌ Nomor plugin tidak valid!");
            
            const delPlugin = plugins[delIndex];
            fs.unlinkSync(delPlugin.fullPath);
            
            const parentDir = path.dirname(delPlugin.fullPath);
            if (fs.readdirSync(parentDir).length === 0) {
                fs.rmdirSync(parentDir);
            }
            
            reply(`✅ Plugin '${delPlugin.relativePath}' berhasil dihapus!`);
            break;
        
        case "reload":
            if (global.clearPluginCache) {
                global.clearPluginCache();
                reply("✅ Plugin cache berhasil di-reload!");
            } else {
                reply("❌ Fungsi clearPluginCache tidak tersedia.");
            }
            break;
        
        default:
            reply(`Unknown action. Commands: list, get, del, reload`);
            break;
    }
}

pluginManager.command = ["plugin"];
pluginManager.owner = true;
