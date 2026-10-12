/**
 * extract.js — pengambil data tempat dari Google Maps.
 *
 * Cara kerja: buka halaman pencarian Maps dengan Chromium sungguhan, SADAP
 * endpoint JSON internal yang dipakai halaman itu sendiri
 * (`/search?tbm=map&...&pb=...`), lalu petakan struktur bersarangnya ke kolom bersih.
 *
 * Struktur payload (diverifikasi dari dump nyata 2026-10, query "toko sepatu jakarta"):
 *   root[64][0..1]           -> baris RINGKAS (12 baris/permintaan), tiap baris:
 *       [2]  nama
 *       [9]  cid            "0x2e69f57c7faad2bb:0x843f42a21a00d6e4"
 *       [12] kategori
 *   root[64][2..21][1]       -> blok DETAIL (20 blok/permintaan), tiap blok:
 *       [2]  alamat (potongan: nama jalan, nomor, RT/RW, kelurahan, kota, provinsi, kode pos)
 *       [4][7]  rating       (mis. 5)
 *       [4][8]  jumlah ulasan (mis. 2231)
 *       [7][0]  situs web
 *       [9][2]  lintang   |  [9][3] bujur
 *       [10] cid
 *       [11] nama
 *       [39] alamat lengkap (satu baris)
 *       [78] place_id
 *       [157] foto profil
 *       [178][0][0] telepon
 *
 * Paginasi: sisipkan `!7i<offset>!8i<offset>` ke parameter `pb` pada URL endpoint.
 * offset 0/20/40/60 -> 22/42/61/71 tempat unik (offset berjalan 20 per halaman).
 *
 * Modul ini tidak menyentuh Apify SDK supaya bisa dipakai CLI maupun Actor.
 */

'use strict';

const { chromium } = require('playwright');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** Ambil nilai pada jalur bersarang, aman terhadap null. */
function pada(o, ...jalur) {
  let x = o;
  for (const k of jalur) {
    if (x == null) return null;
    x = x[k];
  }
  return x == null ? null : x;
}

/** Bersihkan teks: rapikan spasi, buang kosong. */
function teks(v) {
  if (v == null) return null;
  const s = String(v).replace(/\s+/g, ' ').trim();
  return s || null;
}

/** Nomor telepon -> format +62. */
function rapikanTelepon(v) {
  const s = teks(v);
  if (!s) return null;
  const digit = s.replace(/[^\d+]/g, '');
  if (digit.startsWith('+62')) return digit;
  if (digit.startsWith('62')) return '+' + digit;
  if (digit.startsWith('0')) return '+62' + digit.slice(1);
  return s;
}

/**
 * Susun alamat lengkap dari potongan-potongan. Google memberi keduanya:
 * potongan (d[2]) dan satu baris (d[39]). Pakai yang paling lengkap.
 */
function susunAlamat(blok) {
  const satu = teks(pada(blok, 39));
  const bagian = pada(blok, 2);
  let gabung = null;
  if (Array.isArray(bagian)) {
    const bersih = bagian.map(teks).filter(Boolean);
    if (bersih.length) gabung = bersih.join(', ');
  }
  if (satu && gabung) return satu.length >= gabung.length ? satu : gabung;
  return satu || gabung || null;
}

/** Ambil kota/kode pos dari potongan alamat. */
function ambilKota(blok) {
  const bagian = pada(blok, 2);
  if (Array.isArray(bagian)) {
    for (let i = bagian.length - 1; i >= 0; i--) {
      const t = teks(bagian[i]);
      if (!t) continue;
      if (/^(Kota|Kabupaten|Kab\.|Jakarta|Bandung|Surabaya|Semarang|Medan|Makassar|Denpasar|Yogyakarta)/i.test(t)) {
        return t;
      }
    }
  }
  const satu = teks(pada(blok, 39));
  if (satu) {
    const m = satu.match(/(Kota|Kabupaten|Kab\.)\s+[^,]+/i);
    if (m) return m[0];
  }
  return null;
}

/** Kode pos dari alamat. */
function ambilKodepos(blok) {
  const sumber = [teks(pada(blok, 39)), teks(pada(blok, 166))].filter(Boolean).join(' ');
  const m = sumber.match(/\b(\d{5})\b/);
  return m ? m[1] : null;
}

