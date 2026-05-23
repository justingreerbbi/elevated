<?php

declare(strict_types=1);

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
        case 'map-state':
            if ($method !== 'POST') {
                json_error('Method not allowed.', 405);
            }

            json_response([
                'ok' => true,
                'data' => $repository->saveMapState(request_json()),
            ]);

            // no break
        default:
            json_error('Unknown resource.', 404);
    }
} catch (InvalidArgumentException $exception) {
    json_error($exception->getMessage(), 422);
} catch (RuntimeException $exception) {
    json_error($exception->getMessage(), 404);
} catch (Throwable $exception) {
    json_error('Unexpected server error.', 500, [
        'exception' => $exception->getMessage(),
    ]);
}
