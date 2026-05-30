// src/plugins/group/hidetag.js
const handler = async (m, { Ditss, text, isOwner, isAdmin, isGroup, reply }) => {
    if (!isGroup) return reply('❌ Command ini hanya bisa digunakan di grup!');
    
    const isUserAdmin = isOwner || isAdmin;
    if (!isUserAdmin) return reply('❌ Hanya admin grup atau owner yang bisa menggunakan command ini!');
    
    const groupMetadata = await Ditss.groupMetadata(m.chat);
    const participants = groupMetadata.participants;
    const mentions = participants
        .map(p => p.phoneNumber)
        .filter(phone => phone && phone.includes('@s.whatsapp.net'));
    
    if (mentions.length === 0) {
        return reply('❌ Tidak ada nomor telepon yang valid untuk di-mention!');
    }
    
    const message = text || '📢 *PENTING!* Perhatian untuk semua anggota grup.';
    
    await Ditss.sendMessage(m.chat, {
        text: message,
        mentions: mentions
    }, { quoted: m });
};

handler.command = ['hidetag', 'tagall'];
handler.group = true;
handler.admin = true;

export default handler;
