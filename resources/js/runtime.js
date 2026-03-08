import {
    baselineComparableHtml,
    documentMayMatchChangedFiles,
    delay,
    looksLikeHtmlResponse,
    normalizeChangedFiles,
    resolveMaxPatches,
    snapshotCurrentDocument,
} from './runtime/shared.js';
import { applyElementPatchesDetailed, collectElementPatches } from './runtime/elements.js';
import { applyDirectivePatchesDetailed, collectDirectivePatches, indexCommentBoundaries } from './runtime/directives.js';
import { patchHead, patchHeadDetailed } from './runtime/head.js';
import { patchShell } from './runtime/shell.js';
import { captureState, restoreState } from './runtime/state.js';
import {
    removeConnectionStatus,
    removeErrorOverlay,
    showConnectionStatus,
    showErrorOverlay,
} from './runtime/ui.js';

const DEFAULT_MAX_PATCHES = 25;
const TRAILING_CONTENT_CONTAINER_ID = 'reload-trailing-content';
const BLADE_CHANGE_DEBOUNCE_MS = 60;
const NO_CHANGE_RETRY_DELAY_MS = 80;
const FILE_FILTER_RETRY_DELAY_MS = 60;
const UNDER_MATCH_RETRY_DELAY_MS = 50;

if (import.meta.hot) {
    console.log('[reload] Runtime loaded');

    const initialDoc = snapshotCurrentDocument();
    let lastDoc = initialDoc;
    let lastServerDoc = null;
    let lastServerHtml = null;
    let lastMaxPatches = DEFAULT_MAX_PATCHES;
    let hasStartedPatching = false;
    let baselineReady = syncBaselineWithServer(initialDoc);
    let patchQueue = Promise.resolve();
    let debounceTimer = null;
    let navigationBaselineFrame = null;

    function commitServerSnapshot(newDoc, html) {
        lastDoc = newDoc;
        lastServerDoc = newDoc;
        lastServerHtml = html;
    }

    function setLiveBaseline(currentDoc = snapshotCurrentDocument()) {
        if (!currentDoc) {
            return;
        }

        lastDoc = currentDoc;
    }

    function syncBaselineWithServer(currentDoc = snapshotCurrentDocument()) {
        setLiveBaseline(currentDoc);

        return fetch(location.href, {
            credentials: 'include',
            cache: 'no-store',
            headers: { 'X-Reload': '1', Accept: 'text/html' },
        })
            .then((r) => (r.ok ? r.text() : null))
            .then((html) => {
                if (!html || hasStartedPatching) {
                    return;
                }

                const serverDoc = new DOMParser().parseFromString(html, 'text/html');
                lastServerDoc = serverDoc;
                lastServerHtml = html;
                if (currentDoc && baselineComparableHtml(currentDoc) === baselineComparableHtml(serverDoc)) {
                    lastDoc = serverDoc;
                }
            })
            .catch(() => {});
    }

    function queuePatch({ retryOnNoChange = false, source = 'unknown', changedFiles = null } = {}) {
        patchQueue = patchQueue
            .then(() => patchPage({ retryOnNoChange, source, changedFiles }))
            .catch((err) => {
                console.warn('[reload] Patch failed:', err.message);
                showErrorOverlay(err.message + ' - reloading in 3s...');
                setTimeout(() => location.reload(), 3000);
            });

        return patchQueue;
    }

    function scheduleBladeChangePatch(data, source = 'blade-change') {
        const changedFiles = normalizeChangedFiles(data?.files ?? data?.file ?? null);
        const currentDoc = lastServerDoc || lastDoc || document;

        if (!documentMayMatchChangedFiles(currentDoc, changedFiles)) {
            console.log('[reload] Ignored unrelated blade change:', changedFiles.join(', '));
            return;
        }

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            queuePatch({ retryOnNoChange: true, source, changedFiles });
        }, BLADE_CHANGE_DEBOUNCE_MS);
    }

    window.__reloadPatchNow = (options = {}) => {
        const changedFiles = normalizeChangedFiles(options.changedFiles ?? options.file ?? null);
        return queuePatch({
            retryOnNoChange: true,
            source: 'manual',
            changedFiles,
        });
    };

    import.meta.hot.on('reload:change', (data) => {
        console.log('[reload] File changed:', data?.file);
        scheduleBladeChangePatch(data, 'blade-change');
    });
    window.__reloadHandleChangePayload = (data = {}) => {
        scheduleBladeChangePatch(data, 'blade-change-manual');
    };
    document.addEventListener('livewire:navigated', () => {
        if (navigationBaselineFrame !== null && typeof cancelAnimationFrame === 'function') {
            cancelAnimationFrame(navigationBaselineFrame);
        }

        const refreshBaseline = () => {
            const currentDoc = snapshotCurrentDocument();
            if (!currentDoc) {
                return;
            }

            const hasBoundaries = currentDoc.querySelector?.('[data-hmr-id]') ||
                indexCommentBoundaries(currentDoc).length > 0;

            if (!hasBoundaries) {
                return;
            }

            baselineReady = syncBaselineWithServer(currentDoc);
            removeErrorOverlay();
        };

        if (typeof requestAnimationFrame === 'function') {
            navigationBaselineFrame = requestAnimationFrame(() => {
                navigationBaselineFrame = null;
                refreshBaseline();
            });
            return;
        }

        setTimeout(refreshBaseline, 0);
    });
    import.meta.hot.on('vite:ws:disconnect', () => {
        showConnectionStatus('disconnected');
    });

    import.meta.hot.on('vite:ws:connect', () => {
        removeConnectionStatus();
        patchQueue = patchQueue.then(() => patchPage({ retryOnNoChange: false, source: 'ws-connect' })).catch(() => {});
    });

    async function patchPage({ retryOnNoChange = false, source = 'unknown', changedFiles = null } = {}) {
        hasStartedPatching = true;
        const isBladeChangeSource = source === 'blade-change' || source === 'blade-change-manual';
        await baselineReady;

        const snapshot = captureState();

        const response = await fetch(location.href, {
            credentials: 'include',
            cache: 'no-store',
            headers: {
                'X-Reload': '1',
                Accept: 'text/html',
            },
        });

        const html = await response.text();
        const previousTrailingContent = trailingContentAfterHtml(lastServerHtml || '');
        const nextTrailingContent = trailingContentAfterHtml(html);

        if (!response.ok) {
            if (looksLikeHtmlResponse(response.headers?.get?.('content-type'), html)) {
                showErrorOverlay(`Server returned HTTP ${response.status}.`, {
                    title: `Reload Server Error (${response.status})`,
                    html,
                    showReload: true,
                });
                return;
            }

            throw new Error(`Fetch failed: ${response.status}`);
        }
        removeErrorOverlay();

        const newDoc = new DOMParser().parseFromString(html, 'text/html');
        lastMaxPatches = resolveMaxPatches(response.headers, lastMaxPatches);

        const oldDoc = lastDoc || document;

        const patchOptions = { changedFiles };
        const elementPatches = collectElementPatches(oldDoc, newDoc, document, patchOptions);
        const directivePatches = filterDirectivePatchesCoveredByElements(
            collectDirectivePatches(oldDoc, newDoc, document, patchOptions),
            elementPatches,
        );
        if (isBladeChangeSource && changedFiles && changedFiles.length > 0) {
            const fullElementPatches = collectElementPatches(oldDoc, newDoc, document, { changedFiles: null });
            const fullDirectivePatches = filterDirectivePatchesCoveredByElements(
                collectDirectivePatches(oldDoc, newDoc, document, { changedFiles: null }),
                fullElementPatches,
            );

            const filteredTotal = elementPatches.length + directivePatches.length;
            const fullTotal = fullElementPatches.length + fullDirectivePatches.length;

            if (fullTotal > filteredTotal) {
                console.warn('[reload] File filter under-matched, retrying without file filter');
                await delay(UNDER_MATCH_RETRY_DELAY_MS);
                return patchPage({
                    retryOnNoChange: false,
                    source: 'blade-change-unfiltered',
                    changedFiles: null,
                });
            }
        }

        const plannedPatches = elementPatches.length + directivePatches.length;
        if (plannedPatches > lastMaxPatches) {
            throw new Error(`Patch limit exceeded (${plannedPatches}/${lastMaxPatches})`);
        }

        let patchCount = 0;
        const shellOldDoc = lastServerDoc || newDoc;
        patchCount += patchShell(shellOldDoc, newDoc, document);
        const elementPatchResult = applyElementPatchesDetailed(elementPatches, lastMaxPatches);
        patchCount += elementPatchResult.patchCount;
        const directivePatchResult = applyDirectivePatchesDetailed(directivePatches, lastMaxPatches - patchCount);
        patchCount += directivePatchResult.patchCount;
        const headPatchResult = patchHeadDetailed(shellOldDoc, newDoc, document);
        patchCount += headPatchResult.patchCount;
        patchCount += patchTrailingContent(previousTrailingContent, nextTrailingContent);

        if (elementPatchResult.requiresReload || directivePatchResult.requiresReload || headPatchResult.requiresReload) {
            console.warn('[reload] Unsupported DOM change requires full reload');
            location.reload();
            return;
        }

        if (patchCount === 0) {
            const hasBoundaries = document.querySelector('[data-hmr-id]') ||
                indexCommentBoundaries(document).length > 0;
            if (hasBoundaries) {
                if (retryOnNoChange) {
                    console.log('[reload] No changes detected, retrying once...');
                    await delay(NO_CHANGE_RETRY_DELAY_MS);
                    return patchPage({
                        retryOnNoChange: false,
                        source,
                        changedFiles,
                    });
                }

                if (isBladeChangeSource) {
                    if (previousTrailingContent !== nextTrailingContent) {
                        console.warn('[reload] Trailing content changed with no patchable boundaries, reloading');
                        location.reload();
                        return;
                    }

                    if (changedFiles && changedFiles.length > 0) {
                        console.warn('[reload] No diff for changed files, retrying without file filter');
                        await delay(FILE_FILTER_RETRY_DELAY_MS);
                        return patchPage({
                            retryOnNoChange: false,
                            source: 'blade-change-unfiltered',
                            changedFiles: null,
                        });
                    }

                    console.warn('[reload] No diff after blade change');
                    commitServerSnapshot(newDoc, html);
                    return;
                }
                console.log('[reload] No changes detected');
                commitServerSnapshot(newDoc, html);
                return;
            }
            throw new Error('No boundaries found to patch');
        }

        console.log(`[reload] Patched ${patchCount} boundaries`);
        commitServerSnapshot(newDoc, html);
        if (window.Alpine?.nextTick) {
            await window.Alpine.nextTick();
        } else if (window.Alpine) {
            await new Promise((resolve) => queueMicrotask(resolve));
        }

        restoreState(snapshot);
        await waitForPostPatchStateSettle();
        restoreState(snapshot);
        removeErrorOverlay();

        window.__reloadPatchedEvents = Number(window.__reloadPatchedEvents || 0) + 1;

        document.dispatchEvent(new CustomEvent('reload:patched', {
            detail: { patchCount },
        }));
    }
}

