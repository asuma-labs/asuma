const handler = async (m, { Ditss, reply, command, isOwner }) => {
    if (!isOwner) return reply('❌ Owner only!');
    
    if (command === 'public') {
        Ditss.public = true;
        reply('✅ Bot mode set to *PUBLIC*');
    } else if (command === 'self') {
        Ditss.public = false;
        reply('✅ Bot mode set to *SELF*');
    }
};

handler.command = ["public", "self"];
handler.owner = true;

export default handler;
