/**
 * Test-specific version of data.js that uses Jest mocks
 */

// Import the original data.js module
const originalDataModule = require('../data');

// Create a wrapper function that uses our mocks
function loadAndRenderDataWithMocks(slug, mocks) {
    // Set up global mocks
    global.AppState = mocks.AppState;
    global.showPlotLoader = mocks.showPlotLoader;
    global.hidePlotLoader = mocks.hidePlotLoader;
    global.renderMetaInfo = mocks.renderMetaInfo;
    global.renderAllPlots = mocks.renderAllPlots;
    global.renderColorPalette = mocks.renderColorPalette;
    global.updateLabelCounts = mocks.updateLabelCounts;

    // Call the original function
    return originalDataModule.loadAndRenderData(slug);
}

module.exports = {
    loadAndRenderDataWithMocks
};