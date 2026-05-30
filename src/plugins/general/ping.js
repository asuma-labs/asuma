const handler = async (m, { reply }) => {
    const start = Date.now();
    await reply('🏓 Testing speed...');
    const end = Date.now();
    reply(`Pong! Speed: ${end - start}ms`);
};

handler.command = ["ping"];
export default handler;
