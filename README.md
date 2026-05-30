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
  <b>Asuma Multi Device</b> is a modern WhatsApp Bot Base built on top of <a href="https://github.com/WhiskeySockets/Baileys">@whiskeysockets/baileys</a>.<br/>
  Designed with a modular architecture, Pure ESM, and full support for both Node.js & Bun runtimes.
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-folder-structure">Structure</a> •
  <a href="#-installation">Installation</a> •
  <a href="#-creating-plugins">Plugins</a> •
  <a href="#-screenshots--preview">Preview</a> •
  <a href="#-changelog--roadmap">Changelog</a> •
  <a href="#-faq--troubleshooting">FAQ</a> •
  <a href="#-contributing">Contributing</a>
</p>

</div>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| ⚡ **Pure ESM** | Entire codebase uses native ES Modules — modern & future-proof |
| 🔌 **Universal Plugin System** | Supports both CJS (`.cjs`) and ESM (`.mjs` / `.js`) plugins in one loader |
| 📂 **Subfolder Support** | Plugins can be organized in subfolders (`group/`, `owner/`, `general/`, etc.) |
| 📱 **Pairing Code** | Connect via Pairing Code (phone number) — easier than scanning QR |
| 🛠️ **Dynamic Case System** | Add/remove command cases directly from WhatsApp chat (Owner only) |
| 🧩 **Modular Architecture** | Clean folder structure: `core/`, `lib/`, `plugins/` |
| 🚀 **Bun-native** | Runs natively on Bun for faster performance |
| 🔒 **Baileys v7 RC13+** | Compatible with the latest Baileys with LID (Local Identifier) support |
| 🎨 **Rich Media Support** | Stickers (image/video/gif), audio, polling, button messages, list messages |
| 🗄️ **SQLite Auth State** | Secure session storage using SQLite with encryption |
| 🔄 **JadiBot / Clone Bot** | Create and manage multiple bot instances with isolated processes |
| 📊 **PM2 Ready** | Built-in PM2 ecosystem config with auto-detect runtime (Bun/Node.js) |

---

## 📁 Folder Structure

```

asuma/
├── index.js                   # Entry point (WhatsApp connection)
├── config.js                  # Main bot configuration
├── Asuma.js                   # Main message handler
├── ecosystem.config.cjs       # PM2 configuration (auto-detect runtime)
├── package.json
├── database/                  # JSON data (owner, premium, etc.)
├── logs/                      # PM2 log files
├── session/                   # Auth session (auto-generated)
├── temp/                      # Temporary files
└── src/
├── auth/                  # SQLite authentication
│   ├── index.js           # Auth state exports
│   ├── sqlite.js          # SQLite auth implementation
│   ├── encryption.js      # Credential encryption
│   ├── database.js        # Database initialization
│   └── constants.js       # Auth constants
├── clone/                 # Clone bot / Jadibot system
│   ├── manager.js         # Process manager for clones
│   └── worker.js          # Isolated bot instance worker
├── core/
│   ├── message.js         # Utilities & helper functions
│   ├── logger.js          # Custom logger with box styling
│   ├── media.js           # Media handler (download, upload)
│   └── serialize.js       # Message serializer (LID support)
├── lib/
│   ├── handle.js          # Universal plugin loader
│   ├── case.js            # Dynamic case system
│   ├── exif.js            # Sticker EXIF metadata
│   ├── lidConverter.js    # LID ↔ JID converter
│   └── setup.js           # Bot setup (send methods)
└── plugins/               # All plugins go here
├── owner/             # Owner-only commands
├── group/             # Group commands
├── general/           # Public commands
└── media/             # Media/sticker commands

```

---

## 🚀 Installation

### Prerequisites

- **Node.js** `>= 18.x` or **Bun** `>= 1.0`
- Git

### Step-by-Step

**1. Clone the Repository**
```bash
git clone https://github.com/asuma-labs/asuma.git
cd asuma
```

2. Install Dependencies

With Bun (recommended — faster):

```bash
bun install
```

With Node.js / npm:

```bash
npm install
```

3. Configure the Bot

Edit config.js as needed:

```javascript
export const config = {
    prefa: ['', '!', '.', ',', '🐤', '🗿'],  // Supported prefixes
    owner: ['6285162822778', '6287822118865'], // Owner numbers (without @)
    thumbnail: "https://...",                  // Thumbnail for menu
    name: "Asuma Bot",
    version: "1.0"
};

export const init = {
    session: "./session",      // Session folder
    customPair: "ASUMA"        // Custom pairing code prefix
};
```

