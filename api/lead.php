<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$data = read_json_body();

// Honeypot terisi = bot. Balas sukses palsu supaya bot tidak mencoba lagi.
if (str_field($data, 'website', 200) !== '') {
    respond(200, ['ok' => true]);
}

$nama = str_field($data, 'nama', 100);
$kontakRaw = str_field($data, 'kontak', 191);
$campaign = str_field($data, 'source_campaign', 191);
$eventId = str_field($data, 'event_id', 100);
$pageUrl = str_field($data, 'page_url', 1000);

if (mb_strlen($nama) < 2) {
    respond(422, ['ok' => false, 'error' => 'Nama minimal 2 huruf.']);
}
$contact = normalize_contact($kontakRaw);
if ($contact === null) {
    respond(422, ['ok' => false, 'error' => 'Nomor WhatsApp atau email belum benar.']);
}

try {
    $stmt = db()->prepare(
        'INSERT INTO users (nama, whatsapp_email, source_campaign) VALUES (?, ?, ?)'
    );
    $stmt->execute([$nama, $contact['email'] ?? $contact['phone'], $campaign !== '' ? $campaign : null]);
} catch (PDOException $e) {
    error_log('Simpan lead gagal: ' . $e->getMessage());
    respond(500, ['ok' => false, 'error' => 'Gagal menyimpan, coba lagi sebentar.']);
}

// Balas pengguna dulu, kirim CAPI setelahnya agar halaman tidak menunggu Meta.
echo json_encode(['ok' => true]);
if (function_exists('fastcgi_finish_request')) {
    fastcgi_finish_request();
}

if ($eventId !== '') {
    capi_send('Lead', $eventId, capi_user_data($data, $contact, $nama), $pageUrl);
}
