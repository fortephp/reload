import { describe, it, expect, vi } from 'vitest';
import reload from '../../../resources/js/vite-plugin.js';

describe('reload vite plugin', () => {
    describe('resolveId', () => {
        it('resolves virtual:reload-runtime to internal id', () => {
            const plugin = reload();
            expect(plugin.resolveId('virtual:reload-runtime')).toBe('\0virtual:reload-runtime');
        });

        it('returns undefined for other module ids', () => {
            const plugin = reload();
            expect(plugin.resolveId('some-other-module')).toBeUndefined();
        });
    });

    describe('load', () => {
        it('returns a runtime import shim for the resolved virtual id', () => {
            const plugin = reload();
            const result = plugin.load('\0virtual:reload-runtime');
            expect(result).toBeTruthy();
            expect(typeof result).toBe('string');
            expect(result).toContain('import "/@fs/');
            expect(result).toContain('/resources/js/runtime.js');
        });

        it('returns undefined for other ids', () => {
            const plugin = reload();
            expect(plugin.load('other-module')).toBeUndefined();
        });

        it('caches the runtime code on subsequent loads', () => {
            const plugin = reload();
            const first = plugin.load('\0virtual:reload-runtime');
            const second = plugin.load('\0virtual:reload-runtime');
            expect(first).toBe(second);
        });
    });

    describe('transform', () => {
        it('prepends runtime import for resources/js/app.js', () => {
            const plugin = reload();
            const result = plugin.transform('console.log("app")', '/project/resources/js/app.js');
            expect(result).toContain('import "virtual:reload-runtime"');
            expect(result).toContain('console.log("app")');
        });

        it('prepends runtime import for resources/js/app.ts', () => {
            const plugin = reload();
            const result = plugin.transform('const x = 1', '/project/resources/js/app.ts');
            expect(result).toContain('import "virtual:reload-runtime"');
        });

        it('returns undefined for non-entry files', () => {
            const plugin = reload();
            expect(plugin.transform('code', '/project/resources/js/utils.js')).toBeUndefined();
            expect(plugin.transform('code', '/project/app/Models/User.php')).toBeUndefined();
        });

        it('does not add runtime import twice', () => {
            const plugin = reload();
            const code = 'import "virtual:reload-runtime";\nconsole.log("app")';
            const result = plugin.transform(code, '/project/resources/js/app.js');

            expect(result).toBe(code);
        });

        it('does not inject when the entry already imports runtime.js directly', () => {
            const plugin = reload();
            const code = 'import "./vendor/fortephp/reload/resources/js/runtime.js";\nconsole.log("app")';
            const result = plugin.transform(code, '/project/resources/js/app.js');

            expect(result).toBe(code);
        });

        it('supports custom entry option', () => {
            const plugin = reload({ entries: 'resources/js/admin.js' });
            const result = plugin.transform('console.log("admin")', '/project/resources/js/admin.js');

            expect(result).toContain('import "virtual:reload-runtime"');
        });
    });

    describe('handleHotUpdate', () => {
        function mockServer(root = '/project') {
            return {
                ws: { send: vi.fn() },
                config: { root },
            };
        }

        it('sends reload:change event for .blade.php files', () => {
            const plugin = reload();
            const server = mockServer('/project');

            const result = plugin.handleHotUpdate({
                file: '/project/resources/views/home.blade.php',
                server,
            });

            expect(server.ws.send).toHaveBeenCalledOnce();
            expect(server.ws.send).toHaveBeenCalledWith(expect.objectContaining({
                type: 'custom',
                event: 'reload:change',
                data: expect.objectContaining({
                    file: expect.stringContaining('home.blade.php'),
                }),
            }));
            expect(result).toEqual([]);
        });

        it('ignores non-blade files', () => {
            const plugin = reload();
            const server = mockServer();

            const result = plugin.handleHotUpdate({
                file: '/project/app/Models/User.php',
                server,
            });

            expect(server.ws.send).not.toHaveBeenCalled();
            expect(result).toBeUndefined();
        });

        it('computes relative path from server root', () => {
            const plugin = reload();
            const server = mockServer('/project');

            plugin.handleHotUpdate({
                file: '/project/resources/views/pages/login.blade.php',
                server,
            });

            const sentData = server.ws.send.mock.calls[0][0].data;
            expect(sentData.file).toBe('resources/views/pages/login.blade.php');
        });

        it('normalizes backslashes to forward slashes', () => {
            const plugin = reload();
            const server = mockServer('C:\\project');

            plugin.handleHotUpdate({
                file: 'C:\\project\\resources\\views\\home.blade.php',
                server,
            });

            const sentData = server.ws.send.mock.calls[0][0].data;
            expect(sentData.file).not.toContain('\\');
            expect(sentData.file).toContain('resources/views/home.blade.php');
        });
    });

    describe('configureServer', () => {
        function mockWatcher() {
            const handlers = new Map();

            return {
                add: vi.fn(),
                on: vi.fn((event, cb) => {
                    handlers.set(event, cb);
                }),
                emit(event, ...args) {
                    handlers.get(event)?.(...args);
                },
            };
        }

        function mockServer(root = '/project') {
            return {
                watcher: mockWatcher(),
                ws: { send: vi.fn() },
                config: { root },
            };
        }

        it('registers blade watch patterns on the Vite watcher', () => {
            const plugin = reload();
            const server = mockServer('/project');

            plugin.configureServer(server);

            expect(server.watcher.add).toHaveBeenCalledWith(['/project/resources/views/**/*.blade.php']);
        });

        it('supports custom watch patterns', () => {
            const plugin = reload({ watch: ['resources/views/**/*.blade.php', '/abs/custom/*.blade.php'] });
            const server = mockServer('/project');

            plugin.configureServer(server);

            expect(server.watcher.add).toHaveBeenCalledWith([
                '/project/resources/views/**/*.blade.php',
                '/abs/custom/*.blade.php',
            ]);
        });

        it('does not add duplicate watch targets when configureServer runs more than once', () => {
            const plugin = reload();
            const server = mockServer('/project');

            plugin.configureServer(server);
            plugin.configureServer(server);

            expect(server.watcher.add).toHaveBeenCalledTimes(1);
            expect(server.watcher.add).toHaveBeenCalledWith(['/project/resources/views/**/*.blade.php']);
        });

        it('suppresses full-reload websocket payloads for blade files', () => {
            const plugin = reload({ log: false });
            const server = mockServer('/project');
            const originalSend = server.ws.send;

            plugin.configureServer(server);

            server.ws.send({ type: 'full-reload', path: '/project/resources/views/home.blade.php' });
            expect(originalSend).not.toHaveBeenCalled();

            server.ws.send({ type: 'full-reload', path: '/project/resources/js/app.js' });
            expect(originalSend).toHaveBeenCalledOnce();
        });

        it('suppresses global full-reload payloads immediately after blade changes', () => {
            const plugin = reload({ log: false });
            const server = mockServer('/project');
            const originalSend = server.ws.send;

            plugin.configureServer(server);

            plugin.handleHotUpdate({
                file: '/project/resources/views/welcome.blade.php',
                server,
            });

            server.ws.send({ type: 'full-reload', path: '*' });
            expect(originalSend).toHaveBeenCalledOnce();
            expect(originalSend).toHaveBeenCalledWith(expect.objectContaining({
                type: 'custom',
                event: 'reload:change',
            }));
        });

        it('suppresses global full-reload payloads when watcher reports blade file changes', () => {
            const plugin = reload({ log: false });
            const server = mockServer('/project');
            const originalSend = server.ws.send;

            plugin.configureServer(server);

            server.watcher.emit('all', 'change', '/project/resources/views/home.blade.php');
            server.ws.send({ type: 'full-reload', path: '*' });

            expect(originalSend).not.toHaveBeenCalled();
        });

        it('does not suppress global full-reload for non-blade watcher changes', () => {
            const plugin = reload({ log: false });
            const server = mockServer('/project');
            const originalSend = server.ws.send;

            plugin.configureServer(server);

            server.watcher.emit('all', 'change', '/project/resources/js/app.js');
            server.ws.send({ type: 'full-reload', path: '*' });

            expect(originalSend).toHaveBeenCalledOnce();
            expect(originalSend).toHaveBeenCalledWith(expect.objectContaining({
                type: 'full-reload',
                path: '*',
            }));
        });
    });
});
