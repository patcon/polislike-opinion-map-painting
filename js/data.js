/**
 * Data loading and processing functions for Opinion Map Painting Application
 */

// ============================================================================
// Data Loading Functions
// ============================================================================

/**
 * Load and render data for a specific dataset
 * @param {string} slug - Dataset identifier
 * @returns {Promise} - Resolves when data is loaded and rendered
 */
function loadAndRenderData(slug, preserveCustomLabels = false) {
    // Reset data state for a new dataset
    AppState.resetDataState(preserveCustomLabels);

    return new Promise((resolve) => {
        Promise.all([
            d3.json(`data/datasets/${slug}/pca.json`),
            d3.json(`data/datasets/${slug}/pacmap.json`),
            d3.json(`data/datasets/${slug}/localmap.json`),
            d3.json(`data/datasets/${slug}/meta.json`).catch(() => null),
        ]).then(([data1, data2, data3, meta]) => {
            // Store data in AppState
            AppState.data.participants = data1.map(([tid]) => tid);
            AppState.data.meta = meta;


            showPlotLoader();
            renderMetaInfo(meta);

            d3.json(`data/datasets/${slug}/statements.json`).then((rawStatements) => {
                const statements = rawStatements.map((s) => ({
                    tid: s.tid ?? s.statement_id,
                    pid: s.pid ?? s.participant_id,
                    mod: s.mod ?? s.moderated,
                    txt: s.txt ?? s.text ?? "<missing>", // optional: fallback for text
                    ...s, // keep any other keys
                }));

                AppState.data.commentTexts = statements;
                AppState.data.commentTextMap = Object.fromEntries(statements.map((c) => [c.tid, c]));

            });

            // Store projection data
            AppState.data.X1 = data1.map(([, coords]) => coords);
            AppState.data.X2 = data2.map(([, coords]) => coords);
            AppState.data.X3 = data3.map(([, coords]) => coords);


            // Reset selection state
            AppState.selection.colorByIndex.length = AppState.data.X1.length;
            AppState.selection.colorByIndex.fill(null);
            AppState.selection.selectedIndices.clear();


            // Render UI
            renderAllPlots();
            renderColorPalette();
            updateLabelCounts();
            hidePlotLoader();

            resolve(); // ✅ Important
        });
    });
}

/**
 * Apply shared state from URL or other source
 * @param {Object} state - The state to apply
 * @returns {Promise} - Resolves when state is applied
 */
function applySharedState({
    dataset,
    labelIndices,
    customColors = [],
    customLabels = {},
    flipX: fx = false,
    flipY: fy = false,
    opacity = Config.dotOpacity,
    dotSize = Config.dotSize
}) {
    // Update AppState
    AppState.preferences.convoSlug = dataset;
    AppState.preferences.flipX = fx;
    AppState.preferences.flipY = fy;
    AppState.ui.dotOpacity = opacity;
    AppState.ui.dotSize = dotSize;

    // Add custom colors to the palette if they exist
    if (customColors.length > 0) {
        // Get the default palette length
        const defaultPaletteLength = 10; // The original tab10 has 10 colors

        // Reset the palette to the default first
        Config.colors.tab10 = Config.colors.tab10.slice(0, defaultPaletteLength);

        // Add custom colors
        customColors.forEach(color => {
            if (!Config.colors.tab10.includes(color)) {
                Config.colors.tab10.push(color);
                AppState.selection.colorToLabelIndex[color] = Config.colors.tab10.length - 1;
            }
        });

        // Refresh the color palette
        renderColorPalette();
    }

    // Always set customLabels (even if empty) to ensure it's properly initialized
    AppState.selection.customLabels = customLabels || {};
    saveState("customLabels", AppState.selection.customLabels);

    // Update UI
    document.getElementById("dataset").value = dataset;
    document.getElementById("flip-x-checkbox").checked = fx;
    document.getElementById("flip-y-checkbox").checked = fy;
    document.getElementById("opacity-slider").value = opacity;
    document.getElementById("opacity-value").textContent = opacity;
    document.getElementById("dot-size-slider").value = dotSize;
    document.getElementById("dot-size-value").textContent = dotSize;

    // Save to session storage
    saveState("dataset", dataset);
    saveState("flipX", fx);
    saveState("flipY", fy);

    // Ensure custom labels are set before loading data
    AppState.selection.customLabels = customLabels || {};
    saveState("customLabels", AppState.selection.customLabels);

    return loadAndRenderData(dataset, true).then(() => {
        // Update selection state
        AppState.selection.colorByIndex.length = labelIndices.length;
        AppState.selection.selectedIndices.clear();

        for (let i = 0; i < labelIndices.length; i++) {
            const idx = labelIndices[i];
            if (idx != null) {
                const color = Config.colors.tab10[idx];
                AppState.selection.colorByIndex[i] = color;
                AppState.selection.selectedIndices.add(i);
            }
        }

        renderAllPlots();
        updateLabelCounts();

        // Always run analysis if we have painted groups to ensure custom labels are displayed
        if (AppState.selection.selectedIndices.size > 0) {
            applyGroupAnalysis();
        }
    });
}

/**
 * Encode the current state for sharing
 * @returns {string} - Base64 encoded state
 */
/**
 * Encode the current state for sharing
 * @param {boolean} includePaint - Whether to include painted labels in the shared state
 * @returns {string} - Base64 encoded state
 */
