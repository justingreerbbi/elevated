<?php

declare(strict_types=1);

$config = require __DIR__ . '/config.php';

$localConfigPath = __DIR__ . '/config.local.php';
if (is_file($localConfigPath)) {
    $localConfig = require $localConfigPath;
    if (is_array($localConfig)) {
        $config = array_replace($config, $localConfig);
    }
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
        throw new RuntimeException('Request body must be valid JSON.');
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
