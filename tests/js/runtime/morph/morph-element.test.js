import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { patchElements, patchCommentBoundary, morphElement } from '@runtime';
import { makeDoc, boundary } from '@test-helpers/dom.js';

function createMockMorph() {
    const calls = [];

    function morph(from, to, options = {}) {
        calls.push({ from, to, options });
        let updateChildrenOnly = false;
        let skip = false;
        let skipChildren = false;

        if (options.updating) {
            options.updating(
                from,
                to,
                () => {
                    updateChildrenOnly = true;
                },
                () => {
                    skip = true;
                },
                () => {
                    skipChildren = true;
                },
            );
        }
        if (skip) {
            return;
        }

        if (!updateChildrenOnly) {
            for (const attr of [...from.attributes]) {
                if (!to.hasAttribute(attr.name)) {
                    from.removeAttribute(attr.name);
                }
            }

            for (const attr of [...to.attributes]) {
                from.setAttribute(attr.name, attr.value);
            }
        }

        if (!skipChildren) {
            from.innerHTML = to.innerHTML;
        }

        if (options.updated) {
            options.updated(from, to);
        }
    }

    return { morph, calls };
}

describe('Alpine.morph integration', () => {
    let originalAlpine;

    beforeEach(() => {
        originalAlpine = window.Alpine;
    });

    afterEach(() => {
        window.Alpine = originalAlpine;
    });

    describe('patchElements with Alpine.morph', () => {
        it('uses Alpine.morph instead of replaceWith when available', () => {
            const { morph, calls } = createMockMorph();
            window.Alpine = { morph };

            const oldDoc = makeDoc('<div data-hmr-id="element:div">old</div>');
            const newDoc = makeDoc('<div data-hmr-id="element:div">new</div>');
            const liveDoc = makeDoc('<div data-hmr-id="element:div">old</div>');

            const liveEl = liveDoc.querySelector('[data-hmr-id]');
            const count = patchElements(oldDoc, newDoc, liveDoc, 25);

            expect(count).toBe(1);
            expect(calls.length).toBe(1);
            expect(liveEl.parentNode).not.toBeNull();
            expect(liveEl.textContent).toBe('new');
        });

        it('morphs in place when Alpine is not present', () => {
            window.Alpine = undefined;

            const oldDoc = makeDoc('<div data-hmr-id="element:div">old</div>');
            const newDoc = makeDoc('<div data-hmr-id="element:div">new</div>');
            const liveDoc = makeDoc('<div data-hmr-id="element:div">old</div>');

            const liveEl = liveDoc.querySelector('[data-hmr-id]');
            const count = patchElements(oldDoc, newDoc, liveDoc, 25);

            expect(count).toBe(1);
            expect(liveDoc.querySelector('[data-hmr-id]')).toBe(liveEl);
            expect(liveEl.textContent).toBe('new');
        });

        it('morphs in place when Alpine exists but morph is not loaded', () => {
            window.Alpine = { version: '3.x' };

            const oldDoc = makeDoc('<div data-hmr-id="element:div">old</div>');
            const newDoc = makeDoc('<div data-hmr-id="element:div">new</div>');
            const liveDoc = makeDoc('<div data-hmr-id="element:div">old</div>');

            const liveEl = liveDoc.querySelector('[data-hmr-id]');
            const count = patchElements(oldDoc, newDoc, liveDoc, 25);

            expect(count).toBe(1);
            expect(liveDoc.querySelector('[data-hmr-id]')).toBe(liveEl);
            expect(liveEl.textContent).toBe('new');
        });

        it('forces hard replace when Alpine.morph result mismatches target', () => {
            window.Alpine = {
                morph(from, to, options = {}) {
                    if (options.updating) options.updating(from, to, () => {}, () => {});
                    if (options.updated) options.updated(from, to);
                },
            };

            const oldDoc = makeDoc('<div data-hmr-id="element:div">old</div>');
            const newDoc = makeDoc('<div data-hmr-id="element:div">new</div>');
            const liveDoc = makeDoc('<div data-hmr-id="element:div">old</div>');

            const count = patchElements(oldDoc, newDoc, liveDoc, 25);

            expect(count).toBe(1);
            expect(liveDoc.querySelector('[data-hmr-id]').textContent).toBe('new');
        });
    });

    describe('patchCommentBoundary with Alpine.morph', () => {
        it('morphs single root element in boundary', () => {
            const { morph, calls } = createMockMorph();
            window.Alpine = { morph };

            const liveDoc = makeDoc(boundary('component:card', '<div class="card">old content</div>'));
            const nextDoc = makeDoc(boundary('component:card', '<div class="card">new content</div>'));

            const liveBoundaries = getBoundaries(liveDoc);
            const nextBoundaries = getBoundaries(nextDoc);

            const liveEl = liveDoc.querySelector('.card');
            patchCommentBoundary(liveBoundaries[0], nextBoundaries[0]);

            expect(calls.length).toBe(1);
            expect(liveEl.parentNode).not.toBeNull();
            expect(liveEl.textContent).toBe('new content');
        });

        it('forces boundary replacement when single-root morph diverges', () => {
            window.Alpine = {
                morph(from, to, options = {}) {
                    if (options.updating) options.updating(from, to, () => {}, () => {});
                    if (options.updated) options.updated(from, to);
                },
            };

            const liveDoc = makeDoc(boundary('component:card', '<div class="card">old content</div>'));
            const nextDoc = makeDoc(boundary('component:card', '<div class="card">new content</div>'));

            const liveBoundaries = getBoundaries(liveDoc);
            const nextBoundaries = getBoundaries(nextDoc);

            patchCommentBoundary(liveBoundaries[0], nextBoundaries[0]);

            expect(liveDoc.querySelector('.card').textContent).toBe('new content');
        });

        it('morphs single root element without Alpine installed', () => {
            window.Alpine = undefined;

            const liveDoc = makeDoc(boundary('component:card', '<div class="card">old content</div>'));
            const nextDoc = makeDoc(boundary('component:card', '<div class="card">new content</div>'));

            const liveBoundaries = getBoundaries(liveDoc);
            const nextBoundaries = getBoundaries(nextDoc);

            const liveEl = liveDoc.querySelector('.card');
            patchCommentBoundary(liveBoundaries[0], nextBoundaries[0]);

            expect(liveDoc.querySelector('.card')).toBe(liveEl);
            expect(liveEl.textContent).toBe('new content');
        });

        it('falls back to replacement for multi-element boundaries', () => {
            const { morph, calls } = createMockMorph();
            window.Alpine = { morph };

            const liveDoc = makeDoc(boundary('component:list', '<div>a</div><div>b</div>'));
            const nextDoc = makeDoc(boundary('component:list', '<div>x</div><div>y</div>'));

            const liveBoundaries = getBoundaries(liveDoc);
            const nextBoundaries = getBoundaries(nextDoc);

            patchCommentBoundary(liveBoundaries[0], nextBoundaries[0]);
            expect(calls.length).toBe(0);
            expect(Array.from(liveDoc.querySelectorAll('div')).map((el) => el.textContent)).toEqual(['x', 'y']);
        });

        it('falls back to replacement when boundary has non-whitespace text', () => {
            const { morph, calls } = createMockMorph();
            window.Alpine = { morph };

            const liveDoc = makeDoc(boundary('component:text', 'some text<div>a</div>'));
            const nextDoc = makeDoc(boundary('component:text', 'new text<div>b</div>'));

            const liveBoundaries = getBoundaries(liveDoc);
            const nextBoundaries = getBoundaries(nextDoc);

            patchCommentBoundary(liveBoundaries[0], nextBoundaries[0]);
            expect(calls.length).toBe(0);
        });

        it('avoids morphBetween when boundary contains nested comment markers', () => {
            const { morph, calls } = createMockMorph();
            const morphBetween = vi.fn();
            window.Alpine = { morph, morphBetween };

            const liveDoc = makeDoc(
                boundary('component:outer', '<!--bl:begin id="directive:if"--><span>old</span><!--bl:end id="directive:if"-->'),
            );
            const nextDoc = makeDoc(
                boundary('component:outer', '<!--bl:begin id="directive:if"--><span>new</span><!--bl:end id="directive:if"-->'),
            );

            const liveBoundaries = getBoundaries(liveDoc);
            const nextBoundaries = getBoundaries(nextDoc);

            patchCommentBoundary(liveBoundaries[0], nextBoundaries[0]);

            expect(morphBetween).not.toHaveBeenCalled();
            expect(liveDoc.body.textContent).not.toContain('bl:end id=');
            expect(liveDoc.querySelector('span').textContent).toBe('new');
        });
    });

    describe('Livewire state preservation', () => {
        it('preserves wire:snapshot during morph', () => {
            const { morph } = createMockMorph();
            window.Alpine = { morph };

            const liveDoc = makeDoc(
                '<div data-hmr-id="element:div" wire:id="abc" wire:snapshot=\'{"data":{"count":5}}\' wire:effects="[]">' +
                '<span>Count: 5</span></div>'
            );
            const newDoc = makeDoc(
                '<div data-hmr-id="element:div" wire:id="abc" wire:snapshot=\'{"data":{"count":0}}\' wire:effects="[]">' +
                '<span>Count: 0</span></div>'
            );

            const liveEl = liveDoc.querySelector('[wire\\:id]');
            liveEl.__livewire = { id: 'abc' };
            morphElement(liveEl, newDoc.querySelector('[wire\\:id]'));
            expect(liveEl.getAttribute('wire:snapshot')).toBe('{"data":{"count":5}}');
        });

        it('preserves wire:effects during morph', () => {
            const { morph } = createMockMorph();
            window.Alpine = { morph };

            const el = document.createElement('div');
            el.setAttribute('wire:id', 'abc');
            el.setAttribute('wire:snapshot', '{"old":"state"}');
            el.setAttribute('wire:effects', '{"old":"effects"}');
            el.__livewire = { id: 'abc' };

            const to = document.createElement('div');
            to.setAttribute('wire:id', 'abc');
            to.setAttribute('wire:snapshot', '{"new":"state"}');
            to.setAttribute('wire:effects', '{"new":"effects"}');

            morphElement(el, to);

            expect(el.getAttribute('wire:snapshot')).toBe('{"old":"state"}');
            expect(el.getAttribute('wire:effects')).toBe('{"old":"effects"}');
        });

        it('does not interfere with non-Livewire elements', () => {
            const { morph } = createMockMorph();
            window.Alpine = { morph };

            const el = document.createElement('div');
            el.setAttribute('data-hmr-id', 'element:div');
            el.textContent = 'old';

            const to = document.createElement('div');
            to.setAttribute('data-hmr-id', 'element:div');
            to.textContent = 'new';

            morphElement(el, to);

            expect(el.textContent).toBe('new');
        });

        it('keeps child content intact when Livewire marks children as ignored', () => {
            const { morph } = createMockMorph();
            window.Alpine = { morph };

            const el = document.createElement('div');
            el.setAttribute('wire:id', 'abc');
            el.setAttribute('data-state', 'old');
            el.innerHTML = '<span>keep me</span>';
            el.__livewire = { id: 'abc' };
            el.__livewire_ignore_children = true;

            const to = document.createElement('div');
            to.setAttribute('wire:id', 'abc');
            to.setAttribute('data-state', 'new');
            to.innerHTML = '<span>replace me</span>';

            morphElement(el, to);

            expect(el.getAttribute('data-state')).toBe('new');
            expect(el.innerHTML).toBe('<span>keep me</span>');
        });
    });

    describe('x-data merging during morph', () => {
        it('merges new x-data properties into reactive state', () => {
            const { morph } = createMockMorph();
            window.Alpine = { morph };

            const el = document.createElement('div');
            el.setAttribute('x-data', '{ count: 0 }');
            el._x_dataStack = [{ count: 5 }];

            const to = document.createElement('div');
            to.setAttribute('x-data', '{ count: 0, name: "" }');

            morphElement(el, to);

            expect(el._x_dataStack[0].count).toBe(5);
            expect(el._x_dataStack[0].name).toBe('');
        });

        it('does not merge when x-data has not changed', () => {
            const { morph } = createMockMorph();
            window.Alpine = { morph };

            const el = document.createElement('div');
            el.setAttribute('x-data', '{ count: 0 }');
            el._x_dataStack = [{ count: 5 }];

            const to = document.createElement('div');
            to.setAttribute('x-data', '{ count: 0 }');

            morphElement(el, to);

            expect(el._x_dataStack[0].count).toBe(5);
        });
    });

    describe('morph key resolution', () => {
        it('prefers wire:key over livewire root wire:id for element matching', () => {
            const { morph, calls } = createMockMorph();
            window.Alpine = { morph };

            const el = document.createElement('div');
            el.setAttribute('wire:id', 'component-1');
            el.setAttribute('wire:snapshot', '{}');
            el.setAttribute('wire:key', 'item-1');
            const to = document.createElement('div');
            to.setAttribute('wire:id', 'component-1');
            to.setAttribute('wire:snapshot', '{}');
            to.setAttribute('wire:key', 'item-1');

            morphElement(el, to);

            const keyFn = calls[0].options.key;
            expect(keyFn(el)).toBe('item-1');
        });

        it('falls back to wire:key, id, then non-livewire wire:id', () => {
            const { morph, calls } = createMockMorph();
            window.Alpine = { morph };

            const el = document.createElement('div');
            morphElement(el, document.createElement('div'));
            const keyFn = calls[0].options.key;

            const wireKeyEl = document.createElement('div');
            wireKeyEl.setAttribute('wire:key', 'item-1');
            expect(keyFn(wireKeyEl)).toBe('item-1');

            const idEl = document.createElement('div');
            idEl.id = 'my-el';
            expect(keyFn(idEl)).toBe('my-el');

            const livewireRootEl = document.createElement('div');
            livewireRootEl.setAttribute('wire:id', 'component-1');
            livewireRootEl.setAttribute('wire:snapshot', '{}');
            expect(keyFn(livewireRootEl)).toBeUndefined();

            const wireIdEl = document.createElement('div');
            wireIdEl.setAttribute('wire:id', 'abc');
            expect(keyFn(wireIdEl)).toBe('abc');

            const noKeyEl = document.createElement('div');
            expect(keyFn(noKeyEl)).toBeUndefined();
        });
    });
});
function getBoundaries(doc) {
    const boundaries = [];
    const stack = [];
    const walker = doc.createTreeWalker(doc.documentElement || doc, NodeFilter.SHOW_COMMENT);
    let comment;
    while ((comment = walker.nextNode())) {
        const text = comment.textContent.trim();
        const beginMatch = text.match(/^bl:begin\s+id="([^"]+)"(?:\s+file="([^"]*)")?/);
        if (beginMatch) {
            stack.push({ id: beginMatch[1], file: beginMatch[2] || null, beginComment: comment });
            continue;
        }
        const endMatch = text.match(/^bl:end\s+id="([^"]+)"/);
        if (endMatch) {
            for (let i = stack.length - 1; i >= 0; i--) {
                if (stack[i].id === endMatch[1]) {
                    const pair = stack.splice(i, 1)[0];
                    pair.endComment = comment;
                    boundaries.push(pair);
                    break;
                }
            }
        }
    }
    return boundaries;
}
