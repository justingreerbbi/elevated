<?php

declare(strict_types=1);

final class Database
{
    public static function connect(array $config): PDO
    {
        $databasePath = $config['database_path'] ?? null;
        if (!is_string($databasePath) || $databasePath === '') {
            throw new RuntimeException('Missing SQLite database path in configuration.');
        }

        $databaseDirectory = dirname($databasePath);
        if (!is_dir($databaseDirectory) && !mkdir($databaseDirectory, 0775, true) && !is_dir($databaseDirectory)) {
            throw new RuntimeException('Unable to create database directory.');
        }

        $pdo = new PDO('sqlite:' . $databasePath);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $pdo->exec('PRAGMA foreign_keys = ON');

        self::initializeSchema($pdo);

        return $pdo;
    }

    private static function initializeSchema(PDO $pdo): void
    {
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS hunts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT \'\',
                search_area_json TEXT NOT NULL DEFAULT \'\',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )'
        );

        self::ensureColumnExists($pdo, 'hunts', 'search_area_json', "ALTER TABLE hunts ADD COLUMN search_area_json TEXT NOT NULL DEFAULT ''");

        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS features (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                hunt_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT \'\',
                color TEXT NOT NULL DEFAULT \'#ff6b35\',
                geometry_json TEXT NOT NULL,
                metadata_json TEXT NOT NULL DEFAULT \'{}\',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (hunt_id) REFERENCES hunts(id) ON DELETE CASCADE
            )'
        );

        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS map_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                hunt_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT \'reference\',
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT \'\',
                geometry_json TEXT NOT NULL,
                style_json TEXT NOT NULL DEFAULT \'{}\',
                metadata_json TEXT NOT NULL DEFAULT \'{}\',
                status TEXT NOT NULL DEFAULT \'active\',
                confidence INTEGER NOT NULL DEFAULT 50,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (hunt_id) REFERENCES hunts(id) ON DELETE CASCADE
            )'
        );

        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS clues (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                hunt_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                body TEXT NOT NULL DEFAULT \'\',
                interpretation TEXT NOT NULL DEFAULT \'\',
                status TEXT NOT NULL DEFAULT \'open\',
                confidence INTEGER NOT NULL DEFAULT 50,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (hunt_id) REFERENCES hunts(id) ON DELETE CASCADE
            )'
        );

        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS clue_map_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                clue_id INTEGER NOT NULL,
                map_item_id INTEGER NOT NULL,
                relationship_type TEXT NOT NULL DEFAULT \'supports\',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (clue_id) REFERENCES clues(id) ON DELETE CASCADE,
                FOREIGN KEY (map_item_id) REFERENCES map_items(id) ON DELETE CASCADE,
                UNIQUE(clue_id, map_item_id, relationship_type)
            )'
        );

        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS reasoning_settings (
                hunt_id INTEGER PRIMARY KEY,
                cell_side_km REAL NOT NULL DEFAULT 10,
                repeat_decay REAL NOT NULL DEFAULT 0.65,
                category_caps_json TEXT NOT NULL DEFAULT \'{"text":8,"terrain":8,"negative":0.25}\',
                negative_floor REAL NOT NULL DEFAULT 0.25,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (hunt_id) REFERENCES hunts(id) ON DELETE CASCADE
            )'
        );

        $pdo->exec('CREATE INDEX IF NOT EXISTS idx_map_items_hunt_id ON map_items(hunt_id)');
        $pdo->exec('CREATE INDEX IF NOT EXISTS idx_map_items_type ON map_items(type)');
        $pdo->exec('CREATE INDEX IF NOT EXISTS idx_map_items_category ON map_items(category)');
        $pdo->exec('CREATE INDEX IF NOT EXISTS idx_map_items_status ON map_items(status)');
        $pdo->exec('CREATE INDEX IF NOT EXISTS idx_clues_hunt_id ON clues(hunt_id)');
        $pdo->exec('CREATE INDEX IF NOT EXISTS idx_clues_status ON clues(status)');
        $pdo->exec('CREATE INDEX IF NOT EXISTS idx_clue_map_items_clue_id ON clue_map_items(clue_id)');
        $pdo->exec('CREATE INDEX IF NOT EXISTS idx_clue_map_items_map_item_id ON clue_map_items(map_item_id)');

        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS app_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                map_state_json TEXT NOT NULL DEFAULT \'{}\',
                schema_version INTEGER NOT NULL DEFAULT 1,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )'
        );

        self::ensureColumnExists($pdo, 'app_state', 'schema_version', "ALTER TABLE app_state ADD COLUMN schema_version INTEGER NOT NULL DEFAULT 1");

        $pdo->exec(
            'INSERT INTO app_state (id, map_state_json, updated_at)
             VALUES (1, \'{}\', CURRENT_TIMESTAMP)
             ON CONFLICT(id) DO NOTHING'
        );

        self::migrateFeaturesIntoMapItems($pdo);
        $pdo->exec('UPDATE app_state SET schema_version = 2 WHERE id = 1');
    }

    private static function migrateFeaturesIntoMapItems(PDO $pdo): void
    {
        $statement = $pdo->query('SELECT id, hunt_id, type, name, description, color, geometry_json, metadata_json, created_at, updated_at FROM features');
        $legacyFeatures = $statement ? ($statement->fetchAll() ?: []) : [];
        if ($legacyFeatures === []) {
            return;
        }

        $insert = $pdo->prepare(
            'INSERT OR IGNORE INTO map_items (
                id,
                hunt_id,
                type,
                category,
                name,
                description,
                geometry_json,
                style_json,
                metadata_json,
                status,
                confidence,
                created_at,
                updated_at
             ) VALUES (
                :id,
                :hunt_id,
                :type,
                :category,
                :name,
                :description,
                :geometry_json,
                :style_json,
                :metadata_json,
                :status,
                :confidence,
                :created_at,
                :updated_at
             )'
        );

        foreach ($legacyFeatures as $feature) {
            $color = is_string($feature['color'] ?? null) && $feature['color'] !== '' ? $feature['color'] : '#ff6b35';
            $style = [
                'color' => $color,
            ];

            $insert->execute([
                ':id' => (int) $feature['id'],
                ':hunt_id' => (int) $feature['hunt_id'],
                ':type' => (string) $feature['type'],
                ':category' => 'reference',
                ':name' => (string) $feature['name'],
                ':description' => (string) ($feature['description'] ?? ''),
                ':geometry_json' => (string) $feature['geometry_json'],
                ':style_json' => json_encode($style, JSON_THROW_ON_ERROR),
                ':metadata_json' => (string) $feature['metadata_json'],
                ':status' => 'active',
                ':confidence' => 50,
                ':created_at' => (string) ($feature['created_at'] ?? date('Y-m-d H:i:s')),
                ':updated_at' => (string) ($feature['updated_at'] ?? date('Y-m-d H:i:s')),
            ]);
        }
    }

    private static function ensureColumnExists(PDO $pdo, string $table, string $column, string $alterSql): void
    {
        $statement = $pdo->query('PRAGMA table_info(' . $table . ')');
        $columns = $statement ? $statement->fetchAll() : [];

        foreach ($columns as $definition) {
            if (($definition['name'] ?? null) === $column) {
                return;
            }
        }

        $pdo->exec($alterSql);
    }
}
