import fs from 'fs';
import { UguuSe, webp2mp4File } from '../../lib/uploader.js'
import { exec } from 'child_process';
import { promisify } from 'util';

let stickerToImage = async (m, { conn: Ditss }) => {
    const q = m.quoted;
    
    if (!q) return m.reply('Reply stikernya!');
    if (q.mtype !== 'stickerMessage') return m.reply('Reply stiker!');
    
    try {
        //m.reply('Sedang memproses...');
        const media = await q.download();
        let uploadedUrl = await UguuSe(media);
        const isAnimated = q.isAnimated || false;
        let mmek = await webp2mp4File(uploadedUrl.url)
        if (isAnimated) {
            await Ditss.sendMessage(m.chat, {
                video: { url: mmek },
                mimetype: 'video/mp4',
                caption: `✅ Sticker animasi`
            }, { quoted: m });
        } else {
            await Ditss.sendMessage(m.chat, {
                image: media,
                caption: '✅ Sticker → Gambar'
            }, { quoted: m });
        }
        
    } catch (error) {
        console.error(error);
        m.reply('Gagal mengconvert sticker');
    }
};

stickerToImage.help = ['toimg'];
stickerToImage.tags = ['converter'];
stickerToImage.command = ['toimg', 'toimage', 'stickertoimg', 'tovid', 'tovideo', 'tomp4'];

export default stickerToImage;
