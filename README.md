# Treasure Hunt Mapper

Treasure Hunt Mapper is a full-screen Mapbox and jQuery mapping tool with a PHP backend and SQLite persistence. It stores hunts, markers, polygons, radius indicators, and the last-used map camera state.

## Features

- Full-screen satellite mapping with Mapbox GL JS
- Hunt projects with persistent SQLite storage
- Markers, polygons, and radius rings with names, descriptions, colors, and metadata
- Search box with autocomplete powered by Mapbox Geocoding
- Distance measurement tool
- Compass reset behavior: first click resets north, second click resets tilt
- Layer toggles for roads, grid lines, and lat/lng labels
- Persistent map view, selected hunt, and layer visibility

## Requirements

- PHP 8.1+
- SQLite extensions for PHP: `pdo_sqlite` and `sqlite3`

## Configuration

1. Copy `config.php.example` to `config.php`.
2. Copy `config.local.php.example` to `config.local.php`.
3. Add your Mapbox public access token to either file, or set `MAPBOX_ACCESS_TOKEN` in your environment.

The app reads base defaults from `config.php` and local overrides from `config.local.php`.

## Run locally

```bash
php -S 127.0.0.1:8000 router.php
```

Open `http://127.0.0.1:8000` in the browser.

## Data storage

- SQLite database: `storage/treasure_hunts.sqlite`
- Map state persistence includes center, zoom, bearing, pitch, selected hunt, and layer toggles