function encodeShareState(includePaint = true) {
    const dataset = AppState.preferences.convoSlug;

    // Create the base payload with settings
    const payload = {
        dataset,
        flipX: AppState.preferences.flipX,
        flipY: AppState.preferences.flipY,
        opacity: AppState.ui.dotOpacity,
        dotSize: AppState.ui.dotSize,
        customLabels: AppState.selection.customLabels
    };

    // Only include labelIndices if includePaint is true and there are painted participants
    if (includePaint && AppState.selection.selectedIndices.size > 0) {
        payload.labelIndices = AppState.selection.colorByIndex.map((c) =>
            c == null ? null : AppState.selection.colorToLabelIndex[c]
        );

        // Include custom colors that aren't in the default palette
        const customColors = [];
        Config.colors.tab10.forEach((color, index) => {
            // Only include colors beyond the default palette (index >= 10)
            if (index >= 10) {
                customColors.push(color);
            }
        });

        if (customColors.length > 0) {
            payload.customColors = customColors;
        }

        // Include custom labels if they exist
        if (Object.keys(AppState.selection.customLabels).length > 0) {
            payload.customLabels = AppState.selection.customLabels;
        }
    }

    return btoa(JSON.stringify(payload));
}

/**
 * Decode a shared state from base64
 * @param {string} base64 - Base64 encoded state
 * @returns {Object|null} - Decoded state or null if invalid
 */
function decodeShareState(base64) {
    try {
        const json = atob(base64);
        const parsed = JSON.parse(json);

        // Backward compatibility: if old `labels` format is used
        if (parsed.labels) {
            const labelIndices = parsed.labels.map((color) =>
                color == null ? null : AppState.selection.colorToLabelIndex[color]
            );
            parsed.labelIndices = labelIndices;
        }

        return {
            dataset: parsed.dataset,
            labelIndices: parsed.labelIndices || [],
            customColors: parsed.customColors || [],
            customLabels: parsed.customLabels || {},
            flipX: parsed.flipX || false,
            flipY: parsed.flipY || false,
            opacity: parsed.opacity || Config.dotOpacity,
            dotSize: parsed.dotSize || Config.dotSize
        };
    } catch (e) {
        console.warn("Invalid share state", e);
        return null;
    }
}

/**
 * Load the votes database for a dataset
 * @param {string} slug - Dataset identifier
 * @returns {Promise<Object>} - SQL.js database instance
 */
async function loadVotesDB(slug) {
    if (AppState.data.dbInstance) {
        return AppState.data.dbInstance;
    }

    const SQL = await initSqlJs({
        locateFile: (file) =>
            `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`,
    });

    const res = await fetch(`data/datasets/${slug}/votes.db`);
    const buffer = await res.arrayBuffer();
    const db = new SQL.Database(new Uint8Array(buffer));

    // Store in AppState
    AppState.data.dbInstance = db;


    return db;
}

/**
 * Get participant vote summary
 * @param {string} participantId - Participant ID
 * @returns {string} - Summary text
 */
function getParticipantVoteSummary(participantId) {
    if (!AppState.data.dbInstance || !AppState.data.commentTexts) return "(data not loaded)";

    const result = AppState.data.dbInstance.exec(`
      SELECT comment_id, vote
      FROM votes
      WHERE participant_id = '${participantId}'
    `);

    const rows = result[0]?.values || [];
    return rows
        .map(([cid, vote]) => {
            let label;
            if (vote === 1) label = "agree";
            else if (vote === -1) label = "disagree";
            else label = "pass";

            const text = AppState.data.commentTextMap?.[cid]?.txt || "<missing>";
            return `#${cid} - ${label}: ${text}`;
        })
        .join("\n");
}

/**
 * Calculate opacity scale factor based on vote count
 * @param {string} participantId - The participant ID
 * @returns {Promise<number>} - Scale factor between 0 and 1
 */
async function calculateOpacityScaleFactor(participantId) {
    // If scaling is disabled, return 1 (full opacity)
    if (!AppState.preferences.scaleOpacityWithVotes) {
        return 1;
    }

    // Ensure database is loaded
    if (!AppState.data.dbInstance) {
        try {
            await loadVotesDB(AppState.preferences.convoSlug);
        } catch (error) {
            console.error("Failed to load votes database:", error);
            return 1;
        }
    }

    // If comments not loaded, return 1
    if (!AppState.data.commentTexts) {
        return 1;
    }

    // Get all unmoderated statements
    const unmoderatedStatements = AppState.data.commentTexts.filter(s =>
        s.mod !== -1 && s.mod !== "-1"
    );

    // If no unmoderated statements, return 1
    if (unmoderatedStatements.length === 0) {
        return 1;
    }

    // Count how many statements this participant voted on
    const result = AppState.data.dbInstance.exec(`
      SELECT COUNT(*) as vote_count
      FROM votes
      WHERE participant_id = '${participantId}'
    `);

    const voteCount = result[0]?.values[0][0] || 0;

    // Calculate scale factor: votes / total unmoderated statements
    return Math.max(0.1, Math.min(1, voteCount / unmoderatedStatements.length));
}

/**
 * Load the dataset list from JSON
 */
function loadDatasetList() {
    return fetch("data/datasets.json")
        .then((res) => res.json())
        .then((datasets) => {
            const select = document.getElementById("dataset");
            const current = AppState.preferences.convoSlug;

            datasets.forEach(({ slug, label }) => {
                const option = document.createElement("option");
                option.value = slug;
                option.textContent = label;
                if (slug === current) option.selected = true;
                select.appendChild(option);
            });

            // fallback if current is invalid
            if (!datasets.find(d => d.slug === current)) {
                AppState.preferences.convoSlug = datasets[0]?.slug;
                saveState("dataset", AppState.preferences.convoSlug);
            }
        })
        .catch((err) => {
            console.error("Failed to load dataset list:", err);
        });
}

// For testing purposes, export objects and functions
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        loadAndRenderData,
        applySharedState,
        encodeShareState,
        decodeShareState,
        loadVotesDB,
        getParticipantVoteSummary,
        calculateOpacityScaleFactor,
        loadDatasetList
    };
}