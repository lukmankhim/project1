<?php
// Salin file ini menjadi config.php lalu isi nilainya. config.php tidak ikut di-commit.
return [
    'db' => [
        'dsn'  => 'mysql:host=localhost;dbname=ingat_siram;charset=utf8mb4',
        'user' => 'db_user',
        'pass' => 'db_password',
    ],

    'meta' => [
        'pixel_id'        => '',  // sama dengan pixelId di assets/config.js
        'access_token'    => '',  // Events Manager > Settings > Conversions API > Generate access token
        'test_event_code' => '',  // isi saat uji coba (tab Test Events), kosongkan saat live
        'graph_version'   => 'v21.0',
    ],

    // Kunci VAPID untuk Web Push. Buat sekali dengan: php cron/generate-vapid.php
    // Jangan diganti setelah live: semua langganan push lama akan berhenti bekerja.
    'push' => [
        'public_key'  => '',
        'private_key' => '',
        'subject'     => 'mailto:admin@example.com',
    ],
];
