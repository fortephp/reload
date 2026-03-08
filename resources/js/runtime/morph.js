import { resolveMorphKey } from './shared.js';

export function morphElement(from, to) {
    if (!from || !to) {
        return from;
    }

    const wireState = new Map();
    const xDataChanges = new Map();
    const alpineMorph = window.Alpine?.morph;

    if (typeof alpineMorph === 'function') {
        alpineMorph(from, to, {
            updating(fromEl, toEl, childrenOnly, skip, skipChildren) {
                if (fromEl.hasAttribute?.('data-hmr-permanent')) return skip();
                if (fromEl.__livewire_ignore) return skip();
                if (fromEl.__livewire_ignore_self) childrenOnly();
                if (fromEl.__livewire_ignore_children) skipChildren?.();

                trackPendingState(fromEl, toEl, wireState, xDataChanges);
            },

            updated(fromEl) {
                restorePendingState(fromEl, wireState, xDataChanges);
            },

            key(el) {
                return resolveMorphKey(el);
            },
        });

        return from;
    }

    if (from.hasAttribute?.('data-hmr-permanent') || from.__livewire_ignore) {
        return from;
    }

    trackPendingState(from, to, wireState, xDataChanges);
    morphElementWithoutAlpine(from, to);
    restorePendingState(from, wireState, xDataChanges);

    return from;
}

export function singleElementBetween(begin, end) {
    let el = null;
    let node = begin.nextSibling;
    while (node && node !== end) {
        if (node.nodeType === 1) {
            if (el) return null; // Multiple elements
            el = node;
        } else if (node.nodeType === 3 && node.textContent.trim()) {
            return null; // Non-whitespace text
        }
        node = node.nextSibling;
    }
    return el;
}

export function mergeAlpineData(el, newXDataExpr) {
    if (!el._x_dataStack?.[0]) return;

    try {
        const newDefaults = new Function(`return (${newXDataExpr})`)();
        if (!newDefaults || typeof newDefaults !== 'object') return;

        const currentData = el._x_dataStack[0];
        for (const [key, value] of Object.entries(newDefaults)) {
            if (!(key in currentData)) {
                currentData[key] = value;
            }
        }
        for (const key of Object.keys(currentData)) {
            if (key !== 'init' && key !== 'destroy' && !(key in newDefaults)) {
                delete currentData[key];
            }
        }
    } catch (e) {
        console.debug('[reload] Could not merge x-data:', e.message);
    }
}

function trackPendingState(from, to, wireState, xDataChanges) {
    if (from.__livewire) {
        wireState.set(from, {
            snapshot: from.getAttribute('wire:snapshot'),
            effects: from.getAttribute('wire:effects'),
        });
    }

    if (from._x_dataStack &&
        from.hasAttribute?.('x-data') &&
        to.hasAttribute?.('x-data') &&
        from.getAttribute('x-data') !== to.getAttribute('x-data')) {
        xDataChanges.set(from, to.getAttribute('x-data'));
    }
}

function restorePendingState(from, wireState, xDataChanges) {
    const saved = wireState.get(from);
    if (saved) {
        if (saved.snapshot !== null) from.setAttribute('wire:snapshot', saved.snapshot);
        if (saved.effects !== null) from.setAttribute('wire:effects', saved.effects);
        wireState.delete(from);
    }

    const newXData = xDataChanges.get(from);
    if (newXData) {
        mergeAlpineData(from, newXData);
        xDataChanges.delete(from);
    }
}

function morphElementWithoutAlpine(from, to) {
    if (from.nodeType !== to.nodeType || from.nodeName !== to.nodeName) {
        if (from.parentNode) {
            from.replaceWith(cloneIntoDocument(to));
        }
        return;
    }

    if (!from.__livewire_ignore_self) {
        syncAttributes(from, to);
    }

    if (!from.__livewire_ignore_children) {
        syncChildren(from, to);
    }
}

function syncAttributes(from, to) {
    if (!from.attributes || !to.attributes) {
        return;
    }

    for (const attr of [...from.attributes]) {
        if (!to.hasAttribute(attr.name)) {
            from.removeAttribute(attr.name);
        }
    }

    for (const attr of [...to.attributes]) {
        if (from.getAttribute(attr.name) !== attr.value) {
            from.setAttribute(attr.name, attr.value);
        }
    }
}

function syncChildren(from, to) {
    while (from.firstChild) {
        from.removeChild(from.firstChild);
    }

    for (const child of Array.from(to.childNodes)) {
        from.appendChild(cloneIntoDocument(child));
    }
}

function cloneIntoDocument(node) {
    return node.ownerDocument === document
        ? node.cloneNode(true)
        : document.importNode(node, true);
}