/** Satu blok detail -> baris ternormalisasi. */
function mapTempat(blok) {
  if (!Array.isArray(blok)) return null;
  const nama = teks(pada(blok, 11));
  if (!nama) return null;
  const cid = teks(pada(blok, 10));
  const placeId = teks(pada(blok, 78));
  const ratingMentah = pada(blok, 4, 7);
  const ulasanMentah = pada(blok, 4, 8);
  const lat = pada(blok, 9, 2);
  const lng = pada(blok, 9, 3);

  return {
    nama,
    place_id: placeId,
    cid: cid,
    kategori: teks(pada(blok, 13)) || null,
    alamat: susunAlamat(blok),
    kota: ambilKota(blok),
    kode_pos: ambilKodepos(blok),
    rating: (typeof ratingMentah === 'number') ? ratingMentah : null,
    jumlah_ulasan: (typeof ulasanMentah === 'number') ? ulasanMentah : null,
    telepon: rapikanTelepon(pada(blok, 178, 0, 0)),
    situs: teks(pada(blok, 7, 0)),
    lintang: (typeof lat === 'number') ? lat : null,
    bujur: (typeof lng === 'number') ? lng : null,
    url: placeId
      ? `https://www.google.com/maps/place/?q=place_id:${placeId}`
      : (cid ? `https://maps.google.com/?cid=${cid.split(':')[1]}` : null),
    gambar: teks(pada(blok, 157)),
    // Kolom email diisi belakangan oleh src/email.js (opsional) — tetap null bila tidak dijalankan.
    email: null,
    email_semua: null,
    email_sumber: null,
    diambil_pada: new Date().toISOString(),
  };
}

/** Petakan seluruh payload -> baris ternormalisasi (dedupe per place_id/nama). */
function mapPayload(root) {
  const keluar = [];
  const terlihat = new Set();
  const b64 = Array.isArray(root && root[64]) ? root[64] : [];
  for (const bagian of b64) {
    if (!Array.isArray(bagian)) continue;
    // blok detail: bagian[1] adalah array panjang (mis. 260)
    const detail = bagian[1];
    if (!Array.isArray(detail)) continue;
    const r = mapTempat(detail);
    if (!r) continue;
    const kunci = r.place_id || r.cid || r.nama;
    if (terlihat.has(kunci)) continue;
    terlihat.add(kunci);
    keluar.push(r);
  }
  return keluar;
}

/** Sisipkan offset paginasi ke parameter pb. */
function denganOffset(url, offset) {
  if (/!7i\d+!8i\d+/.test(url)) return url.replace(/!7i\d+!8i\d+/, `!7i${offset}!8i${offset}`);
  if (/!7i\d+/.test(url)) return url.replace(/!7i\d+/, `!7i${offset}`);
  return url.replace(/(pb=[^&]*)/, `$1!7i${offset}!8i${offset}`);
}

/**
 * Cara peluncuran Chromium — sama filosofinya dengan produk Tokopedia:
 * mode yang berhasil bisa berbeda antar-lingkungan (lokal vs image Apify).
 */
const dasarArgs = ['--no-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled'];
const caraPeluncuran = [
  { args: dasarArgs },
  { args: dasarArgs, channel: 'chromium' },
  { args: dasarArgs, channel: 'chrome' },
  { args: dasarArgs.concat(['--disable-http2']) },
  { args: dasarArgs.concat(['--disable-http2']), channel: 'chromium' },
  { args: dasarArgs.concat(['--disable-http2']), channel: 'chrome' },
];

/**
 * Ambil data tempat.
 * @param {object} opsi
 * @param {string[]} opsi.queries     kata kunci pencarian ("toko sepatu jakarta")
 * @param {number}   opsi.maxItems    batas total baris
 * @param {number}   opsi.maxPages    berapa halaman offset per kata kunci
 * @param {number}   opsi.timeoutMs
 * @param {function} opsi.log
 */
