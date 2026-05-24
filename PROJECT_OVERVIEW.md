# PROJECT_OVERVIEW.md

# Elevated — Treasure Hunt Mapping Tool Project Overview

## Purpose

Elevated is a web-based treasure hunt mapping and reasoning tool.

The application allows a user to create a treasure hunt project, define a search area, add map markers and geographic areas, record clues, and organize the reasoning behind possible search locations.

The goal of this project is not to automatically solve a treasure hunt. The goal is to give the user a clean, structured, visual system for organizing locations, clues, confidence, and logic.

The core experience should feel simple:

> I have a hunt.  
> I can define the search area.  
> I can mark places on a map.  
> I can write clues.  
> I can link clues to places.  
> I can mark something as possible, likely, confirmed, or ruled out.  
> I can review my reasoning without the system becoming complicated.

This document exists so an AI agent, developer, or planner can understand the project goals, existing structure, future direction, coding standards, API expectations, security expectations, and UI/UX requirements before making changes.

---

## Repository

Repository:

```text
https://github.com/justingreerbbi/elevated
```

Primary stack:

```text
PHP
SQLite
HTML
CSS
JavaScript
jQuery
Mapbox GL JS
Mapbox Draw
Turf.js
```

This project should remain lightweight and easy to run in a local PHP environment.

Do not introduce a large framework unless explicitly approved.

Avoid React, Vue, Laravel, Symfony, Node build systems, or heavy dependency chains unless there is a strong architectural reason and explicit approval.

---

## Current Project Summary

The project currently includes:

- PHP-based application entry point.
- First-time installer.
- SQLite database initialization.
- Mapbox map rendering.
- Mapbox Draw support.
- Turf.js geometry helpers.
- Hunt creation and management.
- Hunt-level search area polygon.
- Feature creation for markers, polygons, and circles.
- Sidebar list of hunts and features.
- Map state persistence.
- Map style preferences.
- Layer toggles.
- Basic map drawing tools.
- Measurement tool.
- Modal-based editing.

The current system uses the term `features` for map objects.

The long-term preferred term is `map_items`.

---

## Current Architectural Concern

The current `features` model mixes visual map geometry with higher-level treasure-hunt reasoning.

A feature can currently be a marker, polygon, or circle, but future functionality needs clearer separation between:

- Map-visible objects.
- Clues.
- Evidence.
- Reasoning.
- Confidence/status.
- Relationships between clues and places.

The frontend JavaScript also contains several responsibilities in one large file, including:

- API calls.
- State management.
- Map initialization.
- Drawing tools.
- Layer controls.
- Sidebar rendering.
- Modals.
- Measurement.
- Search.
- Preferences.
- Map item editing.

This should be refactored into focused modules so the codebase remains maintainable.

---

## Product Philosophy

The application should help the user organize treasure-hunt thinking without forcing them into a rigid workflow.

### The map answers:

```text
Where?
```

### The clue system answers:

```text
Why?
```

### Status and confidence answer:

```text
How strong is this idea?
```

Do not build a complex investigation platform.

Do not build automatic solving logic.

Do not build a heavy scoring algorithm.

Do not make adding a clue slow.

Do not require too many fields.

Do not create a system where the user has to fill out a large form just to save an idea.

The base should be simple, fast, and stable.

---

## Primary Refactor Goal

Refactor the mapping system into a clean foundation where:

1. Hunts are top-level projects.
2. Map items are things drawn or displayed on the map.
3. Clues are reasoning records.
4. Clues may optionally link to map items.
5. Confidence is a simple manual value.
6. Status is a simple manual label.
7. The API is consistent and predictable.
8. The frontend map tools do not conflict.
9. Existing feature data is preserved or safely migrated.
10. The system remains easy to extend later.

---

## Core Domain Model

The recommended domain model is:

```text
Hunt
 ├── Search Area
 ├── Map Items
 │    ├── Markers
 │    ├── Polygons
 │    ├── Circles
 │    └── Lines
 ├── Clues
 └── Clue ↔ Map Item Relationships
```

---

# Data Model

## hunts

A hunt is the top-level project.

A hunt represents one treasure hunt, solve attempt, search area, or investigation project.

Recommended schema:

