// src/plugins/general/info.js
import os from 'os';

const handler = async (m, { Ditss, reply }) => {
    const used = process.memoryUsage();
    const cpus = os.cpus();
    const cpu = cpus[0]?.model || 'Unknown';
    const uptime = process.uptime();
    
    const runtime = (seconds) => {
        seconds = Number(seconds);
        const d = Math.floor(seconds / (3600 * 24));
        const h = Math.floor((seconds % (3600 * 24)) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const dDisplay = d > 0 ? d + (d === 1 ? " day, " : " days, ") : "";
        const hDisplay = h > 0 ? h + (h === 1 ? " hour, " : " hours, ") : "";
        const mDisplay = m > 0 ? m + (m === 1 ? " minute, " : " minutes, ") : "";
        const sDisplay = s > 0 ? s + (s === 1 ? " second" : " seconds") : "";
        return dDisplay + hDisplay + mDisplay + sDisplay;
    };

    let teks = `🌟 *ASUMA MD - BOT INFO* 🌟\n\n`;
    teks += `📅 *OS*: ${os.type()} ${os.release()}\n`;
    teks += `💻 *CPU*: ${cpu}\n`;
    teks += `📂 *RAM Used*: ${(used.rss / 1024 / 1024).toFixed(2)} MB\n`;
    teks += `⏳ *Uptime*: ${runtime(uptime)}\n`;
    teks += `📡 *Platform*: ${os.platform()}\n`;
    teks += `💾 *Total RAM*: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB\n`;
    teks += `🚀 *Node Version*: ${process.version}\n`;
    teks += `🤖 *Bun Version*: ${process.isBun ? 'Yes' : 'No'}\n\n`;
    teks += `*Asuma MD v1.0 • ESM Powered*`;
    
    await reply(teks);
};

handler.command = ["info", "botinfo", "status"];
handler.owner = false;
handler.premium = false;
handler.group = false;
handler.private = false;

export default handler;
