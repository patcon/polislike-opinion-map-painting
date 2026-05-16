import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
    root: ".",
    plugins: [
        viteStaticCopy({
            targets: [
                { src: "js/config.js", dest: "" },
                { src: "js/data.js", dest: "" },
                { src: "js/ui.js", dest: "" },
                { src: "data", dest: "" },
                { src: "assets", dest: "" },
            ],
        }),
    ],
    test: {
        globals: true,
        environment: "jsdom",
        setupFiles: ["./vitest.setup.js"],
        include: ["js/__tests__/**/*.test.js"],
        coverage: {
            provider: "v8",
            include: ["js/**/*.js"],
            exclude: ["js/__tests__/**", "js/**/*.test.js"],
            reporter: ["text", "lcov", "html", "json-summary"],
            thresholds: {
                branches: 2,
                functions: 1.5,
                lines: 2.5,
                statements: 2.5,
            },
        },
    },
});
