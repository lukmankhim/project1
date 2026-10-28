<?php
declare(strict_types=1);

// Membuat file kalender (.ics) berulang dengan alarm. Tidak menyentuh database.
// Contoh: ics.php?n=Monstera&i=3&s=1730000000000

$nama = mb_substr(trim((string) ($_GET['n'] ?? '')), 0, 60);
$interval = (int) ($_GET['i'] ?? 0);
$startMs = (int) ($_GET['s'] ?? 0);

if ($nama === '' || $interval < 1 || $interval > 60 || $startMs <= 0) {
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Parameter tidak valid.';
    exit;
}

function ics_escape(string $s): string
{
    return addcslashes(str_replace(["\r", "\n"], ' ', $s), ',;\\');
}

$start = (int) floor($startMs / 1000);
// Kalau jadwal sudah lewat, mulai hari ini supaya alarm pertama tidak hilang.
if ($start < time()) {
    $start = time() + 300;
}
$fmt = 'Ymd\THis\Z';
$uid = hash('sha256', $nama . '|' . $interval . '|' . $startMs) . '@ingat-siram';
$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$appUrl = $scheme . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . dirname(dirname($_SERVER['SCRIPT_NAME'])) . '/app.html';
$appUrl = str_replace('//app.html', '/app.html', $appUrl);

$lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ingat Siram//ID',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:' . $uid,
    'DTSTAMP:' . gmdate($fmt),
    'DTSTART:' . gmdate($fmt, $start),
    'DTEND:' . gmdate($fmt, $start + 900),
    'RRULE:FREQ=DAILY;INTERVAL=' . $interval,
    'SUMMARY:' . ics_escape('💧 Siram ' . $nama),
    'DESCRIPTION:' . ics_escape('Waktunya menyiram ' . $nama . '. Tandai sudah disiram di ' . $appUrl),
    'URL:' . $appUrl,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:' . ics_escape('Waktunya menyiram ' . $nama),
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
];

header('Content-Type: text/calendar; charset=utf-8');
header('Content-Disposition: inline; filename="siram-' . preg_replace('/[^a-z0-9]+/i', '-', $nama) . '.ics"');
echo implode("\r\n", $lines) . "\r\n";
