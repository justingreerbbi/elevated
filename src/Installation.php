<?php

declare(strict_types=1);

final class Installation
{
    private const PLACEHOLDER_TOKENS = [
        '',
        '<your-mapbox-public-token>',
        'YOUR_MAPBOX_ACCESS_TOKEN',
    ];

    private const DEFAULT_CONFIG = [
        'app_name' => 'Treasure Hunt Mapper',
        'map_style' => 'mapbox://styles/mapbox/satellite-streets-v12',
        'database_path' => '__ROOT__/storage/treasure_hunts.sqlite',
        'default_center' => [-98.5795, 39.8283],
        'default_zoom' => 3.5,
        'default_pitch' => 0,
        'default_bearing' => 0,
    ];

    public static function loadConfig(string $rootPath): ?array
    {
        $configPath = $rootPath . '/config.php';
        if (!is_file($configPath)) {
            return null;
        }

        $config = require $configPath;
        if (!is_array($config)) {
            throw new RuntimeException('Configuration file must return an array.');
        }

        $localConfigPath = $rootPath . '/config.local.php';
        if (is_file($localConfigPath)) {
            $localConfig = require $localConfigPath;
            if (!is_array($localConfig)) {
                throw new RuntimeException('Local configuration file must return an array.');
            }

            $config = array_replace($config, $localConfig);
        }

        return $config;
    }

    public static function isInstalled(string $rootPath): bool
    {
        $config = self::loadConfig($rootPath);
        if (!is_array($config)) {
            return false;
        }

        $appName = trim((string) ($config['app_name'] ?? ''));
        $databasePath = trim((string) ($config['database_path'] ?? ''));
        $token = trim((string) ($config['mapbox_token'] ?? ''));

        if ($appName === '' || $databasePath === '') {
            return false;
        }

        return !in_array($token, self::PLACEHOLDER_TOKENS, true);
    }

    public static function installerAlreadyLocked(string $rootPath): bool
    {
        return self::isInstalled($rootPath);
    }

    public static function requirements(string $rootPath): array
    {
        return [
            [
                'label' => 'PHP 8.1 or newer',
                'ok' => version_compare(PHP_VERSION, '8.1.0', '>='),
                'details' => 'Running ' . PHP_VERSION,
            ],
            [
                'label' => 'PDO SQLite extension',
                'ok' => extension_loaded('pdo_sqlite'),
                'details' => extension_loaded('pdo_sqlite') ? 'Available' : 'Missing pdo_sqlite',
            ],
            [
                'label' => 'SQLite3 extension',
                'ok' => extension_loaded('sqlite3'),
                'details' => extension_loaded('sqlite3') ? 'Available' : 'Missing sqlite3',
            ],
            [
                'label' => 'Application root writable',
                'ok' => is_writable($rootPath),
                'details' => $rootPath,
            ],
        ];
    }

    public static function canInstall(string $rootPath): bool
    {
        foreach (self::requirements($rootPath) as $requirement) {
            if (($requirement['ok'] ?? false) !== true) {
                return false;
            }
        }

        return true;
    }

    public static function installerDefaults(string $rootPath): array
    {
        return [
            'app_name' => self::DEFAULT_CONFIG['app_name'],
            'mapbox_token' => '',
            'map_style' => self::DEFAULT_CONFIG['map_style'],
            'database_path' => str_replace('__ROOT__', $rootPath, self::DEFAULT_CONFIG['database_path']),
        ];
    }

    public static function install(string $rootPath, array $input): void
    {
        if (self::isInstalled($rootPath)) {
            throw new RuntimeException('Installer is locked because the application is already configured.');
        }

        if (!self::canInstall($rootPath)) {
            throw new RuntimeException('The server does not meet the installer requirements.');
        }

        $defaults = self::installerDefaults($rootPath);
        $appName = trim((string) ($input['app_name'] ?? $defaults['app_name']));
        $mapboxToken = trim((string) ($input['mapbox_token'] ?? ''));
        $mapStyle = trim((string) ($input['map_style'] ?? $defaults['map_style']));
        $databasePath = trim((string) ($input['database_path'] ?? $defaults['database_path']));

        if ($appName === '') {
            throw new InvalidArgumentException('App name is required.');
        }

        if ($mapboxToken === '' || in_array($mapboxToken, self::PLACEHOLDER_TOKENS, true)) {
            throw new InvalidArgumentException('A valid Mapbox public access token is required.');
        }

        if ($mapStyle === '') {
            throw new InvalidArgumentException('Map style is required.');
        }

        if ($databasePath === '') {
            throw new InvalidArgumentException('Database path is required.');
        }

        $databaseDirectory = dirname($databasePath);
        if (!is_dir($databaseDirectory) && !mkdir($databaseDirectory, 0775, true) && !is_dir($databaseDirectory)) {
            throw new RuntimeException('Unable to create the database directory.');
        }

        if (!is_writable($databaseDirectory)) {
            throw new RuntimeException('The database directory must be writable.');
        }

        self::writePhpFile($rootPath . '/config.php', self::buildBaseConfig($rootPath, $appName, $mapStyle, $databasePath));
        self::writePhpFile($rootPath . '/config.local.php', [
            'mapbox_token' => $mapboxToken,
        ]);
    }

    private static function buildBaseConfig(string $rootPath, string $appName, string $mapStyle, string $databasePath): array
    {
        return [
            'app_name' => $appName,
            'mapbox_token' => "getenv('MAPBOX_ACCESS_TOKEN') ?: '<your-mapbox-public-token>'",
            'map_style' => $mapStyle,
            'database_path' => $databasePath,
            'default_center' => self::DEFAULT_CONFIG['default_center'],
            'default_zoom' => self::DEFAULT_CONFIG['default_zoom'],
            'default_pitch' => self::DEFAULT_CONFIG['default_pitch'],
            'default_bearing' => self::DEFAULT_CONFIG['default_bearing'],
        ];
    }

    private static function writePhpFile(string $path, array $values): void
    {
        $content = "<?php\n\ndeclare(strict_types=1);\n\nreturn [\n";

        foreach ($values as $key => $value) {
            if ($key === 'mapbox_token' && is_string($value) && str_starts_with($value, "getenv('MAPBOX_ACCESS_TOKEN')")) {
                $content .= "    '" . $key . "' => " . $value . ",\n";
                continue;
            }

            $content .= "    '" . $key . "' => " . self::exportValue($value) . ",\n";
        }

        $content .= "];\n";

        if (file_put_contents($path, $content, LOCK_EX) === false) {
            throw new RuntimeException('Unable to write configuration file: ' . basename($path));
        }
    }

    private static function exportValue(mixed $value): string
    {
        $export = var_export($value, true);

        return preg_replace('/^/m', '    ', $export) ?? $export;
    }
}