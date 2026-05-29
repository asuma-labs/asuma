import { proto, getContentType, areJidsSameUser, generateWAMessage, downloadContentFromMessage } from '@whiskeysockets/baileys';
import axios from 'axios';
import moment from 'moment-timezone';
import { sizeFormatter } from 'human-readable';
import util from 'util';
import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import { lidConverter } from '../lib/lidConverter.js';
import dns from 'node:dns/promises';

const unixTimestampSeconds = (date = new Date()) => Math.floor(date.getTime() / 1000);

const generateMessageTag = (epoch) => {
    let tag = unixTimestampSeconds().toString();
    if (epoch) tag += '.--' + epoch;
    return tag;
};

function formatDuration(ms) {
    if (ms < 1000) return 'baru saja';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
        return `${days} hari ${hours % 24} jam`;
    } else if (hours > 0) {
        return `${hours} jam ${minutes % 60} menit`;
    } else if (minutes > 0) {
        return `${minutes} menit ${seconds % 60} detik`;
    } else {
        return `${seconds} detik`;
    }
}

const processTime = (timestamp, now) => {
    return moment.duration(now - moment(timestamp * 1000)).asSeconds();
};

const getRandom = (ext) => {
    return `${Math.floor(Math.random() * 10000)}${ext}`;
};

const getBuffer = async (url, options = {}) => {
    try {
        const res = await axios({
            method: "get",
            url,
            headers: { 'DNT': 1, 'Upgrade-Insecure-Request': 1 },
            ...options,
            responseType: 'arraybuffer'
        });
        return res.data;
    } catch (err) {
        return err;
    }
};

const fetchJson = async (url, options = {}) => {
    try {
        const res = await axios({
            method: 'GET',
            url: url,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36'
            },
            ...options
        });
        return res.data;
    } catch (err) {
        return err;
    }
};

const runtime2 = (seconds) => {
    seconds = Number(seconds);
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const dDisplay = d > 0 ? d + (d === 1 ? " day, " : " days, ") : "";
    const hDisplay = h > 0 ? h + (h === 1 ? " hour, " : " hours, ") : "";
    const mDisplay = m > 0 ? m + (m === 1 ? " minute, " : " minutes, ") : "";
    const sDisplay = s > 0 ? s + (s === 1 ? " second" : " seconds") : "";
    return dDisplay + hDisplay + mDisplay + sDisplay;
};

const runtime = (seconds) => {
    seconds = Number(seconds);
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const dDisplay = d > 0 ? d + (d === 1 ? " hari, " : " hari, ") : "";
    const hDisplay = h > 0 ? h + (h === 1 ? " jam, " : " jam, ") : "";
    const mDisplay = m > 0 ? m + (m === 1 ? " menit, " : " menit, ") : "";
    const sDisplay = s > 0 ? s + (s === 1 ? " detik" : " detik") : "";
    return dDisplay + hDisplay + mDisplay + sDisplay;
};

const clockString = (ms) => {
    let h = isNaN(ms) ? '--' : Math.floor(ms / 3600000);
    let m = isNaN(ms) ? '--' : Math.floor(ms / 60000) % 60;
    let s = isNaN(ms) ? '--' : Math.floor(ms / 1000) % 60;
    return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
};

const sleep = async (ms) => new Promise(resolve => setTimeout(resolve, ms));

const isUrl = async (text) => {
    if (!text) return false;

    const urlRegex = /((https?:\/\/)?[^\s]+\.[^\s]+)/gi;
    const urls = text.match(urlRegex);
    
    if (!urls) return false;

    const checks = urls.map(async (url) => {
        const domain = url
            .replace(/^https?:\/\//, '')
            .split('/')[0]
            .split(':')[0]
            .split('@')
            .pop();
        await dns.lookup(domain);
        return true;
    });

    try {
        await Promise.any(checks);
        return true;
    } catch {
        return false;
    }
};

const getTime = (format, date) => date 
    ? moment(date).locale('id').format(format) 
    : moment.tz('Asia/Jakarta').locale('id').format(format);

const formatDate = (n, locale = 'id') => new Date(n).toLocaleDateString(locale, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric'
});

