# Treasure Hunt Mapper

Treasure Hunt Mapper is a full-screen Mapbox and jQuery mapping tool with a PHP backend and SQLite persistence. It stores hunts, map items (points, circles, polygons, lines), clue records, clue-to-map-item links, and the last-used map camera state.

## Features

- Full-screen satellite mapping with Mapbox GL JS
- Hunt projects with persistent SQLite storage
- Geographic map items with names, descriptions, color, confidence, category, and status metadata
- Geometry tools for points, circles, polygons, and lines
- Clue records tuned for modern treasure hunts, with source types for book content, social media, interviews, websites, and other research
- Clue-to-map-item links that connect source evidence to candidate locations, landmarks, routes, search areas, references, and evidence
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

## Treasure hunt data model

Clues are source-based research records. A clue can be saved with only a title, then enriched with:

- `source_type`: `book_content`, `social_media`, `interview`, `website`, or `other`
- `source_title`: page, post, interview, book, or web page title
- `source_url`: optional HTTP/HTTPS source URL
- `source_date`: publication, post, interview, or observation date
- `body`, `interpretation`, `status`, and `confidence`

Map items remain geographic records. New map item categories are `candidate_location`, `landmark`, `search_area`, `route`, `reference`, and `evidence`. Existing legacy `clue` or `exclusion` categories continue to load for compatibility, but new records should use the modern geographic categories.

## API contract

The app uses a same-origin JSON API at `api.php?resource=...`. Responses use:

```json
{ "ok": true, "data": {} }
```

Errors use:

```json
{ "ok": false, "message": "Validation message", "details": [] }
```

Stable resources:

- `GET api.php?resource=bootstrap`
- `GET|POST api.php?resource=hunts`
- `PATCH|DELETE api.php?resource=hunts&id={id}`
- `GET|POST api.php?resource=map-items`
- `PATCH|DELETE api.php?resource=map-items&id={id}`
- `GET|POST api.php?resource=clues`
- `PATCH|DELETE api.php?resource=clues&id={id}`
- `GET|POST api.php?resource=clue-map-items`
- `DELETE api.php?resource=clue-map-items&id={id}`
- `POST api.php?resource=map-state`
- `GET|PATCH api.php?resource=reasoning-settings&hunt_id={hunt_id}`

The legacy `features` resource remains as an adapter to `map-items`.
