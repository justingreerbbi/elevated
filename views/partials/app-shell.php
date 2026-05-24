<div class="app-shell" id="app-shell">
    <aside class="sidebar" id="sidebar">
        <header class="workspace-header">
            <div>
                <p class="eyebrow">Elevated Host</p>
                <h1>Treasure Hunt Workspace</h1>
                <p class="microcopy" id="active-hunt-name">No active hunt</p>
            </div>
            <button type="button" class="icon-button" id="toggle-sidebar" aria-label="Hide workspace">
                <i class="fa-solid fa-chevron-left"></i>
            </button>
        </header>

        <div class="workspace-commandbar" aria-label="Workspace actions">
            <button type="button" class="command-button primary" id="open-hunt-modal-quick">
                <i class="fa-solid fa-plus"></i>
                <span>Hunt</span>
            </button>
            <button type="button" class="command-button" id="open-clue-modal-quick">
                <i class="fa-solid fa-note-sticky"></i>
                <span>Clue</span>
            </button>
            <button type="button" class="command-button" id="open-preferences-modal-quick">
                <i class="fa-solid fa-sliders"></i>
                <span>Display</span>
            </button>
        </div>

        <nav class="workspace-tabs" aria-label="Workspace sections">
            <button type="button" class="workspace-tab active" data-workspace-tab="hunts">
                <i class="fa-solid fa-folder-tree"></i>
                <span>Hunts</span>
                <strong id="hunt-count">0</strong>
            </button>
            <button type="button" class="workspace-tab" data-workspace-tab="items">
                <i class="fa-solid fa-map-location-dot"></i>
                <span>Map Items</span>
                <strong id="feature-count">0</strong>
            </button>
            <button type="button" class="workspace-tab" data-workspace-tab="clues">
                <i class="fa-solid fa-note-sticky"></i>
                <span>Clues</span>
                <strong id="clue-count">0</strong>
            </button>
            <button type="button" class="workspace-tab" data-workspace-tab="board">
                <i class="fa-solid fa-diagram-project"></i>
                <span>Board</span>
                <strong id="board-count">0</strong>
            </button>
        </nav>

        <section class="workspace-pane active" data-workspace-panel="hunts" aria-label="Hunts">
            <div class="workspace-pane-header">
                <div>
                    <h2>Workspace</h2>
                    <p class="microcopy">Choose the active hunt.</p>
                </div>
                <button type="button" class="icon-button" id="open-hunt-modal" aria-label="Create hunt">
                    <i class="fa-solid fa-plus"></i>
                </button>
            </div>
            <div id="hunt-list" class="list-block"></div>
        </section>

        <section class="workspace-pane" data-workspace-panel="items" aria-label="Map items">
            <div class="workspace-pane-header">
                <div>
                    <h2>Map Items</h2>
                    <p class="microcopy" id="feature-summary">No items</p>
                </div>
                <span class="mode-chip" id="mode-badge">Browse</span>
            </div>
            <div id="feature-empty" class="empty-state">Select a hunt to start.</div>
            <div id="feature-list" class="list-block"></div>
        </section>

        <section class="workspace-pane" data-workspace-panel="clues" aria-label="Clues">
            <div class="workspace-pane-header">
                <div>
                    <h2>Clues</h2>
                    <p class="microcopy" id="clue-summary">No clues</p>
                </div>
                <button type="button" class="icon-button" id="open-clue-modal" aria-label="Create clue">
                    <i class="fa-solid fa-plus"></i>
                </button>
            </div>
            <div id="clue-empty" class="empty-state">Select a hunt to add clues.</div>
            <div id="clue-list" class="list-block"></div>
        </section>

        <section class="workspace-pane" data-workspace-panel="board" aria-label="Reasoning board">
            <div class="workspace-pane-header">
                <div>
                    <h2>Source Board</h2>
                    <p class="microcopy" id="board-summary">No evidence graph</p>
                </div>
                <button type="button" class="icon-button" id="fit-reasoning-board" aria-label="Fit reasoning board">
                    <i class="fa-solid fa-up-right-and-down-left-from-center"></i>
                </button>
            </div>
            <div class="reasoning-board-shell">
                <div id="reasoning-board-empty" class="empty-state">Select a hunt with clues or map items.</div>
                <div id="reasoning-board" class="reasoning-board" aria-label="Clue reasoning graph"></div>
            </div>
        </section>
    </aside>

    <main class="map-stage">
        <button type="button" class="panel-toggle floating-toggle hidden" id="show-sidebar">
            <i class="fa-solid fa-bars"></i>
            <span>Menu</span>
        </button>
        <div class="search-shell">
            <i class="fa-solid fa-magnifying-glass search-icon" aria-hidden="true"></i>
            <input type="search" id="search-input" placeholder="Search locations">
            <div id="search-results" class="search-results hidden"></div>
        </div>
        <button type="button" class="map-compass" id="map-compass" aria-label="Reset map north or tilt">
            <span class="map-compass-ring">
                <span class="map-compass-needle" id="map-compass-needle"></span>
                <span class="map-compass-north">N</span>
            </span>
        </button>

        <section class="info-modal hidden" id="info-modal" aria-live="polite">
            <div class="info-modal-card">
                <div class="modal-header">
                    <div>
                        <p class="eyebrow" id="info-kicker">Location</p>
                        <h2 id="info-title">Map Details</h2>
                    </div>
                    <button type="button" class="icon-button" id="close-info-modal" aria-label="Close info panel">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <p class="modal-subtitle" id="info-subtitle">Click the map to inspect a location.</p>
                <div class="info-grid" id="info-grid"></div>
                <div class="info-content" id="info-content"></div>

                <form id="feature-form" class="stack-form hidden">
                    <input type="hidden" id="feature-id" value="">
                    <input type="hidden" id="feature-type" value="marker">
                    <label>
                        <span>Name</span>
                        <input type="text" id="feature-name" placeholder="Place, landmark, route, or search zone" required>
                    </label>
                    <label>
                        <span>Description</span>
                        <textarea id="feature-description" rows="3" placeholder="Geographic evidence, notes, or why this place matters"></textarea>
                    </label>
                    <div class="dual-fields">
                        <label>
                            <span>Color</span>
                            <input type="color" id="feature-color" value="#ff6b35">
                        </label>
                    </div>
                    <div class="dual-fields">
                        <label>
                            <span>Category</span>
                            <select id="feature-category">
                                <option value="candidate_location">Candidate Location</option>
                                <option value="landmark">Landmark</option>
                                <option value="evidence">Evidence</option>
                                <option value="reference">Reference</option>
                                <option value="search_area">Search Area</option>
                                <option value="route">Route</option>
                            </select>
                        </label>
                        <label class="legacy-category-field hidden">
                            <span>Legacy Category</span>
                            <select id="feature-category-legacy">
                                <option value="reference">Reference</option>
                                <option value="clue">Clue</option>
                                <option value="evidence">Evidence</option>
                                <option value="search_area">Search Area</option>
                                <option value="route">Route</option>
                                <option value="exclusion">Exclusion</option>
                            </select>
                        </label>
                        <label>
                            <span>Status</span>
                            <select id="feature-status">
                                <option value="active">Active</option>
                                <option value="possible">Possible</option>
                                <option value="likely">Likely</option>
                                <option value="ruled_out">Ruled Out</option>
                                <option value="confirmed">Confirmed</option>
                            </select>
                        </label>
                    </div>
                    <label>
                        <span>Confidence (0-100)</span>
                        <input type="number" min="0" max="100" step="1" id="feature-confidence" value="50">
                    </label>
                    <div class="dual-fields feature-point-fields">
                        <label>
                            <span>Latitude</span>
                            <input type="number" step="any" id="feature-lat">
                        </label>
                        <label>
                            <span>Longitude</span>
                            <input type="number" step="any" id="feature-lng">
                        </label>
                    </div>
                    <label class="feature-radius-field hidden">
                        <span id="feature-radius-label">Radius (m)</span>
                        <input type="number" min="1" step="1" id="feature-radius" value="100">
                    </label>
                </form>

                <div class="modal-actions" id="info-actions"></div>
            </div>
        </section>

        <section class="tool-rail" id="tool-rail">
            <button type="button" class="tool-button" data-tool="marker" title="Add marker"><i class="fa-solid fa-location-dot"></i><span>Marker</span></button>
            <button type="button" class="tool-button" data-tool="polygon" title="Draw polygon"><i class="fa-solid fa-draw-polygon"></i><span>Polygon</span></button>
            <button type="button" class="tool-button" data-tool="circle" title="Radius ring"><i class="fa-solid fa-circle-dot"></i><span>Radius</span></button>
            <button type="button" class="tool-button" data-tool="measure" title="Measure distance"><i class="fa-solid fa-ruler-combined"></i><span>Measure</span></button>
            <button type="button" class="tool-button" data-tool="bearing" title="Measure bearing angle"><i class="fa-solid fa-location-arrow"></i><span>Bearing</span></button>
            <button type="button" class="tool-button" data-tool="line" title="Draw line"><i class="fa-solid fa-route"></i><span>Line</span></button>
            <button type="button" class="tool-button" id="toggle-layer-panel" title="Layers"><i class="fa-solid fa-layer-group"></i><span>Layers</span></button>
            <button type="button" class="tool-button" id="open-preferences-modal" title="Preferences"><i class="fa-solid fa-sliders"></i><span>Settings</span></button>
            <button type="button" class="tool-button" id="clear-measurement" title="Clear measurement"><i class="fa-solid fa-eraser"></i><span>Clear</span></button>
        </section>

        <section class="layer-panel hidden" id="layer-panel">
            <div class="panel-header"><h2>Layers</h2><span class="microcopy">Overlays</span></div>
            <div class="toggle-list compact">
                <label class="toggle-item"><input type="checkbox" id="toggle-terrain" checked><span>3D Terrain</span></label>
                <label class="toggle-item"><input type="checkbox" id="toggle-contours" checked><span>Contour Lines</span></label>
                <label class="toggle-item"><input type="checkbox" id="toggle-peaks" checked><span>Peak Labels</span></label>
                <label class="toggle-item"><input type="checkbox" id="toggle-roads" checked><span>Roads</span></label>
                <label class="toggle-item"><input type="checkbox" id="toggle-parks-borders" checked><span>Public Lands + Borders</span></label>
                <label class="toggle-item"><input type="checkbox" id="toggle-grid" checked><span>Grid Lines</span></label>
                <label class="toggle-item"><input type="checkbox" id="toggle-coords" checked><span>Lat/Lng Labels</span></label>
                <label class="toggle-item"><input type="checkbox" id="toggle-hunt-areas"><span>Search Area</span></label>
                <label class="toggle-item"><input type="checkbox" id="toggle-reasoning-overlay"><span>Reasoning Overlay</span></label>
            </div>
            <form id="reasoning-settings-form" class="reasoning-settings-form">
                <div class="panel-header"><h2>Reasoning</h2><span class="microcopy" id="reasoning-summary">Off</span></div>
                <label><span>Cell side km</span><input type="number" min="1" max="100" step="1" id="reasoning-cell-side" value="10"></label>
                <label><span>Repeat decay</span><input type="number" min="0.1" max="1" step="0.05" id="reasoning-repeat-decay" value="0.65"></label>
                <label><span>Category cap</span><input type="number" min="1" max="100" step="0.5" id="reasoning-category-cap" value="8"></label>
                <label><span>Negative floor</span><input type="number" min="0.01" max="1" step="0.05" id="reasoning-negative-floor" value="0.25"></label>
                <div class="reasoning-settings-actions">
                    <button type="submit" class="mini-text-button">Apply</button>
                    <button type="button" class="mini-text-button" id="reset-reasoning-settings">Reset</button>
                </div>
            </form>
        </section>

        <div class="status-card" id="status-card">Loading</div>
        <div id="map"></div>
    </main>
</div>
