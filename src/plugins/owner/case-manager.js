// src/plugins/owner/case-manager.js
import Case from '../../lib/case.js';
import { config } from '../../../config.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const handler = async (m, { Ditss, text, args, isOwner, command, reply, quoted }) => {
    switch (command) {
        case "getcase": {
            if (!isOwner) return reply("❌ Owner only!");
            if (!text) return reply("❌ Masukkan nama case!\nContoh: .getcase ping");
            try {
                let hasil = Case.get(text);
                if (Ditss.sendRichCodeMessage) {
                    await Ditss.sendRichCodeMessage(m.chat, hasil, 'javascript', {
                        header: `📋 Case: ${text}`,
                        footer: `📦 Dari Asuma Case System`,
                        quoted: m
                    });
                } else {
                    reply(hasil);
                }
            } catch (e) {
                reply(e.message);
            }
            break;
        }

        case "addcase": {
            if (!isOwner) return reply("❌ Owner only!");
            if (!text) return reply(`❌ Format: .addcase case "namacase": { ... }`);
            try {
                Case.add(text);
                reply("✅ Case berhasil ditambahkan!");
            } catch (e) {
                reply(e.message);
            }
            break;
        }

        case "delcase": {
            if (!isOwner) return reply("❌ Owner only!");
            if (!text) return reply("❌ Masukkan nama case!\nContoh: .delcase ping");
            try {
                Case.delete(text);
                reply(`✅ Case "${text}" berhasil dihapus!`);
            } catch (e) {
                reply(e.message);
            }
            break;
        }

        case "listcase": {
            if (!isOwner) return reply("❌ Owner only!");
            try {
                const caseList = Case.list();
                if (caseList === 'No cases found!') {
                    reply("📜 Tidak ada case yang tersimpan.");
                } else {
                    reply(`📜 List Case:\n\n${caseList}`);
                }
            } catch (e) {
                reply(e.message);
            }
            break;
        }

        case "case2plugin": {
            let code = text || (quoted && quoted.text);
            if (!code) return reply("❌ Kirim kode case atau reply pesan yang berisi case!");

            const convertCaseToHandler = (code) => {
                let nameMatch = code.match(/case\s+["'](.+?)["']:/);
                let cmd = nameMatch ? nameMatch[1] : "cmd";
                let body = code
                    .replace(/case\s+["'](.+?)["']:\s*/g, "")
                    .replace(/break;?/g, "")
                    .trim();

                return `const handler = async (m, { reply }) => {\n${body}\n};\n\nhandler.command = ["${cmd}"];\nhandler.owner = false;\n\nexport default handler;`;
            };

            let result = convertCaseToHandler(code);
            
            if (Ditss.sendRichCodeMessage) {
                await Ditss.sendRichCodeMessage(m.chat, result, 'javascript', {
                    header: `🔄 CASE → ESM PLUGIN`,
                    footer: `📦 Simpan ke src/plugins/ dengan ekstensi .js`,
                    quoted: m
                });
            } else {
                await reply(`✅ *CASE → ESM PLUGIN*\n\n\`\`\`js\n${result}\n\`\`\``);
            }
            break;
        }

        case "cjs2esm": {
            let code = text || (quoted && quoted.text);
            if (!code) return reply("❌ Kirim kode CJS atau reply file JS!");

            const convertCJS = (code) => {
                let result = code
                    .replace(/const\s+(\w+)\s*=\s*require\(['"](.+?)['"]\)/g, "import $1 from '$2'")
                    .replace(/module\.exports\s*=\s*/g, "export default ")
                    .replace(/exports\.(\w+)\s*=\s*/g, "export const $1 = ");
                return result;
            };

            let esmCode = convertCJS(code);
            
            if (Ditss.sendRichCodeMessage) {
                await Ditss.sendRichCodeMessage(m.chat, esmCode, 'javascript', {
                    header: `🔄 CJS → ESM CONVERTED`,
                    footer: `📦 Hasil konversi ke ESM`,
                    quoted: m
                });
            } else {
                await reply(`✅ *CJS → ESM CONVERTED*\n\n\`\`\`js\n${esmCode}\n\`\`\``);
            }
            break;
        }

        case "esm2cjs": {
            const q = quoted || m;
            const code = (q.msg && (q.msg.text || q.msg.caption)) || q.text || '';
            if (!code) return reply('❌ Kirim/quote kode ESM yang ingin di-convert!');

            try {
                const convertEsmToCjs = (code) => {
                    return code
                        .replace(/import\s+(\w+)\s+from\s+['"](.+?)['"]/g, "const $1 = require('$2')")
                        .replace(/export\s+default\s+/g, "module.exports = ")
                        .replace(/export\s+const\s+(\w+)\s*=\s*/g, "exports.$1 = ");
                };
                let converted = convertEsmToCjs(code);
                const buffer = Buffer.from(converted, 'utf-8');
                await Ditss.sendMessage(m.chat, {
                    document: buffer,
                    fileName: 'converted.cjs',
                    mimetype: 'text/javascript'
                }, { quoted: m });
            } catch (err) {
                reply('❌ Gagal convert: ' + err.message);
            }
            break;
        }
    }
};

handler.command = ["getcase", "addcase", "delcase", "listcase", "case2plugin", "cjs2esm", "esm2cjs"];
handler.owner = true;

export default handler;
