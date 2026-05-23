<?php

declare(strict_types=1);

require_once __DIR__ . '/src/Installation.php';

$config = Installation::loadConfig(__DIR__);
if (!is_array($config) || !Installation::isInstalled(__DIR__)) {
    throw new RuntimeException('Application is not installed. Visit the site to complete setup.');
}

require_once __DIR__ . '/src/Database.php';
require_once __DIR__ . '/src/TreasureHuntRepository.php';

function app_config(): array
{
    global $config;

    return $config;
}

function app_repository(): TreasureHuntRepository
{
    static $repository;

    if ($repository instanceof TreasureHuntRepository) {
        return $repository;
    }

    $pdo = Database::connect(app_config());
    $repository = new TreasureHuntRepository($pdo);

    return $repository;
}

function request_json(): array
{
    $rawBody = file_get_contents('php://input');
    if ($rawBody === false || trim($rawBody) === '') {
        return [];
    }

    $decoded = json_decode($rawBody, true);
    if (!is_array($decoded)) {
        throw new InvalidArgumentException('Request body must be valid JSON.');
    }

    return $decoded;
}

function json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_THROW_ON_ERROR);
    exit;
}

function json_error(string $message, int $status = 400, array $details = []): void
{
    json_response([
        'ok' => false,
        'message' => $message,
        'details' => $details,
    ], $status);
}
