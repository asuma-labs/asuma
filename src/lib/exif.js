import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import ff from 'fluent-ffmpeg';
import { fileTypeFromFile } from 'file-type';
import { fileURLToPath } from 'url';
import webp from 'node-webpmux';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function gifToWebp(media) {
    const isPath = typeof media === 'string';
    const tmpFileIn = isPath ? media : path.join(__dirname, '../../.tmp', `${crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.gif`);
    const tmpFileOut = path.join(__dirname, '../../.tmp', `${crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`);
    try {
        if (!isPath) await fs.promises.writeFile(tmpFileIn, media);
        await new Promise((resolve, reject) => {
            ff(tmpFileIn)
                .on('error', reject)
                .on('end', () => resolve(true))
                .addOutputOptions([
                    '-vf', 'scale=512:512:force_original_aspect_ratio=decrease',
                    '-loop', '0',
                    '-preset', 'default',
                    '-an', '-vsync', '0'
                ])
                .toFormat('webp')
                .save(tmpFileOut);
        });
        return tmpFileOut;
    } catch (e) {
        if (fs.existsSync(tmpFileOut)) fs.unlinkSync(tmpFileOut);
        throw new Error(`Error convert gifToWebp: ${e.message}`);
    } finally {
        if (!isPath && fs.existsSync(tmpFileIn)) fs.unlinkSync(tmpFileIn);
    }
}

async function imageToWebp(media) {
    const isPath = typeof media === 'string';
    const tmpFileIn = isPath ? media : path.join(__dirname, '../../.tmp', `${crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.jpg`);
    const tmpFileOut = path.join(__dirname, '../../.tmp', `${crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`);
    try {
        if (!isPath) await fs.promises.writeFile(tmpFileIn, media);
        await new Promise((resolve, reject) => {
            ff(tmpFileIn)
                .on('error', reject)
                .on('end', () => resolve(true))
                .addOutputOptions([
                    '-vcodec', 'libwebp', '-vf',
                    'scale=500:500:force_original_aspect_ratio=decrease,setsar=1, pad=500:500:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse',
                    '-loop', '0', '-preset', 'default'
                ])
                .toFormat('webp')
                .save(tmpFileOut);
        });
        return tmpFileOut;
    } catch (e) {
        if (fs.existsSync(tmpFileOut)) fs.unlinkSync(tmpFileOut);
        throw new Error(`Error convert imageToWebp: ${e.message}`);
    } finally {
        if (!isPath && fs.existsSync(tmpFileIn)) fs.unlinkSync(tmpFileIn);
    }
}

async function videoToWebp(media) {
    const isPath = typeof media === 'string';
    const tmpFileIn = isPath ? media : path.join(__dirname, '../../.tmp', `${crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.mp4`);
    const tmpFileOut = path.join(__dirname, '../../.tmp', `${crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`);
    try {
        if (!isPath) await fs.promises.writeFile(tmpFileIn, media);
        await new Promise((resolve, reject) => {
            ff(tmpFileIn)
                .on('error', reject)
                .on('end', () => resolve(true))
                .addOutputOptions([
                    '-vcodec', 'libwebp',
                    '-vf', "scale='min(320,iw)':'min(320,ih)':force_original_aspect_ratio=decrease,fps=15, pad=320:320:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse",
                    '-loop', '0',
                    '-ss', '00:00:00',
                    '-t', '00:00:05',
                    '-preset', 'default',
                    '-an', '-vsync', '0'
                ])
                .toFormat('webp')
                .save(tmpFileOut);
        });
        return tmpFileOut;
    } catch (e) {
        if (fs.existsSync(tmpFileOut)) fs.unlinkSync(tmpFileOut);
        throw new Error(`Error convert videoToWebp: ${e.message}`);
    } finally {
        if (!isPath && fs.existsSync(tmpFileIn)) fs.unlinkSync(tmpFileIn);
    }
}

async function writeExif(media, data) {
    const isPath = typeof media === 'string';
    let tmpFileIn = isPath ? media : path.join(__dirname, '../../.tmp', `${crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.tmp`);
    const tmpFileOut = path.join(__dirname, '../../.tmp', `${crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`);
    try {
        if (!isPath) await fs.promises.writeFile(tmpFileIn, media);
        const anu = await fileTypeFromFile(tmpFileIn);
        if (!anu) throw new Error('Format file tidak dikenal');
        
        let wMedia;
        if (/webp/.test(anu.mime)) {
            wMedia = tmpFileIn;
        } else if (/image\/gif/.test(anu.mime)) {
            wMedia = await gifToWebp(tmpFileIn);
        } else if (/jpeg|jpg|png/.test(anu.mime)) {
            wMedia = await imageToWebp(tmpFileIn);
        } else if (/video/.test(anu.mime)) {
            wMedia = await videoToWebp(tmpFileIn);
        } else {
            throw new Error('Format tidak didukung');
        }
        
        if (data) {
            const img = new webp.Image();
            const {
                pack_id,
                packname,
                author,
                categories,
                isAvatar,
                ...rest
            } = data;

            const json = {
                'sticker-pack-id': pack_id || 'https://asuma.my.id',
                'sticker-pack-name': packname || '',
                'sticker-pack-publisher': author || '',
                'emojis': categories || [''],
                'is-avatar-sticker': isAvatar || 0,
                ...rest
            };
            
            const exifAttr = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]);
            const jsonBuff = Buffer.from(JSON.stringify(json), 'utf-8');
            const exif = Buffer.concat([exifAttr, jsonBuff]);
            exif.writeUIntLE(jsonBuff.length, 14, 4);
            await img.load(wMedia);
            img.exif = exif;
            await img.save(tmpFileOut);
            if (wMedia !== tmpFileIn && fs.existsSync(wMedia)) fs.unlinkSync(wMedia);
            return tmpFileOut;
        }
        return wMedia;
    } catch (e) {
        throw new Error(`Error writeExif: ${e.message}`);
    } finally {
        if (!isPath && fs.existsSync(tmpFileIn)) fs.unlinkSync(tmpFileIn);
    }
}

export { 
    imageToWebp, 
    videoToWebp, 
    writeExif, 
    writeExif as writeExifImg,
    writeExif as writeExifVid,
    gifToWebp 
};
