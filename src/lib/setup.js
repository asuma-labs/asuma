import {
    generateWAMessageFromContent,
    generateWAMessageContent,
    generateWAMessage,
    generateMessageIDV2,
    jidDecode,
    jidNormalizedUser,
    proto
} from '@whiskeysockets/baileys';
import { imageToWebp, videoToWebp, writeExif } from '../lib/exif.js';
import { getBuffer, getSizeMedia } from '../core/message.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import MediaHandler from '../core/media.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const setupBot = async (Ditss, store) => {
    const media = new MediaHandler(Ditss, { getBuffer, getSizeMedia });
    Ditss.media = media;

    Ditss.decodeJid = (jid) => {
        if (!jid) return jid;
        const jidString = jid.toString();
        if (/:\d+@/gi.test(jidString)) {
            const decode = jidDecode(jidString) || {};
            if (decode.user && decode.server) return decode.user + '@' + decode.server;
            return jidString.split(':')[0] + '@' + jidString.split('@')[1];
        }
        if (jidString.includes('@lid')) {
            const foundJid = Ditss.findJidByLid(jidString);
            if (foundJid) return foundJid;
        }
        if (jidString.includes('@s.whatsapp.net')) return jidString;
        if (/^\d+$/.test(jidString)) return jidString + '@s.whatsapp.net';
        return jidString;
    };

    Ditss.businessCache = new Map();

    Ditss.isBusinessAccount = async (jid) => {
        if (!jid) return false;
        jid = Ditss.decodeJid(jid);
        if (jid.includes('@g.us') || jid.includes('@broadcast')) return false;
        const cached = Ditss.businessCache.get(jid);
        if (cached && Date.now() - cached.t < 30 * 60 * 1000) return cached.v;
        try {
            const profile = await Ditss.getBusinessProfile(jid);
            const isBusiness = !!profile;
            Ditss.businessCache.set(jid, { v: isBusiness, t: Date.now() });
            return isBusiness;
        } catch {
            Ditss.businessCache.set(jid, { v: false, t: Date.now() });
            return false;
        }
    };

    Ditss.getFile = (PATH, save) => media.getFile(PATH, save);
    Ditss.downloadMediaMessage = (message) => media.downloadMediaMessage(message);
    Ditss.downloadAndSaveMediaMessage = (message, filename, attachExtension) =>
        media.downloadAndSaveMediaMessage(message, filename, attachExtension);

    Ditss.sendText = (jid, text, quoted = '', options) =>
        Ditss.sendMessage(jid, { text, ...options }, { quoted });

    Ditss.sendMedia = async (jid, path, caption = '', quoted = '', options = {}) => {
        let { mime, data } = await Ditss.getFile(path, true);
        let messageType = mime.split('/')[0];
        let messageContent = {};
        if (messageType === 'image') {
            messageContent = { image: data, caption, ...options };
        } else if (messageType === 'video') {
            messageContent = { video: data, caption, ...options };
        } else if (messageType === 'audio') {
            messageContent = { audio: data, ptt: options.ptt || false, ...options };
        } else {
            messageContent = { document: data, mimetype: mime, fileName: options.fileName || 'file' };
        }
        await Ditss.sendMessage(jid, messageContent, { quoted });
    };

    Ditss.sendImageAsSticker = async (jid, path, quoted, options = {}) => {
        let buff = Buffer.isBuffer(path) ? path : /^https?:\/\//.test(path) ? await getBuffer(path) : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0);
        let buffer = options?.packname || options?.author ? await writeExif(buff, options) : await imageToWebp(buff);
        let stickerBuffer = Buffer.isBuffer(buffer) ? buffer : fs.readFileSync(buffer);
        await Ditss.sendMessage(jid, { sticker: stickerBuffer, ...options }, { quoted });
        if (typeof buffer === 'string' && fs.existsSync(buffer)) fs.unlinkSync(buffer);
        return stickerBuffer;
    };

    Ditss.sendVideoAsSticker = async (jid, path, quoted, options = {}) => {
        let buff = Buffer.isBuffer(path) ? path : /^https?:\/\//.test(path) ? await getBuffer(path) : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0);
        let buffer = options?.packname || options?.author ? await writeExif(buff, options) : await videoToWebp(buff);
        let stickerBuffer = Buffer.isBuffer(buffer) ? buffer : fs.readFileSync(buffer);
        await Ditss.sendMessage(jid, { sticker: stickerBuffer, ...options }, { quoted });
        if (typeof buffer === 'string' && fs.existsSync(buffer)) fs.unlinkSync(buffer);
        return stickerBuffer;
    };

    Ditss.sendAsSticker = async (jid, pathMedia, quoted, options = {}) => {
        let buff = Buffer.isBuffer(pathMedia) ? pathMedia
            : /^data:.*?\/.*?;base64,/i.test(pathMedia) ? Buffer.from(pathMedia.split`,`[1], 'base64')
            : /^https?:\/\//.test(pathMedia) ? await getBuffer(pathMedia)
            : fs.existsSync(pathMedia) ? fs.readFileSync(pathMedia)
            : Buffer.alloc(0);
        const result = await writeExif(buff, options);
        try {
            let stickerBuffer = fs.readFileSync(result);
            return await Ditss.sendMessage(jid, { sticker: stickerBuffer, ...options }, { quoted });
        } finally {
            if (typeof pathMedia === 'string' && fs.existsSync(pathMedia)) fs.unlinkSync(pathMedia);
            if (fs.existsSync(result)) fs.unlinkSync(result);
        }
    };

    Ditss.sendAudio = async (jid, input, isPtt = false, quoted = null, contextInfo = null) => {
        try {
            if (typeof input === 'object' && input !== null && !Buffer.isBuffer(input) && !input.url) {
                const params = input;
                input = params.input || params.audio || params.url;
                isPtt = params.isPtt || params.ptt || false;
                quoted = params.quoted || null;
                contextInfo = params.contextInfo || null;
            }
            if (typeof jid === 'object' && jid !== null) {
                const params = jid;
                jid = params.jid || params.to || params.chat || params.m?.chat;
                input = params.input || params.audio || params.url;
                isPtt = params.isPtt || params.ptt || false;
                quoted = params.quoted || null;
                contextInfo = params.contextInfo || null;
            }
            if (!jid) throw new Error('JID diperlukan');
            if (!input) throw new Error('Input audio diperlukan');

            const tmpDir = path.join(process.cwd(), 'tmp');
            if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

            const tempInput = path.join(tmpDir, `temp_input_${Date.now()}.tmp`);
            const tempOutput = path.join(tmpDir, `temp_output_${Date.now()}.ogg`);

            if (Buffer.isBuffer(input)) {
                fs.writeFileSync(tempInput, input);
            } else if (typeof input === 'string') {
                if (input.startsWith('http')) {
                    const response = await axios({ url: input, responseType: 'arraybuffer', timeout: 60000 });
                    fs.writeFileSync(tempInput, Buffer.from(response.data));
                } else {
                    if (!fs.existsSync(input)) throw new Error('File tidak ditemukan: ' + input);
                    fs.copyFileSync(input, tempInput);
                }
            }

            await new Promise((resolve, reject) => {
                exec(`ffmpeg -y -i "${tempInput}" -vn -c:a libopus -b:a 64k -ac 1 -ar 48000 -map_metadata -1 "${tempOutput}"`, (error) => {
                    if (error) return reject(error);
                    resolve();
                });
            });

            const audioBuffer = fs.readFileSync(tempOutput);
            const message = { audio: audioBuffer, mimetype: 'audio/ogg; codecs=opus', ptt: isPtt };
            if (contextInfo) message.contextInfo = contextInfo;

            await Ditss.sendMessage(jid, message, { quoted });

            if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
            if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
            return true;
        } catch (error) {
            console.error('Error sendAudio:', error);
            return false;
        }
    };

    Ditss.newsletterMsg = async (key, content = {}, timeout = 5000) => {
        const { type: rawType = 'INFO', name, description = '', picture = null, react, id, newsletter_id = key, ...media } = content;
        const type = rawType.toUpperCase();

        if (react) {
            if (!(newsletter_id.endsWith('@newsletter') || !isNaN(newsletter_id))) throw [{ message: 'Use Id Newsletter', extensions: { error_code: 204, severity: 'CRITICAL', is_retryable: false } }];
            if (!id) throw [{ message: 'Use Id Newsletter Message', extensions: { error_code: 204, severity: 'CRITICAL', is_retryable: false } }];
            return await Ditss.query({
                tag: 'message',
                attrs: { to: key, type: 'reaction', 'server_id': id, id: generateMessageIDV2() },
                content: [{ tag: 'reaction', attrs: { code: react } }]
            });
        } else if (media && typeof media === 'object' && Object.keys(media).length > 0) {
            const msg = await generateWAMessageContent(media, { upload: Ditss.waUploadToServer });
            return await Ditss.query({
                tag: 'message',
                attrs: { to: newsletter_id, type: 'text' in media ? 'text' : 'media' },
                content: [{
                    tag: 'plaintext',
                    attrs: /image|video|audio|sticker|poll/.test(Object.keys(media).join('|')) ? { mediatype: Object.keys(media).find(k => ['image', 'video', 'audio', 'sticker', 'poll'].includes(k)) || null } : {},
                    content: proto.Message.encode(msg).finish()
                }]
            });
        } else {
            if (/(FOLLOW|UNFOLLOW|DELETE)/.test(type) && !(newsletter_id.endsWith('@newsletter') || !isNaN(newsletter_id))) {
                return [{ message: 'Use Id Newsletter', extensions: { error_code: 204, severity: 'CRITICAL', is_retryable: false } }];
            }
            const _query = await Ditss.query({
                tag: 'iq',
                attrs: { to: 's.whatsapp.net', type: 'get', xmlns: 'w:mex' },
                content: [{
                    tag: 'query',
                    attrs: {
                        query_id: type === 'FOLLOW' ? '9926858900719341'
                            : type === 'UNFOLLOW' ? '7238632346214362'
                            : type === 'CREATE' ? '6234210096708695'
                            : type === 'DELETE' ? '8316537688363079'
                            : '6563316087068696'
                    },
                    content: new TextEncoder().encode(JSON.stringify({
                        variables: /(FOLLOW|UNFOLLOW|DELETE)/.test(type) ? { newsletter_id }
                            : type === 'CREATE' ? { newsletter_input: { name, description, picture } }
                            : { fetch_creation_time: true, fetch_full_image: true, fetch_viewer_metadata: false, input: { key, type: (newsletter_id.endsWith('@newsletter') || !isNaN(newsletter_id)) ? 'JID' : 'INVITE' } }
                    }))
                }]
            }, timeout);

            const parsed = JSON.parse(_query.content[0].content);
            const res = parsed?.data?.xwa2_newsletter
                || parsed?.data?.xwa2_newsletter_join_v2
                || parsed?.data?.xwa2_newsletter_leave_v2
                || parsed?.data?.xwa2_newsletter_create
                || parsed?.data?.xwa2_newsletter_delete_v2
                || parsed?.errors
                || parsed;

            if (res?.thread_metadata) res.thread_metadata.host = 'https://mmg.whatsapp.net';
            return res;
        }
    };

    Ditss.sendPoll = async (jid, question, options) => {
        await Ditss.sendMessage(jid, {
            pollCreationMessage: {
                name: question,
                options: options.map(option => ({ optionName: option })),
                selectableCount: 1
            }
        });
    };

    Ditss.sendFileUrl = async (jid, url, caption, quoted, options = {}) => {
        const res = await axios.head(url);
        const mime = res.headers['content-type'];
        if (mime.split('/')[1] === 'gif') return Ditss.sendMessage(jid, { video: await getBuffer(url), caption, gifPlayback: true, ...options }, { quoted });
        if (mime === 'application/pdf') return Ditss.sendMessage(jid, { document: await getBuffer(url), mimetype: 'application/pdf', caption, ...options }, { quoted });
        if (mime.split('/')[0] === 'image') return Ditss.sendMessage(jid, { image: await getBuffer(url), caption, ...options }, { quoted });
        if (mime.split('/')[0] === 'video') return Ditss.sendMessage(jid, { video: await getBuffer(url), caption, mimetype: 'video/mp4', ...options }, { quoted });
        if (mime.split('/')[0] === 'audio') return Ditss.sendMessage(jid, { audio: await getBuffer(url), caption, mimetype: 'audio/mpeg', ...options }, { quoted });
    };

    Ditss.sendButtonMsg = async (jid, content = {}, options = {}) => {
        const { text, caption, footer = '', headerType = 1, ai, contextInfo = {}, buttons = [], mentions = [], ...media } = content;
        const msg = await generateWAMessageFromContent(jid, {
            viewOnceMessage: {
                message: {
                    messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                    buttonsMessage: {
                        ...(media && Object.keys(media).length > 0 ? await generateWAMessageContent(media, { upload: Ditss.waUploadToServer }) : {}),
                        contentText: text || caption || '',
                        footerText: footer,
                        buttons,
                        headerType: media && Object.keys(media).length > 0
                            ? Math.max(...Object.keys(media).map(a => ({ document: 3, image: 4, video: 5, location: 6 })[a] || headerType))
                            : headerType,
                        contextInfo: {
                            ...contextInfo,
                            ...options.contextInfo,
                            mentionedJid: options.mentions || mentions,
                            ...(options.quoted ? {
                                stanzaId: options.quoted.key.id,
                                remoteJid: options.quoted.key.remoteJid,
                                participant: options.quoted.key.participant || options.quoted.key.remoteJid,
                                fromMe: options.quoted.key.fromMe,
                                quotedMessage: options.quoted.message
                            } : {})
                        }
                    }
                }
            }
        }, {});

        return await Ditss.relayMessage(msg.key.remoteJid, msg.message, {
            messageId: msg.key.id,
            additionalNodes: [
                {
                    tag: 'biz', attrs: {},
                    content: [{
                        tag: 'interactive', attrs: { type: 'native_flow', v: '1' },
                        content: [{ tag: 'native_flow', attrs: { name: 'quick_reply' } }]
                    }]
                },
                ...(ai ? [{ attrs: { biz_bot: '1' }, tag: 'bot' }] : [])
            ]
        });
    };

    Ditss.sendListMsg = async (jid, content = {}, options = {}) => {
        const { text, caption, footer = '', title, subtitle, ai, contextInfo = {}, buttons = [], mentions = [], ...media } = content;
        const msg = await generateWAMessageFromContent(jid, {
            viewOnceMessage: {
                message: {
                    messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                    interactiveMessage: proto.Message.InteractiveMessage.create({
                        body: proto.Message.InteractiveMessage.Body.create({ text: text || caption || '' }),
                        footer: proto.Message.InteractiveMessage.Footer.create({ text: footer }),
                        header: proto.Message.InteractiveMessage.Header.create({
                            title,
                            subtitle,
                            hasMediaAttachment: Object.keys(media).length > 0,
                            ...(media && Object.keys(media).length > 0 ? await generateWAMessageContent(media, { upload: Ditss.waUploadToServer }) : {})
                        }),
                        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                            buttons: buttons.map(a => ({
                                name: a.name,
                                buttonParamsJson: JSON.stringify(a.buttonParamsJson
                                    ? (typeof a.buttonParamsJson === 'string' ? JSON.parse(a.buttonParamsJson) : a.buttonParamsJson)
                                    : '')
                            }))
                        }),
                        contextInfo: {
                            ...contextInfo,
                            ...options.contextInfo,
                            mentionedJid: options.mentions || mentions,
                            ...(options.quoted ? {
                                stanzaId: options.quoted.key.id,
                                remoteJid: options.quoted.key.remoteJid,
                                participant: options.quoted.key.participant || options.quoted.key.remoteJid,
                                fromMe: options.quoted.key.fromMe,
                                quotedMessage: options.quoted.message
                            } : {})
                        }
                    })
                }
            }
        }, {});

        return await Ditss.relayMessage(msg.key.remoteJid, msg.message, {
            messageId: msg.key.id,
            additionalNodes: [
                {
                    tag: 'biz', attrs: {},
                    content: [{
                        tag: 'interactive', attrs: { type: 'native_flow', v: '1' },
                        content: [{ tag: 'native_flow', attrs: { name: 'quick_reply' } }]
                    }]
                },
                ...(ai ? [{ attrs: { biz_bot: '1' }, tag: 'bot' }] : [])
            ]
        });
    };

    Ditss.sendButtons = async ({ jid, title = '', subtitle = '', text = '', footer = '', buttons = [], quoted = null, mentions = [], image = null, video = null }) => {
        if (!mentions || mentions.length === 0) {
            mentions = quoted?.sender ? [quoted.sender]
                : quoted?.key?.participant ? [quoted.key.participant]
                : [];
        }

        const header = {
            title,
            subtitle: subtitle || undefined,
            hasMediaAttachment: !!(image || video),
            ...(image ? { imageMessage: image } : {}),
            ...(video ? { videoMessage: video } : {})
        };

        const msg = generateWAMessageFromContent(jid, {
            viewOnceMessage: {
                message: {
                    interactiveMessage: {
                        header,
                        body: { text: text || ' ' },
                        footer: { text: footer || '' },
                        contextInfo: {
                            mentionedJid: mentions,
                            ...(quoted ? {
                                quotedMessage: quoted.message,
                                participant: quoted.participant || quoted.key?.participant || quoted.key?.remoteJid
                            } : {})
                        },
                        nativeFlowMessage: {
                            buttons,
                            messageParamsJson: JSON.stringify({
                                bottom_sheet: {
                                    divider_indices: [1, 2, 3, 4, 5],
                                    list_title: '📋 DAFTAR MENU'
                                }
                            })
                        }
                    }
                }
            }
        }, { quoted, userJid: Ditss.user?.id });

        return Ditss.relayMessage(jid, msg.message, {
            messageId: msg.key.id,
            additionalNodes: [{
                tag: 'biz', attrs: {},
                content: [{
                    tag: 'interactive', attrs: { type: 'native_flow', v: '1' },
                    content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }]
                }]
            }]
        });
    };

    Ditss.sendStickerPack = async (jid, stickers, options = {}) => {
        if (!stickers || stickers.length < 2) throw new RangeError('Minimum 2 stickers untuk sticker pack');
        for (const sticker of stickers) {
            if (!sticker.sticker) throw new TypeError(`sticker harus punya properti 'sticker'`);
        }

        const container = await generateWAMessageFromContent(jid, {
            albumMessage: { expectedImageCount: stickers.length, expectedVideoCount: 0 }
        }, { quoted: options?.quoted || null });

        await Ditss.relayMessage(jid, container.message, { messageId: container.key.id });

        for (const sticker of stickers) {
            let stickerBuffer;
            if (typeof sticker.sticker === 'string') {
                stickerBuffer = sticker.sticker.startsWith('http') ? await getBuffer(sticker.sticker) : fs.readFileSync(sticker.sticker);
            } else {
                stickerBuffer = sticker.sticker;
            }

            const msg = await generateWAMessage(jid, {
                sticker: stickerBuffer,
                mimetype: 'image/webp',
                packname: sticker.packname || '',
                author: sticker.author || ''
            }, { upload: Ditss.waUploadToServer });

            msg.message.messageContextInfo = {
                messageAssociation: { associationType: 1, parentMessageKey: container.key }
            };

            await Ditss.relayMessage(jid, msg.message, { messageId: msg.key.id });
        }

        return container;
    };
        Ditss.sendRichTableV2 = async (jid, headerText = "", tableData = {}, footerText = "", options = {}) => {

    const submessages = [];

    if (headerText) {
        submessages.push({
            messageType: 2,
            messageText: headerText
        });
    }

    submessages.push({
        messageType: 4,
        tableMetadata: {
            title: tableData.title || "📊 Tabel Data",
            rows: tableData.rows || []
        }
    });

    if (footerText) {
        submessages.push({
            messageType: 2,
            messageText: footerText
        });
    }

    const content = {
        botForwardedMessage: {
            message: {
                richResponseMessage: {
                    submessages: submessages,
                    messageType: 1,
                    contextInfo: {
                        isForwarded: true,
                        forwardingScore: 1,
                        forwardedAiBotMessageInfo: {
                            botJid: options.botJid || jid
                        },
                        forwardOrigin: 4,
                        ...(options.quoted ? {
                            stanzaId: options.quoted.key.id,
                            remoteJid: options.quoted.key.remoteJid,
                            participant: options.quoted.key.participant || options.quoted.key.remoteJid,
                            fromMe: options.quoted.key.fromMe,
                            quotedMessage: options.quoted.message
                        } : {})
                    }
                }
            }
        }
    };

    return await Ditss.relayMessage(jid, content, {});
};
    Ditss.sendRichTable = async (jid, headerText = '', tableData = {}, footerText = '', options = {}) => {
        const submessages = [];
        if (headerText) submessages.push({ messageType: 2, messageText: headerText });
        submessages.push({ messageType: 4, tableMetadata: { title: tableData.title || '📊 Tabel Data', rows: tableData.rows || [] } });
        if (footerText) submessages.push({ messageType: 2, messageText: footerText });

        return await Ditss.relayMessage(jid, {
            botForwardedMessage: {
                message: {
                    richResponseMessage: {
                        submessages,
                        messageType: 1,
                        contextInfo: {
                            isForwarded: true,
                            forwardingScore: 1,
                            forwardedAiBotMessageInfo: { botJid: options.botJid || jid },
                            forwardOrigin: 4,
                            ...(options.quoted ? {
                                stanzaId: options.quoted.key.id,
                                remoteJid: options.quoted.key.remoteJid,
                                participant: options.quoted.key.participant || options.quoted.key.remoteJid,
                                fromMe: options.quoted.key.fromMe,
                                quotedMessage: options.quoted.message
                            } : {})
                        }
                    }
                }
            }
        }, {});
    };

    Ditss.sendRichCodeMessageV2 = async (jid, codeContent, language = 'javascript', options = {}) => {
        const tokenize = (code) => {
            const blocks = [];
            let remaining = code.trim();
            const patterns = [
                { type: 5, regex: /(\/\/.*|\/\*[\s\S]*?\*\/)/g },
                { type: 3, regex: /(["'`])((?:\\.|(?!\1)[^\\])*?)\1/g },
                { type: 4, regex: /\b\d+\.?\d*(?:e[+-]?\d+)?\b/g },
                { type: 1, regex: /\b(let|const|var|function|async|await|return|if|else|for|while|switch|case|break|try|catch|throw|new|typeof|instanceof|true|false|null|undefined|class|extends|import|export|default|console|log|error|warn|info|require|module|exports|process)\b/g },
                { type: 2, regex: /\b([a-zA-Z_]\w*)\s*(?=\()/g }
            ];

            while (remaining.length > 0) {
                let matched = false;
                for (const { type, regex } of patterns) {
                    regex.lastIndex = 0;
                    const match = regex.exec(remaining);
                    if (match && match.index === 0) {
                        blocks.push({ highlightType: type, codeContent: match[0] });
                        remaining = remaining.slice(match[0].length);
                        matched = true;
                        break;
                    }
                }
                if (!matched) {
                    const nextMatchIndex = Math.min(...patterns.map(p => {
                        p.regex.lastIndex = 0;
                        const m = p.regex.exec(remaining);
                        return m ? m.index : Infinity;
                    }).filter(idx => idx !== Infinity));
                    const sliceEnd = nextMatchIndex === Infinity ? remaining.length : nextMatchIndex;
                    blocks.push({ highlightType: 0, codeContent: remaining.slice(0, sliceEnd) });
                    remaining = remaining.slice(sliceEnd);
                }
            }
            return blocks;
        };

        const codeBlocks = tokenize(codeContent);
        const submessages = [];
        if (options.header) submessages.push({ messageType: 2, messageText: options.header });
        submessages.push({ messageType: 5, codeMetadata: { codeLanguage: language, codeBlocks } });
        if (options.footer) submessages.push({ messageType: 2, messageText: options.footer });

        const botJid = options.botJid || Ditss.user?.id || 'status@broadcast';
        const msg = {
            botForwardedMessage: {
                message: {
                    richResponseMessage: {
                        submessages,
                        messageType: 1,
                        contextInfo: {
                            mentionedJid: options.mentions || [],
                            forwardingScore: 1,
                            isForwarded: true,
                            forwardedAiBotMessageInfo: { botJid },
                            forwardOrigin: 4,
                            ...options.contextInfo,
                            ...(options.quoted ? {
                                stanzaId: options.quoted.key.id,
                                remoteJid: options.quoted.key.remoteJid,
                                participant: options.quoted.key.participant || options.quoted.key.remoteJid,
                                fromMe: options.quoted.key.fromMe,
                                quotedMessage: options.quoted.message
                            } : {})
                        }
                    }
                }
            }
        };

        return await Ditss.relayMessage(jid, msg, { messageId: options.messageId, ...options.relayOptions });
    };

    Ditss.sendRichAIMessage = async (jid, text, citations = [], options = {}) => {
        const botJid = options.botJid || Ditss.user?.id || 'status@broadcast';

        const sources = citations.map((cit, index) => ({
            provider: 1,
            thumbnailCdnUrl: cit.thumbnail || '',
            sourceProviderUrl: cit.url || '',
            sourceQuery: '',
            faviconCdnUrl: cit.favicon || '',
            citationNumber: index + 1,
            sourceTitle: cit.title || `Sumber ${index + 1}`
        }));

        const content = {
            botForwardedMessage: {
                message: {
                    richResponseMessage: {
                        submessages: [{ messageType: 2, messageText: text }],
                        messageType: 1,
                        contextInfo: {
                            mentionedJid: options.mentions || [],
                            groupMentions: [],
                            statusAttributions: [],
                            forwardingScore: 1,
                            isForwarded: true,
                            forwardedAiBotMessageInfo: { botJid },
                            forwardOrigin: 4,
                            ...options.contextInfo,
                            ...(options.quoted ? {
                                stanzaId: options.quoted.key.id,
                                remoteJid: options.quoted.key.remoteJid,
                                participant: options.quoted.key.participant || options.quoted.key.remoteJid,
                                fromMe: options.quoted.key.fromMe,
                                quotedMessage: options.quoted.message
                            } : {})
                        }
                    }
                }
            }
        };

        if (sources.length > 0) {
            content.messageContextInfo = {
                threadId: [],
                messageSecret: generateMessageIDV2(),
                botMetadata: {
                    richResponseSourcesMetadata: { sources }
                }
            };
        }

        return await Ditss.relayMessage(jid, content, {});
    };

    Ditss.findJidByLid = function(lid) {
        try {
            if (!lid) return null;
            let lidString = lid.toString().trim();
            if (lidString.endsWith('@g.us')) return lidString;
            if (lidString.includes('@s.whatsapp.net')) return jidNormalizedUser(lidString);
            if (!lidString.endsWith('@lid')) lidString = lidString.replace(/@lid/g, '') + '@lid';

            const db = global.db?.userLinks || {};
            if (db[lidString]?.jid) return jidNormalizedUser(db[lidString].jid);

            for (const key in db) {
                const u = db[key];
                if (u && (u.lid === lidString || u.lid === lidString.replace('@lid', '')) && u.jid) {
                    return jidNormalizedUser(u.jid);
                }
            }

            if (store?.contacts) {
                for (const jid in store.contacts) {
                    const c = store.contacts[jid];
                    if (c && (c.lid === lidString || c.lid === lidString.replace('@lid', ''))) {
                        return jidNormalizedUser(jid);
                    }
                }
            }

            const number = lidString.replace('@lid', '');
            if (/^\d+$/.test(number)) return jidNormalizedUser(number + '@s.whatsapp.net');
            return null;
        } catch (e) {
            console.error('Error findJidByLid:', e);
            return null;
        }
    };

    Ditss.saveUserLink = async function(m) {
        try {
            let jid = null, lid = null;

            if (m.key?.remoteJidAlt?.includes('@s.whatsapp.net')) jid = m.key.remoteJidAlt;
            else if (m.key?.participantAlt?.includes('@s.whatsapp.net')) jid = m.key.participantAlt;
            else if (m.sender?.includes('@s.whatsapp.net')) jid = m.sender;

            if (m.key?.remoteJid?.includes('@lid')) lid = m.key.remoteJid;
            else if (m.key?.participant?.includes('@lid')) lid = m.key.participant;
            else if (m.senderLid?.includes('@lid')) lid = m.senderLid;

            if (!jid || !lid) return false;

            const normalizedLid = lid.includes('@lid') ? lid : lid + '@lid';
            const normalizedJid = jid.includes('@s.whatsapp.net') ? jid : jid + '@s.whatsapp.net';
            const { lidConverter } = await import('../lib/lidConverter.js');
            const existsInGitHub = await lidConverter.hasLid(normalizedLid);

            if (existsInGitHub) return true;

            if (!global.db.userLinks) global.db.userLinks = {};
            const lidWithoutSuffix = normalizedLid.replace('@lid', '');
            const linkData = { jid: normalizedJid, lid: normalizedLid, lastSeen: Date.now(), pushName: m.pushName || '' };

            global.db.userLinks[normalizedLid] = linkData;
            global.db.userLinks[lidWithoutSuffix] = { ...linkData, lid: lidWithoutSuffix };
            console.log(`💾 LID ${normalizedLid} saved to local db`);
            return true;
        } catch (e) {
            console.error('Error saving user link:', e);
            return false;
        }
    };

    Ditss.saveUserLink2 = function(m) {
        try {
            let jid = null, lid = null;

            if (m.key?.remoteJidAlt?.includes('@s.whatsapp.net')) jid = m.key.remoteJidAlt;
            else if (m.key?.participantAlt?.includes('@s.whatsapp.net')) jid = m.key.participantAlt;
            else if (m.sender?.includes('@s.whatsapp.net')) jid = m.sender;

            if (m.key?.remoteJid?.includes('@lid')) lid = m.key.remoteJid;
            else if (m.key?.participant?.includes('@lid')) lid = m.key.participant;
            else if (m.senderLid?.includes('@lid')) lid = m.senderLid;

            if (!jid || !lid) return false;

            const normalizedLid = lid.includes('@lid') ? lid : lid + '@lid';
            const normalizedJid = jid.includes('@s.whatsapp.net') ? jid : jid + '@s.whatsapp.net';

            if (!global.db.userLinks) global.db.userLinks = {};
            const lidWithoutSuffix = normalizedLid.replace('@lid', '');
            const linkData = { jid: normalizedJid, lid: normalizedLid, lastSeen: Date.now(), pushName: m.pushName || '' };

            global.db.userLinks[normalizedLid] = linkData;
            global.db.userLinks[lidWithoutSuffix] = { ...linkData, lid: lidWithoutSuffix };
            return true;
        } catch (e) {
            console.error('Error saving user link:', e);
            return false;
        }
    };

    Ditss.getName = async (jid, withoutContact = false) => {
        try {
            const id = Ditss.findJidByLid(jid) || jid;
            if (!id || typeof id !== 'string') return 'Unknown';
            if (id.endsWith('@g.us')) return store?.groupMetadata?.[id]?.subject || id.split('@')[0] || id;
            if (id === '0@s.whatsapp.net') return 'WhatsApp';
            const contactInfo = store?.contacts?.[id];
            if (!withoutContact) return contactInfo?.name || contactInfo?.verifiedName || id.split('@')[0] || id;
            return '';
        } catch (error) {
            console.error('Error getName:', error);
            return 'Unknown';
        }
    };
        
    Ditss.sendRichCodeMessage = async (jid, codeContent, language = 'javascript', options = {}) => {
    const LANG_ALIAS = {
        js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
        ts: 'typescript', tsx: 'typescript',
        py: 'python', python3: 'python',
        rb: 'ruby',
        rs: 'rust',
        go: 'golang',
        kt: 'kotlin',
        java: 'java',
        cs: 'csharp', 'c#': 'csharp',
        cpp: 'cpp', 'c++': 'cpp', cc: 'cpp', cxx: 'cpp',
        c: 'c',
        php: 'php',
        swift: 'swift',
        dart: 'dart',
        lua: 'lua',
        r: 'r',
        scala: 'scala',
        sh: 'bash', shell: 'bash', zsh: 'bash',
        ps1: 'powershell', psm1: 'powershell',
        html: 'html', htm: 'html',
        xml: 'xml',
        css: 'css',
        scss: 'scss', sass: 'sass',
        less: 'less',
        json: 'json',
        yaml: 'yaml', yml: 'yaml',
        toml: 'toml',
        md: 'markdown', markdown: 'markdown',
        sql: 'sql',
        graphql: 'graphql', gql: 'graphql',
        dockerfile: 'dockerfile',
        makefile: 'makefile',
        vim: 'vim', vimscript: 'vim',
        ex: 'elixir', exs: 'elixir',
        erl: 'erlang',
        hs: 'haskell',
        ml: 'ocaml',
        fs: 'fsharp', 'f#': 'fsharp',
        clj: 'clojure', cljs: 'clojure',
        groovy: 'groovy',
        perl: 'perl', pl: 'perl',
        proto: 'protobuf',
        tf: 'terraform', hcl: 'terraform',
        sol: 'solidity',
    };

    const LANGUAGE_PATTERNS = {
        javascript: [            { type: 1, regex: /^#![^\n]*/ },
            { type: 5, regex: /^\/\*[\s\S]*?\*\// },
            { type: 5, regex: /^\/\/[^\n]*/ },
            { type: 3, regex: /^`(?:\\[\s\S]|[^`\\])*`/ },
            { type: 3, regex: /^"(?:\\[\s\S]|[^"\\])*"/ },
            { type: 3, regex: /^'(?:\\[\s\S]|[^'\\])*'/ },
            { type: 3, regex: /^\/(?![/*])(?:\\.|[^/\n])+\/[gimsuy]*\b/ },
            { type: 4, regex: /^0[xX][0-9a-fA-F]+n?/ },
            { type: 4, regex: /^0[bB][01]+n?/ },
            { type: 4, regex: /^0[oO][0-7]+n?/ },
            { type: 4, regex: /^\d+\.?\d*(?:[eE][+-]?\d+)?n?/ },
            { type: 2, regex: /^@[a-zA-Z_$][\w$]*/ },
            { type: 1, regex: /^\b(abstract|arguments|async|await|break|case|catch|class|const|constructor|continue|debugger|default|delete|do|else|enum|eval|export|extends|false|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|true|try|typeof|undefined|var|void|while|with|yield)\b/ },
            { type: 1, regex: /^\b(Array|ArrayBuffer|Atomics|BigInt|BigInt64Array|BigUint64Array|Boolean|DataView|Date|Error|EvalError|Float32Array|Float64Array|Function|Generator|GeneratorFunction|Infinity|Int16Array|Int32Array|Int8Array|Intl|JSON|Map|Math|NaN|Number|Object|Promise|Proxy|RangeError|ReferenceError|Reflect|RegExp|Set|SharedArrayBuffer|String|Symbol|SyntaxError|TypeError|URIError|Uint16Array|Uint32Array|Uint8Array|Uint8ClampedArray|WeakMap|WeakRef|WeakSet|console|document|globalThis|module|process|require|window)\b/ },
            { type: 2, regex: /^([a-zA-Z_$][\w$]*)\s*(?=\()/ },
            { type: 0, regex: /^[a-zA-Z_$][\w$]*/ },
            { type: 0, regex: /^(?:===|!==|==|!=|<=|>=|>>>=|>>>|<<=|>>=|<<|>>|\*\*=|\*\*|\?\?=|\?\?|\|\|=|\|\||&&=|&&|\?\.|\.\.\.|\+\+|--|[-+*/%&|^~!<>=?:;,.()\[\]{}])/ },
            { type: 0, regex: /^[\s]+/ },
        ],
        typescript: [
            { type: 5, regex: /^\/\*[\s\S]*?\*\// },
            { type: 5, regex: /^\/\/[^\n]*/ },
            { type: 3, regex: /^`(?:\\[\s\S]|[^`\\])*`/ },
            { type: 3, regex: /^"(?:\\[\s\S]|[^"\\])*"/ },
            { type: 3, regex: /^'(?:\\[\s\S]|[^'\\])*'/ },
            { type: 4, regex: /^0[xX][0-9a-fA-F]+n?/ },
            { type: 4, regex: /^0[bB][01]+n?/ },
            { type: 4, regex: /^\d+\.?\d*(?:[eE][+-]?\d+)?n?/ },
            { type: 2, regex: /^@[a-zA-Z_$][\w$]*/ },
            { type: 1, regex: /^\b(abstract|as|asserts|async|await|break|case|catch|class|const|constructor|continue|declare|default|delete|do|else|enum|export|extends|false|finally|for|from|function|get|if|implements|import|in|infer|instanceof|interface|is|keyof|let|module|namespace|never|new|null|of|override|package|private|protected|public|readonly|return|satisfies|set|static|super|switch|this|throw|true|try|type|typeof|undefined|unique|unknown|var|void|while|with|yield)\b/ },
            { type: 1, regex: /^\b(any|bigint|boolean|never|number|object|string|symbol|unknown|void|Array|Date|Error|Function|Map|Object|Promise|Proxy|Record|RegExp|Set|Partial|Required|Readonly|Pick|Omit|Exclude|Extract|NonNullable|ReturnType|InstanceType|Parameters|ConstructorParameters)\b/ },
            { type: 2, regex: /^([a-zA-Z_$][\w$]*)\s*(?=[(<])/ },
            { type: 0, regex: /^[a-zA-Z_$][\w$]*/ },
            { type: 0, regex: /^(?:===|!==|==|!=|<=|>=|>>>|>>|<<|\?\?|\|\||&&|\?\.|\.\.\.|\+\+|--|[-+*/%&|^~!<>=?:;,.()\[\]{}])/ },
            { type: 0, regex: /^[\s]+/ },
        ],
        python: [
            { type: 5, regex: /^#[^\n]*/ },
            { type: 3, regex: /^"""[\s\S]*?"""/ },
            { type: 3, regex: /^'''[\s\S]*?'''/ },
            { type: 3, regex: /^[fFrRbBuU]{0,2}"(?:\\[\s\S]|[^"\\])*"/ },
            { type: 3, regex: /^[fFrRbBuU]{0,2}'(?:\\[\s\S]|[^'\\])*'/ },
            { type: 4, regex: /^0[xX][0-9a-fA-F]+/ },
            { type: 4, regex: /^0[bB][01]+/ },
            { type: 4, regex: /^0[oO][0-7]+/ },
            { type: 4, regex: /^\d+\.?\d*(?:[eE][+-]?\d+)?[jJ]?/ },
            { type: 2, regex: /^@[a-zA-Z_][\w.]*/ },
            { type: 1, regex: /^\b(False|None|True|and|as|assert|async|await|break|class|continue|def|del|elif|else|except|exec|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|print|raise|return|try|while|with|yield)\b/ },
            { type: 1, regex: /^\b(bool|bytes|bytearray|complex|dict|float|frozenset|int|list|memoryview|object|range|set|slice|str|tuple|type|ArithmeticError|AssertionError|AttributeError|BaseException|BlockingIOError|BrokenPipeError|BufferError|BytesWarning|ChildProcessError|ConnectionAbortedError|ConnectionError|ConnectionRefusedError|ConnectionResetError|DeprecationWarning|EOFError|EnvironmentError|Exception|FileExistsError|FileNotFoundError|FloatingPointError|FutureWarning|GeneratorExit|IOError|ImportError|ImportWarning|IndentationError|IndexError|InterruptedError|IsADirectoryError|KeyError|KeyboardInterrupt|LookupError|MemoryError|ModuleNotFoundError|NameError|NotADirectoryError|NotImplemented|NotImplementedError|OSError|OverflowError|PendingDeprecationWarning|PermissionError|ProcessLookupError|RecursionError|ReferenceError|ResourceWarning|RuntimeError|RuntimeWarning|StopAsyncIteration|StopIteration|SyntaxError|SyntaxWarning|SystemError|SystemExit|TabError|TimeoutError|TypeError|UnboundLocalError|UnicodeDecodeError|UnicodeEncodeError|UnicodeError|UnicodeTranslateError|UnicodeWarning|UserWarning|ValueError|Warning|ZeroDivisionError|abs|all|any|ascii|bin|callable|chr|compile|delattr|dir|divmod|enumerate|eval|exec|filter|format|getattr|globals|hasattr|hash|help|hex|id|input|isinstance|issubclass|iter|len|locals|map|max|min|next|oct|open|ord|pow|property|repr|reversed|round|setattr|sorted|staticmethod|sum|super|vars|zip)\b/ },
            { type: 2, regex: /^([a-zA-Z_][\w]*)\s*(?=\()/ },            { type: 0, regex: /^[a-zA-Z_][\w]*/ },
            { type: 0, regex: /^(?:\/\/|->|:=|\*\*|<<|>>|[+\-*/%&|^~<>=!:.,;()\[\]{}@])/ },
            { type: 0, regex: /^[\s]+/ },
        ],
        java: [
            { type: 5, regex: /^\/\*\*[\s\S]*?\*\// },
            { type: 5, regex: /^\/\*[\s\S]*?\*\// },
            { type: 5, regex: /^\/\/[^\n]*/ },
            { type: 3, regex: /^"(?:\\[\s\S]|[^"\\])*"/ },
            { type: 3, regex: /^'(?:\\.|[^'\\])'/ },
            { type: 4, regex: /^0[xX][0-9a-fA-F]+[lL]?/ },
            { type: 4, regex: /^\d+\.?\d*(?:[eE][+-]?\d+)?[fFdDlL]?/ },
            { type: 2, regex: /^@[a-zA-Z_][\w]*/ },
            { type: 1, regex: /^\b(abstract|assert|boolean|break|byte|case|catch|char|class|const|continue|default|do|double|else|enum|extends|final|finally|float|for|goto|if|implements|import|instanceof|int|interface|long|native|new|null|package|private|protected|public|record|return|sealed|short|static|strictfp|super|switch|synchronized|this|throw|throws|transient|try|var|void|volatile|while|true|false)\b/ },
            { type: 1, regex: /^\b(String|Integer|Long|Double|Float|Boolean|Character|Byte|Short|Object|Class|System|Math|Arrays|Collections|List|ArrayList|LinkedList|Map|HashMap|LinkedHashMap|TreeMap|Set|HashSet|LinkedHashSet|TreeSet|Queue|Deque|ArrayDeque|PriorityQueue|Stack|Iterator|Iterable|Comparable|Comparator|Cloneable|Serializable|Runnable|Thread|Exception|RuntimeException|Error|Throwable|StringBuilder|StringBuffer|Number|Void|Optional|Stream|Collectors|Function|Supplier|Consumer|Predicate|BiFunction|CompletableFuture|Future|Enum|Record|Override|Deprecated|FunctionalInterface|SafeVarargs|SuppressWarnings)\b/ },
            { type: 2, regex: /^([a-zA-Z_$][\w$]*)\s*(?=\()/ },
            { type: 1, regex: /^\b[A-Z][a-zA-Z0-9_]*\b/ },
            { type: 0, regex: /^[a-zA-Z_$][\w$]*/ },
            { type: 0, regex: /^(?:>>>|<<=|>>=|\+\+|--|==|!=|<=|>=|&&|\|\||[-+*/%&|^~!<>=?:;,.()\[\]{}])/ },
            { type: 0, regex: /^[\s]+/ },
        ],
        c: [
            { type: 5, regex: /^\/\*[\s\S]*?\*\// },
            { type: 5, regex: /^\/\/[^\n]*/ },
            { type: 1, regex: /^#[^\n]*/ },
            { type: 3, regex: /^"(?:\\[\s\S]|[^"\\])*"/ },
            { type: 3, regex: /^'(?:\\.|[^'\\])'/ },
            { type: 4, regex: /^0[xX][0-9a-fA-F]+[uUlL]*/ },
            { type: 4, regex: /^\d+\.?\d*(?:[eE][+-]?\d+)?[fFlLuU]*/ },
            { type: 1, regex: /^\b(auto|break|case|char|const|continue|default|do|double|else|enum|extern|float|for|goto|if|inline|int|long|register|restrict|return|short|signed|sizeof|static|struct|switch|typedef|union|unsigned|void|volatile|while|NULL|true|false|bool)\b/ },
            { type: 2, regex: /^([a-zA-Z_][\w]*)\s*(?=\()/ },
            { type: 0, regex: /^[a-zA-Z_][\w]*/ },
            { type: 0, regex: /^(?:->|\+\+|--|<<=|>>=|==|!=|<=|>=|&&|\|\||[-+*/%&|^~!<>=?:;,.()\[\]{}])/ },
            { type: 0, regex: /^[\s]+/ },
        ],
        cpp: [
            { type: 5, regex: /^\/\*[\s\S]*?\*\// },
            { type: 5, regex: /^\/\/[^\n]*/ },
            { type: 1, regex: /^#[^\n]*/ },
            { type: 3, regex: /^R"([^(]*)\([\s\S]*?\)\1"/ },
            { type: 3, regex: /^"(?:\\[\s\S]|[^"\\])*"/ },
            { type: 3, regex: /^'(?:\\.|[^'\\])'/ },
            { type: 4, regex: /^0[xX][0-9a-fA-F]+(?:u?l{0,2}|l{0,2}u?)/ },
            { type: 4, regex: /^\d+\.?\d*(?:[eE][+-]?\d+)?(?:[fFlLuU]*)/ },
            { type: 1, regex: /^\b(alignas|alignof|and|and_eq|asm|atomic_cancel|atomic_commit|atomic_noexcept|auto|bitand|bitor|bool|break|case|catch|char|char8_t|char16_t|char32_t|class|compl|concept|const|consteval|constexpr|constinit|const_cast|continue|co_await|co_return|co_yield|decltype|default|delete|do|double|dynamic_cast|else|enum|explicit|export|extern|false|float|for|friend|goto|if|inline|int|long|mutable|namespace|new|noexcept|not|not_eq|nullptr|operator|or|or_eq|private|protected|public|register|reinterpret_cast|requires|return|short|signed|sizeof|static|static_assert|static_cast|struct|switch|template|this|thread_local|throw|true|try|typedef|typeid|typename|union|unsigned|using|virtual|void|volatile|wchar_t|while|xor|xor_eq|NULL|override|final)\b/ },
            { type: 1, regex: /^\b[A-Z][A-Z0-9_]*\b/ },
            { type: 1, regex: /^\b[A-Z][a-zA-Z0-9_]*\b/ },
            { type: 2, regex: /^([a-zA-Z_][\w]*)\s*(?=\()/ },
            { type: 0, regex: /^[a-zA-Z_][\w]*/ },
            { type: 0, regex: /^(?:->|\*=|\/=|%=|\+=|-=|<<=|>>=|&=|\^=|\|=|::|\+\+|--|==|!=|<=|>=|&&|\|\||[-+*/%&|^~!<>=?:;,.()\[\]{}])/ },            { type: 0, regex: /^[\s]+/ },
        ],
        csharp: [
            { type: 5, regex: /^\/\*[\s\S]*?\*\// },
            { type: 5, regex: /^\/\/\/[^\n]*/ },
            { type: 5, regex: /^\/\/[^\n]*/ },
            { type: 3, regex: /^@"(?:[^"]|"")*"/ },
            { type: 3, regex: /^\$"(?:\\[\s\S]|[^"\\])*"/ },
            { type: 3, regex: /^"(?:\\[\s\S]|[^"\\])*"/ },
            { type: 3, regex: /^'(?:\\.|[^'\\])'/ },
            { type: 4, regex: /^0[xX][0-9a-fA-F]+[uUlL]*/ },
            { type: 4, regex: /^\d+\.?\d*(?:[eE][+-]?\d+)?[mMfFdDuUlL]*/ },
            { type: 2, regex: /^\[(?:assembly:|module:|return:|param:)?[a-zA-Z_][\w]*(?:\(.*?\))?\]/ },
            { type: 1, regex: /^\b(abstract|add|alias|and|as|ascending|async|await|base|break|by|case|catch|checked|class|const|continue|default|delegate|descending|do|dynamic|else|equals|event|explicit|extern|false|finally|fixed|for|foreach|from|get|global|goto|group|if|implicit|in|init|interface|internal|into|is|join|let|lock|managed|nameof|namespace|new|not|null|on|operator|or|orderby|out|override|params|partial|private|protected|public|readonly|record|ref|remove|return|sealed|select|set|sizeof|stackalloc|static|struct|switch|this|throw|true|try|typeof|unchecked|unmanaged|unsafe|using|value|var|virtual|void|volatile|where|while|with|yield)\b/ },
            { type: 1, regex: /^\b(bool|byte|char|decimal|double|float|int|long|nint|nuint|object|sbyte|short|string|uint|ulong|ushort|Action|Func|Task|ValueTask|IEnumerable|IEnumerator|IQueryable|IList|IDictionary|ICollection|List|Dictionary|HashSet|Queue|Stack|Array|Tuple|ValueTuple|Nullable|Exception|Console|Math|String|DateTime|TimeSpan|Guid|Type|Assembly|Thread|Mutex|Monitor|Semaphore|Interlocked|Parallel|LINQ|Span|Memory|ReadOnlySpan)\b/ },
            { type: 2, regex: /^([a-zA-Z_@][\w]*)\s*(?=[(<])/ },
            { type: 1, regex: /^\b[A-Z][a-zA-Z0-9_]*\b/ },
            { type: 0, regex: /^@?[a-zA-Z_][\w]*/ },
            { type: 0, regex: /^(?:=>|::|\?\?=|\?\?|\?\.|\?\[|\+\+|--|==|!=|<=|>=|&&|\|\||[-+*/%&|^~!<>=?:;,.()\[\]{}])/ },
            { type: 0, regex: /^[\s]+/ },
        ],
        rust: [
            { type: 5, regex: /^\/\/!.*/ },
            { type: 5, regex: /^\/\/\/.*/ },
            { type: 5, regex: /^\/\*[\s\S]*?\*\// },
            { type: 5, regex: /^\/\/[^\n]*/ },
            { type: 3, regex: /^r#*"[\s\S]*?"#*/ },
            { type: 3, regex: /^b?"(?:\\[\s\S]|[^"\\])*"/ },
            { type: 3, regex: /^b?'(?:\\.|[^'\\])'/ },
            { type: 4, regex: /^0[xX][0-9a-fA-F_]+(?:_?[iu](?:8|16|32|64|128|size))?/ },
            { type: 4, regex: /^0[bB][01_]+(?:_?[iu](?:8|16|32|64|128|size))?/ },
            { type: 4, regex: /^0[oO][0-7_]+(?:_?[iu](?:8|16|32|64|128|size))?/ },
            { type: 4, regex: /^\d[\d_]*\.?\d*(?:[eE][+-]?\d+)?(?:_?(?:[iu](?:8|16|32|64|128|size)|f(?:32|64)))?/ },
            { type: 2, regex: /^#!?\[[\s\S]*?\]/ },
            { type: 1, regex: /^\b(as|async|await|break|const|continue|crate|do|dyn|else|enum|extern|false|fn|for|if|impl|in|let|loop|match|mod|move|mut|pub|ref|return|self|Self|static|struct|super|trait|true|try|type|union|unsafe|use|where|while|abstract|become|box|final|macro|override|priv|typeof|unsized|virtual|yield)\b/ },
            { type: 1, regex: /^\b(bool|char|f32|f64|i8|i16|i32|i64|i128|isize|str|u8|u16|u32|u64|u128|usize|String|Vec|HashMap|HashSet|BTreeMap|BTreeSet|Option|Result|Box|Rc|Arc|Cell|RefCell|Mutex|RwLock|Cow|Pin|Future|Stream|Iterator|Clone|Copy|Debug|Default|Display|Drop|Eq|From|Into|PartialEq|PartialOrd|Ord|Hash|Send|Sync|Sized|Unpin|Write|Read|Seek|Error|Fn|FnMut|FnOnce)\b/ },
            { type: 2, regex: /^'[a-zA-Z_][\w]*\b/ },
            { type: 2, regex: /^([a-zA-Z_][\w]*)\s*(?=!)/ },
            { type: 2, regex: /^([a-zA-Z_][\w]*)\s*(?=\()/ },
            { type: 1, regex: /^\b[A-Z][A-Z0-9_]+\b/ },
            { type: 1, regex: /^\b[A-Z][a-zA-Z0-9_]*\b/ },
            { type: 0, regex: /^[a-zA-Z_][\w]*/ },
            { type: 0, regex: /^(?:=>|->|::|\.\.=|\.\.|&&|\|\||\?\?|\+\+|--|==|!=|<=|>=|[-+*/%&|^~!<>=?:;,.()\[\]{}])/ },
            { type: 0, regex: /^[\s]+/ },
        ],
        golang: [
            { type: 5, regex: /^\/\*[\s\S]*?\*\// },
            { type: 5, regex: /^\/\/[^\n]*/ },
            { type: 3, regex: /^`[^`]*`/ },
            { type: 3, regex: /^"(?:\\[\s\S]|[^"\\])*"/ },            { type: 3, regex: /^'(?:\\.|[^'\\])'/ },
            { type: 4, regex: /^0[xX][0-9a-fA-F_]+/ },
            { type: 4, regex: /^0[bB][01_]+/ },
            { type: 4, regex: /^0[oO][0-7_]+/ },
            { type: 4, regex: /^\d[\d_]*\.?\d*(?:[eE][+-]?\d+)?[iFi]*/ },
            { type: 1, regex: /^\b(break|case|chan|const|continue|default|defer|else|fallthrough|for|func|go|goto|if|import|interface|map|package|range|return|select|struct|switch|type|var|true|false|nil|iota|append|cap|close|complex|copy|delete|imag|len|make|new|panic|print|println|real|recover)\b/ },
            { type: 1, regex: /^\b(bool|byte|complex64|complex128|error|float32|float64|int|int8|int16|int32|int64|rune|string|uint|uint8|uint16|uint32|uint64|uintptr|any|comparable|context|io|os|fmt|log|net|http|sync|atomic|bufio|bytes|strings|strconv|math|sort|time|errors|encoding|json|xml|csv|reflect|runtime|unsafe)\b/ },
            { type: 2, regex: /^([a-zA-Z_][\w]*)\s*(?=\()/ },
            { type: 1, regex: /^\b[A-Z][a-zA-Z0-9_]*\b/ },
            { type: 0, regex: /^[a-zA-Z_][\w]*/ },
            { type: 0, regex: /^(?::=|<-|\+\+|--|==|!=|<=|>=|&&|\|\||[-+*/%&|^~!<>=:;,.()\[\]{}])/ },
            { type: 0, regex: /^[\s]+/ },
        ],
        kotlin: [
            { type: 5, regex: /^\/\*[\s\S]*?\*\// },
            { type: 5, regex: /^\/\/[^\n]*/ },
            { type: 3, regex: /^"""[\s\S]*?"""/ },
            { type: 3, regex: /^"(?:\\[\s\S]|[^"\\])*"/ },
            { type: 3, regex: /^'(?:\\.|[^'\\])'/ },
            { type: 4, regex: /^0[xX][0-9a-fA-F_]+[lL]?/ },
            { type: 4, regex: /^\d[\d_]*\.?\d*(?:[eE][+-]?\d+)?[fFlL]?/ },
            { type: 2, regex: /^@[a-zA-Z_][\w]*/ },
            { type: 1, regex: /^\b(abstract|actual|annotation|as|break|by|catch|class|companion|const|constructor|continue|crossinline|data|do|dynamic|else|enum|expect|external|false|field|file|final|finally|for|fun|get|if|import|in|infix|init|inline|inner|interface|internal|is|it|lateinit|noinline|null|object|open|operator|out|override|package|param|private|property|protected|public|reified|return|sealed|set|super|suspend|tailrec|this|throw|true|try|typealias|typeof|val|value|var|vararg|when|where|while)\b/ },
            { type: 1, regex: /^\b(Any|Boolean|Byte|Char|Double|Float|Int|Long|Nothing|Number|Short|String|Unit|Array|List|MutableList|Map|MutableMap|Set|MutableSet|Pair|Triple|Sequence|Result|Exception|Throwable|Comparable|Iterable|Iterator|Collection|MutableCollection|HashMap|LinkedHashMap|HashSet|LinkedHashSet|ArrayList|ArrayDeque|CoroutineScope|Flow|StateFlow|SharedFlow|Job|Deferred|Channel|Mutex|Semaphore)\b/ },
            { type: 2, regex: /^([a-zA-Z_][\w]*)\s*(?=\()/ },
            { type: 1, regex: /^\b[A-Z][a-zA-Z0-9_]*\b/ },
            { type: 0, regex: /^[a-zA-Z_][\w]*/ },
            { type: 0, regex: /^(?:->|=>|::|\?\.|!!\.|\.\.|\+\+|--|==|!=|<=|>=|&&|\|\||[-+*/%&|^~!<>=?:;,.()\[\]{}])/ },
            { type: 0, regex: /^[\s]+/ },
        ],
        swift: [
            { type: 5, regex: /^\/\*[\s\S]*?\*\// },
            { type: 5, regex: /^\/\/\/[^\n]*/ },
            { type: 5, regex: /^\/\/[^\n]*/ },
            { type: 3, regex: /^#"(?:\\[\s\S]|[^"\\])*"#/ },
            { type: 3, regex: /^"(?:\\[\s\S]|[^"\\])*"/ },
            { type: 4, regex: /^0[xX][0-9a-fA-F_]+(?:\.[0-9a-fA-F_]+)?(?:[pP][+-]?\d+)?/ },
            { type: 4, regex: /^0[bB][01_]+/ },
            { type: 4, regex: /^0[oO][0-7_]+/ },
            { type: 4, regex: /^\d[\d_]*\.?\d*(?:[eE][+-]?\d+)?/ },
            { type: 2, regex: /^@[a-zA-Z_][\w]*/ },
            { type: 2, regex: /^#[a-zA-Z_][\w]*/ },
            { type: 1, regex: /^\b(actor|any|as|associatedtype|async|await|break|case|catch|class|continue|convenience|default|defer|deinit|didSet|do|dynamic|else|enum|extension|fallthrough|false|fileprivate|final|for|func|get|guard|if|import|in|indirect|infix|init|inout|internal|is|isolated|lazy|let|mutating|nil|nonisolated|nonmutating|open|operator|optional|override|postfix|precedencegroup|prefix|private|protocol|public|repeat|required|rethrows|return|set|some|static|struct|subscript|super|switch|throw|throws|true|try|type|typealias|unowned|var|weak|where|while|willSet)\b/ },
            { type: 1, regex: /^\b(Bool|Character|Double|Float|Float16|Float32|Float64|Float80|Int|Int8|Int16|Int32|Int64|String|UInt|UInt8|UInt16|UInt32|UInt64|Void|Any|AnyObject|Never|Optional|Array|Dictionary|Set|Tuple|Result|Error|Range|ClosedRange|Sequence|Collection|IteratorProtocol|Equatable|Hashable|Comparable|Codable|Encodable|Decodable|Identifiable|ObservableObject|Published|State|Binding|Environment|EnvironmentObject|View|Text|Button|Image|List|NavigationView|VStack|HStack|ZStack|Combine|Publisher|Subscriber|Subject|AnyCancellable|Task|TaskGroup|Actor|MainActor|AsyncStream|AsyncSequence|DispatchQueue|NotificationCenter|URLSession|NSObject)\b/ },
            { type: 2, regex: /^([a-zA-Z_][\w]*)\s*(?=\()/ },
            { type: 1, regex: /^\b[A-Z][a-zA-Z0-9_]*\b/ },
            { type: 0, regex: /^[a-zA-Z_][\w]*/ },
            { type: 0, regex: /^(?:->|\?\?|\?\.|\.\.\.|\.\.=|\+\+|--|==|!=|<=|>=|&&|\|\||[-+*/%&|^~!<>=?:;,.()\[\]{}])/ },
            { type: 0, regex: /^[\s]+/ },
        ],        dart: [
            { type: 5, regex: /^\/\*[\s\S]*?\*\// },
            { type: 5, regex: /^\/\/\/[^\n]*/ },
            { type: 5, regex: /^\/\/[^\n]*/ },
            { type: 3, regex: /^r"[^"]*"/ },
            { type: 3, regex: /^r'[^']*'/ },
            { type: 3, regex: /^"""[\s\S]*?"""/ },
            { type: 3, regex: /^'''[\s\S]*?'''/ },
            { type: 3, regex: /^"(?:\\[\s\S]|[^"\\])*"/ },
            { type: 3, regex: /^'(?:\\[\s\S]|[^'\\])*'/ },
            { type: 4, regex: /^0[xX][0-9a-fA-F]+/ },
            { type: 4, regex: /^\d+\.?\d*(?:[eE][+-]?\d+)?/ },
            { type: 2, regex: /^@[a-zA-Z_][\w]*/ },
            { type: 1, regex: /^\b(abstract|as|assert|async|await|base|break|case|catch|class|const|continue|covariant|default|deferred|do|dynamic|else|enum|export|extends|extension|external|factory|false|final|finally|for|Function|get|hide|if|implements|import|in|interface|is|late|library|mixin|new|null|on|operator|part|required|rethrow|return|sealed|set|show|static|super|switch|sync|this|throw|true|try|typedef|var|void|when|while|with|yield)\b/ },
            { type: 1, regex: /^\b(bool|double|int|List|Map|Never|Null|num|Object|Record|Set|String|Symbol|Type|Uri|BigInt|DateTime|Duration|Error|Exception|Future|Iterable|Iterator|Pattern|RegExp|RuneIterator|Runes|Sink|StackTrace|Stream|StreamController|Stopwatch|StringBuffer|StringSink|Comparable|Enum|identical|identical|print|identical|Future|Stream|Completer|Zone|StateError|AssertionError|CastError|ConcurrentModificationError|CyclicInitializationError|FallThroughError|FormatException|IntegerDivisionByZeroException|NoSuchMethodError|NullThrownError|OutOfMemoryError|RangeError|StackOverflowError|StateError|TypeError|UnimplementedError|UnsupportedError)\b/ },
            { type: 2, regex: /^([a-zA-Z_][\w]*)\s*(?=\()/ },
            { type: 1, regex: /^\b[A-Z][a-zA-Z0-9_]*\b/ },
            { type: 0, regex: /^[a-zA-Z_][\w]*/ },
            { type: 0, regex: /^(?:=>|\?\?=|\?\?|\?\.|\?\.\.|\.\.\.|\.\.|\+\+|--|==|!=|<=|>=|&&|\|\||[-+*/%&|^~!<>=?:;,.()\[\]{}])/ },
            { type: 0, regex: /^[\s]+/ },
        ],
        ruby: [
            { type: 5, regex: /^#[^\n]*/ },
            { type: 5, regex: /^=begin[\s\S]*?=end/ },
            { type: 3, regex: /^%[qQrwWiIsxu]?(?:[\[({\|<])((?:[^\])}|>\\]|\\.)*?)[\])}|>]/ },
            { type: 3, regex: /^"""[\s\S]*?"""/ },
            { type: 3, regex: /^"(?:\\[\s\S]|[^"\\])*"/ },
            { type: 3, regex: /^'(?:\\.|[^'\\])*'/ },
            { type: 3, regex: /^:[a-zA-Z_][\w]*/ },
            { type: 4, regex: /^0[xX][0-9a-fA-F_]+/ },
            { type: 4, regex: /^0[bB][01_]+/ },
            { type: 4, regex: /^\d[\d_]*\.?\d*(?:[eE][+-]?\d+)?/ },
            { type: 1, regex: /^\b(BEGIN|END|__ENCODING__|__END__|__FILE__|__LINE__|alias|and|begin|break|case|class|def|defined\?|do|else|elsif|end|ensure|false|for|if|in|module|next|nil|not|or|raise|redo|require|rescue|retry|return|self|super|then|true|undef|unless|until|when|while|yield|puts|print|p|pp|gets|chomp|include|extend|prepend|attr_accessor|attr_reader|attr_writer|private|protected|public|lambda|proc|block_given\?|frozen_literal|frozen_string_literal)\b/ },
            { type: 1, regex: /^\b(Array|BasicObject|Binding|Class|Complex|Data|Dir|Encoding|Enumerable|Enumerator|Exception|FalseClass|Fiber|File|Float|Frozen|GC|Hash|IO|Integer|Kernel|Marshal|Math|Method|Module|Mutex|NilClass|Numeric|Object|ObjectSpace|Proc|Process|Queue|Random|Rational|Regexp|Signal|StandardError|String|Struct|Symbol|Thread|ThreadGroup|Time|TracePoint|TrueClass|UnboundMethod|ARGF|ARGV|ENV|RUBY_ENGINE|RUBY_PLATFORM|RUBY_RELEASE_DATE|RUBY_REVISION|RUBY_VERSION|STDERR|STDIN|STDOUT|TOPLEVEL_BINDING)\b/ },
            { type: 2, regex: /^@@?[a-zA-Z_][\w]*/ },
            { type: 2, regex: /^\$[a-zA-Z_][\w$]*/ },
            { type: 2, regex: /^([a-zA-Z_][\w]*[!?]?)\s*(?=\()/ },
            { type: 0, regex: /^[a-zA-Z_][\w]*[!?]?/ },
            { type: 0, regex: /^(?:=>|::|\.\.\.|\.\.|<<=|>>=|==|!=|<=|>=|&&|\|\||[-+*\/%&|^~!<>=?:;,.()\[\]{}])/ },
            { type: 0, regex: /^[\s]+/ },
        ],
        php: [
            { type: 5, regex: /^\/\*[\s\S]*?\*\// },
            { type: 5, regex: /^\/\/[^\n]*/ },
            { type: 1, regex: /^#[^\n]*/ },
            { type: 1, regex: /^<<<['"]{0,1}([A-Z_]+)['"]{0,1}[\s\S]*?\1;/ },
            { type: 3, regex: /^"(?:\\[\s\S]|[^"\\])*"/ },
            { type: 3, regex: /^'(?:\\.|[^'\\])*'/ },
            { type: 4, regex: /^0[xX][0-9a-fA-F_]+/ },
            { type: 4, regex: /^0[bB][01_]+/ },            { type: 4, regex: /^\d[\d_]*\.?\d*(?:[eE][+-]?\d+)?/ },
            { type: 2, regex: /^#\[[\s\S]*?\]/ },
            { type: 1, regex: /^\b(abstract|and|array|as|break|callable|case|catch|class|clone|const|continue|declare|default|die|do|echo|else|elseif|empty|enddeclare|endfor|endforeach|endif|endswitch|endwhile|enum|eval|exit|extends|final|finally|fn|for|foreach|function|global|goto|if|implements|include|include_once|instanceof|insteadof|interface|isset|list|match|namespace|new|or|print|private|protected|public|readonly|require|require_once|return|static|switch|throw|trait|try|unset|use|var|while|xor|yield|null|true|false|NULL|TRUE|FALSE|self|parent|static)\b/ },
            { type: 1, regex: /^\b(int|float|bool|string|void|never|array|object|mixed|callable|iterable|null|false|true|Exception|Error|Throwable|ArrayAccess|Closure|Generator|Iterator|Traversable|Countable|Serializable|DateTime|DateTimeImmutable|DateInterval|DateTimeZone|SplStack|SplQueue|SplHeap|SplFixedArray|ArrayObject|stdClass|PDO|PDOStatement|PDOException|LogicException|RuntimeException|InvalidArgumentException|OutOfRangeException|BadMethodCallException|LengthException|DomainException|OverflowException|UnderflowException|OutOfBoundsException|UnexpectedValueException|BadFunctionCallException)\b/ },
            { type: 2, regex: /^\$[a-zA-Z_][\w]*/ },
            { type: 2, regex: /^([a-zA-Z_\\][\w\\]*)\s*(?=\()/ },
            { type: 1, regex: /^\b[A-Z][a-zA-Z0-9_]*\b/ },
            { type: 0, regex: /^[a-zA-Z_\\][\w\\]*/ },
            { type: 0, regex: /^(?:=>|->|::|\.\.\.|\?\?=|\?\?|\+\+|--|==|!=|<=|>=|===|!==|&&|\|\||[-+*\/%&|^~!<>=?:;,.()\[\]{}])/ },
            { type: 0, regex: /^[\s]+/ },
        ],
        scala: [
            { type: 5, regex: /^\/\*[\s\S]*?\*\// },
            { type: 5, regex: /^\/\/[^\n]*/ },
            { type: 3, regex: /^"""[\s\S]*?"""/ },
            { type: 3, regex: /^"(?:\\[\s\S]|[^"\\])*"/ },
            { type: 3, regex: /^'(?:\\.|[^'\\])'/ },
            { type: 3, regex: /^'[a-zA-Z_][\w]*/ },
            { type: 4, regex: /^0[xX][0-9a-fA-F]+[lL]?/ },
            { type: 4, regex: /^\d[\d_]*\.?\d*(?:[eE][+-]?\d+)?[fFdDlL]?/ },
            { type: 2, regex: /^@[a-zA-Z_][\w]*/ },
            { type: 1, regex: /^\b(abstract|case|catch|class|def|do|else|enum|export|extends|final|finally|for|forSome|given|if|implicit|import|lazy|match|new|null|object|override|package|private|protected|requires|return|sealed|super|then|this|throw|trait|try|true|false|type|using|val|var|while|with|yield)\b/ },
            { type: 1, regex: /^\b(Any|AnyRef|AnyVal|Boolean|Byte|Char|Double|Float|Int|Long|Nothing|Null|Short|String|Unit|Array|List|Map|Option|Some|None|Either|Left|Right|Try|Success|Failure|Future|Promise|Seq|Set|Vector|Stream|LazyList|Iterator|Iterable|Collection|Tuple|Product|Serializable|Comparable|Ordered|Ordering|Numeric|Integral|Fractional|Function|PartialFunction|BigInt|BigDecimal|Symbol|Class|ClassTag|TypeTag|WeakTypeTag|Manifest|OptManifest|Equiv|Throwable|Exception|Error|RuntimeException)\b/ },
            { type: 2, regex: /^([a-zA-Z_][\w]*)\s*(?=\()/ },
            { type: 1, regex: /^\b[A-Z][a-zA-Z0-9_]*\b/ },
            { type: 0, regex: /^[a-zA-Z_][\w]*/ },
            { type: 0, regex: /^(?:=>|->|<-|::|<:>|<!|>:|=:=|\+\+|--|==|!=|<=|>=|&&|\|\||[-+*\/%&|^~!<>=?:;,.()\[\]{}])/ },
            { type: 0, regex: /^[\s]+/ },
        ],
        elixir: [
            { type: 5, regex: /^#[^\n]*/ },
            { type: 3, regex: /^~[A-Z]"""[\s\S]*?"""/ },
            { type: 3, regex: /^~[a-z]"[^"]*"[a-z]*/ },
            { type: 3, regex: /^~[a-z]'[^']*'[a-z]*/ },
            { type: 3, regex: /^"""[\s\S]*?"""/ },
            { type: 3, regex: /^"(?:\\[\s\S]|[^"\\])*"/ },
            { type: 3, regex: /^'(?:\\.|[^'\\])*'/ },
            { type: 3, regex: /^:[a-zA-Z_!?][\w!?]*/ },
            { type: 4, regex: /^0[xX][0-9a-fA-F_]+/ },
            { type: 4, regex: /^0[bB][01_]+/ },
            { type: 4, regex: /^0[oO][0-7_]+/ },
            { type: 4, regex: /^\d[\d_]*\.?\d*(?:[eE][+-]?\d+)?/ },
            { type: 2, regex: /^@[a-zA-Z_][\w]*/ },
            { type: 1, regex: /^\b(after|alias|and|catch|cond|def|defcallback|defdelegate|defexception|defguard|defguardp|defimpl|defmacro|defmacrop|defmodule|defoverridable|defp|defprotocol|defstruct|do|else|end|fn|for|if|import|in|not|or|quote|raise|receive|require|rescue|try|unless|unquote|unquote_splicing|use|when|with|true|false|nil)\b/ },
            { type: 1, regex: /^\b(Atom|BitString|Boolean|Float|Function|Integer|List|Map|Nil|PID|Port|Reference|String|Tuple|Any|Enumerable|Collectable|Inspect|String.Chars|List.Chars|Enum|Stream|Map|MapSet|Keyword|Agent|Task|GenServer|GenEvent|Supervisor|Application|Module|Code|System|File|IO|Path|Node|Process|Registry|ETS|DETS|Logger)\b/ },
            { type: 2, regex: /^([a-zA-Z_][\w]*[!?]?)\s*(?=[\(\s])/ },
            { type: 0, regex: /^[a-zA-Z_][\w]*[!?]?/ },
            { type: 0, regex: /^(?:->|=>|<>|\|>|\.\.|\+\+|--|==|!=|<=|>=|&&|\|\||[-+*\/%&|^~!<>=?:;,.()\[\]{}])/ },
            { type: 0, regex: /^[\s]+/ },
        ],        lua: [
            { type: 5, regex: /^--\[\[[\s\S]*?\]\]/ },
            { type: 5, regex: /^--[^\n]*/ },
            { type: 3, regex: /^\[\[[\s\S]*?\]\]/ },
            { type: 3, regex: /^"(?:\\[\s\S]|[^"\\])*"/ },
            { type: 3, regex: /^'(?:\\.|[^'\\])*'/ },
            { type: 4, regex: /^0[xX][0-9a-fA-F]+(?:\.[0-9a-fA-F]+)?(?:[pP][+-]?\d+)?/ },
            { type: 4, regex: /^\d+\.?\d*(?:[eE][+-]?\d+)?/ },
            { type: 1, regex: /^\b(and|break|do|else|elseif|end|false|for|function|goto|if|in|local|nil|not|or|repeat|return|then|true|until|while|print|require|ipairs|pairs|next|select|type|tostring|tonumber|setmetatable|getmetatable|rawget|rawset|rawequal|rawlen|pcall|xpcall|error|assert|load|loadfile|dofile|collectgarbage|coroutine|debug|io|math|os|package|string|table|utf8)\b/ },
            { type: 1, regex: /^\b[A-Z][A-Z0-9_]+\b/ },
            { type: 2, regex: /^([a-zA-Z_][\w]*)\s*(?=\()/ },
            { type: 0, regex: /^[a-zA-Z_][\w]*/ },
            { type: 0, regex: /^(?:\.\.\.|\.\.|==|~=|<=|>=|[-+*\/%^#&|~!<>=:;,.()\[\]{}])/ },
            { type: 0, regex: /^[\s]+/ },
        ],
        r: [
            { type: 5, regex: /^#[^\n]*/ },
            { type: 3, regex: /^"(?:\\[\s\S]|[^"\\])*"/ },
            { type: 3, regex: /^'(?:\\.|[^'\\])*'/ },
            { type: 4, regex: /^0[xX][0-9a-fA-F]+[lL]?/ },
            { type: 4, regex: /^\d+\.?\d*(?:[eE][+-]?\d+)?[iL]?/ },
            { type: 1, regex: /^\b(break|else|for|function|if|in|next|repeat|return|while|TRUE|FALSE|NULL|NA|NA_integer_|NA_real_|NA_complex_|NA_character_|Inf|NaN|T|F)\b/ },
            { type: 1, regex: /^\b(character|complex|double|integer|list|logical|numeric|raw|vector|matrix|array|data\.frame|factor|environment|formula|function|closure|special|builtin|promise|language|char|symbol|any|expression|bytecode|weakref|externalptr|raw|c|library|require|source|data|scan|read\.table|write\.table|cat|print|sprintf|format|paste|paste0|which|length|nchar|nrow|ncol|dim|str|summary|table|apply|sapply|lapply|tapply|vapply|mapply|Reduce|Filter|Map|Find|Position|do\.call|match|pmatch|charmatch|switch|tryCatch|withCallingHandlers|try|stop|warning|message|on\.exit|sys\.call|sys\.function|match\.call|match\.arg)\b/ },
            { type: 2, regex: /^([a-zA-Z_.][\w.]*)\s*(?=\()/ },
            { type: 0, regex: /^[a-zA-Z_.][\w.]*/ },
            { type: 0, regex: /^(?:<<-|->|->>|<-|->|\|>|:::|::|%%|%in%|%\*%|%o%|%x%|==|!=|<=|>=|[-+*\/%^&|~!<>=:;,.()\[\]{}])/ },
            { type: 0, regex: /^[\s]+/ },
        ],
        sql: [
            { type: 5, regex: /^--[^\n]*/ },
            { type: 5, regex: /^\/\*[\s\S]*?\*\// },
            { type: 3, regex: /^"(?:[^"\\]|\\.)*"/ },
            { type: 3, regex: /^'(?:[^'\\]|\\.)*'/ },
            { type: 3, regex: /^`[^`]*`/ },
            { type: 4, regex: /^\d+\.?\d*(?:[eE][+-]?\d+)?/ },
            { type: 1, regex: /^\b(ADD|ALL|ALTER|AND|ANY|AS|ASC|BACKUP|BETWEEN|BY|CASCADE|CASE|CHECK|COLUMN|CONSTRAINT|CREATE|CROSS|DATABASE|DEFAULT|DELETE|DESC|DISTINCT|DROP|EACH|ELSE|END|EXCEPT|EXISTS|EXPLAIN|FOREIGN|FROM|FULL|GROUP|HAVING|IN|INDEX|INNER|INSERT|INTERSECT|INTO|IS|JOIN|KEY|LEFT|LIKE|LIMIT|NATURAL|NOT|NULL|ON|ORDER|OUTER|OVER|PARTITION|PRIMARY|PROCEDURE|RECURSIVE|REFERENCES|RENAME|REPLACE|RIGHT|ROLLBACK|ROW|SELECT|SET|SHOW|TABLE|THEN|TRANSACTION|TRIGGER|TRUNCATE|UNION|UNIQUE|UPDATE|USE|USING|VALUES|VIEW|WHEN|WHERE|WITH|add|all|alter|and|any|as|asc|backup|between|by|cascade|case|check|column|constraint|create|cross|database|default|delete|desc|distinct|drop|each|else|end|except|exists|explain|foreign|from|full|group|having|in|index|inner|insert|intersect|into|is|join|key|left|like|limit|natural|not|null|on|order|outer|over|partition|primary|procedure|recursive|references|rename|replace|right|rollback|row|select|set|show|table|then|transaction|trigger|truncate|union|unique|update|use|using|values|view|when|where|with)\b/ },
            { type: 1, regex: /^\b(BIGINT|BINARY|BIT|BLOB|BOOLEAN|CHAR|CHARACTER|CLOB|DATE|DATETIME|DECIMAL|DOUBLE|FLOAT|INT|INTEGER|JSON|LONGBLOB|LONGTEXT|MEDIUMBLOB|MEDIUMINT|MEDIUMTEXT|NATIONAL|NCHAR|NCLOB|NTEXT|NUMERIC|NVARCHAR|REAL|SERIAL|SMALLINT|TEXT|TIME|TIMESTAMP|TINYBLOB|TINYINT|TINYTEXT|UUID|VARBINARY|VARCHAR|YEAR|bigint|binary|bit|blob|boolean|char|character|clob|date|datetime|decimal|double|float|int|integer|json|longblob|longtext|mediumblob|mediumint|mediumtext|national|nchar|nclob|ntext|numeric|nvarchar|real|serial|smallint|text|time|timestamp|tinyblob|tinyint|tinytext|uuid|varbinary|varchar|year)\b/ },
            { type: 2, regex: /^\b(COUNT|SUM|AVG|MIN|MAX|COALESCE|NULLIF|IFNULL|ISNULL|CAST|CONVERT|SUBSTR|SUBSTRING|LENGTH|UPPER|LOWER|TRIM|REPLACE|CONCAT|NOW|CURDATE|CURTIME|DATE_FORMAT|DATEDIFF|DATEADD|EXTRACT|YEAR|MONTH|DAY|HOUR|MINUTE|SECOND|ROUND|FLOOR|CEIL|CEILING|ABS|MOD|POWER|SQRT|RAND|RANK|ROW_NUMBER|DENSE_RANK|NTILE|LAG|LEAD|FIRST_VALUE|LAST_VALUE|NTH_VALUE|OVER|PARTITION|count|sum|avg|min|max|coalesce|nullif|ifnull|isnull|cast|convert|substr|substring|length|upper|lower|trim|replace|concat|now|curdate|curtime|date_format|datediff|dateadd|extract|year|month|day|hour|minute|second|round|floor|ceil|ceiling|abs|mod|power|sqrt|rand|rank|row_number|dense_rank|ntile|lag|lead|first_value|last_value|nth_value|over|partition)\b/ },
            { type: 0, regex: /^[a-zA-Z_][\w]*/ },
            { type: 0, regex: /^(?:<>|!=|<=|>=|[-+*\/%<>=!;,.()\[\]{}])/ },
            { type: 0, regex: /^[\s]+/ },
        ],
        bash: [
            { type: 1, regex: /^#![^\n]*/ },
            { type: 5, regex: /^#[^\n]*/ },
            { type: 3, regex: /^\$'(?:[^'\\]|\\.)*'/ },
            { type: 3, regex: /^"(?:\\[\s\S]|[^"\\])*"/ },
            { type: 3, regex: /^'[^']*'/ },
            { type: 4, regex: /^\d+/ },
            { type: 1, regex: /^\b(break|case|continue|do|done|elif|else|esac|eval|exec|exit|export|fi|for|function|if|in|local|read|readonly|return|select|set|shift|source|then|time|trap|type|typeset|ulimit|umask|unset|until|while)\b/ },            { type: 1, regex: /^\b(alias|awk|basename|bc|bg|bind|builtin|cat|cd|chmod|chown|command|compgen|complete|cp|curl|cut|date|declare|df|diff|dirname|du|echo|enable|env|false|fg|find|getopts|grep|head|help|history|hostname|jobs|kill|let|ln|ls|man|mapfile|mkdir|mktemp|mv|nice|nohup|open|popd|printf|ps|pushd|pwd|readarray|realpath|rm|rmdir|sed|sleep|sort|ssh|stat|sudo|tail|tar|tee|test|timeout|touch|tr|true|unalias|uniq|wait|wc|which|xargs|zip|zcat)\b/ },
            { type: 2, regex: /^\$\{[^}]*\}/ },
            { type: 2, regex: /^\$(?:[a-zA-Z_][\w]*|\d+|\?|@|\*|#|\$|!|-)/ },
            { type: 2, regex: /^([a-zA-Z_][\w]*)\s*(?=\()/ },
            { type: 0, regex: /^[a-zA-Z_][\w]*/ },
            { type: 0, regex: /^(?:;;|&&|\|\||>>|<<|[-+*\/%&|^~!<>=:;,.()[\]{}])/ },
            { type: 0, regex: /^[\s]+/ },
        ],
        powershell: [
            { type: 5, regex: /^<#[\s\S]*?#>/ },
            { type: 5, regex: /^#[^\n]*/ },
            { type: 3, regex: /^@"[\s\S]*?"@/ },
            { type: 3, regex: /^@'[\s\S]*?'@/ },
            { type: 3, regex: /^"(?:\\[\s\S]|[^"\\])*"/ },
            { type: 3, regex: /^'[^']*'/ },
            { type: 4, regex: /^\d+\.?\d*(?:[eE][+-]?\d+)?/ },
            { type: 2, regex: /^\[(?:[a-zA-Z][\w.]*)\]/ },
            { type: 1, regex: /^\b(?:begin|break|catch|class|continue|data|define|do|dynamicparam|else|elseif|end|enum|exit|filter|finally|for|foreach|from|function|hidden|if|in|inlinescript|parallel|param|process|return|sequence|static|switch|throw|trap|try|until|using|var|while|workflow)\b/i },
            { type: 2, regex: /^\$[a-zA-Z_?][\w]*/ },
            { type: 2, regex: /^\b(?:Get|Set|New|Remove|Add|Clear|Copy|Move|Rename|Test|Invoke|Start|Stop|Restart|Suspend|Resume|Wait|Write|Read|Format|Select|Sort|Where|Group|Measure|Compare|Convert|Join|Split|Out|Import|Export|Register|Unregister|Enable|Disable|Show|Hide|Push|Pop|Enter|Exit)-[a-zA-Z]+\b/ },
            { type: 0, regex: /^[a-zA-Z_][\w]*/ },
            { type: 0, regex: /^(?:-eq|-ne|-lt|-le|-gt|-ge|-like|-notlike|-match|-notmatch|-contains|-notcontains|-in|-notin|-is|-isnot|-band|-bor|-bxor|-bnot|-shl|-shr|&&|\|\||\+\+|--|==|!=|<=|>=|[-+*\/%&|^~!<>=:;,.()[\]{}@])/ },
            { type: 0, regex: /^[\s]+/ },
        ],
        html: [
            { type: 5, regex: /^<!--[\s\S]*?-->/ },
            { type: 5, regex: /^<!DOCTYPE[^>]*>/i },
            { type: 3, regex: /^"[^"]*"/ },
            { type: 3, regex: /^'[^']*'/ },
            { type: 1, regex: /^<\/?(?:a|abbr|address|area|article|aside|audio|b|base|bdi|bdo|blockquote|body|br|button|canvas|caption|cite|code|col|colgroup|data|datalist|dd|del|details|dfn|dialog|div|dl|dt|em|embed|fieldset|figcaption|figure|footer|form|h[1-6]|head|header|hgroup|hr|html|i|iframe|img|input|ins|kbd|label|legend|li|link|main|map|mark|menu|meta|meter|nav|noscript|object|ol|optgroup|option|output|p|picture|pre|progress|q|rp|rt|ruby|s|samp|script|section|select|slot|small|source|span|strong|style|sub|summary|sup|table|tbody|td|template|textarea|tfoot|th|thead|time|title|tr|track|u|ul|var|video|wbr)\b/i },
            { type: 2, regex: /^\b[a-zA-Z-]+=/ },
            { type: 0, regex: /^[<>\/=]/ },
            { type: 0, regex: /^[a-zA-Z_-][\w-]*/ },
            { type: 0, regex: /^[\s]+/ },
            { type: 0, regex: /^[^<>"'\s=]+/ },
        ],
        css: [
            { type: 5, regex: /^\/\*[\s\S]*?\*\// },
            { type: 3, regex: /^"[^"]*"/ },
            { type: 3, regex: /^'[^']*'/ },
            { type: 4, regex: /^#[0-9a-fA-F]{3,8}\b/ },
            { type: 4, regex: /^\d+\.?\d*(?:px|em|rem|vh|vw|vmin|vmax|%|s|ms|deg|rad|turn|fr|pt|pc|cm|mm|in|ex|ch|svh|svw|dvh|dvw|cqi|cqb)?/ },
            { type: 1, regex: /^@(?:charset|color-profile|container|counter-style|font-face|font-feature-values|font-palette-values|import|keyframes|layer|media|namespace|page|property|scroll-timeline|supports|viewport|-webkit-keyframes)\b/ },
            { type: 1, regex: /^::?(?:after|backdrop|before|cue|first-letter|first-line|grammar-error|marker|part|placeholder|selection|slotted|spelling-error|file-selector-button|-webkit-input-placeholder|-webkit-scrollbar|-webkit-scrollbar-thumb|-webkit-scrollbar-track)\b/ },
            { type: 2, regex: /^:[a-zA-Z-]+(?:\([^)]*\))?/ },
            { type: 2, regex: /^\b(?:rgb|rgba|hsl|hsla|hwb|lch|oklch|lab|oklab|color|env|var|calc|min|max|clamp|url|format|local|linear-gradient|radial-gradient|conic-gradient|repeating-linear-gradient|repeating-radial-gradient|image-set|cross-fade|element|paint|counter|counters|attr|translate|rotate|scale|skew|matrix|perspective|scaleX|scaleY|scaleZ|rotateX|rotateY|rotateZ|translateX|translateY|translateZ|blur|brightness|contrast|drop-shadow|grayscale|hue-rotate|invert|opacity|saturate|sepia)\b/ },
            { type: 1, regex: /^\b(?:accent-color|align-content|align-items|align-self|all|animation|appearance|aspect-ratio|backdrop-filter|background|border|bottom|box-shadow|box-sizing|break-after|break-before|break-inside|caption-side|caret-color|clear|clip|clip-path|color|columns|content|counter|cursor|direction|display|empty-cells|filter|flex|float|font|gap|grid|height|isolation|justify|left|letter-spacing|line-height|list-style|margin|mask|max-height|max-width|min-height|min-width|mix-blend-mode|object-fit|object-position|offset|opacity|order|orphans|outline|overflow|padding|page|pointer-events|position|print-color-adjust|quotes|resize|right|rotate|row-gap|scale|scroll|shape-image-threshold|shape-margin|shape-outside|tab-size|table-layout|text|top|touch-action|transform|transition|translate|unicode-bidi|user-select|vertical-align|visibility|white-space|widows|width|will-change|word|writing-mode|z-index)[a-zA-Z-]*\b/ },
            { type: 0, regex: /^[.#]?[a-zA-Z_-][\w-]*/ },
            { type: 0, regex: /^[:;{}()\[\],+>~*]/ },
            { type: 0, regex: /^[\s]+/ },        ],
        scss: [
            { type: 5, regex: /^\/\/[^\n]*/ },
            { type: 5, regex: /^\/\*[\s\S]*?\*\// },
            { type: 3, regex: /^"[^"]*"/ },
            { type: 3, regex: /^'[^']*'/ },
            { type: 4, regex: /^#[0-9a-fA-F]{3,8}\b/ },
            { type: 4, regex: /^\d+\.?\d*(?:px|em|rem|vh|vw|%|s|ms|deg|rad|turn|fr|pt|pc|cm|mm|in)?/ },
            { type: 1, regex: /^@(?:charset|content|debug|each|else|error|extend|for|forward|function|if|import|include|keyframes|layer|media|mixin|return|supports|use|warn|while)\b/ },
            { type: 2, regex: /^\$[a-zA-Z_-][\w-]*/ },
            { type: 2, regex: /^&(?=[\s:.\[#,{])/ },
            { type: 2, regex: /^\b[a-zA-Z_-][\w-]*\s*(?=\()/ },
            { type: 0, regex: /^[a-zA-Z_-][\w-]*/ },
            { type: 0, regex: /^[:;{}()\[\],+>~*!]/ },
            { type: 0, regex: /^[\s]+/ },
        ],
        json: [
            { type: 3, regex: /^"(?:\\[\s\S]|[^"\\])*"/ },
            { type: 4, regex: /^-?\d+\.?\d*(?:[eE][+-]?\d+)?/ },
            { type: 1, regex: /^\b(true|false|null)\b/ },
            { type: 0, regex: /^[{}[\]:,]/ },
            { type: 0, regex: /^[\s]+/ },
        ],
        yaml: [
            { type: 5, regex: /^#[^\n]*/ },
            { type: 3, regex: /^"(?:\\[\s\S]|[^"\\])*"/ },
            { type: 3, regex: /^'[^']*'/ },
            { type: 3, regex: /^\|[-+]?(?:\n(?:  [^\n]*))+/ },
            { type: 3, regex: /^>[-+]?(?:\n(?:  [^\n]*))+/ },
            { type: 4, regex: /^(?:0[xX][0-9a-fA-F]+|0[oO][0-7]+|0[bB][01]+|\d+\.?\d*(?:[eE][+-]?\d+)?)/ },
            { type: 1, regex: /^\b(true|false|null|yes|no|on|off|True|False|Null|Yes|No|On|Off|TRUE|FALSE|NULL|YES|NO|ON|OFF)\b/ },
            { type: 5, regex: /^---/ },
            { type: 5, regex: /^\.\.\./ },
            { type: 2, regex: /^&[a-zA-Z_][\w]*/ },
            { type: 2, regex: /^\*[a-zA-Z_][\w]*/ },
            { type: 2, regex: /^!![a-zA-Z/]+/ },
            { type: 2, regex: /^[a-zA-Z_][\w]*(?=\s*:)/ },
            { type: 0, regex: /^[-:?|>&*!%@`[\]{},]/ },
            { type: 0, regex: /^[^\s:[\]{},]+/ },
            { type: 0, regex: /^[\s]+/ },
        ],
        toml: [
            { type: 5, regex: /^#[^\n]*/ },
            { type: 3, regex: /^"""[\s\S]*?"""/ },
            { type: 3, regex: /^'''[\s\S]*?'''/ },
            { type: 3, regex: /^"(?:\\[\s\S]|[^"\\])*"/ },
            { type: 3, regex: /^'[^']*'/ },
            { type: 4, regex: /^(?:0[xX][0-9a-fA-F_]+|0[oO][0-7_]+|0[bB][01_]+)/ },
            { type: 4, regex: /^[-+]?(?:inf|nan|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d[\d_]*)?)/ },
            { type: 4, regex: /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?/ },            { type: 1, regex: /^\b(true|false)\b/ },
            { type: 1, regex: /^\[\[[^\]]+\]\]/ },
            { type: 1, regex: /^\[[^\]]+\]/ },
            { type: 2, regex: /^[a-zA-Z_][\w.-]*(?=\s*=)/ },
            { type: 0, regex: /^[=,{}\[\].]/ },
            { type: 0, regex: /^[^\s=,{}\[\].]+/ },
            { type: 0, regex: /^[\s]+/ },
        ],
        graphql: [
            { type: 5, regex: /^"""[\s\S]*?"""/ },
            { type: 5, regex: /^#[^\n]*/ },
            { type: 3, regex: /^"(?:\\[\s\S]|[^"\\])*"/ },
            { type: 4, regex: /^-?\d+\.?\d*(?:[eE][+-]?\d+)?/ },
            { type: 1, regex: /^\b(directive|enum|extend|false|fragment|implements|input|interface|mutation|null|on|query|repeatable|scalar|schema|subscription|true|type|union|@deprecated|@external|@key|@provides|@requires|@skip|@include|@specifiedBy)\b/ },
            { type: 2, regex: /^@[a-zA-Z_][\w]*/ },
            { type: 1, regex: /^\b(Boolean|Float|ID|Int|String)\b/ },
            { type: 2, regex: /^([a-zA-Z_][\w]*)\s*(?=\()/ },
            { type: 1, regex: /^\b[A-Z][a-zA-Z0-9_]*\b/ },
            { type: 0, regex: /^[a-zA-Z_][\w]*/ },
            { type: 0, regex: /^(?:\.\.\.|[-!:=|&()\[\]{}])/ },
            { type: 0, regex: /^[\s]+/ },
        ],
        dockerfile: [
            { type: 5, regex: /^#[^\n]*/ },
            { type: 3, regex: /^"(?:\\[\s\S]|[^"\\])*"/ },
            { type: 3, regex: /^'[^']*'/ },
            { type: 1, regex: /^\b(ADD|ARG|CMD|COPY|ENTRYPOINT|ENV|EXPOSE|FROM|HEALTHCHECK|LABEL|MAINTAINER|ONBUILD|RUN|SHELL|STOPSIGNAL|USER|VOLUME|WORKDIR|add|arg|cmd|copy|entrypoint|env|expose|from|healthcheck|label|maintainer|onbuild|run|shell|stopsignal|user|volume|workdir)\b/ },
            { type: 2, regex: /^\$\{[^}]*\}/ },
            { type: 2, regex: /^\$[a-zA-Z_][\w]*/ },
            { type: 0, regex: /^[^\s"'$]+/ },
            { type: 0, regex: /^[\s]+/ },
        ],
        markdown: [
            { type: 5, regex: /^```[\s\S]*?```/ },
            { type: 5, regex: /^~~~[\s\S]*?~~~/ },
            { type: 1, regex: /^#{1,6} [^\n]+/ },
            { type: 2, regex: /^\*\*\*(?:[^*\\]|\\.)+\*\*\*/ },
            { type: 2, regex: /^___(?:[^_\\]|\\.)+___/ },
            { type: 1, regex: /^\*\*(?:[^*\\]|\\.)+\*\*/ },
            { type: 1, regex: /^__(?:[^_\\]|\\.)+__/ },
            { type: 3, regex: /^\*(?:[^*\\]|\\.)+\*/ },
            { type: 3, regex: /^_(?:[^_\\]|\\.)+_/ },
            { type: 4, regex: /^`[^`]+`/ },
            { type: 5, regex: /^~~[^~]+~~/ },
            { type: 2, regex: /^!?\[[^\]]*\]\([^)]*\)/ },
            { type: 2, regex: /^!?\[[^\]]*\]\[[^\]]*\]/ },
            { type: 5, regex: /^>[^\n]*/ },
            { type: 1, regex: /^(?:[-*+]|\d+\.)\s/ },
            { type: 0, regex: /^(?:-{3,}|\*{3,}|_{3,})/ },
            { type: 0, regex: /^[^\n*_`#[\]!>~]+/ },            { type: 0, regex: /^[\s\S]/ },
        ],
        solidity: [
            { type: 5, regex: /^\/\*[\s\S]*?\*\// },
            { type: 5, regex: /^\/\/[^\n]*/ },
            { type: 3, regex: /^"(?:\\[\s\S]|[^"\\])*"/ },
            { type: 3, regex: /^'(?:\\.|[^'\\])*'/ },
            { type: 3, regex: /^unicode"(?:\\[\s\S]|[^"\\])*"/ },
            { type: 4, regex: /^0[xX][0-9a-fA-F]+/ },
            { type: 4, regex: /^\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/ },
            { type: 2, regex: /^@[a-zA-Z_][\w]*/ },
            { type: 1, regex: /^\b(abstract|assembly|break|catch|constant|constructor|continue|contract|delete|do|else|emit|enum|error|event|external|fallback|false|for|from|function|if|immutable|import|indexed|interface|internal|is|library|mapping|memory|modifier|new|override|payable|pragma|private|public|pure|receive|return|returns|revert|storage|struct|super|this|throw|true|try|type|unchecked|using|view|virtual|while)\b/ },
            { type: 1, regex: /^\b(address|bool|bytes|bytes1|bytes2|bytes4|bytes8|bytes16|bytes32|int|int8|int16|int32|int64|int128|int256|string|uint|uint8|uint16|uint32|uint64|uint128|uint256|fixed|ufixed|tuple|msg|block|tx|abi|now|gasleft|selfdestruct|keccak256|sha256|sha3|ripemd160|ecrecover|addmod|mulmod|create2|blockhash|require|assert|revert|transfer|send|call|delegatecall|staticcall)\b/ },
            { type: 2, regex: /^([a-zA-Z_][\w]*)\s*(?=\()/ },
            { type: 1, regex: /^\b[A-Z][a-zA-Z0-9_]*\b/ },
            { type: 0, regex: /^[a-zA-Z_][\w]*/ },
            { type: 0, regex: /^(?:=>|->|:=|\.\.|\+\+|--|==|!=|<=|>=|&&|\|\||[-+*\/%&|^~!<>=?:;,.()\[\]{}])/ },
            { type: 0, regex: /^[\s]+/ },
        ],
        terraform: [
            { type: 5, regex: /^#[^\n]*/ },
            { type: 5, regex: /^\/\/[^\n]*/ },
            { type: 5, regex: /^\/\*[\s\S]*?\*\// },
            { type: 3, regex: /^<<-?([A-Z_]+)\n[\s\S]*?\1/ },
            { type: 3, regex: /^"(?:\\[\s\S]|[^"\\])*"/ },
            { type: 4, regex: /^-?\d+\.?\d*/ },
            { type: 1, regex: /^\b(data|dynamic|for|for_each|if|in|local|locals|module|null|output|provider|provisioner|required_providers|required_version|resource|terraform|variable|backend|connection|content|each|lifecycle|lookup|path|self|true|false|count|depends_on|provider|ignore_changes|create_before_destroy|prevent_destroy|replace_triggered_by|moved|check|assert|import)\b/ },
            { type: 1, regex: /^\b(?:string|number|bool|list|map|set|object|tuple|any)\b/ },
            { type: 2, regex: /^([a-zA-Z_][\w-]*)\s*(?=\()/ },
            { type: 0, regex: /^[a-zA-Z_][\w-]*/ },
            { type: 0, regex: /^(?:=>|\?\s*:|&&|\|\||[=!<>]=|[-+*\/%&|^~!<>=?:;,.(){}\[\]])/ },
            { type: 0, regex: /^[\s]+/ },
        ],
        protobuf: [
            { type: 5, regex: /^\/\/[^\n]*/ },
            { type: 5, regex: /^\/\*[\s\S]*?\*\// },
            { type: 3, regex: /^"(?:\\[\s\S]|[^"\\])*"/ },
            { type: 4, regex: /^0[xX][0-9a-fA-F]+/ },
            { type: 4, regex: /^\d+\.?\d*(?:[eE][+-]?\d+)?/ },
            { type: 1, regex: /^\b(bool|bytes|double|enum|extend|extensions|false|fixed32|fixed64|float|import|int32|int64|map|max|message|oneof|optional|package|repeated|reserved|returns|rpc|service|sfixed32|sfixed64|sint32|sint64|stream|string|syntax|to|true|uint32|uint64|weak)\b/ },
            { type: 1, regex: /^\b[A-Z][a-zA-Z0-9_]*\b/ },
            { type: 0, regex: /^[a-zA-Z_][\w]*/ },
            { type: 0, regex: /^[=;,.()\[\]{}:<>]/ },
            { type: 0, regex: /^[\s]+/ },
        ],
        makefile: [
            { type: 5, regex: /^#[^\n]*/ },
            { type: 3, regex: /^"[^"]*"/ },
            { type: 3, regex: /^'[^']*'/ },
            { type: 1, regex: /^\b(define|endef|undefine|ifdef|ifndef|ifeq|ifneq|else|endif|include|sinclude|-include|override|export|unexport|private|vpath|PHONY|SUFFIXES|DEFAULT|PRECIOUS|INTERMEDIATE|SECONDARY|SECONDEXPANSION|DELETE_ON_ERROR|IGNORE|LOW_RESOLUTION_TIME|SILENT|EXPORT_ALL_VARIABLES|NOTPARALLEL|ONESHELL|POSIX)\b/ },            { type: 2, regex: /^\$[\(@<\^+\?*%&|?!-]/ },
            { type: 2, regex: /^\$\([\w.-]+\)/ },
            { type: 2, regex: /^\$\{[\w.-]+\}/ },
            { type: 2, regex: /^[a-zA-Z_][\w.-]*(?=\s*:(?!=))/ },
            { type: 0, regex: /^[a-zA-Z_][\w.-]*/ },
            { type: 0, regex: /^[:=|@\-+?!%,()\[\]{}]/ },
            { type: 0, regex: /^[\s]+/ },
            { type: 0, regex: /^[^\s]+/ },
        ],
        perl: [
            { type: 5, regex: /^#[^\n]*/ },
            { type: 5, regex: /^=pod[\s\S]*?=cut/ },
            { type: 3, regex: /^q[qwxr]?(?:\((?:[^()\\]|\\.)*\)|\[(?:[^\]\\]|\\.)*\]|\{(?:[^{}\\]|\\.)*\}|([^a-zA-Z0-9])(?:(?!\1)[^\\]|\\.)*\1)/ },
            { type: 3, regex: /^"(?:\\[\s\S]|[^"\\])*"/ },
            { type: 3, regex: /^'(?:\\.|[^'\\])*'/ },
            { type: 3, regex: /^\/(?:[^/\\\n]|\\.)+\/[gimsxy]*/ },
            { type: 4, regex: /^0[xX][0-9a-fA-F_]+/ },
            { type: 4, regex: /^\d[\d_]*\.?\d*(?:[eE][+-]?\d+)?/ },
            { type: 2, regex: /^[@%\$][a-zA-Z_][\w]*/ },
            { type: 1, regex: /^\b(BEGIN|END|abs|accept|alarm|and|atan2|bind|binmode|bless|break|caller|chdir|chmod|chomp|chop|chown|chr|chroot|close|closedir|cmp|connect|continue|cos|crypt|dbmclose|dbmopen|defined|delete|die|do|dump|each|else|elsif|endgrent|endhostent|endnetent|endprotoent|endpwent|endservent|eof|eval|exec|exists|exit|exp|fcntl|fileno|flock|for|foreach|fork|format|formline|getc|getgrent|getgrgid|getgrnam|gethostbyaddr|gethostbyname|gethostent|getlogin|getnetbyaddr|getnetbyname|getnetent|getpeername|getpgrp|getpriority|getprotobyname|getprotobynumber|getprotoent|getpwent|getpwnam|getpwuid|getservbyname|getservbyport|getservent|getsockname|getsockopt|given|glob|gmtime|goto|grep|hex|if|import|index|int|ioctl|join|keys|kill|last|lc|lcfirst|length|link|listen|local|localtime|log|lstat|map|mkdir|msgctl|msgget|msgrcv|msgsnd|my|next|no|not|oct|open|opendir|or|ord|our|pack|package|pipe|pop|pos|print|printf|prototype|push|q|qq|qr|quotemeta|qw|qx|rand|read|readdir|readline|readlink|readpipe|recv|redo|ref|rename|require|reset|return|reverse|rewinddir|rindex|rmdir|say|scalar|seek|seekdir|select|semctl|semget|semop|send|setgrent|sethostent|setnetent|setpgrp|setpriority|setprotoent|setpwent|setservent|setsockopt|shift|shmctl|shmget|shmread|shmwrite|shutdown|sin|sleep|socket|socketpair|sort|splice|split|sprintf|sqrt|srand|stat|state|study|sub|substr|symlink|syscall|sysopen|sysread|sysseek|system|syswrite|tell|telldir|tie|tied|time|times|truncate|uc|ucfirst|umask|undef|unless|unlink|unpack|unshift|untie|until|use|utime|values|vec|wait|waitpid|wantarray|warn|when|while|write|x|xor)\b/ },
            { type: 2, regex: /^([a-zA-Z_][\w]*)\s*(?=\()/ },
            { type: 0, regex: /^[a-zA-Z_][\w]*/ },
            { type: 0, regex: /^(?:=>|\.\.|x=?|lt|gt|le|ge|eq|ne|cmp|~~|==|!=|<=|>=|&&|\|\||[-+*\/%&|^~!<>=?:;,.()\[\]{}@])/ },
            { type: 0, regex: /^[\s]+/ },
        ],
        groovy: [
            { type: 5, regex: /^\/\*[\s\S]*?\*\// },
            { type: 5, regex: /^\/\/[^\n]*/ },
            { type: 3, regex: /^"""[\s\S]*?"""/ },
            { type: 3, regex: /^'''[\s\S]*?'''/ },
            { type: 3, regex: /^"(?:\\[\s\S]|[^"\\])*"/ },
            { type: 3, regex: /^'(?:\\.|[^'\\])*'/ },
            { type: 4, regex: /^0[xX][0-9a-fA-F]+[lLiI]?/ },
            { type: 4, regex: /^\d+\.?\d*(?:[eE][+-]?\d+)?[fFdDgGlLiI]?/ },
            { type: 2, regex: /^@[a-zA-Z_][\w]*/ },
            { type: 1, regex: /^\b(abstract|as|assert|break|case|catch|class|const|continue|def|default|do|else|enum|extends|false|final|finally|for|goto|if|implements|import|in|instanceof|interface|it|native|new|null|package|private|protected|public|return|static|strictfp|super|switch|synchronized|this|throw|throws|trait|transient|true|try|void|volatile|while|with)\b/ },
            { type: 1, regex: /^\b(Boolean|Byte|Character|Class|Closure|Collection|Double|Float|GString|GroovyObject|Integer|List|Long|Map|Number|Object|Script|Short|String|Void|ArrayList|HashMap|LinkedHashMap|LinkedList|TreeMap|TreeSet|HashSet|BigDecimal|BigInteger)\b/ },
            { type: 2, regex: /^([a-zA-Z_$][\w$]*)\s*(?=\()/ },
            { type: 1, regex: /^\b[A-Z][a-zA-Z0-9_]*\b/ },
            { type: 0, regex: /^[a-zA-Z_$][\w$]*/ },
            { type: 0, regex: /^(?:=>|->|\.\.|\*\*|\?\?|\?\.|\?:|\+\+|--|==|!=|<=|>=|&&|\|\||[-+*\/%&|^~!<>=?:;,.()\[\]{}])/ },
            { type: 0, regex: /^[\s]+/ },
        ],
        fsharp: [
            { type: 5, regex: /^\(\*[\s\S]*?\*\)/ },
            { type: 5, regex: /^\/\/[^\n]*/ },
            { type: 3, regex: /^"""[\s\S]*?"""/ },
            { type: 3, regex: /^@"(?:[^"]|"")*"/ },
            { type: 3, regex: /^"(?:\\[\s\S]|[^"\\])*"/ },
            { type: 3, regex: /^'(?:\\.|[^'\\])'/ },            { type: 4, regex: /^0[xX][0-9a-fA-F]+(?:uy|y|us|s|ul|l|UL|L|n|un)?/ },
            { type: 4, regex: /^0[bB][01]+(?:uy|y|us|s|ul|l)?/ },
            { type: 4, regex: /^0[oO][0-7]+(?:uy|y|us|s|ul|l)?/ },
            { type: 4, regex: /^\d+\.?\d*(?:[eE][+-]?\d+)?(?:f|m|I)?/ },
            { type: 2, regex: /^\[<[^\]]*>\]/ },
            { type: 1, regex: /^\b(abstract|and|as|assert|asr|base|begin|class|default|delegate|do|done|downcast|downto|elif|else|end|exception|extern|false|finally|fixed|for|fun|function|global|if|in|inherit|inline|interface|internal|land|lazy|let|lor|lsl|lsr|lxor|match|member|mod|module|mutable|namespace|new|not|null|of|open|or|override|private|public|rec|return|select|static|struct|then|to|true|try|type|upcast|use|val|void|when|while|with|yield|async|await|query|task)\b/ },
            { type: 1, regex: /^\b(bool|byte|sbyte|int|int8|int16|int32|int64|uint|uint8|uint16|uint32|uint64|float|float32|float64|decimal|char|string|unit|obj|nativeint|unativeint|bigint|List|Array|Seq|Map|Set|Option|Result|Async|Task|IEnumerable|IDisposable|IComparable|Exception)\b/ },
            { type: 2, regex: /^([a-zA-Z_][\w']*)\s*(?=\()/ },
            { type: 1, regex: /^\b[A-Z][a-zA-Z0-9_']*\b/ },
            { type: 0, regex: /^[a-zA-Z_][\w']*/ },
            { type: 0, regex: /^(?:->|<-|\|>|<\||>>|<<|\.\.|\.\.\.|\?\?|:>|:?>|::\s|&&|\|\||==|!=|<=|>=|[-+*\/%&|^~!<>=?:;,.()\[\]{}])/ },
            { type: 0, regex: /^[\s]+/ },
        ],
        haskell: [
            { type: 5, regex: /^\{-[\s\S]*?-\}/ },
            { type: 5, regex: /^--[^\n]*/ },
            { type: 3, regex: /^"(?:\\[\s\S]|[^"\\])*"/ },
            { type: 3, regex: /^'(?:\\.|[^'\\])'/ },
            { type: 4, regex: /^0[xX][0-9a-fA-F]+/ },
            { type: 4, regex: /^0[oO][0-7]+/ },
            { type: 4, regex: /^\d+\.?\d*(?:[eE][+-]?\d+)?/ },
            { type: 1, regex: /^\b(as|case|class|data|default|deriving|do|else|family|forall|foreign|hiding|if|import|in|infix|infixl|infixr|instance|let|mdo|module|newtype|of|proc|qualified|rec|then|type|where|_|undefined|error|otherwise)\b/ },
            { type: 1, regex: /^\b(Bool|Char|Double|Float|IO|Int|Integer|Ordering|Rational|Real|Show|Read|Eq|Ord|Num|Enum|Bounded|Integral|Floating|RealFrac|RealFloat|Functor|Applicative|Monad|MonadPlus|Foldable|Traversable|String|List|Maybe|Either|Tuple|Map|Set|Seq|Array|IORef|MVar|STM|TVar|TMVar|Chan|Handle|FilePath|ByteString|Text|Natural|Word|Void|Proxy|Coerce)\b/ },
            { type: 1, regex: /^\b[A-Z][a-zA-Z0-9_']*\b/ },
            { type: 2, regex: /^([a-z_][\w']*)\s*(?=[a-zA-Z0-9_(])/ },
            { type: 0, regex: /^[a-zA-Z_][\w']*/ },
            { type: 0, regex: /^(?:->|=>|<-|\.\.|::|\\|@|\|~![-+*\/%&|^<>=?:.])/ },
            { type: 0, regex: /^[\s]+/ },
        ],
        vim: [
            { type: 5, regex: /^"[^\n]*/ },
            { type: 3, regex: /^'[^']*'/ },
            { type: 3, regex: /^"(?:[^"\\]|\\.)*"/ },
            { type: 4, regex: /^\d+/ },
            { type: 1, regex: /^\b(ab|abbreviate|abc|abclear|abo|aboveleft|al|all|arga|argadd|argd|argdelete|argdo|arge|argedit|argg|argglobal|argl|arglocal|ar|args|argu|argument|as|ascii|au|autocmd|aug|augroup|aun|aunmenu|bad|badd|ba|ball|bd|bdelete|be|bel|belowright|bf|bfirst|bl|blast|bm|bmodified|bn|bnext|bo|botright|bp|bprevious|bN|bNext|br|brewind|brea|break|breaka|breakadd|breakd|breakdel|breakl|breaklist|bro|browse|bufdo|b|buffer|buffers|bun|bunload|bw|bwipeout|ca|cabbrev|cabc|cabclear|call|cb|cbuffer|cc|cclose|cd|ce|center|cex|cexpr|cf|cfile|cfir|cfirst|cgetb|cgetbuffer|cgete|cgetexpr|cg|cgetfile|c|change|changes|chd|chdir|che|checkpath|checkt|checktime|cla|clist|clo|close|cmapc|cmapclear|cnew|cnewer|cn|cnext|cN|cNext|cno|cnoremap|cnorea|cnoreabbrev|col|colder|copen|co|copy|cope|copen|cp|cprevious|cq|cquit|cr|crewind|cuna|cunabbrev|cu|cunmap|cw|cwindow|del|delete|delc|delcommand|d|delete|delm|delmarks|diffg|diffget|diffoff|diffpatch|diffput|diffsplit|diffthis|diffu|diffupdate|dig|digraphs|di|display|dj|djump|dl|dlist|do|doautocmd|doautoa|doautoall|dp|diffput|dr|drop|ds|dsearch|dsp|dsplit|e|edit|earlier|echoe|echoerr|echon|echomsg|ec|echo|el|else|elsei|elseif|em|emenu|en|endif|endf|endfunction|endfo|endfor|endw|endwhile|ene|enew|ex|exi|exit|exu|exusage|f|file|files|filetype|fir|first|fix|fixdel|fo|fold|foldc|foldclose|foldd|folddoc|folddoclosed|folddoopen|foldo|foldopen|for|fu|fun|function|go|goto|gr|grep|grepa|grepadd|gui|guibrowser|guifont|guipty|gvim|h|help|helpc|helpclose|helpf|helpfind|helpg|helpgrep|helpt|helptags|hi|highlight|his|history|ia|iabbrev|iabc|iabclear|if|ij|ijump|il|ilist|imapc|imapclear|in|in|ino|inoremap|inorea|inoreabbrev|is|isearch|isp|isplit|iu|iunmap|iuna|iunabbrev|j|join|ju|jumps|k|keepalt|keepj|keepjumps|kee|keepmarks|keepp|keeppatterns|l|list|la|last|language|later|lb|lbuffer|lc|lcd|lch|lchdir|lcl|lclose|le|left|lefta|leftabove|lex|lexpr|lf|lfile|lfir|lfirst|lg|lgetbuffer|lgete|lgetexpr|lgetfile|lgr|lgrep|lgrepa|lgrepadd|ll|llist|lla|llast|lmake|lm|lmap|lmapc|lmapclear|lnew|lnewer|ln|lnext|lN|lNext|lo|loadview|loc|lockmarks|lockv|lockvar|lol|lolder|lop|lopen|lp|lprevious|lr|lrewind|ls|lsp|lsplit|lt|ltag|lu|lunmap|lv|lvimgrep|lvi|lvimgrepadd|lw|lwindow|mak|make|ma|mark|marks|mat|match|menut|menutranslate|mk|mkexrc|mks|mksession|mksp|mkspell|mkv|mkvimrc|mkview|mod|mode|m|move|mzf|mzfile|mz|mzscheme|nb|nbkey|new|n|next|N|Next|nmapc|nmapclear|nno|nnoremap|no|noremap|nor|norea|noreabbrev|nu|number|nun|nunmap|omapc|omapclear|on|only|ono|onoremap|op|open|o|open|opt|options|ou|ounmap|p|print|P|Print|pc|pclose|ped|pedit|pe|perl|perld|perldo|po|pop|popu|popup|pp|ppop|pre|preserve|prev|previous|pro|profile|profd|profdel|promptf|promptfind|promptr|promptrepl|ps|psearch|pta|ptag|ptf|ptfirst|ptj|ptjump|ptl|ptlast|ptn|ptnext|ptN|ptNext|ptp|ptprevious|ptr|ptrewind|pts|ptselect|pu|put|pw|pwd|py3|python3|py3d|py3do|py3f|py3file|py|python|pyd|pydo|pyf|pyfile|q|quit|qa|qall|r|read|rec|recover|red|redo|redi|redir|redra|redraw|redrawstatus|reg|registers|res|resize|ret|retab|retu|return|rew|rewind|ri|right|rightb|rightbelow|rub|ruby|rubyd|rubydo|rubyf|rubyfile|ru|runtime|rv|rviminfo|sal|sall|san|sandbox|sa|sargument|sav|saveas|sbf|sbfirst|sbl|sblast|sbm|sbmodified|sbn|sbnext|sbN|sbNext|sbp|sbprevious|sbr|sbrewind|sb|sbuffer|scripte|scriptencoding|scrip|scriptnames|se|set|setf|setfiletype|setg|setglobal|setl|setlocal|sf|sfind|sfir|sfirst|sh|shell|sign|sil|silent|sim|simalt|sla|slast|sl|sleep|sm|smap|smapc|smapclear|sme|smenu|sn|snext|sN|sNext|sno|snoremap|snoreme|snoremenu|so|source|sort|sp|split|spe|spelldump|spellgood|spelli|spellinfo|spellr|spellrepall|spellu|spellundo|spellw|spellwrong|spr|sprevious|sre|srewind|sta|stag|startg|startgreplace|star|startinsert|startr|startreplace|stj|stjump|st|stop|stopi|stopinsert|sts|stselect|sun|sunmap|sunmenu|sus|suspend|sv|sview|sw|swapname|sy|syntax|sync|t|tag|tags|tab|tabc|tabclose|tabd|tabdo|tabe|tabedit|tabf|tabfind|tabfir|tabfirst|tabl|tablast|tabm|tabmove|tabnew|tabn|tabnext|tabN|tabNext|tabo|tabonly|tabp|tabprevious|tabr|tabrewind|tabs|tc|tcl|tcld|tcldo|tclf|tclfile|te|tearoff|tf|tfirst|th|throw|tj|tjump|tl|tlast|tm|tmenu|tn|tnext|tN|tNext|to|topleft|tp|tprevious|tr|trewind|try|ts|tselect|tu|tunmenu|u|undo|una|unabbreviate|unh|unhide|unlet|unlo|unlockvar|unm|unmap|up|update|verb|verbose|ve|version|vert|vertical|vie|view|vim|vimgrep|vimgrepa|vimgrepadd|vi|visual|vmapc|vmapclear|vne|vnew|vno|vnoremap|vsp|vsplit|vu|vunmap|wa|wall|wh|while|win|wincmd|winp|winpos|wins|winsize|wn|wnext|wN|wNext|wp|wprevious|wq|wqa|wqall|w|write|ws|wsverb|wv|wviminfo|X|xit|xu|xunmap|xmapc|xmapclear|xm|xmap|xme|xmenu|xno|xnoremap|xnoreme|xnoremenu|ya|yank|z)\b/ },
            { type: 2, regex: /^\b(?:g:|s:|l:|b:|w:|t:|v:)[a-zA-Z_][\w]*/ },
            { type: 2, regex: /^([a-zA-Z_][\w]*)\s*(?=\()/ },
            { type: 0, regex: /^[a-zA-Z_][\w]*/ },
            { type: 0, regex: /^(?:->|\.\.|==|!=|<=|>=|[-+*\/%&|^~!<>=?:;,.()\[\]{}])/ },
            { type: 0, regex: /^[\s]+/ },
        ],
        clojure: [
            { type: 5, regex: /^;+[^\n]*/ },
            { type: 5, regex: /^#_[\s\S]*?(?=\s|$)/ },
            { type: 3, regex: /^"(?:\\[\s\S]|[^"\\])*"/ },
            { type: 4, regex: /^(?:0[xX][0-9a-fA-F]+|\d+\.?\d*(?:[eE][+-]?\d+)?)(?:M|N)?/ },
            { type: 3, regex: /^:[a-zA-Z_*+!?\-][\w*+!?\-]*/ },
            { type: 1, regex: /^\b(def|defn|defn-|defmacro|defmulti|defmethod|defprotocol|defrecord|deftype|definterface|defstruct|ns|require|use|import|refer|alias|gen-class|gen-interface|let|letfn|if|if-not|if-let|if-some|when|when-not|when-let|when-some|cond|condp|case|and|or|not|do|fn|fn*|loop|recur|quote|var|throw|try|catch|finally|monitor-enter|monitor-exit|new|set!|in-ns|clojure\.core|clojure\.string|clojure\.set|clojure\.java\.io|nil|true|false)\b/ },
            { type: 1, regex: /^\b(?:map|filter|reduce|for|doseq|dotimes|mapv|filterv|some|every\?|any\?|not-any\?|not-every\?|count|conj|cons|list|vector|hash-map|hash-set|sorted-map|sorted-set|assoc|dissoc|get|get-in|assoc-in|update|update-in|merge|merge-with|into|apply|partial|comp|constantly|identity|juxt|fnil|complement|str|name|keyword|symbol|gensym|type|class|instance\?|satisfies\?|extends\?|keys|vals|seq|first|rest|next|last|butlast|take|drop|take-while|drop-while|split-at|split-with|concat|interleave|interpose|flatten|distinct|group-by|sort|sort-by|reverse|shuffle|range|repeat|repeatedly|iterate|cycle|frequencies|zipmap|select-keys|rename-keys|map-keys|map-vals|print|println|prn|pprint|read|read-string|load|load-file|eval|macroexpand|macroexpand-1|slurp|spit|with-open|atom|ref|agent|deref|swap!|reset!|send|send-off|commute|alter|ref-set|dosync|locking|future|promise|deliver|thread|go|chan|put!|take!|<!!|>!!|<!|>!)\b/ },
            { type: 2, regex: /^([a-zA-Z*+!?\-][\w*+!?\-]*)\s*(?=[\s(])/ },            { type: 0, regex: /^[a-zA-Z*+!?\-][\w*+!?\-]*/ },
            { type: 0, regex: /^[()[\]{}'`~@#^]/ },
            { type: 0, regex: /^[\s]+/ },
        ],
        ocaml: [
            { type: 5, regex: /^\(\*[\s\S]*?\*\)/ },
            { type: 3, regex: /^"(?:\\[\s\S]|[^"\\])*"/ },
            { type: 3, regex: /^{[a-zA-Z_]*\|[\s\S]*?\|[a-zA-Z_]*}/ },
            { type: 3, regex: /^'(?:\\.|[^'\\])'/ },
            { type: 4, regex: /^0[xX][0-9a-fA-F_]+(?:l|L|n)?/ },
            { type: 4, regex: /^0[oO][0-7_]+(?:l|L|n)?/ },
            { type: 4, regex: /^0[bB][01_]+(?:l|L|n)?/ },
            { type: 4, regex: /^\d[\d_]*\.?\d*(?:[eE][+-]?\d+)?/ },
            { type: 2, regex: /^\[@@?@?[a-zA-Z_][\w.]*[\s\S]*?\]/ },
            { type: 1, regex: /^\b(and|as|assert|asr|begin|class|constraint|do|done|downto|else|end|exception|external|false|for|fun|function|functor|if|in|include|inherit|initializer|land|lazy|let|lor|lsl|lsr|lxor|match|method|mod|module|mutable|new|nonrec|object|of|open|or|private|rec|sig|struct|then|to|true|try|type|val|virtual|when|while|with)\b/ },
            { type: 1, regex: /^\b(int|float|bool|char|string|unit|exn|option|list|array|bytes|ref|format|Format|Printf|Scanf|Buffer|Lexer|Parser|Set|Map|Hashtbl|Queue|Stack|Stream|Lazy|Obj|Bigarray|Unix|Sys|Random|Char|String|Array|List|Option|Result|Seq|Either|Fun|Atomic|Domain|Effect|Mutex|Semaphore|Condition)\b/ },
            { type: 1, regex: /^\b[A-Z][a-zA-Z0-9_']*\b/ },
            { type: 0, regex: /^[a-zA-Z_][\w']*/ },
            { type: 0, regex: /^(?:->|=>|\|>|<-|\.\.|::|\?|[@|\\;,()\[\]{}~])/ },
            { type: 0, regex: /^(?:[-+*\/%&^~!<>=?:.])/ },
            { type: 0, regex: /^[\s]+/ },
        ],
        erlang: [
            { type: 5, regex: /^%[^\n]*/ },
            { type: 3, regex: /^"(?:\\[\s\S]|[^"\\])*"/ },
            { type: 3, regex: /^'(?:[^'\\]|\\.)*'/ },
            { type: 4, regex: /^\$(?:\\.|[^\\])/ },
            { type: 4, regex: /^0[xX][0-9a-fA-F]+/ },
            { type: 4, regex: /^\d+#[0-9a-zA-Z]+/ },
            { type: 4, regex: /^\d+\.?\d*(?:[eE][+-]?\d+)?/ },
            { type: 1, regex: /^\b(after|and|andalso|band|begin|bnot|bor|bsl|bsr|bxor|case|catch|cond|div|end|fun|if|let|not|of|or|orelse|query|receive|rem|try|when|xor)\b/ },
            { type: 1, regex: /^\b(?:true|false|undefined|nil|ok|error|exit|throw|erlang|lists|maps|sets|gb_sets|gb_trees|dict|orddict|proplists|string|binary|io|io_lib|file|ets|dets|mnesia|gen_server|gen_statem|gen_event|supervisor|application|timer|calendar|math|crypto|base64|unicode|re|httpc|httpc|inet|gen_tcp|gen_udp|ssl|queue|array|digraph|sofs|ordsets)\b/ },
            { type: 2, regex: /^\?[a-zA-Z_][\w]*/ },
            { type: 2, regex: /^-[a-zA-Z_][\w]*(?:\([^)]*\))?\./ },
            { type: 1, regex: /^\b[A-Z][a-zA-Z0-9_]*\b/ },
            { type: 0, regex: /^\b[a-z_][a-zA-Z0-9_@]*\b/ },
            { type: 0, regex: /^(?:->|=>|\|\/,;:()\[\]{}+\-*\/<>=!])/ },
            { type: 0, regex: /^[\s]+/ },
        ],
    };

    const tokenize = (code, lang) => {
        if (!code || typeof code !== 'string') return [];

        const normalizedLang = LANG_ALIAS[lang.toLowerCase()] ?? lang.toLowerCase();
        const patterns = LANGUAGE_PATTERNS[normalizedLang] ?? LANGUAGE_PATTERNS['javascript'];

        const blocks = [];
        let remaining = code;
        while (remaining.length > 0) {
            let matched = false;

            for (const { type, regex } of patterns) {
                const match = regex.exec(remaining);
                if (match) {
                    if (match[0].length === 0) continue;
                    blocks.push({ highlightType: type, codeContent: match[0] });
                    remaining = remaining.slice(match[0].length);
                    matched = true;
                    break;
                }
            }

            if (!matched) {
                blocks.push({ highlightType: 0, codeContent: remaining[0] });
                remaining = remaining.slice(1);
            }
        }

        return blocks;
    };

    const mergeBlocks = (blocks) => {
        if (!blocks.length) return blocks;
        const merged = [blocks[0]];
        for (let i = 1; i < blocks.length; i++) {
            const prev = merged[merged.length - 1];
            const cur = blocks[i];
            if (prev.highlightType === cur.highlightType && (cur.highlightType === 0)) {
                prev.codeContent += cur.codeContent;
            } else {
                merged.push({ ...cur });
            }
        }
        return merged;
    };

    const buildSubmessages = () => {
        const submessages = [];

        if (options.header) {
            const text = typeof options.header === 'string' ? options.header : options.header.text ?? '';
            if (text) submessages.push({ messageType: 2, messageText: text });
        }

        if (options.title) {
            submessages.push({ messageType: 2, messageText: `*${options.title}*` });
        }
        const normalizedLang = LANG_ALIAS[language.toLowerCase()] ?? language.toLowerCase();
        const codeBlocks = mergeBlocks(tokenize(codeContent, normalizedLang));
        submessages.push({
            messageType: 5,
            codeMetadata: { codeLanguage: normalizedLang, codeBlocks }
        });

        if (Array.isArray(options.extraSnippets)) {
            for (const snippet of options.extraSnippets) {
                if (!snippet?.code) continue;
                const snipLang = LANG_ALIAS[(snippet.language ?? '').toLowerCase()] ?? snippet.language ?? normalizedLang;
                const snipBlocks = mergeBlocks(tokenize(snippet.code, snipLang));
                if (snippet.label) submessages.push({ messageType: 2, messageText: `*${snippet.label}*` });
                submessages.push({ messageType: 5, codeMetadata: { codeLanguage: snipLang, codeBlocks: snipBlocks } });
            }
        }

        if (options.footer) {
            const text = typeof options.footer === 'string' ? options.footer : options.footer.text ?? '';
            if (text) submessages.push({ messageType: 2, messageText: text });
        }

        return submessages;
    };

    const buildContextInfo = () => {
        const ctx = {
            mentionedJid: options.mentions ?? [],
            forwardingScore: 1,
            isForwarded: true,
            forwardedAiBotMessageInfo: {
                botJid: options.botJid ?? Ditss.user?.id ?? 'status@broadcast'
            },
            forwardOrigin: 4,
            ...options.contextInfo,
        };

        if (options.quoted) {
            const { key, message } = options.quoted;
            Object.assign(ctx, {
                stanzaId: key.id,
                remoteJid: key.remoteJid,
                participant: key.participant ?? key.remoteJid,
                fromMe: key.fromMe,
                quotedMessage: message,
            });
        }

        return ctx;
    };
    try {
        const msg = {
            botForwardedMessage: {
                message: {
                    richResponseMessage: {
                        submessages: buildSubmessages(),
                        messageType: 1,
                        contextInfo: buildContextInfo(),
                    }
                }
            }
        };

        return await Ditss.relayMessage(jid, msg, {
            messageId: options.messageId,
            ...options.relayOptions
        });

    } catch (err) {
        console.error('[sendRichCodeMessage] Error:', err?.message ?? err);
        throw err;
    }
};
};
