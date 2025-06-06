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

    describe('saveState', () => {
        let originalSessionStorage;

        beforeEach(() => {
            // Save original sessionStorage
            originalSessionStorage = window.sessionStorage;

            // Mock sessionStorage
            const mockSessionStorage = {
                getItem: jest.fn(),
                setItem: jest.fn(),
                clear: jest.fn(),
                removeItem: jest.fn()
            };

            delete window.sessionStorage;
            Object.defineProperty(window, 'sessionStorage', {
                value: mockSessionStorage,
                configurable: true
            });
        });

        afterEach(() => {
            // Restore original sessionStorage
            delete window.sessionStorage;
            Object.defineProperty(window, 'sessionStorage', {
                value: originalSessionStorage,
                configurable: true
            });
        });

        test('saves string values correctly', () => {
            const saveState = require('../config').saveState;

            saveState('testKey', 'testValue');

            expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
                'testKey',
                JSON.stringify('testValue')
            );
        });

        test('saves numeric values correctly', () => {
            const saveState = require('../config').saveState;

            saveState('numKey', 42);

            expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
                'numKey',
                JSON.stringify(42)
            );
        });

        test('saves boolean values correctly', () => {
            const saveState = require('../config').saveState;

            saveState('boolKey', true);

            expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
                'boolKey',
                JSON.stringify(true)
            );
        });

        test('saves object values correctly', () => {
            const saveState = require('../config').saveState;
            const testObject = { name: 'Test', values: [1, 2, 3] };

            saveState('objectKey', testObject);

            expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
                'objectKey',
                JSON.stringify(testObject)
            );
        });

        test('saves array values correctly', () => {
            const saveState = require('../config').saveState;
            const testArray = [1, 'two', { three: 3 }];

            saveState('arrayKey', testArray);

            expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
                'arrayKey',
                JSON.stringify(testArray)
            );
        });
    });

    describe('labelIndexToLetter', () => {
        test('converts index 0 to A', () => {
            const labelIndexToLetter = require('../config').labelIndexToLetter;
            expect(labelIndexToLetter(0)).toBe('A');
        });

        test('converts index 1 to B', () => {
            const labelIndexToLetter = require('../config').labelIndexToLetter;
            expect(labelIndexToLetter(1)).toBe('B');
        });

        test('converts index 25 to Z', () => {
            const labelIndexToLetter = require('../config').labelIndexToLetter;
            expect(labelIndexToLetter(25)).toBe('Z');
        });

        test('converts large indices correctly', () => {
            const labelIndexToLetter = require('../config').labelIndexToLetter;
            // This should wrap around the alphabet
            expect(labelIndexToLetter(26)).toBe('[');  // ASCII after 'Z'
            expect(labelIndexToLetter(27)).toBe('\\'); // ASCII after '['
        });
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

    describe('Plot loader functions', () => {
        beforeEach(() => {
            // Set up the DOM with plot-loader element
            document.body.innerHTML = `
                <div id="plot-loader" style="display: none;"></div>
            `;
        });

        test('showPlotLoader sets display to flex', () => {
            const showPlotLoader = require('../config').showPlotLoader;

            // Call the function
            showPlotLoader();

            // Check if the display style was updated correctly
            const loaderElement = document.getElementById('plot-loader');
            expect(loaderElement.style.display).toBe('flex');
        });

        test('hidePlotLoader sets display to none', () => {
            const hidePlotLoader = require('../config').hidePlotLoader;

            // Set initial display to something other than none
            const loaderElement = document.getElementById('plot-loader');
            loaderElement.style.display = 'flex';

            // Call the function
            hidePlotLoader();

            // Check if the display style was updated correctly
            expect(loaderElement.style.display).toBe('none');
        });

        test('showPlotLoader and hidePlotLoader work together', () => {
            const showPlotLoader = require('../config').showPlotLoader;
            const hidePlotLoader = require('../config').hidePlotLoader;

            const loaderElement = document.getElementById('plot-loader');

            // Initially hidden
            expect(loaderElement.style.display).toBe('none');

            // Show loader
            showPlotLoader();
            expect(loaderElement.style.display).toBe('flex');

            // Hide loader
            hidePlotLoader();
            expect(loaderElement.style.display).toBe('none');
        });
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

describe('AppState.resetDataState()', () => {
    beforeEach(() => {
        // Set up the DOM
        document.body.innerHTML = `
      <div id="rep-comments-output">Initial content</div>
    `;

        // Import AppState
        const { AppState } = require('../config');

        // Set up initial state with mock data
        AppState.data.dbInstance = { mock: 'database' };
        AppState.data.commentTexts = [{ id: 1, text: 'Test comment' }];
        AppState.data.repComments = { group1: [{ id: 1 }] };
        AppState.ui.opacityFactorCache = { 'user1': 0.5, 'user2': 0.8 };
    });

    test('resets data state properties to null', () => {
        const { AppState } = require('../config');

        // Call the method being tested
        AppState.resetDataState();

        // Verify data properties are reset to null
        expect(AppState.data.dbInstance).toBeNull();
        expect(AppState.data.commentTexts).toBeNull();
        expect(AppState.data.repComments).toBeNull();
    });

    test('clears the opacity factor cache', () => {
        const { AppState } = require('../config');

        // Call the method being tested
        AppState.resetDataState();

        // Verify the opacity cache is empty
        expect(AppState.ui.opacityFactorCache).toEqual({});
    });

    test('clears the rep-comments-output element', () => {
        const { AppState } = require('../config');

        // Verify the element has content before reset
        const outputElement = document.getElementById('rep-comments-output');
        expect(outputElement.innerHTML).toBe('Initial content');

        // Call the method being tested
        AppState.resetDataState();

        // Verify the element is now empty
        expect(outputElement.innerHTML).toBe('');
    });
});
