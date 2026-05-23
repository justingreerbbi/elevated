<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Treasure Hunt Mapper Installer</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="<?= htmlspecialchars($assetUrl('assets/css/app.css'), ENT_QUOTES, 'UTF-8') ?>">
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
                        <button type="submit" class="action-orb primary" <?= $canInstall ? '' : 'disabled' ?>>
                            <span class="action-label">Create config files</span>
                        </button>
                    </div>
                </form>
            </article>
        </section>
    </main>
</body>
</html>
