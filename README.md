<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=180&section=header&text=AsumaMD&fontSize=72&fontColor=fff&animation=twinkling&fontAlignY=32&desc=Asuma%20Multi%20Device%20WhatsApp%20Bot&descAlignY=55&descAlign=50" />

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-%3E%3D18-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/Bun-%3E%3D1.0-fbf0df?style=for-the-badge&logo=bun&logoColor=black" />
  <img src="https://img.shields.io/badge/Baileys-v7%20RC13-25D366?style=for-the-badge&logo=whatsapp&logoColor=white" />
  <img src="https://img.shields.io/badge/ESM-Pure%20Module-f7df1e?style=for-the-badge&logo=javascript&logoColor=black" />
  <img src="https://img.shields.io/badge/License-CC%20BY--NC%204.0-blue?style=for-the-badge" />
</p>

<p align="center">
  <b>Asuma Multi Device</b> adalah WhatsApp Bot Base modern yang dibangun di atas <a href="https://github.com/WhiskeySockets/Baileys">@whiskeysockets/baileys</a>.<br/>
  Dirancang dengan arsitektur modular, Pure ESM, dan dukungan penuh untuk runtime Node.js & Bun.
</p>

</div>

---

## ✨ Fitur Unggulan

| Fitur | Deskripsi |
|-------|-----------|
| ⚡ **Pure ESM** | Seluruh codebase menggunakan ES Modules native — modern & future-proof |
| 🔌 **Universal Plugin System** | Support plugin CJS (`.cjs`) dan ESM (`.mjs` / `.js`) dalam satu loader |
| 📂 **Subfolder Support** | Plugin bisa diorganisir dalam subfolder (group/, owner/, general/, dll) |
| 📱 **Pairing Code** | Koneksi via Pairing Code (nomor HP) — lebih mudah dari scan QR |
| 🛠️ **Dynamic Case System** | Tambah/hapus command case langsung dari chat WhatsApp (khusus Owner) |
| 🧩 **Modular Architecture** | Struktur folder bersih: `core/`, `lib/`, `plugins/` |
| 🚀 **Bun-native** | Berjalan secara native di Bun untuk performa lebih cepat |
| 🔒 **Baileys v7 RC13+** | Kompatibel dengan Baileys terbaru dengan dukungan LID (Local Identifier) |
| 🎨 **Rich Media Support** | Sticker (image/video/gif), audio, polling, button message, list message |
| 📊 **SQLite Ready** | Siap menggunakan `bun:sqlite` untuk database (opsional) |

---

## 📁 Struktur Folder

```

asuma/
├── index.js                   # Entry point (koneksi WhatsApp)
├── config.js                  # Konfigurasi utama bot
├── Asuma.js                   # Handler pesan utama
├── package.json
├── database/                  # Data JSON (owner, premium, dll)
├── session/                   # Auth session (auto-generated)
├── temp/                      # Temporary files
└── src/
├── core/
│   ├── message.js         # Utilities & helper functions
│   ├── logger.js          # Custom logger dengan box styling
│   ├── media.js           # Media handler (download, upload)
│   └── serialize.js       # Message serializer (LID support)
├── lib/
│   ├── handle.js          # Universal plugin loader
│   ├── case.js            # Dynamic case system
│   ├── exif.js            # Sticker EXIF metadata
│   ├── lidConverter.js    # LID ↔ JID converter
│   └── setup.js           # Bot setup (send methods)
└── plugins/               # Semua plugin di sini
├── owner/             # Owner-only commands
├── group/             # Group commands
├── general/           # Public commands
└── media/             # Media/sticker commands

```

---

## 🚀 Instalasi & Menjalankan

### Prasyarat

- **Node.js** `>= 18.x` atau **Bun** `>= 1.0`
- Git

### Langkah Instalasi

**1. Clone Repository**
```bash
git clone https://github.com/asuma-labs/asuma.git
cd asuma
```

2. Install Dependencies

Dengan Bun (direkomendasikan, lebih cepat):

```bash
bun install
```

Dengan Node.js / npm:

```bash
npm install
```

3. Konfigurasi Bot

Edit config.js sesuai kebutuhan:

```javascript
export const config = {
    prefa: ['', '!', '.', ',', '🐤', '🗿'],  // Prefix yang didukung
    owner: ['6285162822778', '6287822118865'], // Nomor owner (tanpa @)
    thumbnail: "https://...",                  // Thumbnail untuk menu
    name: "Asuma Bot",
    version: "1.0"
};

export const init = {
    session: "./session",      // Folder untuk session
    customPair: "ASUMA"        // Custom pairing code prefix
};
```

