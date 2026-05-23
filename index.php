<?php

declare(strict_types=1);

require_once __DIR__ . '/src/Installation.php';

$assetUrl = static function (string $path): string {
    $fullPath = __DIR__ . '/' . ltrim($path, '/');
    $version = is_file($fullPath) ? (string) filemtime($fullPath) : '1';
    return $path . '?v=' . rawurlencode($version);
};

$isInstalled = Installation::isInstalled(__DIR__);
$installerRequested = isset($_GET['installer']);

if ($isInstalled && $installerRequested) {
    http_response_code(403);
    require __DIR__ . '/views/installer-locked.php';
    exit;
}

if (!$isInstalled) {
    $requirements = Installation::requirements(__DIR__);
    $formValues = Installation::installerDefaults(__DIR__);
    $canInstall = Installation::canInstall(__DIR__);
    $errorMessage = null;

    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
        $formValues = array_merge($formValues, [
            'app_name' => trim((string) ($_POST['app_name'] ?? $formValues['app_name'])),
            'mapbox_token' => trim((string) ($_POST['mapbox_token'] ?? '')),
            'map_style' => trim((string) ($_POST['map_style'] ?? $formValues['map_style'])),
            'database_path' => trim((string) ($_POST['database_path'] ?? $formValues['database_path'])),
        ]);

        try {
            Installation::install(__DIR__, $formValues);
            header('Location: ./');
            exit;
        } catch (Throwable $exception) {
            $errorMessage = $exception->getMessage();
        }
    }
    require __DIR__ . '/views/installer-setup.php';
    exit;
}

$config = Installation::loadConfig(__DIR__);
if (!is_array($config)) {
    throw new RuntimeException('Application configuration is unavailable.');
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= htmlspecialchars((string) $config['app_name'], ENT_QUOTES, 'UTF-8') ?></title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer">
    <link href="https://api.mapbox.com/mapbox-gl-js/v3.11.0/mapbox-gl.css" rel="stylesheet">
    <link href="https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-draw/v1.5.0/mapbox-gl-draw.css" rel="stylesheet">
    <link rel="stylesheet" href="<?= htmlspecialchars($assetUrl('assets/css/app.css'), ENT_QUOTES, 'UTF-8') ?>">
</head>
<body>
    <?php require __DIR__ . '/views/app-ui.php'; ?>
    <script src="https://code.jquery.com/jquery-3.7.1.min.js" integrity="sha256-/JqT3SQfawRcv/BIHPThkBvs0OEvtFFmqPF/lYI/Cxo=" crossorigin="anonymous"></script>
    <script src="https://api.mapbox.com/mapbox-gl-js/v3.11.0/mapbox-gl.js"></script>
    <script src="https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-draw/v1.5.0/mapbox-gl-draw.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@turf/turf@7.2.0/turf.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/cytoscape@3.31.2/dist/cytoscape.min.js"></script>
    <script src="<?= htmlspecialchars($assetUrl('assets/js/utils.js'), ENT_QUOTES, 'UTF-8') ?>"></script>
    <script src="<?= htmlspecialchars($assetUrl('assets/js/api.js'), ENT_QUOTES, 'UTF-8') ?>"></script>
    <script src="<?= htmlspecialchars($assetUrl('assets/js/state.js'), ENT_QUOTES, 'UTF-8') ?>"></script>
    <script src="<?= htmlspecialchars($assetUrl('assets/js/app.js'), ENT_QUOTES, 'UTF-8') ?>"></script>
</body>
</html>
