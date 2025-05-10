module.exports = {
    testEnvironment: 'jsdom',
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    moduleNameMapper: {
        // Mock CSS and other static assets
        '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styleMock.js',
        '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/__mocks__/fileMock.js'
    },
    // Coverage configuration
    collectCoverage: false, // Set to false by default, enabled via CLI
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        'js/**/*.js',
        '!js/**/__tests__/**',
        '!js/**/*.test.js',
        '!**/node_modules/**'
    ],
    coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
    // Coverage thresholds
    coverageThreshold: {
        global: {
            branches: 2,
            functions: 1.5,
            lines: 2.5,
            statements: 2.5
        }
    }
};
