<?php

declare(strict_types=1);

final class TreasureHuntRepository
{
    private const DEFAULT_REASONING_SETTINGS = [
        'cell_side_km' => 10.0,
        'repeat_decay' => 0.65,
        'category_caps' => [
            'text' => 8.0,
            'terrain' => 8.0,
            'negative' => 0.25,
        ],
        'negative_floor' => 0.25,
    ];

    private const MAP_ITEM_TYPES = ['marker', 'polygon', 'circle', 'line'];
    private const MAP_ITEM_CATEGORIES = ['candidate_location', 'landmark', 'search_area', 'route', 'reference', 'evidence'];
    private const LEGACY_MAP_ITEM_CATEGORIES = ['clue', 'exclusion'];
    private const MAP_ITEM_STATUSES = ['active', 'possible', 'likely', 'ruled_out', 'confirmed'];
    private const CLUE_SOURCE_TYPES = ['book_content', 'social_media', 'interview', 'website', 'other'];
    private const CLUE_STATUSES = ['open', 'possible', 'likely', 'ruled_out', 'confirmed'];
    private const CLUE_MAP_ITEM_RELATIONSHIP_TYPES = ['supports', 'contradicts', 'references', 'located_at'];

    public function __construct(private readonly PDO $pdo)
    {
    }

    public function bootstrap(array $config): array
    {
        return [
            'config' => [
                'appName' => $config['app_name'],
                'mapboxToken' => $config['mapbox_token'],
                'mapStyle' => $config['map_style'],
                'defaultCenter' => $config['default_center'],
                'defaultZoom' => $config['default_zoom'],
                'defaultPitch' => $config['default_pitch'],
                'defaultBearing' => $config['default_bearing'],
            ],
            'hunts' => $this->listHunts(),
            'mapItems' => $this->listMapItems(),
            'clues' => $this->listClues(),
            'clueMapItems' => $this->listClueMapItems(),
            // Backward compatibility for legacy frontend paths.
            'features' => $this->listFeatures(),
            'mapState' => $this->loadMapState(),
        ];
    }

    public function listHunts(): array
    {
        $statement = $this->pdo->query(
            'SELECT id, name, description, search_area_json, created_at, updated_at
             FROM hunts
             ORDER BY updated_at DESC, id DESC'
        );

        return array_map([$this, 'hydrateHunt'], $statement->fetchAll() ?: []);
    }

    public function createHunt(array $input): array
    {
        $name = trim((string) ($input['name'] ?? ''));
        $description = trim((string) ($input['description'] ?? ''));
        $searchArea = $this->normalizeSearchArea($input['search_area'] ?? null);

        if ($name === '') {
            throw new InvalidArgumentException('Hunt name is required.');
        }

        $statement = $this->pdo->prepare(
            'INSERT INTO hunts (name, description, search_area_json, created_at, updated_at)
             VALUES (:name, :description, :search_area_json, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
        );
        $statement->execute([
            ':name' => $name,
            ':description' => $description,
            ':search_area_json' => $searchArea === null ? '' : json_encode($searchArea, JSON_THROW_ON_ERROR),
        ]);

        return $this->findHunt((int) $this->pdo->lastInsertId());
    }

    public function updateHunt(int $huntId, array $input): array
    {
        $hunt = $this->findHunt($huntId);
        $name = trim((string) ($input['name'] ?? $hunt['name']));
        $description = trim((string) ($input['description'] ?? $hunt['description']));
        $searchArea = array_key_exists('search_area', $input)
            ? $this->normalizeSearchArea($input['search_area'])
            : $hunt['search_area'];

        if ($name === '') {
            throw new InvalidArgumentException('Hunt name is required.');
        }

        $statement = $this->pdo->prepare(
            'UPDATE hunts
             SET name = :name,
                 description = :description,
                 search_area_json = :search_area_json,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = :id'
        );
        $statement->execute([
            ':id' => $huntId,
            ':name' => $name,
            ':description' => $description,
            ':search_area_json' => $searchArea === null ? '' : json_encode($searchArea, JSON_THROW_ON_ERROR),
        ]);

        return $this->findHunt($huntId);
    }

    public function deleteHunt(int $huntId): void
    {
        $this->findHunt($huntId);

        $statement = $this->pdo->prepare('DELETE FROM hunts WHERE id = :id');
        $statement->execute([':id' => $huntId]);
    }

    public function listMapItems(?int $huntId = null): array
    {
        if ($huntId !== null) {
            $statement = $this->pdo->prepare(
                'SELECT *
                 FROM map_items
                 WHERE hunt_id = :hunt_id
                 ORDER BY updated_at DESC, id DESC'
            );
            $statement->execute([':hunt_id' => $huntId]);
        } else {
            $statement = $this->pdo->query(
                'SELECT *
                 FROM map_items
                 ORDER BY updated_at DESC, id DESC'
            );
        }

        return array_map([$this, 'hydrateMapItem'], $statement->fetchAll() ?: []);
    }

    public function createMapItem(array $input): array
    {
        $payload = $this->normalizeMapItemPayload($input);

        $statement = $this->pdo->prepare(
            'INSERT INTO map_items (
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
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
             )'
        );
        $statement->execute($payload);

        return $this->findMapItem((int) $this->pdo->lastInsertId());
    }

