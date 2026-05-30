process.on('uncaughtException',(err) => console.log('❌ Uncaught Exception:', err));
process.on('unhandledRejection',(reason) => console.log('❌ Unhandled Rejection:', reason));
import console from 'node:console';
import chalk from 'chalk';
import pino from 'pino';
import readline from 'readline';
import fs from 'fs';
import { Boom } from '@hapi/boom';
import {
    default as makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    makeCacheableSignalKeyStore,
    jidDecode,
    downloadMediaMessage,
    Browsers,
    fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import { init, config } from './config.js';
import { getBuffer, getSizeMedia } from './src/core/message.js';
import { imageToWebp, videoToWebp, writeExifImg, writeExifVid } from './src/lib/exif.js';
import MediaHandler from './src/core/media.js';
import { setupBot } from './src/lib/setup.js';
import { smsg } from './src/core/serialize.js';
import { useSQLiteAuthState } from './src/auth/index.js';

const USE_PAIRING_CODE = true;

function question(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise((resolve) => {
        rl.question(query, (ans) => {
            rl.close();
            resolve(ans);
        });
    });
}

async function connectToWhatsApp() {
    const { version, isLatest } = await fetchLatestBaileysVersion();
    //console.log(chalk.cyan(`Baileys version: ${version.join('.')} (latest: ${isLatest})`));

    const { state, saveCreds } = await useSQLiteAuthState('asuma_session', {
        dbDir: './database/sessions'
    });
    const logger = pino({ level: 'silent' });
    const Ditss = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        logger,
        printQRInTerminal: !USE_PAIRING_CODE,
        browser: Browsers.ubuntu('Chrome'),
    });

    await setupBot(Ditss, null);
    
    Ditss.public = true;

    Ditss.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr, receivedPendingNotifications } = update;

        if (connection === 'connecting') {
            console.log(chalk.yellow('Menghubungkan ke WhatsApp...'));
            if (USE_PAIRING_CODE && !Ditss.authState.creds.registered) {
                const phoneNumber = await question(chalk.blue('Masukkan nomor WhatsApp bot:\nNomor: '));
                console.log(chalk.yellow('Meminta kode pairing...'));
                const code = await Ditss.requestPairingCode(phoneNumber.trim().replace(/[^0-9]/g, ''));
                console.log(chalk.green(`\nKode pairing: ${code}\n`));
            }
        }

        if (qr) {
            console.log(chalk.yellow('QR Code diterima, silakan scan.'));
        }

        if (connection === 'close') {
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
            const shouldReconnect = reason !== DisconnectReason.loggedOut;

            console.log(chalk.red(`Koneksi tertutup. Alasan: ${reason}`));

            if (reason === DisconnectReason.badSession) {
                console.log(chalk.red('Session rusak, hapus folder auth dan restart.'));
                process.exit(1);
            } else if (reason === DisconnectReason.connectionClosed) {
                console.log(chalk.yellow('Koneksi ditutup, menyambung ulang...'));
                connectToWhatsApp();
            } else if (reason === DisconnectReason.connectionLost) {
                console.log(chalk.yellow('Koneksi terputus, menyambung ulang...'));
                connectToWhatsApp();
            } else if (reason === DisconnectReason.connectionReplaced) {
                console.log(chalk.red('Sesi digantikan oleh koneksi baru.'));
                process.exit(1);
            } else if (reason === DisconnectReason.loggedOut) {
                console.log(chalk.red('Bot di-logout. Hapus folder auth dan restart.'));
                process.exit(1);
            } else if (reason === DisconnectReason.restartRequired) {
                console.log(chalk.yellow('Restart diperlukan, menyambung ulang...'));
                connectToWhatsApp();
            } else if (reason === DisconnectReason.timedOut) {
                console.log(chalk.yellow('Koneksi timeout, menyambung ulang...'));
                connectToWhatsApp();
            } else if (shouldReconnect) {
                console.log(chalk.yellow(`Menyambung ulang... (alasan: ${reason})`));
                connectToWhatsApp();
            }
        }

        if (connection === 'open') {
            console.log(chalk.green('✓ Asuma Bot terhubung ke WhatsApp'));
            if (receivedPendingNotifications) {
                console.log(chalk.cyan('Semua notifikasi pending telah diterima.'));
            }
        }
    });

    Ditss.decodeJid = (jid) => {
        if (!jid) return jid;
        if (/:\d+@/gi.test(jid)) {
            const decode = jidDecode(jid);
            return decode?.user && decode?.server ? `${decode.user}@${decode.server}` : jid;
        }
        return jid;
    };

    Ditss.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message) return;
            
            const botNumber = Ditss.decodeJid(Ditss.user.id);
            
            if (mek.key?.remoteJid === "status@broadcast") {
                const features = global.db?.database?.[botNumber]?.features || {};

                if (config.redsw === true) {
                    try {
                        await Ditss.readMessages([mek.key]);

                        if (config.redswrc === true) {
                            const reactions = ["🫪"];
                            const getreact = reactions[Math.floor(Math.random() * reactions.length)];
                            const targetJid = mek.key.remoteJidAlt || mek.key.remoteJid;
                            await Ditss.sendMessage(targetJid, { react: { text: getreact, key: mek.key } });
                            console.log(`melihat sw dari: ${mek.pushName || 'gatau'} ${targetJid}`);
                        }
                    } catch {}
                }
                return;
            }
            
            if (mek.key.id.startsWith('3EB0') || (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) || (mek.key.fromMe && mek.key.id.includes('BAE5'))) return;
            
            const m = await smsg(Ditss, mek, null);
            if (!Ditss.public && !mek.key.fromMe && chatUpdate.type === 'notify') return;
            
            const { default: handler } = await import('./Asuma.js');
            handler(Ditss, m, chatUpdate, null);
        } catch (error) {
            console.error(chalk.red('Error pesan:'), error);
        }
    });

    Ditss.ev.on('creds.update', saveCreds);
    Ditss.ev.on('error', (err) => console.error(chalk.red('Socket error:'), err));
    setInterval(() => {
    const usedMB = process.memoryUsage().rss / 1024 / 1024;
    if (usedMB >= 1800) { 
        console.warn(`⚠️ [Watchdog] Auto-Restart dipicu: Penggunaan RAM mencengangkan (${usedMB.toFixed(2)} MB)`);
        process.exit(1); 
    }
}, 60000);

}

connectToWhatsApp().catch(err => console.error(chalk.red('Fatal error:'), err));
