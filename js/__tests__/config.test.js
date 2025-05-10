describe('Config object', () => {
    // We need to import the Config object from main.js
    // This requires modifying main.js to export Config

    test('Config has expected properties', () => {
        // This is just a placeholder - you'll need to modify main.js to export Config
        const Config = require('../config').Config;

        expect(Config).toBeDefined();
        expect(Config.dotOpacity).toBe(0.3);
        expect(Config.dotSize).toBe(3);
        expect(Config.colors.tab10).toHaveLength(10);
    });
});

describe('Utility functions', () => {
    // Test utility functions like getQueryParam, loadState, etc.

    test('getQueryParam returns null for non-existent parameter', () => {
        // Mock URL
        delete window.location;
        window.location = { search: '?dataset=test' };

        // Import the function (after modifying main.js to export it)
        const getQueryParam = require('../config').getQueryParam;

        expect(getQueryParam('nonexistent')).toBeNull();
        expect(getQueryParam('dataset')).toBe('test');
    });
});

describe('DOM manipulation', () => {
    beforeEach(() => {
        // Set up the DOM
        document.body.innerHTML = `
        <div id="plot-wrapper" style="width: 900px;"></div>
        <svg id="plot1"></svg>
        <div id="color-palette"></div>
        <div id="label-counts"></div>
      `;
    });

    test('updateDimensions sets correct dimensions', () => {
        // Mock clientWidth
        const plotWrapper = document.getElementById('plot-wrapper');
        Object.defineProperty(plotWrapper, 'clientWidth', {
            configurable: true,
            value: 900
        });

        // Get AppState and call its updateDimensions method
        const AppState = require('../config').AppState;
        AppState.updateDimensions();

        // Check if AppState dimensions were updated correctly
        expect(AppState.dimensions.width).toBe(280); // (900 / 3) - 20
        expect(AppState.dimensions.height).toBe(280);
    });
});