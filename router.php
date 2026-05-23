<?php

declare(strict_types=1);

$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$filePath = __DIR__ . ($requestPath === '/' ? '/index.php' : (string) $requestPath);

if ($requestPath !== '/' && is_file($filePath)) {
    return false;
}

require __DIR__ . '/index.php';