```sql
CREATE TABLE IF NOT EXISTS hunts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    search_area_json TEXT,
    default_center_json TEXT,
    default_zoom REAL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Field Notes

#### `name`

Human-readable hunt name.

Required.

#### `description`

General notes about the hunt.

Optional.

#### `search_area_json`

GeoJSON Polygon or MultiPolygon representing the overall search boundary.

This should be hunt-level data, not just another map item.

The user should be encouraged to define this early, but hunt creation should not be blocked if the user does not know the search area yet.

#### `default_center_json`

Optional map center for opening the hunt.

Recommended format:

```json
[-110.12345, 44.12345]
```

Mapbox uses longitude first, latitude second.

#### `default_zoom`

Optional default zoom level for the hunt.

---

## map_items

A map item is anything visible on the map.

Examples:

- Marker
- Search point
- Possible treasure location
- Polygon search zone
- Exclusion area
- Route
- Trail
- Sightline
- Radius circle
- Reference location

Recommended schema:

```sql
CREATE TABLE IF NOT EXISTS map_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hunt_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'reference',
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    geometry_json TEXT NOT NULL,
    style_json TEXT NOT NULL DEFAULT '{}',
    metadata_json TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'active',
    confidence INTEGER NOT NULL DEFAULT 50,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hunt_id) REFERENCES hunts(id) ON DELETE CASCADE
);
```

### Allowed Map Item Types

```text
marker
polygon
circle
line
```

### Type Meanings

#### `marker`

A single point on the map.

Expected GeoJSON type:

```text
Point
```

#### `polygon`

A closed area.

Expected GeoJSON type:

```text
Polygon
```

#### `circle`

A radius-based area.

The stored geometry may be a Polygon generated from a center and radius.

Metadata should preserve the original center and radius.

Recommended metadata:

```json
{
  "center": [-110.12345, 44.12345],
  "radius": 100,
  "radius_unit": "meters"
}
```

#### `line`

A path, route, bearing, river segment, trail, or sightline.

Expected GeoJSON type:

```text
LineString
```

---

## Map Item Categories

Allowed `category` values:

```text
candidate_location
landmark
evidence
search_area
route
reference
```

### Category Meanings

#### `candidate_location`

A possible treasure location or search target.

Example:

```text
Possible location for "the foot of three."
```

#### `landmark`

A named or visible place that may anchor clue interpretation.

#### `evidence`

A place tied to supporting evidence.

Example:

```text
Photo location, historical marker, sign, quote source, book reference location.
```

#### `search_area`

A map item used as a secondary or temporary search zone.

The primary hunt search area still belongs on the hunt itself.

#### `route`

A path, trail, road, river line, walk path, or travel direction.

#### `reference`

A neutral point of interest.

This is the default category.

Legacy `clue` and `exclusion` categories may exist in older data and should continue to load, but new records should use the categories above. Ruled-out logic belongs in status or clue relationships rather than a new exclusion category.

---

## Map Item Status

Allowed `status` values:

```text
active
possible
likely
ruled_out
confirmed
```

### Status Meanings

#### `active`

General active item.

#### `possible`

Could matter, but not enough confidence yet.

#### `likely`

Strong possibility.

#### `ruled_out`

The item has been checked, disproven, or deprioritized.

#### `confirmed`

The user believes the item is valid or confirmed.

---

## Confidence

Confidence is a manual integer value from 0 to 100.

Default:

```text
50
```

Meaning:

```text
0   = no confidence
50  = possible/default
100 = certain
```

Simple labels:

```text
Low: 0-39
Medium: 40-69
High: 70-100
```

Important rules:

- Do not calculate confidence automatically.
- Do not create weighted scoring yet.
- Do not create a confidence algorithm.
- Do not infer confidence from status.
- Do not force confidence to change when status changes.
- Keep confidence user-controlled.

---

## clues

A clue is a reasoning record.

A clue may or may not be linked to a map item.

Some clues are geographic. Some are text, wordplay, quotes, historical references, numbers, or research notes.

Recommended schema:

```sql
CREATE TABLE IF NOT EXISTS clues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hunt_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'other',
    source_title TEXT NOT NULL DEFAULT '',
    source_url TEXT NOT NULL DEFAULT '',
    source_date TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    interpretation TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open',
    confidence INTEGER NOT NULL DEFAULT 50,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hunt_id) REFERENCES hunts(id) ON DELETE CASCADE
);
```

### Clue Fields

#### `title`

Short name for the clue.

Required.

Examples:

```text
Foot of three
Cast your pole
Ancient gates
Bride's veil
```

#### `source_type`

Where the clue came from.

Allowed values:

```text
book_content
social_media
interview
website
other
```

#### `source_title`

Optional source title, such as a book, page, post, interview, or web page.

#### `source_url`

Optional HTTP/HTTPS source URL.

#### `source_date`

Optional publication, post, interview, or observation date.

#### `body`

Raw clue text, quote, note, or observation.

Optional.

#### `interpretation`

The user's current interpretation of what the clue might mean.

Optional.

#### `status`

Allowed values:

```text
open
possible
likely
ruled_out
confirmed
```

#### `confidence`

Manual 0-100 integer.

Default:

```text
50
```

---

## clue_map_items

This table links clues to map items.

Recommended schema:

```sql
CREATE TABLE IF NOT EXISTS clue_map_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clue_id INTEGER NOT NULL,
    map_item_id INTEGER NOT NULL,
    relationship_type TEXT NOT NULL DEFAULT 'supports',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clue_id) REFERENCES clues(id) ON DELETE CASCADE,
    FOREIGN KEY (map_item_id) REFERENCES map_items(id) ON DELETE CASCADE
);
```

Allowed `relationship_type` values:

```text
supports
contradicts
references
located_at
```

### Relationship Meanings

#### `supports`

The map item supports the clue interpretation.

#### `contradicts`

The map item works against or disproves the clue interpretation.

#### `references`

The clue references the map item, but the relationship is neutral.

#### `located_at`

The clue is directly located at the map item.

---

# Existing Feature Migration

The current project uses `features`.

The preferred new model is `map_items`.

Existing data must not be destroyed.

## Safe Migration Strategy

Preferred migration strategy:

1. Create a new `map_items` table.
2. Copy existing `features` rows into `map_items`.
3. Keep the old `features` table as a legacy backup.
4. Update the application to use `map_items`.
5. Optionally remove or archive `features` later after verification.

## Feature to Map Item Mapping

```text
features.id              -> map_items.id
features.hunt_id         -> map_items.hunt_id
features.type            -> map_items.type
features.name            -> map_items.name
features.description     -> map_items.description
features.color           -> map_items.style_json.color
features.geometry_json   -> map_items.geometry_json
features.metadata_json   -> map_items.metadata_json
```

Default values for migrated rows:

```text
category = reference
status = active
confidence = 50
```

Recommended `style_json` for migrated rows:

```json
{
  "color": "#ff6b35"
}
```

If a feature already has a color value, preserve that color.

---

# Backend API Design

The API should remain simple and PHP-based.

The current style of using `api.php?resource=...` may remain.

Do not introduce a routing framework unless explicitly approved.

## Standard API Response

All successful responses should use:

```json
{
  "ok": true,
  "data": {}
}
```

List responses should use:

```json
{
  "ok": true,
  "data": []
}
```

## Standard API Error

All errors should use:

```json
{
  "ok": false,
  "message": "Human-readable error message.",
  "details": {}
}
```

Do not return raw exceptions to the browser in production.

Developer mode may include exception messages only if explicitly configured.

---

## Recommended API Resources

### Bootstrap

```text
GET api.php?resource=bootstrap
```

Returns:

```text
config
hunts
mapItems
clues
clueMapItems
mapState
```

---

### Hunts

```text
GET    api.php?resource=hunts
POST   api.php?resource=hunts
PATCH  api.php?resource=hunts&id={id}
DELETE api.php?resource=hunts&id={id}
```

### Map Items

```text
GET    api.php?resource=map-items&hunt_id={hunt_id}
POST   api.php?resource=map-items
PATCH  api.php?resource=map-items&id={id}
DELETE api.php?resource=map-items&id={id}
```

### Clues

```text
GET    api.php?resource=clues&hunt_id={hunt_id}
POST   api.php?resource=clues
PATCH  api.php?resource=clues&id={id}
DELETE api.php?resource=clues&id={id}
```

### Clue Map Item Relationships

```text
GET    api.php?resource=clue-map-items&clue_id={clue_id}
POST   api.php?resource=clue-map-items
DELETE api.php?resource=clue-map-items&id={id}
```

### Map State

```text
POST api.php?resource=map-state
```

---

## API Compatibility

For a transitional period, the old resource may remain:

```text
features
```

However, new work should use:

```text
map-items
```

If keeping `features` temporarily, it should internally proxy to `map-items` or use shared repository logic.

Do not maintain two separate logic paths long-term.

---

# Backend Validation Rules

All backend input must be validated before saving.

## Hunt Validation

- `name` is required.
- `description` is optional.
- `search_area_json` may be null.
- If provided, `search_area_json` must be a valid GeoJSON Polygon or MultiPolygon.
- `default_center_json`, if provided, must be a two-value coordinate array.
- `default_zoom`, if provided, must be numeric.

## Map Item Validation

- `hunt_id` is required.
- `hunt_id` must reference an existing hunt.
- `type` is required.
- `type` must be one of the allowed values.
- `category` must be one of the allowed values.
- `status` must be one of the allowed values.
- `confidence` must be an integer from 0 to 100.
- `name` is required.
- `geometry_json` must be valid GeoJSON.
- GeoJSON geometry must match the selected type.
- `style_json` must be valid JSON.
- `metadata_json` must be valid JSON.

## Clue Validation

- `hunt_id` is required.
- `hunt_id` must reference an existing hunt.
- `title` is required.
- `body` is optional.
- `interpretation` is optional.
- `status` must be one of the allowed values.
- `confidence` must be an integer from 0 to 100.

## Relationship Validation

- `clue_id` is required.
- `clue_id` must reference an existing clue.
- `map_item_id` is required.
- `map_item_id` must reference an existing map item.
- The clue and map item should belong to the same hunt.
- `relationship_type` must be one of the allowed values.

---

# Frontend Architecture

The frontend should be refactored into smaller files.

Recommended structure:

```text
assets/js/app.js
assets/js/api.js
assets/js/state.js
assets/js/map.js
assets/js/map-layers.js
assets/js/draw-tools.js
assets/js/sidebar.js
assets/js/modals.js
assets/js/clues.js
assets/js/measure.js
assets/js/utils.js
```

Do not split the code so aggressively that it becomes hard to follow.

The goal is clean responsibility boundaries.

---

## app.js

Responsible for bootstrapping.

Responsibilities:

- Load bootstrap data.
- Initialize app state.
- Initialize the map.
- Register top-level events.
- Trigger initial render.
- Coordinate modules.

Should not contain large amounts of map drawing logic, modal rendering logic, or API internals.

---

## api.js

Responsible only for API communication.

Expected methods:

```js
api.getBootstrap()
api.listHunts()
api.createHunt(payload)
api.updateHunt(id, payload)
api.deleteHunt(id)