export {
    collectDocumentDependencyFiles,
    documentMayMatchChangedFiles,
    normalizePath,
    pathMatchesChangedFiles,
    normalizeChangedFiles,
} from './runtime/shared.js';
export {
    patchElements,
    applyElementPatchesDetailed,
    collectElementPatches,
    elementKey,
    getDepth,
    hasStructuralChange,
    visibleContent,
} from './runtime/elements.js';
export {
    patchDirectives,
    applyDirectivePatchesDetailed,
    collectDirectivePatches,
    boundaryContent,
    boundaryContentOutsideElements,
    stripInstrumentedElements,
    containsBoundary,
    indexCommentBoundaries,
    groupById,
    patchCommentBoundary,
} from './runtime/directives.js';
export { morphElement, singleElementBetween, mergeAlpineData } from './runtime/morph.js';
export { patchHead, patchHeadDetailed } from './runtime/head.js';
export { patchShell } from './runtime/shell.js';
export { captureState, inputSelector, restoreState } from './runtime/state.js';
export { patchTrailingContent, trailingContentAfterHtml };

function trailingContentAfterHtml(html) {
    const match = String(html ?? '').match(/<\/html\s*>([\s\S]*)$/i);

    return match ? match[1] : '';
}

function patchTrailingContent(previousTrailingContent, nextTrailingContent) {
    const previous = String(previousTrailingContent ?? '');
    const next = String(nextTrailingContent ?? '');

    const body = document.body;
    if (!body) {
        return 0;
    }

    let container = document.getElementById(TRAILING_CONTENT_CONTAINER_ID);
    const duplicateNodesBeforeContainer = container && next !== ''
        ? findTrailingNodesBeforeNode(container, next)
        : null;

    if (duplicateNodesBeforeContainer) {
        container.remove();
        return 1;
    }

    const adoptedTrailingNodes = !container && previous !== ''
        ? findTrailingNodes(body, previous)
        : null;

    if (adoptedTrailingNodes) {
        if (next === '') {
            removeNodes(adoptedTrailingNodes);
            return 1;
        }

        if (previous === next) {
            return 0;
        }

        replaceNodes(adoptedTrailingNodes, createTrailingNodes(next));
        return 1;
    }

    if (next === '') {
        if (container) {
            container.remove();
            return 1;
        }

        return 0;
    }

    const needsCreate = !container;
    const needsUpdate = previous !== next;

    if (!container) {
        const existingNodes = findTrailingNodes(body, next);
        if (existingNodes) {
            return 0;
        }
    }

    if (!needsCreate && !needsUpdate) {
        return 0;
    }

    if (!container) {
        container = document.createElement('div');
        container.id = TRAILING_CONTENT_CONTAINER_ID;
        container.setAttribute('data-reload-transient', '1');
        body.appendChild(container);
    }

    if (container.innerHTML !== next) {
        container.innerHTML = next;
    }

    return 1;
}

