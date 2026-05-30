import fs from 'fs';
import path from 'path';
import { fork } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SESSIONS_DIR = path.resolve('./database/sessions');
const WORKER_PATH = path.join(__dirname, 'worker.js');
const MAX_RESTARTS = 5;
const RESTART_COOLDOWN_MS = 10000;

if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });

if (!global.cloneBots) global.cloneBots = {};

const spawnClone = (nomor, m, restartCount = 0) => {
    const child = fork(WORKER_PATH, [], {
        env: {
            ...process.env,
            CLONE_CONFIG: JSON.stringify({ nomor, sessionsDir: SESSIONS_DIR }),
        },
        silent: false,
    });

    global.cloneBots[nomor] = { child, restartCount };

    child.on('message', async (msg) => {
        switch (msg.type) {
            case 'connected':
                await m?.reply(`✅ Bot clone ${nomor} berhasil terhubung!`);
                break;
            case 'pairing_code':
                await m?.reply(`🔑 Kode pairing untuk ${nomor}:\n*${msg.code}*\n\nMasukkan kode ini di WhatsApp → Perangkat Tertaut → Tautkan dengan nomor telepon`);
                break;
            case 'pairing_failed':
                await m?.reply(`❌ Gagal mendapatkan kode pairing: ${msg.message}`);
                break;
            case 'disconnected':
                console.log(`[clone:${nomor}] disconnected (${msg.statusCode})`);
                break;
        }
    });

    child.on('exit', (code) => {
        console.log(`[clone:${nomor}] process exited (code ${code})`);
        delete global.cloneBots[nomor];

        if (code === 1 && restartCount < MAX_RESTARTS) {
            console.log(`[clone:${nomor}] restarting (${restartCount + 1}/${MAX_RESTARTS})...`);
            setTimeout(() => spawnClone(nomor, null, restartCount + 1), RESTART_COOLDOWN_MS);
        } else if (restartCount >= MAX_RESTARTS) {
            console.log(`[clone:${nomor}] max restarts reached, giving up.`);
        }
    });

    child.on('error', (err) => {
        console.error(`[clone:${nomor}] process error:`, err.message);
    });

    return child;
};

export const jadibot = async (Ditss, m, nomor) => {
    if (!nomor) return m.reply('❌ Masukkan nomor!\nContoh: .jadibot 628123456789');
    nomor = nomor.replace(/[^0-9]/g, '');
    if (global.cloneBots[nomor]) return m.reply(`⚠️ Bot clone untuk ${nomor} sudah aktif!`);
    await m.reply(`🔄 Membuat bot clone untuk ${nomor}...`);
    spawnClone(nomor, m);
};

export const stopjadibot = async (m, nomor) => {
    if (!nomor) return m.reply('❌ Masukkan nomor!\nContoh: .stopjadibot 628123456789');
    nomor = nomor.replace(/[^0-9]/g, '');
    const entry = global.cloneBots[nomor];
    if (!entry) return m.reply(`⚠️ Bot clone untuk ${nomor} tidak ditemukan!`);
    try {
        entry.child.send({ type: 'stop' });
        await m.reply(`✅ Bot clone ${nomor} berhasil dihentikan!`);
    } catch (err) {
        await m.reply(`❌ Gagal menghentikan bot clone: ${err.message}`);
    }
};

export const listjadibot = async (m) => {
    const list = Object.keys(global.cloneBots);
    if (list.length === 0) return m.reply('📋 Tidak ada bot clone yang aktif.');
    let text = `📋 *DAFTAR CLONE BOT*\nTotal: ${list.length}\n\n`;
    list.forEach((nomor, i) => { text += `${i + 1}. ${nomor} 🟢 Online\n`; });
    text += `\nGunakan .stopjadibot <nomor> untuk menghentikan.`;
    await m.reply(text);
};

export const loadCloneBots = async () => {
    if (!fs.existsSync(SESSIONS_DIR)) return;
    const sessionFiles = fs.readdirSync(SESSIONS_DIR).filter(f => f.startsWith('session_clone_') && f.endsWith('.db'));
    if (sessionFiles.length === 0) return;
    console.log(`📱 Loading ${sessionFiles.length} clone bot(s)...`);
    for (const file of sessionFiles) {
        const nomor = file.replace('session_clone_', '').replace('.db', '');
        try {
            spawnClone(nomor, null);
            console.log(`✅ Loaded clone ${nomor}`);
            await new Promise(r => setTimeout(r, 2000));
        } catch (err) {
            console.log(`❌ Failed to load clone ${nomor}: ${err.message}`);
        }
    }
};