api.listMapItems(huntId)
api.createMapItem(payload)
api.updateMapItem(id, payload)
api.deleteMapItem(id)

api.listClues(huntId)
api.createClue(payload)
api.updateClue(id, payload)
api.deleteClue(id)

api.listClueMapItems(clueId)
api.createClueMapItem(payload)
api.deleteClueMapItem(id)

api.saveMapState(payload)
```

Rules:

- Keep fetch/ajax wrapper logic in one place.
- Normalize API errors.
- Do not manipulate DOM in API functions.
- Do not update global state inside API functions unless intentionally designed.

---

## state.js

Responsible for app state.

Recommended state shape:

```js
const state = {
  config: null,

  hunts: [],
  mapItems: [],
  clues: [],
  clueMapItems: [],

  activeHuntId: null,
  activeTool: 'browse',

  selectedMapItemId: null,
  selectedClueId: null,

  map: null,
  draw: null,
  mapLoaded: false,

  preferences: {
    units: 'imperial',
    mapStyle: null,
    terrain3d: true,
    contours: true,
    roads: true,
    grid: true,
    coordinates: true
  },

  transient: {
    pendingGeometry: null,
    measurementCoords: [],
    searchDebounce: null,
    saveStateDebounce: null
  }
};
```

Rules:

- Avoid storing jQuery DOM objects in app state.
- Avoid duplicate sources of truth.
- Keep persistent data separate from transient interaction data.
- Avoid updating state in multiple unrelated modules without clear intent.

---

## map.js

Responsible for Mapbox setup and core map behavior.

Responsibilities:

- Initialize Mapbox map.
- Register core map events.
- Load map sources.
- Render map items.
- Fit map to hunt area.
- Fit map to selected map item.
- Handle map click routing based on active tool.
- Provide helper methods to add/update/remove rendered map items.

Should not contain modal form logic.

---

## map-layers.js

Responsible for optional overlay layers.

Responsibilities:

- Terrain.
- Contours.
- Roads.
- Public land overlays.
- Grid.
- Coordinate labels.
- Hunt search area visibility.
- Layer toggle syncing.

Rules:

- Layer visibility should be controlled from a central method.
- Do not duplicate layer IDs in multiple modules.
- Layer addition should be safe if called after style reload.
- Handle Mapbox style changes cleanly.

---

## draw-tools.js

Responsible for drawing and active tools.

Allowed tools:

```text
browse
marker
polygon
circle
line
measure
```

Rules:

- Only one active tool at a time.
- Switching tools cancels unfinished drawings.
- Temporary geometry should not be saved automatically.
- Drawing a map item should open a save/edit modal before persistence.
- Measurement is temporary unless the user explicitly saves it as a line.
- Escape key should cancel the current tool if practical.
- Browse/select mode should be the safe default.

---

## sidebar.js

Responsible for sidebar lists.

Sidebar should include:

- Hunts.
- Map Items.
- Clues.
- Simple summary for the active hunt.

Do not create too many nested panels.

Recommended active hunt summary:

```text
Total map items
Total clues
Likely clues
Confirmed clues
Ruled out clues
Average clue confidence
```

Average clue confidence should be a simple average.

Do not use weighted scoring.

---

## modals.js

Responsible for modal forms.

Forms:

- Hunt form.
- Map item form.
- Clue form.
- Link clue to map item form.

Rules:

- Keep forms short.
- Use clear labels.
- Do not require advanced fields.
- Provide cancel buttons.
- Avoid ambiguous save behavior.
- Validate before submit.
- Show backend validation errors clearly.

---

## clues.js

Responsible for clue UI and clue-to-map-item linking.

Rules:

- A clue can exist without a map item.
- A clue can link to multiple map items.
- A map item can link to multiple clues.
- Do not build an advanced graph yet.
- Do not build automatic solve suggestions yet.
- Do not force all clue records to have a location.

---

## measure.js

Responsible for measurement-only interactions.

Rules:

- Measurement should be temporary.
- User should be able to clear measurement.
- User may optionally convert measurement to a saved line.
- Measurement should not conflict with drawing tools.

---

## utils.js

Shared helpers.

Examples:

```js
escapeHtml()
formatDistance()
formatArea()
clamp()
isValidCoordinate()
debounce()
deepClone()
normalizeConfidence()
confidenceLabel()
statusLabel()
```

---

# Map Tool Requirements

Required tools:

1. Browse/select.
2. Add marker.
3. Draw polygon/area.
4. Draw radius/circle.
5. Draw line/path.
6. Measure distance.
7. Toggle layers.
8. Search location.
9. Fit to hunt area.
10. Fit to selected item.

Optional tools:

1. Duplicate map item.
2. Convert measurement to saved line.
3. Export GeoJSON.
4. Import GeoJSON.
5. Hide/show map item categories.
6. Hide/show ruled-out items.

Avoid for now:

- Advanced clue graph.
- AI solve recommendations.
- Automatic score calculations.
- Multi-user collaboration.
- Timeline engine.
- Version history.
- Heavy evidence database.
- Offline map caching.
- Complex report generator.

---

# UI/UX Guidance

The interface should feel like a polished mapping and reasoning workspace.

It should be:

- Clean.
- Modern.
- Fast.
- Focused.
- Simple.
- Professional.
- Easy to understand.
- Usable outdoors or while traveling.
- Comfortable on desktop.
- Reasonably usable on tablet.
- Not cluttered.

## Visual Style

Preferred style direction:

```text
Modern field-mapping tool
Dark or neutral theme
Soft panels
Clear map-first layout
Minimal but useful controls
Strong contrast
Subtle shadows
Rounded corners
Professional typography
```

The map should remain the focus.

Panels should help the user organize information without covering too much of the map.

## Layout

Recommended layout:

```text
Left sidebar: hunts, map items, clues
Main area: map
Floating top search bar
Floating right/bottom tool rail
Slide-over or modal forms
Small status/toast messages
```

## Color Guidance

Use color intentionally.

Suggested meanings:

```text
Reference: neutral gray/blue
Clue: amber/orange
Evidence: purple
Route: blue
Search Area: green
Exclusion/Ruled Out: red
Confirmed: green
Likely: amber
Possible: blue
```

Do not rely on color alone.

Use labels, icons, or text where needed for accessibility.

## Accessibility

Follow basic accessibility best practices:

- Buttons must have accessible names.
- Icons-only buttons need `aria-label`.
- Form fields need labels.
- Modals should use reasonable focus behavior.
- Text contrast should be readable.
- Do not use tiny text for important controls.
- Keyboard escape should close/cancel where practical.
- Avoid hover-only controls.
- Do not rely only on color to communicate status.

---

# Clue and Confidence UX

The clue system must remain simple.

## Clue Form

Recommended fields:

```text
Title
Body / Raw clue text
Interpretation
Status
Confidence
Linked map items
```

Only title should be required.

## Confidence Input

Use a simple slider or number input.

Labels:

```text
Low
Medium
High
```

Ranges:

```text
Low: 0-39
Medium: 40-69
High: 70-100
```

Default:

```text
50
```

## Status Input

Use a select field.

Allowed statuses:

```text
Open
Possible
Likely
Ruled Out
Confirmed
```

## Important UX Rule

Do not make users fill out many fields just to save a clue.

Saving a quick clue should be fast.

---

# Security Standards

Security matters even if this is a local or small project.

The project should follow secure coding practices and avoid obvious mistakes.

## General Security Principles

- Treat all user input as untrusted.
- Validate on the backend.
- Escape output in HTML.
- Use prepared statements for SQL.
- Do not expose raw exception traces in production.
- Do not store secrets in public files.
- Do not commit local config containing private tokens.
- Keep API responses predictable.
- Keep install/config behavior protected.
- Do not allow arbitrary file writes from request input.
- Do not allow path traversal.
- Do not trust client-side validation.

---

## PHP Security

Required practices:

- Use `declare(strict_types=1);`.
- Use PDO prepared statements.
- Keep `PDO::ATTR_ERRMODE` set to exceptions.
- Enable SQLite foreign keys.
- Validate request method before processing.
- Validate resource names.
- Validate record IDs as positive integers.
- Validate JSON payloads.
- Validate enum values.
- Escape HTML output with `htmlspecialchars`.
- Avoid echoing raw user input.
- Avoid dynamic includes based on request input.
- Avoid writing files to user-controlled paths.
- Return safe error messages.

Example output escaping:

```php
htmlspecialchars($value, ENT_QUOTES, 'UTF-8')
```

Example positive integer validation:

```php
$id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);

