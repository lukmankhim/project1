<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$row = db()->query(
    'SELECT
       (SELECT COUNT(*) FROM siram_events) AS total_siram,
       (SELECT COUNT(*) FROM siram_events WHERE created_at >= CURDATE()) AS siram_hari_ini,
       (SELECT COUNT(*) FROM users) AS total_pengguna'
)->fetch(PDO::FETCH_ASSOC);

header('Cache-Control: public, max-age=10');
respond(200, [
    'ok' => true,
    'total_siram' => (int) $row['total_siram'],
    'siram_hari_ini' => (int) $row['siram_hari_ini'],
    'total_pengguna' => (int) $row['total_pengguna'],
]);
