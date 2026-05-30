import axios from 'axios';
import BodyForm from 'form-data';
import FormData from 'form-data';
import { fileTypeFromBuffer } from 'file-type';
import fs from 'fs';
import * as cheerio from 'cheerio';
import chalk from 'chalk';
import path from 'path';

// ==================== CDN ASYNC ====================
const baseURL = 'https://cdn.asuma.my.id';

async function uploadToCdn(input, endpoint, options = {}) {
  const { folder, filename, isTemp } = options;

  if (typeof input === 'string' && /^https?:\/\//.test(input)) {
    const payload = { url: input };
    if (!isTemp && folder) payload.folder = folder;
    if (isTemp && filename) payload.filename = filename;

    const { data } = await axios.post(endpoint, payload, {
      headers: { 'Content-Type': 'application/json' }
    });
    if (!data?.url) throw new Error('URL tidak ditemukan di response');
    return data;
  }

  if (typeof input === 'string' && fs.existsSync(input)) {
    const form = new FormData();
    form.append('file', fs.createReadStream(input));
    if (!isTemp && folder) form.append('folder', folder);

    const { data } = await axios.post(endpoint, form, {
      headers: form.getHeaders()
    });
    if (!data?.url) throw new Error('URL tidak ditemukan di response');
    return data;
  }

  if (Buffer.isBuffer(input)) {
    try {
      const payload = {
        buffer: input.toString('base64'),
        filename: filename || 'file.bin'
      };
      if (!isTemp && folder) payload.folder = folder;

      const { data } = await axios.post(endpoint, payload, {
        headers: { 'Content-Type': 'application/json' }
      });
      if (data?.url) return data;
    } catch (jsonError) {
      const form = new FormData();
      form.append('file', input, { filename: filename || 'file.bin' });
      if (!isTemp && folder) form.append('folder', folder);

      const { data } = await axios.post(endpoint, form, {
        headers: form.getHeaders()
      });
      if (!data?.url) throw new Error('URL tidak ditemukan di response');
      return data;
    }
  }

  if (typeof input === 'string' && /^[A-Za-z0-9+/=]+$/.test(input)) {
    const payload = {
      buffer: input,
      filename: filename || 'file.bin'
    };
    if (!isTemp && folder) payload.folder = folder;

    const { data } = await axios.post(endpoint, payload, {
      headers: { 'Content-Type': 'application/json' }
    });
    if (!data?.url) throw new Error('URL tidak ditemukan di response');
    return data;
  }

  if (typeof input === 'string' && input.startsWith('data:')) {
    const payload = { dataurl: input };
    if (!isTemp && folder) payload.folder = folder;
    if (isTemp && filename) payload.filename = filename;

    const { data } = await axios.post(endpoint, payload, {
      headers: { 'Content-Type': 'application/json' }
    });
    if (!data?.url) throw new Error('URL tidak ditemukan di response');
    return data;
  }

  throw new Error('Input tidak valid (harus URL, path file, Buffer, base64, atau data URL)');
}

async function AsumaCdnTemp(input, options = {}) {
  const { filename } = options;
  const endpoint = `${baseURL}/temp/upload`;

  try {
    const result = await uploadToCdn(input, endpoint, { filename, isTemp: true });
    return result;
  } catch (error) {
    console.error('AsumaCdnTemp Error:', error.response?.data || error.message);
    throw new Error('Gagal upload temporary ke CDN');
  }
}

async function AsumaCdn(input, options = {}) {
  const { folder, filename } = options;
  const endpoint = `${baseURL}/upload`;

  try {
    const result = await uploadToCdn(input, endpoint, { folder, filename, isTemp: false });
    return result.url;
  } catch (error) {
    console.error('AsumaCdn Error:', error.response?.data || error.message);
    throw new Error('Gagal upload ke CDN Asuma');
  }
}

// ==================== UPLOADER LAINNYA ====================
async function pomfCDN(path) {
  try {
    const fileStream = fs.createReadStream(path);
    const formData = new BodyForm();
    formData.append('files[]', fileStream);

    const response = await axios.post('https://pomf.lain.la/upload.php', formData, {
      headers: {
        ...formData.getHeaders(),
      },
    });

    return response.data.files[0].url;
  } catch (error) {
    console.log("Error at pomf uploader in lib/uploader.js:", error);
    return "Terjadi Kesalahan";
  }
}

