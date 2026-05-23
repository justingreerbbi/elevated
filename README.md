# Treasure Hunt Mapper

Treasure Hunt Mapper is a full-screen Mapbox and jQuery mapping tool with a PHP backend and SQLite persistence. It stores hunts, map items (points, circles, polygons, lines), clue records, clue-to-map-item links, and the last-used map camera state.

## Features

- Full-screen satellite mapping with Mapbox GL JS
- Hunt projects with persistent SQLite storage
- Map items with names, descriptions, color, confidence, category, and status metadata
- Geometry tools for points, circles, polygons, and lines
- Clue records with source/reliability metadata and links to related map items
- Search box with autocomplete powered by Mapbox Geocoding
- Distance measurement tool
- Compass reset behavior: first click resets north, second click resets tilt
- Layer toggles for roads, grid lines, and lat/lng labels
- Persistent map view, selected hunt, and layer visibility

## Requirements

- PHP 8.1+
- SQLite extensions for PHP: `pdo_sqlite` and `sqlite3`

## Configuration

On a fresh install, open the site in a browser and the installer will launch automatically if the app is not configured yet.

The installer:

- checks PHP and SQLite requirements
- asks for the app name, Mapbox public token, map style, and database path
- writes `config.php` with base defaults
- writes `config.local.php` with your Mapbox token

Once setup is complete, the installer route is locked and the application loads normally.

If you prefer manual setup, copy `config.php.example` to `config.php`, copy `config.local.php.example` to `config.local.php`, and add your Mapbox public access token to either file or set `MAPBOX_ACCESS_TOKEN` in your environment.

The app reads base defaults from `config.php` and local overrides from `config.local.php`.

## Run locally

```bash
php -S 127.0.0.1:8000 router.php
```

Open `http://127.0.0.1:8000` in the browser.

## Data storage

- SQLite database: `storage/treasure_hunts.sqlite`
- Core tables: `hunts`, `map_items`, `clues`, `clue_map_items`, `app_state`
- Legacy `features` rows are migrated into `map_items` automatically on startup
- Map state persistence includes center, zoom, bearing, pitch, selected hunt, and layer toggles
