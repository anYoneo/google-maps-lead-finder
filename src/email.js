/**
 * email.js — isi kolom email dengan merayap situs web bisnis.
 *
 * Kenapa: Google Maps sering tidak memberi email, sementara pembeli data lead
 * menghargainya paling tinggi. Kita sudah punya `situs` (~95% baris), jadi email
 * bisa diambil dari sana tanpa sumber tambahan.
 *
 * Strategi (diukur, bukan tebakan — dari uji 18 situs bisnis lokal Indonesia):
 *   - situs milik sendiri memberi email paling sering
 *   - halaman kontak (/contact, /kontak, /contact-us, /hubungi-kami) diambil bila
 *     halaman utama tidak memberi hasil
 *   - tautan `a[href^="mailto:"]` lebih andal daripada regex teks
 *   - jalankan PARALEL (4 sekaligus) agar tidak menembus batas 5 menit auto-test
 *
 * Modul ini tidak menyentuh Apify SDK supaya bisa dipakai CLI maupun Actor.
 */

'use strict';

const { chromium } = require('playwright');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const RE_EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const RE_MAILTO = /mailto:([^"'?>\s]+)/gi;

/** Alamat yang jelas bukan milik bisnis (penyedia situs, pelacak, berkas). */
const TOLAK = /(sentry|wixpress|example\.com|\.png|\.jpg|\.jpeg|\.gif|\.webp|\.svg|godaddy|squarespace|shopify|cloudflare|schema\.org|no-?reply|unsubscribe|@2x|wix\.com|domain\.com|email\.com|yourdomain)/i;

/** Situs yang tidak akan memberi email; jangan dibuang waktunya. */
const LEWATI = /(instagram\.com|facebook\.com|fb\.com|tiktok\.com|twitter\.com|x\.com|beacons\.ai|linktr\.ee|wa\.me|whatsapp\.com|youtube\.com|t\.me|threads\.net|maps\.app\.goo\.gl)/i;

/** Halaman kontak yang layak dicoba setelah halaman utama. */
const JALUR_KONTAK = ['/contact', '/kontak', '/contact-us', '/hubungi-kami', '/about-us'];

/** Kumpulkan email dari HTML mentah + daftar tautan mailto. */
function ambilEmail(html, mailtos) {
  const hasil = new Set();
  const tambah = (e) => {
    const b = String(e || '').trim().replace(/^\/+/, '').toLowerCase();
    if (!b || b.includes('..') || b.length > 100) return;
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(b)) return;
    if (TOLAK.test(b)) return;
    hasil.add(b);
  };
  for (const m of String(html).matchAll(RE_MAILTO)) {
    let e;
    try { e = decodeURIComponent(m[1]); } catch { e = m[1]; }
    tambah(e.split('?')[0]);
  }
  for (const e of (mailtos || [])) tambah(e.split('?')[0]);
  for (const m of String(html).matchAll(RE_EMAIL)) tambah(m[0]);
  return [...hasil];
}

/** Pilih email paling masuk akal sebagai utama. */
function pilihUtama(daftar) {
  if (!daftar.length) return null;
  const bobot = (e) => {
    let s = 0;
    if (/^(info|contact|cs|hello|sales|admin|office|marketing|support|halo|kontak)@/.test(e)) s += 5;
    if (/^(customercare|care|customer)@/.test(e)) s += 4;
    if (/(gmail|yahoo|hotmail|outlook)\./.test(e)) s += 1; // tetap sah, sedikit di bawah domain sendiri
    return s;
  };
  return [...daftar].sort((a, b) => bobot(b) - bobot(a) || a.length - b.length)[0];
}

/**
 * Rayap satu situs untuk cari email.
 * @returns {Promise<{email:string|null, semua:string[], sumber:string|null}>}
 */
async function emailDariSitus(ctx, situs, timeoutMs) {
  const hasil = new Set();
  let sumber = null;
  let page;
  try {
    page = await ctx.newPage();
    await page.route('**/*', (r) => {
      const t = r.request().resourceType();
      if (['image', 'media', 'font', 'stylesheet'].includes(t)) return r.abort();
      return r.continue();
    });

    for (const jalur of ['', ...JALUR_KONTAK]) {
      if (hasil.size) break;
      let target = situs;
      if (jalur) {
        let u;
        try { u = new URL(situs); } catch { break; }
        u.pathname = jalur;
        u.search = '';
        u.hash = '';
        target = u.href;
      }
      try {
        const res = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
        if (!res || res.status() >= 400) continue;
        await page.waitForTimeout(900);
        const mailtos = await page.evaluate(() =>
          [...document.querySelectorAll('a[href^="mailto:"]')].map(a => a.getAttribute('href') || '').slice(0, 8)
        ).catch(() => []);
        const html = await page.content().catch(() => '');
        for (const e of ambilEmail(html, mailtos)) {
          hasil.add(e);
          if (!sumber) sumber = target;
        }
      } catch { /* halaman berikutnya */ }
    }
  } catch {
    /* biarkan kosong */
  } finally {
    if (page) await page.close().catch(() => {});
  }
  const semua = [...hasil];
  return { email: pilihUtama(semua), semua, sumber };
}

/**
 * Jalankan promise dengan tenggat keras. page.goto timeout saja TIDAK cukup:
 * situs yang terus mengalihkan/redirect loop bisa menggantung tanpa batas.
 */
function denganTenggat(p, ms, tandaiNama) {
  let t;
  const tenggat = new Promise((selesai) => {
    t = setTimeout(() => selesai({ __tenggat: true, tandaiNama }), ms);
  });
  return Promise.race([p, tenggat]).finally(() => clearTimeout(t));
}

/** Kerjakan tugas dengan batas paralel. */
async function paralel(daftar, batas, tugas) {
  let i = 0;
  const pekerja = Array.from({ length: Math.min(batas, daftar.length) }, async () => {
    while (i < daftar.length) {
      const idx = i++;
      await tugas(daftar[idx], idx);
    }
  });
  await Promise.all(pekerja);
}

/**
 * Isi kolom email untuk sekumpulan baris tempat (memodifikasi di tempat).
 *
 * @param {object[]} baris
 * @param {object}   opsi
 * @param {boolean}  opsi.aktif          jalankan perayapan?
 * @param {number}   opsi.maxSitus       batas jumlah situs yang dikunjungi
 * @param {number}   opsi.paralel        berapa situs sekaligus
 * @param {number}   opsi.timeoutMs      timeout per halaman
 * @param {function} opsi.log
 */
async function isiEmail(baris, opsi = {}) {
  const aktif = opsi.aktif !== false;
  const maxSitus = opsi.maxSitus || 60;
  const batasParalel = opsi.paralel || 4;
  const timeoutMs = opsi.timeoutMs || 9000;
  const log = opsi.log || (() => {});

  if (!aktif) {
    log('email: dilewati (fetchEmails=false)');
    return { dikunjungi: 0, dapat: 0 };
  }

  // hanya baris bersitus, dan bukan sosmed/bio-link
  const calon = baris.filter((b) => b.situs && !LEWATI.test(b.situs)).slice(0, maxSitus);
  for (const b of baris) {
    if (b.email === undefined) b.email = null;
    if (b.email_semua === undefined) b.email_semua = null;
    if (b.email_sumber === undefined) b.email_sumber = null;
  }
  if (!calon.length) {
    log('email: tidak ada situs yang bisa dirayap');
    return { dikunjungi: 0, dapat: 0 };
  }

  const paksaExe = process.env.BROWSER_EXECUTABLE_PATH || null;
  const dasarArgs = ['--no-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled'];
  const caraPeluncuran = [
    { args: dasarArgs },
    { args: dasarArgs, channel: 'chromium' },
    { args: dasarArgs, channel: 'chrome' },
  ];
  for (const [i, cara] of caraPeluncuran.entries()) {
    let browser;
    try {
      const o = { headless: true, args: cara.args };
      if (cara.channel) o.channel = cara.channel;
      if (paksaExe) { o.executablePath = paksaExe; delete o.channel; }
      browser = await chromium.launch(o);
    } catch (e) {
      log(`email: peluncuran ${i + 1} gagal (${String(e.message).slice(0, 60)})`);
      continue;
    }
    try {
      const ctx = await browser.newContext({
        locale: 'id-ID', timezoneId: 'Asia/Jakarta',
        viewport: { width: 1366, height: 900 }, userAgent: UA,
      });
      let dapat = 0;
      let selesai = 0;
      const tenggatSitus = opsi.tenggatSitusMs || 25000;
      await paralel(calon, batasParalel, async (b) => {
        const r = await denganTenggat(emailDariSitus(ctx, b.situs, timeoutMs), tenggatSitus, b.situs);
        if (r && r.__tenggat) {
          log(`email: tenggat ${tenggatSitus / 1000}s dilewati (${String(b.situs).slice(0, 40)})`);
        } else if (r && r.email) {
          b.email = r.email;
          b.email_semua = r.semua;
          b.email_sumber = r.sumber;
          dapat++;
        }
        selesai++;
        if (selesai % 10 === 0) log(`email: ${selesai}/${calon.length} situs, ${dapat} ada email`);
      });
      await browser.close().catch(() => {});
      log(`email: ${dapat}/${calon.length} situs memberi email`);
      return { dikunjungi: calon.length, dapat };
    } catch (e) {
      log(`email: gagal (${String(e.message).slice(0, 80)})`);
      await browser.close().catch(() => {});
    }
  }
  return { dikunjungi: 0, dapat: 0 };
}

module.exports = { isiEmail, emailDariSitus, ambilEmail, pilihUtama, LEWATI };
