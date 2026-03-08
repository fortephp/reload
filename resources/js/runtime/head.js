const MANAGED_META_SELECTOR = 'meta[name], meta[property]';

export function patchHead(newDoc, liveDoc = document) {
    return patchHeadDetailed(liveDoc, newDoc, liveDoc).patchCount;
}

export function patchHeadDetailed(oldDoc, newDoc, liveDoc = document) {
    let count = 0;

    const newTitle = newDoc.querySelector('title')?.textContent ?? '';
    const currentTitle = liveDoc.querySelector('title')?.textContent ?? (liveDoc.title ?? '');
    if (newTitle !== currentTitle) {
        liveDoc.title = newTitle;
        count++;
    }

    const liveHead = liveDoc.head ?? document.head;
    const newHead = newDoc.head;
    const existingMeta = new Map();

    for (const meta of liveHead.querySelectorAll(MANAGED_META_SELECTOR)) {
        existingMeta.set(metaKey(meta), meta);
    }

    const nextMetaKeys = new Set();
    for (const newMeta of newHead.querySelectorAll(MANAGED_META_SELECTOR)) {
        const key = metaKey(newMeta);
        nextMetaKeys.add(key);
        const existing = existingMeta.get(key);
        if (existing) {
            if (existing.getAttribute('content') !== newMeta.getAttribute('content')) {
                existing.setAttribute('content', newMeta.getAttribute('content'));
                count++;
            }
        } else {
            liveHead.appendChild(document.importNode(newMeta, true));
            count++;
        }
    }

    for (const [key, meta] of existingMeta) {
        if (!nextMetaKeys.has(key)) {
            meta.remove();
            count++;
        }
    }

    return {
        patchCount: count,
        requiresReload: oldDoc != null &&
            unsupportedHeadSignature(oldDoc.head) !== unsupportedHeadSignature(newHead),
    };
}

function metaKey(meta) {
    const attr = meta.hasAttribute('name') ? 'name' : 'property';
    const key = meta.getAttribute(attr) ?? '';

    return `${attr}:${key}`;
}

function unsupportedHeadSignature(head) {
    if (!head) {
        return '';
    }

    return Array.from(head.children)
        .filter((node) => !isManagedHeadNode(node))
        .map((node) => node.outerHTML)
        .join('\n');
}

function isManagedHeadNode(node) {
    const tagName = node.tagName?.toLowerCase();
    if (tagName === 'title') {
        return true;
    }

    if (tagName === 'meta' && (node.hasAttribute('name') || node.hasAttribute('property'))) {
        return true;
    }

    return isLivewireProgressStyleNode(node);
}

function isLivewireProgressStyleNode(node) {
    if (node?.tagName?.toLowerCase() !== 'style') {
        return false;
    }

    const content = String(node.textContent ?? '');

    return content.includes('#nprogress') &&
        content.includes('--livewire-progress-bar-color');
}
