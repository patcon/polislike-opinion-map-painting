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

describe('AppState.init()', () => {
    let originalSessionStorage;
    let originalLocation;

    beforeEach(() => {
        // Save original objects
        originalSessionStorage = window.sessionStorage;
        originalLocation = window.location;

        // Mock sessionStorage
        const mockSessionStorage = {
            getItem: jest.fn(),
            setItem: jest.fn(),
            clear: jest.fn(),
            removeItem: jest.fn()
        };

        // Set up mock returns for loadState calls
        mockSessionStorage.getItem.mockImplementation((key) => {
            const mockData = {
                'dataset': '"saved-dataset"', // Note: sessionStorage stores strings, and loadState uses JSON.parse
                'additive': 'true',
                'flipX': 'true',
                'flipY': 'true',
                'scaleOpacityWithVotes': 'true',
                'showGroupComparison': 'false'
            };
            return mockData[key] || null;
        });

        delete window.sessionStorage;
        Object.defineProperty(window, 'sessionStorage', { value: mockSessionStorage, configurable: true });

        // Mock URL query parameters
        delete window.location;
        window.location = { search: '?dataset=url-dataset' };
    });

    afterEach(() => {
        // Restore original objects
        delete window.sessionStorage
        Object.defineProperty(window, 'sessionStorage', { value: originalSessionStorage, configurable: true });
        delete window.location
        window.location = originalLocation;
    });

    test('initializes color mapping correctly', () => {
        const { AppState, Config } = require('../config');

        // Reset AppState to ensure clean test
        AppState.selection.colorToLabelIndex = {};

        // Call the init method
        AppState.init();

        // Verify color mapping was initialized
        Config.colors.tab10.forEach((color, i) => {
            expect(AppState.selection.colorToLabelIndex[color]).toBe(i);
        });
    });

    test('loads preferences from URL query parameters first', () => {
        const { AppState } = require('../config');

        // Call the init method
        AppState.init();

        // URL parameter should take precedence over session storage
        expect(AppState.preferences.convoSlug).toBe('url-dataset');
    });

    test('loads dataset from sessionStorage when URL parameter is not present', () => {
        // Mock window.location to have no query parameters
        window.location.search = '';

        // Now require the module (after setting up all mocks)
        const { AppState } = require('../config');

        // Call the init method
        AppState.init();

        // Verify that the value from sessionStorage was used
        expect(AppState.preferences.convoSlug).toBe('saved-dataset');
    });

    test('uses default values when neither URL nor session storage has values', () => {
        // Update mock URL to remove dataset parameter
        window.location.search = '';

        // Make sessionStorage return null for dataset
        window.sessionStorage.getItem.mockImplementation((key) => {
            if (key === 'dataset') return null;
            return JSON.stringify(true); // Return something for other keys
        });

        const { AppState } = require('../config');

        // Call the init method
        AppState.init();

        // Should use the default value
        expect(AppState.preferences.convoSlug).toBe('bg2050');
    });

    test('initializes UI properties correctly', () => {
        const { AppState, Config } = require('../config');

        // Call the init method
        AppState.init();

        // Verify UI properties were set to Config defaults
        expect(AppState.ui.dotOpacity).toBe(Config.dotOpacity);
        expect(AppState.ui.dotSize).toBe(Config.dotSize);
    });

    test('loads all preferences from session storage correctly', () => {
        // Update mock URL to remove dataset parameter
        window.location.search = '';

        const { AppState } = require('../config');

        // Call the init method
        AppState.init();

        // Verify all preferences were loaded from session storage
        expect(AppState.preferences.isAdditive).toBe(true);
        expect(AppState.preferences.flipX).toBe(true);
        expect(AppState.preferences.flipY).toBe(true);
        expect(AppState.preferences.scaleOpacityWithVotes).toBe(true);
        expect(AppState.preferences.showGroupComparison).toBe(false);
    });
});