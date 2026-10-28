<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$key = $CONFIG['push']['public_key'] ?? '';
if ($key === '') {
    respond(503, ['ok' => false, 'error' => 'Push belum dikonfigurasi.']);
}
header('Cache-Control: public, max-age=86400');
respond(200, ['ok' => true, 'publicKey' => $key]);
