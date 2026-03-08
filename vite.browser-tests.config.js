import { defineConfig } from 'vite';
import reload from './resources/js/vite-plugin.js';

export default defineConfig({
    plugins: [
        reload({
            entries: [],
            watch: ['tests/php/Fixtures/Browser/views/**/*.blade.php'],
        }),
    ],
    server: {
        host: '127.0.0.1',
        port: 5173,
        strictPort: true,
        cors: true,
        watch: {
            ignored: ['**/build/testing/**', '**/storage/**'],
        },
    },
});
