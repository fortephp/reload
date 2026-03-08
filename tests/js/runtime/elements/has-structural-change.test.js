import { describe, it, expect } from 'vitest';
import { hasStructuralChange } from '@runtime';
import { makeDoc } from '@test-helpers/dom.js';

function el(html) {
    return makeDoc(html).querySelector('body > *');
}

describe('hasStructuralChange', () => {
    it('returns false when child data-hmr-id elements are identical', () => {
        const old = el('<div><span data-hmr-id="element:span">a</span></div>');
        const next = el('<div><span data-hmr-id="element:span">b</span></div>');
        expect(hasStructuralChange(old, next)).toBe(false);
    });

    it('returns true when a child data-hmr-id element is added', () => {
        const old = el('<div><span data-hmr-id="element:span">a</span></div>');
        const next = el('<div><span data-hmr-id="element:span">a</span><p data-hmr-id="element:p">new</p></div>');
        expect(hasStructuralChange(old, next)).toBe(true);
    });

    it('returns true when a child data-hmr-id element is removed', () => {
        const old = el('<div><span data-hmr-id="element:span">a</span><p data-hmr-id="element:p">b</p></div>');
        const next = el('<div><span data-hmr-id="element:span">a</span></div>');
        expect(hasStructuralChange(old, next)).toBe(true);
    });

    it('returns true when child data-hmr-id elements are reordered', () => {
        const old = el('<div><span data-hmr-id="element:span">a</span><p data-hmr-id="element:p">b</p></div>');
        const next = el('<div><p data-hmr-id="element:p">b</p><span data-hmr-id="element:span">a</span></div>');
        expect(hasStructuralChange(old, next)).toBe(true);
    });

    it('ignores children without data-hmr-id', () => {
        const old = el('<div><span data-hmr-id="element:span">a</span></div>');
        const next = el('<div><span data-hmr-id="element:span">a</span><em>not instrumented</em></div>');
        expect(hasStructuralChange(old, next)).toBe(false);
    });
});
