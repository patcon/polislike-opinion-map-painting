import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock D3.js
global.d3 = {
    json: vi.fn().mockImplementation(() => {
        return Promise.resolve([]);
    }),
    select: vi.fn().mockReturnValue({
        append: vi.fn().mockReturnThis(),
        attr: vi.fn().mockReturnThis(),
        style: vi.fn().mockReturnThis(),
        text: vi.fn().mockReturnThis(),
        on: vi.fn().mockReturnThis(),
        selectAll: vi.fn().mockReturnThis(),
        data: vi.fn().mockReturnThis(),
        enter: vi.fn().mockReturnThis(),
        exit: vi.fn().mockReturnThis(),
        remove: vi.fn().mockReturnThis(),
        join: vi.fn().mockReturnThis(),
    }),
};

// Mock SQL.js
global.initSqlJs = vi.fn().mockResolvedValue({
    Database: vi.fn().mockImplementation(() => ({
        exec: vi.fn().mockReturnValue([]),
        prepare: vi.fn().mockReturnValue({
            bind: vi.fn().mockReturnThis(),
            step: vi.fn().mockReturnValue(false),
            get: vi.fn().mockReturnValue({}),
            free: vi.fn(),
        }),
        close: vi.fn(),
    })),
});

// Mock browser APIs not available in jsdom
global.URL.createObjectURL = vi.fn();
global.URL.revokeObjectURL = vi.fn();

// Mock localStorage and sessionStorage
const localStorageMock = (function () {
    let store = {};
    return {
        getItem: vi.fn((key) => store[key] || null),
        setItem: vi.fn((key, value) => {
            store[key] = value.toString();
        }),
        clear: vi.fn(() => {
            store = {};
        }),
        removeItem: vi.fn((key) => {
            delete store[key];
        }),
    };
})();

Object.defineProperty(window, "localStorage", {
    value: localStorageMock,
});

Object.defineProperty(window, "sessionStorage", {
    value: localStorageMock,
});