    public function updateMapItem(int $mapItemId, array $input): array
    {
        $mapItem = $this->findMapItem($mapItemId);
        $merged = array_merge($mapItem, $input);
        $merged['geometry'] = $input['geometry'] ?? $mapItem['geometry'];
        $merged['style'] = $input['style'] ?? $mapItem['style'];
        $merged['metadata'] = $input['metadata'] ?? $mapItem['metadata'];
        $payload = $this->normalizeMapItemPayload($merged);
        $payload[':id'] = $mapItemId;

        $statement = $this->pdo->prepare(
            'UPDATE map_items
             SET hunt_id = :hunt_id,
                 type = :type,
                 category = :category,
                 name = :name,
                 description = :description,
                 geometry_json = :geometry_json,
                 style_json = :style_json,
                 metadata_json = :metadata_json,
                 status = :status,
                 confidence = :confidence,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = :id'
        );
        $statement->execute($payload);

        return $this->findMapItem($mapItemId);
    }

    public function deleteMapItem(int $mapItemId): void
    {
        $this->findMapItem($mapItemId);

        $statement = $this->pdo->prepare('DELETE FROM map_items WHERE id = :id');
        $statement->execute([':id' => $mapItemId]);
    }

    public function listClues(?int $huntId = null): array
    {
        if ($huntId !== null) {
            $statement = $this->pdo->prepare(
                'SELECT *
                 FROM clues
                 WHERE hunt_id = :hunt_id
                 ORDER BY updated_at DESC, id DESC'
            );
            $statement->execute([':hunt_id' => $huntId]);
        } else {
            $statement = $this->pdo->query(
                'SELECT *
                 FROM clues
                 ORDER BY updated_at DESC, id DESC'
            );
        }

        return array_map([$this, 'hydrateClue'], $statement->fetchAll() ?: []);
    }

    public function createClue(array $input): array
    {
        $payload = $this->normalizeCluePayload($input);

        $statement = $this->pdo->prepare(
            'INSERT INTO clues (
                hunt_id,
                title,
                source_type,
                source_title,
                source_url,
                source_date,
                body,
                interpretation,
                status,
                confidence,
                created_at,
                updated_at
             ) VALUES (
                :hunt_id,
                :title,
                :source_type,
                :source_title,
                :source_url,
                :source_date,
                :body,
                :interpretation,
                :status,
                :confidence,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
             )'
        );
        $statement->execute($payload);

