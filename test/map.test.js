#!/usr/bin/env node
/**
 * Uji parser terhadap payload Google Maps NYATA (bukan data buatan).
 * Dijalankan: node test/map.test.js
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { mapPayload, mapTempat, rapikanTelepon, denganOffset } = require('../src/extract');

const PAYLOAD = path.join(__dirname, 'fixtures', 'gmaps-payload.json');

function muat() {
  const mentah = fs.readFileSync(PAYLOAD, 'utf8');
  return JSON.parse(mentah.replace(/^\)\]\}'\s*/, '').trim());
}

test('payload nyata berhasil dipetakan', () => {
  const root = muat();
  const rows = mapPayload(root);
  assert.ok(rows.length > 0, 'harus ada baris');
  console.log('baris terpetakan:', rows.length);
});

test('setiap baris punya nama dan place_id', () => {
  const rows = mapPayload(muat());
  for (const r of rows) {
    assert.ok(r.nama && r.nama.length > 1, 'nama harus terisi: ' + JSON.stringify(r.nama));
    assert.ok(r.place_id || r.cid, 'place_id atau cid harus ada untuk ' + r.nama);
  }
});

test('nama tempat sesuai isi payload', () => {
  const rows = mapPayload(muat());
  const nama = rows.map((r) => r.nama);
  assert.ok(nama.includes('807GARAGE Jakarta Kemang | Sneakers Store'),
    'nama yang sudah diverifikasi harus muncul. Dapat: ' + nama.slice(0, 5).join(' | '));
});

test('rating dan jumlah ulasan terbaca sebagai angka', () => {
  const rows = mapPayload(muat());
  const ada = rows.filter((r) => typeof r.rating === 'number' && typeof r.jumlah_ulasan === 'number');
  assert.ok(ada.length > 0, 'harus ada baris dengan rating + ulasan');
  const c = ada.find((r) => r.rating > 4 && r.jumlah_ulasan > 100);
  assert.ok(c, 'harus ada tempat dengan rating >4 dan ulasan >100');
});

test('alamat, telepon, dan situs terbaca', () => {
  const rows = mapPayload(muat());
  const adaAlamat = rows.filter((r) => r.alamat && r.alamat.length > 10);
  const adaSitus = rows.filter((r) => r.situs);
  assert.ok(adaAlamat.length > 0, 'harus ada alamat');
  assert.ok(adaSitus.length > 0, 'harus ada situs');
});

test('telepon dinormalkan ke +62', () => {
  assert.equal(rapikanTelepon('0813-8121-1987'), '+6281381211987');
  assert.equal(rapikanTelepon('+62 813-8121-1987'), '+6281381211987');
  assert.equal(rapikanTelepon('6281381211987'), '+6281381211987');
  assert.equal(rapikanTelepon(null), null);
});

test('koordinat lintang/bujur ada di rentang Indonesia', () => {
  const rows = mapPayload(muat());
  const ada = rows.filter((r) => r.lintang != null && r.bujur != null);
  assert.ok(ada.length > 0, 'harus ada koordinat');
  for (const r of ada) {
    assert.ok(r.lintang > -11 && r.lintang < 6, 'lintang masuk akal: ' + r.lintang);
    assert.ok(r.bujur > 95 && r.bujur < 141, 'bujur masuk akal: ' + r.bujur);
  }
});

test('tidak ada duplikat place_id', () => {
  const rows = mapPayload(muat());
  const ids = rows.map((r) => r.place_id).filter(Boolean);
  assert.equal(new Set(ids).size, ids.length, 'place_id harus unik');
});

test('offset paginasi disisipkan dengan benar', () => {
  const u = 'https://www.google.com/search?tbm=map&pb=!4m2!1sfoo';
  const h = denganOffset(u, 40);
  assert.ok(h.includes('!7i40!8i40'), 'offset harus tersisip: ' + h);
  const sudah = 'https://x/y?pb=!4m2!7i20!8i20';
  assert.ok(denganOffset(sudah, 60).includes('!7i60!8i60'), 'offset harus diganti');
});

test('blok kosong tidak menghasilkan baris', () => {
  assert.equal(mapTempat(null), null);
  assert.equal(mapTempat([1, 2, 3]), null);
  assert.equal(mapPayload({}), 0);
});
