// Import the test module
const { loadAndRenderDataWithMocks } = require('./data-test-module');

// Create mock objects
const mockAppState = {
    resetDataState: jest.fn(),
    data: {
        participants: [],
        meta: null,
        commentTexts: null,
        commentTextMap: {},
        X1: null,
        X2: null,
        X3: null
    },
    selection: {
        colorByIndex: [],
        selectedIndices: {
            clear: jest.fn()
        }
    }
};

// Mock UI functions
const mockShowPlotLoader = jest.fn();
const mockHidePlotLoader = jest.fn();
const mockRenderMetaInfo = jest.fn();
const mockRenderAllPlots = jest.fn();
const mockRenderColorPalette = jest.fn();
const mockUpdateLabelCounts = jest.fn();

// Create a collection of all mocks
const mocks = {
    AppState: mockAppState,
    showPlotLoader: mockShowPlotLoader,
    hidePlotLoader: mockHidePlotLoader,
    renderMetaInfo: mockRenderMetaInfo,
    renderAllPlots: mockRenderAllPlots,
    renderColorPalette: mockRenderColorPalette,
    updateLabelCounts: mockUpdateLabelCounts
};

// Helper function to call the wrapped function with our mocks
function loadAndRenderData(slug) {
    return loadAndRenderDataWithMocks(slug, mocks);
}

