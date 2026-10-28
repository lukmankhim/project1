<?php
declare(strict_types=1);

// Kirim Web Push untuk tanaman yang sudah jatuh tempo.
// Jadwalkan tiap 15 menit, contoh crontab:
//   */15 * * * * php /var/www/ingat-siram/cron/send-reminders.php >> /var/log/ingat-siram-cron.log 2>&1

if (PHP_SAPI !== 'cli') {
    exit;
}

$root = dirname(__DIR__);
require $root . '/vendor/autoload.php';
require $root . '/api/bootstrap.php';

use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;

$push = $CONFIG['push'] ?? [];
if (empty($push['public_key']) || empty($push['private_key'])) {
    fwrite(STDERR, "Kunci VAPID belum diisi di api/config.php\n");
    exit(1);
}

$webPush = new WebPush([
    'VAPID' => [
        'subject' => $push['subject'] ?? 'mailto:admin@example.com',
        'publicKey' => $push['public_key'],
        'privateKey' => $push['private_key'],
    ],
], ['TTL' => 6 * 3600, 'urgency' => 'high']);

$pdo = db();
$nowMs = (int) (microtime(true) * 1000);

$stmt = $pdo->prepare(
    'SELECT ps.subscription_id, ps.id_tanaman, ps.nama_tanaman, ps.timestamp_terakhir_siram, ps.tips,
            s.endpoint, s.p256dh, s.auth
       FROM plant_schedules ps
       JOIN push_subscriptions s ON s.id = ps.subscription_id
      WHERE ps.due_ms <= ?
        AND (ps.notified_for IS NULL OR ps.notified_for <> ps.timestamp_terakhir_siram)
      LIMIT 2000'
);
$stmt->execute([$nowMs]);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

$markSent = $pdo->prepare(
    'UPDATE plant_schedules SET notified_for = timestamp_terakhir_siram
      WHERE subscription_id = ? AND id_tanaman = ? AND timestamp_terakhir_siram = ?'
);
$dropSub = $pdo->prepare('DELETE FROM push_subscriptions WHERE id = ?');

$sent = 0;
$failed = 0;
$dropped = [];

foreach ($rows as $r) {
    $subId = (int) $r['subscription_id'];
    if (isset($dropped[$subId])) {
        continue;
    }

    $body = 'Waktunya menyiram ' . $r['nama_tanaman'] . ' 💧';
    if (!empty($r['tips'])) {
        $body .= "\nTips: " . $r['tips'];
    }
    $payload = json_encode([
        'title' => 'Ingat Siram 🌱',
        'body' => $body,
        'id' => $r['id_tanaman'],
        'ts' => (int) $r['timestamp_terakhir_siram'],
    ]);

    $report = $webPush->sendOneNotification(
        Subscription::create([
            'endpoint' => $r['endpoint'],
            'keys' => ['p256dh' => $r['p256dh'], 'auth' => $r['auth']],
        ]),
        $payload
    );

    if ($report->isSuccess()) {
        $markSent->execute([$subId, $r['id_tanaman'], $r['timestamp_terakhir_siram']]);
        $sent++;
    } elseif ($report->isSubscriptionExpired()) {
        // Pengguna mencabut izin atau menghapus aplikasi.
        $dropSub->execute([$subId]);
        $dropped[$subId] = true;
    } else {
        $failed++;
        error_log('Push gagal: ' . $report->getReason());
    }
}

printf("[%s] jatuh tempo=%d terkirim=%d gagal=%d langganan_dihapus=%d\n",
    date('c'), count($rows), $sent, $failed, count($dropped));
