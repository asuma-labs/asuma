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
import { init } from './config.js';
import { getBuffer, getSizeMedia } from './src/core/message.js';
import { imageToWebp, videoToWebp, writeExifImg, writeExifVid } from './src/lib/exif.js';
import MediaHandler from './src/core/media.js';
import { setupBot } from './src/lib/setup.js';
import { smsg } from './src/core/serialize.js';

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
    console.log(chalk.cyan(`Baileys version: ${version.join('.')} (latest: ${isLatest})`));

    const { state, saveCreds } = await useMultiFileAuthState("auth");

const Ditss = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: !USE_PAIRING_CODE,
    //browser: Browsers.macOS('Desktop'),
});
    await setupBot(Ditss, null);
    
    Ditss.public = true;
    Ditss.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'connecting' && USE_PAIRING_CODE && !Ditss.authState.creds.registered) {
            const phoneNumber = await question(chalk.blue('Masukkan nomor WhatsApp bot:\nNomor: '));
            console.log(chalk.yellow('Meminta kode pairing...'));
            const code = await Ditss.requestPairingCode(phoneNumber);
            console.log(chalk.green(`\nKode pairing: ${code}\n`));
        } else if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom) &&
                lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log(chalk.yellow('Menyambung ulang...'));
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log(chalk.green('✓ Asuma Bot (ditss) terhubung'));
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
        if (mek.key.remoteJid === 'status@broadcast') return;
        if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return;

        const m = await smsg(Ditss, mek, null);
        
        // Hanya skip pesan bot biasa, tapi tetap proses eval command
        // if (m.fromMe && !m.body?.startsWith('>') && !m.body?.startsWith('=>') && !m.body?.startsWith('$')) {
        //     return;
        // }

        const { default: handler } = await import('./Asuma.js');
        handler(Ditss, m, chatUpdate, null);
    } catch (error) {
        console.error(chalk.red('Error pesan:'), error);
    }
});
    Ditss.ev.on('creds.update', saveCreds);
    Ditss.ev.on('error', (err) => console.error(chalk.red('Socket error:'), err));
}

//console.clear();
connectToWhatsApp().catch(err => console.error(chalk.red('Fatal error:'), err));
