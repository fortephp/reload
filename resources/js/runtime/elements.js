import {
    filesMatchChangedFiles,
    resolveMorphKey,
    scriptElementSignature,
    serializeWithAttributePlaceholders,
} from './shared.js';
import { morphElement } from './morph.js';

export function patchElements(oldDoc, newDoc, liveDoc, maxPatches, options = {}) {
    const toPatch = collectElementPatches(oldDoc, newDoc, liveDoc, options);

    if (options.failOnLimit && toPatch.length > maxPatches) {
        throw new Error(`Patch limit exceeded for elements (${toPatch.length}/${maxPatches})`);
    }

    return applyElementPatches(toPatch, maxPatches);
}

export function collectElementPatches(oldDoc, newDoc, liveDoc, options = {}) {
    const changedFiles = options.changedFiles ?? null;
    const oldEls = [...oldDoc.querySelectorAll('[data-hmr-id]')];
    const newEls = [...newDoc.querySelectorAll('[data-hmr-id]')];
    const liveEls = [...liveDoc.querySelectorAll('[data-hmr-id]')];

    if (oldEls.length === 0 || newEls.length === 0) return [];

    const oldMap = new Map();
    for (const el of oldEls) oldMap.set(elementKey(el), el);

    const newMap = new Map();
    for (const el of newEls) newMap.set(elementKey(el), el);

    const liveMap = new Map();
    for (const el of liveEls) liveMap.set(elementKey(el), el);

    const changed = [];
    for (const [key, oldEl] of oldMap) {
        const newEl = newMap.get(key);
        const liveEl = liveMap.get(key);
        if (!newEl || !liveEl) continue;
        if (!elementMatchesChangedFiles(oldEl, newEl, liveEl, changedFiles)) continue;
        if (oldEl.outerHTML !== newEl.outerHTML &&
            visibleContent(oldEl) !== visibleContent(newEl)) {
            changed.push({ old: oldEl, live: liveEl, new: newEl });
        }
    }

    if (changed.length === 0) return [];

    changed.sort((a, b) => getDepth(a.live) - getDepth(b.live));

    const toPatch = [];
    const dominated = new Set();

    for (const pair of changed) {
        if (dominated.has(pair.live)) continue;

        const hasDescendant = changed.some(other =>
            !dominated.has(other.live) &&
            other.live !== pair.live &&
            pair.live.contains(other.live)
        );

        if (!hasDescendant ||
            hasStructuralChange(pair.old, pair.new) ||
            hasChangeOutsideInstrumentedChildren(pair.old, pair.new)) {
            toPatch.push(pair);
            for (const other of changed) {
                if (pair.live.contains(other.live) && other.live !== pair.live) {
                    dominated.add(other.live);
                }
            }
        }
    }

    return toPatch;
}

export function applyElementPatches(toPatch, maxPatches) {
    return applyElementPatchesDetailed(toPatch, maxPatches).patchCount;
}

export function applyElementPatchesDetailed(toPatch, maxPatches) {
    let patchCount = 0;
    let skipped = 0;
    let requiresReload = false;

    for (const { old, live, new: newEl } of toPatch) {
        if (patchCount >= maxPatches) {
            break;
        }

        if (live.closest('[data-hmr-permanent]')) {
            skipped++;
            continue;
        }

        if (scriptElementSignature(old) !== scriptElementSignature(newEl)) {
            skipped++;
            requiresReload = true;
            continue;
        }

        const hasPermanentDescendant = containsPermanentDescendant(live);

        if (live.tagName?.toLowerCase() === 'body' && newEl.tagName?.toLowerCase() === 'body') {
            if (hasPermanentDescendant) {
                skipped++;
                requiresReload = true;
                continue;
            }

            replaceElementChildren(live, newEl);
            patchCount++;
            continue;
        }

        if (!window.Alpine?.morph && hasPermanentDescendant) {
            skipped++;
            requiresReload = true;
            continue;
        }

        morphElement(live, newEl);

        if (visibleContent(live, { ignorePermanent: hasPermanentDescendant }) !==
            visibleContent(newEl, { ignorePermanent: hasPermanentDescendant })) {
            if (hasPermanentDescendant) {
                skipped++;
                requiresReload = true;
                continue;
            }

            const imported = document.importNode(newEl, true);
            live.replaceWith(imported);
        }
        patchCount++;
    }

    return { patchCount, skipped, requiresReload };
}

