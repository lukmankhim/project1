<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

// Jeda minimal antar siram yang dihitung untuk tanaman yang sama di perangkat yang sama,
// supaya tombol yang ditekan berulang tidak menggelembungkan penghitung.
const JEDA_JAM = 6;

$data = read_json_body();

$device = str_field($data, 'device', 64);
$idTanaman = str_field($data, 'id_tanaman', 40);
if (strlen($device) < 16 || $idTanaman === '') {
    respond(422, ['ok' => false]);
}
$deviceHash = sha($device);

$stmt = db()->prepare(
    'SELECT 1 FROM siram_events
     WHERE device_hash = ? AND id_tanaman = ? AND created_at > NOW() - INTERVAL ' . JEDA_JAM . ' HOUR
     LIMIT 1'
);
$stmt->execute([$deviceHash, $idTanaman]);
if (!$stmt->fetchColumn()) {
    db()->prepare('INSERT INTO siram_events (device_hash, id_tanaman) VALUES (?, ?)')
        ->execute([$deviceHash, $idTanaman]);
}

respond(200, ['ok' => true]);
