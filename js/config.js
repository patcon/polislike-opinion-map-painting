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

    // Developer feature flags
    features: {
        showOverallStats: true, // Show overall stats bar chart instead of simple percentage
    },

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
        ]
    },

    // Chart colors for vote visualization
    voteColors: {
        agree: "#2ecc71",
        disagree: "#e74c3c",
        pass: "#e6e6e6"
    },

    // Alternative vote colors with highlighted pass votes
    voteColorsHighlightPass: {
        agree: "#2ecc71",
        disagree: "#e74c3c",
        pass: "#f1c40f"  // Yellow for highlighted pass votes
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
        includeUnpainted: false, // Whether to include unpainted points as a group in analysis
        voteColorByIndex: [], // Store vote colors when showing votes
        activeAnalysisTab: null, // Track the active tab in the analysis table
    },

    // Preferences
    preferences: {
        convoSlug: null,
        isAdditive: false,
        flipX: false,
        flipY: false,
        scaleOpacityWithVotes: false,
        showGroupComparison: true,
        showGroupLabels: false,
        showVotes: false,
        highlightPassVotes: false,
        keepColoredOnTop: false,
        showPCA: true,
        showPaCMAP: true,
        showLocalMAP: true,
    },

    /**
     * Initialize the application state
     */
    init() {
        // Initialize color mapping
        Config.colors.tab10.forEach((color, i) => {
            this.selection.colorToLabelIndex[color] = i;
        });

        // Check if we're on mobile
        const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

        // Set mobile-specific defaults for plot visibility
        // On mobile, show only LocalMAP by default if no settings exist
        const mobileDefaults = isMobile ? {
            showPCA: false,
            showPaCMAP: false,
            showLocalMAP: true
        } : {
            showPCA: true,
            showPaCMAP: true,
            showLocalMAP: true
        };

        // Load preferences from session storage
        this.preferences.convoSlug = getQueryParam("dataset") || loadState("dataset", "bg2050");
        this.preferences.isAdditive = loadState("additive", false);
        this.preferences.flipX = loadState("flipX", false);
        this.preferences.flipY = loadState("flipY", false);
        this.preferences.scaleOpacityWithVotes = loadState("scaleOpacityWithVotes", false);
        this.preferences.showGroupComparison = loadState("showGroupComparison", true);
        this.preferences.showGroupLabels = loadState("showGroupLabels", false);
        this.preferences.highlightPassVotes = loadState("highlightPassVotes", false);
        this.preferences.showVotes = loadState("showVotes", false);
        this.preferences.statementId = loadState("statementId", "0");
        this.preferences.keepColoredOnTop = loadState("keepColoredOnTop", false);
        this.preferences.showPCA = loadState("showPCA", mobileDefaults.showPCA);
        this.preferences.showPaCMAP = loadState("showPaCMAP", mobileDefaults.showPaCMAP);
        this.preferences.showLocalMAP = loadState("showLocalMAP", mobileDefaults.showLocalMAP);
        this.ui.dotOpacity = loadState("dotOpacity", Config.dotOpacity);
        this.ui.dotSize = loadState("dotSize", Config.dotSize);

        // Load custom labels and selection preferences from session storage
        this.selection.customLabels = loadState("customLabels", {});
        this.selection.includeUnpainted = loadState("includeUnpainted", false);
    },

    /**
     * Update dimensions based on container size and visible plots
     */
    updateDimensions() {
        const container = document.getElementById("plot-wrapper");
        const containerWidth = container.clientWidth;

        // Count visible plots
        const visiblePlots = [
            this.preferences.showPCA,
            this.preferences.showPaCMAP,
            this.preferences.showLocalMAP
        ].filter(Boolean).length;

        // Ensure at least one plot is visible
        const plotCount = Math.max(1, visiblePlots);

        this.dimensions.width = containerWidth / plotCount - 20;
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

        // Clear the active analysis tab when changing datasets
        this.selection.activeAnalysisTab = null;
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
