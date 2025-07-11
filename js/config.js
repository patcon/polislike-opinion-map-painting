// ============================================================================
// Configuration
// ============================================================================

/**
 * Application configuration constants
 */
const Config = {
    // Default dot opacity
    dotOpacity: 0.3,
    // Default dot size
    dotSize: 3,

    // Reference: https://matplotlib.org/stable/users/explain/colors/colormaps.html#qualitative
    colors: {
        tab10: [
            "#1f77b4", // (A) muted blue
            "#ff7f0e", // (B) safety orange
            "#2ca02c", // (C) cooked asparagus green
            "#d62728", // (D) brick red
            "#9467bd", // (E) muted purple
            "#8c564b", // (F) chestnut brown
            "#e377c2", // (G) raspberry yogurt pink
            "#7f7f7f", // (H) middle gray
            "#bcbd22", // (I) curry yellow-green
            "#17becf", // (J) blue-teal
        ],
        /*
            ```py
            import matplotlib as plt
            for c in plt.cm.tab20.colors: print(matplotlib.colors.to_hex(c))
            ```
        */
        tab20: [
            "#1f77b4",
            "#aec7e8",
            "#ff7f0e",
            "#ffbb78",
            "#2ca02c",
            "#98df8a",
            "#d62728",
            "#ff9896",
            "#9467bd",
            "#c5b0d5",

            "#8c564b",
            "#c49c94",
            "#e377c2",
            "#f7b6d2",
            "#7f7f7f",
            "#c7c7c7",
            "#bcbd22",
            "#dbdb8d",
            "#17becf",
            "#9edae5",
        ],
    },

    // Chart colors for vote visualization
    voteColors: {
        agree: "rgb(46, 204, 113)",
        disagree: "rgb(231, 76, 60)",
        pass: "rgb(230,230,230)"
    },

    // Statistical thresholds
    stats: {
        minVotes: 3,
        significanceThreshold: 1.2816, // 90% confidence
    }
};

// ============================================================================
// State Management
// ============================================================================

/**
 * Application state management
 */
const AppState = {
    // Dimensions
    dimensions: {
        width: 0,
        height: 0
    },

    // Data
    data: {
        X1: null, // PCA projection
        X2: null, // PaCMAP projection
        X3: null, // LocalMAP projection
        participants: [],
        commentTexts: null,
        commentTextMap: {},
        meta: null,
        repComments: null,
        dbInstance: null
    },

    // UI State
    ui: {
        isDragging: false,
        hoveredIndices: new Set(),
        dotOpacity: Config.dotOpacity,
        dotSize: Config.dotSize,
        opacityFactorCache: {} // Cache for opacity scale factors
    },

    // Selection state
    selection: {
        colorToLabelIndex: {}, // hex -> int
        colorByIndex: [],
        selectedIndices: new Set(),
        customLabels: {}, // Store custom labels for groups (color -> label)
        includeUnpainted: false // Whether to include unpainted points as a group in analysis
    },

    // Preferences
    preferences: {
        convoSlug: null,
        isAdditive: false,
        flipX: false,
        flipY: false,
        scaleOpacityWithVotes: false,
        showGroupComparison: true,
        showGroupLabels: false
    },

    /**
     * Initialize the application state
     */
    init() {
        // Initialize color mapping
        Config.colors.tab10.forEach((color, i) => {
            this.selection.colorToLabelIndex[color] = i;
        });

        // Load preferences from session storage
        this.preferences.convoSlug = getQueryParam("dataset") || loadState("dataset", "bg2050");
        this.preferences.isAdditive = loadState("additive", false);
        this.preferences.flipX = loadState("flipX", false);
        this.preferences.flipY = loadState("flipY", false);
        this.preferences.scaleOpacityWithVotes = loadState("scaleOpacityWithVotes", false);
        this.preferences.showGroupComparison = loadState("showGroupComparison", true);
        this.preferences.showGroupLabels = loadState("showGroupLabels", false);
        this.ui.dotOpacity = Config.dotOpacity;
        this.ui.dotSize = Config.dotSize;

        // Load custom labels and selection preferences from session storage
        this.selection.customLabels = loadState("customLabels", {});
        this.selection.includeUnpainted = loadState("includeUnpainted", false);
    },

    /**
     * Update dimensions based on container size
     */
    updateDimensions() {
        const container = document.getElementById("plot-wrapper");
        const containerWidth = container.clientWidth;
        this.dimensions.width = containerWidth / 3 - 20;
        this.dimensions.height = this.dimensions.width;
    },

    /**
     * Reset data state for a new dataset
     */
    resetDataState(preserveCustomLabels = false) {
        this.data.dbInstance = null;
        this.data.commentTexts = null;
        this.data.repComments = null;
        this.ui.opacityFactorCache = {}; // Clear opacity cache when changing datasets
        document.getElementById("rep-comments-output").innerHTML = "";

        // Reset custom labels when changing datasets, unless preserveCustomLabels is true
        if (!preserveCustomLabels) {
            this.selection.customLabels = {};
            saveState("customLabels", {});
        }
    }
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Save state to session storage
 * @param {string} key - The key to save under
 * @param {any} value - The value to save
 */
function saveState(key, value) {
    sessionStorage.setItem(key, JSON.stringify(value));
}

/**
 * Load state from session storage
 * @param {string} key - The key to load
 * @param {any} defaultValue - Default value if key doesn't exist
 * @returns {any} - The loaded value or default
 */
function loadState(key, defaultValue) {
    const saved = sessionStorage.getItem(key);
    return saved !== null ? JSON.parse(saved) : defaultValue;
}

/**
 * Get a query parameter from the URL
 * @param {string} name - The parameter name
 * @returns {string|null} - The parameter value or null
 */
function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

/**
 * Convert a label index to a letter (A, B, C, etc.)
 * @param {number} i - The index
 * @returns {string} - The letter
 */
function labelIndexToLetter(i) {
    return String.fromCharCode("A".charCodeAt(0) + i);
}

/**
 * Show the plot loader overlay
 */
function showPlotLoader() {
    document.getElementById("plot-loader").style.display = "flex";
}

/**
 * Hide the plot loader overlay
 */
function hidePlotLoader() {
    document.getElementById("plot-loader").style.display = "none";
}

// For testing purposes, export objects and functions
/* istanbul ignore next */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        Config,
        AppState,
        getQueryParam,
        loadState,
        saveState,
        labelIndexToLetter,
        showPlotLoader,
        hidePlotLoader,
        // Add other functions you want to test
    };
}