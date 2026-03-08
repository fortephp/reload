import {
    extractBoundaryAttribute,
    filesMatchChangedFiles,
    resolveMorphKey,
    serializeWithAttributePlaceholders,
} from './shared.js';
import { morphElement, singleElementBetween } from './morph.js';
import { visibleContent } from './elements.js';

export function patchDirectives(oldDoc, newDoc, liveDoc, maxPatches, options = {}) {
    const toPatch = collectDirectivePatches(oldDoc, newDoc, liveDoc, options);

    if (options.failOnLimit && toPatch.length > maxPatches) {
        throw new Error(`Patch limit exceeded for directives (${toPatch.length}/${maxPatches})`);
    }

    return applyDirectivePatches(toPatch, maxPatches);
}

export function collectDirectivePatches(oldDoc, newDoc, liveDoc, options = {}) {
    const changedFiles = options.changedFiles ?? null;
    const failOnCountMismatch = options.failOnCountMismatch === true;
    const failOnUnbalanced = options.failOnUnbalanced === true;

    const oldScan = scanCommentBoundaries(oldDoc);
    const newScan = scanCommentBoundaries(newDoc);
    const liveScan = scanCommentBoundaries(liveDoc);

    if (failOnUnbalanced && (oldScan.unbalanced > 0 || newScan.unbalanced > 0 || liveScan.unbalanced > 0)) {
        throw new Error('Unbalanced comment boundaries detected');
    }

    const oldBoundaries = oldScan.boundaries;
    const newBoundaries = newScan.boundaries;
    const liveBoundaries = liveScan.boundaries;

    if (oldBoundaries.length === 0 || newBoundaries.length === 0) return [];

    const oldById = groupById(oldBoundaries);
    const newById = groupById(newBoundaries);
    const liveById = groupById(liveBoundaries);

    const changed = [];
    for (const [id, oldPairs] of Object.entries(oldById)) {
        const newPairs = newById[id];
        const livePairs = liveById[id];
        if (!newPairs || !livePairs) continue;

        if (failOnCountMismatch &&
            (oldPairs.length !== newPairs.length || oldPairs.length !== livePairs.length)) {
            throw new Error(`Boundary instance count mismatch for "${id}"`);
        }

        const triplets = alignBoundaryTriplets(oldPairs, newPairs, livePairs);
        for (const { oldBoundary, newBoundary, liveBoundary } of triplets) {

            if (!boundaryMatchesChangedFiles(oldBoundary, newBoundary, liveBoundary, changedFiles)) continue;

            if (boundaryContent(oldBoundary) !== boundaryContent(newBoundary) &&
                boundaryContentOutsideElements(oldBoundary) !== boundaryContentOutsideElements(newBoundary)) {
                changed.push({ live: liveBoundary, new: newBoundary });
            }
        }
    }

    if (changed.length === 0) return [];

    return changed.filter(({ live: outer }) => {
        return !changed.some(({ live: inner }) => {
            if (inner === outer) return false;
            return containsBoundary(outer, inner);
        });
    });
}

export function applyDirectivePatches(toPatch, maxPatches) {
    return applyDirectivePatchesDetailed(toPatch, maxPatches).patchCount;
}

export function applyDirectivePatchesDetailed(toPatch, maxPatches) {
    let patchCount = 0;
    let skipped = 0;
    let requiresReload = false;

    for (const { live, new: next } of toPatch) {
        if (patchCount >= maxPatches) break;

        const result = patchCommentBoundary(live, next);
        if (!result.applied) {
            skipped++;
            requiresReload = requiresReload || result.requiresReload === true;
            continue;
        }

        patchCount++;
    }

    return { patchCount, skipped, requiresReload };
}

export function boundaryContent(boundary) {
    return serializeBoundaryContent(boundary);
}

export function boundaryContentOutsideElements(boundary) {
    return serializeBoundaryContent(boundary, stripInstrumentedElements);
}

