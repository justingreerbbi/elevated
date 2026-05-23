(function ($) {
	"use strict";

	const MAP_STYLE_OPTIONS = [
		{ value: "gis-satellite", label: "GIS Satellite" },
		{ value: "mapbox://styles/mapbox/satellite-streets-v12", label: "Satellite Streets" },
		{ value: "mapbox://styles/mapbox/satellite-v9", label: "Satellite" },
		{ value: "mapbox://styles/mapbox/outdoors-v12", label: "Outdoors" },
		{ value: "mapbox://styles/mapbox/light-v11", label: "Light" },
		{ value: "mapbox://styles/mapbox/dark-v11", label: "Dark" },
	];

	const MAPBOX_STREETS_SOURCE_ID = "mapbox-streets-v8";
	const MAPBOX_TERRAIN_SOURCE_ID = "mapbox-terrain-v2";
	const PUBLIC_LAND_OPACITY_DEFAULT = 100;
	const CONTOUR_LAYER_IDS = [
		"terrain-contour-lines",
		"terrain-contour-labels",
	];
	const PUBLIC_LAND_VISIBILITY_DEFAULTS = {
		nationalParks: true,
		recreationLands: true,
		tribalLands: true,
		borders: true,
	};
	const PUBLIC_LAND_LAYER_DEFINITIONS = [
		{
			key: "nationalParks",
			label: "National Park",
			layerId: "public-land-national-park-fill",
			outlineLayerId: "public-land-national-park-outline",
			sourceLayer: "landuse_overlay",
			minzoom: 5,
			filter: ["==", ["get", "class"], "national_park"],
			fillPaint: {
				"fill-color": "#f59e0b",
				"fill-opacity": 0.18,
			},
			linePaint: {
				"line-color": "#ffd08a",
				"line-opacity": 0.82,
				"line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.8, 8, 1.2, 12, 2],
			},
		},
		{
			key: "recreationLands",
			label: "Park / Recreation",
			layerId: "public-land-recreation-fill",
			outlineLayerId: "public-land-recreation-outline",
			sourceLayer: "landuse",
			minzoom: 5,
			filter: ["==", ["get", "class"], "park"],
			fillPaint: {
				"fill-color": "#4dbb8a",
				"fill-opacity": 0.14,
			},
			linePaint: {
				"line-color": "#9be5c7",
				"line-opacity": 0.7,
				"line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.6, 8, 1, 12, 1.6],
			},
		},
		{
			key: "tribalLands",
			label: "Tribal Land",
			layerId: "public-land-tribal-fill",
			outlineLayerId: "public-land-tribal-outline",
			sourceLayer: "landuse",
			minzoom: 5,
			filter: ["==", ["get", "class"], "aboriginal_lands"],
			fillPaint: {
				"fill-color": "#b58cff",
				"fill-opacity": 0.12,
			},
			linePaint: {
				"line-color": "#dcc8ff",
				"line-opacity": 0.72,
				"line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.7, 8, 1.1, 12, 1.8],
				"line-dasharray": [1.6, 1],
			},
		},
	];
	const BORDER_LAYER_IDS = [
		"admin-country-boundary-overlay",
		"admin-region-boundary-overlay",
	];
	const BORDER_LAYER_OPACITY_DEFAULTS = {
		"admin-country-boundary-overlay": 0.95,
		"admin-region-boundary-overlay": 0.55,
	};
	const PUBLIC_LAND_INTERACTIVE_LAYER_IDS = PUBLIC_LAND_LAYER_DEFINITIONS.map((definition) => definition.layerId).concat(BORDER_LAYER_IDS);
	const REASONING_DEFAULT_SETTINGS = {
		cell_side_km: 10,
		repeat_decay: 0.65,
		category_caps: {
			text: 8,
			terrain: 8,
			negative: 0.25,
		},
		negative_floor: 0.25,
	};
	const REASONING_BASE_BOOSTS = {
		located_at: 6,
		supports: 4,
		references: 2,
		contradicts: 0.35,
	};
	const REASONING_MAX_HEX_CANDIDATES = 1600;

	const state = {
		config: null,
		preferences: {
			mapStyle: null,
			units: "metric",
			terrain3d: true,
			peakLabels: true,
			publicLandVisibility: $.extend({}, PUBLIC_LAND_VISIBILITY_DEFAULTS),
			publicLandOpacity: PUBLIC_LAND_OPACITY_DEFAULT,
		},
		currentStyle: null,
		hunts: [],
		features: [],
		clues: [],
		clueMapItems: [],
		reasoningSettings: $.extend(true, {}, REASONING_DEFAULT_SETTINGS),
		reasoningOverlayEnabled: false,
		reasoningOverlayTimer: null,
		reasoningOverlayRequestId: 0,
		reasoningOverlayWarning: "",
		reasoningCells: [],
		reasoningCellsById: {},
		activeHuntId: null,
		map: null,
		draw: null,
		mode: "browse",
		huntDraft: null,
		pendingFeature: null,
		pendingDrawFeatureId: null,
		pendingHuntAreaDrawId: null,
		measurementCoords: [],
		bearingCoords: [],
		roadLayerIds: [],
		peakLabelLayers: [],
		mapLoaded: false,
		lastSearchRequest: 0,
		locationRequestId: 0,
		searchDebounce: null,
		saveStateDebounce: null,
		ignoreNextMapClick: false,
		lastClickedLocation: null,
		layerPanelOpen: false,
		editorMarkers: [],
		temporaryClickMarker: null,
		reasoningBoard: null,
	};

	const selectors = {
		appShell: $("#app-shell"),
		huntList: $("#hunt-list"),
		huntCount: $("#hunt-count"),
		featureList: $("#feature-list"),
		featureCount: $("#feature-count"),
		featureForm: $("#feature-form"),
		featureEmpty: $("#feature-empty"),
		featureSummary: $("#feature-summary"),
		clueList: $("#clue-list"),
		clueCount: $("#clue-count"),
		clueSummary: $("#clue-summary"),
		clueEmpty: $("#clue-empty"),
		boardCount: $("#board-count"),
		boardSummary: $("#board-summary"),
		boardEmpty: $("#reasoning-board-empty"),
		reasoningBoard: $("#reasoning-board"),
		modeBadge: $("#mode-badge"),
		activeHuntName: $("#active-hunt-name"),
		statusCard: $("#status-card"),
		searchResults: $("#search-results"),
		toast: $("#toast"),
		mapCompassNeedle: $("#map-compass-needle"),
		sidebar: $("#sidebar"),
		showSidebar: $("#show-sidebar"),
		toggleTerrain: $("#toggle-terrain"),
		toggleContours: $("#toggle-contours"),
		togglePeaks: $("#toggle-peaks"),
		toggleRoads: $("#toggle-roads"),
		toggleParksBorders: $("#toggle-parks-borders"),
		toggleGrid: $("#toggle-grid"),
		toggleCoords: $("#toggle-coords"),
		toggleHuntAreas: $("#toggle-hunt-areas"),
		toggleReasoningOverlay: $("#toggle-reasoning-overlay"),
		reasoningSummary: $("#reasoning-summary"),
		infoModal: $("#info-modal"),
		infoKicker: $("#info-kicker"),
		infoTitle: $("#info-title"),
		infoSubtitle: $("#info-subtitle"),
		infoGrid: $("#info-grid"),
		infoContent: $("#info-content"),
		infoActions: $("#info-actions"),
		huntModal: $("#hunt-modal"),
		clueModal: $("#clue-modal"),
		preferencesModal: $("#preferences-modal"),
		layerPanel: $("#layer-panel"),
		workspaceTabs: $(".workspace-tab"),
		workspacePanels: $(".workspace-pane"),
	};

	function normalizePublicLandVisibility(value) {
		return $.extend({}, PUBLIC_LAND_VISIBILITY_DEFAULTS, value || {});
	}

	function normalizePublicLandOpacity(value) {
		const opacity = Number(value);
		if (!Number.isFinite(opacity)) {
			return PUBLIC_LAND_OPACITY_DEFAULT;
		}

		return Math.max(0, Math.min(100, opacity));
	}

	function updatePublicLandOpacityLabel(value) {
		$("#preference-public-opacity-value").text(`${normalizePublicLandOpacity(value)}%`);
	}

	function ensureTerrainVectorSource() {
		if (state.map.getSource(MAPBOX_TERRAIN_SOURCE_ID)) {
			return;
		}

		state.map.addSource(MAPBOX_TERRAIN_SOURCE_ID, {
			type: "vector",
			url: "mapbox://mapbox.mapbox-terrain-v2",
		});
	}

	function syncOverlayState() {
		const hasModal = !selectors.infoModal.hasClass("hidden")
			|| !selectors.huntModal.hasClass("hidden")
			|| !selectors.clueModal.hasClass("hidden")
			|| !selectors.preferencesModal.hasClass("hidden");
		selectors.appShell.toggleClass("overlay-focus", hasModal);
	}

	function syncSidebarState() {
		const collapsed = selectors.sidebar.hasClass("collapsed");
		selectors.appShell.toggleClass("sidebar-collapsed", collapsed);
		selectors.showSidebar.toggleClass("hidden", !collapsed);
	}

	function setWorkspacePanel(panelName) {
		selectors.workspaceTabs.toggleClass("active", false);
		selectors.workspacePanels.toggleClass("active", false);
		$(`.workspace-tab[data-workspace-tab="${panelName}"]`).addClass("active");
		$(`.workspace-pane[data-workspace-panel="${panelName}"]`).addClass("active");
		if (panelName === "board") {
			window.setTimeout(renderReasoningBoard, 0);
		}
	}

	function apiRequest(method, resource, data, query) {
		if (window.Elevated && window.Elevated.api && typeof window.Elevated.api.request === "function") {
			return window.Elevated.api.request(method, resource, data, query);
		}

		const url = new URL("api.php", window.location.href);
		url.searchParams.set("resource", resource);
		if (query) {
			Object.keys(query).forEach((key) => {
				if (query[key] !== undefined && query[key] !== null && query[key] !== "") {
					url.searchParams.set(key, query[key]);
				}
			});
		}

		return $.ajax({
			url: url.toString(),
			method,
			data: data ? JSON.stringify(data) : undefined,
			contentType: "application/json; charset=utf-8",
			dataType: "json",
		}).then((response) => response.data);
	}

	function showToast(message, persist) {
		selectors.toast.text(message).removeClass("hidden");
		if (!persist) {
			window.clearTimeout(selectors.toast.data("timeoutId"));
			const timeoutId = window.setTimeout(() => selectors.toast.addClass("hidden"), 2400);
			selectors.toast.data("timeoutId", timeoutId);
		}
	}

	function setStatus(message) {
		selectors.statusCard.removeClass("is-busy");
		selectors.statusCard.text(message);
	}

	function setBusyStatus(message) {
		selectors.statusCard.addClass("is-busy");
		selectors.statusCard.text(message);
	}

	function clearBusyStatus(message) {
		selectors.statusCard.removeClass("is-busy");
		if (message) {
			selectors.statusCard.text(message);
		}
	}

	function escapeHtml(value) {
		return $("<div>")
			.text(value || "")
			.html();
	}

	function currentHunt() {
		return state.hunts.find((hunt) => hunt.id === state.activeHuntId) || null;
	}

	function visibleFeatures() {
		return state.features.filter((feature) => feature.hunt_id === state.activeHuntId);
	}

	function visibleClues() {
		return state.clues.filter((clue) => clue.hunt_id === state.activeHuntId);
	}

	function featureDisplayGeometry(feature) {
		if (feature.type === "circle" && feature.metadata && Number(feature.metadata.radius) > 0) {
			if (feature.geometry.type === "Polygon") {
				return feature.geometry;
			}
			const center = feature.metadata.center || feature.geometry.coordinates;
			if (Array.isArray(center) && center.length === 2) {
				return turf.circle(center, Number(feature.metadata.radius), { units: "meters", steps: 64 }).geometry;
			}
		}

		return feature.geometry;
	}

	function featureToGeoJson(feature) {
		return {
			type: "Feature",
			geometry: featureDisplayGeometry(feature),
			properties: {
				featureId: feature.id,
				huntId: feature.hunt_id,
				kind: feature.type,
				name: feature.name,
				description: feature.description,
				color: feature.color,
			},
		};
	}

	function huntAreaToGeoJson(hunt) {
		if (!hunt || !hunt.search_area) {
			return null;
		}

		return {
			type: "Feature",
			geometry: hunt.search_area,
			properties: {
				huntId: hunt.id,
				name: hunt.name,
			},
		};
	}

	function formatCoordinate(value) {
		return Number(value).toFixed(6);
	}

	function normalizeUnits(units) {
		return units === "imperial" ? "imperial" : "metric";
	}

	function normalizeMapStyle(style) {
		if (MAP_STYLE_OPTIONS.some((option) => option.value === style)) {
			return style;
		}
		return state.config ? state.config.mapStyle : MAP_STYLE_OPTIONS[0].value;
	}

	function resolveMapStyle(style) {
		if (style === "gis-satellite") {
			return {
				version: 8,
				name: "GIS Satellite",
				glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
				sources: {
					"esri-world-imagery": {
						type: "raster",
						tiles: [
							"https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
						],
						tileSize: 256,
						attribution: "Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
					},
					"esri-reference-overlay": {
						type: "raster",
						tiles: [
							"https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
						],
						tileSize: 256,
						attribution: "Labels: Esri",
					},
				},
				layers: [
					{
						id: "gis-satellite-imagery",
						type: "raster",
						source: "esri-world-imagery",
					},
					{
						id: "gis-satellite-reference",
						type: "raster",
						source: "esri-reference-overlay",
					},
				],
			};
		}

		return style;
	}

	function currentUnits() {
		return normalizeUnits(state.preferences.units);
	}

	function metersToInputDistance(distanceMeters, units) {
		const normalizedUnits = normalizeUnits(units || state.preferences.units);
		if (!Number.isFinite(distanceMeters)) {
			return "";
		}
		if (normalizedUnits === "imperial") {
			return Math.max(1, Math.round(distanceMeters * 3.28084));
		}
		return Math.max(1, Math.round(distanceMeters));
	}

	function inputDistanceToMeters(distanceValue, units) {
		const numericValue = Number(distanceValue);
		if (!Number.isFinite(numericValue) || numericValue <= 0) {
			return NaN;
		}
		const normalizedUnits = normalizeUnits(units || state.preferences.units);
		return normalizedUnits === "imperial" ? numericValue * 0.3048 : numericValue;
	}

	function updateRadiusFieldLabel() {
		$("#feature-radius-label").text(currentUnits() === "imperial" ? "Radius (ft)" : "Radius (m)");
	}

	function formatDistance(distanceMeters) {
		if (!Number.isFinite(distanceMeters)) {
			return "Unknown";
		}
		if (currentUnits() === "imperial") {
			const feet = distanceMeters * 3.28084;
			if (feet >= 5280) {
				const miles = feet / 5280;
				return `${miles >= 10 ? miles.toFixed(1) : miles.toFixed(2)} mi`;
			}
			return `${Math.round(feet)} ft`;
		}
		if (distanceMeters >= 1000) {
			const kilometers = distanceMeters / 1000;
			return `${kilometers >= 10 ? kilometers.toFixed(1) : kilometers.toFixed(2)} km`;
		}
		return `${Math.round(distanceMeters)} m`;
	}

	function formatArea(areaSqMeters) {
		if (!Number.isFinite(areaSqMeters)) {
			return "Unknown";
		}
		if (currentUnits() === "imperial") {
			const squareFeet = areaSqMeters * 10.7639;
			if (squareFeet >= 43560) {
				return `${(squareFeet / 43560).toFixed(2)} ac`;
			}
			return `${Math.round(squareFeet)} sq ft`;
		}
		if (areaSqMeters >= 1000000) {
			return `${(areaSqMeters / 1000000).toFixed(2)} sq km`;
		}
		return `${Math.round(areaSqMeters)} sq m`;
	}

	function formatElevation(elevationMeters) {
		if (!Number.isFinite(elevationMeters)) {
			return "Unavailable";
		}
		if (currentUnits() === "imperial") {
			return `${Math.round(elevationMeters * 3.28084)} ft`;
		}
		return `${Math.round(elevationMeters)} m`;
	}

	function formatPercent(value) {
		if (!Number.isFinite(value)) {
			return "0.00%";
		}
		return `${(value * 100).toFixed(value < 0.01 ? 3 : 2)}%`;
	}

	function toDms(value, positiveLabel, negativeLabel) {
		const absolute = Math.abs(Number(value));
		const degrees = Math.floor(absolute);
		const minutesFloat = (absolute - degrees) * 60;
		const minutes = Math.floor(minutesFloat);
		const seconds = ((minutesFloat - minutes) * 60).toFixed(2);
		const direction = value >= 0 ? positiveLabel : negativeLabel;
		return `${degrees}° ${minutes}' ${seconds}\" ${direction}`;
	}

	function currentGridStep() {
		if (!state.mapLoaded || !state.map) {
			return 1;
		}
		const zoom = state.map.getZoom();
		if (zoom < 4) {
			return 10;
		}
		if (zoom < 6) {
			return 5;
		}
		if (zoom < 8) {
			return 1;
		}
		if (zoom < 10) {
			return 0.5;
		}
		if (zoom < 12) {
			return 0.25;
		}
		return 0.1;
	}

	function snappedGridCoordinates(lngLat) {
		const step = currentGridStep();
		const lng = Math.round(lngLat.lng / step) * step;
		const lat = Math.round(lngLat.lat / step) * step;
		return `${lat.toFixed(2)}, ${lng.toFixed(2)} (${step}°)`;
	}

	function syncModeBadge() {
		const labels = {
			"browse": "Browse",
			"add-marker": "Marker",
			"add-circle": "Radius",
			"add-line": "Line",
			"polygon": "Polygon",
			"measure": "Measure",
			"bearing": "Bearing",
		};
		selectors.modeBadge.text(labels[state.mode] || "Browse");
		$(".tool-button[data-tool]").removeClass("active");
		if (state.mode === "add-marker") {
			$('.tool-button[data-tool="marker"]').addClass("active");
		}
		if (state.mode === "add-circle") {
			$('.tool-button[data-tool="circle"]').addClass("active");
		}
		if (state.mode === "polygon") {
			$('.tool-button[data-tool="polygon"]').addClass("active");
		}
		if (state.mode === "measure") {
			$('.tool-button[data-tool="measure"]').addClass("active");
		}
		if (state.mode === "bearing") {
			$('.tool-button[data-tool="bearing"]').addClass("active");
		}
		if (state.mode === "add-line") {
			$('.tool-button[data-tool="line"]').addClass("active");
		}
	}

	function normalizedDegrees(value) {
		return ((value % 360) + 360) % 360;
	}

	function formatDegrees(value) {
		return `${normalizedDegrees(value).toFixed(1)}°`;
	}

	function makeEditorHandle(kind) {
		const element = document.createElement("div");
		element.className = `edit-handle${kind ? ` ${kind}` : ""}`;
		return element;
	}

	function clearEditorMarkers() {
		state.editorMarkers.forEach((marker) => marker.remove());
		state.editorMarkers = [];
	}

	function registerEditorMarker(marker) {
		state.editorMarkers.push(marker);
		return marker;
	}

	function clearTemporaryClickMarker() {
		if (state.temporaryClickMarker) {
			state.temporaryClickMarker.remove();
			state.temporaryClickMarker = null;
		}
	}

	function showTemporaryClickMarker(lngLat) {
		if (!state.map) {
			return;
		}

		const nextLngLat = Array.isArray(lngLat) ? lngLat : [lngLat.lng, lngLat.lat];
		if (!state.temporaryClickMarker) {
			const element = document.createElement("div");
			element.className = "temporary-click-marker";
			state.temporaryClickMarker = new mapboxgl.Marker({ element })
				.setLngLat(nextLngLat)
				.addTo(state.map);
			return;
		}

		state.temporaryClickMarker.setLngLat(nextLngLat);
	}

	function clearPolygonEditing() {
		if (state.draw) {
			state.draw.deleteAll();
		}
		state.pendingDrawFeatureId = null;
		state.pendingHuntAreaDrawId = null;
	}

	function stopGeometryEditing() {
		clearEditorMarkers();
		clearPolygonEditing();
	}

	function openInfoModal() {
		selectors.infoModal.removeClass("hidden");
		syncOverlayState();
	}

	function closeInfoModal() {
		selectors.infoModal.addClass("hidden");
		selectors.featureForm.addClass("hidden");
		selectors.infoContent.removeClass("hidden").empty();
		selectors.infoGrid.empty();
		selectors.infoActions.empty();
		state.pendingFeature = null;
		state.lastClickedLocation = null;
		stopGeometryEditing();
		clearTemporaryClickMarker();
		clearCirclePreview();
		if (state.draw && state.mode !== "polygon") {
			state.draw.changeMode("simple_select");
		}
		syncOverlayState();
	}

	function openHuntModal(hunt) {
		const draft = hunt ? {
			id: hunt.id,
			name: hunt.name || "",
			description: hunt.description || "",
			search_area: hunt.search_area || null,
		} : (state.huntDraft || {
			id: null,
			name: "",
			description: "",
			search_area: null,
		});

		state.huntDraft = draft;
		if (draft.id) {
			$("#hunt-id").val(String(draft.id));
			$("#hunt-name").val(draft.name);
			$("#hunt-description").val(draft.description);
			$("#hunt-modal-title").text("Edit Hunt");
			$("#hunt-modal-kicker").text("Update Hunt");
		} else {
			$("#hunt-id").val("");
			$("#hunt-name").val(draft.name);
			$("#hunt-description").val(draft.description);
			$("#hunt-modal-title").text("Create Hunt");
			$("#hunt-modal-kicker").text("Hunt Project");
		}
		syncHuntAreaSummary();
		selectors.huntModal.removeClass("hidden");
		syncOverlayState();
	}

	function hideHuntModal() {
		selectors.huntModal.addClass("hidden");
		syncOverlayState();
	}

	function closeHuntModal() {
		hideHuntModal();
		if (state.mode === "hunt-area") {
			setMode("browse");
		}
		resetHuntForm();
	}

	function syncPreferencesForm() {
		$("#preference-map-style").val(normalizeMapStyle(state.preferences.mapStyle));
		$("#preference-units").val(normalizeUnits(state.preferences.units));
		$("#preference-terrain").prop("checked", selectors.toggleTerrain.is(":checked"));
		$("#preference-contours").prop("checked", selectors.toggleContours.is(":checked"));
		$("#preference-peaks").prop("checked", selectors.togglePeaks.is(":checked"));
		$("#preference-roads").prop("checked", selectors.toggleRoads.is(":checked"));
		$("#preference-public-opacity").val(normalizePublicLandOpacity(state.preferences.publicLandOpacity));
		updatePublicLandOpacityLabel(state.preferences.publicLandOpacity);
		$("#preference-public-national-parks").prop("checked", state.preferences.publicLandVisibility.nationalParks);
		$("#preference-public-recreation").prop("checked", state.preferences.publicLandVisibility.recreationLands);
		$("#preference-public-tribal").prop("checked", state.preferences.publicLandVisibility.tribalLands);
		$("#preference-public-borders").prop("checked", state.preferences.publicLandVisibility.borders);
		$("#preference-grid").prop("checked", selectors.toggleGrid.is(":checked"));
		$("#preference-coords").prop("checked", selectors.toggleCoords.is(":checked"));
	}

	function openPreferencesModal() {
		syncPreferencesForm();
		selectors.preferencesModal.removeClass("hidden");
		syncOverlayState();
	}

	function closePreferencesModal() {
		selectors.preferencesModal.addClass("hidden");
		syncOverlayState();
	}

	function applySavedPreferences(nextMapStyle, nextUnits, nextTerrain3d, nextPeakLabels, nextPublicLandVisibility, nextPublicLandOpacity) {
		const previousUnits = normalizeUnits(state.preferences.units);
		const circleRadiusMeters = $("#feature-type").val() === "circle"
			? inputDistanceToMeters($("#feature-radius").val(), previousUnits)
			: null;
		const normalizedStyle = normalizeMapStyle(nextMapStyle);
		const styleChanged = Boolean(state.map && normalizedStyle !== state.currentStyle);

		state.preferences.mapStyle = normalizedStyle;
		state.preferences.units = normalizeUnits(nextUnits);
		state.preferences.terrain3d = nextTerrain3d !== false;
		state.preferences.peakLabels = nextPeakLabels !== false;
		state.preferences.publicLandVisibility = normalizePublicLandVisibility(nextPublicLandVisibility);
		state.preferences.publicLandOpacity = normalizePublicLandOpacity(nextPublicLandOpacity);
		updateRadiusFieldLabel();

		if (Number.isFinite(circleRadiusMeters) && circleRadiusMeters > 0) {
			$("#feature-radius").val(metersToInputDistance(circleRadiusMeters));
		}

		if (styleChanged) {
			state.currentStyle = normalizedStyle;
			state.mapLoaded = false;
			state.map.setStyle(resolveMapStyle(normalizedStyle));
		}

		selectors.toggleTerrain.prop("checked", state.preferences.terrain3d);
		selectors.togglePeaks.prop("checked", state.preferences.peakLabels);
		if (styleChanged) {
			return;
		}

		applyTerrainState({ reveal: false });
		applyPeakLabelVisibility();
		applyPublicLandOpacity();
		applyParkAndBorderVisibility();
		updateMeasurementLayer();
		updateMapSource();
		updateCirclePreviewFromInputs();
	}

	function savePreferences(event) {
		event.preventDefault();
		const nextMapStyle = $("#preference-map-style").val();
		const nextUnits = $("#preference-units").val();
		const terrain3d = $("#preference-terrain").is(":checked");
		const contoursVisible = $("#preference-contours").is(":checked");
		const peakLabels = $("#preference-peaks").is(":checked");
		const publicLandOpacity = $("#preference-public-opacity").val();
		const publicLandVisibility = {
			nationalParks: $("#preference-public-national-parks").is(":checked"),
			recreationLands: $("#preference-public-recreation").is(":checked"),
			tribalLands: $("#preference-public-tribal").is(":checked"),
			borders: $("#preference-public-borders").is(":checked"),
		};
		const roadsVisible = $("#preference-roads").is(":checked");
		const gridVisible = $("#preference-grid").is(":checked");
		const coordsVisible = $("#preference-coords").is(":checked");

		applySavedPreferences(nextMapStyle, nextUnits, terrain3d, peakLabels, publicLandVisibility, publicLandOpacity);
		selectors.toggleContours.prop("checked", contoursVisible);
		selectors.toggleRoads.prop("checked", roadsVisible);
		selectors.toggleGrid.prop("checked", gridVisible);
		selectors.toggleCoords.prop("checked", coordsVisible);
		applyContourVisibility();
		applyRoadVisibility();
		updateGridOverlay();
		saveMapState();
		closePreferencesModal();
		showToast("Preferences saved.");
	}

	function renderInfoGrid(rows) {
		selectors.infoGrid.empty();
		rows.forEach((row) => {
			selectors.infoGrid.append(`
				<div class="info-stat">
					<span class="stat-label">${escapeHtml(row.label)}</span>
					<strong class="stat-value">${escapeHtml(row.value)}</strong>
				</div>
			`);
		});
	}

	function renderModalActions(actions) {
		selectors.infoActions.empty();
		actions.forEach((action) => {
			const button = $(`
				<button type="button" class="action-orb ${escapeHtml(action.variant || "cancel")}">
					<span class="action-icon"><i class="${escapeHtml(action.icon)}"></i></span>
					<span class="action-label">${escapeHtml(action.label)}</span>
				</button>
			`);
			button.on("click", action.onClick);
			selectors.infoActions.append(button);
		});
	}

	function resetFeatureForm() {
		$("#feature-id").val("");
		$("#feature-type").val("marker");
		$("#feature-name").val("");
		$("#feature-description").val("");
		$("#feature-color").val("#ff6b35");
		$("#feature-category").val("reference");
		$("#feature-status").val("active");
		$("#feature-confidence").val("50");
		$("#feature-lat").val("");
		$("#feature-lng").val("");
		$("#feature-radius").val("100");
		$(".feature-radius-field").addClass("hidden");
		$(".feature-point-fields").removeClass("hidden");
		selectors.featureForm.addClass("hidden");
		state.pendingFeature = null;
		state.pendingDrawFeatureId = null;
		clearEditorMarkers();
		clearCirclePreview();
		clearPolygonEditing();
	}

	function resetHuntForm() {
		$("#hunt-id").val("");
		$("#hunt-name").val("");
		$("#hunt-description").val("");
		state.huntDraft = null;
		syncHuntAreaSummary();
	}

	function areaSummary(searchArea) {
		if (!searchArea) {
			return {
				title: "Search area optional",
				body: "You can save this hunt now and draw a search area later.",
			};
		}

		const areaSqMeters = turf.area({ type: "Feature", geometry: searchArea, properties: {} });
		const bounds = turf.bbox({ type: "Feature", geometry: searchArea, properties: {} });
		return {
			title: `Area saved: ${formatArea(areaSqMeters)}`,
			body: `Bounds ${formatCoordinate(bounds[1])}, ${formatCoordinate(bounds[0])} to ${formatCoordinate(bounds[3])}, ${formatCoordinate(bounds[2])}`,
		};
	}

	function syncHuntDraftFromForm() {
		if (!state.huntDraft) {
			state.huntDraft = { id: null, name: "", description: "", search_area: null };
		}

		state.huntDraft.id = $("#hunt-id").val() ? Number($("#hunt-id").val()) : null;
		state.huntDraft.name = $("#hunt-name").val().trim();
		state.huntDraft.description = $("#hunt-description").val().trim();
	}

	function syncHuntAreaSummary() {
		const summary = areaSummary(state.huntDraft && state.huntDraft.search_area ? state.huntDraft.search_area : null);
		$("#hunt-area-summary").html(`<strong>${escapeHtml(summary.title)}</strong><p>${escapeHtml(summary.body)}</p>`);
		$("#clear-hunt-area").toggleClass("hidden", !(state.huntDraft && state.huntDraft.search_area));
		$("#define-hunt-area span").text(state.huntDraft && state.huntDraft.search_area ? "Redraw search area" : "Draw search area");
	}

	function renderHunts() {
		selectors.huntList.empty();
		selectors.huntCount.text(String(state.hunts.length));
		if (!state.hunts.length) {
			selectors.huntList.append('<div class="empty-state">No hunts yet.</div>');
			selectors.activeHuntName.text("No active hunt");
			updateHuntAreaSource();
			return;
		}

		state.hunts.forEach((hunt) => {
			const summary = areaSummary(hunt.search_area || null);
			const item = $(
				`<div class="hunt-item${hunt.id === state.activeHuntId ? " active" : ""}" data-id="${hunt.id}">
					<div class="item-main">
						<h3>${escapeHtml(hunt.name)}</h3>
						<div class="item-meta">
							<span class="item-chip">${escapeHtml(summary.title)}</span>
						</div>
					</div>
					<div class="item-actions">
						<button type="button" class="mini-button focus-hunt-area" aria-label="Locate hunt area"><i class="fa-solid fa-expand"></i></button>
						<button type="button" class="mini-button edit-hunt" aria-label="Edit hunt"><i class="fa-solid fa-pen"></i></button>
						<button type="button" class="mini-button delete delete-hunt" aria-label="Delete hunt"><i class="fa-solid fa-trash"></i></button>
					</div>
				</div>`,
			);
			item.on("click", function (event) {
				if ($(event.target).closest("button").length) {
					return;
				}
				setActiveHunt(hunt.id, true);
			});
			item.find(".edit-hunt").on("click", function () {
				openHuntModal(hunt);
			});
			item.find(".focus-hunt-area").on("click", function () {
				focusHuntArea(hunt);
			});
			item.find(".delete-hunt").on("click", function () {
				deleteHunt(hunt.id);
			});
			selectors.huntList.append(item);
		});

		const hunt = currentHunt();
		selectors.activeHuntName.text(hunt ? hunt.name : "No active hunt");
		updateHuntAreaSource();
	}

	function focusHuntArea(hunt) {
		if (!state.map || !hunt || !hunt.search_area) {
			return;
		}

		const bounds = turf.bbox({ type: "Feature", geometry: hunt.search_area, properties: {} });
		state.map.fitBounds(bounds, { padding: 100, duration: 900 });
	}

	function renderFeatures() {
		selectors.featureList.empty();
		const hunt = currentHunt();

		if (!hunt) {
			selectors.featureCount.text("0");
			selectors.featureSummary.text("No items");
			selectors.featureEmpty.removeClass("hidden").text("Select a hunt to start.");
			updateMapSource();
			return;
		}

		const features = visibleFeatures();
		selectors.featureCount.text(String(features.length));
		selectors.featureSummary.text(`${features.length} ${features.length === 1 ? "item" : "items"}`);
		selectors.featureEmpty.toggleClass("hidden", features.length > 0);
		if (!features.length) {
			selectors.featureEmpty.text("No saved map items.");
		}

		features.forEach((feature) => {
			const confidenceLabel = window.Elevated && window.Elevated.utils ? window.Elevated.utils.confidenceLabel(feature.confidence) : "";
			const item = $(
				`<div class="feature-item" data-id="${feature.id}">
					<div class="item-main">
						<h4><span class="feature-swatch" style="background:${escapeHtml(feature.color)}"></span>${escapeHtml(feature.name)}</h4>
						<div class="item-meta">
							<span class="item-chip">${escapeHtml(feature.type)}</span>
							<span class="item-chip">${escapeHtml(feature.status || "active")}</span>
							<span class="item-chip">${escapeHtml(String(feature.confidence ?? 50))}% ${escapeHtml(confidenceLabel)}</span>
						</div>
					</div>
					<div class="item-actions">
						<button type="button" class="mini-button zoom-feature" aria-label="Locate feature"><i class="fa-solid fa-crosshairs"></i></button>
						<button type="button" class="mini-button edit-feature" aria-label="Edit feature"><i class="fa-solid fa-pen"></i></button>
						<button type="button" class="mini-button delete delete-feature" aria-label="Delete feature"><i class="fa-solid fa-trash"></i></button>
					</div>
				</div>`,
			);
			item.on("click", function (event) {
				if ($(event.target).closest("button").length) {
					return;
				}
				focusFeature(feature);
				showFeatureDetails(feature);
			});
			item.find(".zoom-feature").on("click", function () {
				focusFeature(feature);
			});
			item.find(".edit-feature").on("click", function () {
				openFeatureEditor(feature);
			});
			item.find(".delete-feature").on("click", function () {
				deleteFeature(feature.id);
			});
			selectors.featureList.append(item);
		});

		updateMapSource();
		renderReasoningBoard();
	}

	function renderClueMapItemOptions(selectedIds) {
		const selected = new Set((selectedIds || []).map((id) => Number(id)));
		const options = visibleFeatures();
		const select = $("#clue-map-items");
		select.empty();
		options.forEach((item) => {
			const option = $("<option></option>")
				.val(String(item.id))
				.text(item.name || `Map item ${item.id}`);
			if (selected.has(Number(item.id))) {
				option.prop("selected", true);
			}
			select.append(option);
		});
	}

	function resetClueForm() {
		$("#clue-id").val("");
		$("#clue-title").val("");
		$("#clue-body").val("");
		$("#clue-interpretation").val("");
		$("#clue-status").val("open");
		$("#clue-confidence").val("50");
		renderClueMapItemOptions([]);
	}

	function openClueModal(clue) {
		if (clue) {
			const linkedMapItemIds = state.clueMapItems
				.filter((link) => Number(link.clue_id) === Number(clue.id))
				.map((link) => Number(link.map_item_id));
			$("#clue-modal-title").text("Edit Clue");
			$("#clue-id").val(String(clue.id));
			$("#clue-title").val(clue.title || "");
			$("#clue-body").val(clue.body || "");
			$("#clue-interpretation").val(clue.interpretation || "");
			$("#clue-status").val(clue.status || "open");
			$("#clue-confidence").val(String(Number.isFinite(Number(clue.confidence)) ? Number(clue.confidence) : 50));
			renderClueMapItemOptions(linkedMapItemIds);
		} else {
			$("#clue-modal-title").text("Create Clue");
			resetClueForm();
		}

		selectors.clueModal.removeClass("hidden");
		syncOverlayState();
	}

	function closeClueModal() {
		selectors.clueModal.addClass("hidden");
		resetClueForm();
		syncOverlayState();
	}

	function renderClues() {
		selectors.clueList.empty();
		const hunt = currentHunt();

		if (!hunt) {
			selectors.clueCount.text("0");
			selectors.boardCount.text("0");
			selectors.boardSummary.text("No evidence graph");
			selectors.clueSummary.text("No clues");
			selectors.clueEmpty.removeClass("hidden").text("Select a hunt to add clues.");
			renderReasoningBoard();
			return;
		}

		const clues = visibleClues();
		selectors.clueCount.text(String(clues.length));
		selectors.clueSummary.text(`${clues.length} ${clues.length === 1 ? "clue" : "clues"}`);
		selectors.clueEmpty.toggleClass("hidden", clues.length > 0);
		if (!clues.length) {
			selectors.clueEmpty.text("No saved clues.");
		}

		clues.forEach((clue) => {
			const confidenceLabel = window.Elevated && window.Elevated.utils ? window.Elevated.utils.confidenceLabel(clue.confidence) : "";
			const linkCount = state.clueMapItems.filter((link) => Number(link.clue_id) === Number(clue.id)).length;
			const item = $(
				`<div class="feature-item" data-id="${clue.id}">
					<div class="item-main">
						<h4>${escapeHtml(clue.title)}</h4>
						<div class="item-meta">
							<span class="item-chip">${escapeHtml(clue.status || "open")}</span>
							<span class="item-chip">${escapeHtml(String(clue.confidence ?? 50))}% ${escapeHtml(confidenceLabel)}</span>
							<span class="item-chip">${linkCount} links</span>
						</div>
					</div>
					<div class="item-actions">
						<button type="button" class="mini-button edit-clue" aria-label="Edit clue"><i class="fa-solid fa-pen"></i></button>
						<button type="button" class="mini-button delete delete-clue" aria-label="Delete clue"><i class="fa-solid fa-trash"></i></button>
					</div>
				</div>`,
			);
			item.find(".edit-clue").on("click", function () {
				openClueModal(clue);
			});
			item.find(".delete-clue").on("click", function () {
				deleteClue(clue.id);
			});
			selectors.clueList.append(item);
		});
		renderReasoningBoard();
	}

	function reasoningBoardElements() {
		const hunt = currentHunt();
		if (!hunt) {
			return [];
		}

		const features = visibleFeatures();
		const clues = visibleClues();
		const featureIds = new Set(features.map((feature) => Number(feature.id)));
		const clueIds = new Set(clues.map((clue) => Number(clue.id)));
		const elements = [];

		elements.push({
			data: {
				id: `hunt-${hunt.id}`,
				label: hunt.name || "Active Hunt",
				type: "hunt",
			},
		});

		clues.forEach((clue) => {
			elements.push({
				data: {
					id: `clue-${clue.id}`,
					label: clue.title || `Clue ${clue.id}`,
					type: "clue",
					status: clue.status || "open",
				},
			});
			elements.push({
				data: {
					id: `hunt-${hunt.id}-clue-${clue.id}`,
					source: `hunt-${hunt.id}`,
					target: `clue-${clue.id}`,
					label: "contains",
					type: "contains",
				},
			});
		});

		features.forEach((feature) => {
			elements.push({
				data: {
					id: `feature-${feature.id}`,
					label: feature.name || `Map Item ${feature.id}`,
					type: "feature",
					status: feature.status || "active",
				},
			});
		});

		state.clueMapItems.forEach((link) => {
			const clueId = Number(link.clue_id);
			const mapItemId = Number(link.map_item_id);
			if (!clueIds.has(clueId) || !featureIds.has(mapItemId)) {
				return;
			}
			elements.push({
				data: {
					id: `link-${clueId}-${mapItemId}`,
					source: `clue-${clueId}`,
					target: `feature-${mapItemId}`,
					label: link.relationship_type || "supports",
					type: "supports",
				},
			});
		});

		return elements;
	}

	function renderReasoningBoard() {
		const elements = reasoningBoardElements();
		const hasBoardData = elements.length > 1;
		const boardActive = $('.workspace-pane[data-workspace-panel="board"]').hasClass("active");
		const canRenderBoard = hasBoardData && boardActive && typeof window.cytoscape === "function";
		selectors.boardEmpty
			.toggleClass("hidden", hasBoardData && (!boardActive || canRenderBoard))
			.text(hasBoardData ? "Reasoning graph library failed to load." : "Select a hunt with clues or map items.");
		selectors.reasoningBoard.toggleClass("hidden", !canRenderBoard);
		selectors.boardCount.text(String(Math.max(0, elements.filter((element) => !element.data.source).length - 1)));
		selectors.boardSummary.text(hasBoardData ? `${elements.length} graph elements` : "No evidence graph");

		if (!canRenderBoard) {
			if (!hasBoardData && state.reasoningBoard) {
				state.reasoningBoard.destroy();
				state.reasoningBoard = null;
			}
			return;
		}

		if (!state.reasoningBoard) {
			state.reasoningBoard = window.cytoscape({
				container: selectors.reasoningBoard[0],
				style: [
					{
						selector: "node",
						style: {
							"background-color": "#2b3038",
							"border-color": "#bfc6cc",
							"border-width": 1,
							"color": "#f1f3f4",
							"font-size": 10,
							"label": "data(label)",
							"text-halign": "center",
							"text-valign": "center",
							"text-wrap": "wrap",
							"text-max-width": 86,
							"width": 86,
							"height": 34,
							"shape": "rectangle",
						},
					},
					{
						selector: 'node[type = "hunt"]',
						style: {
							"background-color": "#d03740",
							"border-color": "#f04f58",
							"width": 104,
							"height": 40,
						},
					},
					{
						selector: 'node[type = "clue"]',
						style: {
							"background-color": "#24324a",
						},
					},
					{
						selector: 'node[type = "feature"]',
						style: {
							"background-color": "#263b32",
						},
					},
					{
						selector: "edge",
						style: {
							"curve-style": "bezier",
							"line-color": "#7f8790",
							"target-arrow-color": "#7f8790",
							"target-arrow-shape": "triangle",
							"label": "data(label)",
							"font-size": 8,
							"text-background-color": "#08090b",
							"text-background-opacity": 0.85,
							"text-background-padding": 2,
							"color": "#c5cbd1",
						},
					},
				],
				layout: { name: "breadthfirst", directed: true, spacingFactor: 1.05 },
				userZoomingEnabled: true,
				userPanningEnabled: true,
			});
			state.reasoningBoard.on("tap", "node", function (event) {
				const data = event.target.data();
				if (data.type === "clue") {
					const clue = state.clues.find((item) => `clue-${item.id}` === data.id);
					if (clue) {
						showClueReasoningDetails(clue);
					}
				}
				if (data.type === "feature") {
					const feature = state.features.find((item) => `feature-${item.id}` === data.id);
					if (feature) {
						focusFeature(feature);
						showFeatureDetails(feature);
					}
				}
			});
		}

		state.reasoningBoard.elements().remove();
		state.reasoningBoard.add(elements);
		state.reasoningBoard.layout({ name: "breadthfirst", directed: true, spacingFactor: 1.05 }).run();
		state.reasoningBoard.fit(undefined, 24);
	}

	function saveMapState() {
		if (!state.mapLoaded || !state.map) {
			return;
		}

		const center = state.map.getCenter();
		const payload = {
			center: [center.lng, center.lat],
			zoom: state.map.getZoom(),
			pitch: state.map.getPitch(),
			bearing: state.map.getBearing(),
			selectedHuntId: state.activeHuntId,
			mapStyle: normalizeMapStyle(state.preferences.mapStyle),
			units: normalizeUnits(state.preferences.units),
			terrain3d: selectors.toggleTerrain.is(":checked"),
			contoursVisible: selectors.toggleContours.is(":checked"),
			peakLabels: selectors.togglePeaks.is(":checked"),
			roadsVisible: selectors.toggleRoads.is(":checked"),
			parkBoundariesVisible: selectors.toggleParksBorders.is(":checked"),
			publicLandVisibility: normalizePublicLandVisibility(state.preferences.publicLandVisibility),
			publicLandOpacity: normalizePublicLandOpacity(state.preferences.publicLandOpacity),
			gridVisible: selectors.toggleGrid.is(":checked"),
			coordsVisible: selectors.toggleCoords.is(":checked"),
			huntAreaVisible: selectors.toggleHuntAreas.is(":checked"),
			reasoningOverlayVisible: selectors.toggleReasoningOverlay.is(":checked"),
		};

		window.clearTimeout(state.saveStateDebounce);
		state.saveStateDebounce = window.setTimeout(() => {
			apiRequest("POST", "map-state", payload).catch(() => {
				showToast("Unable to save map state.");
			});
		}, 300);
	}

	function setActiveHunt(huntId, persist) {
		state.activeHuntId = huntId;
		renderHunts();
		renderFeatures();
		renderClues();
		renderClueMapItemOptions();
		updateHuntAreaSource();
		loadReasoningSettings();
		if (persist) {
			saveMapState();
		}
	}

	function applyHuntAreaVisibility() {
		if (!state.mapLoaded || !state.map) {
			return;
		}

		const visibility = selectors.toggleHuntAreas.is(":checked") ? "visible" : "none";
		["hunt-search-area-fill", "hunt-search-area-line"].forEach(function (layerId) {
			if (state.map.getLayer(layerId)) {
				state.map.setLayoutProperty(layerId, "visibility", visibility);
			}
		});
	}

	function applyReasoningOverlayVisibility() {
		if (!state.mapLoaded || !state.map) {
			return;
		}

		const visibility = state.reasoningOverlayEnabled ? "visible" : "none";
		["reasoning-hexes-fill", "reasoning-hexes-line"].forEach((layerId) => {
			if (state.map.getLayer(layerId)) {
				state.map.setLayoutProperty(layerId, "visibility", visibility);
			}
		});
	}

	function updateHuntAreaSource() {
		if (!state.mapLoaded || !state.map || !state.map.getSource("hunt-search-area")) {
			return;
		}

		const feature = huntAreaToGeoJson(currentHunt());
		state.map.getSource("hunt-search-area").setData({
			type: "FeatureCollection",
			features: feature ? [feature] : [],
		});
		applyHuntAreaVisibility();
		updateReasoningOverlay();
	}

	function ensureActiveHunt() {
		if (state.activeHuntId) {
			return true;
		}

		showToast("Create or select a hunt first.");
		return false;
	}

	function reverseGeocode(lngLat) {
		if (!state.config || !state.config.mapboxToken || state.config.mapboxToken === "YOUR_MAPBOX_ACCESS_TOKEN") {
			return $.Deferred().resolve(null).promise();
		}

		const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lngLat.lng},${lngLat.lat}.json?limit=1&types=address,poi,place,locality&access_token=${encodeURIComponent(state.config.mapboxToken)}`;
		return $.getJSON(url)
			.then((response) => ((response.features || [])[0] ? response.features[0].place_name : null))
			.catch(() => null);
	}

	function terrainElevation(lngLat) {
		if (!state.mapLoaded || !state.map || typeof state.map.queryTerrainElevation !== "function") {
			return null;
		}

		const elevation = state.map.queryTerrainElevation([lngLat.lng, lngLat.lat], { exaggerated: false });
		return Number.isFinite(elevation) ? elevation : null;
	}

	function displayNameForMapboxFeature(properties) {
		if (!properties) {
			return "Unnamed area";
		}

		return properties.name_en || properties.name || properties.name_es || properties.name_fr || "Unnamed area";
	}

	function publicLandInfoFromRenderedFeature(renderedFeature) {
		if (!renderedFeature) {
			return null;
		}

		const properties = renderedFeature.properties || {};
		const landDefinition = PUBLIC_LAND_LAYER_DEFINITIONS.find((definition) => definition.layerId === renderedFeature.layer.id || definition.outlineLayerId === renderedFeature.layer.id);
		if (landDefinition) {
			return {
				kind: "public-land",
				name: displayNameForMapboxFeature(properties),
				label: landDefinition.label,
				className: properties.class || landDefinition.key,
				type: properties.type || "",
				sourceLayer: landDefinition.sourceLayer,
			};
		}

		if (BORDER_LAYER_IDS.indexOf(renderedFeature.layer.id) >= 0) {
			return {
				kind: "border",
				name: properties.iso_3166_1 || "Administrative boundary",
				label: Number(properties.admin_level) === 0 ? "Country Boundary" : "Regional Boundary",
				className: "admin",
				type: properties.maritime === "true" ? "maritime" : "land",
				sourceLayer: "admin",
			};
		}

		return null;
	}

	function queryPublicLandFeatures(point) {
		if (!state.mapLoaded) {
			return [];
		}

		const availableLayers = PUBLIC_LAND_INTERACTIVE_LAYER_IDS.filter((layerId) => state.map.getLayer(layerId));
		if (!availableLayers.length) {
			return [];
		}

		const seen = {};
		return state.map.queryRenderedFeatures(point, { layers: availableLayers })
			.map(publicLandInfoFromRenderedFeature)
			.filter(Boolean)
			.filter((item) => {
				const key = [item.kind, item.label, item.name, item.className, item.type].join("|");
				if (seen[key]) {
					return false;
				}
				seen[key] = true;
				return true;
			})
			.slice(0, 3);
	}

	function renderLocationInfoSections(publicLandFeatures) {
		const sections = [
			'<div class="info-section"><strong>Actions</strong><p class="info-note">Save this point as a marker.</p></div>',
		];

		if (publicLandFeatures && publicLandFeatures.length) {
			sections.push(publicLandFeatures.map((item) => `
				<div class="info-section public-land-section">
					<strong>${escapeHtml(item.name)}</strong>
					<p class="info-note">${escapeHtml(item.label)}${item.type ? ` | ${item.type}` : ""}</p>
					<div class="info-detail-list">
						<div><span>Category</span><strong>${escapeHtml(item.className)}</strong></div>
						<div><span>Layer</span><strong>${escapeHtml(item.sourceLayer)}</strong></div>
					</div>
				</div>
			`).join(""));
		}

		return sections.join("");
	}

	function showLocationDetails(lngLat, publicLandFeatures) {
		state.lastClickedLocation = { lng: lngLat.lng, lat: lngLat.lat };
		showTemporaryClickMarker(lngLat);
		const hunt = currentHunt();
		selectors.infoKicker.text("Map Location");
		selectors.infoTitle.text(`${formatCoordinate(lngLat.lat)}, ${formatCoordinate(lngLat.lng)}`);
		selectors.infoSubtitle.text(publicLandFeatures && publicLandFeatures.length ? "Public land details available" : "Resolving location");
		renderInfoGrid([
			{ label: "Latitude", value: formatCoordinate(lngLat.lat) },
			{ label: "Longitude", value: formatCoordinate(lngLat.lng) },
			{ label: "Elevation", value: formatElevation(terrainElevation(lngLat)) },
			{ label: "Grid", value: snappedGridCoordinates(lngLat) },
			{ label: "DMS", value: `${toDms(lngLat.lat, "N", "S")}` },
			{ label: "Active Hunt", value: hunt ? hunt.name : "No hunt selected" },
		]);
		selectors.featureForm.addClass("hidden");
		selectors.infoContent.removeClass("hidden").html(renderLocationInfoSections(publicLandFeatures));
		renderModalActions([
			{
				label: "Close",
				icon: "fa-solid fa-xmark",
				variant: "cancel",
				onClick: closeInfoModal,
			},
			{
				label: "Save Marker",
				icon: "fa-solid fa-location-dot",
				variant: "primary",
				onClick: function () {
					if (!ensureActiveHunt()) {
						return;
					}
					clearTemporaryClickMarker();
					openFeatureEditor({
						type: "marker",
						name: "",
						description: "",
						color: "#ff6b35",
						geometry: { type: "Point", coordinates: [lngLat.lng, lngLat.lat] },
						metadata: { lat: lngLat.lat, lng: lngLat.lng },
					});
				},
			},
		]);
		openInfoModal();

		const requestId = Date.now();
		state.locationRequestId = requestId;
		reverseGeocode(lngLat).then((placeName) => {
			if (state.locationRequestId !== requestId) {
				return;
			}
			if (publicLandFeatures && publicLandFeatures.length) {
				selectors.infoSubtitle.text(placeName ? `${placeName} | public land` : "Public land");
				return;
			}
			selectors.infoSubtitle.text(placeName || "Unnamed location");
		});
	}

	function featureMetricRows(feature) {
		const displayGeometry = featureDisplayGeometry(feature);
		const rows = [
			{ label: "Type", value: feature.type },
			{ label: "Hunt", value: currentHunt() ? currentHunt().name : String(feature.hunt_id) },
			{ label: "Color", value: feature.color },
		];

		if (feature.type === "marker" && feature.geometry.coordinates) {
			rows.push({ label: "Latitude", value: formatCoordinate(feature.geometry.coordinates[1]) });
			rows.push({ label: "Longitude", value: formatCoordinate(feature.geometry.coordinates[0]) });
		}

		if (feature.type === "circle") {
			const radius = Number(feature.metadata && feature.metadata.radius);
			rows.push({ label: "Radius", value: formatDistance(radius) });
			rows.push({ label: "Area", value: formatArea(turf.area({ type: "Feature", geometry: displayGeometry, properties: {} })) });
		}

		if (feature.type === "polygon") {
			rows.push({ label: "Area", value: formatArea(turf.area({ type: "Feature", geometry: displayGeometry, properties: {} })) });
			const line = turf.polygonToLine({ type: "Feature", geometry: displayGeometry, properties: {} });
			const perimeterKm = turf.length(line, { units: "kilometers" });
			rows.push({ label: "Perimeter", value: formatDistance(perimeterKm * 1000) });
		}

		if (feature.type === "line") {
			const distanceMeters = turf.length({ type: "Feature", geometry: displayGeometry, properties: {} }, { units: "kilometers" }) * 1000;
			rows.push({ label: "Length", value: formatDistance(distanceMeters) });
		}

		return rows.slice(0, 6);
	}

	function showFeatureDetails(feature) {
		const relatedClues = state.clueMapItems
			.filter((link) => Number(link.map_item_id) === Number(feature.id))
			.map((link) => {
				const clue = state.clues.find((item) => Number(item.id) === Number(link.clue_id));
				return clue ? { clue, relationshipType: link.relationship_type } : null;
			})
			.filter(Boolean);

		const relatedCluesHtml = relatedClues.length
			? `<div class="info-section"><strong>Related Clues</strong><div class="info-detail-list">${relatedClues.map((entry) => `<div><span>${escapeHtml(entry.relationshipType || "supports")}</span><strong>${escapeHtml(entry.clue.title)}</strong></div>`).join("")}</div></div>`
			: '<div class="info-section"><strong>Related Clues</strong><p class="info-note">No clues linked yet.</p></div>';

		selectors.infoKicker.text("Saved Map Item");
		selectors.infoTitle.text(feature.name);
		selectors.infoSubtitle.text(feature.description || feature.type);
		renderInfoGrid(featureMetricRows(feature));
		selectors.featureForm.addClass("hidden");
		selectors.infoContent.removeClass("hidden").html(`
			<div class="info-section">
				<strong>${escapeHtml(feature.type.charAt(0).toUpperCase() + feature.type.slice(1))}</strong>
				<p class="info-note">Review, edit, or delete.</p>
			</div>
			${relatedCluesHtml}
		`);
		renderModalActions([
			{
				label: "Close",
				icon: "fa-solid fa-xmark",
				variant: "cancel",
				onClick: closeInfoModal,
			},
			{
				label: "Refocus",
				icon: "fa-solid fa-arrows-up-down-left-right",
				variant: "success",
				onClick: function () {
					openFeatureEditor(feature);
				},
			},
			{
				label: "Edit",
				icon: "fa-solid fa-pen",
				variant: "primary",
				onClick: function () {
					openFeatureEditor(feature);
				},
			},
			{
				label: "Delete",
				icon: "fa-solid fa-trash",
				variant: "danger",
				onClick: function () {
					deleteFeature(feature.id);
				},
			},
		]);
		openInfoModal();
	}

	function showReasoningCellDetails(cellId) {
		const cell = state.reasoningCellsById[cellId];
		if (!cell) {
			return;
		}

		updateReasoningOverlay(cellId);
		selectors.infoKicker.text("Reasoning Overlay");
		selectors.infoTitle.text("Search Cell");
		selectors.infoSubtitle.text("Bayesian-inspired spatial score");
		renderInfoGrid([
			{ label: "Rank", value: `${Math.round(cell.rank * 100)} / 100` },
			{ label: "Prior", value: formatPercent(cell.priorChance) },
			{ label: "Chance", value: formatPercent(cell.finalChance) },
			{ label: "Log odds", value: Number.isFinite(cell.logOdds) ? cell.logOdds.toFixed(3) : "N/A" },
		]);

		const categoryHtml = Object.keys(cell.categoryMultipliers)
			.map((category) => `<div><span>${escapeHtml(category)}</span><strong>${escapeHtml(Number(cell.categoryMultipliers[category]).toFixed(2))}</strong></div>`)
			.join("");
		const contributionHtml = cell.contributions.length
			? cell.contributions.map((contribution) => `
				<div class="reasoning-contribution">
					<strong>${escapeHtml(contribution.clueTitle)}</strong>
					<span>${escapeHtml(contribution.relationshipType)} ${escapeHtml(contribution.mapItemName)} | ${escapeHtml(contribution.category)} | x${escapeHtml(contribution.boost.toFixed(2))}</span>
				</div>
			`).join("")
			: '<p class="info-note">No linked evidence affects this cell yet.</p>';

		selectors.infoContent.html(`
			<div class="info-section">
				<strong>Category Multipliers</strong>
				<div class="info-detail-list">${categoryHtml}</div>
			</div>
			<div class="info-section">
				<strong>Top Contributions</strong>
				${contributionHtml}
			</div>
		`);
		selectors.featureForm.addClass("hidden");
		renderModalActions([]);
		openInfoModal();
	}

	function showClueReasoningDetails(clue) {
		const linkedMapItems = state.clueMapItems
			.filter((link) => Number(link.clue_id) === Number(clue.id))
			.map((link) => {
				const mapItem = state.features.find((item) => Number(item.id) === Number(link.map_item_id));
				return mapItem ? { link, mapItem } : null;
			})
			.filter(Boolean);

		selectors.infoKicker.text("Reasoning Board");
		selectors.infoTitle.text(clue.title || "Clue");
		selectors.infoSubtitle.text("Linked spatial evidence");
		renderInfoGrid([
			{ label: "Status", value: clue.status || "open" },
			{ label: "Confidence", value: `${Number(clue.confidence || 0)}%` },
			{ label: "Links", value: String(linkedMapItems.length) },
			{ label: "Overlay", value: state.reasoningOverlayEnabled ? "On" : "Off" },
		]);
		selectors.infoContent.html(`
			<div class="info-section">
				<strong>Linked Map Items</strong>
				${linkedMapItems.length ? linkedMapItems.map((entry) => `
					<div class="reasoning-contribution">
						<strong>${escapeHtml(entry.mapItem.name)}</strong>
						<span>${escapeHtml(entry.link.relationship_type || "supports")} | ${escapeHtml(entry.mapItem.category || "reference")} | ${escapeHtml(entry.mapItem.type || "marker")}</span>
					</div>
				`).join("") : '<p class="info-note">This clue is not linked to a map item yet.</p>'}
			</div>
		`);
		selectors.featureForm.addClass("hidden");
		renderModalActions([
			{
				label: "View Overlay",
				icon: "fa-solid fa-table-cells",
				variant: "primary",
				onClick: function () {
					viewClueOnReasoningOverlay(clue.id);
				},
			},
			{
				label: "Edit Clue",
				icon: "fa-solid fa-pen",
				variant: "cancel",
				onClick: function () {
					openClueModal(clue);
				},
			},
		]);
		openInfoModal();
	}

	function viewClueOnReasoningOverlay(clueId) {
		state.reasoningOverlayEnabled = true;
		selectors.toggleReasoningOverlay.prop("checked", true);
		scheduleReasoningOverlayUpdate(null, "Finding clue influence", function () {
			const matchingCell = state.reasoningCells
				.filter((cell) => cell.contributions.some((contribution) => Number(contribution.clueId) === Number(clueId)))
				.sort((a, b) => b.rank - a.rank)[0];
			if (matchingCell) {
				showReasoningCellDetails(matchingCell.id);
				state.map.fitBounds(turf.bbox(matchingCell.feature), { padding: 120, duration: 650 });
			} else {
				showToast("This clue has no scored spatial influence yet.", true);
			}
			saveMapState();
		});
	}

	function openFeatureEditor(feature) {
		clearTemporaryClickMarker();
		const safeFeature = {
			id: feature.id || null,
			type: feature.type,
			name: feature.name || "",
			description: feature.description || "",
			color: feature.color || "#ff6b35",
			category: feature.category || "reference",
			status: feature.status || "active",
			confidence: Number.isFinite(Number(feature.confidence)) ? Number(feature.confidence) : 50,
			geometry: feature.geometry,
			metadata: $.extend(true, {}, feature.metadata || {}),
		};

		const type = safeFeature.type;
		$("#feature-id").val(safeFeature.id ? String(safeFeature.id) : "");
		$("#feature-type").val(type);
		$("#feature-name").val(safeFeature.name);
		$("#feature-description").val(safeFeature.description);
		$("#feature-color").val(safeFeature.color);
		$("#feature-category").val(safeFeature.category);
		$("#feature-status").val(safeFeature.status);
		$("#feature-confidence").val(String(safeFeature.confidence));

		if (type === "marker") {
			$("#feature-lat").val(safeFeature.geometry.coordinates[1]);
			$("#feature-lng").val(safeFeature.geometry.coordinates[0]);
			$(".feature-point-fields").removeClass("hidden");
			$(".feature-radius-field").addClass("hidden");
		} else if (type === "circle") {
			const center = safeFeature.metadata.center || safeFeature.geometry.coordinates || safeFeature.geometry.coordinates[0][0];
			$("#feature-lat").val(center[1]);
			$("#feature-lng").val(center[0]);
			$("#feature-radius").val(metersToInputDistance(safeFeature.metadata.radius || 100));
			$(".feature-point-fields").removeClass("hidden");
			$(".feature-radius-field").removeClass("hidden");
			updateCirclePreviewFromInputs();
		} else {
			$(".feature-point-fields").addClass("hidden");
			$(".feature-radius-field").addClass("hidden");
		}

		state.pendingFeature = safeFeature;
		selectors.infoKicker.text(safeFeature.id ? "Edit Feature" : "Create Feature");
		selectors.infoTitle.text(safeFeature.id ? `Edit ${type}` : `New ${type}`);
		selectors.infoSubtitle.text(safeFeature.id ? "Adjust values and save." : "Set values and save.");
		renderInfoGrid([]);
		selectors.infoContent.removeClass("hidden").html(`
			<div class="info-section">
				<strong>Live Edit</strong>
				<p class="info-note">Use map handles, then save.</p>
			</div>
		`);
		selectors.featureForm.removeClass("hidden");
		renderModalActions([
			{
				label: "Cancel",
				icon: "fa-solid fa-arrow-left",
				variant: "cancel",
				onClick: function () {
					resetFeatureForm();
					setMode("browse");
					closeInfoModal();
				},
			},
			{
				label: "Refocus",
				icon: "fa-solid fa-crosshairs",
				variant: "success",
				onClick: function () {
					focusFeature(currentFeaturePayload());
				},
			},
			{
				label: "Save",
				icon: "fa-solid fa-floppy-disk",
				variant: "primary",
				onClick: function () {
					selectors.featureForm.trigger("submit");
				},
			},
		]);
		openInfoModal();
		activateGeometryEditor(safeFeature);
	}

	function currentFeaturePayload() {
		const type = $("#feature-type").val();
		const confidenceRaw = Number($("#feature-confidence").val());
		const confidence = window.Elevated && window.Elevated.utils
			? window.Elevated.utils.clamp(confidenceRaw, 0, 100)
			: Math.max(0, Math.min(100, Number.isFinite(confidenceRaw) ? confidenceRaw : 50));
		const base = {
			id: $("#feature-id").val() ? Number($("#feature-id").val()) : null,
			hunt_id: state.activeHuntId,
			type,
			category: $("#feature-category").val(),
			name: $("#feature-name").val().trim(),
			description: $("#feature-description").val().trim(),
			color: $("#feature-color").val(),
			status: $("#feature-status").val(),
			confidence,
			geometry: null,
			metadata: {},
		};

		if (type === "marker") {
			const lat = Number($("#feature-lat").val());
			const lng = Number($("#feature-lng").val());
			if (Number.isFinite(lat) && Number.isFinite(lng)) {
				base.geometry = { type: "Point", coordinates: [lng, lat] };
				base.metadata = { lat, lng };
			}
		}

		if (type === "circle") {
			const lat = Number($("#feature-lat").val());
			const lng = Number($("#feature-lng").val());
			const radius = inputDistanceToMeters($("#feature-radius").val());
			if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(radius) && radius > 0) {
				base.geometry = turf.circle([lng, lat], radius, { units: "meters", steps: 64 }).geometry;
				base.metadata = { center: [lng, lat], radius };
			}
		}

		if (type === "polygon" || type === "line") {
			if (state.draw && state.pendingDrawFeatureId) {
				const drawFeature = state.draw.get(state.pendingDrawFeatureId);
				if (drawFeature) {
					base.geometry = drawFeature.geometry;
				}
			}
			if (!base.geometry && state.pendingFeature && state.pendingFeature.geometry) {
				base.geometry = state.pendingFeature.geometry;
			}
		}

		return base;
	}

	function updateMapSource() {
		if (!state.mapLoaded || !state.map || !state.map.getSource("hunt-features")) {
			return;
		}

		const features = visibleFeatures().map(featureToGeoJson);
		state.map.getSource("hunt-features").setData({
			type: "FeatureCollection",
			features,
		});

		if (state.map.getSource("feature-annotations")) {
			state.map.getSource("feature-annotations").setData({
				type: "FeatureCollection",
				features: buildFeatureAnnotationFeatures(),
			});
		}
		updateReasoningOverlay();
	}

	function currentReasoningSettings() {
		return $.extend(true, {}, REASONING_DEFAULT_SETTINGS, state.reasoningSettings || {});
	}

	function safeIntersect(featureA, featureB) {
		try {
			if (typeof turf.featureCollection === "function") {
				const result = turf.intersect(turf.featureCollection([featureA, featureB]));
				if (result) {
					return result;
				}
			}
		} catch (error) {
			// Turf versions differ on intersect signature.
		}

		try {
			return turf.intersect(featureA, featureB);
		} catch (error) {
			return null;
		}
	}

	function spatialInfluence(cellCenter, mapItem) {
		const geometry = featureDisplayGeometry(mapItem);
		const point = turf.point(cellCenter);

		if (geometry.type === "Point") {
			const distanceKm = turf.distance(point, turf.point(geometry.coordinates), { units: "kilometers" });
			return Math.exp(-distanceKm / 25);
		}

		if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
			const polygon = { type: "Feature", geometry, properties: {} };
			if (turf.booleanPointInPolygon(point, polygon)) {
				return 1;
			}
			const boundary = turf.polygonToLine(polygon);
			const distanceKm = turf.pointToLineDistance(point, boundary, { units: "kilometers" });
			return Math.exp(-distanceKm / 20);
		}

		if (geometry.type === "LineString") {
			const line = { type: "Feature", geometry, properties: {} };
			const distanceKm = turf.pointToLineDistance(point, line, { units: "kilometers" });
			return Math.exp(-distanceKm / 15);
		}

		return 0;
	}

	function clueRelationshipCategory(mapItem, relationshipType) {
		if (relationshipType === "contradicts") {
			return "negative";
		}
		if (mapItem.category === "search_area" || mapItem.category === "route") {
			return "terrain";
		}
		return "text";
	}

	function buildReasoningEvidenceItems() {
		const cluesById = new Map();
		const mapItemsById = new Map();

		state.clues
			.filter((clue) => Number(clue.hunt_id) === Number(state.activeHuntId))
			.forEach((clue) => cluesById.set(Number(clue.id), clue));

		state.features
			.filter((feature) => Number(feature.hunt_id) === Number(state.activeHuntId))
			.forEach((feature) => mapItemsById.set(Number(feature.id), feature));

		return state.clueMapItems.map((link) => {
			const clue = cluesById.get(Number(link.clue_id));
			const mapItem = mapItemsById.get(Number(link.map_item_id));
			if (!clue || !mapItem) {
				return null;
			}

			const relationshipType = link.relationship_type || "supports";
			return {
				clue,
				mapItem,
				relationshipType,
				baseBoost: REASONING_BASE_BOOSTS[relationshipType] || REASONING_BASE_BOOSTS.supports,
				confidence: Math.max(0, Math.min(1, Number(clue.confidence || 50) / 100)),
				category: clueRelationshipCategory(mapItem, relationshipType),
			};
		}).filter(Boolean);
	}

	function estimateReasoningHexCount(bbox, cellSideKm) {
		const bboxAreaKm2 = turf.area(turf.bboxPolygon(bbox)) / 1000000;
		const hexAreaKm2 = (3 * Math.sqrt(3) / 2) * Math.pow(Math.max(cellSideKm, 0.1), 2);
		if (!Number.isFinite(bboxAreaKm2) || !Number.isFinite(hexAreaKm2) || hexAreaKm2 <= 0) {
			return Number.POSITIVE_INFINITY;
		}
		return Math.ceil(bboxAreaKm2 / hexAreaKm2);
	}

	function scoreReasoningCell(hexFeature, priorChance, index, evidenceItems) {
		const settings = currentReasoningSettings();
		const center = turf.center(hexFeature).geometry.coordinates;
		const startingOdds = priorChance > 0 && priorChance < 1 ? priorChance / (1 - priorChance) : 0;
		const categoryProducts = { text: 1, terrain: 1, negative: 1 };
		const categoryCounts = { text: 0, terrain: 0, negative: 0 };
		const contributions = [];

		evidenceItems.forEach((evidence) => {
			const influence = spatialInfluence(center, evidence.mapItem);
			if (influence < 0.02) {
				return;
			}

			const effectiveBoost = 1 + (evidence.baseBoost - 1) * evidence.confidence * influence;
			const category = evidence.category;
			categoryCounts[category] += 1;
			const repeatedBoost = effectiveBoost * Math.pow(settings.repeat_decay, Math.max(0, categoryCounts[category] - 1));
			categoryProducts[category] *= repeatedBoost;
			contributions.push({
				clueId: evidence.clue.id,
				mapItemId: evidence.mapItem.id,
				clueTitle: evidence.clue.title,
				mapItemName: evidence.mapItem.name,
				relationshipType: evidence.relationshipType,
				category,
				boost: repeatedBoost,
				influence,
			});
		});

		const cappedCategories = {};
		Object.keys(categoryProducts).forEach((category) => {
			if (category === "negative") {
				cappedCategories[category] = Math.max(categoryProducts[category], settings.negative_floor);
				return;
			}
			const cap = Number(settings.category_caps && settings.category_caps[category]) || 8;
			cappedCategories[category] = Math.min(categoryProducts[category], cap);
		});

		const categoryMultiplier = Object.values(cappedCategories).reduce((product, value) => product * value, 1);
		const finalOdds = startingOdds * categoryMultiplier;
		const finalChance = finalOdds / (1 + finalOdds);
		const logOdds = finalOdds > 0 ? Math.log(finalOdds) : Number.NEGATIVE_INFINITY;

		return {
			id: `hex-${index}`,
			feature: hexFeature,
			priorChance,
			finalChance,
			logOdds,
			categoryMultipliers: cappedCategories,
			contributions: contributions.sort((a, b) => Math.abs(b.boost - 1) - Math.abs(a.boost - 1)).slice(0, 8),
		};
	}

	function buildReasoningCells() {
		const hunt = currentHunt();
		state.reasoningOverlayWarning = "";
		if (!hunt || !hunt.search_area) {
			return [];
		}

		const settings = currentReasoningSettings();
		const searchFeature = { type: "Feature", geometry: hunt.search_area, properties: {} };
		const bbox = turf.bbox(searchFeature);
		const estimatedCells = estimateReasoningHexCount(bbox, settings.cell_side_km);
		if (estimatedCells > REASONING_MAX_HEX_CANDIDATES) {
			state.reasoningOverlayWarning = `Cell size too small: ${estimatedCells.toLocaleString()} cells`;
			showToast(`Reasoning overlay would generate about ${estimatedCells.toLocaleString()} cells. Increase cell size to keep the map responsive.`, true);
			return [];
		}

		const grid = turf.hexGrid(bbox, settings.cell_side_km, { units: "kilometers" });
		const candidates = (grid.features || []).map((hexFeature, index) => {
			const intersection = safeIntersect(hexFeature, searchFeature);
			if (!intersection) {
				return null;
			}
			const cellArea = turf.area(hexFeature);
			const insideArea = turf.area(intersection);
			const inBoundsFraction = cellArea > 0 ? Math.max(0, Math.min(1, insideArea / cellArea)) : 0;
			if (inBoundsFraction <= 0) {
				return null;
			}
			return { hexFeature, inBoundsFraction, index };
		}).filter(Boolean);

		const totalFraction = candidates.reduce((sum, cell) => sum + cell.inBoundsFraction, 0);
		if (totalFraction <= 0) {
			return [];
		}

		const evidenceItems = buildReasoningEvidenceItems();
		const scoredCells = candidates.map((cell, index) => scoreReasoningCell(cell.hexFeature, cell.inBoundsFraction / totalFraction, index, evidenceItems));
		const finiteScores = scoredCells.map((cell) => cell.finalChance).filter(Number.isFinite);
		const minScore = Math.min(...finiteScores);
		const maxScore = Math.max(...finiteScores);

		scoredCells.forEach((cell) => {
			const range = maxScore - minScore;
			const rank = range > 0 ? (cell.finalChance - minScore) / range : 0.5;
			cell.rank = rank;
			cell.feature.properties = {
				cellId: cell.id,
				rank,
				priorChance: cell.priorChance,
				finalChance: cell.finalChance,
				logOdds: Number.isFinite(cell.logOdds) ? cell.logOdds : -999,
				selected: false,
			};
		});

		return scoredCells;
	}

	function updateReasoningSummary(message) {
		selectors.reasoningSummary.text(message);
	}

	function syncReasoningSettingsForm() {
		const settings = currentReasoningSettings();
		$("#reasoning-cell-side").val(settings.cell_side_km);
		$("#reasoning-repeat-decay").val(settings.repeat_decay);
		$("#reasoning-category-cap").val(settings.category_caps.text);
		$("#reasoning-negative-floor").val(settings.negative_floor);
	}

	function loadReasoningSettings() {
		if (!state.activeHuntId) {
			state.reasoningSettings = $.extend(true, {}, REASONING_DEFAULT_SETTINGS);
			syncReasoningSettingsForm();
			updateReasoningOverlay();
			return $.Deferred().resolve(state.reasoningSettings).promise();
		}

		return apiRequest("GET", "reasoning-settings", null, { hunt_id: state.activeHuntId })
			.then(function (settings) {
				state.reasoningSettings = $.extend(true, {}, REASONING_DEFAULT_SETTINGS, settings || {});
				syncReasoningSettingsForm();
				updateReasoningOverlay();
				return state.reasoningSettings;
			})
			.catch(function () {
				state.reasoningSettings = $.extend(true, {}, REASONING_DEFAULT_SETTINGS);
				syncReasoningSettingsForm();
				updateReasoningOverlay();
				return state.reasoningSettings;
			});
	}

	function saveReasoningSettings(event) {
		event.preventDefault();
		if (!ensureActiveHunt()) {
			return;
		}

		const categoryCap = Number($("#reasoning-category-cap").val());
		const payload = {
			cell_side_km: Number($("#reasoning-cell-side").val()),
			repeat_decay: Number($("#reasoning-repeat-decay").val()),
			category_caps: {
				text: categoryCap,
				terrain: categoryCap,
				negative: Number($("#reasoning-negative-floor").val()),
			},
			negative_floor: Number($("#reasoning-negative-floor").val()),
		};

		setBusyStatus("Saving reasoning settings");
		apiRequest("PATCH", "reasoning-settings", payload, { hunt_id: state.activeHuntId })
			.then(function (settings) {
				state.reasoningSettings = $.extend(true, {}, REASONING_DEFAULT_SETTINGS, settings || {});
				syncReasoningSettingsForm();
				scheduleReasoningOverlayUpdate(null, "Recalculating reasoning overlay");
				showToast("Reasoning settings updated.");
			})
			.catch(function (error) {
				clearBusyStatus("Save failed");
				handleAjaxError(error);
			});
	}

	function resetReasoningSettings() {
		state.reasoningSettings = $.extend(true, {}, REASONING_DEFAULT_SETTINGS);
		syncReasoningSettingsForm();
		if (!state.activeHuntId) {
			updateReasoningOverlay();
			return;
		}
		setBusyStatus("Resetting reasoning settings");
		apiRequest("PATCH", "reasoning-settings", state.reasoningSettings, { hunt_id: state.activeHuntId })
			.then(function (settings) {
				state.reasoningSettings = $.extend(true, {}, REASONING_DEFAULT_SETTINGS, settings || {});
				syncReasoningSettingsForm();
				scheduleReasoningOverlayUpdate(null, "Recalculating reasoning overlay");
				showToast("Reasoning settings reset.");
			})
			.catch(function (error) {
				clearBusyStatus("Reset failed");
				handleAjaxError(error);
			});
	}

	function updateReasoningOverlay(selectedCellId) {
		if (!state.mapLoaded || !state.map || !state.map.getSource("reasoning-hexes")) {
			return;
		}

		if (!state.reasoningOverlayEnabled) {
			state.reasoningOverlayWarning = "";
			state.reasoningCells = [];
			state.reasoningCellsById = {};
			state.map.getSource("reasoning-hexes").setData({ type: "FeatureCollection", features: [] });
			applyReasoningOverlayVisibility();
			updateReasoningSummary("Off");
			return;
		}

		const hunt = currentHunt();
		if (!hunt || !hunt.search_area) {
			state.reasoningOverlayWarning = "";
			state.reasoningCells = [];
			state.reasoningCellsById = {};
			state.map.getSource("reasoning-hexes").setData({ type: "FeatureCollection", features: [] });
			applyReasoningOverlayVisibility();
			updateReasoningSummary("Search area required");
			setStatus("Search area required");
			showToast("Draw a hunt search area before using the reasoning overlay.", true);
			return;
		}

		state.reasoningCells = buildReasoningCells();
		state.reasoningCellsById = {};
		const features = state.reasoningCells.map((cell) => {
			state.reasoningCellsById[cell.id] = cell;
			cell.feature.properties.selected = selectedCellId === cell.id;
			return cell.feature;
		});
		state.map.getSource("reasoning-hexes").setData({ type: "FeatureCollection", features });
		applyReasoningOverlayVisibility();
		updateReasoningSummary(state.reasoningOverlayWarning || `${features.length} cells`);
		if (state.reasoningOverlayWarning) {
			setStatus(state.reasoningOverlayWarning);
		}
	}

	function reasoningOverlayStatusMessage() {
		if (!state.reasoningOverlayEnabled) {
			return "Ready";
		}

		const hunt = currentHunt();
		if (!hunt || !hunt.search_area) {
			return "Search area required";
		}

		if (state.reasoningOverlayWarning) {
			return state.reasoningOverlayWarning;
		}

		return `${state.reasoningCells.length} reasoning cells ready`;
	}

	function scheduleReasoningOverlayUpdate(selectedCellId, message, onComplete) {
		window.clearTimeout(state.reasoningOverlayTimer);
		const requestId = state.reasoningOverlayRequestId + 1;
		state.reasoningOverlayRequestId = requestId;

		if (!state.reasoningOverlayEnabled) {
			updateReasoningOverlay(selectedCellId);
			clearBusyStatus("Ready");
			if (typeof onComplete === "function") {
				onComplete();
			}
			return;
		}

		setBusyStatus(message || "Calculating reasoning overlay");
		state.reasoningOverlayTimer = window.setTimeout(function () {
			if (requestId !== state.reasoningOverlayRequestId) {
				return;
			}

			try {
				updateReasoningOverlay(selectedCellId);
				clearBusyStatus(reasoningOverlayStatusMessage());
				if (typeof onComplete === "function") {
					onComplete();
				}
			} catch (error) {
				clearBusyStatus("Reasoning overlay failed");
				showToast("Reasoning overlay failed to calculate.", true);
				throw error;
			}
		}, 30);
	}

	function buildFeatureAnnotationFeatures() {
		return visibleFeatures()
			.filter((feature) => feature.type === "circle")
			.map((feature) => {
				const center = feature.metadata && Array.isArray(feature.metadata.center) ? feature.metadata.center : null;
				const radius = Number(feature.metadata && feature.metadata.radius);
				if (!center || !Number.isFinite(radius) || radius <= 0) {
					return null;
				}
				return {
					type: "Feature",
					geometry: {
						type: "Point",
						coordinates: turf.destination(center, radius / 1000, 90, { units: "kilometers" }).geometry.coordinates,
					},
					properties: { label: formatDistance(radius) },
				};
			})
			.filter(Boolean);
	}

	function addMapSourcesAndLayers() {
		state.map.addSource("hunt-features", {
			type: "geojson",
			data: { type: "FeatureCollection", features: [] },
		});

		state.map.addSource("hunt-search-area", {
			type: "geojson",
			data: { type: "FeatureCollection", features: [] },
		});

		state.map.addSource("grid-lines", {
			type: "geojson",
			data: { type: "FeatureCollection", features: [] },
		});

		state.map.addSource("grid-labels", {
			type: "geojson",
			data: { type: "FeatureCollection", features: [] },
		});

		state.map.addSource("measurements", {
			type: "geojson",
			data: { type: "FeatureCollection", features: [] },
		});

		state.map.addSource("measurement-labels", {
			type: "geojson",
			data: { type: "FeatureCollection", features: [] },
		});

		state.map.addSource("bearing-angle", {
			type: "geojson",
			data: { type: "FeatureCollection", features: [] },
		});

		state.map.addSource("bearing-labels", {
			type: "geojson",
			data: { type: "FeatureCollection", features: [] },
		});

		state.map.addSource("circle-preview", {
			type: "geojson",
			data: { type: "FeatureCollection", features: [] },
		});

		state.map.addSource("circle-preview-label", {
			type: "geojson",
			data: { type: "FeatureCollection", features: [] },
		});

		state.map.addSource("feature-annotations", {
			type: "geojson",
			data: { type: "FeatureCollection", features: [] },
		});

		state.map.addSource("reasoning-hexes", {
			type: "geojson",
			data: { type: "FeatureCollection", features: [] },
		});

		state.map.addLayer({
			id: "hunt-polygons-fill",
			type: "fill",
			source: "hunt-features",
			filter: ["==", ["geometry-type"], "Polygon"],
			paint: {
				"fill-color": ["get", "color"],
				"fill-opacity": 0.18,
			},
		});

		state.map.addLayer({
			id: "hunt-polygons-line",
			type: "line",
			source: "hunt-features",
			filter: ["==", ["geometry-type"], "Polygon"],
			paint: {
				"line-color": ["get", "color"],
				"line-width": 2,
			},
		});

		state.map.addLayer({
			id: "hunt-lines",
			type: "line",
			source: "hunt-features",
			filter: ["==", ["geometry-type"], "LineString"],
			paint: {
				"line-color": ["get", "color"],
				"line-width": 3,
			},
		});

		state.map.addLayer({
			id: "hunt-search-area-fill",
			type: "fill",
			source: "hunt-search-area",
			paint: {
				"fill-color": "#9be5c7",
				"fill-opacity": 0.08,
			},
			layout: {
				visibility: "none",
			},
		});

		state.map.addLayer({
			id: "hunt-search-area-line",
			type: "line",
			source: "hunt-search-area",
			paint: {
				"line-color": "#9be5c7",
				"line-width": 2,
				"line-dasharray": [2, 1.2],
			},
			layout: {
				visibility: "none",
			},
		});

		state.map.addLayer({
			id: "hunt-markers-circle",
			type: "circle",
			source: "hunt-features",
			filter: ["==", ["geometry-type"], "Point"],
			paint: {
				"circle-radius": 8,
				"circle-color": ["get", "color"],
				"circle-stroke-color": "#ffffff",
				"circle-stroke-width": 2,
			},
		});

		state.map.addLayer({
			id: "hunt-markers-label",
			type: "symbol",
			source: "hunt-features",
			filter: ["==", ["geometry-type"], "Point"],
			layout: {
				"text-field": ["get", "name"],
				"text-offset": [0, 1.2],
				"text-anchor": "top",
				"text-size": 12,
			},
			paint: {
				"text-color": "#f3f6ef",
				"text-halo-color": "#101416",
				"text-halo-width": 1.2,
			},
		});

		state.map.addLayer({
			id: "grid-lines-layer",
			type: "line",
			source: "grid-lines",
			paint: {
				"line-color": "#f7b267",
				"line-opacity": 0.32,
				"line-width": 1,
			},
		});

		state.map.addLayer({
			id: "grid-labels-layer",
			type: "symbol",
			source: "grid-labels",
			layout: {
				"text-field": ["get", "label"],
				"text-size": 10,
				"text-font": ["Open Sans Bold"],
				"text-anchor": "center",
			},
			paint: {
				"text-color": "#f3f6ef",
				"text-halo-color": "#101416",
				"text-halo-width": 0.9,
			},
		});

		state.map.addLayer({
			id: "measurement-line",
			type: "line",
			source: "measurements",
			filter: ["==", ["geometry-type"], "LineString"],
			paint: {
				"line-color": "#5ed2a0",
				"line-width": 3,
			},
		});

		state.map.addLayer({
			id: "measurement-points-layer",
			type: "circle",
			source: "measurements",
			filter: ["==", ["geometry-type"], "Point"],
			paint: {
				"circle-radius": 5,
				"circle-color": "#5ed2a0",
			},
		});

		state.map.addLayer({
			id: "measurement-labels-layer",
			type: "symbol",
			source: "measurement-labels",
			layout: {
				"text-field": ["get", "label"],
				"text-size": ["case", ["==", ["get", "emphasis"], "total"], 12, 11],
				"text-font": ["Open Sans Bold"],
				"text-anchor": "center",
			},
			paint: {
				"text-color": "#f7fff9",
				"text-halo-color": "#0a0e10",
				"text-halo-width": 1.4,
			},
		});

		state.map.addLayer({
			id: "reasoning-hexes-fill",
			type: "fill",
			source: "reasoning-hexes",
			paint: {
				"fill-color": [
					"interpolate",
					["linear"],
					["get", "rank"],
					0, "#1b1d22",
					0.35, "#39556d",
					0.65, "#c4943f",
					1, "#d03740",
				],
				"fill-opacity": ["case", ["boolean", ["get", "selected"], false], 0.82, 0.54],
			},
			layout: { visibility: "none" },
		});

		state.map.addLayer({
			id: "reasoning-hexes-line",
			type: "line",
			source: "reasoning-hexes",
			paint: {
				"line-color": ["case", ["boolean", ["get", "selected"], false], "#ffffff", "rgba(255,255,255,0.34)"],
				"line-width": ["case", ["boolean", ["get", "selected"], false], 2.4, 0.8],
			},
			layout: { visibility: "none" },
		});

		state.map.on("click", "reasoning-hexes-fill", function (event) {
			if (!state.reasoningOverlayEnabled || !event.features.length) {
				return;
			}
			const cellId = event.features[0].properties ? event.features[0].properties.cellId : null;
			if (cellId) {
				showReasoningCellDetails(String(cellId));
			}
		});

		state.map.addLayer({
			id: "bearing-angle-line",
			type: "line",
			source: "bearing-angle",
			filter: ["==", ["geometry-type"], "LineString"],
			paint: {
				"line-color": "#d03740",
				"line-width": 3,
				"line-dasharray": [1.2, 0.8],
			},
		});

		state.map.addLayer({
			id: "bearing-angle-points",
			type: "circle",
			source: "bearing-angle",
			filter: ["==", ["geometry-type"], "Point"],
			paint: {
				"circle-radius": 5,
				"circle-color": "#d03740",
				"circle-stroke-color": "#ffffff",
				"circle-stroke-width": 1,
			},
		});

		state.map.addLayer({
			id: "bearing-angle-labels-layer",
			type: "symbol",
			source: "bearing-labels",
			layout: {
				"text-field": ["get", "label"],
				"text-size": 11,
				"text-font": ["Open Sans Bold"],
				"text-anchor": "center",
			},
			paint: {
				"text-color": "#ffffff",
				"text-halo-color": "#08090b",
				"text-halo-width": 1.6,
			},
		});

		state.map.addLayer({
			id: "circle-preview-fill",
			type: "fill",
			source: "circle-preview",
			paint: {
				"fill-color": "#ff6b35",
				"fill-opacity": 0.14,
			},
		});

		state.map.addLayer({
			id: "circle-preview-line",
			type: "line",
			source: "circle-preview",
			paint: {
				"line-color": "#ff6b35",
				"line-width": 2,
			},
		});

		state.map.addLayer({
			id: "circle-preview-label-layer",
			type: "symbol",
			source: "circle-preview-label",
			layout: {
				"text-field": ["get", "label"],
				"text-size": 12,
				"text-font": ["Open Sans Bold"],
			},
			paint: {
				"text-color": "#fff1e8",
				"text-halo-color": "#0a0e10",
				"text-halo-width": 1.4,
			},
		});

		state.map.addLayer({
			id: "feature-annotations-layer",
			type: "symbol",
			source: "feature-annotations",
			layout: {
				"text-field": ["get", "label"],
				"text-size": 12,
				"text-font": ["Open Sans Bold"],
			},
			paint: {
				"text-color": "#fff1e8",
				"text-halo-color": "#0a0e10",
				"text-halo-width": 1.4,
			},
		});

	}

	function ensureMapboxStreetsSource() {
		if (state.map.getSource(MAPBOX_STREETS_SOURCE_ID)) {
			return;
		}

		state.map.addSource(MAPBOX_STREETS_SOURCE_ID, {
			type: "vector",
			url: "mapbox://mapbox.mapbox-streets-v8",
		});
	}

	function addParkAndBorderLayers() {
		ensureMapboxStreetsSource();

		const beforeId = state.map.getLayer("hunt-polygons-fill") ? "hunt-polygons-fill" : undefined;
		const worldviewFilter = ["match", ["coalesce", ["get", "worldview"], "all"], ["all", "US"], true, false];
		const layers = PUBLIC_LAND_LAYER_DEFINITIONS.reduce((items, definition) => items.concat([
			{
				id: definition.layerId,
				type: "fill",
				source: MAPBOX_STREETS_SOURCE_ID,
				"source-layer": definition.sourceLayer,
				minzoom: definition.minzoom,
				filter: definition.filter,
				paint: definition.fillPaint,
			},
			{
				id: definition.outlineLayerId,
				type: "line",
				source: MAPBOX_STREETS_SOURCE_ID,
				"source-layer": definition.sourceLayer,
				minzoom: definition.minzoom,
				filter: definition.filter,
				paint: definition.linePaint,
			},
		]), [
			{
				id: "admin-country-boundary-overlay",
				type: "line",
				source: MAPBOX_STREETS_SOURCE_ID,
				"source-layer": "admin",
				filter: [
					"all",
					["==", ["geometry-type"], "LineString"],
					["==", ["get", "admin_level"], 0],
					["==", ["get", "maritime"], "false"],
					["==", ["get", "disputed"], "false"],
					worldviewFilter,
				],
				paint: {
					"line-color": "#ffe38b",
					"line-opacity": 0.95,
					"line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.6, 4, 1, 8, 1.8, 12, 2.4],
				},
			},
			{
				id: "admin-region-boundary-overlay",
				type: "line",
				source: MAPBOX_STREETS_SOURCE_ID,
				"source-layer": "admin",
				minzoom: 3,
				filter: [
					"all",
					["==", ["geometry-type"], "LineString"],
					["==", ["get", "admin_level"], 1],
					["==", ["get", "maritime"], "false"],
					["==", ["get", "disputed"], "false"],
					worldviewFilter,
				],
				paint: {
					"line-color": "#fff7d1",
					"line-opacity": 0.55,
					"line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.4, 6, 0.9, 10, 1.4],
					"line-dasharray": [2, 1.4],
				},
			},
		]);

		layers.forEach((layer) => {
			if (!state.map.getLayer(layer.id)) {
				state.map.addLayer(layer, beforeId);
			}
		});
	}

	function addContourLayers() {
		ensureTerrainVectorSource();

		const beforeId = state.map.getLayer("hunt-polygons-fill") ? "hunt-polygons-fill" : undefined;
		const contourLineLayer = {
			id: "terrain-contour-lines",
			type: "line",
			source: MAPBOX_TERRAIN_SOURCE_ID,
			"source-layer": "contour",
			minzoom: 9,
			filter: ["all", [">=", ["get", "index"], 1]],
			paint: {
				"line-color": ["case", [">=", ["get", "index"], 5], "#f5f1df", "#d2c6aa"],
				"line-opacity": ["case", [">=", ["get", "index"], 5], 0.68, 0.38],
				"line-width": ["case", [">=", ["get", "index"], 5], 1.3, 0.75],
			},
		};
		const contourLabelLayer = {
			id: "terrain-contour-labels",
			type: "symbol",
			source: MAPBOX_TERRAIN_SOURCE_ID,
			"source-layer": "contour",
			minzoom: 11,
			filter: ["all", [">=", ["get", "index"], 5], [">", ["get", "ele"], 0]],
			layout: {
				"symbol-placement": "line",
				"symbol-spacing": 350,
				"text-field": [
					"concat",
					["to-string", ["round", ["*", ["get", "ele"], 3.28084]]],
					" ft",
				],
				"text-size": 10,
				"text-font": ["Open Sans Regular"],
			},
			paint: {
				"text-color": "#f9f4e8",
				"text-halo-color": "rgba(7, 15, 22, 0.9)",
				"text-halo-width": 1,
				"text-opacity": 0.72,
			},
		};

		if (!state.map.getLayer(contourLineLayer.id)) {
			state.map.addLayer(contourLineLayer, beforeId);
		}
		if (!state.map.getLayer(contourLabelLayer.id)) {
			state.map.addLayer(contourLabelLayer, beforeId);
		}
	}

	function collectRoadLayerIds() {
		const style = state.map.getStyle();
		state.roadLayerIds = (style.layers || [])
			.filter((layer) => {
				const id = layer.id || "";
				const sourceLayer = layer["source-layer"] || "";
				return /(road|street|highway|motorway|path|bridge|tunnel)/i.test(id + " " + sourceLayer);
			})
			.map((layer) => layer.id);
	}

	function collectPeakLabelLayers() {
		const style = state.map.getStyle();
		state.peakLabelLayers = (style.layers || [])
			.filter((layer) => layer.id === "natural-point-label" && layer.type === "symbol" && layer["source-layer"] === "natural_label")
			.map((layer) => ({
				id: layer.id,
				filter: layer.filter ? JSON.parse(JSON.stringify(layer.filter)) : null,
			}));
	}

	function buildPeakSuppressedFilter(originalFilter) {
		if (originalFilter) {
			return [
				"all",
				originalFilter,
				["!=", ["get", "class"], "landform"],
				["!=", ["get", "class"], "disputed_landform"],
			];
		}

		return [
			"all",
			["!=", ["get", "class"], "landform"],
			["!=", ["get", "class"], "disputed_landform"],
		];
	}

	function applyPeakLabelVisibility() {
		if (!state.mapLoaded) {
			return;
		}

		const showPeaks = selectors.togglePeaks.is(":checked");
		state.preferences.peakLabels = showPeaks;
		state.peakLabelLayers.forEach((layerConfig) => {
			if (!state.map.getLayer(layerConfig.id)) {
				return;
			}
			state.map.setFilter(layerConfig.id, showPeaks ? layerConfig.filter : buildPeakSuppressedFilter(layerConfig.filter));
		});
	}

	function ensureTerrainDemSource() {
		if (state.map.getSource("mapbox-dem")) {
			return true;
		}

		try {
			state.map.addSource("mapbox-dem", {
				type: "raster-dem",
				url: "mapbox://mapbox.mapbox-terrain-dem-v1",
				tileSize: 512,
				maxzoom: 14,
			});
			return true;
		} catch (error) {
			showToast("3D terrain source could not be added.", true);
			return false;
		}
	}

	function applyTerrainState(options) {
		if (!state.map || !state.mapLoaded) {
			return;
		}

		const terrainEnabled = selectors.toggleTerrain.is(":checked");
		state.preferences.terrain3d = terrainEnabled;
		if (terrainEnabled) {
			if (!ensureTerrainDemSource()) {
				selectors.toggleTerrain.prop("checked", false);
				state.preferences.terrain3d = false;
				return;
			}
			try {
				if (typeof state.map.setProjection === "function") {
					state.map.setProjection("mercator");
				}
				state.map.setTerrain({ source: "mapbox-dem", exaggeration: 1.35 });
			} catch (error) {
				showToast("3D terrain is unavailable for the current map style.", true);
				selectors.toggleTerrain.prop("checked", false);
				state.preferences.terrain3d = false;
				return;
			}
			if (options && options.reveal && state.map.getPitch() < 35) {
				state.map.easeTo({ pitch: 58, bearing: state.map.getBearing(), duration: 700 });
			}
			setStatus("3D terrain enabled");
			return;
		}

		state.map.setTerrain(null);
		setStatus("3D terrain disabled");
	}

	function applyRoadVisibility() {
		if (!state.mapLoaded) {
			return;
		}

		const visibility = selectors.toggleRoads.is(":checked") ? "visible" : "none";
		state.roadLayerIds.forEach((layerId) => {
			if (state.map.getLayer(layerId)) {
				state.map.setLayoutProperty(layerId, "visibility", visibility);
			}
		});
	}

	function applyContourVisibility() {
		if (!state.mapLoaded) {
			return;
		}

		const visibility = selectors.toggleContours.is(":checked") ? "visible" : "none";
		CONTOUR_LAYER_IDS.forEach((layerId) => {
			if (state.map.getLayer(layerId)) {
				state.map.setLayoutProperty(layerId, "visibility", visibility);
			}
		});
	}

	function applyParkAndBorderVisibility() {
		if (!state.mapLoaded) {
			return;
		}

		const masterVisible = selectors.toggleParksBorders.is(":checked");
		const publicLandVisibility = normalizePublicLandVisibility(state.preferences.publicLandVisibility);

		PUBLIC_LAND_LAYER_DEFINITIONS.forEach((definition) => {
			const visibility = masterVisible && publicLandVisibility[definition.key] ? "visible" : "none";
			[definition.layerId, definition.outlineLayerId].forEach((layerId) => {
				if (state.map.getLayer(layerId)) {
					state.map.setLayoutProperty(layerId, "visibility", visibility);
				}
			});
		});

		BORDER_LAYER_IDS.forEach((layerId) => {
			if (state.map.getLayer(layerId)) {
				state.map.setLayoutProperty(layerId, "visibility", masterVisible && publicLandVisibility.borders ? "visible" : "none");
			}
		});
	}

	function applyPublicLandOpacity() {
		if (!state.mapLoaded) {
			return;
		}

		const opacityFactor = normalizePublicLandOpacity(state.preferences.publicLandOpacity) / 100;
		PUBLIC_LAND_LAYER_DEFINITIONS.forEach((definition) => {
			if (state.map.getLayer(definition.layerId)) {
				state.map.setPaintProperty(definition.layerId, "fill-opacity", (definition.fillPaint["fill-opacity"] || 0) * opacityFactor);
			}
			if (state.map.getLayer(definition.outlineLayerId)) {
				state.map.setPaintProperty(definition.outlineLayerId, "line-opacity", (definition.linePaint["line-opacity"] || 0) * opacityFactor);
			}
		});

		BORDER_LAYER_IDS.forEach((layerId) => {
			if (state.map.getLayer(layerId)) {
				state.map.setPaintProperty(layerId, "line-opacity", BORDER_LAYER_OPACITY_DEFAULTS[layerId] * opacityFactor);
			}
		});
	}

	function updateGridOverlay() {
		if (!state.mapLoaded || !state.map.getSource("grid-lines") || !state.map.getSource("grid-labels")) {
			return;
		}

		const bounds = state.map.getBounds();
		const step = currentGridStep();
		const west = Math.floor(bounds.getWest() / step) * step;
		const east = Math.ceil(bounds.getEast() / step) * step;
		const south = Math.floor(bounds.getSouth() / step) * step;
		const north = Math.ceil(bounds.getNorth() / step) * step;
		const lineFeatures = [];
		const labelFeatures = [];

		for (let lng = west; lng <= east; lng += step) {
			lineFeatures.push({
				type: "Feature",
				geometry: {
					type: "LineString",
					coordinates: [
						[lng, south],
						[lng, north],
					],
				},
				properties: {},
			});
			for (let lat = south; lat <= north; lat += step * 2) {
				labelFeatures.push({
					type: "Feature",
					geometry: { type: "Point", coordinates: [lng, lat] },
					properties: { label: `${lat.toFixed(2)}, ${lng.toFixed(2)}` },
				});
			}
		}

		for (let lat = south; lat <= north; lat += step) {
			lineFeatures.push({
				type: "Feature",
				geometry: {
					type: "LineString",
					coordinates: [
						[west, lat],
						[east, lat],
					],
				},
				properties: {},
			});
		}

		state.map.getSource("grid-lines").setData({ type: "FeatureCollection", features: lineFeatures });
		state.map.getSource("grid-labels").setData({ type: "FeatureCollection", features: labelFeatures });
		state.map.setLayoutProperty("grid-lines-layer", "visibility", selectors.toggleGrid.is(":checked") ? "visible" : "none");
		state.map.setLayoutProperty("grid-labels-layer", "visibility", selectors.toggleCoords.is(":checked") ? "visible" : "none");
	}

	function measurementLabelFeatures() {
		const labels = [];
		if (state.measurementCoords.length < 2) {
			return labels;
		}

		for (let index = 1; index < state.measurementCoords.length; index += 1) {
			const start = state.measurementCoords[index - 1];
			const end = state.measurementCoords[index];
			const distanceMeters = turf.length(turf.lineString([start, end]), { units: "kilometers" }) * 1000;
			const midpoint = turf.midpoint(turf.point(start), turf.point(end)).geometry.coordinates;
			labels.push({
				type: "Feature",
				geometry: { type: "Point", coordinates: midpoint },
				properties: { label: formatDistance(distanceMeters), emphasis: "segment" },
			});
		}

		const totalDistance = turf.length(turf.lineString(state.measurementCoords), { units: "kilometers" }) * 1000;
		const line = turf.lineString(state.measurementCoords);
		const totalAnchor = turf.along(line, totalDistance / 2000, { units: "kilometers" }).geometry.coordinates;
		labels.push({
			type: "Feature",
			geometry: { type: "Point", coordinates: totalAnchor },
			properties: { label: `Total ${formatDistance(totalDistance)}`, emphasis: "total" },
		});
		return labels;
	}

	function updateMeasurementLayer() {
		if (!state.mapLoaded || !state.map.getSource("measurements") || !state.map.getSource("measurement-labels")) {
			return;
		}

		const features = state.measurementCoords.map((coord) => ({
			type: "Feature",
			geometry: { type: "Point", coordinates: coord },
			properties: {},
		}));

		if (state.measurementCoords.length > 1) {
			features.push({
				type: "Feature",
				geometry: { type: "LineString", coordinates: state.measurementCoords },
				properties: {},
			});
		}

		state.map.getSource("measurements").setData({ type: "FeatureCollection", features });
		state.map.getSource("measurement-labels").setData({ type: "FeatureCollection", features: measurementLabelFeatures() });
		if (state.measurementCoords.length > 1) {
			const distanceMeters = turf.length(turf.lineString(state.measurementCoords), { units: "kilometers" }) * 1000;
			setStatus(`Measure ${state.measurementCoords.length} pts | ${formatDistance(distanceMeters)}`);
		} else if (state.mode === "measure") {
			setStatus(state.measurementCoords.length ? "Measure 1 pt" : "Measure");
		}
	}

	function clearMeasurement() {
		state.measurementCoords = [];
		if (state.mapLoaded) {
			updateMeasurementLayer();
		}
	}

	function bearingLabelFeatures() {
		if (state.bearingCoords.length < 2) {
			return [];
		}

		const origin = state.bearingCoords[0];
		const target = state.bearingCoords[1];
		const midpoint = turf.midpoint(turf.point(origin), turf.point(target)).geometry.coordinates;
		const absoluteBearing = normalizedDegrees(turf.bearing(turf.point(origin), turf.point(target)));
		const relativeBearing = normalizedDegrees(absoluteBearing - state.map.getBearing());
		const distanceMeters = turf.distance(turf.point(origin), turf.point(target), { units: "kilometers" }) * 1000;
		return [{
			type: "Feature",
			geometry: { type: "Point", coordinates: midpoint },
			properties: {
				label: `Abs ${formatDegrees(absoluteBearing)} | Rel ${formatDegrees(relativeBearing)} | ${formatDistance(distanceMeters)}`,
			},
		}];
	}

	function updateBearingLayer() {
		if (!state.mapLoaded || !state.map.getSource("bearing-angle") || !state.map.getSource("bearing-labels")) {
			return;
		}

		const features = state.bearingCoords.map((coord) => ({
			type: "Feature",
			geometry: { type: "Point", coordinates: coord },
			properties: {},
		}));

		if (state.bearingCoords.length > 1) {
			features.push({
				type: "Feature",
				geometry: { type: "LineString", coordinates: state.bearingCoords },
				properties: {},
			});
		}

		state.map.getSource("bearing-angle").setData({ type: "FeatureCollection", features });
		state.map.getSource("bearing-labels").setData({ type: "FeatureCollection", features: bearingLabelFeatures() });
		if (state.bearingCoords.length > 1) {
			const origin = state.bearingCoords[0];
			const target = state.bearingCoords[1];
			const absoluteBearing = normalizedDegrees(turf.bearing(turf.point(origin), turf.point(target)));
			const relativeBearing = normalizedDegrees(absoluteBearing - state.map.getBearing());
			setStatus(`Bearing abs ${formatDegrees(absoluteBearing)} | rel ${formatDegrees(relativeBearing)}`);
		} else if (state.mode === "bearing") {
			setStatus(state.bearingCoords.length ? "Bearing origin set" : "Bearing");
		}
	}

	function updateCompassBearing() {
		if (!state.map || !selectors.mapCompassNeedle.length) {
			return;
		}
		selectors.mapCompassNeedle.css("transform", `rotate(${-state.map.getBearing()}deg)`);
	}

	function resetNorthOrTilt() {
		if (!state.map) {
			return;
		}
		const bearing = Math.abs(state.map.getBearing());
		const pitch = Math.abs(state.map.getPitch());
		if (bearing > 1) {
			state.map.easeTo({ bearing: 0, duration: 650 });
			showToast("Map reset to north.");
			return;
		}
		if (pitch > 1) {
			state.map.easeTo({ pitch: 0, duration: 650 });
			showToast("Map tilt reset.");
			return;
		}
		state.map.easeTo({ bearing: 0, pitch: 0, duration: 650 });
	}

	function toggleReasoningBoardFullscreen() {
		const boardShell = document.querySelector(".reasoning-board-shell");
		if (!boardShell) {
			return;
		}
		if (document.fullscreenElement === boardShell) {
			document.exitFullscreen().catch(() => {
				showToast("Unable to exit fullscreen.", true);
			});
			return;
		}
		boardShell.requestFullscreen().then(() => {
			window.setTimeout(renderReasoningBoard, 120);
		}).catch(() => {
			showToast("Unable to open reasoning board fullscreen.", true);
		});
	}

	function clearBearing() {
		state.bearingCoords = [];
		if (state.mapLoaded) {
			updateBearingLayer();
		}
	}

	function clearCirclePreview() {
		if (state.mapLoaded && state.map.getSource("circle-preview")) {
			state.map.getSource("circle-preview").setData({ type: "FeatureCollection", features: [] });
			state.map.getSource("circle-preview-label").setData({ type: "FeatureCollection", features: [] });
		}
	}

	function updateCirclePreviewFromInputs() {
		if (!state.mapLoaded || $("#feature-type").val() !== "circle" || !state.map.getSource("circle-preview") || !state.map.getSource("circle-preview-label")) {
			return;
		}

		const lat = Number($("#feature-lat").val());
		const lng = Number($("#feature-lng").val());
		const radius = inputDistanceToMeters($("#feature-radius").val());
		if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radius) || radius <= 0) {
			clearCirclePreview();
			return;
		}

		const circle = turf.circle([lng, lat], radius, { units: "meters", steps: 64 });
		state.map.getSource("circle-preview").setData({ type: "FeatureCollection", features: [circle] });
		state.map.getSource("circle-preview-label").setData({
			type: "FeatureCollection",
			features: [{
				type: "Feature",
				geometry: {
					type: "Point",
					coordinates: turf.destination([lng, lat], radius / 1000, 90, { units: "kilometers" }).geometry.coordinates,
				},
				properties: { label: formatDistance(radius) },
			}],
		});
	}

	function startMarkerEditing(feature) {
		if (!state.mapLoaded || !feature.geometry || feature.geometry.type !== "Point") {
			return;
		}

		const marker = registerEditorMarker(
			new mapboxgl.Marker({ element: makeEditorHandle("center"), draggable: true })
				.setLngLat(feature.geometry.coordinates)
				.addTo(state.map),
		);

		marker.on("drag", function () {
			const lngLat = marker.getLngLat();
			$("#feature-lat").val(lngLat.lat.toFixed(6));
			$("#feature-lng").val(lngLat.lng.toFixed(6));
		});
	}

	function startCircleEditing(feature) {
		if (!state.mapLoaded) {
			return;
		}

		const center = feature.metadata && Array.isArray(feature.metadata.center)
			? feature.metadata.center.slice()
			: [Number($("#feature-lng").val()), Number($("#feature-lat").val())];
		let radius = Number(feature.metadata && feature.metadata.radius) || inputDistanceToMeters($("#feature-radius").val()) || 100;
		let radiusHandle = turf.destination(center, radius / 1000, 90, { units: "kilometers" }).geometry.coordinates;

		const centerMarker = registerEditorMarker(
			new mapboxgl.Marker({ element: makeEditorHandle("center"), draggable: true })
				.setLngLat(center)
				.addTo(state.map),
		);
		const edgeMarker = registerEditorMarker(
			new mapboxgl.Marker({ element: makeEditorHandle("radius"), draggable: true })
				.setLngLat(radiusHandle)
				.addTo(state.map),
		);

		function syncCircleInputs(nextCenter, nextRadius) {
			$("#feature-lat").val(nextCenter[1].toFixed(6));
			$("#feature-lng").val(nextCenter[0].toFixed(6));
			$("#feature-radius").val(metersToInputDistance(nextRadius));
			updateCirclePreviewFromInputs();
		}

		centerMarker.on("drag", function () {
			const lngLat = centerMarker.getLngLat();
			const nextCenter = [lngLat.lng, lngLat.lat];
			radiusHandle = turf.destination(nextCenter, radius / 1000, 90, { units: "kilometers" }).geometry.coordinates;
			edgeMarker.setLngLat(radiusHandle);
			syncCircleInputs(nextCenter, radius);
		});

		edgeMarker.on("drag", function () {
			const centerLngLat = centerMarker.getLngLat();
			const edgeLngLat = edgeMarker.getLngLat();
			const nextCenter = [centerLngLat.lng, centerLngLat.lat];
			radius = turf.distance(turf.point(nextCenter), turf.point([edgeLngLat.lng, edgeLngLat.lat]), { units: "kilometers" }) * 1000;
			syncCircleInputs(nextCenter, radius);
		});

		syncCircleInputs(center, radius);
	}

	function startLinearGeometryEditing(feature) {
		if (!state.draw || !feature.geometry || (feature.geometry.type !== "Polygon" && feature.geometry.type !== "LineString")) {
			return;
		}

		clearPolygonEditing();
		const drawIds = state.draw.add({ type: "Feature", geometry: feature.geometry, properties: {} });
		state.pendingDrawFeatureId = Array.isArray(drawIds) ? drawIds[0] : drawIds;
		if (state.pendingDrawFeatureId) {
			state.draw.changeMode("direct_select", { featureId: state.pendingDrawFeatureId });
		}
	}

	function activateGeometryEditor(feature) {
		clearEditorMarkers();
		clearPolygonEditing();
		if (!state.mapLoaded || !feature) {
			return;
		}

		if (feature.type === "marker") {
			startMarkerEditing(feature);
			setStatus("Move marker");
			return;
		}

		if (feature.type === "circle") {
			startCircleEditing(feature);
			setStatus("Adjust radius");
			return;
		}

		if (feature.type === "polygon") {
			startLinearGeometryEditing(feature);
			setStatus("Edit polygon");
			return;
		}

		if (feature.type === "line") {
			startLinearGeometryEditing(feature);
			setStatus("Edit line");
		}
	}

	function focusFeature(feature) {
		const geometry = featureDisplayGeometry(feature);
		const bounds = turf.bbox({ type: "Feature", geometry, properties: {} });
		if (geometry.type === "Point") {
			state.map.flyTo({ center: geometry.coordinates, zoom: Math.max(state.map.getZoom(), 14), essential: true });
		} else {
			state.map.fitBounds(bounds, { padding: 100, duration: 900 });
		}
	}

	function setMode(nextMode) {
		state.mode = nextMode;
		syncModeBadge();
		if (nextMode !== "polygon" && nextMode !== "hunt-area") {
			clearPolygonEditing();
		}

		if (state.draw) {
			state.draw.changeMode("simple_select");
		}

		if (state.map) {
			if (nextMode === "measure" || nextMode === "bearing") {
				state.map.doubleClickZoom.disable();
				setStatus(nextMode === "measure" ? "Measure" : "Bearing");
			} else {
				state.map.doubleClickZoom.enable();
			}
		}

		if (nextMode === "browse") {
			setStatus("Ready");
		}
		if (nextMode === "add-marker") {
			setStatus("Place marker");
		}
		if (nextMode === "add-circle") {
			setStatus("Place radius");
		}
		if (nextMode === "bearing") {
			clearBearing();
			setStatus("Bearing");
		}
		if (nextMode === "add-line") {
			setStatus("Draw line");
			if (state.draw) {
				state.draw.changeMode("draw_line_string");
			}
		}
		if (nextMode === "polygon") {
			setStatus("Draw polygon");
			if (state.draw) {
				state.draw.changeMode("draw_polygon");
			}
		}
		if (nextMode === "hunt-area") {
			setStatus("Draw hunt area");
			if (state.draw) {
				state.draw.changeMode("draw_polygon");
			}
		}
	}

	function handleMapClick(event) {
		if (state.ignoreNextMapClick) {
			state.ignoreNextMapClick = false;
			return;
		}

		if (state.mode === "polygon" || state.mode === "hunt-area" || state.mode === "add-line") {
			return;
		}

		if (state.mode === "browse" && state.mapLoaded) {
			const rendered = state.map.queryRenderedFeatures(event.point, {
				layers: ["hunt-markers-circle", "hunt-polygons-fill", "hunt-polygons-line", "hunt-lines"],
			});
			if (rendered.length) {
				const featureId = rendered[0].properties ? Number(rendered[0].properties.featureId) : null;
				const feature = state.features.find((item) => item.id === featureId);
				if (feature) {
					showFeatureDetails(feature);
					return;
				}
			}

			showLocationDetails(event.lngLat, queryPublicLandFeatures(event.point));
			return;
		}

		if (state.mode === "add-marker") {
			if (!ensureActiveHunt()) {
				return;
			}
			openFeatureEditor({
				type: "marker",
				name: "",
				description: "",
				color: "#ff6b35",
				geometry: { type: "Point", coordinates: [event.lngLat.lng, event.lngLat.lat] },
				metadata: {},
			});
			$("#feature-lat").val(event.lngLat.lat.toFixed(6));
			$("#feature-lng").val(event.lngLat.lng.toFixed(6));
			return;
		}

		if (state.mode === "add-circle") {
			if (!ensureActiveHunt()) {
				return;
			}
			openFeatureEditor({
				type: "circle",
				name: "",
				description: "",
				color: "#ff6b35",
				geometry: { type: "Polygon", coordinates: [] },
				metadata: { center: [event.lngLat.lng, event.lngLat.lat], radius: 100 },
			});
			$("#feature-lat").val(event.lngLat.lat.toFixed(6));
			$("#feature-lng").val(event.lngLat.lng.toFixed(6));
			$("#feature-radius").val(metersToInputDistance(100));
			updateCirclePreviewFromInputs();
			return;
		}

		if (state.mode === "measure") {
			state.measurementCoords.push([event.lngLat.lng, event.lngLat.lat]);
			updateMeasurementLayer();
			return;
		}

		if (state.mode === "bearing") {
			const nextCoord = [event.lngLat.lng, event.lngLat.lat];
			if (state.bearingCoords.length >= 2) {
				state.bearingCoords = [nextCoord];
			} else {
				state.bearingCoords.push(nextCoord);
			}
			updateBearingLayer();
			return;
		}

		showLocationDetails(event.lngLat, queryPublicLandFeatures(event.point));
	}

	function bindMapEvents() {
		state.map.on("click", handleMapClick);

		state.map.on("moveend", function () {
			updateGridOverlay();
			updateBearingLayer();
			updateCompassBearing();
			saveMapState();
		});

		state.map.on("zoomend", updateGridOverlay);
		state.map.on("rotate", updateCompassBearing);
		state.map.on("rotateend", function () {
			updateCompassBearing();
			updateBearingLayer();
			saveMapState();
		});
		state.map.on("pitchend", saveMapState);

		state.map.on("draw.create", function (event) {
			if (state.mode === "hunt-area") {
				state.pendingHuntAreaDrawId = event.features[0].id;
				if (!state.huntDraft) {
					state.huntDraft = { id: null, name: "", description: "", search_area: null };
				}
				state.huntDraft.search_area = event.features[0].geometry;
				syncHuntAreaSummary();
				state.ignoreNextMapClick = true;
				setMode("browse");
				openHuntModal(null);
				showToast("Search area captured.");
				return;
			}

			if (state.mode !== "polygon" && state.mode !== "add-line") {
				return;
			}
			if (!ensureActiveHunt()) {
				state.draw.delete(event.features[0].id);
				return;
			}
			state.pendingDrawFeatureId = event.features[0].id;
			state.ignoreNextMapClick = true;
			openFeatureEditor({
				type: state.mode === "add-line" ? "line" : "polygon",
				name: "",
				description: "",
				color: "#ff6b35",
				geometry: event.features[0].geometry,
				metadata: {},
			});
		});

		state.map.on("draw.update", function () {
			if (state.mode === "hunt-area" && state.pendingHuntAreaDrawId && state.huntDraft) {
				const drawFeature = state.draw.get(state.pendingHuntAreaDrawId);
				if (drawFeature) {
					state.huntDraft.search_area = drawFeature.geometry;
					syncHuntAreaSummary();
				}
				return;
			}

			if (!state.pendingDrawFeatureId || !state.pendingFeature) {
				return;
			}
			const drawFeature = state.draw.get(state.pendingDrawFeatureId);
			if (drawFeature) {
				state.pendingFeature.geometry = drawFeature.geometry;
			}
		});
	}

	function handleStyleReady() {
		state.mapLoaded = true;
		ensureTerrainDemSource();
		applyTerrainState({ reveal: false });
		if (!state.map.getSource("hunt-features")) {
			addMapSourcesAndLayers();
		}
		addContourLayers();
		addParkAndBorderLayers();
		collectRoadLayerIds();
		collectPeakLabelLayers();
		applyContourVisibility();
		applyRoadVisibility();
		applyPublicLandOpacity();
		applyParkAndBorderVisibility();
		applyPeakLabelVisibility();
		setStatus("Ready");
		updateGridOverlay();
		updateMeasurementLayer();
		updateBearingLayer();
		updateMapSource();
		updateHuntAreaSource();
		renderFeatures();
		updateCirclePreviewFromInputs();
	}

	function initializeMap(config, mapState) {
		const token = config.mapboxToken;
		if (!token || token === "YOUR_MAPBOX_ACCESS_TOKEN") {
			showToast("Add your Mapbox token in config.local.php to load the map.", true);
		}

		state.currentStyle = normalizeMapStyle(state.preferences.mapStyle || config.mapStyle);
		mapboxgl.accessToken = token;
		state.map = new mapboxgl.Map({
			container: "map",
			style: resolveMapStyle(state.currentStyle),
			center: Array.isArray(mapState.center) ? mapState.center : config.defaultCenter,
			zoom: Number.isFinite(mapState.zoom) ? mapState.zoom : config.defaultZoom,
			pitch: Number.isFinite(mapState.pitch) ? mapState.pitch : config.defaultPitch,
			bearing: Number.isFinite(mapState.bearing) ? mapState.bearing : config.defaultBearing,
			attributionControl: true,
		});

		state.map.addControl(new mapboxgl.NavigationControl({ showCompass: false, visualizePitch: true }), "bottom-right");

		state.draw = new MapboxDraw({
			displayControlsDefault: false,
			controls: {},
			styles: [
				{
					id: "gl-draw-polygon-fill",
					type: "fill",
					filter: ["all", ["==", "$type", "Polygon"]],
					paint: {
						"fill-color": "#ff6b35",
						"fill-opacity": 0.15,
					},
				},
				{
					id: "gl-draw-polygon-stroke",
					type: "line",
					filter: ["all", ["==", "$type", "Polygon"]],
					paint: {
						"line-color": "#ff6b35",
						"line-width": 2,
					},
				},
				{
					id: "gl-draw-line",
					type: "line",
					filter: ["all", ["==", "$type", "LineString"]],
					paint: {
						"line-color": "#ff6b35",
						"line-width": 3,
					},
				},
				{
					id: "gl-draw-polygon-and-line-vertex-halo-active",
					type: "circle",
					filter: ["all", ["==", "meta", "vertex"]],
					paint: {
						"circle-radius": 7,
						"circle-color": "#ffffff",
					},
				},
				{
					id: "gl-draw-polygon-and-line-vertex-active",
					type: "circle",
					filter: ["all", ["==", "meta", "vertex"]],
					paint: {
						"circle-radius": 5,
						"circle-color": "#ff6b35",
					},
				},
			],
		});

		state.map.addControl(state.draw, "top-left");
		bindMapEvents();
		state.map.on("style.load", handleStyleReady);
		updateCompassBearing();
	}

	function populateFromBootstrap(data) {
		state.config = data.config;
		state.hunts = data.hunts || [];
		state.features = data.mapItems || data.features || [];
		state.clues = data.clues || [];
		state.clueMapItems = data.clueMapItems || [];
		state.preferences.mapStyle = normalizeMapStyle(data.mapState && data.mapState.mapStyle ? data.mapState.mapStyle : data.config.mapStyle);
		state.preferences.units = normalizeUnits(data.mapState && data.mapState.units ? data.mapState.units : "metric");
		state.preferences.terrain3d = data.mapState ? data.mapState.terrain3d !== false : true;
		state.preferences.peakLabels = data.mapState ? data.mapState.peakLabels !== false : true;
		state.preferences.publicLandVisibility = normalizePublicLandVisibility(data.mapState && data.mapState.publicLandVisibility ? data.mapState.publicLandVisibility : null);
		state.preferences.publicLandOpacity = normalizePublicLandOpacity(data.mapState && data.mapState.publicLandOpacity);
		updateRadiusFieldLabel();
		const selectedHuntId = data.mapState && Number.isFinite(Number(data.mapState.selectedHuntId)) ? Number(data.mapState.selectedHuntId) : null;
		state.activeHuntId = selectedHuntId || (state.hunts[0] ? state.hunts[0].id : null);

		selectors.toggleTerrain.prop("checked", state.preferences.terrain3d);
		selectors.toggleContours.prop("checked", data.mapState ? data.mapState.contoursVisible !== false : true);
		selectors.togglePeaks.prop("checked", state.preferences.peakLabels);
		selectors.toggleRoads.prop("checked", data.mapState ? data.mapState.roadsVisible !== false : true);
		selectors.toggleParksBorders.prop("checked", data.mapState ? data.mapState.parkBoundariesVisible !== false : true);
		selectors.toggleGrid.prop("checked", data.mapState ? data.mapState.gridVisible !== false : true);
		selectors.toggleCoords.prop("checked", data.mapState ? data.mapState.coordsVisible !== false : true);
		selectors.toggleHuntAreas.prop("checked", data.mapState ? data.mapState.huntAreaVisible === true : false);
		state.reasoningOverlayEnabled = data.mapState ? data.mapState.reasoningOverlayVisible === true : false;
		selectors.toggleReasoningOverlay.prop("checked", state.reasoningOverlayEnabled);

		renderHunts();
		renderFeatures();
		renderClues();
		renderClueMapItemOptions();
		loadReasoningSettings();
		initializeMap(data.config, data.mapState || {});
	}

	function fetchBootstrap() {
		setStatus("Loading");
		return apiRequest("GET", "bootstrap")
			.then(populateFromBootstrap)
			.catch(function (error) {
				setStatus("Load failed");
				showToast(error.responseJSON && error.responseJSON.message ? error.responseJSON.message : "Bootstrap failed.", true);
			});
	}

	function createOrUpdateHunt(event) {
		event.preventDefault();
		syncHuntDraftFromForm();
		const payload = {
			name: $("#hunt-name").val().trim(),
			description: $("#hunt-description").val().trim(),
			search_area: state.huntDraft && state.huntDraft.search_area ? state.huntDraft.search_area : null,
		};
		const huntId = Number($("#hunt-id").val() || 0);
		const method = huntId ? "PATCH" : "POST";
		const query = huntId ? { id: huntId } : null;

		setBusyStatus(huntId ? "Saving hunt" : "Creating hunt");
		apiRequest(method, "hunts", payload, query)
			.then(function (hunt) {
				const existingIndex = state.hunts.findIndex((item) => item.id === hunt.id);
				if (existingIndex >= 0) {
					state.hunts.splice(existingIndex, 1, hunt);
				} else {
					state.hunts.unshift(hunt);
				}
				setActiveHunt(hunt.id, true);
				closeHuntModal();
				clearBusyStatus("Hunt saved");
				showToast(huntId ? "Hunt updated." : "Hunt created.");
			})
			.catch(function (error) {
				clearBusyStatus("Save failed");
				handleAjaxError(error);
			});
	}

	function deleteHunt(huntId) {
		if (!window.confirm("Delete this hunt and all of its map items and clues?")) {
			return;
		}

		setBusyStatus("Deleting hunt");
		apiRequest("DELETE", "hunts", null, { id: huntId })
			.then(function () {
				state.hunts = state.hunts.filter((hunt) => hunt.id !== huntId);
				state.features = state.features.filter((feature) => feature.hunt_id !== huntId);
				state.clues = state.clues.filter((clue) => clue.hunt_id !== huntId);
				state.clueMapItems = state.clueMapItems.filter((link) => {
					const clue = state.clues.find((item) => Number(item.id) === Number(link.clue_id));
					return Boolean(clue);
				});
				state.activeHuntId = state.hunts[0] ? state.hunts[0].id : null;
				renderHunts();
				renderFeatures();
				renderClues();
				renderClueMapItemOptions();
				saveMapState();
				closeInfoModal();
				clearBusyStatus("Hunt deleted");
				showToast("Hunt deleted.");
			})
			.catch(function (error) {
				clearBusyStatus("Delete failed");
				handleAjaxError(error);
			});
	}

	function saveFeature(event) {
		event.preventDefault();
		if (!ensureActiveHunt()) {
			return;
		}

		const payload = currentFeaturePayload();
		const method = payload.id ? "PATCH" : "POST";
		const query = payload.id ? { id: payload.id } : null;

		if (!payload.geometry) {
			showToast("Feature geometry is incomplete.");
			return;
		}

		setBusyStatus(payload.id ? "Saving map item" : "Creating map item");
		apiRequest(method, "map-items", payload, query)
			.then(function (feature) {
				const existingIndex = state.features.findIndex((item) => item.id === feature.id);
				if (existingIndex >= 0) {
					state.features.splice(existingIndex, 1, feature);
				} else {
					state.features.unshift(feature);
				}
				renderFeatures();
				renderClueMapItemOptions();
				resetFeatureForm();
				setMode("browse");
				showFeatureDetails(feature);
				scheduleReasoningOverlayUpdate(null, "Recalculating reasoning overlay");
				showToast(payload.id ? "Map item updated." : "Map item saved.");
			})
			.catch(function (error) {
				clearBusyStatus("Save failed");
				handleAjaxError(error);
			});
	}

	function deleteFeature(featureId) {
		setBusyStatus("Deleting map item");
		apiRequest("DELETE", "map-items", null, { id: featureId })
			.then(function () {
				state.features = state.features.filter((feature) => feature.id !== featureId);
				state.clueMapItems = state.clueMapItems.filter((link) => Number(link.map_item_id) !== Number(featureId));
				renderFeatures();
				renderClues();
				scheduleReasoningOverlayUpdate(null, "Recalculating reasoning overlay");
				renderClueMapItemOptions();
				closeInfoModal();
				showToast("Map item deleted.");
			})
			.catch(function (error) {
				clearBusyStatus("Delete failed");
				handleAjaxError(error);
			});
	}

	function syncClueLinks(clueId, selectedMapItemIds) {
		const existing = state.clueMapItems.filter((link) => Number(link.clue_id) === Number(clueId));
		const selectedSet = new Set(selectedMapItemIds.map((id) => Number(id)));
		const existingSet = new Set(existing.map((link) => Number(link.map_item_id)));

		const deletions = existing
			.filter((link) => !selectedSet.has(Number(link.map_item_id)))
			.map((link) => apiRequest("DELETE", "clue-map-items", null, { id: link.id }));

		const creations = selectedMapItemIds
			.filter((id) => !existingSet.has(Number(id)))
			.map((id) => apiRequest("POST", "clue-map-items", {
				clue_id: clueId,
				map_item_id: Number(id),
				relationship_type: "supports",
			}));

		return $.when.apply($, deletions.concat(creations));
	}

	function saveClue(event) {
		event.preventDefault();
		if (!ensureActiveHunt()) {
			return;
		}

		const clueId = Number($("#clue-id").val() || 0);
		const payload = {
			hunt_id: state.activeHuntId,
			title: $("#clue-title").val().trim(),
			body: $("#clue-body").val().trim(),
			interpretation: $("#clue-interpretation").val().trim(),
			status: $("#clue-status").val(),
			confidence: window.Elevated && window.Elevated.utils
				? window.Elevated.utils.clamp($("#clue-confidence").val(), 0, 100)
				: Math.max(0, Math.min(100, Number($("#clue-confidence").val()) || 50)),
		};

		const selectedMapItemIds = ($("#clue-map-items").val() || []).map((value) => Number(value));
		const method = clueId ? "PATCH" : "POST";
		const query = clueId ? { id: clueId } : null;

		setBusyStatus(clueId ? "Saving clue" : "Creating clue");
		apiRequest(method, "clues", payload, query)
			.then(function (clue) {
				return syncClueLinks(clue.id, selectedMapItemIds)
					.then(function () {
						return clue;
					});
			})
			.then(function () {
				return $.when(
					apiRequest("GET", "clues", null, { hunt_id: state.activeHuntId }),
					apiRequest("GET", "clue-map-items", null, { clue_id: "" })
				);
			})
			.then(function (clues, clueMapItems) {
				state.clues = clues;
				state.clueMapItems = clueMapItems;
				renderClues();
				scheduleReasoningOverlayUpdate(null, "Recalculating reasoning overlay");
				closeClueModal();
				showToast(clueId ? "Clue updated." : "Clue created.");
			})
			.catch(function (error) {
				clearBusyStatus("Save failed");
				handleAjaxError(error);
			});
	}

	function deleteClue(clueId) {
		setBusyStatus("Deleting clue");
		apiRequest("DELETE", "clues", null, { id: clueId })
			.then(function () {
				state.clues = state.clues.filter((clue) => Number(clue.id) !== Number(clueId));
				state.clueMapItems = state.clueMapItems.filter((link) => Number(link.clue_id) !== Number(clueId));
				renderClues();
				scheduleReasoningOverlayUpdate(null, "Recalculating reasoning overlay");
				showToast("Clue deleted.");
			})
			.catch(function (error) {
				clearBusyStatus("Delete failed");
				handleAjaxError(error);
			});
	}

	function searchPlaces(query) {
		if (!state.config || !state.config.mapboxToken || state.config.mapboxToken === "YOUR_MAPBOX_ACCESS_TOKEN") {
			selectors.searchResults.addClass("hidden").empty();
			return;
		}

		const requestId = Date.now();
		state.lastSearchRequest = requestId;
		const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?autocomplete=true&limit=6&types=place,locality,address,poi&access_token=${encodeURIComponent(state.config.mapboxToken)}`;

		$.getJSON(url).then(function (response) {
			if (state.lastSearchRequest !== requestId) {
				return;
			}

			const features = response.features || [];
			selectors.searchResults.empty();
			if (!features.length) {
				selectors.searchResults.addClass("hidden");
				return;
			}

			features.forEach(function (feature) {
				const button = $(
					`<button type="button" class="search-result-item">
						<div class="search-result-copy">
							<span>${escapeHtml(feature.text || feature.place_name)}</span>
							<span>${escapeHtml(feature.place_name)}</span>
						</div>
					</button>`,
				);
				button.on("click", function () {
					selectors.searchResults.empty().addClass("hidden");
					$("#search-input").val(feature.place_name);
					state.map.flyTo({ center: feature.center, zoom: 15, essential: true });
				});
				selectors.searchResults.append(button);
			});

			selectors.searchResults.removeClass("hidden");
		});
	}

	function handleAjaxError(error) {
		const message = error && error.responseJSON && error.responseJSON.message ? error.responseJSON.message : "Request failed.";
		showToast(message, true);
	}

	function bindUi() {
		$("#hunt-form").on("submit", createOrUpdateHunt);
		$("#hunt-form-reset").on("click", closeHuntModal);
		$("#feature-form").on("submit", saveFeature);
		$("#clue-form").on("submit", saveClue);
		$("#preferences-form").on("submit", savePreferences);
		$("#feature-radius, #feature-lat, #feature-lng").on("input", updateCirclePreviewFromInputs);
		$("#preference-public-opacity").on("input", function () {
			updatePublicLandOpacityLabel($(this).val());
		});

		$("#open-hunt-modal").on("click", function () {
			openHuntModal(null);
		});

		$("#open-hunt-modal-quick").on("click", function () {
			openHuntModal(null);
		});
		$("#open-clue-modal").on("click", function () {
			if (!ensureActiveHunt()) {
				return;
			}
			setWorkspacePanel("clues");
			openClueModal(null);
		});
		$("#open-clue-modal-quick").on("click", function () {
			if (!ensureActiveHunt()) {
				return;
			}
			setWorkspacePanel("clues");
			openClueModal(null);
		});
		$("#define-hunt-area").on("click", function () {
			syncHuntDraftFromForm();
			hideHuntModal();
			clearPolygonEditing();
			showToast("Click the map to draw the hunt search area, then double-click to finish.", true);
			setMode("hunt-area");
		});
		$("#clear-hunt-area").on("click", function () {
			if (state.huntDraft) {
				state.huntDraft.search_area = null;
			}
			if (state.mode === "hunt-area") {
				setMode("browse");
			}
			syncHuntAreaSummary();
		});
		$("#open-preferences-modal").on("click", openPreferencesModal);
		$("#open-preferences-modal-quick").on("click", openPreferencesModal);
		selectors.workspaceTabs.on("click", function () {
			setWorkspacePanel($(this).data("workspace-tab"));
		});
		$("#fit-reasoning-board").on("click", function () {
			toggleReasoningBoardFullscreen();
		});
		$("#close-hunt-modal, [data-close-hunt='true']").on("click", closeHuntModal);
		$("#close-clue-modal, #clue-form-reset, [data-close-clue='true']").on("click", closeClueModal);
		$("#close-preferences-modal, #preferences-form-reset, [data-close-preferences='true']").on("click", closePreferencesModal);
		$("#close-info-modal").on("click", function () {
			resetFeatureForm();
			closeInfoModal();
		});

		$('.tool-button[data-tool="marker"]').on("click", function () {
			setMode(state.mode === "add-marker" ? "browse" : "add-marker");
		});
		$('.tool-button[data-tool="circle"]').on("click", function () {
			setMode(state.mode === "add-circle" ? "browse" : "add-circle");
		});
		$('.tool-button[data-tool="polygon"]').on("click", function () {
			setMode(state.mode === "polygon" ? "browse" : "polygon");
		});
		$('.tool-button[data-tool="measure"]').on("click", function () {
			setMode(state.mode === "measure" ? "browse" : "measure");
		});
		$('.tool-button[data-tool="bearing"]').on("click", function () {
			setMode(state.mode === "bearing" ? "browse" : "bearing");
		});
		$('.tool-button[data-tool="line"]').on("click", function () {
			setMode(state.mode === "add-line" ? "browse" : "add-line");
		});

		$("#toggle-layer-panel").on("click", function () {
			state.layerPanelOpen = !state.layerPanelOpen;
			selectors.layerPanel.toggleClass("hidden", !state.layerPanelOpen);
		});

		$("#clear-measurement").on("click", function () {
			clearMeasurement();
			clearBearing();
			showToast("Temporary measurements cleared.");
		});

		$("#map-compass").on("click", resetNorthOrTilt);
		$(document).on("fullscreenchange", function () {
			if (state.reasoningBoard) {
				window.setTimeout(function () {
					state.reasoningBoard.resize();
					state.reasoningBoard.fit(undefined, 24);
				}, 80);
			}
		});

		selectors.toggleRoads.on("change", function () {
			applyRoadVisibility();
			saveMapState();
		});
		selectors.toggleParksBorders.on("change", function () {
			applyParkAndBorderVisibility();
			saveMapState();
		});
		selectors.toggleTerrain.on("change", function () {
			applyTerrainState({ reveal: selectors.toggleTerrain.is(":checked") });
			saveMapState();
		});
		selectors.toggleContours.on("change", function () {
			applyContourVisibility();
			saveMapState();
		});
		selectors.togglePeaks.on("change", function () {
			applyPeakLabelVisibility();
			saveMapState();
		});
		selectors.toggleGrid.on("change", function () {
			updateGridOverlay();
			saveMapState();
		});
		selectors.toggleCoords.on("change", function () {
			updateGridOverlay();
			saveMapState();
		});
		selectors.toggleHuntAreas.on("change", function () {
			applyHuntAreaVisibility();
			saveMapState();
		});
		selectors.toggleReasoningOverlay.on("change", function () {
			state.reasoningOverlayEnabled = selectors.toggleReasoningOverlay.is(":checked");
			scheduleReasoningOverlayUpdate(null, state.reasoningOverlayEnabled ? "Calculating reasoning overlay" : "Hiding reasoning overlay");
			saveMapState();
		});
		$("#reasoning-settings-form").on("submit", saveReasoningSettings);
		$("#reset-reasoning-settings").on("click", resetReasoningSettings);

		$("#search-input").on("input", function () {
			const query = $(this).val().trim();
			window.clearTimeout(state.searchDebounce);
			if (query.length < 2) {
				selectors.searchResults.empty().addClass("hidden");
				return;
			}
			state.searchDebounce = window.setTimeout(function () {
				searchPlaces(query);
			}, 240);
		});

		$(document).on("click", function (event) {
			if (!$(event.target).closest(".search-shell").length) {
				selectors.searchResults.addClass("hidden");
			}
			if (!$(event.target).closest("#layer-panel, #toggle-layer-panel").length) {
				state.layerPanelOpen = false;
				selectors.layerPanel.addClass("hidden");
			}
		});
		$(document).on("keydown", function (event) {
			if (event.key !== "Escape") {
				return;
			}
			if (!selectors.huntModal.hasClass("hidden")) {
				closeHuntModal();
				return;
			}
			if (!selectors.clueModal.hasClass("hidden")) {
				closeClueModal();
				return;
			}
			if (!selectors.preferencesModal.hasClass("hidden")) {
				closePreferencesModal();
				return;
			}
			if (!selectors.infoModal.hasClass("hidden")) {
				closeInfoModal();
				resetFeatureForm();
				return;
			}
			state.layerPanelOpen = false;
			selectors.layerPanel.addClass("hidden");
			selectors.searchResults.addClass("hidden");
		});

		$("#toggle-sidebar").on("click", function () {
			selectors.sidebar.addClass("collapsed");
			syncSidebarState();
		});
		selectors.showSidebar.on("click", function () {
			selectors.sidebar.removeClass("collapsed");
			syncSidebarState();
		});
	}

	$(function () {
		syncSidebarState();
		syncModeBadge();
		bindUi();
		fetchBootstrap();
		$("#search-input").attr("aria-label", "Search map locations");
	});
})(jQuery);
