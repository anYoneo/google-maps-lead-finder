# STATUS — Google Maps Lead Finder (Actor Apify)

Terakhir diperbarui: 2026-10-12

## Status: TERBIT + PUBLIK + MONETISASI AKTIF

| Item | Nilai |
|---|---|
| URL store | https://apify.com/anyoneo/google-maps-lead-finder |
| Actor ID | `elZURdbISlalQyAQc` |
| Build terbit | 1.0.2 |
| Publik | ya (`isPublic: true`, halaman HTTP 200) |
| Monetisasi | **AKTIF** — Pay per event |
| Harga | **$1,00 / 1.000 hasil** (event `result`) + Actor Start $0,00005 |
| Platform usage | **Included / Free** (ditanggung pemilik Actor) |
| Biaya compute kita | **≈$0,17 / 1.000 hasil** (estimasi konsol Apify) |
| Margin kotor | **≈$0,83 / 1.000 hasil** |
| Label harga live | `$1.00 / 1,000 results` (terverifikasi di HTML halaman publik) |
| Repo | https://github.com/anYoneo/google-maps-lead-finder |

## Bukti jalan (bukan klaim)

- **Uji parser:** 10/10 lulus (`node --test test/map.test.js`) terhadap payload Google Maps **nyata**
  yang disimpan di `test/fixtures/gmaps-payload.json`.
- **Uji lokal:** 40 tempat, kolom inti 100% (nama, place_id, alamat, kategori, koordinat);
  rating/ulasan/telepon 92,5%.
- **Uji cloud (run 1):** "klinik gigi bandung" → 20 item, **kelengkapan 100%** untuk nama, kategori,
  alamat, kode pos, rating, jumlah ulasan, telepon, koordinat, place_id; situs 95%. Durasi 14,1 s.
- **Uji auto-test (run 2, input kosong):** SUCCEEDED, dataset 60 item ("toko sepatu jakarta").
  Ini skenario yang dijalankan Apify tiap hari — gagal 3 hari berturut = Actor ditandai
  *under maintenance*, jadi `default: ["toko sepatu jakarta"]` di `queries` adalah syarat hidup.

## Pasar (diukur 2026-10-12 dari API store)

| Segmen | Pemain teratas | User aktif 30hr | Harga pasar |
|---|---|---|---|
| "google maps scraper" | `compass/crawler-google-places` | 40.400 | $4/1.000 tempat |
| Segmen lead (pemain kecil) | `inovaflow/google-maps-leads-scraper` | 17 | $2–3/1.000 kontak |
| **Tokopedia (produk sebelumnya)** | `shahidirfan` | **211 total** | $0,90/1.000 |

Segmen lead: 4–17 user/30hr untuk pemain kecil — **lebih longgar dari Tokopedia**, dan harganya
2–5× lebih tinggi. Pasar induk "google maps scraper" 217× Tokopedia.

## Langkah berikutnya

- Harga berlaku penuh **26 Oktober 2026** (perubahan PPE butuh 14 hari).
- Baseline hari-0: run hanya dari akun sendiri. Ukur lagi 2026-10-26 — kalau masih 0 run dari luar,
  masalahnya distribusi, bukan produk.
- Kategori store masih ditetapkan Apify (tidak bisa diset manual dari konsol).
