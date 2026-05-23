<div class="dialog-layer hidden" id="hunt-modal">
    <div class="dialog-scrim" data-close-hunt="true"></div>
    <div class="dialog-card" role="dialog" aria-modal="true" aria-labelledby="hunt-modal-title">
        <div class="modal-header">
            <div><p class="eyebrow" id="hunt-modal-kicker">Hunt Project</p><h2 id="hunt-modal-title">Create Hunt</h2></div>
            <button type="button" class="icon-button" id="close-hunt-modal" aria-label="Close hunt modal"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <form id="hunt-form" class="stack-form">
            <input type="hidden" id="hunt-id" value="">
            <label><span>Name</span><input type="text" id="hunt-name" placeholder="Add a hunt project" required></label>
            <label><span>Description</span><textarea id="hunt-description" rows="3" placeholder="Notes for this hunt"></textarea></label>
            <div class="hunt-area-field">
                <div class="hunt-area-summary" id="hunt-area-summary"><strong>Search area optional</strong><p>You can save this hunt now and draw a search area later.</p></div>
                <div class="hunt-area-actions">
                    <button type="button" class="hunt-area-button hunt-area-trigger" id="define-hunt-area"><i class="fa-solid fa-draw-polygon"></i><span>Draw search area</span></button>
                    <button type="button" class="hunt-area-button danger hidden" id="clear-hunt-area"><i class="fa-solid fa-trash"></i><span>Clear area</span></button>
                </div>
            </div>
            <div class="modal-actions">
                <button type="button" class="action-orb cancel" id="hunt-form-reset"><span class="action-icon"><i class="fa-solid fa-arrow-left"></i></span><span class="action-label">Cancel</span></button>
                <button type="submit" class="action-orb primary"><span class="action-icon"><i class="fa-solid fa-floppy-disk"></i></span><span class="action-label">Save Hunt</span></button>
            </div>
        </form>
    </div>
</div>

<div class="dialog-layer hidden" id="preferences-modal">
    <div class="dialog-scrim" data-close-preferences="true"></div>
    <div class="dialog-card preferences-card" role="dialog" aria-modal="true" aria-labelledby="preferences-modal-title">
        <div class="modal-header">
            <div><p class="eyebrow">Preferences</p><h2 id="preferences-modal-title">Display Settings</h2></div>
            <button type="button" class="icon-button" id="close-preferences-modal" aria-label="Close preferences modal"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <form id="preferences-form" class="stack-form">
            <label><span>Map Style</span><select id="preference-map-style"><option value="gis-satellite">GIS Satellite</option><option value="mapbox://styles/mapbox/satellite-streets-v12">Satellite Streets</option><option value="mapbox://styles/mapbox/satellite-v9">Satellite</option><option value="mapbox://styles/mapbox/outdoors-v12">Outdoors</option><option value="mapbox://styles/mapbox/light-v11">Light</option><option value="mapbox://styles/mapbox/dark-v11">Dark</option></select></label>
            <label><span>Units</span><select id="preference-units"><option value="metric">Metric</option><option value="imperial">Imperial</option></select></label>
            <label><span>Public Land Opacity <strong id="preference-public-opacity-value">100%</strong></span><input type="range" id="preference-public-opacity" min="0" max="100" step="5" value="100"></label>
            <div class="toggle-list compact settings-toggles">
                <label class="toggle-item"><input type="checkbox" id="preference-terrain"><span>3D Terrain</span></label>
                <label class="toggle-item"><input type="checkbox" id="preference-contours"><span>Contour Lines</span></label>
                <label class="toggle-item"><input type="checkbox" id="preference-peaks"><span>Peak Labels</span></label>
                <label class="toggle-item"><input type="checkbox" id="preference-roads"><span>Show Roads</span></label>
                <label class="toggle-item"><input type="checkbox" id="preference-public-national-parks"><span>National Parks</span></label>
                <label class="toggle-item"><input type="checkbox" id="preference-public-recreation"><span>Parks + Recreation</span></label>
                <label class="toggle-item"><input type="checkbox" id="preference-public-tribal"><span>Tribal Lands</span></label>
                <label class="toggle-item"><input type="checkbox" id="preference-public-borders"><span>Public Land Borders</span></label>
                <label class="toggle-item"><input type="checkbox" id="preference-grid"><span>Show Grid</span></label>
                <label class="toggle-item"><input type="checkbox" id="preference-coords"><span>Show Coordinates</span></label>
            </div>
            <div class="modal-actions">
                <button type="button" class="action-orb cancel" id="preferences-form-reset"><span class="action-icon"><i class="fa-solid fa-arrow-left"></i></span><span class="action-label">Cancel</span></button>
                <button type="submit" class="action-orb primary"><span class="action-icon"><i class="fa-solid fa-floppy-disk"></i></span><span class="action-label">Save</span></button>
            </div>
        </form>
    </div>
</div>

<div class="dialog-layer hidden" id="clue-modal">
    <div class="dialog-scrim" data-close-clue="true"></div>
    <div class="dialog-card preferences-card" role="dialog" aria-modal="true" aria-labelledby="clue-modal-title">
        <div class="modal-header">
            <div><p class="eyebrow">Clue</p><h2 id="clue-modal-title">Create Clue</h2></div>
            <button type="button" class="icon-button" id="close-clue-modal" aria-label="Close clue modal"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <form id="clue-form" class="stack-form">
            <input type="hidden" id="clue-id" value="">
            <label><span>Title</span><input type="text" id="clue-title" placeholder="Add clue title" required></label>
            <label><span>Body</span><textarea id="clue-body" rows="3" placeholder="Raw clue text or note"></textarea></label>
            <label><span>Interpretation</span><textarea id="clue-interpretation" rows="3" placeholder="Your current interpretation"></textarea></label>
            <div class="dual-fields">
                <label><span>Status</span><select id="clue-status"><option value="open">Open</option><option value="possible">Possible</option><option value="likely">Likely</option><option value="ruled_out">Ruled Out</option><option value="confirmed">Confirmed</option></select></label>
                <label><span>Confidence (0-100)</span><input type="number" min="0" max="100" step="1" id="clue-confidence" value="50"></label>
            </div>
            <label><span>Linked Map Items</span><select id="clue-map-items" multiple size="6"></select></label>
            <div class="modal-actions">
                <button type="button" class="action-orb cancel" id="clue-form-reset"><span class="action-icon"><i class="fa-solid fa-arrow-left"></i></span><span class="action-label">Cancel</span></button>
                <button type="submit" class="action-orb primary"><span class="action-icon"><i class="fa-solid fa-floppy-disk"></i></span><span class="action-label">Save Clue</span></button>
            </div>
        </form>
    </div>
</div>

<div id="toast" class="toast hidden"></div>
