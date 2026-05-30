// src/plugins/main/menu.js
const handler = async (m, { reply, pushname, isOwner }) => {
    const menuText = `╭━━━━━『 ASUMA MD 』━━━━━╮
│ 🤖 *Bot Name* : Asuma Base
│ 📦 *Version*  : 1.0.0
│ 👤 *User*     : ${pushname || 'User'}
│ 👑 *Role*     : ${isOwner ? 'Owner' : 'User'}
├─────────────────────┤
│ 🎮 *COMMANDS*
│
│ 📍 .ping - Cek bot
│ 📍 .info - Info bot
│ 📍 .status - Status bot
│ 📍 .menu - Menu ini
│
│ 🔧 *OWNER ONLY*
│ 📍 .public - Mode public
│ 📍 .self - Mode self
│ 📍 .restart - Restart bot
│
├─────────────────────┤
│ 📢 *CHANNEL*
│ https://whatsapp.com/channel/0029VaN28lnGU3BROmG4Tx3j
│
│ 🌐 *WEBSITE*
│ www.asuma.my.id/script
╰━━━━━━━━━━━━━━━━━━━━━╯
    `.trim();
    
    await reply(menuText);
};

handler.command = ['menu', 'help'];
handler.owner = false;

export default handler;
