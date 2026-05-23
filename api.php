<?php

declare(strict_types=1);

require_once __DIR__ . '/src/Installation.php';

if (!Installation::isInstalled(__DIR__)) {
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'ok' => false,
        'message' => 'Application is not installed. Visit the main site to run the installer.',
    ], JSON_THROW_ON_ERROR);
    exit;
}

require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$resource = strtolower(trim((string) ($_GET['resource'] ?? 'bootstrap')));
$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$repository = app_repository();

try {
    switch ($resource) {
        case 'bootstrap':
            if ($method !== 'GET') {
                json_error('Method not allowed.', 405);
            }

            json_response([
                'ok' => true,
                'data' => $repository->bootstrap(app_config()),
            ]);

            // no break
        case 'hunts':
            if ($method === 'GET') {
                json_response([
                    'ok' => true,
                    'data' => $repository->listHunts(),
                ]);
            }

            if ($method === 'POST') {
                json_response([
                    'ok' => true,
                    'data' => $repository->createHunt(request_json()),
                ], 201);
            }

            $huntId = (int) ($_GET['id'] ?? 0);
            if ($huntId < 1) {
                json_error('A valid hunt id is required.', 422);
            }

            if (in_array($method, ['PUT', 'PATCH'], true)) {
                json_response([
                    'ok' => true,
                    'data' => $repository->updateHunt($huntId, request_json()),
                ]);
            }

            if ($method === 'DELETE') {
                $repository->deleteHunt($huntId);
                json_response([
                    'ok' => true,
                ]);
            }

            json_error('Method not allowed.', 405);

            // no break
        case 'features':
            if ($method === 'GET') {
                $huntId = isset($_GET['hunt_id']) ? (int) $_GET['hunt_id'] : null;
                json_response([
                    'ok' => true,
                    'data' => $repository->listFeatures($huntId && $huntId > 0 ? $huntId : null),
                ]);
            }

            if ($method === 'POST') {
                json_response([
                    'ok' => true,
                    'data' => $repository->createFeature(request_json()),
                ], 201);
            }

            $featureId = (int) ($_GET['id'] ?? 0);
            if ($featureId < 1) {
                json_error('A valid feature id is required.', 422);
            }

            if (in_array($method, ['PUT', 'PATCH'], true)) {
                json_response([
                    'ok' => true,
                    'data' => $repository->updateFeature($featureId, request_json()),
                ]);
            }

            if ($method === 'DELETE') {
                $repository->deleteFeature($featureId);
                json_response([
                    'ok' => true,
                ]);
            }

            json_error('Method not allowed.', 405);

            // no break
        case 'map-items':
            if ($method === 'GET') {
                $huntId = isset($_GET['hunt_id']) ? (int) $_GET['hunt_id'] : null;
                json_response([
                    'ok' => true,
                    'data' => $repository->listMapItems($huntId && $huntId > 0 ? $huntId : null),
                ]);
            }

            if ($method === 'POST') {
                json_response([
                    'ok' => true,
                    'data' => $repository->createMapItem(request_json()),
                ], 201);
            }

            $mapItemId = (int) ($_GET['id'] ?? 0);
            if ($mapItemId < 1) {
                json_error('A valid map item id is required.', 422);
            }

            if (in_array($method, ['PUT', 'PATCH'], true)) {
                json_response([
                    'ok' => true,
                    'data' => $repository->updateMapItem($mapItemId, request_json()),
                ]);
            }

            if ($method === 'DELETE') {
                $repository->deleteMapItem($mapItemId);
                json_response([
                    'ok' => true,
                ]);
            }

            json_error('Method not allowed.', 405);

            // no break
        case 'clues':
            if ($method === 'GET') {
                $huntId = isset($_GET['hunt_id']) ? (int) $_GET['hunt_id'] : null;
                json_response([
                    'ok' => true,
                    'data' => $repository->listClues($huntId && $huntId > 0 ? $huntId : null),
                ]);
            }

            if ($method === 'POST') {
                json_response([
                    'ok' => true,
                    'data' => $repository->createClue(request_json()),
                ], 201);
            }

            $clueId = (int) ($_GET['id'] ?? 0);
            if ($clueId < 1) {
                json_error('A valid clue id is required.', 422);
            }

            if (in_array($method, ['PUT', 'PATCH'], true)) {
                json_response([
                    'ok' => true,
                    'data' => $repository->updateClue($clueId, request_json()),
                ]);
            }

            if ($method === 'DELETE') {
                $repository->deleteClue($clueId);
                json_response([
                    'ok' => true,
                ]);
            }

            json_error('Method not allowed.', 405);

            // no break
        case 'clue-map-items':
            if ($method === 'GET') {
                $clueId = isset($_GET['clue_id']) ? (int) $_GET['clue_id'] : null;
                $mapItemId = isset($_GET['map_item_id']) ? (int) $_GET['map_item_id'] : null;
                json_response([
                    'ok' => true,
                    'data' => $repository->listClueMapItems(
                        $clueId && $clueId > 0 ? $clueId : null,
                        $mapItemId && $mapItemId > 0 ? $mapItemId : null
                    ),
                ]);
            }

            if ($method === 'POST') {
                json_response([
                    'ok' => true,
                    'data' => $repository->createClueMapItem(request_json()),
                ], 201);
            }

            $clueMapItemId = (int) ($_GET['id'] ?? 0);
            if ($clueMapItemId < 1) {
                json_error('A valid clue-map-item id is required.', 422);
            }

            if ($method === 'DELETE') {
                $repository->deleteClueMapItem($clueMapItemId);
                json_response([
                    'ok' => true,
                ]);
            }

            json_error('Method not allowed.', 405);

            // no break
        case 'map-state':
            if ($method !== 'POST') {
                json_error('Method not allowed.', 405);
            }

            json_response([
                'ok' => true,
                'data' => $repository->saveMapState(request_json()),
            ]);

            // no break
        case 'reasoning-settings':
            $huntId = (int) ($_GET['hunt_id'] ?? 0);
            if ($huntId < 1) {
                json_error('A valid hunt id is required.', 422);
            }

            if ($method === 'GET') {
                json_response([
                    'ok' => true,
                    'data' => $repository->getReasoningSettings($huntId),
                ]);
            }

            if (in_array($method, ['PUT', 'PATCH'], true)) {
                json_response([
                    'ok' => true,
                    'data' => $repository->saveReasoningSettings($huntId, request_json()),
                ]);
            }

            json_error('Method not allowed.', 405);

            // no break
        default:
            json_error('Unknown resource.', 404);
    }
} catch (InvalidArgumentException $exception) {
    json_error($exception->getMessage(), 422);
} catch (RuntimeException $exception) {
    json_error($exception->getMessage(), 404);
} catch (Throwable $exception) {
    json_error('Unexpected server error.', 500);
}
