import { proto, getContentType, areJidsSameUser, generateWAMessage } from '@whiskeysockets/baileys';
import { lidConverter } from '../lib/lidConverter.js';

export const smsg = async (conn, m, store) => {
    if (!m) return m;
    let M = proto.WebMessageInfo;

    if (m.key) {
        m.id = m.key.id;
        m.isBaileys = m.id.startsWith('BAE5') && m.id.length === 16;
        m.chat = m.key.remoteJid;
        m.fromMe = m.key.fromMe;
        m.isCh = m.chat.endsWith('@newsletter')
        m.isGroup = m.chat.endsWith('@g.us');
        m.isBot = m.key?.id && (
            ['NJX-', 'BAE5', 'BAE', 'B1E', '3EB0', 'B24E', 'HSK', 'WA', '3EB'].some(prefix =>
                m.key.id.startsWith(prefix) && [12, 16, 20, 22, 40].includes(m.key.id.length)
            ) || /(.)\1{6,}|[^a-zA-Z0-9\s-]|(^[0-9]{10,}$)|[^0-9A-F]/.test(m.key.id)
        ) || false;

        m.isBotV2 = Boolean(
            m.key?.id &&
            (
                ['NJX-', 'BAE5', 'BAE', 'B1E', '3EB0', 'B24E', 'HSK', 'WA', '3EB'].some(prefix =>
                    m.key.id.startsWith(prefix) && [12, 16, 20, 22, 40].includes(m.key.id.length)
                )
                ||
                /(.)\1{8,}|[^a-zA-Z0-9\s-]|(^[0-9]{18,}$)|[^0-9A-F]/.test(m.key.id)
            )
        );

        if (m.key.remoteJidAlt) {
            m.chatLid = m.chat;
            m.chat = m.key.remoteJidAlt;
        } else if (!m.isGroup && m.chat && m.chat.endsWith('@lid')) {
            const jid = await lidConverter.lidToJid(m.chat);
            if (jid) {
                m.chat = jid;
                m.chatLid = m.key.remoteJid;
            }
        }

        if (m.fromMe) {
            m.sender = conn.decodeJid(conn.user.id);
        } else {
            if (m.isGroup) {
                if (m.key.participantAlt) {
                    m.sender = m.key.participantAlt;
                    m.participantLid = m.key.participant;
                } else if (m.key.participant) {
                    m.sender = m.key.participant;
                } else {
                    m.sender = m.participant || m.chat;
                }
            } else {
                if (m.key.remoteJidAlt && m.key.remoteJidAlt !== conn.user.id) {
                    m.sender = m.key.remoteJidAlt;
                } else {
                    m.sender = m.chat;
                }
            }
            m.sender = conn.decodeJid(m.sender || '');
        }

        if (m.sender && m.sender.endsWith('@lid')) {
            const jid = await lidConverter.lidToJid(m.sender);
            if (jid) m.sender = jid;
        }

        if (m.isGroup) {
            if (m.key.participantAlt) {
                m.participant = m.key.participantAlt;
                m.participantLid = m.key.participant;
            } else if (m.key.participant) {
                m.participant = m.key.participant;
            } else {
                m.participant = m.sender;
            }
            m.participant = conn.decodeJid(m.participant || '');

            if (m.participant && m.participant.endsWith('@lid')) {
                const jid = await lidConverter.lidToJid(m.participant);
                if (jid) m.participant = jid;
            }

            const metadata = store?.groupMetadata?.[m.chat];
            if (metadata?.participants) {
                const botNumber = conn.decodeJid(conn.user.id);
                const botLid = conn.user.lid;
                const db = global.db?.database?.[botNumber];

                m.groupName = metadata.subject || '';

                m.admins = metadata.participants
                    .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
                    .map(p => p.phoneNumber || p.id);

                m.isAdmin = m.admins.includes(m.sender);
                m.isBotAdmin = m.admins.includes(botNumber) || m.admins.includes(botLid);

                if (db?.userLinks) {
                    metadata.participants.forEach(p => {
                        if (p.id && p.phoneNumber) {
                            db.userLinks[p.id] = {
                                jid: p.phoneNumber,
                                lid: p.id,
                                lastSeen: Date.now(),
                                pushName: ''
                            };
                        }
                    });
                }
            } else {
                m.groupName = '';
                m.admins = [];
                m.isAdmin = false;
                m.isBotAdmin = false;
            }
        }
    }

    if (m.message) {
        m.mtype = getContentType(m.message) || '';

        let msgContent = m.message[m.mtype];
        if (m.mtype === 'viewOnceMessage' && msgContent?.message) {
            const innerType = getContentType(msgContent.message);
            msgContent = msgContent.message[innerType] || msgContent.message;
        }

        m.msg = msgContent || {};

        const messageTypes = {
            conversation: m.message?.conversation,
            imageMessage: m.message?.imageMessage?.caption,
            videoMessage: m.message?.videoMessage?.caption,
            audioMessage: m.message?.audioMessage?.caption,
            stickerMessage: m.message?.stickerMessage?.caption,
            documentMessage: m.message?.documentMessage?.fileName,
            contactMessage: '[Contact]',
            locationMessage: m.message?.locationMessage?.name,
            liveLocationMessage: '[Live Location]',
            extendedTextMessage: m.message?.extendedTextMessage?.text,
            buttonsResponseMessage: m.message?.buttonsResponseMessage?.selectedButtonId,
            listResponseMessage: m.message?.listResponseMessage?.singleSelectReply?.selectedRowId,
            templateButtonReplyMessage: m.message?.templateButtonReplyMessage?.selectedId,
            interactiveResponseMessage: '[Interactive Response]',
            pollCreationMessage: '[Poll Creation]',
            reactionMessage: m.message?.reactionMessage?.text,
            ephemeralMessage: '[Ephemeral]',
            viewOnceMessage: '[View Once]',
            productMessage: m.message?.productMessage?.product?.name
        };

        m.body = messageTypes[m.mtype] ||
            m.message?.conversation ||
            m.msg?.caption ||
            m.msg?.text ||
            m.text ||
            '';

        if (typeof m.body !== 'string') m.body = '';

        m.quoted = m.msg?.contextInfo?.quotedMessage || null;

        let mentionedList = [];
        if (m.msg?.contextInfo?.mentionedJid) {
            mentionedList.push(...m.msg.contextInfo.mentionedJid);
        }
        if (m.msg?.contextInfo?.quotedMessage) {
            const q = m.msg.contextInfo.quotedMessage;
            const qTypes = ['extendedTextMessage', 'conversation', 'imageMessage', 'videoMessage'];
            for (let t of qTypes) {
                if (q[t]?.contextInfo?.mentionedJid) {
                    mentionedList.push(...q[t].contextInfo.mentionedJid);
                    break;
                }
            }
        }

        if (mentionedList.length) {
            m.mentionedJid = await lidConverter.batchToJid(mentionedList);
            m.mentionedJid = [...new Set(m.mentionedJid)];
        } else {
            m.mentionedJid = [];
        }

        const convertMentions = async (text) => {
            if (!text) return text;
            let newText = text;
            const mentionPattern = /@(\d+)\b/g;
            for (const match of [...text.matchAll(mentionPattern)]) {
                const number = match[1];
                const possibleJid = await lidConverter.lidToJid(number + '@lid');
                if (possibleJid && possibleJid !== number + '@lid') {
                    newText = newText.replace(`@${number}`, `@${possibleJid.split('@')[0]}`);
                }
            }
            return newText;
        };

        if (m.body && m.mentionedJid?.length) {
            m.originalBody = m.body;
            m.body = await convertMentions(m.body);
        }

        if (m.quoted) {
            let type = Object.keys(m.quoted)[0];
            if (type) {
                m.quoted = m.quoted[type];
                if (type === 'productMessage' && m.quoted?.product) {
                    m.quoted = m.quoted.product;
                }
                if (typeof m.quoted === 'string') m.quoted = { text: m.quoted };

                m.quoted.mtype = type;
                m.quoted.id = m.msg.contextInfo?.stanzaId;
                m.quoted.chat = m.msg.contextInfo?.remoteJid || m.chat;

                if (!m.isGroup && m.quoted.chat && m.quoted.chat.endsWith('@lid')) {
                    const jid = await lidConverter.lidToJid(m.quoted.chat);
                    if (jid) m.quoted.chat = jid;
                }

                m.quoted.isBaileys = m.quoted.id
                    ? m.quoted.id.startsWith('BAE5') && m.quoted.id.length === 16
                    : false;

                m.quoted.sender = conn.decodeJid(m.msg.contextInfo?.participant || '');

                if (m.quoted.sender && m.quoted.sender.endsWith('@lid')) {
                    const jid = await lidConverter.lidToJid(m.quoted.sender);
                    if (jid) m.quoted.sender = jid;
                }

                m.quoted.fromMe = m.quoted.sender === conn.decodeJid(conn.user.id);
                m.quoted.text = m.quoted.text ||
                    m.quoted.caption ||
                    m.quoted.conversation ||
                    m.quoted.contentText ||
                    m.quoted.selectedDisplayText ||
                    m.quoted.title || '';

                let quotedMentionList = [];
                const q = m.msg.contextInfo?.quotedMessage;
                const qTypes = ['extendedTextMessage', 'conversation', 'imageMessage', 'videoMessage'];
                for (let t of qTypes) {
                    if (q?.[t]?.contextInfo?.mentionedJid) {
                        quotedMentionList.push(...q[t].contextInfo.mentionedJid);
                        break;
                    }
                }

                if (quotedMentionList.length) {
                    m.quoted.mentionedJid = await lidConverter.batchToJid(quotedMentionList);
                    m.quoted.mentionedJid = [...new Set(m.quoted.mentionedJid)];
                } else {
                    m.quoted.mentionedJid = [];
                }

                if (m.quoted.text && m.quoted.mentionedJid?.length) {
                    m.quoted.originalText = m.quoted.text;
                    m.quoted.text = await convertMentions(m.quoted.text);
                }

                if (m.isGroup && m.quoted.sender) {
                    m.quoted.isAdmin = m.admins?.includes(m.quoted.sender) || false;
                }

                m.getQuotedObj = m.getQuotedMessage = async () => {
                    if (!m.quoted.id) return false;
                    if (!store) return false;
                    let q = await store.loadMessage(m.chat, m.quoted.id);
                    return smsg(conn, q, store);
                };

                const quotedMessage = {};
                quotedMessage[m.quoted.mtype] = m.quoted;

                // v7: pakai proto.WebMessageInfo.create() bukan fromObject()
                let vM = m.quoted.fakeObj = M.create({
                    key: {
                        remoteJid: m.quoted.chat,
                        fromMe: m.quoted.fromMe,
                        id: m.quoted.id
                    },
                    message: quotedMessage,
                    ...(m.isGroup ? { participant: m.quoted.sender } : {})
                });

                m.quoted.delete = () => conn.sendMessage(m.quoted.chat, { delete: vM.key });
                m.quoted.copyNForward = (jid, forceForward = false, options = {}) =>
                    conn.copyNForward(jid, vM, forceForward, options);
                m.quoted.download = () => conn.downloadMediaMessage(m.quoted);
            }
        }
    }

    if (m.msg?.url) m.download = () => conn.downloadMediaMessage(m.msg);

    m.text = m.body;

    m.reply = (text, chatId = m.chat, options = {}) => {
        const isBuffer = Buffer.isBuffer(text);

        const defaultNewsletter = {
            newsletterJid: global.my?.idch,
            newsletterName: 'Asuma Bot Channel',
            serverMessageId: Date.now().toString()
        };

        if (!isBuffer) {
            if (!options.contextInfo) {
                options.contextInfo = {
                    forwardingScore: 999,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: defaultNewsletter
                };
            } else if (options.contextInfo?.forwardedNewsletterMessageInfo) {
                options.contextInfo.forwardedNewsletterMessageInfo = {
                    ...defaultNewsletter,
                    ...options.contextInfo.forwardedNewsletterMessageInfo
                };
            }
        }

        if (isBuffer) {
            return conn.sendMedia(chatId, text, 'file', '', m, options);
        }

        return conn.sendText(chatId, text, m, options);
    };

    m.react = (u) => conn.sendMessage(m.chat, { react: { text: u, key: m.key } });

    m.copy = () => smsg(conn, M.fromObject(M.toObject(m)), store);

    m.error = async (err, options = {}) => {
    const {
        chatId = m.chat,
        header = '❌ ERROR',
        footer = '',
        language = 'javascript',
        showStack = true,
        logToOwner = false,
        ownerJid = ''
    } = options;

    const errorMsg = typeof err === 'string' 
        ? err 
        : showStack 
            ? err?.stack || err?.message 
            : err?.message || String(err);

    await conn.sendRichCodeMessage(chatId, errorMsg, language, {
        header: header,
        footer: footer || `From: ${m.text || 'unknown'}`,
        quoted: m,
        mentions: [m.sender]
    });

    if (logToOwner && ownerJid) {
        await conn.sendRichCodeMessage(ownerJid, errorMsg, language, {
            header: `⚠️ ERROR LOG\nFrom: ${m.sender}\nChat: ${m.chat}`,
            footer: `Command: ${m.text}`,
            contextInfo: {
                mentionedJid: [m.sender]
            }
        });
    }
};
    
    m.copyNForward = (jid = m.chat, forceForward = false, options = {}) =>
        conn.copyNForward(jid, m, forceForward, options);

    conn.appenTextMessage = async (text, chatUpdate) => {
        let messages = await generateWAMessage(m.chat, { text: text, mentions: m.mentionedJid }, {
            userJid: conn.user.id,
            quoted: m.quoted && m.quoted.fakeObj
        });
        messages.key.fromMe = areJidsSameUser(m.sender, conn.user.id);
        messages.key.id = m.key.id;
        messages.pushName = m.pushName;
        if (m.isGroup) messages.participant = m.sender;
        let msg = {
            ...chatUpdate,
            messages: [proto.WebMessageInfo.fromObject(messages)],
            type: 'append'
        };
        conn.ev.emit('messages.upsert', msg);
    };

    return m;
};
