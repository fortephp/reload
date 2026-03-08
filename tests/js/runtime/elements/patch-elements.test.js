import { describe, it, expect } from 'vitest';
import { applyElementPatchesDetailed, collectElementPatches, patchElements } from '@runtime';
import { makeDoc } from '@test-helpers/dom.js';

describe('patchElements', () => {
    it('patches a changed element in the live DOM', () => {
        const oldDoc = makeDoc('<div data-hmr-id="element:div">old</div>');
        const newDoc = makeDoc('<div data-hmr-id="element:div">new</div>');
        const liveDoc = makeDoc('<div data-hmr-id="element:div">old</div>');

        const count = patchElements(oldDoc, newDoc, liveDoc, 25);
        expect(count).toBe(1);
        expect(liveDoc.querySelector('[data-hmr-id]').textContent).toBe('new');
    });

    it('returns 0 when nothing changed', () => {
        const oldDoc = makeDoc('<div data-hmr-id="element:div">same</div>');
        const newDoc = makeDoc('<div data-hmr-id="element:div">same</div>');
        const liveDoc = makeDoc('<div data-hmr-id="element:div">same</div>');

        expect(patchElements(oldDoc, newDoc, liveDoc, 25)).toBe(0);
    });

    it('ignores hidden input differences', () => {
        const oldDoc = makeDoc('<form data-hmr-id="element:form"><input type="hidden" name="_token" value="abc"><span>text</span></form>');
        const newDoc = makeDoc('<form data-hmr-id="element:form"><input type="hidden" name="_token" value="xyz"><span>text</span></form>');
        const liveDoc = makeDoc('<form data-hmr-id="element:form"><input type="hidden" name="_token" value="abc"><span>text</span></form>');

        expect(patchElements(oldDoc, newDoc, liveDoc, 25)).toBe(0);
    });

    it('respects maxPatches limit', () => {
        const items = (text) => Array.from({ length: 10 }, (_, i) =>
            `<li data-hmr-id="element:li">${text} ${i}</li>`
        ).join('');
        const oldDoc = makeDoc(`<ul>${items('old')}</ul>`);
        const newDoc = makeDoc(`<ul>${items('new')}</ul>`);
        const liveDoc = makeDoc(`<ul>${items('old')}</ul>`);

        const count = patchElements(oldDoc, newDoc, liveDoc, 3);
        expect(count).toBe(3);
    });

    it('patches leaf element not ancestor when no structural change', () => {
        const oldDoc = makeDoc(`
            <div data-hmr-id="element:div">
                <span data-hmr-id="element:span">old text</span>
            </div>
        `);
        const newDoc = makeDoc(`
            <div data-hmr-id="element:div">
                <span data-hmr-id="element:span">new text</span>
            </div>
        `);
        const liveDoc = makeDoc(`
            <div data-hmr-id="element:div">
                <span data-hmr-id="element:span">old text</span>
            </div>
        `);

        const count = patchElements(oldDoc, newDoc, liveDoc, 25);
        expect(count).toBe(1);
        expect(liveDoc.querySelector('span[data-hmr-id]').textContent).toBe('new text');
    });

    it('patches ancestor when structural change detected', () => {
        const oldDoc = makeDoc(`
            <div data-hmr-id="element:div">
                <span data-hmr-id="element:span">a</span>
            </div>
        `);
        const newDoc = makeDoc(`
            <div data-hmr-id="element:div">
                <span data-hmr-id="element:span">a</span>
                <p data-hmr-id="element:p">added</p>
            </div>
        `);
        const liveDoc = makeDoc(`
            <div data-hmr-id="element:div">
                <span data-hmr-id="element:span">a</span>
            </div>
        `);

        const count = patchElements(oldDoc, newDoc, liveDoc, 25);
        expect(count).toBe(1);
        expect(liveDoc.querySelector('p[data-hmr-id]')).not.toBeNull();
        expect(liveDoc.querySelector('p[data-hmr-id]').textContent).toBe('added');
    });

    it('patches ancestor when direct text changes between instrumented children', () => {
        const oldDoc = makeDoc(`
            <form data-hmr-id="element:form">
                <div data-hmr-id="element:div">old child</div>
                asdf
                <button data-hmr-id="element:button">Submit</button>
            </form>
        `);
        const newDoc = makeDoc(`
            <form data-hmr-id="element:form">
                <div data-hmr-id="element:div">new child</div>
                <button data-hmr-id="element:button">Submit</button>
            </form>
        `);
        const liveDoc = makeDoc(`
            <form data-hmr-id="element:form">
                <div data-hmr-id="element:div">old child</div>
                asdf
                <button data-hmr-id="element:button">Submit</button>
            </form>
        `);

        const count = patchElements(oldDoc, newDoc, liveDoc, 25);
        expect(count).toBe(1);
        expect(liveDoc.querySelector('form').textContent).not.toContain('asdf');
        expect(liveDoc.querySelector('[data-hmr-id="element:div"]').textContent).toContain('new child');
    });

    it('patches data-attribute changes on instrumented elements', () => {
        const oldDoc = makeDoc('<button data-hmr-id="element:button" data-test="login" data-mode="default">Login</button>');
        const newDoc = makeDoc('<button data-hmr-id="element:button" data-test="login-primary" data-mode="ready">Login</button>');
        const liveDoc = makeDoc('<button data-hmr-id="element:button" data-test="login" data-mode="default">Login</button>');

        const count = patchElements(oldDoc, newDoc, liveDoc, 25);
        expect(count).toBe(1);

        const button = liveDoc.querySelector('[data-hmr-id="element:button"]');
        expect(button.getAttribute('data-test')).toBe('login-primary');
        expect(button.getAttribute('data-mode')).toBe('ready');
    });

    it('patches body children without clobbering runtime body attributes', () => {
        const oldDoc = makeDoc('<body data-hmr-id="element:body"><main>Old</main></body>');
        const newDoc = makeDoc('<body data-hmr-id="element:body"><main>New</main><p>Extra</p></body>');
        const liveDoc = makeDoc('<body data-hmr-id="element:body" class="runtime-dark" data-runtime-bg="black"><main>Old</main></body>');

        const count = patchElements(oldDoc, newDoc, liveDoc, 25);
        expect(count).toBe(1);

        const body = liveDoc.body;
        expect(body.getAttribute('class')).toBe('runtime-dark');
        expect(body.getAttribute('data-runtime-bg')).toBe('black');
        expect(body.textContent).toContain('New');
        expect(body.textContent).toContain('Extra');
    });

    it('handles cross-branch keys correctly', () => {
        const oldDoc = makeDoc(`
            <div data-hmr-id="element:div">
                <span data-hmr-id="element:span">left old</span>
            </div>
            <section data-hmr-id="element:section">
                <span data-hmr-id="element:span">right</span>
            </section>
        `);
        const newDoc = makeDoc(`
            <div data-hmr-id="element:div">
                <span data-hmr-id="element:span">left new</span>
            </div>
            <section data-hmr-id="element:section">
                <span data-hmr-id="element:span">right</span>
            </section>
        `);
        const liveDoc = makeDoc(`
            <div data-hmr-id="element:div">
                <span data-hmr-id="element:span">left old</span>
            </div>
            <section data-hmr-id="element:section">
                <span data-hmr-id="element:span">right</span>
            </section>
        `);

        const count = patchElements(oldDoc, newDoc, liveDoc, 25);
        expect(count).toBe(1);
        const spans = liveDoc.querySelectorAll('span[data-hmr-id]');
        expect(spans[0].textContent).toBe('left new');
        expect(spans[1].textContent).toBe('right');
    });

    it('returns 0 when oldDoc has no instrumented elements', () => {
        const oldDoc = makeDoc('<div>no ids</div>');
        const newDoc = makeDoc('<div data-hmr-id="element:div">new</div>');
        const liveDoc = makeDoc('<div data-hmr-id="element:div">live</div>');
        expect(patchElements(oldDoc, newDoc, liveDoc, 25)).toBe(0);
    });

    it('returns 0 when newDoc has no instrumented elements', () => {
        const oldDoc = makeDoc('<div data-hmr-id="element:div">old</div>');
        const newDoc = makeDoc('<div>no ids</div>');
        const liveDoc = makeDoc('<div data-hmr-id="element:div">live</div>');
        expect(patchElements(oldDoc, newDoc, liveDoc, 25)).toBe(0);
    });

    it('patches only elements matching changed file filter', () => {
        const oldDoc = makeDoc(
            '<div data-hmr-id="element:a" data-hmr-file="resources/views/a.blade.php">old A</div>' +
            '<div data-hmr-id="element:b" data-hmr-file="resources/views/b.blade.php">old B</div>',
        );
        const newDoc = makeDoc(
            '<div data-hmr-id="element:a" data-hmr-file="resources/views/a.blade.php">new A</div>' +
            '<div data-hmr-id="element:b" data-hmr-file="resources/views/b.blade.php">new B</div>',
        );
        const liveDoc = makeDoc(
            '<div data-hmr-id="element:a" data-hmr-file="resources/views/a.blade.php">old A</div>' +
            '<div data-hmr-id="element:b" data-hmr-file="resources/views/b.blade.php">old B</div>',
        );

        const count = patchElements(oldDoc, newDoc, liveDoc, 25, {
            changedFiles: ['resources/views/a.blade.php'],
        });

        expect(count).toBe(1);
        expect(liveDoc.querySelector('[data-hmr-id="element:a"]').textContent).toBe('new A');
        expect(liveDoc.querySelector('[data-hmr-id="element:b"]').textContent).toBe('old B');
    });

    it('patches keyed sibling reorders at the parent boundary', () => {
        const oldDoc = makeDoc(`
            <ul data-hmr-id="element:list">
                <li data-hmr-id="element:item" wire:key="a">Alpha</li>
                <li data-hmr-id="element:item" wire:key="b">Beta</li>
            </ul>
        `);
        const newDoc = makeDoc(`
            <ul data-hmr-id="element:list">
                <li data-hmr-id="element:item" wire:key="b">Beta</li>
                <li data-hmr-id="element:item" wire:key="a">Alpha</li>
            </ul>
        `);
        const liveDoc = makeDoc(`
            <ul data-hmr-id="element:list">
                <li data-hmr-id="element:item" wire:key="a">Alpha</li>
                <li data-hmr-id="element:item" wire:key="b">Beta</li>
            </ul>
        `);

        const count = patchElements(oldDoc, newDoc, liveDoc, 25);

        expect(count).toBe(1);
        expect(Array.from(liveDoc.querySelectorAll('li')).map((el) => el.getAttribute('wire:key'))).toEqual(['b', 'a']);
    });

    it('reports reload requirement instead of replacing nested permanent descendants', () => {
        const oldDoc = makeDoc(`
            <section data-hmr-id="element:section">
                <div data-hmr-permanent data-test="permanent">Keep me</div>
                <p>Old copy</p>
            </section>
        `);
        const newDoc = makeDoc(`
            <section data-hmr-id="element:section">
                <div data-hmr-permanent data-test="permanent">Keep me</div>
                <p>New copy</p>
            </section>
        `);
        const liveDoc = makeDoc(`
            <section data-hmr-id="element:section">
                <div data-hmr-permanent data-test="permanent">Keep me</div>
                <p>Old copy</p>
            </section>
        `);

        const toPatch = collectElementPatches(oldDoc, newDoc, liveDoc);
        const result = applyElementPatchesDetailed(toPatch, 25);

        expect(result.patchCount).toBe(0);
        expect(result.skipped).toBe(1);
        expect(result.requiresReload).toBe(true);
        expect(liveDoc.querySelector('[data-test="permanent"]').textContent).toBe('Keep me');
        expect(liveDoc.querySelector('p').textContent).toBe('Old copy');
    });

    it('patches raw-text containers like textarea, pre, and style', () => {
        const oldDoc = makeDoc(`
            <div data-hmr-id="element:container">
                <textarea data-hmr-id="element:textarea">old body</textarea>
                <pre data-hmr-id="element:pre">old line
  detail</pre>
                <style data-hmr-id="element:style">.note::before { content: "old"; color: red; }</style>
            </div>
        `);
        const newDoc = makeDoc(`
            <div data-hmr-id="element:container">
                <textarea data-hmr-id="element:textarea">new body</textarea>
                <pre data-hmr-id="element:pre">new line
  detail</pre>
                <style data-hmr-id="element:style">.note::before { content: "new"; color: blue; }</style>
            </div>
        `);
        const liveDoc = makeDoc(`
            <div data-hmr-id="element:container">
                <textarea data-hmr-id="element:textarea">old body</textarea>
                <pre data-hmr-id="element:pre">old line
  detail</pre>
                <style data-hmr-id="element:style">.note::before { content: "old"; color: red; }</style>
            </div>
        `);

        const count = patchElements(oldDoc, newDoc, liveDoc, 25);

        expect(count).toBe(3);
        expect(liveDoc.querySelector('textarea').value).toBe('new body');
        expect(liveDoc.querySelector('pre').textContent).toBe('new line\n  detail');
        expect(liveDoc.querySelector('style').textContent).toContain('content: "new"');
        expect(liveDoc.querySelector('style').textContent).toContain('color: blue');
    });

    it('reports reload requirement instead of patching changed script elements', () => {
        const oldDoc = makeDoc(`
            <section data-hmr-id="element:section">
                <script data-hmr-id="element:script">window.__hmrScript = "old";</script>
            </section>
        `);
        const newDoc = makeDoc(`
            <section data-hmr-id="element:section">
                <script data-hmr-id="element:script">window.__hmrScript = "new";</script>
            </section>
        `);
        const liveDoc = makeDoc(`
            <section data-hmr-id="element:section">
                <script data-hmr-id="element:script">window.__hmrScript = "old";</script>
            </section>
        `);

        const toPatch = collectElementPatches(oldDoc, newDoc, liveDoc);
        const result = applyElementPatchesDetailed(toPatch, 25);

        expect(result.patchCount).toBe(0);
        expect(result.skipped).toBe(1);
        expect(result.requiresReload).toBe(true);
        expect(liveDoc.querySelector('script').textContent).toContain('"old"');
    });

    it('throws when failOnLimit is enabled and planned patches exceed limit', () => {
        const oldDoc = makeDoc(
            '<div data-hmr-id="element:a">old A</div>' +
            '<div data-hmr-id="element:b">old B</div>' +
            '<div data-hmr-id="element:c">old C</div>',
        );
        const newDoc = makeDoc(
            '<div data-hmr-id="element:a">new A</div>' +
            '<div data-hmr-id="element:b">new B</div>' +
            '<div data-hmr-id="element:c">new C</div>',
        );
        const liveDoc = makeDoc(
            '<div data-hmr-id="element:a">old A</div>' +
            '<div data-hmr-id="element:b">old B</div>' +
            '<div data-hmr-id="element:c">old C</div>',
        );

        expect(() => patchElements(oldDoc, newDoc, liveDoc, 2, {
            failOnLimit: true,
        })).toThrow(/patch limit exceeded/i);
    });
});
