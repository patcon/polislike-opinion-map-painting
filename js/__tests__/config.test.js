import { vi } from "vitest";

describe("Config object", () => {
    test("Config has expected properties", () => {
        const Config = require("../config").Config;

        expect(Config).toBeDefined();
        expect(Config.dotOpacity).toBe(0.3);
        expect(Config.dotSize).toBe(3);
        expect(Config.colors.tab10).toHaveLength(10);
    });
});

describe("Utility functions", () => {
    test("getQueryParam returns null for non-existent parameter", () => {
        delete window.location;
        window.location = { search: "?dataset=test" };

        const getQueryParam = require("../config").getQueryParam;

        expect(getQueryParam("nonexistent")).toBeNull();
        expect(getQueryParam("dataset")).toBe("test");
    });

    describe("saveState", () => {
        let originalSessionStorage;

        beforeEach(() => {
            originalSessionStorage = window.sessionStorage;

            const mockSessionStorage = {
                getItem: vi.fn(),
                setItem: vi.fn(),
                clear: vi.fn(),
                removeItem: vi.fn(),
            };

            delete window.sessionStorage;
            Object.defineProperty(window, "sessionStorage", {
                value: mockSessionStorage,
                configurable: true,
            });
        });

        afterEach(() => {
            delete window.sessionStorage;
            Object.defineProperty(window, "sessionStorage", {
                value: originalSessionStorage,
                configurable: true,
            });
        });

        test("saves string values correctly", () => {
            const saveState = require("../config").saveState;

            saveState("testKey", "testValue");

            expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
                "testKey",
                JSON.stringify("testValue"),
            );
        });

        test("saves numeric values correctly", () => {
            const saveState = require("../config").saveState;

            saveState("numKey", 42);

            expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
                "numKey",
                JSON.stringify(42),
            );
        });

        test("saves boolean values correctly", () => {
            const saveState = require("../config").saveState;

            saveState("boolKey", true);

            expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
                "boolKey",
                JSON.stringify(true),
            );
        });

        test("saves object values correctly", () => {
            const saveState = require("../config").saveState;
            const testObject = { name: "Test", values: [1, 2, 3] };

            saveState("objectKey", testObject);

            expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
                "objectKey",
                JSON.stringify(testObject),
            );
        });

        test("saves array values correctly", () => {
            const saveState = require("../config").saveState;
            const testArray = [1, "two", { three: 3 }];

            saveState("arrayKey", testArray);

            expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
                "arrayKey",
                JSON.stringify(testArray),
            );
        });
    });

    describe("labelIndexToLetter", () => {
        test("converts index 0 to A", () => {
            const labelIndexToLetter = require("../config").labelIndexToLetter;
            expect(labelIndexToLetter(0)).toBe("A");
        });

        test("converts index 1 to B", () => {
            const labelIndexToLetter = require("../config").labelIndexToLetter;
            expect(labelIndexToLetter(1)).toBe("B");
        });

        test("converts index 25 to Z", () => {
            const labelIndexToLetter = require("../config").labelIndexToLetter;
            expect(labelIndexToLetter(25)).toBe("Z");
        });

        test("converts large indices correctly", () => {
            const labelIndexToLetter = require("../config").labelIndexToLetter;
            expect(labelIndexToLetter(26)).toBe("[");
            expect(labelIndexToLetter(27)).toBe("\\");
        });
    });
});