4. Run the Bot

With Bun:

```bash
bun start
```

With Node.js:

```bash
npm start
```

With PM2 (Production):

```bash
npm run pm2:start
```

With auto-reload (development):

```bash
bun dev
# or
npm run dev
```

5. Connect to WhatsApp

· Enter the bot's phone number when prompted in the terminal
· Enter the pairing code shown into WhatsApp → Linked Devices → Link a Device → Link with phone number

---

🧩 Creating Plugins

All plugins are placed in src/plugins/. They can be organized in subfolders (group/, owner/, general/, etc.).

ESM Plugin Format (Recommended)

```javascript
// src/plugins/general/ping.js
const handler = async (m, { reply }) => {
    await reply('Pong! 🏓');
};

handler.command = ['ping', 'p'];
handler.owner = false;    // true = owner only
handler.premium = false;  // true = premium users only
handler.group = false;    // true = group chats only
handler.private = false;  // true = private chats only

export default handler;
```

CJS Plugin Format (Legacy Support)

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

Plugin with Subfolder Example

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

Add/remove command cases directly from WhatsApp chat (Owner only):

```
.addcase case "ping": {
  reply("Pong! Asuma Bot is active ✅");
}
break;
```

```
.listcase          → List all saved cases
.getcase ping      → View content of case "ping"
.delcase ping      → Delete case "ping"
```

Note: The case system is a fallback when no plugin is found. It is recommended to use plugins for new features.

---

🔄 Clone Bot / Jadibot System

Asuma supports creating isolated bot instances (jadibot) that run in separate processes using PM2.

Commands (Owner only)

```
.jadibot 628123456789    → Create and start a clone bot
.listjadibot             → List all active clone bots
.stopjadibot 628123456789 → Stop a specific clone bot
```

Architecture

· Each clone bot runs in its own isolated process (using child_process.fork)
· Uses SQLite for session storage (separate database per clone)
· Auto-restart on crash (up to 5 retries)
· Clone bots do not interfere with the main bot's performance

---

🗄️ SQLite Auth State

Asuma uses SQLite for session storage instead of JSON files:

· Encrypted credentials using AES-256-GCM
· Better performance for large session data
· Atomic operations — no more corrupted JSON files
· Shared key store for LID mapping across bots

Requirements:

· Node.js: Requires better-sqlite3 (optional dependency)
· Bun: Uses built-in bun:sqlite — no additional installation

---

📦 Built-in Methods

After the bot is connected, the Ditss (socket) object has additional methods:

Method Description
sendText(jid, text, quoted, options) Send plain text
sendMedia(jid, path, caption, quoted, options) Send image/video/audio/file
sendImageAsSticker(jid, path, quoted, options) Convert image to sticker
sendVideoAsSticker(jid, path, quoted, options) Convert video to sticker
sendPoll(jid, question, options) Send a poll
sendAudio(jid, input, isPtt, quoted) Send audio (PTT/non-PTT)
sendButtons(jid, options) Send interactive buttons
sendListMsg(jid, content, options) Send a list message

---

🛠️ Tech Stack

Component Technology
Runtime Node.js 18+ / Bun 1.0+
WhatsApp Library @whiskeysockets/baileys v7 RC13
Module System Pure ESM ("type": "module")
Session Storage SQLite (encrypted)
Process Manager PM2
Logger pino + chalk
Media Processing fluent-ffmpeg, jimp, sharp, node-webpmux
HTTP Client axios
Date/Time moment-timezone

---

📸 Screenshots / Preview

Screenshots and demo previews will be added here.

<!--
To add screenshots, upload your images and use the format below:

<p align="center">
  <img src="./assets/screenshots/preview-1.png" width="45%" />
  <img src="./assets/screenshots/preview-2.png" width="45%" />
</p>
-->

Preview Description
🖼️ Coming soon Bot startup & pairing code terminal
🖼️ Coming soon Plugin commands in action
🖼️ Coming soon Sticker & media generation
🖼️ Coming soon Group management commands
🖼️ Coming soon Clone bot management

---

📋 Changelog / Roadmap

Changelog

v1.0.0 — Initial Release

