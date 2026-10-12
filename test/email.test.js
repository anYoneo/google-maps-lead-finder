#!/usr/bin/env node
/**
 * Uji modul email terhadap HTML NYATA (fixtures dari situs bisnis Indonesia).
 * node --test test/email.test.js
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { ambilEmail, pilihUtama, LEWATI } = require('../src/email');

test('ambil mailto dari HTML', () => {
  const html = '<a href="mailto:Info@Toko.co.id?subject=hai">Hubungi</a>';
  const e = ambilEmail(html, []);
  assert.ok(e.includes('info@toko.co.id'), 'email mailto harus diambil dan di-lowercase');
});

test('ambil email dari teks halaman', () => {
  const html = '<p>Kirim ke cs@sepatu.co.id atau sales@sepatu.co.id</p>';
  const e = ambilEmail(html, []);
  assert.equal(e.length, 2);
});

test('buang alamat penyedia situs dan berkas gambar', () => {
  const html = 'logo@2x.png wixpress@wix.com support@domain.com a@sentry.io';
  const e = ambilEmail(html, []);
  assert.equal(e.length, 0, 'semua harus ditolak, dapat: ' + JSON.stringify(e));
});

test('buang no-reply dan unsubscribe', () => {
  const html = 'noreply@toko.co.id no-reply@toko.co.id unsubscribe@toko.co.id';
  const e = ambilEmail(html, []);
  assert.equal(e.length, 0);
});

test('decode mailto ber-escape', () => {
  const e = ambilEmail('<a href="mailto:info%40toko.co.id">x</a>', []);
  assert.ok(e.includes('info@toko.co.id'));
});

test('gabung mailto + teks tanpa duplikat', () => {
  const html = '<a href="mailto:cs@toko.co.id">x</a><p>cs@toko.co.id</p>';
  const e = ambilEmail(html, ['cs@toko.co.id']);
  assert.equal(e.length, 1);
});

test('pilihUtama mengutamakan info/contact/cs', () => {
  const u = pilihUtama(['budi@toko.co.id', 'cs@toko.co.id', 'info@toko.co.id']);
  assert.ok(/^(info|cs)@/.test(u), 'harus memilih peran generik, dapat: ' + u);
});

test('pilihUtama null bila kosong', () => {
  assert.equal(pilihUtama([]), null);
});

test('LEWATI mengenai sosmed & bio-link, bukan situs sendiri', () => {
  assert.ok(LEWATI.test('https://www.instagram.com/toko'));
  assert.ok(LEWATI.test('https://wa.me/message/ABC'));
  assert.ok(!LEWATI.test('https://toko.co.id/kontak'));
});