if (!$id || $id < 1) {
    json_error('A valid id is required.', 422);
}
```

---

## SQL Security

Rules:

- Use prepared statements for all variable input.
- Do not concatenate user input into SQL.
- Use foreign keys with cascading deletes where appropriate.
- Add indexes for common filters.
- Keep migrations safe and repeatable.
- Preserve existing data during schema changes.

Recommended indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_map_items_hunt_id ON map_items(hunt_id);
CREATE INDEX IF NOT EXISTS idx_map_items_type ON map_items(type);
CREATE INDEX IF NOT EXISTS idx_map_items_category ON map_items(category);
CREATE INDEX IF NOT EXISTS idx_map_items_status ON map_items(status);

CREATE INDEX IF NOT EXISTS idx_clues_hunt_id ON clues(hunt_id);
CREATE INDEX IF NOT EXISTS idx_clues_status ON clues(status);

CREATE INDEX IF NOT EXISTS idx_clue_map_items_clue_id ON clue_map_items(clue_id);
CREATE INDEX IF NOT EXISTS idx_clue_map_items_map_item_id ON clue_map_items(map_item_id);
```

---

## JavaScript Security

Rules:

- Do not insert untrusted text with `.html()`.
- Use `.text()` for user-controlled strings.
- If HTML is necessary, escape first.
- Validate payloads before sending.
- Do not expose private tokens.
- Do not store secrets in localStorage.
- Keep Mapbox public token as public-only.
- Handle API errors without dumping raw server output into the DOM.
- Avoid inline event handlers where practical.

