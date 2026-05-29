let handler = async (m, { sock, text, reply, command, config }) => {
  if (!text) return reply(`⚠️ Contoh penggunaan:\n.${command} DitssGanteng`);
  if (text.length > 250) return reply("⚠️ Karakter terbatas, maksimal 250!");

  try {
    let res = await config.fetchApi('/v2/maker/brat', {
      method: 'POST',
      params: {
        apikey: 'demo',
        text: text
      },
      responseType: 'arraybuffer'
    });

    await sock.sendImageAsSticker(m.chat, res, m, {
      packname: text,
      author: `asuma multi device - ${m.pushName}`,
    });
  } catch (err) {
    console.error('Error:', err);
    reply("❌ Gagal membuat stiker. Coba lagi nanti.");
  }
};

handler.tags = ['sticker', 'fun'];
handler.command = ["brat", "bratt"];
handler.description = "Stiker brat bret brot";
handler.limit = true;

export default handler;
