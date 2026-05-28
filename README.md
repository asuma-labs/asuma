<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=180&section=header&text=AsumaMD&fontSize=72&fontColor=fff&animation=twinkling&fontAlignY=32&desc=Asuma%20Multi%20Device%20WhatsApp%20Bot&descAlignY=55&descAlign=50" />

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-%3E%3D20-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/Bun-%3E%3D1.0-fbf0df?style=for-the-badge&logo=bun&logoColor=black" />
  <img src="https://img.shields.io/badge/Baileys-Latest-25D366?style=for-the-badge&logo=whatsapp&logoColor=white" />
  <img src="https://img.shields.io/badge/ESM-Pure%20Module-f7df1e?style=for-the-badge&logo=javascript&logoColor=black" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" />
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
| ⚡ **Pure ESM** | Seluruh codebase menggunakan ES Modules native — tidak ada `.mjs`, tidak ada CommonJS |
| 🔌 **Hybrid Plugin System** | Plugin support format CJS, ESM, dan ekspor modern dalam satu loader |
| 🔄 **Auto-Reload Plugin** | Plugin di-watch secara realtime menggunakan `chokidar` — edit tanpa restart |
| 📱 **Pairing Code + QR** | Koneksi via Pairing Code (nomor HP) atau QR Code sesuai pilihan |
| 🛠️ **Dynamic Case System** | Tambah/hapus command case langsung dari chat WhatsApp (khusus Owner) |
| 🧩 **Modular Architecture** | Struktur folder bersih: `core/`, `handler/`, `lib/`, `plugins/`, `commands/` |
| 🌍 **Env-based Config** | Konfigurasi via `.env` — aman, fleksibel, dan tidak hardcoded |
| 🚀 **Bun-native** | Berjalan secara native di Bun untuk performa lebih cepat |
| 🔒 **Baileys RC-13+ Ready** | Kompatibel dengan Baileys terbaru termasuk perbaikan sinkronisasi & enkripsi |
| 📦 **TypeScript Friendly** | JSDoc type hints di seluruh file — IDE-aware tanpa perlu kompilasi |

---

## 📁 Struktur Folder

```
asuma-multi-device/
├── src/
│   ├── core/
│   │   ├── connection.js      # Koneksi Baileys, Auth State, Store
│   │   ├── store.js           # In-memory message store
│   │   └── logger.js          # Custom logger (pino-pretty)
│   ├── handler/
│   │   ├── message.js         # Handler pesan masuk utama
│   │   ├── group.js           # Handler event grup
│   │   └── call.js            # Handler panggilan masuk
│   ├── lib/
│   │   ├── serialize.js       # Serialisasi objek pesan Baileys
│   │   ├── functions.js       # Fungsi helper umum (format, convert, dll)
│   │   ├── plugin-loader.js   # Loader & watcher plugin (CJS/ESM hybrid)
│   │   └── case-system.js     # Dynamic case manager
│   ├── plugins/               # Plugin internal / core commands
│   │   ├── menu.js
│   │   └── owner.js
│   └── commands/              # Command terstruktur alternatif
│       └── example.js
├── config/
│   └── settings.js            # Konfigurasi bot (baca dari .env)
├── database/
│   ├── session/               # Auth session Baileys (gitignored)
│   ├── owner.json             # Data owner & admin
│   └── premium.json           # Data pengguna premium
├── plugins/                   # Plugin eksternal buatan pengguna (Auto-Reload)
│   └── hello.js               # Contoh plugin
├── index.js                   # Main entry point (bootstrapper)
├── package.json
├── .env                       # Environment variables (gitignored)
├── .env.example               # Template environment variables
├── .gitignore
└── README.md
```

---

## 🚀 Instalasi & Menjalankan

### Prasyarat

- **Node.js** `>= 20.x` atau **Bun** `>= 1.0`
- Git

### Langkah Instalasi

**1. Clone Repository**
```bash
git clone https://github.com/username/asuma-multi-device.git
cd asuma-multi-device
```

**2. Install Dependencies**

Dengan **Bun** (direkomendasikan, lebih cepat):
```bash
bun install
```