Example:

```js
$element.text(userProvidedValue);
```

Avoid:

```js
$element.html(userProvidedValue);
```

Unless the value is safely escaped first.

---

## Config and Secrets

The Mapbox public token can be used client-side, but private tokens must never be exposed.

Rules:

- `config.local.php` should not be committed if it contains secrets.
- Use `.gitignore` for local config.
- Keep installer locked after setup.
- Do not show full local filesystem paths in public errors unless in development mode.
- Do not allow the browser to modify config paths.

---

## CSRF and Auth Note

If this app remains single-user/local-only, full authentication may not be required immediately.

However, if deployed publicly, the following must be added before real use:

- Authentication.
- Session management.
- CSRF tokens for state-changing requests.
- Authorization checks per hunt.
- Rate limiting.
- Production error handling.
- HTTPS-only deployment.

Do not assume local-only forever.

Design APIs so auth can be added later.

---

# Coding Standards

## General Standards

- Keep code readable.
- Prefer simple functions with clear names.
- Avoid clever abstractions.
- Avoid duplicated logic.
- Validate early.
- Return predictable data structures.
- Keep UI labels consistent.
- Keep terminology consistent.

Preferred terminology:

```text
Hunt
Search Area
Map Item
Clue
Confidence
Status
Relationship
```