        return $this->findClue((int) $this->pdo->lastInsertId());
    }

    public function updateClue(int $clueId, array $input): array
    {
        $clue = $this->findClue($clueId);
        $payload = $this->normalizeCluePayload(array_merge($clue, $input));
        $payload[':id'] = $clueId;

        $statement = $this->pdo->prepare(
            'UPDATE clues
             SET hunt_id = :hunt_id,
                 title = :title,
                 source_type = :source_type,
                 source_title = :source_title,
                 source_url = :source_url,
                 source_date = :source_date,
                 body = :body,
                 interpretation = :interpretation,
                 status = :status,
                 confidence = :confidence,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = :id'
        );
        $statement->execute($payload);

        return $this->findClue($clueId);
    }

    public function deleteClue(int $clueId): void
    {
        $this->findClue($clueId);

        $statement = $this->pdo->prepare('DELETE FROM clues WHERE id = :id');
        $statement->execute([':id' => $clueId]);
    }

    public function listClueMapItems(?int $clueId = null, ?int $mapItemId = null): array
    {
        $conditions = [];
        $params = [];

        if ($clueId !== null) {
            $conditions[] = 'clue_id = :clue_id';
            $params[':clue_id'] = $clueId;
        }
        if ($mapItemId !== null) {
            $conditions[] = 'map_item_id = :map_item_id';
            $params[':map_item_id'] = $mapItemId;
        }

        $sql = 'SELECT * FROM clue_map_items';
        if ($conditions !== []) {
            $sql .= ' WHERE ' . implode(' AND ', $conditions);
        }
        $sql .= ' ORDER BY id DESC';

        $statement = $this->pdo->prepare($sql);
        $statement->execute($params);

        return $statement->fetchAll() ?: [];
    }

    public function createClueMapItem(array $input): array
    {
        $payload = $this->normalizeClueMapItemPayload($input);

        $existing = $this->pdo->prepare(
            'SELECT id FROM clue_map_items WHERE clue_id = :clue_id AND map_item_id = :map_item_id AND relationship_type = :relationship_type'
        );
        $existing->execute($payload);
        if ($existing->fetch()) {
            throw new InvalidArgumentException('This clue-map-item relationship already exists.');
        }

        $statement = $this->pdo->prepare(
            'INSERT INTO clue_map_items (
                clue_id,
                map_item_id,
                relationship_type,
                created_at
             ) VALUES (
                :clue_id,
                :map_item_id,
                :relationship_type,
                CURRENT_TIMESTAMP
             )'
        );
        $statement->execute($payload);

        return $this->findClueMapItem((int) $this->pdo->lastInsertId());
    }

    public function deleteClueMapItem(int $id): void
    {
        $this->findClueMapItem($id);
        $statement = $this->pdo->prepare('DELETE FROM clue_map_items WHERE id = :id');
        $statement->execute([':id' => $id]);
    }

    // Legacy compatibility adapters.
    public function listFeatures(?int $huntId = null): array
    {
        return array_map(fn(array $item): array => $this->mapItemToFeature($item), $this->listMapItems($huntId));
    }

    public function createFeature(array $input): array
    {
        return $this->mapItemToFeature($this->createMapItem($this->featurePayloadToMapItemPayload($input)));
    }

    public function updateFeature(int $featureId, array $input): array
    {
        return $this->mapItemToFeature($this->updateMapItem($featureId, $this->featurePayloadToMapItemPayload($input)));
    }

    public function deleteFeature(int $featureId): void
    {
        $this->deleteMapItem($featureId);
    }

    public function saveMapState(array $state): array
    {
        $statement = $this->pdo->prepare(
            'UPDATE app_state
             SET map_state_json = :map_state_json,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = 1'
        );
        $statement->execute([
            ':map_state_json' => json_encode($state, JSON_THROW_ON_ERROR),
        ]);

        return $this->loadMapState();
    }

    public function getReasoningSettings(int $huntId): array
    {
        $this->findHunt($huntId);

        $statement = $this->pdo->prepare(
            'SELECT hunt_id, cell_side_km, repeat_decay, category_caps_json, negative_floor, updated_at
             FROM reasoning_settings
             WHERE hunt_id = :hunt_id'
        );
        $statement->execute([':hunt_id' => $huntId]);
        $settings = $statement->fetch();

        if (!$settings) {
            return $this->defaultReasoningSettings($huntId);
        }

        return $this->hydrateReasoningSettings($settings);
    }

    public function saveReasoningSettings(int $huntId, array $input): array
    {
        $this->findHunt($huntId);
        $normalized = $this->normalizeReasoningSettings($huntId, $input);

        $statement = $this->pdo->prepare(
            'INSERT INTO reasoning_settings (
                hunt_id,
                cell_side_km,
                repeat_decay,
                category_caps_json,
                negative_floor,
                updated_at
             ) VALUES (
                :hunt_id,
                :cell_side_km,
                :repeat_decay,
                :category_caps_json,
                :negative_floor,
                CURRENT_TIMESTAMP
             )
             ON CONFLICT(hunt_id) DO UPDATE SET
                cell_side_km = excluded.cell_side_km,
                repeat_decay = excluded.repeat_decay,
                category_caps_json = excluded.category_caps_json,
                negative_floor = excluded.negative_floor,
                updated_at = CURRENT_TIMESTAMP'
        );
        $statement->execute([
            ':hunt_id' => $huntId,
            ':cell_side_km' => $normalized['cell_side_km'],
            ':repeat_decay' => $normalized['repeat_decay'],
            ':category_caps_json' => json_encode($normalized['category_caps'], JSON_THROW_ON_ERROR),
            ':negative_floor' => $normalized['negative_floor'],
        ]);

        return $this->getReasoningSettings($huntId);
    }

    private function findHunt(int $huntId): array
    {
        $statement = $this->pdo->prepare(
            'SELECT id, name, description, search_area_json, created_at, updated_at
             FROM hunts
             WHERE id = :id'
        );
        $statement->execute([':id' => $huntId]);
        $hunt = $statement->fetch();

        if (!$hunt) {
            throw new RuntimeException('Hunt not found.');
        }

        return $this->hydrateHunt($hunt);
    }

    private function hydrateHunt(array $hunt): array
    {
        $rawSearchArea = (string) ($hunt['search_area_json'] ?? '');
        $hunt['search_area'] = null;

        if ($rawSearchArea !== '') {
            $decoded = json_decode($rawSearchArea, true, 512, JSON_THROW_ON_ERROR);
            $hunt['search_area'] = is_array($decoded) ? $decoded : null;
        }

        unset($hunt['search_area_json']);

        return $hunt;
    }

    private function normalizeSearchArea(mixed $searchArea): ?array
    {
        if ($searchArea === null || $searchArea === '') {
            return null;
        }

        if (!is_array($searchArea)) {
            throw new InvalidArgumentException('Search area must be a valid GeoJSON Polygon or MultiPolygon.');
        }

        $type = $searchArea['type'] ?? null;
        if (!in_array($type, ['Polygon', 'MultiPolygon'], true)) {
            throw new InvalidArgumentException('Search area must be a GeoJSON Polygon or MultiPolygon.');
        }

        $coordinates = $searchArea['coordinates'] ?? null;
        if (!is_array($coordinates) || $coordinates === []) {
            throw new InvalidArgumentException('Search area coordinates are required.');
        }

        if ($type === 'Polygon' && !$this->hasValidPolygonCoordinates($coordinates)) {
            throw new InvalidArgumentException('Search area polygon must have at least four points in its outer ring.');
        }

        if ($type === 'MultiPolygon') {
            foreach ($coordinates as $polygonCoordinates) {
                if (!is_array($polygonCoordinates) || !$this->hasValidPolygonCoordinates($polygonCoordinates)) {
                    throw new InvalidArgumentException('Each polygon in a search area MultiPolygon must have at least four points in its outer ring.');
                }
            }
        }

        return [
            'type' => $type,
            'coordinates' => $coordinates,
        ];
    }

    private function hasValidPolygonCoordinates(array $coordinates): bool
    {
        return isset($coordinates[0]) && is_array($coordinates[0]) && count($coordinates[0]) >= 4;
    }

    private function findMapItem(int $mapItemId): array
    {
        $statement = $this->pdo->prepare('SELECT * FROM map_items WHERE id = :id');
        $statement->execute([':id' => $mapItemId]);
        $mapItem = $statement->fetch();

        if (!$mapItem) {
            throw new RuntimeException('Map item not found.');
        }

        return $this->hydrateMapItem($mapItem);
    }

    private function hydrateMapItem(array $mapItem): array
    {
        $mapItem['geometry'] = $this->decodeJsonObject((string) $mapItem['geometry_json'], 'geometry');
        $mapItem['style'] = $this->decodeJsonObject((string) $mapItem['style_json'], 'style');
        $mapItem['metadata'] = $this->decodeJsonObject((string) $mapItem['metadata_json'], 'metadata');
        $mapItem['confidence'] = (int) $mapItem['confidence'];
        $mapItem['color'] = (string) ($mapItem['style']['color'] ?? '#ff6b35');
        unset($mapItem['geometry_json'], $mapItem['style_json'], $mapItem['metadata_json']);

        return $mapItem;
    }

    private function normalizeMapItemPayload(array $input): array
    {
        $huntId = (int) ($input['hunt_id'] ?? 0);
        $type = strtolower(trim((string) ($input['type'] ?? '')));
        $category = strtolower(trim((string) ($input['category'] ?? 'reference')));
        $name = trim((string) ($input['name'] ?? ''));
        $description = trim((string) ($input['description'] ?? ''));
        $status = strtolower(trim((string) ($input['status'] ?? 'active')));
        $confidence = (int) ($input['confidence'] ?? 50);
        $geometry = $input['geometry'] ?? null;
        $style = $input['style'] ?? [];
        $metadata = $input['metadata'] ?? [];

        if (array_key_exists('color', $input) && (!is_array($style) || !array_key_exists('color', $style))) {
            if (!is_array($style)) {
                $style = [];
            }
            $style['color'] = $input['color'];
        }

        if ($huntId < 1) {
            throw new InvalidArgumentException('A valid hunt is required.');
        }
        $this->findHunt($huntId);

        if (!in_array($type, self::MAP_ITEM_TYPES, true)) {
            throw new InvalidArgumentException('Map item type must be marker, polygon, circle, or line.');
        }

        if (!in_array($category, array_merge(self::MAP_ITEM_CATEGORIES, self::LEGACY_MAP_ITEM_CATEGORIES), true)) {
            throw new InvalidArgumentException('Map item category is invalid.');
        }

        if (!in_array($status, self::MAP_ITEM_STATUSES, true)) {
            throw new InvalidArgumentException('Map item status is invalid.');
        }

        if ($confidence < 0 || $confidence > 100) {
            throw new InvalidArgumentException('Map item confidence must be between 0 and 100.');
        }

        if ($name === '') {
            throw new InvalidArgumentException('Map item name is required.');
        }

        if (!is_array($geometry) || !isset($geometry['type'], $geometry['coordinates'])) {
            throw new InvalidArgumentException('Map item geometry must be valid GeoJSON.');
        }
        $this->validateGeometryTypeForMapItemType($type, (string) $geometry['type']);

        if (!is_array($style)) {
            throw new InvalidArgumentException('Map item style must be an object.');
        }
        $styleColor = (string) ($style['color'] ?? '#ff6b35');
        if (!preg_match('/^#[0-9a-fA-F]{6}$/', $styleColor)) {
            throw new InvalidArgumentException('Map item style color must be a 6-digit hex color.');
        }
        $style['color'] = $styleColor;

        if (!is_array($metadata)) {
            throw new InvalidArgumentException('Map item metadata must be an object.');
        }

        return [
            ':hunt_id' => $huntId,
            ':type' => $type,
            ':category' => $category,
            ':name' => $name,
            ':description' => $description,
            ':geometry_json' => json_encode($geometry, JSON_THROW_ON_ERROR),
            ':style_json' => json_encode($style, JSON_THROW_ON_ERROR),
            ':metadata_json' => json_encode($metadata, JSON_THROW_ON_ERROR),
            ':status' => $status,
            ':confidence' => $confidence,
        ];
    }

    private function validateGeometryTypeForMapItemType(string $type, string $geometryType): void
    {
        $expected = [
            'marker' => 'Point',
            'polygon' => 'Polygon',
            'circle' => 'Polygon',
            'line' => 'LineString',
        ];

        if (($expected[$type] ?? null) !== $geometryType) {
            throw new InvalidArgumentException('Map item geometry does not match the selected type.');
        }
    }

    private function findClue(int $clueId): array
    {
        $statement = $this->pdo->prepare('SELECT * FROM clues WHERE id = :id');
        $statement->execute([':id' => $clueId]);
        $clue = $statement->fetch();

        if (!$clue) {
            throw new RuntimeException('Clue not found.');
        }

        return $this->hydrateClue($clue);
    }

    private function hydrateClue(array $clue): array
    {
        $clue['confidence'] = (int) $clue['confidence'];
        $clue['source_type'] = in_array((string) ($clue['source_type'] ?? ''), self::CLUE_SOURCE_TYPES, true)
            ? (string) $clue['source_type']
            : 'other';
        $clue['source_title'] = (string) ($clue['source_title'] ?? '');
        $clue['source_url'] = (string) ($clue['source_url'] ?? '');
        $clue['source_date'] = (string) ($clue['source_date'] ?? '');

        return $clue;
    }

    private function normalizeCluePayload(array $input): array
    {
        $huntId = (int) ($input['hunt_id'] ?? 0);
        $title = trim((string) ($input['title'] ?? ''));
        $sourceType = strtolower(trim((string) ($input['source_type'] ?? 'other')));
        $sourceTitle = trim((string) ($input['source_title'] ?? ''));
        $sourceUrl = trim((string) ($input['source_url'] ?? ''));
        $sourceDate = trim((string) ($input['source_date'] ?? ''));
        $body = trim((string) ($input['body'] ?? ''));
        $interpretation = trim((string) ($input['interpretation'] ?? ''));
        $status = strtolower(trim((string) ($input['status'] ?? 'open')));
        $confidence = (int) ($input['confidence'] ?? 50);

        if ($huntId < 1) {
            throw new InvalidArgumentException('A valid hunt is required for a clue.');
        }
        $this->findHunt($huntId);

        if ($title === '') {
            throw new InvalidArgumentException('Clue title is required.');
        }

        if (!in_array($sourceType, self::CLUE_SOURCE_TYPES, true)) {
            throw new InvalidArgumentException('Clue source type is invalid.');
        }

        if ($sourceUrl !== '' && filter_var($sourceUrl, FILTER_VALIDATE_URL) === false) {
            throw new InvalidArgumentException('Clue source URL must be a valid URL.');
        }

        if ($sourceUrl !== '') {
            $scheme = strtolower((string) parse_url($sourceUrl, PHP_URL_SCHEME));
            if (!in_array($scheme, ['http', 'https'], true)) {
                throw new InvalidArgumentException('Clue source URL must use http or https.');
            }
        }

        if (!in_array($status, self::CLUE_STATUSES, true)) {
            throw new InvalidArgumentException('Clue status is invalid.');
        }

        if ($confidence < 0 || $confidence > 100) {
            throw new InvalidArgumentException('Clue confidence must be between 0 and 100.');
        }

        return [
            ':hunt_id' => $huntId,
            ':title' => $title,
            ':source_type' => $sourceType,
            ':source_title' => $sourceTitle,
            ':source_url' => $sourceUrl,
            ':source_date' => $sourceDate,
            ':body' => $body,
            ':interpretation' => $interpretation,
            ':status' => $status,
            ':confidence' => $confidence,
        ];
    }

    private function findClueMapItem(int $id): array
    {
        $statement = $this->pdo->prepare('SELECT * FROM clue_map_items WHERE id = :id');
        $statement->execute([':id' => $id]);
        $record = $statement->fetch();

        if (!$record) {
            throw new RuntimeException('Clue-map-item relationship not found.');
        }

        return $record;
    }

    private function normalizeClueMapItemPayload(array $input): array
    {
        $clueId = (int) ($input['clue_id'] ?? 0);
        $mapItemId = (int) ($input['map_item_id'] ?? 0);
        $relationshipType = strtolower(trim((string) ($input['relationship_type'] ?? 'supports')));

        if ($clueId < 1) {
            throw new InvalidArgumentException('A valid clue_id is required.');
        }
        if ($mapItemId < 1) {
            throw new InvalidArgumentException('A valid map_item_id is required.');
        }

        $clue = $this->findClue($clueId);
        $mapItem = $this->findMapItem($mapItemId);

        if ($clue['hunt_id'] !== $mapItem['hunt_id']) {
            throw new InvalidArgumentException('Clue and map item must belong to the same hunt.');
        }

        if (!in_array($relationshipType, self::CLUE_MAP_ITEM_RELATIONSHIP_TYPES, true)) {
            throw new InvalidArgumentException('Relationship type is invalid.');
        }

        return [
            ':clue_id' => $clueId,
            ':map_item_id' => $mapItemId,
            ':relationship_type' => $relationshipType,
        ];
    }

    private function defaultReasoningSettings(int $huntId): array
    {
        return [
            'hunt_id' => $huntId,
            'cell_side_km' => self::DEFAULT_REASONING_SETTINGS['cell_side_km'],
            'repeat_decay' => self::DEFAULT_REASONING_SETTINGS['repeat_decay'],
            'category_caps' => self::DEFAULT_REASONING_SETTINGS['category_caps'],
            'negative_floor' => self::DEFAULT_REASONING_SETTINGS['negative_floor'],
            'updated_at' => null,
        ];
    }

    private function hydrateReasoningSettings(array $settings): array
    {
        $categoryCaps = json_decode((string) $settings['category_caps_json'], true);
        if (!is_array($categoryCaps)) {
            $categoryCaps = self::DEFAULT_REASONING_SETTINGS['category_caps'];
        }

        return [
            'hunt_id' => (int) $settings['hunt_id'],
            'cell_side_km' => (float) $settings['cell_side_km'],
            'repeat_decay' => (float) $settings['repeat_decay'],
            'category_caps' => array_merge(self::DEFAULT_REASONING_SETTINGS['category_caps'], $categoryCaps),
            'negative_floor' => (float) $settings['negative_floor'],
            'updated_at' => $settings['updated_at'] ?? null,
        ];
    }

    private function normalizeReasoningSettings(int $huntId, array $input): array
    {
        $current = $this->getReasoningSettings($huntId);
        $cellSideKm = (float) ($input['cell_side_km'] ?? $current['cell_side_km']);
        $repeatDecay = (float) ($input['repeat_decay'] ?? $current['repeat_decay']);
        $negativeFloor = (float) ($input['negative_floor'] ?? $current['negative_floor']);
        $categoryCaps = $input['category_caps'] ?? $current['category_caps'];

        if ($cellSideKm < 1 || $cellSideKm > 100) {
            throw new InvalidArgumentException('Reasoning cell size must be between 1 and 100 km.');
        }

        if ($repeatDecay < 0.1 || $repeatDecay > 1) {
            throw new InvalidArgumentException('Reasoning repeat decay must be between 0.1 and 1.');
        }

        if ($negativeFloor < 0.01 || $negativeFloor > 1) {
            throw new InvalidArgumentException('Reasoning negative floor must be between 0.01 and 1.');
        }

        if (!is_array($categoryCaps)) {
            throw new InvalidArgumentException('Reasoning category caps must be an object.');
        }

        $normalizedCaps = self::DEFAULT_REASONING_SETTINGS['category_caps'];
        foreach ($normalizedCaps as $key => $defaultValue) {
            $value = (float) ($categoryCaps[$key] ?? $defaultValue);
            if ($value <= 0 || $value > 100) {
                throw new InvalidArgumentException('Reasoning category caps must be greater than 0 and at most 100.');
            }
            $normalizedCaps[$key] = $value;
        }

        return [
            'cell_side_km' => $cellSideKm,
            'repeat_decay' => $repeatDecay,
            'category_caps' => $normalizedCaps,
            'negative_floor' => $negativeFloor,
        ];
    }

    private function mapItemToFeature(array $mapItem): array
    {
        return [
            'id' => $mapItem['id'],
            'hunt_id' => $mapItem['hunt_id'],
            'type' => $mapItem['type'],
            'name' => $mapItem['name'],
            'description' => $mapItem['description'],
            'color' => $mapItem['color'],
            'geometry' => $mapItem['geometry'],
            'metadata' => $mapItem['metadata'],
            'created_at' => $mapItem['created_at'],
            'updated_at' => $mapItem['updated_at'],
        ];
    }

    private function featurePayloadToMapItemPayload(array $feature): array
    {
        $category = strtolower(trim((string) ($feature['category'] ?? 'reference')));
        $status = strtolower(trim((string) ($feature['status'] ?? 'active')));
        $validCategories = array_merge(self::MAP_ITEM_CATEGORIES, self::LEGACY_MAP_ITEM_CATEGORIES);

        return [
            'hunt_id' => (int) ($feature['hunt_id'] ?? 0),
            'type' => (string) ($feature['type'] ?? ''),
            'category' => in_array($category, $validCategories, true) ? $category : 'reference',
            'name' => (string) ($feature['name'] ?? ''),
            'description' => (string) ($feature['description'] ?? ''),
            'geometry' => $feature['geometry'] ?? null,
            'style' => [
                'color' => (string) ($feature['color'] ?? '#ff6b35'),
            ],
            'metadata' => $feature['metadata'] ?? [],
            'status' => in_array($status, self::MAP_ITEM_STATUSES, true) ? $status : 'active',
            'confidence' => (int) ($feature['confidence'] ?? 50),
        ];
    }

    private function loadMapState(): array
    {
        $statement = $this->pdo->query('SELECT map_state_json FROM app_state WHERE id = 1');
        $state = $statement->fetchColumn();
        if (!is_string($state) || $state === '') {
            return [];
        }

        $decoded = json_decode($state, true);

        return is_array($decoded) ? $decoded : [];
    }

    private function decodeJsonObject(string $json, string $fieldName): array
    {
        if ($json === '') {
            return [];
        }

        $decoded = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($decoded)) {
            throw new RuntimeException('Stored ' . $fieldName . ' JSON is invalid.');
        }

        return $decoded;
    }
}
