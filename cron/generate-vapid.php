<?php
declare(strict_types=1);

// Jalankan sekali: php cron/generate-vapid.php
// Salin hasilnya ke bagian 'push' di api/config.php.

if (PHP_SAPI !== 'cli') {
    exit;
}
require dirname(__DIR__) . '/vendor/autoload.php';

$keys = Minishlink\WebPush\VAPID::createVapidKeys();
echo "'public_key'  => '{$keys['publicKey']}',\n";
echo "'private_key' => '{$keys['privateKey']}',\n";
