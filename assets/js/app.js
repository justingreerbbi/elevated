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
		activeHuntId: null,
		map: null,
		draw: null,
		mode: "browse",
		huntDraft: null,
		pendingFeature: null,
		pendingDrawFeatureId: null,
		pendingHuntAreaDrawId: null,
		measurementCoords: [],
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
	};

	const selectors = {
		appShell: $("#app-shell"),
		huntList: $("#hunt-list"),
		featureList: $("#feature-list"),
		featureForm: $("#feature-form"),
		featureEmpty: $("#feature-empty"),
		featureSummary: $("#feature-summary"),
		modeBadge: $("#mode-badge"),
		activeHuntName: $("#active-hunt-name"),
		statusCard: $("#status-card"),
		searchResults: $("#search-results"),
		toast: $("#toast"),
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
		infoModal: $("#info-modal"),
		infoKicker: $("#info-kicker"),
		infoTitle: $("#info-title"),
		infoSubtitle: $("#info-subtitle"),
		infoGrid: $("#info-grid"),
		infoContent: $("#info-content"),
		infoActions: $("#info-actions"),
		huntModal: $("#hunt-modal"),
		preferencesModal: $("#preferences-modal"),
		layerPanel: $("#layer-panel"),
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
			|| !selectors.preferencesModal.hasClass("hidden");
		selectors.appShell.toggleClass("overlay-focus", hasModal);
	}

	function syncSidebarState() {
		const collapsed = selectors.sidebar.hasClass("collapsed");
		selectors.appShell.toggleClass("sidebar-collapsed", collapsed);
		selectors.showSidebar.toggleClass("hidden", !collapsed);
	}

	function apiRequest(method, resource, data, query) {
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
		selectors.statusCard.text(message);
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
			"polygon": "Polygon",
			"measure": "Measure",
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
		$("#feature-type-label").val("Marker");
		$("#feature-name").val("");
		$("#feature-description").val("");
		$("#feature-color").val("#ff6b35");
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
				title: "Search area required",
				body: "Click the map and draw a polygon to define where this hunt takes place.",
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
						<p>${escapeHtml(hunt.description || "No notes")}</p>
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
			selectors.featureSummary.text("No items");
			selectors.featureEmpty.removeClass("hidden").text("Select a hunt to start.");
			updateMapSource();
			return;
		}

		const features = visibleFeatures();
		selectors.featureSummary.text(`${features.length} ${features.length === 1 ? "item" : "items"}`);
		selectors.featureEmpty.toggleClass("hidden", features.length > 0);
		if (!features.length) {
			selectors.featureEmpty.text("No saved features.");
		}

		features.forEach((feature) => {
			const item = $(
				`<div class="feature-item" data-id="${feature.id}">
					<div class="item-main">
						<h4><span class="feature-swatch" style="background:${escapeHtml(feature.color)}"></span>${escapeHtml(feature.name)}</h4>
						<p>${escapeHtml(feature.description || feature.type)}</p>
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
		updateHuntAreaSource();
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

		return rows.slice(0, 6);
	}

	function showFeatureDetails(feature) {
		selectors.infoKicker.text("Saved Feature");
		selectors.infoTitle.text(feature.name);
		selectors.infoSubtitle.text(feature.description || feature.type);
		renderInfoGrid(featureMetricRows(feature));
		selectors.featureForm.addClass("hidden");
		selectors.infoContent.removeClass("hidden").html(`
			<div class="info-section">
				<strong>${escapeHtml(feature.type.charAt(0).toUpperCase() + feature.type.slice(1))}</strong>
				<p class="info-note">Review, edit, or delete.</p>
			</div>
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

	function openFeatureEditor(feature) {
		clearTemporaryClickMarker();
		const safeFeature = {
			id: feature.id || null,
			type: feature.type,
			name: feature.name || "",
			description: feature.description || "",
			color: feature.color || "#ff6b35",
			geometry: feature.geometry,
			metadata: $.extend(true, {}, feature.metadata || {}),
		};

		const type = safeFeature.type;
		$("#feature-id").val(safeFeature.id ? String(safeFeature.id) : "");
		$("#feature-type").val(type);
		$("#feature-type-label").val(type.charAt(0).toUpperCase() + type.slice(1));
		$("#feature-name").val(safeFeature.name);
		$("#feature-description").val(safeFeature.description);
		$("#feature-color").val(safeFeature.color);

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
		const base = {
			id: $("#feature-id").val() ? Number($("#feature-id").val()) : null,
			hunt_id: state.activeHuntId,
			type,
			name: $("#feature-name").val().trim(),
			description: $("#feature-description").val().trim(),
			color: $("#feature-color").val(),
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

		if (type === "polygon") {
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

	function applyTerrainState(options) {
		if (!state.map || !state.mapLoaded) {
			return;
		}

		const terrainEnabled = selectors.toggleTerrain.is(":checked");
		state.preferences.terrain3d = terrainEnabled;
		if (terrainEnabled) {
			state.map.setTerrain({ source: "mapbox-dem", exaggeration: 1.1 });
			if (options && options.reveal && state.map.getPitch() < 35) {
				state.map.easeTo({ pitch: 55, duration: 700 });
			}
			return;
		}

		state.map.setTerrain(null);
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

	function startPolygonEditing(feature) {
		if (!state.draw || !feature.geometry || feature.geometry.type !== "Polygon") {
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
			startPolygonEditing(feature);
			setStatus("Edit polygon");
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
			if (nextMode === "measure") {
				state.map.doubleClickZoom.disable();
				setStatus("Measure");
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

		if (state.mode === "polygon" || state.mode === "hunt-area") {
			return;
		}

		if (state.mode === "browse" && state.mapLoaded) {
			const rendered = state.map.queryRenderedFeatures(event.point, {
				layers: ["hunt-markers-circle", "hunt-polygons-fill", "hunt-polygons-line"],
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

		showLocationDetails(event.lngLat, queryPublicLandFeatures(event.point));
	}

	function bindMapEvents() {
		state.map.on("click", handleMapClick);

		state.map.on("moveend", function () {
			updateGridOverlay();
			saveMapState();
		});

		state.map.on("zoomend", updateGridOverlay);
		state.map.on("rotateend", saveMapState);
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

			if (state.mode !== "polygon") {
				return;
			}
			if (!ensureActiveHunt()) {
				state.draw.delete(event.features[0].id);
				return;
			}
			state.pendingDrawFeatureId = event.features[0].id;
			state.ignoreNextMapClick = true;
			openFeatureEditor({
				type: "polygon",
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
		if (!state.map.getSource("mapbox-dem")) {
			state.map.addSource("mapbox-dem", {
				type: "raster-dem",
				url: "mapbox://mapbox.mapbox-terrain-dem-v1",
				tileSize: 512,
				maxzoom: 14,
			});
		}
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
		updateGridOverlay();
		updateMeasurementLayer();
		updateMapSource();
		updateHuntAreaSource();
		renderFeatures();
		updateCirclePreviewFromInputs();
		setStatus("Ready");
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
	}

	function populateFromBootstrap(data) {
		state.config = data.config;
		state.hunts = data.hunts || [];
		state.features = data.features || [];
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

		renderHunts();
		renderFeatures();
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
		if (!payload.search_area) {
			showToast("Draw a search area for the hunt first.", true);
			return;
		}
		const huntId = Number($("#hunt-id").val() || 0);
		const method = huntId ? "PATCH" : "POST";
		const query = huntId ? { id: huntId } : null;

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
				showToast(huntId ? "Hunt updated." : "Hunt created.");
			})
			.catch(handleAjaxError);
	}

	function deleteHunt(huntId) {
		if (!window.confirm("Delete this hunt and all of its features?")) {
			return;
		}

		apiRequest("DELETE", "hunts", null, { id: huntId })
			.then(function () {
				state.hunts = state.hunts.filter((hunt) => hunt.id !== huntId);
				state.features = state.features.filter((feature) => feature.hunt_id !== huntId);
				state.activeHuntId = state.hunts[0] ? state.hunts[0].id : null;
				renderHunts();
				renderFeatures();
				saveMapState();
				closeInfoModal();
				showToast("Hunt deleted.");
			})
			.catch(handleAjaxError);
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

		apiRequest(method, "features", payload, query)
			.then(function (feature) {
				const existingIndex = state.features.findIndex((item) => item.id === feature.id);
				if (existingIndex >= 0) {
					state.features.splice(existingIndex, 1, feature);
				} else {
					state.features.unshift(feature);
				}
				renderFeatures();
				resetFeatureForm();
				setMode("browse");
				showFeatureDetails(feature);
				showToast(payload.id ? "Feature updated." : "Feature saved.");
			})
			.catch(handleAjaxError);
	}

	function deleteFeature(featureId) {
		apiRequest("DELETE", "features", null, { id: featureId })
			.then(function () {
				state.features = state.features.filter((feature) => feature.id !== featureId);
				renderFeatures();
				closeInfoModal();
				showToast("Feature deleted.");
			})
			.catch(handleAjaxError);
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
		$("#preferences-form").on("submit", savePreferences);
		$("#feature-radius, #feature-lat, #feature-lng").on("input", updateCirclePreviewFromInputs);
		$("#preference-public-opacity").on("input", function () {
			updatePublicLandOpacityLabel($(this).val());
		});

		$("#open-hunt-modal").on("click", function () {
			openHuntModal(null);
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
		$("#close-hunt-modal, [data-close-hunt='true']").on("click", closeHuntModal);
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

		$("#toggle-layer-panel").on("click", function () {
			state.layerPanelOpen = !state.layerPanelOpen;
			selectors.layerPanel.toggleClass("hidden", !state.layerPanelOpen);
		});

		$("#clear-measurement").on("click", function () {
			clearMeasurement();
			showToast("Measurement cleared.");
		});

		$("#compass-reset").on("click", function () {
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
	});
})(jQuery);