function elementMatchesChangedFiles(oldEl, newEl, liveEl, changedFiles) {
    return filesMatchChangedFiles([
        oldEl.getAttribute('data-hmr-file'),
        newEl.getAttribute('data-hmr-file'),
        liveEl.getAttribute('data-hmr-file'),
    ], changedFiles);
}

function replaceElementChildren(target, next) {
    while (target.firstChild) {
        target.removeChild(target.firstChild);
    }

    for (const child of [...next.childNodes]) {
        target.appendChild(document.importNode(child, true));
    }
}

export function elementKey(el) {
    const parts = [];
    let node = el;

    while (node && node.nodeType === 1) {
        const id = node.getAttribute('data-hmr-id');
        if (id) {
            const stableKey = stableIdentity(node);

            if (stableKey) {
                parts.unshift(`${id}{${stableKey}}`);
            } else {
                let index = 0;
                let sibling = node.previousElementSibling;
                while (sibling) {
                    if (sibling.getAttribute('data-hmr-id') === id && !stableIdentity(sibling)) {
                        index++;
                    }
                    sibling = sibling.previousElementSibling;
                }

                parts.unshift(`${id}[${index}]`);
            }
        }
        node = node.parentElement;
    }

    return parts.join('/');
}

export function getDepth(el) {
    let depth = 0;
    let node = el;
    while (node.parentElement) {
        depth++;
        node = node.parentElement;
    }
    return depth;
}

export function hasStructuralChange(oldEl, newEl) {
    const childIds = (el) => {
        const ids = [];
        for (const child of el.children) {
            const id = child.getAttribute('data-hmr-id');
            if (id) {
                ids.push(structuralChildToken(child));
            }
        }
        return ids.join('\n');
    };
    return childIds(oldEl) !== childIds(newEl);
}

function hasChangeOutsideInstrumentedChildren(oldEl, newEl) {
    return contentOutsideInstrumentedDescendants(oldEl) !==
        contentOutsideInstrumentedDescendants(newEl);
}

function contentOutsideInstrumentedDescendants(el) {
    return serializeWithAttributePlaceholders(el, 'data-hmr-id');
}

export function visibleContent(el, options = {}) {
    const clone = el.cloneNode(true);
    for (const hidden of clone.querySelectorAll('input[type="hidden"]')) {
        hidden.remove();
    }

    if (options.ignorePermanent === true) {
        replacePermanentDescendantsWithPlaceholders(clone);
    }

    if (clone.tagName?.toLowerCase() === 'body') {
        return clone.innerHTML;
    }

    return clone.outerHTML;
}

function structuralChildToken(el) {
    const id = el.getAttribute('data-hmr-id');
    const stableKey = stableIdentity(el);

    return stableKey ? `${id}{${stableKey}}` : id;
}

function stableIdentity(el) {
    const key = resolveMorphKey(el);

    return key ? encodeURIComponent(String(key)) : null;
}

function containsPermanentDescendant(el) {
    return el.querySelector?.('[data-hmr-permanent]') != null;
}

function replacePermanentDescendantsWithPlaceholders(root) {
    for (const permanent of root.querySelectorAll('[data-hmr-permanent]')) {
        const placeholder = root.ownerDocument.createElement('hmr-permanent');
        const key = resolveMorphKey(permanent) || permanent.getAttribute('data-hmr-id');

        if (key) {
            placeholder.setAttribute('key', String(key));
        }

        permanent.replaceWith(placeholder);
    }
}
