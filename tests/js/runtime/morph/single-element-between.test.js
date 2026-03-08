import { describe, it, expect } from 'vitest';
import { singleElementBetween } from '@runtime';

function makeBoundary(innerHTML) {
    const container = document.createElement('div');
    container.innerHTML = `<!--begin-->${innerHTML}<!--end-->`;
    const begin = container.childNodes[0];
    const end = container.childNodes[container.childNodes.length - 1];
    return { begin, end };
}

describe('singleElementBetween', () => {
    it('returns the element when there is exactly one', () => {
        const { begin, end } = makeBoundary('<div>hello</div>');
        const result = singleElementBetween(begin, end);
        expect(result).not.toBeNull();
        expect(result.tagName).toBe('DIV');
    });

    it('returns null when there are multiple elements', () => {
        const { begin, end } = makeBoundary('<div>a</div><span>b</span>');
        expect(singleElementBetween(begin, end)).toBeNull();
    });

    it('returns null when there is non-whitespace text', () => {
        const { begin, end } = makeBoundary('some text<div>a</div>');
        expect(singleElementBetween(begin, end)).toBeNull();
    });

    it('ignores whitespace-only text nodes', () => {
        const { begin, end } = makeBoundary('  \n  <div>hello</div>  \n  ');
        const result = singleElementBetween(begin, end);
        expect(result).not.toBeNull();
        expect(result.tagName).toBe('DIV');
    });

    it('returns null when there are no elements', () => {
        const { begin, end } = makeBoundary('   ');
        expect(singleElementBetween(begin, end)).toBeNull();
    });

    it('returns null when boundary is empty', () => {
        const { begin, end } = makeBoundary('');
        expect(singleElementBetween(begin, end)).toBeNull();
    });
});