Avoid mixing terms like:

```text
Feature
Marker
Map Object
Thing
Point
```

Use `map_item` for persisted map objects.

---

## PHP Standards

Follow these rules:

- Use strict types.
- Use final classes where inheritance is not needed.
- Prefer typed method parameters and return types.
- Keep repository/database logic separate from request routing.
- Keep route handling thin.
- Keep validation close to repository methods or in dedicated validators.
- Throw `InvalidArgumentException` for validation errors.
- Throw `RuntimeException` for not-found or system errors.
- Do not silently ignore invalid input.

Recommended file organization:

```text
src/Database.php
src/Installation.php
src/TreasureHuntRepository.php
src/Validators.php
src/JsonResponse.php
```

If the repository becomes too large, split it:

```text
src/Repositories/HuntRepository.php
src/Repositories/MapItemRepository.php
src/Repositories/ClueRepository.php
```

Do not split prematurely if it makes the project harder to follow.

---

## JavaScript Standards

The project currently uses plain JavaScript and jQuery.

Continue using that unless explicitly approved otherwise.

Rules:

- Use `const` and `let`, not `var`.
- Use strict mode.
- Keep modules focused.
- Avoid large global objects except one intentional app namespace/state.
- Avoid duplicate event binding.
- Name functions by what they do.
- Separate rendering from data fetching.
- Separate drawing logic from form submission.
- Avoid deeply nested callbacks.
- Prefer small helper functions.
- Normalize API errors in one place.

Recommended module pattern if not using ES modules:

```js
window.Elevated = window.Elevated || {};
window.Elevated.api = {};
window.Elevated.state = {};
window.Elevated.map = {};
```

If using ES modules, update script loading intentionally and ensure the local environment supports it.

---

