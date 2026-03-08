import { describe, it, expect } from 'vitest';
import { containsBoundary, indexCommentBoundaries } from '@runtime';
import { makeDoc, boundary } from '@test-helpers/dom.js';

describe('containsBoundary', () => {
    it('returns true when outer boundary fully contains inner boundary', () => {
        const inner = boundary('component:inner', '<span>inside</span>');
        const outer = boundary('component:outer', `<div>${inner}</div>`);
        const doc = makeDoc(outer);
        const boundaries = indexCommentBoundaries(doc);
        const outerB = boundaries.find(b => b.id === 'component:outer');
        const innerB = boundaries.find(b => b.id === 'component:inner');
        expect(containsBoundary(outerB, innerB)).toBe(true);
    });

    it('returns false when boundaries are siblings', () => {
        const doc = makeDoc(
            boundary('component:a', '<div>a</div>') +
            boundary('component:b', '<div>b</div>'),
        );
        const boundaries = indexCommentBoundaries(doc);
        const a = boundaries.find(b => b.id === 'component:a');
        const b = boundaries.find(b => b.id === 'component:b');
        expect(containsBoundary(a, b)).toBe(false);
        expect(containsBoundary(b, a)).toBe(false);
    });

    it('returns false for inner containing outer', () => {
        const inner = boundary('component:inner', '<span>inside</span>');
        const outer = boundary('component:outer', `<div>${inner}</div>`);
        const doc = makeDoc(outer);
        const boundaries = indexCommentBoundaries(doc);
        const outerB = boundaries.find(b => b.id === 'component:outer');
        const innerB = boundaries.find(b => b.id === 'component:inner');
        expect(containsBoundary(innerB, outerB)).toBe(false);
    });
});
