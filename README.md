# 🌱 Ingat Siram

**Aplikasi pengingat siram tanaman yang dipasang langsung dari browser, tanpa Play Store atau App Store.**
Sekaligus mesin *lead generation* dan konversi afiliasi buat traffic dari iklan Instagram/Facebook.

> Dibangun bareng **Claude Code**, dari dokumen PRD sampai siap deploy.

---

## Kenapa project ini menarik?

| | |
|---|---|
| ⚡ **Super ringan** | HTML + CSS + Vanilla JS. Tanpa framework, tanpa build step. Kebuka instan walau sinyal jelek. |
| 📲 **Bisa dipasang kayak aplikasi** | PWA: masuk layar utama Android & iPhone, jalan offline. |
| 🔔 **Notifikasi siram** | Muncul di HP saat waktunya siram, **termasuk iPhone** (Web Push, iOS 16.4+). |
| 🎯 **Lead dari iklan** | Form nama + WhatsApp/Email, lengkap dengan sumber kampanye (`utm_campaign`). |
| 📈 **Tracking Meta lengkap** | Meta Pixel + Conversions API (server) untuk event `Lead` dan `ClickAffiliate`, dengan deduplikasi. |
| 💰 **Afiliasi built-in** | Rekomendasi produk muncul di kartu tanaman dan di notifikasi. |
| 📅 **Cadangan kalender** | Satu ketukan menambah jadwal siram berulang ke kalender HP. |
| 🔒 **Hemat server** | Data tanaman disimpan di HP pengguna. Server cuma menyimpan kontak dan jadwal untuk push. |

## Alur pengguna

```
Iklan IG/FB ──▶ Landing page ──▶ Isi nama + WA ──▶ [Lead → Meta]
                                              │
                                              ▼
                              Halaman "Pasang Aplikasi"
                     (Android: 1 ketukan · iPhone: panduan Bagikan →
                      Tambahkan ke Layar Utama · Browser IG/FB: buka
                      di Chrome/Safari dulu, data tidak hilang)
                                              │
                                              ▼
                     Dasbor: tambah tanaman + interval siram
                                              │
                                              ▼
           Hari H: notifikasi 🔔 "Waktunya siram Monstera 💧 + tips produk"
                                              │
                                              ▼
                 Buka app → "Sudah Disiram" + banner afiliasi
                                    [ClickAffiliate → Meta]
```

## Coba di komputer sendiri (5 menit)

