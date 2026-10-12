#!/usr/bin/env node
/**
 * main.js — pintu masuk Apify Actor "Google Maps Lead Finder".
 *
 * Menjalankan extract.js lalu menulis hasil ke dataset Apify.
 * Bisa juga dipakai lokal tanpa Apify:
 *   node src/main.js --queries "toko sepatu jakarta" --out hasil.csv
 */
'use strict';

const fs = require('fs');
const { scrapeMaps, keCSV } = require('./extract');

function arg(nama, bawaan) {
  const i = process.argv.indexOf('--' + nama);
  if (i === -1) return bawaan;
  const v = process.argv[i + 1];
  return (v == null || v.startsWith('--')) ? true : v;
}

function daftar(nama) {
  const i = process.argv.indexOf('--' + nama);
  if (i === -1) return null;
  const keluar = [];
  for (let j = i + 1; j < process.argv.length && !process.argv[j].startsWith('--'); j++) keluar.push(process.argv[j]);
  return keluar.length ? keluar : null;
}

(async () => {
  const diApify = !!process.env.APIFY_IS_AT_HOME;
  let ActorRef = null;

  // WAJIB: Actor.init() sebelum getInput/pushData. Tanpa ini SDK tidak menulis
  // apa pun ke dataset walau log mencetak "tersimpan".
  if (diApify) {
    const mod = require('apify');
    ActorRef = mod.Actor;
    await ActorRef.init();
  }

  let queries = null, maxItems = 100, maxPages = 3;
  if (diApify) {
    const input = (await ActorRef.getInput()) || {};
    queries = Array.isArray(input.queries)
      ? input.queries
      : (input.query ? [input.query] : null);
    if (input.maxItems) maxItems = parseInt(input.maxItems, 10);
    if (input.maxPages != null) maxPages = parseInt(input.maxPages, 10);
  }

  if (!queries || !queries.length) {
    queries = daftar('queries') || (arg('query') && [arg('query')]) || ['toko sepatu jakarta'];
    if (!diApify) {
      maxItems = parseInt(arg('maxItems', arg('limit', maxItems)), 10);
      maxPages = parseInt(arg('maxPages', maxPages), 10);
    }
  }
  const out = arg('out', null);

  const rows = await scrapeMaps({
    queries,
    maxItems,
    maxPages,
    log: (m) => console.log('[info]', m),
  });

  console.log(JSON.stringify({ jumlah: rows.length, contoh: rows.slice(0, 2) }, null, 1));

  if (out) {
    if (String(out).endsWith('.csv')) fs.writeFileSync(out, keCSV(rows), 'utf8');
    else fs.writeFileSync(out, JSON.stringify({ kata_kunci: queries, jumlah: rows.length, tempat: rows }, null, 2), 'utf8');
    console.log('ditulis:', out);
  }

  if (diApify) {
    if (rows.length) {
      await ActorRef.pushData(rows);
      console.log('tersimpan ke dataset Apify:', rows.length);
    } else {
      console.warn('PERINGATAN: 0 tempat — lihat log di atas untuk halaman yang gagal.');
    }
    await ActorRef.setValue('OUTPUT', {
      kata_kunci: queries,
      jumlah: rows.length,
      diambil_pada: new Date().toISOString(),
    });
    await ActorRef.exit();
  }
})().catch(async (e) => {
  console.error('GAGAL:', String((e && e.stack) || e).slice(0, 2000));
  try {
    const { Actor } = require('apify');
    if (process.env.APIFY_IS_AT_HOME) await Actor.fail(String(e.message));
  } catch (_) {}
  process.exit(1);
});