Dengan **Node.js / npm**:
```bash
npm install
```

**3. Konfigurasi Environment**
```bash
cp .env.example .env
```
Buka `.env` dan isi sesuai kebutuhan:
```env
BOT_NAME=AsumaMD
OWNER_NUMBER=628xxxxxxxxxx
PREFIX=.
USE_PAIRING_CODE=true
BOT_NUMBER=628xxxxxxxxxx
```

**4. Jalankan Bot**

Dengan **Bun**:
```bash
bun start
```

Dengan **Node.js**:
```bash
npm start
```

Dengan **auto-reload** (development):
```bash
bun dev
# atau
npm run dev
```

**5. Hubungkan ke WhatsApp**

- Jika `USE_PAIRING_CODE=true`: Masukkan nomor bot saat diminta → masukkan kode yang muncul di terminal ke aplikasi WhatsApp (**Perangkat Tertaut → Tautkan Perangkat → Tautkan dengan nomor telepon**)
- Jika `USE_PAIRING_CODE=false`: Scan QR Code yang tampil di terminal

---

## 🧩 Cara Membuat Plugin

Semua plugin diletakkan di folder `plugins/` (root) dan akan otomatis dimuat & di-watch saat bot berjalan.

### Format Plugin ESM (Standar AsumaMD)

```js
// plugins/salam.js

/** @type {import('../src/lib/plugin-loader.js').AsumaPlugin} */
const handler = async (m, { sock, reply }) => {
  await reply(`Halo, ${m.pushName}! Selamat datang di AsumaMD 🔥`)
}

handler.command = ['salam', 'hello', 'hi']
handler.description = 'Kirim pesan salam'
handler.category = 'general'
// handler.owner = true      // Hanya owner
// handler.group = true      // Hanya di grup
// handler.private = true    // Hanya di private chat

export default handler
```

### Format Plugin CommonJS (Legacy Support)

```js
// plugins/info.js (format CJS tetap didukung)

const handler = async (m, { reply }) => {
  await reply('AsumaMD v1.0.0 — by Aditia Nugraha')
}

handler.command = ['info', 'about']
handler.description = 'Info tentang bot'

module.exports = handler
```

---

## 🔄 Migrasi Plugin dari LingerBase

Plugin lama dari LingerBase dapat dimigrasikan dengan mudah:

| LingerBase (Lama) | AsumaMD (Baru) |
|---|---|
| `src/plugins/esm/nama.mjs` | `plugins/nama.js` |
| `src/plugins/cjs/nama.js` | `plugins/nama.js` (langsung kompatibel) |
| `export default handler` | `export default handler` (sama) |
| `module.exports = handler` | `module.exports = handler` (masih support) |

**Ubah referensi di plugin lama:**
```js
// Lama (LingerBase)
import { lingerfunc } from '../lib/functions.js'

// Baru (AsumaMD)
import { asumaFunc } from '../src/lib/functions.js'
```

---

## ⚙️ Dynamic Case System

Tambah/hapus command case langsung dari chat WhatsApp (khusus Owner):

```
.addcase case "ping": {
  reply("Pong! Bot AsumaMD aktif ✅");
}
break;
```

```
.listcase    → Lihat semua case yang tersimpan
.delcase ping → Hapus case "ping"
```

---

## 🛠️ Tech Stack

- **Runtime**: Node.js 20+ / Bun 1.0+
- **WhatsApp Library**: [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys) (latest)
- **Module System**: Pure ESM (`"type": "module"`)
- **Logger**: [pino](https://github.com/pinojs/pino) + pino-pretty
- **File Watcher**: [chokidar](https://github.com/paulmillr/chokidar)
- **Media Processing**: fluent-ffmpeg, jimp, sharp, wa-sticker-formatter

---

## 📜 Lisensi

Dirilis di bawah lisensi **MIT**. Bebas digunakan, dimodifikasi, dan didistribusikan.

---

<div align="center">

Dibuat dengan ❤️ oleh **Aditia Nugraha**

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=100&section=footer" />

</div>
