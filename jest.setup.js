// Import jest-dom utilities
require('@testing-library/jest-dom');

// Mock D3.js
global.d3 = {
    json: jest.fn().mockImplementation((url) => {
        return Promise.resolve([]);
    }),
    select: jest.fn().mockReturnValue({
        append: jest.fn().mockReturnThis(),
        attr: jest.fn().mockReturnThis(),
        style: jest.fn().mockReturnThis(),
        text: jest.fn().mockReturnThis(),
        on: jest.fn().mockReturnThis(),
        selectAll: jest.fn().mockReturnThis(),
        data: jest.fn().mockReturnThis(),
        enter: jest.fn().mockReturnThis(),
        exit: jest.fn().mockReturnThis(),
        remove: jest.fn().mockReturnThis(),
        join: jest.fn().mockReturnThis(),
    }),
    // Add more D3 methods as needed
};

// Mock SQL.js
global.initSqlJs = jest.fn().mockResolvedValue({
    Database: jest.fn().mockImplementation(() => ({
        exec: jest.fn().mockReturnValue([]),
        prepare: jest.fn().mockReturnValue({
            bind: jest.fn().mockReturnThis(),
            step: jest.fn().mockReturnValue(false),
            get: jest.fn().mockReturnValue({}),
            free: jest.fn(),
        }),
        close: jest.fn(),
    })),
});

// Mock browser APIs not available in jsdom
global.URL.createObjectURL = jest.fn();
global.URL.revokeObjectURL = jest.fn();

// Mock localStorage and sessionStorage
const localStorageMock = (function () {
    let store = {};
    return {
        getItem: jest.fn(key => store[key] || null),
        setItem: jest.fn((key, value) => {
            store[key] = value.toString();
        }),
        clear: jest.fn(() => {
            store = {};
        }),
        removeItem: jest.fn(key => {
            delete store[key];
        }),
    };
})();

Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
});

Object.defineProperty(window, 'sessionStorage', {
    value: localStorageMock,
});