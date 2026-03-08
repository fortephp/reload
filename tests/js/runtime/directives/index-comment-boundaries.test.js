import { describe, it, expect } from 'vitest';
import { indexCommentBoundaries } from '@runtime';
import { makeDoc, boundary } from '@test-helpers/dom.js';

describe('indexCommentBoundaries', () => {
    it('returns empty array when no comment boundaries exist', () => {
        const doc = makeDoc('<div>no comments</div>');
        expect(indexCommentBoundaries(doc)).toEqual([]);
    });

    it('finds a single begin/end pair', () => {
        const doc = makeDoc(boundary('component:nav', '<nav>links</nav>'));
        const boundaries = indexCommentBoundaries(doc);
        expect(boundaries).toHaveLength(1);
        expect(boundaries[0].id).toBe('component:nav');
        expect(boundaries[0].file).toBe('test.blade.php');
        expect(boundaries[0].beginComment.nodeType).toBe(8);
        expect(boundaries[0].endComment.nodeType).toBe(8);
    });

    it('finds multiple non-nested boundary pairs', () => {
        const doc = makeDoc(
            boundary('component:nav', '<nav>nav</nav>') +
            boundary('component:footer', '<footer>foot</footer>'),
        );
        const boundaries = indexCommentBoundaries(doc);
        expect(boundaries).toHaveLength(2);
        const ids = boundaries.map(b => b.id);
        expect(ids).toContain('component:nav');
        expect(ids).toContain('component:footer');
    });

    it('handles nested boundary pairs correctly', () => {
        const inner = boundary('component:logo', '<img src="logo.png">');
        const outer = boundary('component:nav', `<nav>${inner}</nav>`);
        const doc = makeDoc(outer);
        const boundaries = indexCommentBoundaries(doc);
        expect(boundaries).toHaveLength(2);
        const ids = boundaries.map(b => b.id);
        expect(ids).toContain('component:nav');
        expect(ids).toContain('component:logo');
    });

    it('handles unmatched begin comment gracefully', () => {
        const doc = makeDoc('<!--bl:begin id="component:orphan" file="test.blade.php"--><div>no end</div>');
        const boundaries = indexCommentBoundaries(doc);
        expect(boundaries).toHaveLength(0);
    });

    it('handles multiple instances of same id', () => {
        const doc = makeDoc(
            boundary('component:card', '<div>card 1</div>') +
            boundary('component:card', '<div>card 2</div>'),
        );
        const boundaries = indexCommentBoundaries(doc);
        expect(boundaries).toHaveLength(2);
        expect(boundaries[0].id).toBe('component:card');
        expect(boundaries[1].id).toBe('component:card');
    });

    it('parses file attribute correctly', () => {
        const doc = makeDoc('<!--bl:begin id="component:nav" file="resources/views/nav.blade.php"--><nav/><!--bl:end id="component:nav"-->');
        const boundaries = indexCommentBoundaries(doc);
        expect(boundaries[0].file).toBe('resources/views/nav.blade.php');
    });

    it('handles missing file attribute', () => {
        const doc = makeDoc('<!--bl:begin id="component:nav"--><nav/><!--bl:end id="component:nav"-->');
        const boundaries = indexCommentBoundaries(doc);
        expect(boundaries[0].file).toBeNull();
    });
});
