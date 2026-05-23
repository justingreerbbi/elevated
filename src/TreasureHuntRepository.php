<?php

declare(strict_types=1);

final class TreasureHuntRepository
{
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

        if ($searchArea === null) {
            throw new InvalidArgumentException('A hunt search area polygon is required.');
        }

        $statement = $this->pdo->prepare(
            'INSERT INTO hunts (name, description, search_area_json, created_at, updated_at)
             VALUES (:name, :description, :search_area_json, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
        );
        $statement->execute([
            ':name' => $name,
            ':description' => $description,
            ':search_area_json' => json_encode($searchArea, JSON_THROW_ON_ERROR),
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

        if ($searchArea === null) {
            throw new InvalidArgumentException('A hunt search area polygon is required.');
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
            ':search_area_json' => json_encode($searchArea, JSON_THROW_ON_ERROR),
        ]);

        return $this->findHunt($huntId);
    }

    public function deleteHunt(int $huntId): void
    {
        $this->findHunt($huntId);

        $statement = $this->pdo->prepare('DELETE FROM hunts WHERE id = :id');
        $statement->execute([':id' => $huntId]);
    }

    public function listFeatures(?int $huntId = null): array
    {
        if ($huntId !== null) {
            $statement = $this->pdo->prepare(
                'SELECT *
                 FROM features
                 WHERE hunt_id = :hunt_id
                 ORDER BY updated_at DESC, id DESC'
            );
            $statement->execute([':hunt_id' => $huntId]);
        } else {
            $statement = $this->pdo->query(
                'SELECT *
                 FROM features
                 ORDER BY updated_at DESC, id DESC'
            );
        }

        $features = $statement->fetchAll() ?: [];

        return array_map([$this, 'hydrateFeature'], $features);
    }

    public function createFeature(array $input): array
    {
        $payload = $this->normalizeFeaturePayload($input);

        $statement = $this->pdo->prepare(
            'INSERT INTO features (
                hunt_id,
                type,
                name,
                description,
                color,
                geometry_json,
                metadata_json,
                created_at,
                updated_at
             ) VALUES (
                :hunt_id,
                :type,
                :name,
                :description,
                :color,
                :geometry_json,
                :metadata_json,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
             )'
        );
        $statement->execute($payload);

        return $this->findFeature((int) $this->pdo->lastInsertId());
    }

    public function updateFeature(int $featureId, array $input): array
    {
        $feature = $this->findFeature($featureId);
        $merged = array_merge($feature, $input);
        $merged['geometry'] = $input['geometry'] ?? $feature['geometry'];
        $merged['metadata'] = $input['metadata'] ?? $feature['metadata'];
        $payload = $this->normalizeFeaturePayload($merged);
        $payload[':id'] = $featureId;

        $statement = $this->pdo->prepare(
            'UPDATE features
             SET hunt_id = :hunt_id,
                 type = :type,
                 name = :name,
                 description = :description,
                 color = :color,
                 geometry_json = :geometry_json,
                 metadata_json = :metadata_json,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = :id'
        );
        $statement->execute($payload);

        return $this->findFeature($featureId);
    }

    public function deleteFeature(int $featureId): void
    {
        $this->findFeature($featureId);

        $statement = $this->pdo->prepare('DELETE FROM features WHERE id = :id');
        $statement->execute([':id' => $featureId]);
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
            throw new InvalidArgumentException('Search area must be a valid GeoJSON polygon.');
        }

        if (($searchArea['type'] ?? null) !== 'Polygon') {
            throw new InvalidArgumentException('Search area must be a polygon.');
        }

        $coordinates = $searchArea['coordinates'] ?? null;
        if (!is_array($coordinates) || !isset($coordinates[0]) || !is_array($coordinates[0]) || count($coordinates[0]) < 4) {
            throw new InvalidArgumentException('Search area polygon must have at least four points.');
        }

        return [
            'type' => 'Polygon',
            'coordinates' => $coordinates,
        ];
    }

    private function findFeature(int $featureId): array
    {
        $statement = $this->pdo->prepare('SELECT * FROM features WHERE id = :id');
        $statement->execute([':id' => $featureId]);
        $feature = $statement->fetch();

        if (!$feature) {
            throw new RuntimeException('Feature not found.');
        }

        return $this->hydrateFeature($feature);
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

    private function hydrateFeature(array $feature): array
    {
        $feature['geometry'] = json_decode((string) $feature['geometry_json'], true, 512, JSON_THROW_ON_ERROR);
        $feature['metadata'] = json_decode((string) $feature['metadata_json'], true, 512, JSON_THROW_ON_ERROR);
        unset($feature['geometry_json'], $feature['metadata_json']);

        return $feature;
    }

    private function normalizeFeaturePayload(array $input): array
    {
        $huntId = (int) ($input['hunt_id'] ?? 0);
        $type = strtolower(trim((string) ($input['type'] ?? '')));
        $name = trim((string) ($input['name'] ?? ''));
        $description = trim((string) ($input['description'] ?? ''));
        $color = trim((string) ($input['color'] ?? '#ff6b35'));
        $geometry = $input['geometry'] ?? null;
        $metadata = $input['metadata'] ?? [];

        if ($huntId < 1) {
            throw new InvalidArgumentException('A valid hunt is required.');
        }

        $this->findHunt($huntId);

        if (!in_array($type, ['marker', 'polygon', 'circle'], true)) {
            throw new InvalidArgumentException('Feature type must be marker, polygon, or circle.');
        }

        if ($name === '') {
            throw new InvalidArgumentException('Feature name is required.');
        }

        if (!preg_match('/^#[0-9a-fA-F]{6}$/', $color)) {
            throw new InvalidArgumentException('Feature color must be a 6-digit hex color.');
        }

        if (!is_array($geometry) || !isset($geometry['type'], $geometry['coordinates'])) {
            throw new InvalidArgumentException('Feature geometry must be valid GeoJSON.');
        }

        if (!is_array($metadata)) {
            throw new InvalidArgumentException('Feature metadata must be an object.');
        }

        return [
            ':hunt_id' => $huntId,
            ':type' => $type,
            ':name' => $name,
            ':description' => $description,
            ':color' => $color,
            ':geometry_json' => json_encode($geometry, JSON_THROW_ON_ERROR),
            ':metadata_json' => json_encode($metadata, JSON_THROW_ON_ERROR),
        ];
    }
}