Butuh PHP 8.1+ dan [Composer](https://getcomposer.org).

```bash
git clone https://github.com/lukmankhim/project1.git ingat-siram
cd ingat-siram
composer install
cp api/config.example.php api/config.php     # isi koneksi database
php -S 127.0.0.1:8080
```

Buka `http://127.0.0.1:8080/index.html`.

## Struktur

```
index.html            Landing page + formulir lead
pasang.html           Langkah wajib: pasang PWA (deteksi Android / iPhone / browser IG-FB)
app.html              Dasbor kartu tanaman
sw.js                 Service Worker: cache offline, notifikasi lokal & Web Push
manifest.json         Manifest PWA
assets/
  config.js           ✏️ Pixel ID + daftar produk afiliasi
  app.js              Logika dasbor, sinkron push, tombol kalender
  landing.js          Formulir lead
  pasang.js           Deteksi perangkat & prompt pasang
  lead.js             Bawa data lead saat pindah browser (lewat hash URL)
  tracking.js         Meta Pixel
  kv.js               IndexedDB mini untuk Service Worker
api/
  config.example.php  ✏️ Salin ke config.php: DB, token CAPI, kunci VAPID
  lead.php            Simpan prospek + CAPI "Lead"
  click.php           CAPI "ClickAffiliate"
  push-key.php        Kunci publik VAPID
  push-sync.php       Terima jadwal siram dari HP untuk Web Push
  ics.php             File kalender berulang (.ics)
cron/
  send-reminders.php  Kirim Web Push untuk tanaman jatuh tempo (tiap 15 menit)
  generate-vapid.php  Buat kunci VAPID (sekali saja)
database/schema.sql   Tabel users, push_subscriptions, plant_schedules
```

## Deploy ke VPS

Panduan ini bisa dikerjakan manual, atau tinggal suruh Claude Code di VPS:
> *"Deploy repo ini ke VPS ini mengikuti bagian Deploy ke VPS di README. Domain saya: contoh.com"*

### 1. Paket server (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install -y nginx mysql-server php8.3-fpm php8.3-mysql php8.3-curl php8.3-mbstring php8.3-gmp composer certbot python3-certbot-nginx
```

`php-gmp` opsional, tapi membuat enkripsi push jauh lebih cepat.

### 2. Kode & dependency

```bash
sudo git clone https://github.com/lukmankhim/project1.git /var/www/ingat-siram
cd /var/www/ingat-siram
sudo composer install --no-dev --optimize-autoloader
```

### 3. Database

```bash
sudo mysql -e "CREATE DATABASE ingat_siram CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'ingat_siram'@'localhost' IDENTIFIED BY 'GANTI_PASSWORD_KUAT';
GRANT ALL ON ingat_siram.* TO 'ingat_siram'@'localhost'; FLUSH PRIVILEGES;"
sudo mysql ingat_siram < database/schema.sql
```

### 4. Konfigurasi

```bash
sudo cp api/config.example.php api/config.php
sudo php cron/generate-vapid.php        # tempel hasilnya ke bagian 'push' di config.php
sudo nano api/config.php                # isi DB, pixel_id, access_token, subject email
sudo nano assets/config.js              # isi pixelId + link afiliasi asli
sudo chown -R www-data:www-data /var/www/ingat-siram
sudo chmod 640 api/config.php
```

> ⚠️ Jangan ganti kunci VAPID setelah live. Semua langganan notifikasi lama akan mati.

### 5. Nginx

`/etc/nginx/sites-available/ingat-siram`:

```nginx
server {
    listen 80;
    server_name contoh.com;
    root /var/www/ingat-siram;
    index index.html;

    # Folder internal tidak boleh diakses publik
    location ~ ^/(vendor|cron|database)/ { deny all; }
    location ~ /\.(git|ht) { deny all; }
    location ~ ^/composer\.(json|lock)$ { deny all; }
    location ~ ^/api/(bootstrap|config|config\.example)\.php$ { deny all; }

    location ~ ^/api/[a-z-]+\.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
    }
    location ~ \.php$ { deny all; }

    # Service Worker & manifest harus selalu dicek ulang
    location = /sw.js         { add_header Cache-Control "no-cache"; }
    location = /manifest.json { add_header Cache-Control "no-cache"; default_type application/manifest+json; }

    location ~* \.(css|js|png)$ { expires 7d; }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/ingat-siram /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d contoh.com      # HTTPS wajib untuk PWA & notifikasi
```

### 6. Cron pengirim notifikasi

```bash
sudo crontab -u www-data -e
```

```
*/15 * * * * php /var/www/ingat-siram/cron/send-reminders.php >> /var/log/ingat-siram-cron.log 2>&1
```

Buat file log-nya dulu: `sudo touch /var/log/ingat-siram-cron.log && sudo chown www-data /var/log/ingat-siram-cron.log`.

### 7. Cek sebelum pasang iklan

- [ ] `https://contoh.com/index.html?utm_campaign=tes`: daftar, lalu data masuk ke tabel `users`
- [ ] Events Manager → Test Events: `Lead` muncul dari **Browser** dan **Server** (deduplicated). Isi `test_event_code` saat menguji, kosongkan lagi setelahnya.
- [ ] Pasang ke layar utama, izinkan notifikasi, lalu tabel `push_subscriptions` terisi
- [ ] Tambah tanaman interval 1 hari, ubah `due_ms` di `plant_schedules` jadi angka kecil, jalankan `php cron/send-reminders.php`, dan notifikasi masuk ke HP
- [ ] Klik banner produk: `ClickAffiliate` muncul di Test Events

Pakai link iklan dengan `utm_campaign`, misalnya `https://contoh.com/?utm_campaign=reels_monstera_01`, supaya setiap lead tercatat sumbernya.

### Update versi

```bash
cd /var/www/ingat-siram && sudo git pull && sudo composer install --no-dev
```

Kalau ada perubahan file JS/CSS/HTML, naikkan versi `CACHE` di `sw.js` (misalnya `ingat-siram-v3`) supaya HP pengguna mengambil versi baru.

## Cara kerja notifikasi

| Kondisi | Android (Chrome) | iPhone |
|---|---|---|
| Aplikasi dibuka | ✅ notifikasi lokal | ✅ notifikasi lokal* |
| Aplikasi tertutup | ✅ Web Push dari server (tepat waktu ±15 menit) | ✅ Web Push, **wajib dipasang ke layar utama** & iOS 16.4+ |
| Notifikasi ditolak | 📅 tombol Kalender | 📅 tombol Kalender |

\* Di iPhone, izin notifikasi hanya bisa diminta dari aplikasi yang sudah dipasang ke layar utama. Karena itu ada halaman **Pasang** setelah pendaftaran.

**Catatan iPhone:** aplikasi di layar utama iPhone punya penyimpanan terpisah dari Safari. Pengguna sebaiknya pasang dulu baru menambah tanaman, sesuai urutan di alur di atas.

## Kustomisasi cepat

- **Produk afiliasi:** edit `products` di `assets/config.js` (judul, deskripsi, link, teks tombol).
- **Warna:** `--green` di `assets/style.css` (default `#2E7D32`).
- **Teks landing:** `index.html`.
