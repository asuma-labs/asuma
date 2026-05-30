import os from 'os';

const handler = async (m, { Ditss, reply }) => {
    const used = process.memoryUsage();
    const cpus = os.cpus();
    const cpu = cpus[0]?.model || 'Unknown';
    const uptime = process.uptime();
    
    const runtime = (seconds) => {
        const d = Math.floor(seconds / (3600 * 24));
        const h = Math.floor((seconds % (3600 * 24)) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${d > 0 ? d + 'd ' : ''}${h > 0 ? h + 'h ' : ''}${m > 0 ? m + 'm ' : ''}${s}s`;
    };

    let teks = `📊 *BOT STATUS*\n\n`;
    teks += `💻 *CPU*: ${cpu}\n`;
    teks += `📂 *RAM*: ${(used.rss / 1024 / 1024).toFixed(2)} MB / ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB\n`;
    teks += `⏳ *Uptime*: ${runtime(uptime)}\n`;
    teks += `🤖 *Mode*: ${Ditss.public ? 'Public' : 'Self'}\n`;
    teks += `📱 *Platform*: ${os.platform()} ${os.release()}`;
    
    reply(teks);
};

handler.command = ["status", "botstatus"];
export default handler;