describe("DOM manipulation", () => {
    beforeEach(() => {
        document.body.innerHTML = `
        <div id="plot-wrapper" style="width: 900px;"></div>
        <svg id="plot1"></svg>
        <div id="color-palette"></div>
        <div id="label-counts"></div>
      `;
    });

    test("updateDimensions sets correct dimensions", () => {
        const plotWrapper = document.getElementById("plot-wrapper");
        Object.defineProperty(plotWrapper, "clientWidth", {
            configurable: true,
            value: 900,
        });

        const AppState = require("../config").AppState;
        AppState.updateDimensions();

        expect(AppState.dimensions.width).toBe(280);
        expect(AppState.dimensions.height).toBe(280);
    });

    describe("Plot loader functions", () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <div id="plot-loader" style="display: none;"></div>
            `;
        });

        test("showPlotLoader sets display to flex", () => {
            const showPlotLoader = require("../config").showPlotLoader;

            showPlotLoader();

            const loaderElement = document.getElementById("plot-loader");
            expect(loaderElement.style.display).toBe("flex");
        });

        test("hidePlotLoader sets display to none", () => {
            const hidePlotLoader = require("../config").hidePlotLoader;

            const loaderElement = document.getElementById("plot-loader");
            loaderElement.style.display = "flex";

            hidePlotLoader();

            expect(loaderElement.style.display).toBe("none");
        });

        test("showPlotLoader and hidePlotLoader work together", () => {
            const showPlotLoader = require("../config").showPlotLoader;
            const hidePlotLoader = require("../config").hidePlotLoader;

            const loaderElement = document.getElementById("plot-loader");

            expect(loaderElement.style.display).toBe("none");

            showPlotLoader();
            expect(loaderElement.style.display).toBe("flex");

            hidePlotLoader();
            expect(loaderElement.style.display).toBe("none");
        });
    });
});

describe("AppState.init()", () => {
    let originalSessionStorage;
    let originalLocation;

    beforeEach(() => {
        originalSessionStorage = window.sessionStorage;
        originalLocation = window.location;

        const mockSessionStorage = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            clear: vi.fn(),
            removeItem: vi.fn(),
        };

        mockSessionStorage.getItem.mockImplementation((key) => {
            const mockData = {
                dataset: '"saved-dataset"',
                additive: "true",
                flipX: "true",
                flipY: "true",
                scaleOpacityWithVotes: "true",
                showGroupComparison: "false",
            };
            return mockData[key] || null;
        });

        delete window.sessionStorage;
        Object.defineProperty(window, "sessionStorage", {
            value: mockSessionStorage,
            configurable: true,
        });

        delete window.location;
        window.location = { search: "?dataset=url-dataset" };
    });

    afterEach(() => {
        delete window.sessionStorage;
        Object.defineProperty(window, "sessionStorage", {
            value: originalSessionStorage,
            configurable: true,
        });
        delete window.location;
        window.location = originalLocation;
    });

    test("initializes color mapping correctly", () => {
        const { AppState, Config } = require("../config");

        AppState.selection.colorToLabelIndex = {};

        AppState.init();

        Config.colors.tab10.forEach((color, i) => {
            expect(AppState.selection.colorToLabelIndex[color]).toBe(i);
        });
    });

    test("loads preferences from URL query parameters first", () => {
        const { AppState } = require("../config");

        AppState.init();

        expect(AppState.preferences.convoSlug).toBe("url-dataset");
    });

    test("loads dataset from sessionStorage when URL parameter is not present", () => {
        window.location.search = "";

        const { AppState } = require("../config");

        AppState.init();

        expect(AppState.preferences.convoSlug).toBe("saved-dataset");
    });

    test("uses default values when neither URL nor session storage has values", () => {
        window.location.search = "";

        window.sessionStorage.getItem.mockImplementation((key) => {
            if (key === "dataset") return null;
            return JSON.stringify(true);
        });

        const { AppState } = require("../config");

        AppState.init();

        expect(AppState.preferences.convoSlug).toBe("bg2050");
    });

    test("initializes UI properties correctly", () => {
        const { AppState, Config } = require("../config");

        AppState.init();

        expect(AppState.ui.dotOpacity).toBe(Config.dotOpacity);
        expect(AppState.ui.dotSize).toBe(Config.dotSize);
    });

    test("loads all preferences from session storage correctly", () => {
        window.location.search = "";

        const { AppState } = require("../config");

        AppState.init();

        expect(AppState.preferences.isAdditive).toBe(true);
        expect(AppState.preferences.flipX).toBe(true);
        expect(AppState.preferences.flipY).toBe(true);
        expect(AppState.preferences.scaleOpacityWithVotes).toBe(true);
        expect(AppState.preferences.showGroupComparison).toBe(false);
    });
});

describe("AppState.resetDataState()", () => {
    beforeEach(() => {
        document.body.innerHTML = `
      <div id="rep-comments-output">Initial content</div>
    `;

        const { AppState } = require("../config");

        AppState.data.dbInstance = { mock: "database" };
        AppState.data.commentTexts = [{ id: 1, text: "Test comment" }];
        AppState.data.repComments = { group1: [{ id: 1 }] };
        AppState.ui.opacityFactorCache = { user1: 0.5, user2: 0.8 };
    });

    test("resets data state properties to null", () => {
        const { AppState } = require("../config");

        AppState.resetDataState();

        expect(AppState.data.dbInstance).toBeNull();
        expect(AppState.data.commentTexts).toBeNull();
        expect(AppState.data.repComments).toBeNull();
    });

    test("clears the opacity factor cache", () => {
        const { AppState } = require("../config");

        AppState.resetDataState();

        expect(AppState.ui.opacityFactorCache).toEqual({});
    });

    test("clears the rep-comments-output element", () => {
        const { AppState } = require("../config");

        const outputElement = document.getElementById("rep-comments-output");
        expect(outputElement.innerHTML).toBe("Initial content");

        AppState.resetDataState();

        expect(outputElement.innerHTML).toBe("");
    });
});
