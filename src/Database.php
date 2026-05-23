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
            'CREATE TABLE IF NOT EXISTS app_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                map_state_json TEXT NOT NULL DEFAULT \'{}\',
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )'
        );

        $pdo->exec(
            'INSERT INTO app_state (id, map_state_json, updated_at)
             VALUES (1, \'{}\', CURRENT_TIMESTAMP)
             ON CONFLICT(id) DO NOTHING'
        );
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
