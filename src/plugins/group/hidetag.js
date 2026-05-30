const handler = async (m, { Ditss, reply, command }) => {
    const quoted = m.quoted;
    
    if (!quoted || !quoted.download) {
        return reply(`❌ Reply image/video with command .${command}\n\nContoh: kirim gambar/video lalu reply dengan .${command}`);
    }
    
    const mime = quoted.mimetype || '';
    if (!(/image|video/.test(mime))) {
        return reply(`❌ Format tidak didukung! Reply image atau video saja.`);
    }
    
    await reply('🔄 Processing sticker...');
    
    try {
        const media = await quoted.download();
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
