<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

const DAY_MS = 86400000;
const MAX_PLANTS = 100;

$data = read_json_body();

$sub = $data['subscription'] ?? null;
$endpoint = is_array($sub) && is_string($sub['endpoint'] ?? null) ? $sub['endpoint'] : '';
$p256dh = is_string($sub['keys']['p256dh'] ?? null) ? $sub['keys']['p256dh'] : '';
$auth = is_string($sub['keys']['auth'] ?? null) ? $sub['keys']['auth'] : '';

if (!str_starts_with($endpoint, 'https://') || strlen($endpoint) > 1000
    || $p256dh === '' || strlen($p256dh) > 255 || $auth === '' || strlen($auth) > 255) {
    respond(422, ['ok' => false, 'error' => 'Langganan push tidak valid.']);
}

$plants = [];
foreach (array_slice(is_array($data['plants'] ?? null) ? $data['plants'] : [], 0, MAX_PLANTS) as $p) {
    if (!is_array($p)) {
        continue;
    }
    $id = str_field($p, 'id_tanaman', 40);
    $nama = str_field($p, 'nama_tanaman', 60);
    $interval = (int) ($p['interval_siram'] ?? 0);
    $ts = (int) ($p['timestamp_terakhir_siram'] ?? 0);
    if ($id === '' || $nama === '' || $interval < 1 || $interval > 60 || $ts <= 0) {
        continue;
    }
    $plants[$id] = [
        'nama' => $nama,
        'interval' => $interval,
        'ts' => $ts,
        'due' => $ts + $interval * DAY_MS,
        'tips' => str_field($p, 'tips', 200) ?: null,
    ];
}

$leadId = (int) ($data['lead_id'] ?? 0);
$hash = hash('sha256', $endpoint);
$pdo = db();

try {
    $pdo->beginTransaction();

    $stmt = $pdo->prepare('SELECT id FROM push_subscriptions WHERE endpoint_hash = ?');
    $stmt->execute([$hash]);
    $subId = $stmt->fetchColumn();

    if ($subId === false) {
        $pdo->prepare(
            'INSERT INTO push_subscriptions (user_id, endpoint, endpoint_hash, p256dh, auth) VALUES (?, ?, ?, ?, ?)'
        )->execute([$leadId > 0 ? $leadId : null, $endpoint, $hash, $p256dh, $auth]);
        $subId = (int) $pdo->lastInsertId();
    } else {
        $subId = (int) $subId;
        $pdo->prepare(
            'UPDATE push_subscriptions SET p256dh = ?, auth = ?, user_id = COALESCE(user_id, ?) WHERE id = ?'
        )->execute([$p256dh, $auth, $leadId > 0 ? $leadId : null, $subId]);
    }

    // Pertahankan status "sudah dinotifikasi" untuk siklus siram yang sama.
    $stmt = $pdo->prepare('SELECT id_tanaman, timestamp_terakhir_siram, notified_for FROM plant_schedules WHERE subscription_id = ?');
    $stmt->execute([$subId]);
    $notified = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        if ($row['notified_for'] !== null && (int) $row['notified_for'] === (int) $row['timestamp_terakhir_siram']) {
            $notified[$row['id_tanaman']] = (int) $row['notified_for'];
        }
    }

    $pdo->prepare('DELETE FROM plant_schedules WHERE subscription_id = ?')->execute([$subId]);
    $ins = $pdo->prepare(
        'INSERT INTO plant_schedules
           (subscription_id, id_tanaman, nama_tanaman, interval_siram, timestamp_terakhir_siram, due_ms, tips, notified_for)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    foreach ($plants as $id => $p) {
        $n = ($notified[$id] ?? null) === $p['ts'] ? $p['ts'] : null;
        $ins->execute([$subId, $id, $p['nama'], $p['interval'], $p['ts'], $p['due'], $p['tips'], $n]);
    }

    $pdo->commit();
} catch (PDOException $e) {
    $pdo->rollBack();
    error_log('Sinkron push gagal: ' . $e->getMessage());
    respond(500, ['ok' => false, 'error' => 'Gagal sinkron.']);
}

respond(200, ['ok' => true, 'count' => count($plants)]);
