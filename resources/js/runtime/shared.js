const DEFAULT_MAX_PATCHES = 25;

export function normalizePath(value) {
    return String(value ?? '')
        .replace(/\\/g, '/')
        .replace(/^\.\//, '')
        .replace(/\/{2,}/g, '/')
        .toLowerCase();
}

export function pathMatchesChangedFiles(path, changedFiles) {
    if (!changedFiles || changedFiles.length === 0) return true;

    const normalizedPath = normalizePath(path);
    if (!normalizedPath) return true;

    return changedFiles.some((changedFile) => {
        const normalizedChanged = normalizePath(changedFile);
        if (!normalizedChanged) return false;

        return normalizedPath === normalizedChanged
            || normalizedPath.endsWith('/' + normalizedChanged)
            || normalizedChanged.endsWith('/' + normalizedPath);
    });
}

export function filesMatchChangedFiles(files, changedFiles) {
    if (!changedFiles || changedFiles.length === 0) return true;

    const candidates = (files || []).filter(Boolean);
    if (candidates.length === 0) return true;

    return candidates.some((file) => pathMatchesChangedFiles(file, changedFiles));
}

export function resolveMorphKey(el) {
    return el?.getAttribute?.('wire:key')
        || el?.id
        || livewireComponentRootKey(el)
        || undefined;
}

export function containsScriptElement(node) {
    if (!node || node.nodeType !== 1) {
        return false;
    }

    return node.tagName?.toLowerCase() === 'script' ||
        node.querySelector?.('script') != null;
}

export function scriptElementSignature(node) {
    if (!containsScriptElement(node)) {
        return '';
    }

    const parts = [];

    if (node.tagName?.toLowerCase() === 'script') {
        parts.push(node.outerHTML);
    }

    for (const script of node.querySelectorAll?.('script') ?? []) {
        parts.push(script.outerHTML);
    }

    return parts.join('\n');
}

export function serializeWithAttributePlaceholders(el, attributeName, options = {}) {
    if (!el || !attributeName) {
        return '';
    }

    const {
        includeRoot = false,
        placeholderTag = 'hmr-placeholder',
        placeholderAttr = 'id',
    } = options;

    if (includeRoot && el.hasAttribute?.(attributeName)) {
        return placeholderHtml(
            placeholderTag,
            placeholderAttr,
            el.getAttribute(attributeName),
        );
    }

    const clone = el.cloneNode(true);

    for (const child of clone.querySelectorAll(`[${attributeName}]`)) {
        const placeholder = clone.ownerDocument.createElement(placeholderTag);
        const value = child.getAttribute(attributeName);

        if (value !== null) {
            placeholder.setAttribute(placeholderAttr, value);
        }

        child.replaceWith(placeholder);
    }

    return clone.outerHTML;
}

export function collectDocumentDependencyFiles(doc) {
    if (!doc?.querySelectorAll) {
        return [];
    }

    const files = new Set();

    for (const element of doc.querySelectorAll('[data-hmr-file]')) {
        const file = String(element.getAttribute('data-hmr-file') ?? '').trim();
        if (file !== '') {
            files.add(file);
        }
    }

    const root = doc.documentElement || doc;
    if (!root || typeof doc.createTreeWalker !== 'function') {
        return Array.from(files);
    }

    const commentWalker = doc.createTreeWalker(
        root,
        globalThis.NodeFilter?.SHOW_COMMENT ?? 128,
    );

    let comment;
    while ((comment = commentWalker.nextNode())) {
        const text = String(comment.textContent ?? '').trim();
        if (!text.startsWith('bl:begin')) {
            continue;
        }

        const file = extractBoundaryAttribute(text, 'file');
        if (file) {
            files.add(file);
        }
    }

    return Array.from(files);
}

export function documentMayMatchChangedFiles(doc, changedFiles) {
    if (!changedFiles || changedFiles.length === 0) {
        return true;
    }

    const dependencyFiles = collectDocumentDependencyFiles(doc);
    if (dependencyFiles.length === 0) {
        return true;
    }

    return filesMatchChangedFiles(dependencyFiles, changedFiles);
}

export function resolveMaxPatches(headers, fallback = DEFAULT_MAX_PATCHES) {
    const fromHeader = parsePositiveInt(headers?.get?.('X-Reload-Max-Patches'));
    if (fromHeader !== null) return fromHeader;

    const fromMeta = parsePositiveInt(
        document.querySelector('meta[name="reload-max-patches"]')?.getAttribute('content'),
    );

    return fromMeta ?? fallback ?? DEFAULT_MAX_PATCHES;
}

export function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeChangedFiles(input) {
    if (Array.isArray(input)) {
        const files = input
            .map((file) => String(file ?? '').trim())
            .filter(Boolean);
        return files.length > 0 ? files : null;
    }

    if (typeof input === 'string') {
        const file = input.trim();
        return file !== '' ? [file] : null;
    }

    return null;
}

export function looksLikeHtmlResponse(contentType, body) {
    const type = String(contentType || '').toLowerCase();
    if (type.includes('text/html') || type.includes('application/xhtml+xml')) {
        return true;
    }

    return String(body || '').trim().startsWith('<');
}

export function snapshotCurrentDocument() {
    if (!document?.documentElement) {
        return null;
    }

    return new DOMParser().parseFromString(document.documentElement.outerHTML, 'text/html');
}

export function baselineComparableHtml(doc) {
    if (!doc?.documentElement) {
        return '';
    }

    const clone = doc.documentElement.cloneNode(true);

    for (const script of clone.querySelectorAll('script')) {
        script.remove();
    }

    for (const hidden of clone.querySelectorAll('input[type="hidden"]')) {
        hidden.remove();
    }

    return clone.outerHTML.replace(/\s+/g, ' ').trim();
}

function parsePositiveInt(value) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function extractBoundaryAttribute(text, name) {
    const match = String(text ?? '').match(new RegExp(`${name}="([^"]*)"`));
    return match ? match[1] : null;
}

function livewireComponentRootKey(el) {
    if (!el?.getAttribute) {
        return undefined;
    }

    const wireId = el.getAttribute('wire:id');
    if (!wireId) {
        return undefined;
    }

    if (el.hasAttribute('wire:snapshot')) {
        return undefined;
    }

    return wireId;
}

function placeholderHtml(tagName, attrName, attrValue) {
    const tag = String(tagName ?? 'hmr-placeholder');
    const name = String(attrName ?? 'id');
    const value = String(attrValue ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');

    return `<${tag} ${name}="${value}"/>`;
}
