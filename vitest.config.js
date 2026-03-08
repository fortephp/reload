import { defineConfig } from 'vitest/config';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    resolve: {
        alias: {
            '@runtime': resolve(rootDir, 'resources/js/runtime.js'),
            '@test-helpers': resolve(rootDir, 'tests/js/helpers'),
        },
    },
    test: {
        environment: 'jsdom',
        root: rootDir,
        include: ['tests/js/**/*.test.js'],
        setupFiles: [resolve(rootDir, 'tests/js/helpers/setup.js')],
    },
});