## CSS Standards

Rules:

- Keep class names descriptive.
- Avoid over-specific selectors.
- Avoid inline styles.
- Use CSS variables for theme values.
- Keep spacing consistent.
- Use responsive layout rules.
- Avoid hard-coded colors repeated everywhere.
- Keep map controls readable over satellite imagery.

Recommended CSS variable structure:

```css
:root {
  --color-bg: #0f172a;
  --color-panel: rgba(15, 23, 42, 0.92);
  --color-panel-border: rgba(148, 163, 184, 0.24);
  --color-text: #e5e7eb;
  --color-muted: #94a3b8;
  --color-accent: #f97316;
  --color-danger: #ef4444;
  --color-success: #22c55e;
  --radius-panel: 18px;
  --shadow-panel: 0 18px 60px rgba(0, 0, 0, 0.35);
}
```

---

# API Implementation Guidance

The API should stay easy to work with.

## Request Handling

`api.php` should:

1. Load installation/bootstrap.
2. Validate app is installed.
3. Determine request method.
4. Determine resource.
5. Route to the correct handler.
6. Return JSON response.
7. Catch validation/system errors.
8. Return safe errors.

Avoid placing large business logic inside `api.php`.

---

## Repository Guidance

Repository methods should return normalized arrays ready for JSON.

Example methods:

```php
listHunts(): array
createHunt(array $input): array
updateHunt(int $huntId, array $input): array
deleteHunt(int $huntId): void

listMapItems(?int $huntId = null): array
createMapItem(array $input): array
updateMapItem(int $mapItemId, array $input): array
deleteMapItem(int $mapItemId): void

listClues(?int $huntId = null): array
createClue(array $input): array
updateClue(int $clueId, array $input): array
deleteClue(int $clueId): void
```

Hydration methods should decode JSON fields.

Normalization methods should validate and encode JSON fields.

---

# Geometry Standards

Use GeoJSON consistently.

Coordinate order:

```text
longitude, latitude
```

Not:

```text
latitude, longitude
```

## Marker

```json
{
  "type": "Point",
  "coordinates": [-110.12345, 44.12345]
}
```

## Polygon

```json
{
  "type": "Polygon",
  "coordinates": [
    [
      [-110.1, 44.1],
      [-110.2, 44.1],
      [-110.2, 44.2],
      [-110.1, 44.2],
      [-110.1, 44.1]
    ]
  ]
}
```

## Line

```json
{
  "type": "LineString",
  "coordinates": [
    [-110.1, 44.1],
    [-110.2, 44.2]
  ]
}
```

## Circle

Store as generated polygon geometry.

Preserve original circle info in metadata:

```json
{
  "center": [-110.12345, 44.12345],
  "radius": 100,
  "radius_unit": "meters"
}
```

---

# Map Behavior Standards

## Active Tool Rules

Only one active tool may be enabled at a time.

When switching tools:

- Cancel unfinished drawings.
- Clear temporary markers if needed.
- Hide irrelevant temporary UI.
- Update the active tool badge.
- Return to browse after save/cancel unless there is a reason not to.

## Save Rules

Do not auto-save unfinished geometry.

The user should confirm the name/category/status/confidence before saving a drawn map item.

## Delete Rules

Deletion should be explicit.

If deleting a hunt, warn that associated map items, clues, and relationships will be deleted.

If deleting a map item, also remove clue-map-item relationships.

If deleting a clue, also remove clue-map-item relationships.

## Selection Rules

Clicking a map item should:

- Select the item.
- Open a detail panel or modal.
- Show related clues if available.
- Provide edit/delete actions.

Clicking empty map space in browse mode should not create data.

---

# Hunt Summary Panel

Each active hunt should have a lightweight summary.

Recommended values:

```text
Total map items
Total clues
Possible clues
Likely clues
Confirmed clues
Ruled out clues
Average clue confidence
```

Average confidence:

```text
sum(clue.confidence) / total clues
```

If there are no clues:

```text
No clue confidence yet.
```

Do not use weighted scoring.

Do not imply the app knows whether the solve is correct.

---

# Development Phases

## Phase 1 — Backend Foundation

Goals:

- Add `map_items`.
- Add `clues`.
- Add `clue_map_items`.
- Preserve existing `features`.
- Add migration from features to map_items.
- Add repository methods.
- Add API resources.
- Keep old feature API temporarily if needed.

Acceptance:

- Existing hunts still load.
- Existing features appear as map items.
- New map item API works.
- New clue API works.
- Data is not lost.

---

## Phase 2 — Frontend Modular Refactor

Goals:

- Split large frontend file into focused modules.
- Keep current behavior working.
- Move API calls into `api.js`.
- Move app state into `state.js`.
- Move map logic into `map.js`.
- Move draw behavior into `draw-tools.js`.
- Move sidebar rendering into `sidebar.js`.
- Move modal logic into `modals.js`.

