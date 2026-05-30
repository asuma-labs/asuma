const handler = async (m, { Ditss, reply, command }) => {
    let quotedMsg = m.quoted || m;
    let mimeType = (quotedMsg.msg || quotedMsg).mimetype || "";
    if (!m.quoted && mimeType) {
        quotedMsg = m;
        mimeType = (m.msg || m).mimetype || "";
    }
    if (m.quoted && !mimeType) {
        quotedMsg = m.quoted;
        mimeType = (quotedMsg.msg || quotedMsg).mimetype || "";
    }
    
    if (!/image|video/.test(mimeType)) {
        return reply(`❌ Command .${command} hanya untuk image/video!\n\nCara penggunaan:\n1. Kirim gambar/video dengan caption .${command}\n2. Atau reply gambar/video dengan .${command}`);
    }
    
    await reply('🔄 Processing sticker...');
    
    try {
        let media;
        if (typeof quotedMsg.download === 'function') {
            media = await quotedMsg.download();
        } else if (quotedMsg.msg && typeof quotedMsg.msg.download === 'function') {
            media = await quotedMsg.msg.download();
        } else {
            return reply('❌ Gagal mengunduh media');
        }
        
        await Ditss.sendImageAsSticker(m.chat, media, m, {
            packname: "Asuma Bot",
            author: "ditss"
        });
    } catch (err) {
        console.error('Sticker error:', err);
        reply(`❌ Gagal: ${err.message}`);
    }
};

handler.command = ["sticker", "s"];
export default handler;
