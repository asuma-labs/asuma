// src/plugins/owner/jadibot.js
import { jadibot, stopjadibot, listjadibot } from '../../clone/manager.js';

const handler = async (m, { reply, text, isOwner, command }) => {
    if (!isOwner) return reply('❌ Owner only!');
    
    switch (command) {
        case 'jadibot': {
            if (!text) return reply('❌ Masukkan nomor!\nContoh: .jadibot 628123456789');
            await jadibot(null, m, text);
            break;
        }
        
        case 'stopjadibot': {
            if (!text) return reply('❌ Masukkan nomor!\nContoh: .stopjadibot 628123456789');
            await stopjadibot(m, text);
            break;
        }
        
        case 'listjadibot': {
            await listjadibot(m);
            break;
        }
        
        default:
            break;
    }
};

handler.command = ["jadibot", "stopjadibot", "listjadibot"];
handler.owner = true;

export default handler;
