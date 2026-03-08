import { describe, it, expect } from 'vitest';
import { patchCommentBoundary, indexCommentBoundaries } from '@runtime';
import { makeDoc, boundary } from '@test-helpers/dom.js';

function setupBoundaries(currentContent, newContent) {
    const liveDoc = makeDoc(boundary('component:test', currentContent));
    const newDoc = makeDoc(boundary('component:test', newContent));
    const live = indexCommentBoundaries(liveDoc)[0];
    const next = indexCommentBoundaries(newDoc)[0];
    return { live, next, liveDoc };
}

function contentBetweenMarkers(b) {
    const parts = [];
    let node = b.beginComment.nextSibling;
    while (node && node !== b.endComment) {
        parts.push(node.nodeType === 1 ? node.outerHTML : node.textContent);
        node = node.nextSibling;
    }
    return parts.join('');
}

describe('patchCommentBoundary', () => {
    it('replaces content between comment markers', () => {
        const { live, next } = setupBoundaries('<div>old</div>', '<div>new</div>');
        patchCommentBoundary(live, next);
        expect(contentBetweenMarkers(live)).toContain('new');
        expect(contentBetweenMarkers(live)).not.toContain('old');
    });

    it('handles empty new content', () => {
        const { live, next } = setupBoundaries('<div>old</div>', '');
        patchCommentBoundary(live, next);
        expect(contentBetweenMarkers(live)).toBe('');
    });

    it('handles empty old content (inserts new)', () => {
        const { live, next } = setupBoundaries('', '<span>added</span>');
        patchCommentBoundary(live, next);
        expect(contentBetweenMarkers(live)).toContain('added');
    });

    it('preserves comment markers themselves', () => {
        const { live, next, liveDoc } = setupBoundaries('<div>old</div>', '<div>new</div>');
        patchCommentBoundary(live, next);
        const boundaries = indexCommentBoundaries(liveDoc);
        expect(boundaries).toHaveLength(1);
        expect(boundaries[0].id).toBe('component:test');
    });

    it('replaces multiple children', () => {
        const { live, next } = setupBoundaries(
            '<div>a</div><span>b</span>',
            '<p>x</p><em>y</em><strong>z</strong>',
        );
        patchCommentBoundary(live, next);
        const content = contentBetweenMarkers(live);
        expect(content).toContain('<p>x</p>');
        expect(content).toContain('<em>y</em>');
        expect(content).toContain('<strong>z</strong>');
    });

    it('reports reload requirement when the boundary contains a script element', () => {
        const { live, next } = setupBoundaries(
            '<script>window.__hmrScript = "old";</script>',
            '<script>window.__hmrScript = "new";</script>',
        );

        const result = patchCommentBoundary(live, next);

        expect(result.applied).toBe(false);
        expect(result.requiresReload).toBe(true);
        expect(result.reason).toBe('script-element');
        expect(contentBetweenMarkers(live)).toContain('"old"');
    });
});