function createTrailingNodes(html) {
    const template = document.createElement('template');
    template.innerHTML = html;

    return Array.from(template.content.childNodes).map((node) => document.importNode(node, true));
}

function findTrailingNodes(body, html) {
    const expectedNodes = createTrailingNodes(html);
    if (expectedNodes.length === 0) {
        return null;
    }

    const bodyNodes = Array.from(body.childNodes);
    if (bodyNodes.length < expectedNodes.length) {
        return null;
    }

    const trailingNodes = bodyNodes.slice(-expectedNodes.length);

    return nodesMatch(trailingNodes, expectedNodes)
        ? trailingNodes
        : null;
}

function findTrailingNodesBeforeNode(anchorNode, html) {
    const expectedNodes = createTrailingNodes(html);
    if (expectedNodes.length === 0) {
        return null;
    }

    const siblings = [];
    let cursor = anchorNode.previousSibling;
    while (cursor && siblings.length < expectedNodes.length) {
        siblings.unshift(cursor);
        cursor = cursor.previousSibling;
    }

    if (siblings.length !== expectedNodes.length) {
        return null;
    }

    return nodesMatch(siblings, expectedNodes)
        ? siblings
        : null;
}

function replaceNodes(currentNodes, nextNodes) {
    if (currentNodes.length === 0) {
        return;
    }

    const parent = currentNodes[0].parentNode;
    const marker = currentNodes[currentNodes.length - 1].nextSibling;

    removeNodes(currentNodes);

    for (const node of nextNodes) {
        parent.insertBefore(node, marker);
    }
}

