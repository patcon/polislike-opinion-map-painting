/**
 * Test wrapper for data.js functions
 *
 * This module wraps the loadAndRenderData function from data.js
 * and injects our mocks for testing.
 */

// Create mock objects
const mockAppState = {
    resetDataState: vi.fn(),
    data: {
        participants: [],
        meta: null,
        commentTexts: null,
        commentTextMap: {},
        X1: null,
        X2: null,
        X3: null,
    },
    selection: {
        colorByIndex: [],
        selectedIndices: {
            clear: vi.fn(),
        },
    },
};

// Mock UI functions
const mockShowPlotLoader = vi.fn();
const mockHidePlotLoader = vi.fn();
const mockRenderMetaInfo = vi.fn();
const mockRenderAllPlots = vi.fn();
const mockRenderColorPalette = vi.fn();
const mockUpdateLabelCounts = vi.fn();

// Get the original function
const originalLoadAndRenderData = require("../data").loadAndRenderData;

// Create a wrapped version that uses our mocks
function loadAndRenderData(slug) {
    // Save original globals
    const originalGlobals = {
        AppState: global.AppState,
        showPlotLoader: global.showPlotLoader,
        hidePlotLoader: global.hidePlotLoader,
        renderMetaInfo: global.renderMetaInfo,
        renderAllPlots: global.renderAllPlots,
        renderColorPalette: global.renderColorPalette,
        updateLabelCounts: global.updateLabelCounts,
    };

    // Set our mocks as globals
    global.AppState = mockAppState;
    global.showPlotLoader = mockShowPlotLoader;
    global.hidePlotLoader = mockHidePlotLoader;
    global.renderMetaInfo = mockRenderMetaInfo;
    global.renderAllPlots = mockRenderAllPlots;
    global.renderColorPalette = mockRenderColorPalette;
    global.updateLabelCounts = mockUpdateLabelCounts;

    // Call the original function
    const result = originalLoadAndRenderData(slug);

    // Restore original globals
    global.AppState = originalGlobals.AppState;
    global.showPlotLoader = originalGlobals.showPlotLoader;
    global.hidePlotLoader = originalGlobals.hidePlotLoader;
    global.renderMetaInfo = originalGlobals.renderMetaInfo;
    global.renderAllPlots = originalGlobals.renderAllPlots;
    global.renderColorPalette = originalGlobals.renderColorPalette;
    global.updateLabelCounts = originalGlobals.updateLabelCounts;

    return result;
}

// Export the wrapped function and mocks
module.exports = {
    loadAndRenderData,
    mockAppState,
    mockShowPlotLoader,
    mockHidePlotLoader,
    mockRenderMetaInfo,
    mockRenderAllPlots,
    mockRenderColorPalette,
    mockUpdateLabelCounts,
};
