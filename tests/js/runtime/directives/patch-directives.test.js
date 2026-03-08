import { describe, it, expect } from 'vitest';
import {
    applyDirectivePatchesDetailed,
    patchDirectives,
    indexCommentBoundaries,
    boundaryContent,
} from '@runtime';
import { makeDoc, boundary } from '@test-helpers/dom.js';

describe('patchDirectives', () => {
    it('patches a changed directive boundary in the live DOM', () => {
        const oldDoc = makeDoc(boundary('component:nav', '<nav>old links</nav>'));
        const newDoc = makeDoc(boundary('component:nav', '<nav>new links</nav>'));
        const liveDoc = makeDoc(boundary('component:nav', '<nav>old links</nav>'));

        const count = patchDirectives(oldDoc, newDoc, liveDoc, 25);
        expect(count).toBe(1);

        const liveBoundary = indexCommentBoundaries(liveDoc)[0];
        expect(boundaryContent(liveBoundary)).toContain('new links');
    });

    it('returns 0 when nothing changed', () => {
        const html = boundary('component:nav', '<nav>same</nav>');
        const oldDoc = makeDoc(html);
        const newDoc = makeDoc(html);
        const liveDoc = makeDoc(html);

        expect(patchDirectives(oldDoc, newDoc, liveDoc, 25)).toBe(0);
    });

    it('skips boundaries where changes are only inside data-hmr-id elements', () => {
        const oldDoc = makeDoc(boundary('component:widget',
            '<div data-hmr-id="element:div">old text</div><p>static</p>'));
        const newDoc = makeDoc(boundary('component:widget',
            '<div data-hmr-id="element:div">new text</div><p>static</p>'));
        const liveDoc = makeDoc(boundary('component:widget',
            '<div data-hmr-id="element:div">old text</div><p>static</p>'));
        const count = patchDirectives(oldDoc, newDoc, liveDoc, 25);
        expect(count).toBe(0);
    });

    it('patches when changes exist outside data-hmr-id elements', () => {
        const oldDoc = makeDoc(boundary('component:widget',
            '<div data-hmr-id="element:div">text</div><p>old static</p>'));
        const newDoc = makeDoc(boundary('component:widget',
            '<div data-hmr-id="element:div">text</div><p>new static</p>'));
        const liveDoc = makeDoc(boundary('component:widget',
            '<div data-hmr-id="element:div">text</div><p>old static</p>'));

        const count = patchDirectives(oldDoc, newDoc, liveDoc, 25);
        expect(count).toBe(1);
    });

    it('patches deepest changed boundaries only', () => {
        const inner = boundary('component:inner', '<span>old inner</span>');
        const outer = boundary('component:outer', `<div>${inner}</div>`);

        const innerNew = boundary('component:inner', '<span>new inner</span>');
        const outerNew = boundary('component:outer', `<div>${innerNew}</div>`);

        const oldDoc = makeDoc(outer);
        const newDoc = makeDoc(outerNew);
        const liveDoc = makeDoc(outer);

        const count = patchDirectives(oldDoc, newDoc, liveDoc, 25);
        expect(count).toBe(1);
        const liveBoundaries = indexCommentBoundaries(liveDoc);
        const liveInner = liveBoundaries.find(b => b.id === 'component:inner');
        expect(boundaryContent(liveInner)).toContain('new inner');
    });

    it('handles multiple instances of same boundary id', () => {
        const oldDoc = makeDoc(
            boundary('component:card', '<div>card 1</div>') +
            boundary('component:card', '<div>card 2 old</div>'),
        );
        const newDoc = makeDoc(
            boundary('component:card', '<div>card 1</div>') +
            boundary('component:card', '<div>card 2 new</div>'),
        );
        const liveDoc = makeDoc(
            boundary('component:card', '<div>card 1</div>') +
            boundary('component:card', '<div>card 2 old</div>'),
        );

        const count = patchDirectives(oldDoc, newDoc, liveDoc, 25);
        expect(count).toBe(1);
    });

    it('pairs repeated boundaries by key when keys are available and aligned', () => {
        const oldDoc = makeDoc(
            boundary('component:card', '<div>card A old</div>', 'test.blade.php', 'a') +
            boundary('component:card', '<div>card B</div>', 'test.blade.php', 'b'),
        );
        const newDoc = makeDoc(
            boundary('component:card', '<div>card B</div>', 'test.blade.php', 'b') +
            boundary('component:card', '<div>card A new</div>', 'test.blade.php', 'a'),
        );
        const liveDoc = makeDoc(
            boundary('component:card', '<div>card A old</div>', 'test.blade.php', 'a') +
            boundary('component:card', '<div>card B</div>', 'test.blade.php', 'b'),
        );

        const count = patchDirectives(oldDoc, newDoc, liveDoc, 25);
        expect(count).toBe(1);

        const boundaries = indexCommentBoundaries(liveDoc);
        const keyA = boundaries.find((entry) => entry.key === 'a');
        const keyB = boundaries.find((entry) => entry.key === 'b');
        expect(boundaryContent(keyA)).toContain('card A new');
        expect(boundaryContent(keyB)).toContain('card B');
    });

    it('falls back to index pairing when boundary keys drift between renders', () => {
        const oldDoc = makeDoc(
            boundary('component:item', '<div>first</div>', 'test.blade.php', 'old-1') +
            boundary('component:item', '<div>second old</div>', 'test.blade.php', 'old-2'),
        );
        const newDoc = makeDoc(
            boundary('component:item', '<div>first</div>', 'test.blade.php', 'new-1') +
            boundary('component:item', '<div>second new</div>', 'test.blade.php', 'new-2'),
        );
        const liveDoc = makeDoc(
            boundary('component:item', '<div>first</div>', 'test.blade.php', 'old-1') +
            boundary('component:item', '<div>second old</div>', 'test.blade.php', 'old-2'),
        );

        const count = patchDirectives(oldDoc, newDoc, liveDoc, 25);
        expect(count).toBe(1);

        const boundaries = indexCommentBoundaries(liveDoc);
        expect(boundaryContent(boundaries[0])).toContain('first');
        expect(boundaryContent(boundaries[1])).toContain('second new');
    });

    it('throws in strict mode when boundary instance counts mismatch', () => {
        const oldDoc = makeDoc(
            boundary('component:item', '<div>a</div>') +
            boundary('component:item', '<div>b</div>'),
        );
        const newDoc = makeDoc(
            boundary('component:item', '<div>x</div>') +
            boundary('component:item', '<div>a</div>') +
            boundary('component:item', '<div>b</div>'),
        );
        const liveDoc = makeDoc(
            boundary('component:item', '<div>a</div>') +
            boundary('component:item', '<div>b</div>'),
        );

        expect(() => patchDirectives(oldDoc, newDoc, liveDoc, 25, {
            failOnCountMismatch: true,
        })).toThrow(/count mismatch/i);
    });

    it('patches only boundaries matching changed file filter', () => {
        const oldDoc = makeDoc(
            boundary('component:alpha', '<p>old A</p>', 'resources/views/a.blade.php') +
            boundary('component:beta', '<p>old B</p>', 'resources/views/b.blade.php'),
        );
        const newDoc = makeDoc(
            boundary('component:alpha', '<p>new A</p>', 'resources/views/a.blade.php') +
            boundary('component:beta', '<p>new B</p>', 'resources/views/b.blade.php'),
        );
        const liveDoc = makeDoc(
            boundary('component:alpha', '<p>old A</p>', 'resources/views/a.blade.php') +
            boundary('component:beta', '<p>old B</p>', 'resources/views/b.blade.php'),
        );

        const count = patchDirectives(oldDoc, newDoc, liveDoc, 25, {
            changedFiles: ['resources/views/a.blade.php'],
        });
        expect(count).toBe(1);

        const liveBoundaries = indexCommentBoundaries(liveDoc);
        expect(boundaryContent(liveBoundaries[0])).toContain('new A');
        expect(boundaryContent(liveBoundaries[1])).toContain('old B');
    });

    it('throws in strict mode when boundaries are unbalanced', () => {
        const oldDoc = makeDoc('<!--bl:begin id="component:nav"--><div>broken</div>');
        const newDoc = makeDoc('<!--bl:begin id="component:nav"--><div>broken</div>');
        const liveDoc = makeDoc('<!--bl:begin id="component:nav"--><div>broken</div>');

        expect(() => patchDirectives(oldDoc, newDoc, liveDoc, 25, {
            failOnUnbalanced: true,
        })).toThrow(/unbalanced/i);
    });

    it('does not treat orphan end markers as unbalanced in strict mode', () => {
        const oldDoc = makeDoc('<!--bl:end id="component:nav"--><div>safe</div>');
        const newDoc = makeDoc('<!--bl:end id="component:nav"--><div>safe</div>');
        const liveDoc = makeDoc('<!--bl:end id="component:nav"--><div>safe</div>');

        expect(() => patchDirectives(oldDoc, newDoc, liveDoc, 25, {
            failOnUnbalanced: true,
        })).not.toThrow();
    });

    it('respects maxPatches limit', () => {
        const items = (prefix) => Array.from({ length: 5 }, (_, i) =>
            boundary(`component:item-${i}`, `<div>${prefix} ${i}</div>`)
        ).join('');

        const oldDoc = makeDoc(items('old'));
        const newDoc = makeDoc(items('new'));
        const liveDoc = makeDoc(items('old'));

        const count = patchDirectives(oldDoc, newDoc, liveDoc, 2);
        expect(count).toBe(2);
    });

    it('returns 0 when no comment boundaries exist', () => {
        const oldDoc = makeDoc('<div>no boundaries</div>');
        const newDoc = makeDoc('<div>no boundaries</div>');
        const liveDoc = makeDoc('<div>no boundaries</div>');
        expect(patchDirectives(oldDoc, newDoc, liveDoc, 25)).toBe(0);
    });

    it('reports reload requirement when a changed boundary spans different parents', () => {
        const oldDoc = makeDoc('<div><!--bl:begin id="component:nav"--><span>old</span></div><div><!--bl:end id="component:nav"--></div>');
        const newDoc = makeDoc('<div><!--bl:begin id="component:nav"--><span>new</span></div><div><!--bl:end id="component:nav"--></div>');
        const liveDoc = makeDoc('<div><!--bl:begin id="component:nav"--><span>old</span></div><div><!--bl:end id="component:nav"--></div>');

        const toPatch = [{
            live: indexCommentBoundaries(liveDoc)[0],
            new: indexCommentBoundaries(newDoc)[0],
        }];

        const result = applyDirectivePatchesDetailed(toPatch, 25);

        expect(result.patchCount).toBe(0);
        expect(result.skipped).toBe(1);
        expect(result.requiresReload).toBe(true);
    });
});
