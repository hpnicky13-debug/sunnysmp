'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 1) continue;
    const key = line.slice(0, i).trim();
    const value = line.slice(i + 1).trim().replace(/^(["'])(.*)\1$/, '$2');
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadEnv(path.join(ROOT, '.env'));

const PORT = Number(process.env.PORT || 3000);
const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || '6283854510244';
const PROMO_CODE = (process.env.PROMO_CODE || 'SUNNY10').trim().toUpperCase();
const PROMO_PERCENT = Math.max(0, Math.min(100, Number(process.env.PROMO_PERCENT || 10)));
const PROMO_EXPIRES_AT = process.env.PROMO_EXPIRES_AT || '2026-10-17T23:59:59+07:00';
const PROMO_EXPIRY = new Date(PROMO_EXPIRES_AT);

// Prices are authoritative on the backend. Do not trust prices sent by the browser.
const RANK_PRICES = Object.freeze({
  SUNSHINE: 15000,
  SUNBEAM: 35000,
  SUNSET: 65000,
  SUMMER: 120000,
  SOLSTICE: 150000,
  SOLARIS: 300000
});

function json(res, status, body) {
  const output = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(output),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(output);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 16_384) {
        reject(new Error('Request terlalu besar.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch { reject(new Error('Format data tidak valid.')); }
    });
    req.on('error', reject);
  });
}
function rankPrice(rank) {
  return RANK_PRICES[String(rank || '').trim().toUpperCase()];
}
function validatePromo(code) {
  if (!code || String(code).trim().toUpperCase() !== PROMO_CODE) {
    return { valid: false, message: 'Kode promo tidak ditemukan.' };
  }
  if (!Number.isFinite(PROMO_EXPIRY.getTime())) {
    return { valid: false, message: 'Tanggal kedaluwarsa promo belum diatur dengan benar.' };
  }
  if (Date.now() > PROMO_EXPIRY.getTime()) {
    return { valid: false, message: 'Promo SUNNY10 sudah kedaluwarsa.' };
  }
  return { valid: true };
}
function getPrice(rank, code) {
  const originalPrice = rankPrice(rank);
  if (!originalPrice) return { error: 'Rank tidak dikenal.' };
  if (code) {
    const promo = validatePromo(code);
    if (!promo.valid) return { error: promo.message };
    const discountAmount = Math.round(originalPrice * PROMO_PERCENT / 100);
    return { originalPrice, discountPercent: PROMO_PERCENT, discountAmount, finalPrice: originalPrice - discountAmount, promoCode: PROMO_CODE };
  }
  return { originalPrice, discountPercent: 0, discountAmount: 0, finalPrice: originalPrice, promoCode: '' };
}
function expiryLabel() {
  if (!Number.isFinite(PROMO_EXPIRY.getTime())) return 'tanggal belum valid';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta', dateStyle: 'long', timeStyle: 'short'
  }).format(PROMO_EXPIRY) + ' WIB';
}
function cleanText(value, max) {
  return String(value || '').trim().slice(0, max);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index-sunnystore-final.html')) {
    const file = path.join(ROOT, 'index-sunnystore-final.html');
    if (!fs.existsSync(file)) return json(res, 404, { message: 'File toko tidak ditemukan. Letakkan index-sunnystore-final.html di folder backend.' });
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    return fs.createReadStream(file).pipe(res);
  }
  if (req.method === 'GET' && url.pathname === '/api/promo/status') {
    return json(res, 200, {
      code: PROMO_CODE,
      discountPercent: PROMO_PERCENT,
      expiresAt: Number.isFinite(PROMO_EXPIRY.getTime()) ? PROMO_EXPIRY.toISOString() : null,
      expiresAtLabel: expiryLabel(),
      active: Number.isFinite(PROMO_EXPIRY.getTime()) && Date.now() <= PROMO_EXPIRY.getTime()
    });
  }
  if (req.method === 'POST' && (url.pathname === '/api/promo/validate' || url.pathname === '/api/orders/create')) {
    let body;
    try { body = await readBody(req); }
    catch (e) { return json(res, 400, { valid: false, ok: false, message: e.message }); }

    if (url.pathname === '/api/promo/validate') {
      const rank = cleanText(body.rank, 20).toUpperCase();
      const price = getPrice(rank, body.code);
      if (price.error) return json(res, 400, { valid: false, message: price.error });
      return json(res, 200, {
        valid: true, code: price.promoCode, discountPercent: price.discountPercent,
        originalPrice: price.originalPrice, discountAmount: price.discountAmount,
        finalPrice: price.finalPrice, expiresAt: PROMO_EXPIRY.toISOString(), expiresAtLabel: expiryLabel()
      });
    }

    const rank = cleanText(body.rank, 20).toUpperCase();
    const edition = cleanText(body.edition, 20);
    const username = cleanText(body.username, 40);
    const promoCode = cleanText(body.promoCode, 32).toUpperCase();
    if (!rankPrice(rank)) return json(res, 400, { ok: false, message: 'Rank tidak dikenal.' });
    if (!['Java', 'Bedrock'].includes(edition)) return json(res, 400, { ok: false, message: 'Platform tidak valid.' });
    if (!username || /[\r\n]/.test(username)) return json(res, 400, { ok: false, message: 'Nama player wajib diisi dengan benar.' });
    const price = getPrice(rank, promoCode);
    if (price.error) return json(res, 400, { ok: false, message: price.error });

    const money = n => 'Rp' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n);
    const lines = [
      'Halo, saya ingin membeli rank SUNNYSMP.', '',
      `Rank: ${rank}`, `Harga normal: ${money(price.originalPrice)}`,
      ...(price.promoCode ? [`Kode promo: ${price.promoCode}`, `Diskon: ${price.discountPercent}% (-${money(price.discountAmount)})`] : []),
      `Total setelah diskon: ${money(price.finalPrice)}`,
      `Platform: ${edition}`, `Nama player: ${username}`,
      ...(price.promoCode ? [`Promo berlaku sampai: ${expiryLabel()}`] : []), '',
      'Mohon konfirmasi pesanan dan metode pembayaran. '
    ];
    const message = lines.join('\n');
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    return json(res, 200, {
      ok: true, order: { rank, edition, username, originalPrice: price.originalPrice, discountPercent: price.discountPercent, discountAmount: price.discountAmount, finalPrice: price.finalPrice, promoCode: price.promoCode || null },
      whatsappUrl
    });
  }
  if (url.pathname.startsWith('/api/')) return json(res, 404, { message: 'API endpoint tidak ditemukan.' });
  return json(res, 404, { message: 'Halaman tidak ditemukan.' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`SunnyStore promo backend berjalan di port ${PORT}`);
  console.log(`Kode promo: ${PROMO_CODE} (${PROMO_PERCENT}%) sampai ${expiryLabel()}`);
});
