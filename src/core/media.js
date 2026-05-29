import fs from 'fs';
import path from 'path';
import { fileTypeFromBuffer } from 'file-type';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';

class MediaHandler {
    constructor(sock, utils) {
        this.sock = sock;
        this.utils = utils; 
    }

    async getFile(PATH, save = false) {
        let data;

        if (Buffer.isBuffer(PATH)) {
            data = PATH;
        } else if (/^data:.*?\/.*?;base64,/i.test(PATH)) {
            data = Buffer.from(PATH.split`,`[1], 'base64');
        } else if (/^https?:\/\//.test(PATH)) {
            data = await this.utils.getBuffer(PATH);
        } else if (fs.existsSync(PATH)) {
            data = fs.readFileSync(PATH);
        } else if (typeof PATH === 'string') {
            data = Buffer.from(PATH);
        } else {
            data = Buffer.alloc(0);
        }

        const type = await fileTypeFromBuffer(data) || {
            mime: 'application/octet-stream',
            ext: 'bin'
        };

        const filename = path.join(process.cwd(), 'temp', `\( {Date.now()}. \){type.ext}`);

        if (save && data.length > 0) {
            const dir = path.dirname(filename);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            await fs.promises.writeFile(filename, data);
        }

        return {
            res: data,
            filename,
            size: await this.utils.getSizeMedia(data),
            ...type,
            data
        };
    }

    async downloadMediaMessage(message) {
        const quoted = message.msg || message;
        const mime = quoted.mimetype || '';
        const messageType = message.mtype 
            ? message.mtype.replace(/Message/gi, '') 
            : mime.split('/')[0];

        const stream = await downloadContentFromMessage(message, messageType);
        let buffer = Buffer.from([]);

        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        return buffer;
    }

async downloadAndSaveMediaMessage(message, filename, attachExtension = true) {
    const buffer = await this.downloadMediaMessage(message);
    const type = await fileTypeFromBuffer(buffer) || { ext: 'bin' };

    const trueFileName = attachExtension 
        ? `${filename}.${type.ext}` 
        : filename;

    const dir = path.dirname(trueFileName);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    await fs.promises.writeFile(trueFileName, buffer);
    return trueFileName;
}
}

export default MediaHandler; 
/*import fs from 'fs';
import path from 'path';
import { fileTypeFromBuffer } from 'file-type';
import { downloadMediaMessage } from '@whiskeysockets/baileys';

class MediaHandler {
    constructor(sock, utils) {
        this.sock = sock;
        this.utils = utils;
    }

    async getFile(PATH, save = false) {
        const { getBuffer, getSizeMedia } = this.utils;
        
        let data = Buffer.isBuffer(PATH) ? PATH :
                   /^data:.*?\/.*?;base64,/i.test(PATH) ? Buffer.from(PATH.split`,`[1], 'base64') :
                   /^https?:\/\//.test(PATH) ? await getBuffer(PATH) :
                   fs.existsSync(PATH) ? fs.readFileSync(PATH) :
                   Buffer.alloc(0);

        const type = await fileTypeFromBuffer(data) || { 
            mime: 'application/octet-stream', 
            ext: 'bin' 
        };

        const filename = path.join(process.cwd(), 'temp', `${Date.now()}.${type.ext}`);

        if (data && save) {
            await fs.promises.mkdir(path.dirname(filename), { recursive: true });
            await fs.promises.writeFile(filename, data);
        }

        return { filename, size: await getSizeMedia(data), ...type, data };
    }

    async downloadMediaMessage(message) {
        try {
            return await downloadMediaMessage(message, 'buffer');
        } catch (error) {
            console.error('Failed to download media:', error);
            throw error;
        }
    }

    async downloadAndSaveMediaMessage(message, filename, attachExtension = true) {
        const buffer = await this.downloadMediaMessage(message);
        const type = await fileTypeFromBuffer(buffer) || { ext: 'bin' };
        const trueFileName = attachExtension ? `${filename}.${type.ext}` : filename;
        await fs.promises.mkdir(path.dirname(trueFileName), { recursive: true });
        await fs.promises.writeFile(trueFileName, buffer);
        return trueFileName;
    }
}

export default MediaHandler;*/
