# Google Maps Lead Finder — Bisnis Lokal, Kontak & Rating

Ambil data bisnis lokal dari **Google Maps**: nama, alamat, telepon, situs web, rating, jumlah ulasan, kategori, dan koordinat. Untuk **pencarian lead**, riset pasar, dan pemetaan kompetitor.

**Sudah teruji:** 40 tempat dari satu kata kunci (3 halaman), kolom inti terisi 100%. Uji otomatis 10/10 lulus memakai payload nyata.

## Hasil nyata (bukan contoh buatan)

Hasil apa adanya dari satu run:

```json
{
  "nama": "Toko Sepatu Putra Cahaya",
  "place_id": "ChIJ1UkakAjuaS4RFqpEIGbhDhI",
  "cid": "0x2e69ee08901a49d5:0x120ee1662044aa16",
  "kategori": "Toko Sepatu",
  "alamat": "Jl. Raya Cilandak KKO No.5 D 14, RT.14/RW.8, Ragunan, Ps. Minggu, Kota Jakarta Selatan, Daerah Khusus Ibukota Jakarta 12560",
  "kota": "Kota Jakarta Selatan, Daerah Khusus Ibukota Jakarta 12560",
  "kode_pos": "12560",
  "rating": 2.6,
  "jumlah_ulasan": 8,
  "telepon": "+6281291333440",
  "situs": null,
  "lintang": -6.3101723,
  "bujur": 106.8139824,
  "url": "https://www.google.com/maps/place/?q=place_id:ChIJ1UkakAjuaS4RFqpEIGbhDhI",
  "diambil_pada": "2026-10-12T09:08:40.778Z"
}
```

## Kolom

| Kolom | Isi | Tingkat terisi (40 tempat) |
|---|---|---|
| `nama` | Nama bisnis | 100% |
| `kategori` | Kategori usaha (mis. "Toko Sepatu") | 100% |
| `alamat` | Alamat lengkap satu baris | 100% |
| `kode_pos` | Kode pos | 100% |
| `lintang` / `bujur` | Koordinat | 100% |
| `place_id` / `cid` | ID Google — **stabil**, untuk mencocokkan data antar-waktu | 100% |
| `url` | Tautan ke halaman tempat | 100% |
| `rating` | Rating rata-rata | 92,5% |
| `jumlah_ulasan` | Jumlah ulasan | 92,5% |
| `telepon` | Telepon (format +62) | 92,5% |
| `situs` | Situs web | 72,5% |
| `kota` | Kota/kabupaten | 80% |

Kolom yang tidak ada di Google Maps bernilai `null` (tidak dikarang). Nomor telepon dinormalkan ke format `+62` agar langsung bisa dipakai untuk WhatsApp.

## Cara pakai

Isi **queries** dengan pencarian seperti Anda mengetik di Google Maps — sertakan **jenis usaha + lokasi**:

```json
{
  "queries": ["toko sepatu jakarta", "klinik gigi bandung"],
  "maxItems": 200,
  "maxPages": 5
}
```

`maxPages` mengatur kedalaman: tiap halaman menambah sekitar **20 tempat**. Pakai 1 untuk uji cepat, 5+ untuk daftar besar.

## Untuk apa

- **Pencarian lead B2B** — kumpulkan kontak bisnis lokal untuk penawaran, lengkap dengan telepon
- **Pemetaan kompetitor** — siapa saja yang berjualan di area tertentu, siapa yang paling banyak diulas
- **Riset pasar & lokasi** — sebaran usaha per kota, kepadatan per kategori
- **Pemantauan reputasi** — bandingkan rating dan jumlah ulasan antar waktu (pakai `place_id` sebagai kunci)
- **Verifikasi data** — cocokkan daftar pelanggan/toko dengan data Google Maps

## Catatan teknis

Pengambilan dilakukan dengan membuka halaman pencarian Google Maps lewat peramban sungguhan, lalu membaca respons JSON internal yang dipakai halaman itu sendiri (`/search?tbm=map`). Pendekatan ini jauh lebih tahan perubahan dibanding membaca markup HTML.

Halaman berikutnya diambil dengan menggeser parameter offset pada permintaan yang sama, sehingga puluhan hingga ratusan tempat bisa diambil dari satu kata kunci.

## Harga

Biaya dihitung **per hasil** — Anda hanya membayar baris yang benar-benar tersimpan di dataset. Lihat tab **Pricing** untuk tarif terkini.

## Dukungan

Ada kolom tambahan yang Anda butuhkan (mis. jam buka, foto, ulasan teks)? Kirim pesan lewat tab Issues — perbaikan diutamakan untuk pelanggan berbayar.