function TelegraPh(Path) {
  return new Promise(async (resolve, reject) => {
    if (!fs.existsSync(Path)) return reject(new Error("File not Found"));
    try {
      const form = new BodyForm();
      form.append("file", fs.createReadStream(Path));
      const data = await axios({
        url: "https://telegra.ph/upload",
        method: "POST",
        headers: {
          ...form.getHeaders()
        },
        data: form
      });
      return resolve("https://telegra.ph" + data.data[0].src);
    } catch (err) {
      return reject(new Error(String(err)));
    }
  });
}

async function CatBox(input) {
  const data = new FormData();
  data.append('reqtype', 'fileupload');
  data.append('userhash', '');

  if (Buffer.isBuffer(input)) {
    data.append('fileToUpload', input, {
      filename: 'file.jpg'
    });
  } else {
    data.append('fileToUpload', fs.createReadStream(input));
  }

  const config = {
    method: 'POST',
    url: 'https://catbox.moe/user/api.php',
    headers: {
      ...data.getHeaders(),
      'User-Agent': 'Mozilla/5.0'
    },
    data: data
  };

  const api = await axios.request(config);
  return api.data;
}

async function UploadFileUgu(input) {
  return new Promise(async (resolve, reject) => {
    const form = new BodyForm();
    form.append("files[]", fs.createReadStream(input));
    await axios({
      url: "https://uguu.se/upload.php",
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36",
        ...form.getHeaders()
      },
      data: form
    }).then((data) => {
      resolve(data.data.files[0]);
    }).catch((err) => reject(err));
  });
}

async function DitssCloudUrl(path) {
  try {
    const buffer = fs.readFileSync(path);
    const type = await fileTypeFromBuffer(buffer);
    const ext = type?.ext || 'bin';
    const mime = type?.mime || 'application/octet-stream';
    const filename = `${Date.now().toString(36)}.${ext}`;
    const mediaPath = `media/${filename}`;
    const contentBase64 = buffer.toString('base64');

    const githubToken = process.env.GITHUB_TOKEN || 'vOLPza12oEXjoqDRlL0kxnSBJLM1ZT0CCrc3';
    const owner = 'ditss-dev';
    const repo = 'Baileysss';
    const branch = 'main';
    const apiURL = `https://api.github.com/repos/${owner}/${repo}/contents/${mediaPath}`;

    await axios.put(apiURL, {
      message: `Upload via bot: ${filename}`,
      content: contentBase64,
      branch,
    }, {
      headers: {
        Authorization: `token ${githubToken}`,
        'User-Agent': 'wa-bot-uploader',
        Accept: 'application/vnd.github+json',
      },
    });

    return {
      url: `https://ditss.cloud/${mediaPath}`,
      ext,
      mime,
    };
  } catch (error) {
    console.error('DitssCloudUrl Error:', error.response?.data || error.message);
    throw new Error('Gagal upload ke GitHub CDN');
  }
}

async function webp2mp4File(url) {
  try {
    const res = await axios.get(`https://ezgif.com/webp-to-mp4?url=${url}`);
    const $ = cheerio.load(res.data);
    const file = $('input[name="file"]').attr('value');

    if (!file) {
      throw new Error('Gagal mendapatkan file dari respon pertama.');
    }

    const data = new URLSearchParams({
      file: file,
      convert: 'Convert WebP to MP4!'
    });

    const res2 = await axios.post(`https://ezgif.com/webp-to-mp4/${file}`, data);
    const $2 = cheerio.load(res2.data);
    const link = $2('div#output > p.outfile > video > source').attr('src');

    if (!link) {
      throw new Error('Gagal mendapatkan link hasil konversi.');
    }

    return `https:${link}`;
  } catch (error) {
    console.error('Terjadi kesalahan:', error.message);
    throw error;
  }
}

async function UguuSe(buffer) {
  return new Promise(async (resolve, reject) => {
    try {
      const form = new FormData();
      const input = Buffer.from(buffer);
      const { ext } = await fileTypeFromBuffer(buffer);
      form.append('files[]', input, { filename: 'data.' + ext });
      const data = await axios.post('https://uguu.se/upload.php', form, {
        headers: {
          ...form.getHeaders()
        }
      });
      resolve(data.data.files[0]);
    } catch (e) {
      reject(e);
    }
  });
}

// ==================== EXPORT ====================
export { 
  AsumaCdn,
  AsumaCdnTemp,
  pomfCDN, 
  CatBox, 
  TelegraPh, 
  UploadFileUgu, 
  webp2mp4File, 
  DitssCloudUrl, 
  UguuSe
};
