import axios from 'axios';
import { generateWAMessageFromContent, generateWAMessageContent, proto } from '@whiskeysockets/baileys';

const delay = ms => new Promise(res => setTimeout(res, ms));

const tiktokDownloader = async (m, { Ditss, usedPrefix, command, args, config }) => {
  const text = args.join(' ');
  if (!text) return m.reply(`Example: ${usedPrefix + command} https://www.tiktok.com/@username/video/123456789 `);
  if (!text.includes('tiktok.com')) return m.reply('Url Tidak Mengandung Link TikTok!');

  const handleTikTokData = async (data) => {
    const isPhotoMode = Array.isArray(data.images) && data.images.length > 0;

    if (isPhotoMode) {
      const maxImages = 50;
      const total = Math.min(data.images.length, maxImages);
      
      async function createImage(url) {
        const { imageMessage } = await generateWAMessageContent({
          image: { url }
        }, {
          upload: Ditss.waUploadToServer
        });
        return imageMessage;
      }
      
      let cards = [];
      
      for (let i = 0; i < total; i++) {
        const url = data.images[i];
        if (url) {
          if (i === 0) {
            cards.push({
              body: proto.Message.InteractiveMessage.Body.fromObject({
                text: `📸 *TikTok Foto*\n\n*👤 Author:* ${data.author.nickname} (@${data.author.unique_id})\n*🎬 Judul:* ${data.title || '-'}\n*❤️ Likes:* ${data.digg_count}\n*💬 Comments:* ${data.comment_count}`
              }),
              footer: proto.Message.InteractiveMessage.Footer.fromObject({
                text: `Foto ${i + 1}/${total}`
              }),
              header: proto.Message.InteractiveMessage.Header.fromObject({
                title: `TikTok ${data.author.nickname}`,
                hasMediaAttachment: true,
                imageMessage: await createImage(url)
              }),
              nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                buttons: [{
                  name: "cta_url",
                  buttonParamsJson: JSON.stringify({
                    display_text: "Download Foto",
                    url: url,
                    merchant_url: url
                  })
                }]
              })
            });
          } else {
            cards.push({
              body: proto.Message.InteractiveMessage.Body.fromObject({
                text: ``
              }),
              footer: proto.Message.InteractiveMessage.Footer.fromObject({
                text: `Foto ${i + 1}/${total}`
              }),
              header: proto.Message.InteractiveMessage.Header.fromObject({
                title: ``,
                hasMediaAttachment: true,
                imageMessage: await createImage(url)
              }),
              nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                buttons: [{
                  name: "cta_url",
                  buttonParamsJson: JSON.stringify({
                    display_text: "Download Foto",
                    url: url,
                    merchant_url: url
                  })
                }]
              })
            });
          }
        }
      }
      
      const msg = generateWAMessageFromContent(m.chat, {
        viewOnceMessage: {
          message: {
            messageContextInfo: {
              deviceListMetadata: {},
              deviceListMetadataVersion: 2
            },
            interactiveMessage: proto.Message.InteractiveMessage.fromObject({
              body: proto.Message.InteractiveMessage.Body.create({
                text: ``
              }),
              footer: proto.Message.InteractiveMessage.Footer.create({
                text: `Total ${data.images.length} foto • TikTok Downloader`
              }),
              header: proto.Message.InteractiveMessage.Header.create({
                hasMediaAttachment: false
              }),
              carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.fromObject({
                cards
              })
            })
          }
        }
      }, {});
      
      await Ditss.relayMessage(m.chat, msg.message, {
        messageId: msg.key.id
      });
        
      await Ditss.sendAudio(m.chat, {
        input: data.music_info.play,
        isPtt: true,
        quoted: m,
        contextInfo: {
          externalAdReply: {
            title: data.music_info.title,
            body: `by ${data.music_info.author}`,
            thumbnailUrl: data.music_info.cover,
            sourceUrl: 'https://asuma.my.id',
            mediaType: 1,
            showAdAttribution: false,
            renderLargerThumbnail: false
          }
        }
      });
      
      return true;
    }
    
    await Ditss.sendFileUrl(
      m.chat,
      data.play,
      `🎵 *TikTok Video*\n\n*👤Author:* ${data.author.nickname} (@${data.author.unique_id})\n*🎬Judul:* ${data.title || '-'}\n*📊Views:* ${data.play_count}\n*❤️Likes:* ${data.digg_count}\n*💬Comments:* ${data.comment_count}\n*🔁Share:* ${data.share_count}`,
      m
    );
    
    await Ditss.sendAudio(m.chat, {
      input: data.music_info.play,
      isPtt: true,
      quoted: m,
      contextInfo: {
        externalAdReply: {
          title: data.music_info.title,
          body: `by ${data.music_info.author}`,
          thumbnailUrl: data.music_info.cover,
          sourceUrl: 'https://asuma.my.id',
          mediaType: 1,
          showAdAttribution: false,
          renderLargerThumbnail: false
        }
      }
    });
    
    return true;
  };
  
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`[TIKTOK] Percobaan ke-${attempt} untuk URL: ${text}`);
      const res = await config.fetchApi('/v1/downloader/tiktok', {
        method: 'GET',
        params: {
          url: text
        }
      });

      const json = res;

      if (!json.status || !json.result?.data) {
        throw new Error(`Percobaan ${attempt}: Data tidak valid`);
      }

      await handleTikTokData(json.result.data);
      return;

    } catch (e) {
      lastError = e;
      console.warn(`[TIKTOK] Gagal percobaan ${attempt}: ${e.message}`);
      if (attempt < 3) {
        await delay(2000);
      }
    }
  }
  console.error('[TIKTOK] Semua percobaan gagal:', lastError);
  m.reply('❌ Gagal mengambil data TikTok setelah 3x percobaan. Coba lagi nanti.');
};

tiktokDownloader.help = ['<url> - Download TikTok video + audio'];
tiktokDownloader.tags = ['downloader', 'tools'];
tiktokDownloader.command = ['tt', 'tiktok', 'tiktokvideo', 'ttmp4', 'ttdl', 'ttmp3'];
tiktokDownloader.limit = 1;

export default tiktokDownloader;