function removeNodes(nodes) {
    for (const node of nodes) {
        node.remove();
    }
}

function serializeNodes(nodes) {
    return nodes.map((node) => serializeNode(node)).join('');
}

function nodesMatch(actualNodes, expectedNodes) {
    if (actualNodes.length !== expectedNodes.length) {
        return false;
    }

    for (let i = 0; i < actualNodes.length; i++) {
        if (!nodesEquivalent(actualNodes[i], expectedNodes[i])) {
            return false;
        }
    }

    return true;
}

function nodesEquivalent(actualNode, expectedNode) {
    if (actualNode.nodeType !== expectedNode.nodeType) {
        return false;
    }

    if (actualNode.nodeType === Node.TEXT_NODE) {
        return normalizeTrailingText(actualNode.nodeValue) === normalizeTrailingText(expectedNode.nodeValue);
    }

    return serializeNode(actualNode) === serializeNode(expectedNode);
}

function serializeNode(node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
        return node.outerHTML;
    }

    if (node.nodeType === Node.TEXT_NODE) {
        return node.nodeValue;
    }

    if (node.nodeType === Node.COMMENT_NODE) {
        return `<!--${node.nodeValue}-->`;
    }

    return '';
}

function normalizeTrailingText(value) {
    return String(value ?? '')
        .replace(/\r\n?/g, '\n')
        .trim();
}

function waitForPostPatchStateSettle() {
    if (typeof window.requestAnimationFrame === 'function') {
        return new Promise((resolve) => {
            window.requestAnimationFrame(() => {
                window.requestAnimationFrame(resolve);
            });
        });
    }

    return new Promise((resolve) => setTimeout(resolve, 0));
}

function documentMarkup() {
    if (!document?.documentElement) {
        return '';
    }

    const doctype = document.doctype
        ? `<!DOCTYPE ${document.doctype.name}>`
        : '';

    return doctype + document.documentElement.outerHTML;
}

function filterDirectivePatchesCoveredByElements(directivePatches, elementPatches) {
    if (directivePatches.length === 0 || elementPatches.length === 0) {
        return directivePatches;
    }

    return directivePatches.filter((directivePatch) => {
        return !elementPatches.some((elementPatch) => {
            return elementPatch.live?.contains?.(directivePatch.live.beginComment) &&
                elementPatch.live?.contains?.(directivePatch.live.endComment);
        });
    });
}

