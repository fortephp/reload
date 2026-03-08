import { describe, it, expect } from 'vitest';
import { boundaryContent, indexCommentBoundaries } from '@runtime';
import { makeDoc, boundary } from '@test-helpers/dom.js';

function getBoundary(html) {
    const doc = makeDoc(html);
    return indexCommentBoundaries(doc)[0];
}

describe('boundaryContent', () => {
    it('returns serialized element content between markers', () => {
        const b = getBoundary(boundary('component:nav', '<nav>links</nav>'));
        expect(boundaryContent(b)).toBe('<nav>links</nav>');
    });

    it('returns text node content', () => {
        const b = getBoundary(boundary('component:text', 'plain text'));
        expect(boundaryContent(b)).toBe('plain text');
    });

    it('handles mixed text and element nodes', () => {
        const b = getBoundary(boundary('component:mixed', 'before<span>middle</span>after'));
        const content = boundaryContent(b);
        expect(content).toContain('before');
        expect(content).toContain('<span>middle</span>');
        expect(content).toContain('after');
    });

    it('returns empty string for empty boundary', () => {
        const b = getBoundary(boundary('component:empty', ''));
        expect(boundaryContent(b)).toBe('');
    });

    it('serializes multiple element children', () => {
        const b = getBoundary(boundary('component:multi', '<div>a</div><span>b</span>'));
        const content = boundaryContent(b);
        expect(content).toContain('<div>a</div>');
        expect(content).toContain('<span>b</span>');
    });
});
