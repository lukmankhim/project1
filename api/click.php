<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$data = read_json_body();

$eventId = str_field($data, 'event_id', 100);
$productId = str_field($data, 'product_id', 100);
if ($eventId === '' || $productId === '') {
    respond(422, ['ok' => false]);
}

echo json_encode(['ok' => true]);
if (function_exists('fastcgi_finish_request')) {
    fastcgi_finish_request();
}

$nama = str_field($data, 'nama', 100);
$contact = normalize_contact(str_field($data, 'kontak', 191));

capi_send(
    'ClickAffiliate',
    $eventId,
    capi_user_data($data, $contact, $nama),
    str_field($data, 'page_url', 1000),
    [
        'content_ids' => [$productId],
        'content_type' => 'product',
        'placement' => str_field($data, 'placement', 50),
    ]
);