async function scrapeMaps(opsi) {
  const queries = (opsi.queries || []).filter(Boolean);
  const maxItems = opsi.maxItems || 100;
  const maxPages = opsi.maxPages != null ? opsi.maxPages : 3;
  const timeoutMs = opsi.timeoutMs || 60000;
  const log = opsi.log || (() => {});
  const baris = [];
  const terlihat = new Set();
  const paksaExe = process.env.BROWSER_EXECUTABLE_PATH || null;

  const tambah = (rows) => {
    for (const r of rows) {
      const kunci = r.place_id || r.cid || r.nama;
      if (terlihat.has(kunci)) continue;
      terlihat.add(kunci);
      baris.push(r);
    }
  };

  for (let idx = 0; idx < caraPeluncuran.length; idx++) {
    const cara = caraPeluncuran[idx];
    let browser;
    try {
      const o = { headless: true, args: cara.args };
      if (cara.channel) o.channel = cara.channel;
      if (paksaExe) o.executablePath = paksaExe;
      if (o.channel && paksaExe) delete o.channel;
      browser = await chromium.launch(o);
    } catch (e) {
      log(`peluncuran ${idx + 1} gagal: ${String(e.message).slice(0, 100)}`);
      continue;
    }

    try {
      const ctx = await browser.newContext({
        locale: 'id-ID', timezoneId: 'Asia/Jakarta',
        viewport: { width: 1366, height: 900 }, userAgent: UA,
      });
      const page = await ctx.newPage();
      let endpoint = null;
      page.on('response', (res) => {
        const u = res.url();
        if (u.includes('tbm=map')) endpoint = u;
      });

      for (const q of queries) {
        if (baris.length >= maxItems) break;
        const url = 'https://www.google.com/maps/search/' + encodeURIComponent(q) + '?hl=id';
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
        } catch (e) {
          log(`"${q}": gagal buka (${String(e.message).slice(0, 70)})`);
          continue;
        }
        await page.waitForTimeout(9000);
        if (!endpoint) {
          log(`"${q}": endpoint peta tidak tertangkap`);
          continue;
        }

        // Ambil halaman berturut-turut lewat offset, semuanya dari konteks halaman
        // (cookie + header asli ikut terkirim).
        for (let h = 0; h < maxPages; h++) {
          if (baris.length >= maxItems) break;
          const offset = h * 20;
          const sebelum = baris.length;
          try {
            const hasil = await page.evaluate(async ({ u, off }) => {
              const target = (() => {
                if (/!7i\d+!8i\d+/.test(u)) return u.replace(/!7i\d+!8i\d+/, `!7i${off}!8i${off}`);
                if (/!7i\d+/.test(u)) return u.replace(/!7i\d+/, `!7i${off}`);
                return u.replace(/(pb=[^&]*)/, `$1!7i${off}!8i${off}`);
              })();
              const r = await fetch(target, { credentials: 'include' });
              const t = await r.text();
              return { status: r.status, teks: t };
            }, { u: endpoint, off: offset });

            if (hasil.status !== 200 || !hasil.teks) {
              log(`"${q}" hal.${h + 1}: HTTP ${hasil.status}`);
              continue;
            }
            let root;
            try {
              root = JSON.parse(hasil.teks.replace(/^\)\]\}'\s*/, '').trim());
            } catch (_) {
              log(`"${q}" hal.${h + 1}: bukan JSON`);
              continue;
            }
            tambah(mapPayload(root));
          } catch (e) {
            log(`"${q}" hal.${h + 1} gagal: ${String(e.message).slice(0, 80)}`);
          }
          const dapat = baris.length - sebelum;
          log(`"${q}" hal.${h + 1} (offset ${offset}): +${dapat}`);
          if (dapat === 0 && h > 0) break; // tidak ada tambahan -> berhenti
        }
      }
    } catch (e) {
      log(`cara ${idx + 1} error: ${String(e.message).slice(0, 120)}`);
    } finally {
      await browser.close().catch(() => {});
    }

    if (baris.length) break;
  }

  return baris.slice(0, maxItems);
}

/** Baris -> CSV */
function keCSV(rows) {
  const kolom = ['nama', 'kategori', 'alamat', 'kota', 'kode_pos', 'rating', 'jumlah_ulasan',
    'telepon', 'email', 'situs', 'lintang', 'bujur', 'place_id', 'cid', 'url', 'gambar', 'diambil_pada'];
  const esc = (v) => {
    if (v == null) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  return [kolom.join(',')].concat(rows.map((r) => kolom.map((k) => esc(r[k])).join(','))).join('\n');
}

module.exports = { scrapeMaps, keCSV, mapPayload, mapTempat, denganOffset, rapikanTelepon };
