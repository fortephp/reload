import { describe, it, expect } from 'vitest';
import { boundaryContentOutsideElements, indexCommentBoundaries } from '@runtime';
import { makeDoc, boundary } from '@test-helpers/dom.js';

function getBoundary(html) {
    const doc = makeDoc(html);
    return indexCommentBoundaries(doc)[0];
}

describe('boundaryContentOutsideElements', () => {
    it('replaces top-level data-hmr-id element with placeholder', () => {
        const b = getBoundary(boundary('component:widget', '<div data-hmr-id="element:div">content</div>'));
        const content = boundaryContentOutsideElements(b);
        expect(content).toContain('<hmr-placeholder id="element:div"/>');
        expect(content).not.toContain('content');
    });

    it('preserves non-instrumented elements', () => {
        const b = getBoundary(boundary('component:widget', '<p>paragraph</p>'));
        const content = boundaryContentOutsideElements(b);
        expect(content).toContain('<p>paragraph</p>');
    });

    it('preserves text nodes', () => {
        const b = getBoundary(boundary('component:widget', 'hello world'));
        const content = boundaryContentOutsideElements(b);
        expect(content).toBe('hello world');
    });

    it('replaces nested data-hmr-id children with placeholders', () => {
        const html = '<div><span data-hmr-id="element:span">inner</span></div>';
        const b = getBoundary(boundary('component:widget', html));
        const content = boundaryContentOutsideElements(b);
        expect(content).toContain('<hmr-placeholder');
        expect(content).not.toContain('inner');
    });

    it('two boundaries differing only inside instrumented elements return same stripped content', () => {
        const b1 = getBoundary(boundary('component:widget',
            '<div data-hmr-id="element:div">old text</div><p>static</p>'));
        const b2 = getBoundary(boundary('component:widget',
            '<div data-hmr-id="element:div">new text</div><p>static</p>'));
        expect(boundaryContentOutsideElements(b1)).toBe(boundaryContentOutsideElements(b2));
    });

    it('two boundaries differing outside elements return different stripped content', () => {
        const b1 = getBoundary(boundary('component:widget',
            '<div data-hmr-id="element:div">same</div><p>old static</p>'));
        const b2 = getBoundary(boundary('component:widget',
            '<div data-hmr-id="element:div">same</div><p>new static</p>'));
        expect(boundaryContentOutsideElements(b1)).not.toBe(boundaryContentOutsideElements(b2));
    });
});
