// src/plugins/owner/pluginManager.mjs
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

export default async function pluginManager(m, { args, reply, isOwner }) {
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
            const getIndex = parseInt(args[1], 10) - 1;
            if (isNaN(getIndex) || getIndex < 0 || getIndex >= plugins.length) return reply("❌ Nomor plugin tidak valid!");
            
            const content = fs.readFileSync(plugins[getIndex].fullPath, "utf-8");
            const maxLength = 4000;
            if (content.length > maxLength) {
                await reply(`📄 Isi plugin '${plugins[getIndex].relativePath}':\n\n${content.slice(0, maxLength)}\n\n... (file terlalu panjang, terpotong)`);
            } else {
                await reply(`📄 Isi plugin '${plugins[getIndex].relativePath}':\n\n${content}`);
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