· ✅ Pure ESM architecture
· ✅ Universal plugin loader (CJS + ESM)
· ✅ Subfolder plugin support
· ✅ Pairing Code connection
· ✅ Dynamic case system
· ✅ Baileys v7 RC13 compatibility (LID support)
· ✅ Rich media support (sticker, audio, poll, button, list)
· ✅ Built-in send methods via setup.js
· ✅ SQLite Auth State with encryption
· ✅ Clone Bot / Jadibot system (isolated processes)
· ✅ PM2 ecosystem config with auto-detect runtime

Roadmap

Status Feature
✅ Completed SQLite authentication
✅ Completed Clone bot / Jadibot system
✅ Completed PM2 production setup
📅 Planned Web-based dashboard for bot management
📅 Planned Auto-updater for plugins
📅 Planned Multi-session support (multiple numbers)
📅 Planned Webhook support for external integrations
💡 Idea AI/LLM integration (OpenAI, Gemini, etc.)

---

❓ FAQ / Troubleshooting

General

Q: Which runtime should I use — Node.js or Bun?

Bun is recommended for better performance and native SQLite support. Node.js is fully supported if Bun is unavailable.

Q: Can I run multiple bots with different numbers?

Yes! Use the .jadibot command to create isolated clone bot instances. Each clone runs in its own process and has its own SQLite session.

Q: Does this work on Windows?

Yes, but Bun on Windows may have limitations. Node.js is more stable on Windows environments.

Q: How do I keep the bot running after server restart?

Use PM2: npm run pm2:start then npm run pm2:save. The bot will auto-start on server reboot.

---

Connection Issues

Q: Pairing code not appearing / keeps regenerating

Make sure you're using the correct phone number format (country code + number, no + or spaces). Also ensure your WhatsApp is updated to the latest version.

Q: Error: Connection Failure or bot keeps disconnecting

· Delete the session/ folder and reconnect
· Make sure your internet connection is stable
· Check that your WhatsApp account is not banned

Q: LID related errors

This project uses lidConverter.js to handle LID ↔ JID conversion. Ensure you're on Baileys v7 RC13 or later. Run bun install or npm install to update dependencies.

---

Plugin Issues

Q: My plugin is not being loaded

· Confirm the file is in src/plugins/ or a subfolder
· For ESM plugins, use export default handler
· For CJS plugins, use .cjs extension and module.exports = handler
· Make sure handler.command is set correctly

Q: Can I use require() inside an ESM plugin?

No. In Pure ESM, use import instead. If you need CJS compatibility, rename your file to .cjs.

Q: Dynamic case commands are not working

Only the owner (numbers defined in config.js) can use .addcase, .delcase, etc. Verify your number is listed correctly.

---

Clone Bot Issues

Q: Clone bot not starting / stuck

· Check if the phone number is correct
· Ensure the number is not already registered as a clone
· Check PM2 logs: npm run pm2:logs

Q: Clone bot disconnected and won't reconnect

The system will auto-restart up to 5 times. If still failing, delete the session manually from database/sessions/ and recreate.

Q: Main bot becomes slow when clones are running

Clone bots run in isolated processes and should not affect main bot performance. If you experience lag, check your server's CPU/RAM usage.

---

🤝 Contributing

Contributions are welcome! Here's how to get involved:

How to Contribute

1. Fork this repository
2. Create a new branch for your feature or fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Make your changes and commit with a clear message:
   ```bash
   git commit -m "feat: add your feature description"
   ```
4. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
5. Open a Pull Request against the main branch

Contribution Guidelines

· Follow the existing code style (Pure ESM, async/await)
· Place plugins in the appropriate subfolder under src/plugins/
· Include handler.command and relevant flags (owner, group, etc.) in your plugin
· Write clear commit messages using Conventional Commits format:
  · feat: — new feature
  · fix: — bug fix
  · docs: — documentation changes
  · refactor: — code refactoring
  · chore: — maintenance tasks

Reporting Bugs

Open an Issue and include:

· Node.js / Bun version
· Operating system
· Steps to reproduce
· Error logs (if any)

Feature Requests

Open an Issue with the enhancement label and describe your idea clearly.

---

📜 License

Released under the CC BY-NC 4.0 (Creative Commons Attribution-NonCommercial 4.0 International) license.

· ✅ Allowed: Use, modify, and distribute
· ❌ Not allowed: Use for commercial purposes
· 📝 Required: Attribute the original creator (ditss)

---

<div align="center">

Made with ❤️ by ditss

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=100&section=footer" />

</div>
