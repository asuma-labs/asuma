import fs from 'fs';
import path from 'path';

let Database;

if (process.isBun) {
    const { Database: BunDatabase } = await import('bun:sqlite');

    Database = class BunSQLiteCompat {
        constructor(filename) {
            this._db = new BunDatabase(filename);
            this.open = true;
        }

        prepare(sql) {
            const stmt = this._db.prepare(sql);
            return {
                get: (...params) => stmt.get(...params),
                run: (...params) => stmt.run(...params),
                all: (...params) => stmt.all(...params),
            };
        }

        exec(sql) {
            const statements = sql
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0);
            for (const statement of statements) {
                this._db.run(statement);
            }
        }

        pragma(pragmaStr) {
            this._db.run(`PRAGMA ${pragmaStr}`);
        }

        transaction(fn) {
            const txn = this._db.transaction(fn);
            return (...args) => txn(...args);
        }

        close() {
            this.open = false;
            this._db.close();
        }
    };
} else {
    try {
        Database = (await import('better-sqlite3')).default;
    } catch {
        throw new Error('No SQLite module available. Install better-sqlite3 or use Bun.');
    }
}

export { Database };

export const initBotDB = (db) => {
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('wal_autocheckpoint = 1000');
    db.exec(`
        CREATE TABLE IF NOT EXISTS auth_creds (
            id INTEGER PRIMARY KEY,
            data TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    `);
    db.exec(`
        CREATE TABLE IF NOT EXISTS auth_keys (
            key_id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            data TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    `);
};

export const initSharedDB = (db) => {
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('wal_autocheckpoint = 1000');
    db.exec(`
        CREATE TABLE IF NOT EXISTS auth_keys (
            key_id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            data TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    `);
};

const _sharedDBMap = new Map();

export const getSharedDB = (dbDir) => {
    if (_sharedDBMap.has(dbDir)) {
        const existing = _sharedDBMap.get(dbDir);
        const dbPath = path.join(dbDir, 'shared.db');
        if (fs.existsSync(dbPath) && existing.open) return existing;
        try { existing.close(); } catch {}
        _sharedDBMap.delete(dbDir);
    }
    const dbPath = path.join(dbDir, 'shared.db');
    const db = new Database(dbPath);
    initSharedDB(db);
    _sharedDBMap.set(dbDir, db);
    return db;
};

export const clearSharedDB = (dbDir) => {
    if (_sharedDBMap.has(dbDir)) {
        try { _sharedDBMap.get(dbDir).close(); } catch {}
        _sharedDBMap.delete(dbDir);
    }
};

export const makeKeyOps = (db) => {
    const stmtGet = db.prepare('SELECT data FROM auth_keys WHERE key_id = ?');
    const stmtUpsert = db.prepare(`
        INSERT INTO auth_keys (key_id, type, data, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(key_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
    `);
    const stmtDel = db.prepare('DELETE FROM auth_keys WHERE key_id = ?');

    const writeMany = db.transaction((entries) => {
        const now = new Date().toISOString();
        for (const [keyId, type, encrypted] of entries) {
            stmtUpsert.run(keyId, type, encrypted, now);
        }
    });

    const deleteMany = db.transaction((keyIds) => {
        for (const keyId of keyIds) {
            stmtDel.run(keyId);
        }
    });

    return { stmtGet, writeMany, deleteMany };
};
