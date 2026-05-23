<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Installer Locked</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="<?= htmlspecialchars($assetUrl('assets/css/app.css'), ENT_QUOTES, 'UTF-8') ?>">
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
