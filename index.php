<?php

declare(strict_types=1);

require_once __DIR__ . '/src/Installation.php';

$isInstalled = Installation::isInstalled(__DIR__);
$installerRequested = isset($_GET['installer']);

if ($isInstalled && $installerRequested) {
    http_response_code(403);
    ?>
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Installer Locked</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="assets/css/app.css">
    </head>
    <body class="installer-mode">
        <main class="installer-shell">
            <section class="installer-card installer-card-compact">
                <p class="eyebrow">Protected</p>
                <h1>Installer locked</h1>
                <p class="installer-lead">This installation is already configured. The setup flow is disabled after the app is installed.</p>
                <div class="installer-actions">
                    <a class="action-orb primary action-link" href="./">
                        <span class="action-label">Open app</span>
                    </a>
                </div>
            </section>
        </main>
    </body>
    </html>
    <?php
    exit;
}

if (!$isInstalled) {
    $requirements = Installation::requirements(__DIR__);
    $formValues = Installation::installerDefaults(__DIR__);
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
    ?>
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Treasure Hunt Mapper Installer</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="assets/css/app.css">
    </head>
    <body class="installer-mode">
        <main class="installer-shell">
            <section class="installer-hero">
                <p class="eyebrow">First-time setup</p>
                <h1>Install Treasure Hunt Mapper</h1>
                <p class="installer-lead">The app is not configured yet. Complete the guided setup below to create the required config files, store your Mapbox token, and initialize the app.</p>
            </section>

            <section class="installer-grid">
                <article class="installer-card">
                    <div class="installer-card-header">
                        <p class="eyebrow">Step 1</p>
                        <h2>Server checks</h2>
                    </div>
                    <div class="installer-checklist">
                        <?php foreach ($requirements as $requirement): ?>
                            <div class="installer-check-item <?= ($requirement['ok'] ?? false) ? 'is-ok' : 'is-failed' ?>">
                                <div>
                                    <strong><?= htmlspecialchars((string) $requirement['label'], ENT_QUOTES, 'UTF-8') ?></strong>
                                    <p><?= htmlspecialchars((string) $requirement['details'], ENT_QUOTES, 'UTF-8') ?></p>
                                </div>
                                <span><?= ($requirement['ok'] ?? false) ? 'Ready' : 'Fix needed' ?></span>
                            </div>
                        <?php endforeach; ?>
                    </div>
                </article>

                <article class="installer-card installer-card-form">
                    <div class="installer-card-header">
                        <p class="eyebrow">Step 2</p>
                        <h2>Application details</h2>
                    </div>

                    <?php if ($errorMessage !== null): ?>
                        <div class="installer-alert">
                            <?= htmlspecialchars($errorMessage, ENT_QUOTES, 'UTF-8') ?>
                        </div>
                    <?php endif; ?>

                    <form method="post" action="?installer=1" class="stack-form installer-form">
                        <label>
                            <span>App name</span>
                            <input type="text" name="app_name" value="<?= htmlspecialchars((string) $formValues['app_name'], ENT_QUOTES, 'UTF-8') ?>" required>
                        </label>
                        <label>
                            <span>Mapbox public token</span>
                            <input type="text" name="mapbox_token" value="<?= htmlspecialchars((string) $formValues['mapbox_token'], ENT_QUOTES, 'UTF-8') ?>" placeholder="pk.ey..." required>
                        </label>
                        <label>
                            <span>Map style</span>
                            <select name="map_style">
                                <option value="mapbox://styles/mapbox/satellite-streets-v12" <?= $formValues['map_style'] === 'mapbox://styles/mapbox/satellite-streets-v12' ? 'selected' : '' ?>>Satellite Streets</option>
                                <option value="mapbox://styles/mapbox/satellite-v9" <?= $formValues['map_style'] === 'mapbox://styles/mapbox/satellite-v9' ? 'selected' : '' ?>>Satellite</option>
                                <option value="mapbox://styles/mapbox/outdoors-v12" <?= $formValues['map_style'] === 'mapbox://styles/mapbox/outdoors-v12' ? 'selected' : '' ?>>Outdoors</option>
                                <option value="mapbox://styles/mapbox/light-v11" <?= $formValues['map_style'] === 'mapbox://styles/mapbox/light-v11' ? 'selected' : '' ?>>Light</option>
                                <option value="mapbox://styles/mapbox/dark-v11" <?= $formValues['map_style'] === 'mapbox://styles/mapbox/dark-v11' ? 'selected' : '' ?>>Dark</option>
                            </select>
                        </label>
                        <label>
                            <span>SQLite database path</span>
                            <input type="text" name="database_path" value="<?= htmlspecialchars((string) $formValues['database_path'], ENT_QUOTES, 'UTF-8') ?>" required>
                        </label>
                        <div class="installer-note">
                            <strong>Step 3</strong>
                            <p>The installer will write <code>config.php</code> with base defaults and <code>config.local.php</code> with your Mapbox token. After setup, the installer route is blocked.</p>
                        </div>
                        <div class="installer-actions">
                            <button type="submit" class="action-orb primary" <?= Installation::canInstall(__DIR__) ? '' : 'disabled' ?>>
                                <span class="action-label">Create config files</span>
                            </button>
                        </div>
                    </form>
                </article>
            </section>
        </main>
    </body>
    </html>
    <?php
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
    <link rel="stylesheet" href="assets/css/app.css">
</head>
<body>
    <div class="app-shell" id="app-shell">
        <aside class="sidebar" id="sidebar">
            <section class="panel">
                <div class="panel-header">
                    <div>
                        <h2>Hunts</h2>
                        <p class="microcopy" id="active-hunt-name">No active hunt</p>
                    </div>
                    <div class="header-actions">
                        <button type="button" class="icon-button" id="open-hunt-modal" aria-label="Create hunt">
                            <i class="fa-solid fa-plus"></i>
                        </button>
                        <button type="button" class="icon-button" id="toggle-sidebar" aria-label="Hide sidebar">
                            <i class="fa-solid fa-angle-left"></i>
                        </button>
                    </div>
                </div>
                <div id="hunt-list" class="list-block"></div>
            </section>

            <section class="panel feature-panel">
                <div class="panel-header">
                    <div>
                        <h2>Features</h2>
                        <p class="microcopy" id="feature-summary">No items</p>
                    </div>
                    <span class="mode-chip" id="mode-badge">Browse</span>
                </div>
                <div id="feature-empty" class="empty-state">Select a hunt to start.</div>
                <div id="feature-list" class="list-block"></div>
            </section>
        </aside>

        <main class="map-stage">
            <button type="button" class="panel-toggle floating-toggle hidden" id="show-sidebar">
                <i class="fa-solid fa-bars"></i>
                <span>Menu</span>
            </button>
            <div class="search-shell">
                <i class="fa-solid fa-magnifying-glass search-icon" aria-hidden="true"></i>
                <input type="search" id="search-input" placeholder="Search locations">
                <div id="search-results" class="search-results hidden"></div>
            </div>

            <section class="info-modal hidden" id="info-modal" aria-live="polite">
                <div class="info-modal-card">
                    <div class="modal-header">
                        <div>
                            <p class="eyebrow" id="info-kicker">Location</p>
                            <h2 id="info-title">Map Details</h2>
                        </div>
                        <button type="button" class="icon-button" id="close-info-modal" aria-label="Close info panel">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                    <p class="modal-subtitle" id="info-subtitle">Click the map to inspect a location.</p>
                    <div class="info-grid" id="info-grid"></div>
                    <div class="info-content" id="info-content"></div>

                    <form id="feature-form" class="stack-form hidden">
                        <input type="hidden" id="feature-id" value="">
                        <input type="hidden" id="feature-type" value="marker">
                        <label>
                            <span>Name</span>
                            <input type="text" id="feature-name" placeholder="Feature name" required>
                        </label>
                        <label>
                            <span>Description</span>
                            <textarea id="feature-description" rows="3" placeholder="Metadata, clues, or notes"></textarea>
                        </label>
                        <div class="dual-fields">
                            <label>
                                <span>Color</span>
                                <input type="color" id="feature-color" value="#ff6b35">
                            </label>
                            <label>
                                <span>Type</span>
                                <input type="text" id="feature-type-label" readonly>
                            </label>
                        </div>
                        <div class="dual-fields feature-point-fields">
                            <label>
                                <span>Latitude</span>
                                <input type="number" step="any" id="feature-lat">
                            </label>
                            <label>
                                <span>Longitude</span>
                                <input type="number" step="any" id="feature-lng">
                            </label>
                        </div>
                        <label class="feature-radius-field hidden">
                            <span id="feature-radius-label">Radius (m)</span>
                            <input type="number" min="1" step="1" id="feature-radius" value="100">
                        </label>
                    </form>

                    <div class="modal-actions" id="info-actions"></div>
                </div>
            </section>

            <section class="tool-rail" id="tool-rail">
                <button type="button" class="tool-button" data-tool="marker" title="Add marker">
                    <i class="fa-solid fa-location-dot"></i>
                    <span>Marker</span>
                </button>
                <button type="button" class="tool-button" data-tool="polygon" title="Draw polygon">
                    <i class="fa-solid fa-draw-polygon"></i>
                    <span>Polygon</span>
                </button>
                <button type="button" class="tool-button" data-tool="circle" title="Radius ring">
                    <i class="fa-solid fa-circle-dot"></i>
                    <span>Radius</span>
                </button>
                <button type="button" class="tool-button" data-tool="measure" title="Measure distance">
                    <i class="fa-solid fa-ruler-combined"></i>
                    <span>Measure</span>
                </button>
                <button type="button" class="tool-button" id="toggle-layer-panel" title="Layers">
                    <i class="fa-solid fa-layer-group"></i>
                    <span>Layers</span>
                </button>
                <button type="button" class="tool-button" id="open-preferences-modal" title="Preferences">
                    <i class="fa-solid fa-sliders"></i>
                    <span>Settings</span>
                </button>
                <button type="button" class="tool-button" id="compass-reset" title="Reset north or tilt">
                    <i class="fa-solid fa-compass"></i>
                    <span>Reset</span>
                </button>
                <button type="button" class="tool-button" id="clear-measurement" title="Clear measurement">
                    <i class="fa-solid fa-eraser"></i>
                    <span>Clear</span>
                </button>
            </section>

            <section class="layer-panel hidden" id="layer-panel">
                <div class="panel-header">
                    <h2>Layers</h2>
                    <span class="microcopy">Overlays</span>
                </div>
                <div class="toggle-list compact">
                    <label class="toggle-item">
                        <input type="checkbox" id="toggle-terrain" checked>
                        <span>3D Terrain</span>
                    </label>
                    <label class="toggle-item">
                        <input type="checkbox" id="toggle-contours" checked>
                        <span>Contour Lines</span>
                    </label>
                    <label class="toggle-item">
                        <input type="checkbox" id="toggle-peaks" checked>
                        <span>Peak Labels</span>
                    </label>
                    <label class="toggle-item">
                        <input type="checkbox" id="toggle-roads" checked>
                        <span>Roads</span>
                    </label>
                    <label class="toggle-item">
                        <input type="checkbox" id="toggle-parks-borders" checked>
                        <span>Public Lands + Borders</span>
                    </label>
                    <label class="toggle-item">
                        <input type="checkbox" id="toggle-grid" checked>
                        <span>Grid Lines</span>
                    </label>
                    <label class="toggle-item">
                        <input type="checkbox" id="toggle-coords" checked>
                        <span>Lat/Lng Labels</span>
                    </label>
                    <label class="toggle-item">
                        <input type="checkbox" id="toggle-hunt-areas">
                        <span>Search Area</span>
                    </label>
                </div>
            </section>

            <div class="status-card" id="status-card">Loading</div>
            <div id="map"></div>
        </main>
    </div>

    <div class="dialog-layer hidden" id="hunt-modal">
        <div class="dialog-scrim" data-close-hunt="true"></div>
        <div class="dialog-card" role="dialog" aria-modal="true" aria-labelledby="hunt-modal-title">
            <div class="modal-header">
                <div>
                    <p class="eyebrow" id="hunt-modal-kicker">Hunt Project</p>
                    <h2 id="hunt-modal-title">Create Hunt</h2>
                </div>
                <button type="button" class="icon-button" id="close-hunt-modal" aria-label="Close hunt modal">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <form id="hunt-form" class="stack-form">
                <input type="hidden" id="hunt-id" value="">
                <label>
                    <span>Name</span>
                    <input type="text" id="hunt-name" placeholder="Add a hunt project" required>
                </label>
                <label>
                    <span>Description</span>
                    <textarea id="hunt-description" rows="3" placeholder="Notes for this hunt"></textarea>
                </label>
                <div class="hunt-area-field">
                    <div class="hunt-area-summary" id="hunt-area-summary">
                        <strong>Search area required</strong>
                        <p>Click the map and draw a polygon to define where this hunt takes place.</p>
                    </div>
                    <div class="hunt-area-actions">
                        <button type="button" class="mini-button hunt-area-trigger" id="define-hunt-area">
                            <i class="fa-solid fa-draw-polygon"></i>
                            <span>Draw search area</span>
                        </button>
                        <button type="button" class="mini-button hidden" id="clear-hunt-area">
                            <i class="fa-solid fa-trash"></i>
                            <span>Clear area</span>
                        </button>
                    </div>
                </div>
                <div class="modal-actions">
                    <button type="button" class="action-orb cancel" id="hunt-form-reset">
                        <span class="action-icon"><i class="fa-solid fa-arrow-left"></i></span>
                        <span class="action-label">Cancel</span>
                    </button>
                    <button type="submit" class="action-orb primary">
                        <span class="action-icon"><i class="fa-solid fa-floppy-disk"></i></span>
                        <span class="action-label">Save Hunt</span>
                    </button>
                </div>
            </form>
        </div>
    </div>

    <div class="dialog-layer hidden" id="preferences-modal">
        <div class="dialog-scrim" data-close-preferences="true"></div>
        <div class="dialog-card preferences-card" role="dialog" aria-modal="true" aria-labelledby="preferences-modal-title">
            <div class="modal-header">
                <div>
                    <p class="eyebrow">Preferences</p>
                    <h2 id="preferences-modal-title">Display Settings</h2>
                </div>
                <button type="button" class="icon-button" id="close-preferences-modal" aria-label="Close preferences modal">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <form id="preferences-form" class="stack-form">
                <label>
                    <span>Map Style</span>
                    <select id="preference-map-style">
                        <option value="gis-satellite">GIS Satellite</option>
                        <option value="mapbox://styles/mapbox/satellite-streets-v12">Satellite Streets</option>
                        <option value="mapbox://styles/mapbox/satellite-v9">Satellite</option>
                        <option value="mapbox://styles/mapbox/outdoors-v12">Outdoors</option>
                        <option value="mapbox://styles/mapbox/light-v11">Light</option>
                        <option value="mapbox://styles/mapbox/dark-v11">Dark</option>
                    </select>
                </label>
                <label>
                    <span>Units</span>
                    <select id="preference-units">
                        <option value="metric">Metric</option>
                        <option value="imperial">Imperial</option>
                    </select>
                </label>
                <label>
                    <span>Public Land Opacity <strong id="preference-public-opacity-value">100%</strong></span>
                    <input type="range" id="preference-public-opacity" min="0" max="100" step="5" value="100">
                </label>
                <div class="toggle-list compact settings-toggles">
                    <label class="toggle-item">
                        <input type="checkbox" id="preference-terrain">
                        <span>3D Terrain</span>
                    </label>
                    <label class="toggle-item">
                        <input type="checkbox" id="preference-contours">
                        <span>Contour Lines</span>
                    </label>
                    <label class="toggle-item">
                        <input type="checkbox" id="preference-peaks">
                        <span>Peak Labels</span>
                    </label>
                    <label class="toggle-item">
                        <input type="checkbox" id="preference-roads">
                        <span>Show Roads</span>
                    </label>
                    <label class="toggle-item">
                        <input type="checkbox" id="preference-public-national-parks">
                        <span>National Parks</span>
                    </label>
                    <label class="toggle-item">
                        <input type="checkbox" id="preference-public-recreation">
                        <span>Parks + Recreation</span>
                    </label>
                    <label class="toggle-item">
                        <input type="checkbox" id="preference-public-tribal">
                        <span>Tribal Lands</span>
                    </label>
                    <label class="toggle-item">
                        <input type="checkbox" id="preference-public-borders">
                        <span>Public Land Borders</span>
                    </label>
                    <label class="toggle-item">
                        <input type="checkbox" id="preference-grid">
                        <span>Show Grid</span>
                    </label>
                    <label class="toggle-item">
                        <input type="checkbox" id="preference-coords">
                        <span>Show Coordinates</span>
                    </label>
                </div>
                <div class="modal-actions">
                    <button type="button" class="action-orb cancel" id="preferences-form-reset">
                        <span class="action-icon"><i class="fa-solid fa-arrow-left"></i></span>
                        <span class="action-label">Cancel</span>
                    </button>
                    <button type="submit" class="action-orb primary">
                        <span class="action-icon"><i class="fa-solid fa-floppy-disk"></i></span>
                        <span class="action-label">Save</span>
                    </button>
                </div>
            </form>
        </div>
    </div>

    <div id="toast" class="toast hidden"></div>

    <script src="https://code.jquery.com/jquery-3.7.1.min.js" integrity="sha256-/JqT3SQfawRcv/BIHPThkBvs0OEvtFFmqPF/lYI/Cxo=" crossorigin="anonymous"></script>
    <script src="https://api.mapbox.com/mapbox-gl-js/v3.11.0/mapbox-gl.js"></script>
    <script src="https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-draw/v1.5.0/mapbox-gl-draw.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@turf/turf@7.2.0/turf.min.js"></script>
    <script src="assets/js/app.js"></script>
</body>
</html>
