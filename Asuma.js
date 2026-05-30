import fs from 'fs';
import util from 'util';
import chalk from 'chalk';
import path from 'path';
import { fileURLToPath } from 'url';
import moment from 'moment-timezone';
import { spawn, spawnSync, exec, execSync, execFile, execFileSync, fork } from 'child_process';
import {
    proto,
    getContentType,
    areJidsSameUser,
    DisconnectReason,
    fetchLatestBaileysVersion,
    generateWAMessageContent
} from '@whiskeysockets/baileys';
import { config, init } from './config.js';
import logger from './src/core/logger.js';
import {
    tanggal,
    getTime,
    isUrl,
    sleep,
    clockString,
    runtime,
    fetchJson,
    getBuffer,
    jsonformat,
    format,
    parseMention,
    getRandom,
    getGroupAdm,
    generateProfilePicture
} from './src/core/message.js';
import Case from './src/lib/case.js';
import handleMessage from './src/lib/handle.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OWNER_PATH = './database/owner.json';
const PREMIUM_PATH = './database/premium.json';
const CreatorOnly = false;

export default async function Asuma(Ditss, m, chatUpdate, store) {
    try {
let body = m.text || m.body || "";

try {
    if (m.message?.pollUpdateMessage) {
        body = m.message.pollUpdateMessage.selectedOptions?.[0]?.optionName || "";
    } 
    else if (m.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson) {
        const parsed = JSON.parse(m.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson);
        body = parsed?.id || parsed?.button || "";
    } 
    else {
        body = m.message?.conversation ||
               m.message?.extendedTextMessage?.text ||
               m.message?.buttonsResponseMessage?.selectedButtonId ||
               m.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
               m.message?.templateButtonReplyMessage?.selectedId ||
               body;
    }
} catch (e) {
    body = m.text || m.body || "";
}

body = body.trim();
        const budy = typeof m.text === 'string' ? m.text : '';
        const prefixPattern = /^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#$%^&.©^]/gi;
        const prefixMatch = body.match(prefixPattern);
        const prefix = config.prefa ? (prefixMatch ? prefixMatch[0] : "") : (config.prefa ?? "!");

        let Owner = [];
        let Premium = [];

        try {
            if (fs.existsSync(OWNER_PATH)) {
                Owner = JSON.parse(fs.readFileSync(OWNER_PATH));
            }
        } catch (error) {
            console.error('Error loading owner data:', error);
        }
        if (!Array.isArray(Owner)) Owner = [];

        try {
            if (fs.existsSync(PREMIUM_PATH)) {
                Premium = JSON.parse(fs.readFileSync(PREMIUM_PATH));
            }
        } catch (error) {
            console.error('Error loading premium data:', error);
        }
        if (!Array.isArray(Premium)) Premium = [];
        const sock = Ditss;
        const conn = sock;
        const client = conn;
        const CMD = body.startsWith(prefix);
        const command = CMD ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : '';
        const args = CMD ? body.slice(prefix.length).trim().split(' ').slice(1) : [];
        const text = args.join(' ');

        const cleanJid = (jid) => {
            if (!jid) return jid;
            if (jid.includes('@s.whatsapp.net')) return jid;
            if (jid.includes('@lid')) {
                if (m.key.remoteJidAlt && m.key.remoteJidAlt.includes('@s.whatsapp.net')) {
                    return m.key.remoteJidAlt;
                }
                const number = jid.split('@')[0];
                return number + '@s.whatsapp.net';
            }
            const numberOnly = jid.replace(/[^0-9]/g, '');
            if (numberOnly) return numberOnly + '@s.whatsapp.net';
            return jid;
        };

        const getCorrectSender = (msg) => {
            if (msg.key?.addressingMode === 'lid' && msg.key.remoteJidAlt?.includes('@s.whatsapp.net')) {
                return msg.key.remoteJidAlt;
            }
            if (msg.key?.addressingMode === 'pn' && msg.key.remoteJid?.includes('@s.whatsapp.net')) {
                return msg.key.remoteJid;
            }
            return cleanJid(msg.sender);
        };

        const botJid = cleanJid(Ditss.user.id);
        const senderJid = getCorrectSender(m);

        const isOwn = [...Owner, ...config.owner]
            .map(v => v.replace(/[^0-9]/g, '') + '@s.whatsapp.net')
            .includes(senderJid) || botJid === senderJid;
        const isOwner = isOwn

        const isPrem = [...Premium, ...config.owner]
            .map(v => v.replace(/[^0-9]/g, '') + '@s.whatsapp.net')
            .includes(senderJid) || botJid === senderJid;
        let quoted = m.quoted || m;

        const pushname = m.pushName || "No Name";
        let groupMetadata = null;
        let groupName = "";
        let participants = [];
        let groupAdmin = [];
        let botAdmin = false;
        let isAdmin = false;

        if (m.isGroup) {
            try {
                groupMetadata = await Ditss.groupMetadata(m.chat);
                groupName = groupMetadata.subject || "";
                participants = groupMetadata.participants || [];
                groupAdmin = await getGroupAdm(participants);
                botAdmin = groupAdmin.includes(botJid);
                isAdmin = groupAdmin.includes(senderJid);
            } catch (error) {
                console.error('Error fetching group metadata:', error);
            }
        }

        const reply = (teks) => {
            Ditss.sendMessage(m.chat, { text: teks }, { quoted: m });
        };

        const time = moment().tz("Asia/Jakarta").format("HH:mm:ss");
        const todayDateWIB = new Date().toLocaleDateString('id-ID', {
            timeZone: 'Asia/Jakarta',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const logItems = [
            `📅 ${chalk.cyan('Date')}    : ${todayDateWIB}`,
            `🕐 ${chalk.cyan('Time')}    : ${time}`,
            `💬 ${chalk.cyan('Type')}    : ${m.mtype}`,
            `🗣️ ${chalk.cyan('Sender')}  : ${pushname}`,
            `🤖 ${chalk.cyan('Bot')}     : ${botJid}`,
            `📝 ${chalk.cyan('Command')} : ${chalk.yellow(command)}`,
            `📋 ${chalk.cyan('Args')}    : ${args.length > 0 ? chalk.green(args.join(' ')) : chalk.gray('None')}`
        ];

        if (m.isGroup) {
            logItems.splice(3, 0, `🌐 ${chalk.cyan('Group')}   : ${groupName}`);
            logItems.splice(4, 0, `🔑 ${chalk.cyan('Chat ID')} : ${m.chat}`);
            logger.box(`📱 GROUP MESSAGE • ${groupName}`, '#3498db', logItems);
        } else {
            logger.box(`🔒 PRIVATE MESSAGE • ${pushname}`, '#9b59b6', logItems);
        }

        const context = {
            Linger: Ditss,
            Ditss,
            conn, 
            client, 
            isOwner,
            sock,
            text,
            args,
            isOwn,
            isPrem,
            config,
            CMD,
            command,
            reply,
            pushname,
            from: m.chat,
            sender: senderJid,
            isGroup: m.isGroup,
            isPrivate: !m.isGroup,
            usedPrefix: prefix,
            groupName,
            participants,
            groupAdmin,
            botAdmin,
            isAdmin,
            m
        };

        if (CMD) {
            await handleMessage(m, command, context);
        }

        if (!Ditss.public && !CreatorOnly && !isOwn) return;

        switch (command) {
                            case 'backup': {
                if (!isOwn) return m.reply("kamu bukan creator");
                switch (args[0]) {
                    case 'all': {
                        try {
                            m.reply('📦 Sedang mengumpulkan semua file untuk backup...');
                            const ls = execSync("ls").toString().split("\n").filter(f =>
                                f && !['node_modules','package-lock.json','yarn.lock','jadibot','temp','tmp'].includes(f)
                            );
                            execSync(`zip -r Backup.zip ${ls.map(f => `"${f}"`).join(" ")}`, { maxBuffer: 1024 * 1024 * 1024 });
                            if (!fs.existsSync('./Backup.zip')) return m.reply('❌ File ZIP tidak ditemukan, backup gagal.');
                            await Ditss.sendMessage(m.sender, { document: fs.readFileSync('./Backup.zip'), mimetype: "application/zip", fileName: `Backup_${new Date().toISOString().slice(0,10)}.zip` });
                            execSync("rm -rf Backup.zip");
                            m.reply('✅ Backup selesai, file berhasil dikirim ke owner.');
                        } catch (err) {
                            console.error(err);
                            m.reply('⚠️ Terjadi kesalahan saat proses backup.');
                            try { execSync("rm -rf Backup.zip"); } catch {}
                        }
                        break;
                    }
                    case 'auto': {
                        if (set.autobackup) return m.reply('ℹ️ Auto Backup sudah aktif sebelumnya.');
                        set.autobackup = true;
                        m.reply('✅ Auto Backup berhasil diaktifkan!');
                        break;
                    }
                    case 'session': {
                        await m.reply({ document: fs.readFileSync('./database/session'), mimetype: 'application/json', fileName: 'creds.json' });
                        break;
                    }
                    case 'database': {
                        try {
                            const dbPath = './database/database.json';
                            if (!fs.existsSync(dbPath)) return;
                            const buffer     = fs.readFileSync(dbPath);
                            const tanggalNow = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
                            for (const no of global.owner) {
                                const jid = no + '@s.whatsapp.net';
                                await Ditss.sendMessage(jid, {
                                    document: buffer,
                                    fileName: `database-${tanggalNow.replace(/[^\d]/g, '-')}.json`,
                                    mimetype: 'application/json',
                                    caption: `📦 *Backup Berhasil*\n📅 ${tanggalNow}`
                                }, { quoted: { key: { fromMe: false, participant: '0@s.whatsapp.net', remoteJid: jid }, message: { conversation: `✅ Backup pada ${tanggalNow}` } } });
                            }
                        } catch (err) { console.error('❌ Gagal auto backup:', err); }
                        break;
                    }
                    default: {
                        Ditss.sendMessage(m.chat, {
                            text: '✨ Gunakan salah satu perintah berikut:\n- backup auto\n- backup all\n- backup database\n- backup session',
                            footer: '© Powered by Asuma',
                            buttons: [{
                                buttonId: "backup",
                                buttonText: { displayText: "🗂️ Gunakan Perintah Backup" },
                                type: 4,
                                nativeFlowInfo: {
                                    name: "single_select",
                                    paramsJson: JSON.stringify({
                                        title: "💾 Pilih Perintah Backup yang Tersedia",
                                        sections: [{
                                            title: "Daftar Perintah Backup",
                                            rows: [
                                                { title: "📦 Backup Semua",    description: "Backup semua data sekaligus",       id: ".backup all"      },
                                                { title: "🕒 Backup Otomatis", description: "Mengaktifkan backup otomatis",       id: ".backup auto"     },
                                                { title: "💼 Backup Session",  description: "Backup file session bot",            id: ".backup session"  },
                                                { title: "🗃️ Backup Database", description: "Backup file database bot",           id: ".backup database" },
                                            ]
                                        }]
                                    })
                                }
                            }],
                            headerType: 1,
                            viewOnce: true,
                        }, { quoted: m });
                        break;
                    }
                }
                break;
            }
            default:
                if (budy.startsWith('=>') && isOwn) {
                    try {
                        const code = budy.slice(2);
                        const result = await eval(`(async () => { return ${code} })()`);
                        await reply(util.format(result));
                    } catch (error) {
                        await reply(`❌ Error:\n${error.message}`);
                    }
                } else if (budy.startsWith('>') && isOwn) {
                    try {
                        const code = budy.slice(1);
                        let evaled = await eval(code);
                        if (typeof evaled !== 'string') {
                            evaled = util.inspect(evaled, { depth: 1 });
                        }
                        await reply(evaled);
                    } catch (error) {
                        await reply(`❌ Error:\n${error.message}`);
                    }
                } else if (budy.startsWith('$') && isOwn) {
                    exec(budy.slice(1), (error, stdout, stderr) => {
                        if (error) return reply(`❌ Error:\n${error.message}`);
                        if (stderr) return reply(`⚠️ stderr:\n${stderr}`);
                        if (stdout) return reply(`📤 stdout:\n${stdout}`);
                        return reply('✅ Command executed (no output)');
                    });
                }
                break;
        }

    } catch (error) {
        console.error(chalk.red.bold('Error in message handler:'), error);
        if (m && m.chat) {
            try {
                //await Ditss.sendMessage(m.chat, { text: `❌ Error occurred:\n${error.message}` }, { quoted: m });
            } catch (sendError) {
                console.error('Failed to send error message:', sendError);
            }
        }
    }
}
