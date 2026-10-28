# Ingat Siram 🌱

PWA pengingat siram tanaman untuk pemula, sekaligus penangkap prospek (lead) dan saluran konversi afiliasi.
Dibangun dengan HTML, CSS, dan Vanilla JS, ditambah backend PHP ringan.

## Struktur

```
index.html          Landing page + formulir lead (Nama + WA/Email)
app.html            Dasbor: kartu tanaman, tambah tanaman, prompt pasang PWA
sw.js               Service Worker: cache offline + cek jadwal + notifikasi lokal
manifest.json       Manifest PWA
assets/
  config.js         Pixel ID + daftar produk afiliasi  ← EDIT INI
  tracking.js       Meta Pixel (event_id sama dengan CAPI untuk deduplikasi)
  kv.js             IndexedDB kecil (salinan data tanaman untuk Service Worker)
  landing.js        Logika formulir lead
  app.js            Logika dasbor
  style.css
api/
  config.example.php  Salin ke config.php lalu isi DB + token CAPI  ← EDIT INI
  bootstrap.php       Helper: DB, validasi, hashing, kirim CAPI
  lead.php            Simpan prospek ke tabel users + kirim event "Lead"
  click.php           Kirim event "ClickAffiliate" ke CAPI
database/schema.sql   Tabel users
icons/                Ikon PWA
```

## Alur

1. Iklan → `index.html?utm_campaign=NAMA_KAMPANYE` → isi nama + WA/email.
2. `api/lead.php` menyimpan data ke MySQL (`source_campaign` diambil dari `utm_campaign`). Event **Lead** dikirim lewat Pixel (browser) dan CAPI (server) dengan `event_id` yang sama.
3. Pengguna diarahkan ke `app.html`. Di sana muncul ajakan "Pasang ke layar utama" (Android: tombol Pasang; iOS: petunjuk Bagikan → Tambahkan ke Layar Utama).
4. Pengguna menambah tanaman. Data disimpan di `localStorage` HP (`id_tanaman`, `nama_tanaman`, `interval_siram`, `timestamp_terakhir_siram`), tidak di server.
5. Saat jatuh tempo, Service Worker memunculkan notifikasi beserta tips produk. Klik notifikasi akan membuka kartu tanaman yang dimaksud.
6. Klik tombol produk di kartu memicu event **ClickAffiliate** (Pixel + CAPI) lalu membuka link afiliasi.

## Deploy (Tahap 4)

1. **Hosting** PHP 8.1+ dengan MySQL dan HTTPS. Shared hosting/cPanel bisa, HTTPS wajib untuk PWA. `.htaccess` sudah memaksa HTTPS.
2. Upload semua file ke `public_html` (atau subfolder).
3. Buat database, lalu import `database/schema.sql` lewat phpMyAdmin.
4. Salin `api/config.example.php` → `api/config.php`, lalu isi:
   - kredensial DB
   - `pixel_id` dan `access_token` (Events Manager → Settings → Conversions API → Generate access token)
   - `test_event_code` saat uji coba (tab *Test Events*), kosongkan saat live
5. Isi `pixelId` dan link afiliasi asli di `assets/config.js`.
6. Uji: buka `https://domainmu/index.html?utm_campaign=tes`, daftar, lalu pastikan event Lead muncul 2x (Browser + Server, *deduplicated*) di Test Events.
7. Setiap kali mengubah file JS/CSS, naikkan versi `CACHE` di `sw.js` (misal `ingat-siram-v2`) agar pengguna mendapat versi baru.

## Batasan notifikasi (penting)

Notifikasi dibuat 100% di sisi klien tanpa server push, sesuai TRD. Konsekuensinya:

- **Selalu jalan** saat aplikasi dibuka atau dibuka ulang: tanaman yang jatuh tempo langsung dinotifikasi.
- **Saat aplikasi tertutup**, notifikasi hanya bisa muncul lewat *Periodic Background Sync*, yang cuma tersedia di **Chrome/Android untuk PWA yang sudah dipasang**. Browser yang menentukan frekuensinya berdasarkan seberapa sering aplikasi dipakai, jadi bisa telat beberapa jam.
- **iPhone/Safari** tidak mendukung background sync. Notifikasi baru muncul saat aplikasi dibuka, dan izin notifikasi di iOS hanya bisa diminta setelah PWA dipasang ke layar utama.

Kalau nanti butuh notifikasi tepat waktu di semua perangkat, perlu Web Push (server + VAPID + cron). Itu bisa ditambahkan tanpa mengubah UI.

## Uji lokal

```bash
cp api/config.example.php api/config.php   # isi DB lokal
php -S 127.0.0.1:8080
# buka http://127.0.0.1:8080/index.html  (localhost dianggap aman, jadi SW & notifikasi jalan)
```