function serializeBoundaryContent(boundary, serializeElement = (element) => element.outerHTML) {
    const parts = [];
    let node = boundary.beginComment.nextSibling;
    while (node && node !== boundary.endComment) {
        if (node.nodeType === 1) {
            parts.push(serializeElement(node));
        } else {
            parts.push(node.nodeValue);
        }
        node = node.nextSibling;
    }
    return parts.join('');
}

export function stripInstrumentedElements(el) {
    return serializeWithAttributePlaceholders(el, 'data-hmr-id', { includeRoot: true });
}

export function containsBoundary(outer, inner) {
    const beginPos = outer.beginComment.compareDocumentPosition(inner.beginComment);
    const endPos = outer.endComment.compareDocumentPosition(inner.endComment);
    return (beginPos & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
        && (endPos & Node.DOCUMENT_POSITION_PRECEDING) !== 0;
}

export function indexCommentBoundaries(doc) {
    return scanCommentBoundaries(doc).boundaries;
}

export function groupById(boundaries) {
    const groups = {};
    for (const boundary of boundaries) {
        if (!groups[boundary.id]) groups[boundary.id] = [];
        groups[boundary.id].push(boundary);
    }
    return groups;
}

export function patchCommentBoundary(current, next) {
    const { beginComment, endComment } = current;

    if (beginComment.parentNode !== endComment.parentNode) {
        console.warn('[reload] Skipping cross-parent boundary:', current.id);
        return { applied: false, requiresReload: true, reason: 'cross-parent' };
    }

    if (boundaryScriptSignature(current) !== boundaryScriptSignature(next)) {
        console.warn('[reload] Skipping boundary with script element:', current.id);
        return { applied: false, requiresReload: true, reason: 'script-element' };
    }

    let scan = beginComment.nextSibling;
    while (scan && scan !== endComment) {
        if (scan.nodeType === 1 && (scan.hasAttribute?.('data-hmr-permanent') ||
            scan.querySelector?.('[data-hmr-permanent]'))) {
            console.log('[reload] Skipping boundary with permanent element:', current.id);
            return { applied: false, requiresReload: true, reason: 'permanent-element' };
        }
        scan = scan.nextSibling;
    }

    const newNodes = [];
    let node = next.beginComment.nextSibling;
    while (node && node !== next.endComment) {
        newNodes.push(document.importNode(node, true));
        node = node.nextSibling;
    }

    const oldRoot = singleElementBetween(beginComment, endComment);
    const newRoot = newNodes.length === 1 && newNodes[0].nodeType === 1
        ? newNodes[0]
        : null;
    const hasComments = hasCommentBetween(beginComment, endComment) ||
        hasCommentBetween(next.beginComment, next.endComment);

    if (oldRoot && newRoot) {
        morphElement(oldRoot, newRoot);

        if (visibleContent(oldRoot) !== visibleContent(newRoot) && oldRoot.parentNode) {
            const imported = document.importNode(newRoot, true);
            oldRoot.replaceWith(imported);
        }
        return { applied: true, requiresReload: false };
    }

    if (window.Alpine?.morphBetween && !hasComments) {
        window.Alpine.morphBetween(beginComment, endComment, boundaryContent(next), {
            key(el) {
                return resolveMorphKey(el);
            },
        });

        if (boundaryContent(current) !== boundaryContent(next)) {
            replaceBoundaryNodes(beginComment, endComment, newNodes);
        }
        return { applied: true, requiresReload: false };
    }

    replaceBoundaryNodes(beginComment, endComment, newNodes);
    return { applied: true, requiresReload: false };
}

function boundaryMatchesChangedFiles(oldBoundary, newBoundary, liveBoundary, changedFiles) {
    return filesMatchChangedFiles([oldBoundary.file, newBoundary.file, liveBoundary.file], changedFiles);
}

function alignBoundaryTriplets(oldPairs, newPairs, livePairs) {
    if (canPairByKey(oldPairs, newPairs, livePairs)) {
        const newByKey = new Map(newPairs.map((boundary) => [boundary.key, boundary]));
        const liveByKey = new Map(livePairs.map((boundary) => [boundary.key, boundary]));

        return oldPairs.map((oldBoundary) => ({
            oldBoundary,
            newBoundary: newByKey.get(oldBoundary.key),
            liveBoundary: liveByKey.get(oldBoundary.key),
        }));
    }

    const count = Math.min(oldPairs.length, newPairs.length, livePairs.length);
    const triplets = [];

    for (let i = 0; i < count; i++) {
        triplets.push({
            oldBoundary: oldPairs[i],
            newBoundary: newPairs[i],
            liveBoundary: livePairs[i],
        });
    }

    return triplets;
}

function canPairByKey(oldPairs, newPairs, livePairs) {
    if (oldPairs.length === 0 || newPairs.length === 0 || livePairs.length === 0) {
        return false;
    }

    if (oldPairs.length !== newPairs.length || oldPairs.length !== livePairs.length) {
        return false;
    }

    const oldKeys = getUniqueKeys(oldPairs);
    const newKeys = getUniqueKeys(newPairs);
    const liveKeys = getUniqueKeys(livePairs);
    if (!oldKeys || !newKeys || !liveKeys) {
        return false;
    }

    if (oldKeys.size !== newKeys.size || oldKeys.size !== liveKeys.size) {
        return false;
    }

    for (const key of oldKeys) {
        if (!newKeys.has(key) || !liveKeys.has(key)) {
            return false;
        }
    }

    return true;
}

function getUniqueKeys(boundaries) {
    const keys = new Set();

    for (const boundary of boundaries) {
        const key = String(boundary?.key ?? '').trim();
        if (key === '' || keys.has(key)) {
            return null;
        }
        keys.add(key);
    }

    return keys;
}

function scanCommentBoundaries(doc) {
    const boundaries = [];
    const stack = [];
    let unbalanced = 0;

    const walker = doc.createTreeWalker(
        doc.documentElement || doc,
        NodeFilter.SHOW_COMMENT,
    );

    let comment;
    while ((comment = walker.nextNode())) {
        const text = comment.textContent.trim();

        if (text.startsWith('bl:begin')) {
            const id = extractBoundaryAttribute(text, 'id');
            if (!id) continue;

            stack.push({
                id,
                key: extractBoundaryAttribute(text, 'key'),
                file: extractBoundaryAttribute(text, 'file'),
                beginComment: comment,
            });
            continue;
        }

        if (text.startsWith('bl:end')) {
            const id = extractBoundaryAttribute(text, 'id');
            if (!id) continue;

            let matched = false;
            for (let i = stack.length - 1; i >= 0; i--) {
                if (stack[i].id === id) {
                    const pair = stack.splice(i, 1)[0];
                    pair.key ??= extractBoundaryAttribute(text, 'key');
                    pair.endComment = comment;
                    boundaries.push(pair);
                    matched = true;
                    break;
                }
            }

            if (!matched) continue;
        }
    }

    unbalanced += stack.length;

    return { boundaries, unbalanced };
}

function replaceBoundaryNodes(beginComment, endComment, newNodes) {
    const parent = beginComment.parentNode;
    while (beginComment.nextSibling && beginComment.nextSibling !== endComment) {
        parent.removeChild(beginComment.nextSibling);
    }

    for (const newNode of newNodes) {
        parent.insertBefore(newNode, endComment);
    }
}

function hasCommentBetween(begin, end) {
    let node = begin.nextSibling;
    while (node && node !== end) {
        if (node.nodeType === Node.COMMENT_NODE) return true;
        node = node.nextSibling;
    }
    return false;
}

function boundaryScriptSignature(boundary) {
    const parts = [];
    let node = boundary.beginComment.nextSibling;
    while (node && node !== boundary.endComment) {
        if (node.nodeType === 1) {
            if (node.tagName?.toLowerCase() === 'script') {
                parts.push(node.outerHTML);
            }

            for (const script of node.querySelectorAll?.('script') ?? []) {
                parts.push(script.outerHTML);
            }
        }
        node = node.nextSibling;
    }

    return parts.join('\n');
}