describe('loadAndRenderData', () => {
    // Reset all mocks before each test
    beforeEach(() => {
        jest.clearAllMocks();

        // Reset mockAppState data properties
        mockAppState.data.participants = [];
        mockAppState.data.meta = null;
        mockAppState.data.commentTexts = null;
        mockAppState.data.commentTextMap = {};
        mockAppState.data.X1 = null;
        mockAppState.data.X2 = null;
        mockAppState.data.X3 = null;

        // Mock d3.json to return test data
        global.d3.json.mockImplementation((url) => {
            if (url.includes('pca.json')) {
                return Promise.resolve([
                    ['p1', [0.1, 0.2]],
                    ['p2', [0.3, 0.4]]
                ]);
            } else if (url.includes('pacmap.json')) {
                return Promise.resolve([
                    ['p1', [0.5, 0.6]],
                    ['p2', [0.7, 0.8]]
                ]);
            } else if (url.includes('localmap.json')) {
                return Promise.resolve([
                    ['p1', [0.9, 1.0]],
                    ['p2', [1.1, 1.2]]
                ]);
            } else if (url.includes('meta.json')) {
                return Promise.resolve({
                    title: 'Test Dataset',
                    description: 'Test Description'
                });
            } else if (url.includes('statements.json')) {
                return Promise.resolve([
                    {
                        tid: 's1',
                        pid: 'p1',
                        mod: 0,
                        txt: 'Statement 1'
                    },
                    {
                        statement_id: 's2',
                        participant_id: 'p2',
                        moderated: 0,
                        text: 'Statement 2'
                    }
                ]);
            }
            return Promise.resolve(null);
        });
    });

    test('resets data state before loading', async () => {
        await loadAndRenderData('test-dataset');
        expect(mockAppState.resetDataState).toHaveBeenCalledTimes(1);
    });

    test('loads and processes data correctly', async () => {
        await loadAndRenderData('test-dataset');

        // Check that participants were extracted correctly
        expect(mockAppState.data.participants).toEqual(['p1', 'p2']);

        // Check that meta data was stored
        expect(mockAppState.data.meta).toEqual({
            title: 'Test Dataset',
            description: 'Test Description'
        });

        // Check that projection data was stored correctly
        expect(mockAppState.data.X1).toEqual([[0.1, 0.2], [0.3, 0.4]]);
        expect(mockAppState.data.X2).toEqual([[0.5, 0.6], [0.7, 0.8]]);
        expect(mockAppState.data.X3).toEqual([[0.9, 1.0], [1.1, 1.2]]);

        // Check that selection state was reset
        expect(mockAppState.selection.colorByIndex.length).toBe(2); // Same as number of participants
        expect(mockAppState.selection.colorByIndex.every(c => c === null)).toBe(true);
        expect(mockAppState.selection.selectedIndices.clear).toHaveBeenCalledTimes(1);
    });

    test('processes statements with different field names', async () => {
        await loadAndRenderData('test-dataset');

        // Wait for the statements promise to resolve
        await new Promise(process.nextTick);

        // Check that statements were normalized correctly
        expect(mockAppState.data.commentTexts).toEqual([
            {
                tid: 's1',
                pid: 'p1',
                mod: 0,
                txt: 'Statement 1'
            },
            {
                tid: 's2',
                pid: 'p2',
                mod: 0,
                txt: 'Statement 2',
                statement_id: 's2',
                participant_id: 'p2',
                moderated: 0,
                text: 'Statement 2'
            }
        ]);

        // Check that the comment text map was created correctly
        expect(mockAppState.data.commentTextMap).toEqual({
            's1': {
                tid: 's1',
                pid: 'p1',
                mod: 0,
                txt: 'Statement 1'
            },
            's2': {
                tid: 's2',
                pid: 'p2',
                mod: 0,
                txt: 'Statement 2',
                statement_id: 's2',
                participant_id: 'p2',
                moderated: 0,
                text: 'Statement 2'
            }
        });
    });

    test('handles missing text in statements', async () => {
        // Save the original mock implementation
        const originalMock = global.d3.json.getMockImplementation();

        // Mock statements with missing text
        global.d3.json.mockImplementation((url) => {
            if (url.includes('statements.json')) {
                return Promise.resolve([
                    {
                        tid: 's1',
                        pid: 'p1',
                        mod: 0
                        // No txt or text field
                    }
                ]);
            } else if (url.includes('pca.json')) {
                return Promise.resolve([
                    ['p1', [0.1, 0.2]],
                    ['p2', [0.3, 0.4]]
                ]);
            } else if (url.includes('pacmap.json')) {
                return Promise.resolve([
                    ['p1', [0.5, 0.6]],
                    ['p2', [0.7, 0.8]]
                ]);
            } else if (url.includes('localmap.json')) {
                return Promise.resolve([
                    ['p1', [0.9, 1.0]],
                    ['p2', [1.1, 1.2]]
                ]);
            } else if (url.includes('meta.json')) {
                return Promise.resolve({
                    title: 'Test Dataset',
                    description: 'Test Description'
                });
            }
            return Promise.resolve(null);
        });

        await loadAndRenderData('test-dataset');

        // Wait for the statements promise to resolve
        await new Promise(process.nextTick);

        // Check that missing text is replaced with "<missing>"
        expect(mockAppState.data.commentTexts[0].txt).toBe('<missing>');
    });

    test('calls UI functions in the correct order', async () => {
        await loadAndRenderData('test-dataset');

        // Check that UI functions were called in the correct order
        expect(mockShowPlotLoader).toHaveBeenCalledTimes(1);
        expect(mockRenderMetaInfo).toHaveBeenCalledTimes(1);
        expect(mockRenderAllPlots).toHaveBeenCalledTimes(1);
        expect(mockRenderColorPalette).toHaveBeenCalledTimes(1);
        expect(mockUpdateLabelCounts).toHaveBeenCalledTimes(1);
        expect(mockHidePlotLoader).toHaveBeenCalledTimes(1);

        // Check the order of calls
        const showLoaderCallOrder = mockShowPlotLoader.mock.invocationCallOrder[0];
        const renderMetaCallOrder = mockRenderMetaInfo.mock.invocationCallOrder[0];
        const renderPlotsCallOrder = mockRenderAllPlots.mock.invocationCallOrder[0];
        const renderPaletteCallOrder = mockRenderColorPalette.mock.invocationCallOrder[0];
        const updateLabelsCallOrder = mockUpdateLabelCounts.mock.invocationCallOrder[0];
        const hideLoaderCallOrder = mockHidePlotLoader.mock.invocationCallOrder[0];

        expect(showLoaderCallOrder).toBeLessThan(renderPlotsCallOrder);
        expect(renderPlotsCallOrder).toBeLessThan(renderPaletteCallOrder);
        expect(renderPaletteCallOrder).toBeLessThan(updateLabelsCallOrder);
        expect(updateLabelsCallOrder).toBeLessThan(hideLoaderCallOrder);
    });

    test('handles missing meta.json gracefully', async () => {
        // Mock d3.json to simulate meta.json not found
        global.d3.json.mockImplementation((url) => {
            if (url.includes('meta.json')) {
                return Promise.reject(new Error('Not found'));
            } else if (url.includes('pca.json')) {
                return Promise.resolve([
                    ['p1', [0.1, 0.2]],
                    ['p2', [0.3, 0.4]]
                ]);
            } else if (url.includes('pacmap.json')) {
                return Promise.resolve([
                    ['p1', [0.5, 0.6]],
                    ['p2', [0.7, 0.8]]
                ]);
            } else if (url.includes('localmap.json')) {
                return Promise.resolve([
                    ['p1', [0.9, 1.0]],
                    ['p2', [1.1, 1.2]]
                ]);
            } else if (url.includes('statements.json')) {
                return Promise.resolve([
                    {
                        tid: 's1',
                        pid: 'p1',
                        mod: 0,
                        txt: 'Statement 1'
                    }
                ]);
            }
            return Promise.resolve(null);
        });

        await loadAndRenderData('test-dataset');

        // Check that meta is null when meta.json is missing
        expect(mockAppState.data.meta).toBeNull();

        // Check that the function still completes and calls UI functions
        expect(mockRenderAllPlots).toHaveBeenCalledTimes(1);
        expect(mockHidePlotLoader).toHaveBeenCalledTimes(1);
    });

    test('returns a promise that resolves when data is loaded', async () => {
        const promise = loadAndRenderData('test-dataset');
        expect(promise).toBeInstanceOf(Promise);

        // The promise should resolve without errors
        await expect(promise).resolves.toBeUndefined();
    });
});
