import { resolve, dirname, relative as pathRelative, isAbsolute, join } from 'path';
import { fileURLToPath } from 'url';

const VIRTUAL_MODULE_ID = 'virtual:reload-runtime';
const RESOLVED_VIRTUAL_ID = '\0' + VIRTUAL_MODULE_ID;
const DEFAULT_ENTRY_PATTERNS = [/\/resources\/js\/app\.(js|ts)$/];
const DEFAULT_BLADE_WATCH_PATTERNS = ['resources/views/**/*.blade.php'];

export default function reload(options = {}) {
    let runtimeImportShim;
    let lastBladeChangeAt = 0;
    let pendingGlobalReloadSuppression = false;
    const entryMatchers = resolveEntryMatchers(options.entries);
    const logEnabled = options.log !== false;
    const bladeWatchPatterns = resolveBladeWatchPatterns(options.watch ?? DEFAULT_BLADE_WATCH_PATTERNS);
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const runtimeEntryPath = resolve(__dirname, 'runtime.js');

    function markBladeChange(file = '') {
        if (!isBladePath(file)) {
            return;
        }

        lastBladeChangeAt = Date.now();
        pendingGlobalReloadSuppression = true;
    }

    return {
        name: 'reload',
        enforce: 'pre',

        configureServer(server) {
            const root = server.config.root || process.cwd();
            const watchTargets = bladeWatchPatterns.map((pattern) =>
                normalizeSlashes(isAbsolute(pattern) ? pattern : join(root, pattern)),
            );
            const newWatchTargets = dedupeWatchTargets(server.watcher, watchTargets);
            if (newWatchTargets.length > 0) {
                server.watcher.add(newWatchTargets);
            }

            if (typeof server.watcher?.on === 'function' && !server.watcher.__reloadWatcherHooked) {
                server.watcher.on('all', (_event, file) => {
                    markBladeChange(file);
                });

                server.watcher.__reloadWatcherHooked = true;
            }

            if (server.ws && !server.ws.__reloadWrappedSend) {
                const originalSend = server.ws.send.bind(server.ws);

                server.ws.send = (payload, ...args) => {
                    if (shouldSuppressFullReload(payload, {
                        lastBladeChangeAt,
                        pendingGlobalReloadSuppression,
                        consumePendingGlobalReloadSuppression() {
                            pendingGlobalReloadSuppression = false;
                        },
                    })) {
                        if (logEnabled) {
                            console.log('[reload] Suppressed full-reload payload:', payload?.path ?? '*');
                        }
                        return;
                    }

                    return originalSend(payload, ...args);
                };

                server.ws.__reloadWrappedSend = true;
            }
        },

        resolveId(id) {
            if (id === VIRTUAL_MODULE_ID) {
                return RESOLVED_VIRTUAL_ID;
            }
        },

        load(id) {
            if (id === RESOLVED_VIRTUAL_ID) {
                if (!runtimeImportShim) {
                    runtimeImportShim = `import ${JSON.stringify(toViteFsPath(runtimeEntryPath))};`;
                }
                return runtimeImportShim;
            }
        },

        transform(code, id) {
            const normalizedId = normalizeSlashes(id);
            if (!matchesEntry(normalizedId, entryMatchers)) {
                return;
            }

            if (hasRuntimeImport(code)) {
                return code;
            }

            return `import "${VIRTUAL_MODULE_ID}";\n${code}`;
        },

        handleHotUpdate({ file, server }) {
            if (!isBladePath(file)) {
                return;
            }

            markBladeChange(file);

            const root = server.config.root || process.cwd();
            let relative = normalizeSlashes(pathRelative(root, file));
            if (!relative || relative.startsWith('../') || relative === '..' || isAbsolute(relative)) {
                relative = normalizeSlashes(file);
            }

            server.ws.send({
                type: 'custom',
                event: 'reload:change',
                data: { file: relative },
            });

            if (logEnabled) {
                console.log('[reload] HMR update:', relative);
            }

            return [];
        },
    };
}

function normalizeSlashes(value) {
    return String(value ?? '').replace(/\\/g, '/');
}

function toViteFsPath(absolutePath) {
    const normalized = normalizeSlashes(absolutePath);
    if (normalized.startsWith('/')) {
        return `/@fs${normalized}`;
    }

    return `/@fs/${normalized}`;
}

function resolveEntryMatchers(entries) {
    if (entries == null) {
        return DEFAULT_ENTRY_PATTERNS;
    }

    const list = Array.isArray(entries) ? entries : [entries];

    return list.map((entry) => {
        if (entry instanceof RegExp) return entry;
        return normalizeSlashes(String(entry)).replace(/^\.\//, '');
    });
}

function matchesEntry(normalizedId, entryMatchers) {
    return entryMatchers.some((matcher) => {
        if (matcher instanceof RegExp) {
            return matcher.test(normalizedId);
        }

        return normalizedId === matcher || normalizedId.endsWith('/' + matcher);
    });
}

function resolveBladeWatchPatterns(watch) {
    const list = Array.isArray(watch) ? watch : [watch];
    return list
        .map((entry) => normalizeSlashes(String(entry ?? '')).trim())
        .filter(Boolean);
}

function dedupeWatchTargets(watcher, watchTargets) {
    if (!watcher) {
        return watchTargets;
    }

    let seenTargets = watcher.__reloadWatchTargets;
    if (!(seenTargets instanceof Set)) {
        seenTargets = new Set();
        watcher.__reloadWatchTargets = seenTargets;
    }

    const newTargets = [];
    for (const target of watchTargets) {
        if (!seenTargets.has(target)) {
            seenTargets.add(target);
            newTargets.push(target);
        }
    }

    return newTargets;
}

function shouldSuppressFullReload(payload, context) {
    if (!payload || payload.type !== 'full-reload') {
        return false;
    }

    const path = normalizeSlashes(String(payload.path ?? ''));

    if (isBladePath(payload.path)) {
        return true;
    }

    const now = Date.now();
    const isRecentBladeChange = (now - context.lastBladeChangeAt) < 5000;

    if (context.pendingGlobalReloadSuppression && !isRecentBladeChange) {
        context.consumePendingGlobalReloadSuppression?.();
    }

    const isGlobalReload = path === '' || path === '*' || path === '/';
    if (isGlobalReload && context.pendingGlobalReloadSuppression && isRecentBladeChange) {
        context.consumePendingGlobalReloadSuppression?.();
        return true;
    }

    return false;
}

function isBladePath(path) {
    const cleanPath = normalizeSlashes(String(path ?? '').split('?')[0].split('#')[0]);
    return cleanPath.endsWith('.blade.php');
}

function hasRuntimeImport(code) {
    if (code.includes(`"${VIRTUAL_MODULE_ID}"`) || code.includes(`'${VIRTUAL_MODULE_ID}'`)) {
        return true;
    }

    return /(?:import\s+['"]|from\s+['"])[^'"]*fortephp\/reload\/resources\/js\/runtime\.js['"]/.test(
        normalizeSlashes(code),
    );
}
