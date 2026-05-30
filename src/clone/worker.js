// src/clone/worker.js
import pino from 'pino';
import makeWASocket, {
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    Browsers,
} from '@whiskeysockets/baileys';
import { useSQLiteAuthState } from '../auth/index.js';
import { smsg } from '../core/serialize.js';
import { setupBot } from '../lib/setup.js';

const { nomor, sessionsDir } = JSON.parse(process.env.CLONE_CONFIG);
const sessionId = `clone_${nomor}`;

const send = (type, data = {}) => process.send?.({ type, ...data });

const { state, saveCreds, deleteSession } = useSQLiteAuthState(sessionId, {
    dbDir: sessionsDir,
});

const logger = pino({ level: 'silent' });
const { version } = await fetchLatestBaileysVersion();

const client = makeWASocket({
    auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    version,
    logger,
    printQRInTerminal: false,
    browser: Browsers.ubuntu('Chrome'),
    markOnlineOnConnect: true,
});

client.public = true;
client.ev.on('creds.update', saveCreds);

await setupBot(client, null);

client.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'open') {
        send('connected', { nomor });
        try {
            await client.sendMessage(`${nomor}@s.whatsapp.net`, {
                text: `🤖 *Asuma Clone Bot* 🤖\n\n✅ Bot clone ${nomor} berhasil terhubung!\n🕐 Waktu: ${new Date().toLocaleString()}\n\n📢 Channel: https://whatsapp.com/channel/0029VaN28lnGU3BROmG4Tx3j\n🌐 Website: www.asuma.my.id`,
            });
        } catch {}
    }

    if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        send('disconnected', { nomor, statusCode });

        if (statusCode === DisconnectReason.loggedOut) {
            deleteSession();
            process.exit(0);
        } else if (
            statusCode !== DisconnectReason.connectionReplaced &&
            statusCode !== DisconnectReason.badSession
        ) {
            setTimeout(() => process.exit(1), 3000);
        } else {
            process.exit(0);
        }
    }
});

client.ev.on('messages.upsert', async (chatUpdate) => {
    try {
        const mek = chatUpdate.messages[0];
        if (!mek?.message) return;
        if (
            mek.key.id.startsWith('3EB0') ||
            (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16)
        ) return;

        const m = await smsg(client, mek, null);
        const { default: AsumaHandler } = await import('../../Asuma.js');
        await AsumaHandler(client, m, chatUpdate, null);
    } catch (err) {
        console.error(`[clone:${nomor}] message error:`, err.message);
    }
});

if (!client.authState.creds.registered) {
    setTimeout(async () => {
        try {
            let code = await client.requestPairingCode(nomor);
            code = code.match(/.{1,4}/g)?.join('-') || code;
            send('pairing_code', { nomor, code });
        } catch (err) {
            send('pairing_failed', { nomor, message: err.message });
        }
    }, 3000);
}

process.on('message', async (msg) => {
    if (msg?.type === 'stop') {
        try { client.end('Stopped by owner'); } catch {}
        process.exit(0);
    }
});