const tanggal = (numer) => {
    const myMonths = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
    const myDays = ['Minggu','Senin','Selasa','Rabu','Kamis','Jum’at','Sabtu'];
    const tgl = new Date(numer);
    const day = tgl.getDate();
    const bulan = tgl.getMonth();
    const thisDay = myDays[tgl.getDay()];
    const yy = tgl.getYear();
    const year = (yy < 1000) ? yy + 1900 : yy;
    return `${thisDay}, ${day} - ${myMonths[bulan]} - ${year}`;
};

const formatp = sizeFormatter({ std: 'JEDEC', decimalPlaces: 2, keepTrailingZeroes: false, render: (literal, symbol) => `${literal} ${symbol}B` });

const jsonformat = (string) => JSON.stringify(string, null, 2);

const format = (...args) => util.format(...args);

const logic = (check, inp, out) => {
    if (inp.length !== out.length) throw new Error('Input and Output must have same length');
    for (let i in inp) if (util.isDeepStrictEqual(check, inp[i])) return out[i];
    return null;
};

export const generateProfilePicture = async (buffer) => {
    try {
        const image = sharp(buffer);
        const metadata = await image.metadata();
        
        const resized = await image
            .resize(720, 720, {
                fit: 'cover',
                position: 'center'
            })
            .jpeg({ quality: 90 })
            .toBuffer();
        
        return {
            img: resized,
            preview: resized
        };
    } catch (error) {
        console.error('Error generating profile picture:', error);
        return {
            img: buffer,
            preview: buffer
        };
    }
};

const bytesToSize = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const getSizeMedia = (path) => {
    return new Promise((resolve, reject) => {
        if (/http/.test(path)) {
            axios.get(path).then(res => {
                const length = parseInt(res.headers['content-length']);
                if (!isNaN(length)) resolve(bytesToSize(length, 3));
                else reject('error');
            }).catch(reject);
        } else if (Buffer.isBuffer(path)) {
            const length = Buffer.byteLength(path);
            if (!isNaN(length)) resolve(bytesToSize(length, 3));
            else reject('error');
        } else {
            reject('error');
        }
    });
};

const parseMention = (text = '') => [...text.matchAll(/@([0-9]{5,16}|0)/g)].map(v => v[1] + '@s.whatsapp.net');

const getGroupAdm = (participants) => {
    let admins = [];
    for (let i of participants) {
        if (i.admin === "superadmin" || i.admin === "admin") admins.push(i.id);
    }
    return admins || [];
};

function getDevice(id) {
    if (!id) return 'Unknown';
    if (id.startsWith('BAE5') && id.length === 16) return 'Web';
    if (id.startsWith('3EB0') && id.length === 20) return 'iOS';
    if (id.startsWith('B24E') && id.length === 22) return 'Android';
    if (id.startsWith('HSK') && id.length === 12) return 'Desktop';
    if (id.startsWith('WA') && id.length === 16) return 'WhatsApp Business';
    return 'Unknown';
}

function extractMessageContent(msg) {
    if (!msg) return null;
    const types = ['conversation', 'extendedTextMessage', 'imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage', 'documentMessage', 'buttonsResponseMessage', 'listResponseMessage', 'templateButtonReplyMessage', 'interactiveResponseMessage'];
    for (const type of types) {
        if (msg[type]) return msg[type];
    }
    return msg;
}

export {
    unixTimestampSeconds,
    generateMessageTag,
    processTime,
    getRandom,
    getBuffer,
    fetchJson,
    runtime,
    clockString,
    sleep,
    isUrl,
    getTime,
    formatDate,
    formatDuration,
    tanggal,
    formatp,
    jsonformat,
    format,
    logic,
    bytesToSize,
    getSizeMedia,
    parseMention,
    getGroupAdm
};
