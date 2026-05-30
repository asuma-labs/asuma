import path from 'path';
import fs from 'fs';
import { initAuthCreds, BufferJSON, proto } from '@whiskeysockets/baileys';
import { deriveKey, encrypt, decrypt } from './encryption.js';
import { Database, initBotDB, getSharedDB, makeKeyOps, clearSharedDB } from './database.js';
import { SHARED_KEY_TYPES } from './constants.js';

export const useSQLiteAuthState = (sessionId, options = {}) => {
    const {
        dbDir = path.resolve('./database/sessions'),
        encryptionSecret = process.env.SESSION_ENCRYPTION_KEY || 'asuma-default-secret-key-change-me'
    } = options;

    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

    const botDbPath = path.join(dbDir, `session_${sessionId}.db`);
    const botDB = new Database(botDbPath);
    const sharedDB = getSharedDB(dbDir);
    const encKey = deriveKey(encryptionSecret);

    initBotDB(botDB);

    const stmtGetCreds = botDB.prepare('SELECT data, updated_at FROM auth_creds WHERE id = 1');
    const stmtSetCreds = botDB.prepare(`
        INSERT INTO auth_creds (id, data, updated_at)
        VALUES (1, ?, ?)
        ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
    `);

    const botKeyOps = makeKeyOps(botDB);
    const sharedKeyOps = makeKeyOps(sharedDB);

    const readCreds = () => {
        const row = stmtGetCreds.get();
        if (!row) return initAuthCreds();
        try {
            const decrypted = decrypt(row.data, encKey);
            return JSON.parse(decrypted, BufferJSON.reviver);
        } catch {
            return initAuthCreds();
        }
    };

    const writeCreds = (creds) => {
        const encrypted = encrypt(JSON.stringify(creds, BufferJSON.replacer), encKey);
        stmtSetCreds.run(encrypted, new Date().toISOString());
    };

    const readKey = (type, ids) => {
        const ops = SHARED_KEY_TYPES.has(type) ? sharedKeyOps : botKeyOps;
        const result = {};

        for (const id of ids) {
            const row = ops.stmtGet.get(`${type}:${id}`);
            if (row) {
                try {
                    const decrypted = decrypt(row.data, encKey);
                    let value = JSON.parse(decrypted, BufferJSON.reviver);
                    if (type === 'app-state-sync-key' && proto?.Message?.AppStateSyncKeyData) {
                        value = proto.Message.AppStateSyncKeyData.create(value);
                    }
                    result[id] = value;
                } catch {
                    result[id] = null;
                }
            } else {
                result[id] = null;
            }
        }

        return result;
    };

    const writeKeys = (data) => {
        const sharedEntries = [];
        const botEntries = [];
        const sharedDeletes = [];
        const botDeletes = [];

        for (const [type, typeData] of Object.entries(data)) {
            const isShared = SHARED_KEY_TYPES.has(type);
            for (const [id, value] of Object.entries(typeData)) {
                const keyId = `${type}:${id}`;
                if (value) {
                    const encrypted = encrypt(JSON.stringify(value, BufferJSON.replacer), encKey);
                    if (isShared) sharedEntries.push([keyId, type, encrypted]);
                    else botEntries.push([keyId, type, encrypted]);
                } else {
                    if (isShared) sharedDeletes.push(keyId);
                    else botDeletes.push(keyId);
                }
            }
        }

        if (sharedEntries.length > 0) sharedKeyOps.writeMany(sharedEntries);
        if (sharedDeletes.length > 0) sharedKeyOps.deleteMany(sharedDeletes);
        if (botEntries.length > 0) botKeyOps.writeMany(botEntries);
        if (botDeletes.length > 0) botKeyOps.deleteMany(botDeletes);
    };

    const creds = readCreds();

    const state = {
        creds,
        keys: {
            get: (type, ids) => readKey(type, ids),
            set: (data) => writeKeys(data),
        },
    };

    const saveCreds = () => {
        writeCreds(state.creds);
    };

    const deleteSession = () => {
        try { botDB.close(); } catch {}
        for (const ext of ['', '-wal', '-shm']) {
            const filePath = botDbPath + ext;
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
    };

    const getSessionInfo = () => {
        const credsRow = stmtGetCreds.get();
        const botKeyCount = botDB.prepare('SELECT COUNT(*) as count FROM auth_keys').get();
        const sharedKeyCount = sharedDB.prepare('SELECT COUNT(*) as count FROM auth_keys').get();
        return {
            sessionId,
            botDbPath,
            hasCredentials: !!credsRow,
            lastUpdated: credsRow?.updated_at || null,
            botKeyCount: botKeyCount?.count || 0,
            sharedKeyCount: sharedKeyCount?.count || 0,
        };
    };

    return { state, saveCreds, deleteSession, getSessionInfo };
};

export { clearSharedDB };