4. Jalankan Bot

Dengan Bun:

```bash
bun start
```

Dengan Node.js:

```bash
npm start
```

Dengan auto-reload (development):

```bash
bun dev
# atau
npm run dev
```

5. Hubungkan ke WhatsApp

· Masukkan nomor bot saat diminta di terminal
· Masukkan kode pairing yang muncul ke WhatsApp (Perangkat Tertaut → Tautkan Perangkat → Tautkan dengan nomor telepon)

---

🧩 Cara Membuat Plugin

Semua plugin diletakkan di folder src/plugins/. Bisa diorganisir dalam subfolder (group/, owner/, general/, dll).

Format Plugin ESM (Rekomendasi)

```javascript
// src/plugins/general/ping.js
const handler = async (m, { reply }) => {
    await reply('Pong! 🏓');
};

handler.command = ['ping', 'p'];
handler.owner = false;    // true = hanya owner
handler.premium = false;  // true = hanya premium user
handler.group = false;    // true = hanya di grup
handler.private = false;  // true = hanya di private chat

export default handler;
```

Format Plugin CJS (Legacy Support)

```javascript
// src/plugins/owner/eval.cjs
const handler = async (m, { reply, text, isOwn }) => {
    if (!isOwn) return reply('❌ Owner only!');
    try {
        const result = eval(text);
        await reply(require('util').format(result));
    } catch (err) {
        await reply(`❌ Error: ${err.message}`);
    }
};

handler.command = ['>', 'eval'];
handler.owner = true;

module.exports = handler;
```

Contoh Plugin dengan Subfolder

```javascript
// src/plugins/group/tools/kick.js
const handler = async (m, { Linger, args, isGroup, isAdmin, botAdmin, reply }) => {
    if (!isGroup) return reply('❌ Group only!');
    if (!isAdmin) return reply('❌ You are not admin!');
    if (!botAdmin) return reply('❌ Bot is not admin!');
    
    let users = m.mentionedJid;
    if (!users.length && args[0]) {
        users = [args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net'];
    }
    
    for (let user of users) {
        await Linger.groupParticipantsUpdate(m.chat, [user], 'remove');
    }
    
    reply(`✅ Successfully kicked ${users.length} user(s)!`);
};

handler.command = ['kick', 'remove'];
handler.group = true;

module.exports = handler;
```

---

🔧 Dynamic Case System

Tambah/hapus command case langsung dari chat WhatsApp (khusus Owner):

```
.addcase case "ping": {
  reply("Pong! Bot Asuma aktif ✅");
}
break;
```

```
.listcase      → Lihat semua case yang tersimpan
.getcase ping  → Lihat isi case "ping"
.delcase ping  → Hapus case "ping"
```

Note: Case system adalah fallback ketika plugin tidak ditemukan. Direkomendasikan menggunakan plugin untuk fitur baru.

---

📦 Built-in Methods

Setelah bot terhubung, objek Ditss (socket) memiliki method tambahan:

Method Deskripsi
sendText(jid, text, quoted, options) Kirim teks biasa
sendMedia(jid, path, caption, quoted, options) Kirim image/video/audio/file
sendImageAsSticker(jid, path, quoted, options) Konversi image ke sticker
sendVideoAsSticker(jid, path, quoted, options) Konversi video ke sticker
sendPoll(jid, question, options) Kirim polling
sendAudio(jid, input, isPtt, quoted) Kirim audio (PTT/non-PTT)
sendButtons(jid, options) Kirim interactive buttons
sendListMsg(jid, content, options) Kirim list message

---

🛠️ Tech Stack

Komponen Teknologi
Runtime Node.js 18+ / Bun 1.0+
WhatsApp Library @whiskeysockets/baileys v7 RC13
Module System Pure ESM ("type": "module")
Logger pino + chalk
Media Processing fluent-ffmpeg, jimp, sharp, node-webpmux
HTTP Client axios
Date/Time moment-timezone

---

📜 Lisensi

Dirilis di bawah lisensi CC BY-NC 4.0 (Creative Commons Attribution-NonCommercial 4.0 International).

· ✅ Boleh: Menggunakan, memodifikasi, dan mendistribusikan
· ❌ Tidak boleh: Menggunakan untuk tujuan komersial
· 📝 Wajib: Mencantumkan atribusi kepada pembuat asli (ditss)

---

<div align="center">

Dibuat dengan ❤️ oleh ditss

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=100&section=footer" />

</div>
