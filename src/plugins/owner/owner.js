// src/plugins/owner/owner.js
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';

const handler = async (m, { Ditss, text, isOwner, command, reply }) => {
    if (!isOwner) return reply('❌ Owner only!');
    
    switch (command) {
        case 'restart': {
            await reply('🔄 Restarting bot...');
            setTimeout(() => {
                process.exit(0);
            }, 2000);
        }
        break;
        
        case 'setpref': {
            if (!text) return reply('❌ Masukkan prefix baru!\nContoh: .setpref !');
            
            try {
                const configPath = path.join(process.cwd(), 'config.js');
                let configContent = fs.readFileSync(configPath, 'utf-8');
                
                const newPrefix = text.split(' ')[0];
                configContent = configContent.replace(
                    /prefa: \[[^\]]*\]/,
                    `prefa: ['${newPrefix}']`
                );
                
                fs.writeFileSync(configPath, configContent);
                reply(`✅ Prefix berhasil diubah ke: ${newPrefix}\n📌 Restart bot agar perubahan berlaku.`);
            } catch (err) {
                reply(`❌ Gagal mengubah prefix: ${err.message}`);
            }
        }
        break;
        
        case 'bc':
        case 'broadcast': {
            if (!text) return reply('❌ Teks broadcast-nya mana?');
            
            await reply(`📢 Mengirim broadcast ke semua grup...`);
            
            try {
                const groups = await Ditss.groupFetchAllParticipating();
                const groupList = Object.values(groups);
                let success = 0;
                let failed = 0;
                
                for (let group of groupList) {
                    try {
                        await Ditss.sendMessage(group.id, { 
                            text: `📢 *BROADCAST FROM OWNER*\n\n${text}\n\n_⚠️ This is an automated broadcast message_'`
                        });
                        success++;
                    } catch {
                        failed++;
                    }
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
                reply(`✅ Broadcast selesai!\n📨 Terkirim: ${success} grup\n❌ Gagal: ${failed} grup`);
            } catch (err) {
                reply(`❌ Gagal broadcast: ${err.message}`);
            }
        }
        break;
    }
};

handler.command = ["restart", "setpref", "bc", "broadcast"];
handler.owner = true;

export default handler;