Acceptance:

- No behavior regression.
- Map loads.
- Hunts load.
- Map items load.
- Drawing still works.
- Editing still works.
- Deleting still works.

---

## Phase 3 — Map Item Upgrade

Goals:

- Rename visible UI from "Features" to "Map Items."
- Add category.
- Add status.
- Add confidence.
- Add line/path support.
- Keep marker/polygon/circle support.
- Make measurement temporary unless saved as line.

Acceptance:

- User can create all map item types.
- User can edit category/status/confidence.
- User can save a line/path.
- User can measure without accidentally saving data.

---

## Phase 4 — Simple Clue System

Goals:

- Add clue list.
- Add clue form.
- Add clue editing.
- Add clue deletion.
- Add clue-to-map-item linking.
- Show related clues on selected map items.
- Show related map items on selected clues.

Acceptance:

- User can create a clue quickly.
- User can save title only.
- User can optionally add body and interpretation.
- User can set status and confidence.
- User can link clue to map item.
- Clues are not required to have a map location.

---

## Phase 5 — Summary and Cleanup

Goals:

- Add active hunt summary.
- Add average clue confidence.
- Add basic counts.
- Clean up naming.
- Remove duplicate logic.
- Add validation polish.
- Improve error messages.
- Improve empty states.

Acceptance:

- Active hunt summary works.
- Empty states are clear.
- Errors are human-readable.
- No duplicate state source exists.
- No old "feature" terminology remains in user-facing UI unless needed for migration comments.

---

# Testing Checklist

## Installer

- Fresh install works.
- Existing install remains locked.
- Config files are created correctly.
- Missing requirements are shown clearly.
- Mapbox token is saved only where intended.

## Hunts

- Create hunt.
- Create hunt without search area.
- Edit hunt.
- Add search area.
- Edit search area.
- Delete hunt.
- Deleting hunt cascades related data.

## Map Items

- Create marker.
- Create polygon.
- Create circle.
- Create line.
- Edit map item.
- Delete map item.
- Set category.
- Set status.
- Set confidence.
- Invalid geometry is rejected.
- Invalid confidence is rejected.
- Invalid status is rejected.
- Invalid category is rejected.

## Clues

- Create clue with title only.
- Create clue with full fields.
- Edit clue.
- Delete clue.
- Set clue status.
- Set clue confidence.
- Link clue to map item.
- Remove clue-map-item link.
- Prevent linking records from different hunts.

## Map

- Map loads.
- Layers toggle correctly.
- Style changes do not break custom layers.
- Search works.
- Fit to hunt area works.
- Fit to map item works.
- Draw tools do not conflict.
- Measurement does not auto-save.
- Clear measurement works.

## API

- All resources return consistent JSON.
- Invalid method returns 405.
- Invalid resource returns 404.
- Invalid input returns 422.
- Unexpected errors return safe 500 response.
- No raw traces in production response.

## Security

- HTML output is escaped.
- SQL uses prepared statements.
- JSON input is validated.
- IDs are validated.
- Enum values are validated.
- Local config is not exposed.
- Installer is locked after install.

---

# Future Features Not in Current Scope

These features may be useful later but should not be implemented during the base refactor unless explicitly requested:

- AI clue interpretation.
- Automatic confidence scoring.
- Weighted clue scoring.
- Evidence database with files/images.
- Report builder.
- Timeline mode.
- Collaboration.
- User accounts.
- Public sharing.
- Offline maps.
- Mobile app.
- GPX import/export.
- KML import/export.
- Advanced GIS analysis.
- Heatmaps.
- Search-grid generation.
- Route optimization.
- Version history.

---

# Definition of Done

The mapping refactor is considered successful when:

1. The application still works after migration.
2. Existing data is preserved.
3. The map item model replaces the old feature concept.
4. The clue system exists but remains simple.
5. Confidence is manual.
6. Status is manual.
7. The frontend code is modular enough to maintain.
8. Map tools do not conflict.
9. API resources are consistent.
10. Validation is strong.
11. Errors are clear.
12. UI terminology is consistent.
13. The app has a stable foundation for future treasure-hunting features.

---

# Final Guidance for AI Agents

When working on this project:

- Prefer simple over clever.
- Preserve data.
- Avoid overengineering.
- Keep the map central.
- Keep clues lightweight.
- Keep confidence manual.
- Keep APIs predictable.
- Keep UI forms short.
- Keep frontend modules focused.
- Keep security practices in place.
- Do not introduce heavy dependencies without approval.
- Do not build an automatic solver.
- Do not make the system harder to use in the name of structure.

The best version of this app is a clean, fast, map-first workspace that helps a treasure hunter organize locations, clues, and reasoning without getting in the way.
