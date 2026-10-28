<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

if (!is_file(__DIR__ . '/config.php')) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Server belum dikonfigurasi.']);
    exit;
}
$CONFIG = require __DIR__ . '/config.php';

function respond(int $status, array $body): never
{
    http_response_code($status);
    echo json_encode($body);
    exit;
}

function read_json_body(): array
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        respond(405, ['ok' => false, 'error' => 'Method not allowed']);
    }
    $raw = file_get_contents('php://input', false, null, 0, 16384);
    $data = json_decode($raw ?: '', true);
    if (!is_array($data)) {
        respond(400, ['ok' => false, 'error' => 'Data tidak valid.']);
    }
    return $data;
}

function str_field(array $data, string $key, int $max): string
{
    $v = $data[$key] ?? '';
    return is_string($v) ? mb_substr(trim($v), 0, $max) : '';
}

function db(): PDO
{
    global $CONFIG;
    static $pdo = null;
    if ($pdo === null) {
        $pdo = new PDO($CONFIG['db']['dsn'], $CONFIG['db']['user'], $CONFIG['db']['pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    }
    return $pdo;
}

/**
 * Normalisasi kontak: email jadi huruf kecil, nomor HP jadi format 62xxxxxxxx.
 * Mengembalikan ['email' => ...] atau ['phone' => ...], atau null jika tidak valid.
 */
function normalize_contact(string $kontak): ?array
{
    if (str_contains($kontak, '@')) {
        $email = strtolower($kontak);
        return filter_var($email, FILTER_VALIDATE_EMAIL) ? ['email' => $email] : null;
    }
    $digits = preg_replace('/\D+/', '', $kontak);
    if (str_starts_with($digits, '0')) {
        $digits = '62' . substr($digits, 1);
    } elseif (str_starts_with($digits, '8')) {
        $digits = '62' . $digits;
    }
    $len = strlen($digits);
    return ($len >= 10 && $len <= 15) ? ['phone' => $digits] : null;
}

function sha(string $v): string
{
    return hash('sha256', strtolower(trim($v)));
}

function client_ip(): string
{
    // Cloudflare/proxy terpercaya bisa menambahkan header ini; fallback ke REMOTE_ADDR.
    foreach (['HTTP_CF_CONNECTING_IP', 'REMOTE_ADDR'] as $h) {
        $ip = $_SERVER[$h] ?? '';
        if (filter_var($ip, FILTER_VALIDATE_IP)) {
            return $ip;
        }
    }
    return '';
}

/** Bangun user_data CAPI dari input klien. Semua PII di-hash SHA-256. */
function capi_user_data(array $data, ?array $contact, string $nama): array
{
    $ud = [
        'client_ip_address' => client_ip(),
        'client_user_agent' => mb_substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 512),
    ];
    if ($contact && isset($contact['email'])) {
        $ud['em'] = [sha($contact['email'])];
    }
    if ($contact && isset($contact['phone'])) {
        $ud['ph'] = [sha($contact['phone'])];
        $ud['country'] = [sha('id')];
    }
    if ($nama !== '') {
        $ud['fn'] = [sha(explode(' ', $nama)[0])];
    }
    if ($contact) {
        $ud['external_id'] = [sha($contact['email'] ?? $contact['phone'])];
    }

    $fbp = str_field($data, 'fbp', 200);
    $fbc = str_field($data, 'fbc', 500);
    $fbclid = str_field($data, 'fbclid', 500);
    if ($fbc === '' && $fbclid !== '') {
        $fbc = 'fb.1.' . (int) (microtime(true) * 1000) . '.' . $fbclid;
    }
    if ($fbp !== '') {
        $ud['fbp'] = $fbp;
    }
    if ($fbc !== '') {
        $ud['fbc'] = $fbc;
    }
    return $ud;
}

/** Kirim satu event ke Meta Conversions API. Gagal kirim tidak menggagalkan request. */
function capi_send(string $eventName, string $eventId, array $userData, string $sourceUrl, array $customData = []): void
{
    global $CONFIG;
    $meta = $CONFIG['meta'] ?? [];
    if (empty($meta['pixel_id']) || empty($meta['access_token'])) {
        return;
    }

    $event = [
        'event_name' => $eventName,
        'event_time' => time(),
        'event_id' => $eventId,
        'action_source' => 'website',
        'event_source_url' => $sourceUrl,
        'user_data' => $userData,
    ];
    if ($customData) {
        $event['custom_data'] = $customData;
    }
    $payload = ['data' => [$event]];
    if (!empty($meta['test_event_code'])) {
        $payload['test_event_code'] = $meta['test_event_code'];
    }

    $url = sprintf(
        'https://graph.facebook.com/%s/%s/events?access_token=%s',
        $meta['graph_version'] ?? 'v21.0',
        rawurlencode($meta['pixel_id']),
        rawurlencode($meta['access_token'])
    );

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 2,
        CURLOPT_TIMEOUT => 4,
    ]);
    $res = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);

    if ($res === false || $code >= 400) {
        error_log("CAPI {$eventName} gagal ({$code}): " . (is_string($res) ? $res : 'curl error'));
    }
}
