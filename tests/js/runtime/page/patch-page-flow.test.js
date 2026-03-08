import { describe, it, expect } from 'vitest';
import {
    captureState,
    patchElements,
    patchDirectives,
    patchHead,
    indexCommentBoundaries,
    boundaryContent,
    restoreState,
} from '@runtime';
import { makeDoc, boundary } from '@test-helpers/dom.js';

function simulatePatch(oldDoc, newDoc, liveDoc, maxPatches = 25) {
    let count = 0;
    count += patchElements(oldDoc, newDoc, liveDoc, maxPatches);
    count += patchDirectives(oldDoc, newDoc, liveDoc, maxPatches - count);
    return count;
}

describe('patch page flow', () => {
    it('patches element change inside a component boundary', () => {
        const html = (text) => boundary('component:widget',
            `<div data-hmr-id="element:div">${text}</div><p>static content</p>`);

        const oldDoc = makeDoc(html('old'));
        const newDoc = makeDoc(html('new'));
        const liveDoc = makeDoc(html('old'));

        const count = simulatePatch(oldDoc, newDoc, liveDoc);
        expect(count).toBe(1);
        expect(liveDoc.querySelector('[data-hmr-id]').textContent).toBe('new');
        expect(liveDoc.querySelector('p').textContent).toBe('static content');
    });

    it('patches directive boundary when change is outside elements', () => {
        const html = (text) => boundary('component:widget',
            `<p>${text}</p>`);

        const oldDoc = makeDoc(html('old text'));
        const newDoc = makeDoc(html('new text'));
        const liveDoc = makeDoc(html('old text'));

        const count = simulatePatch(oldDoc, newDoc, liveDoc);
        expect(count).toBe(1);

        const liveBoundary = indexCommentBoundaries(liveDoc)[0];
        expect(boundaryContent(liveBoundary)).toContain('new text');
    });

    it('handles nested component boundaries â€” patches deepest', () => {
        const inner = (text) => boundary('component:inner', `<span>${text}</span>`);
        const outer = (text) => boundary('component:outer', `<div>${inner(text)}</div>`);

        const oldDoc = makeDoc(outer('old'));
        const newDoc = makeDoc(outer('new'));
        const liveDoc = makeDoc(outer('old'));

        const count = simulatePatch(oldDoc, newDoc, liveDoc);
        expect(count).toBe(1);

        const liveBoundaries = indexCommentBoundaries(liveDoc);
        const liveInner = liveBoundaries.find(b => b.id === 'component:inner');
        expect(boundaryContent(liveInner)).toContain('new');
    });

    it('returns 0 when nothing changed', () => {
        const html = boundary('component:widget',
            '<div data-hmr-id="element:div">same</div>');

        const oldDoc = makeDoc(html);
        const newDoc = makeDoc(html);
        const liveDoc = makeDoc(html);

        expect(simulatePatch(oldDoc, newDoc, liveDoc)).toBe(0);
    });

    it('handles mixed element and directive changes', () => {
        const html = (elText, dirText) =>
            boundary('component:a', `<div data-hmr-id="element:div">${elText}</div>`) +
            boundary('component:b', `<p>${dirText}</p>`);

        const oldDoc = makeDoc(html('old el', 'old dir'));
        const newDoc = makeDoc(html('new el', 'new dir'));
        const liveDoc = makeDoc(html('old el', 'old dir'));

        const count = simulatePatch(oldDoc, newDoc, liveDoc);
        expect(count).toBe(2);
        expect(liveDoc.querySelector('[data-hmr-id]').textContent).toBe('new el');
    });

    it('does not over-patch when element change is inside a directive', () => {
        const html = (text) => boundary('component:form',
            `<form data-hmr-id="element:form">` +
            `<div data-hmr-id="element:div">${text}</div>` +
            `<button data-hmr-id="element:button">Submit</button>` +
            `</form>`);

        const oldDoc = makeDoc(html('old'));
        const newDoc = makeDoc(html('new'));
        const liveDoc = makeDoc(html('old'));

        const count = simulatePatch(oldDoc, newDoc, liveDoc);
        expect(count).toBe(1);
        expect(liveDoc.querySelector('div[data-hmr-id]').textContent).toBe('new');
    });

    it('patches structural change when element is added', () => {
        const oldDoc = makeDoc(`
            <div data-hmr-id="element:div">
                <span data-hmr-id="element:span">existing</span>
            </div>
        `);
        const newDoc = makeDoc(`
            <div data-hmr-id="element:div">
                <span data-hmr-id="element:span">existing</span>
                <p data-hmr-id="element:p">new element</p>
            </div>
        `);
        const liveDoc = makeDoc(`
            <div data-hmr-id="element:div">
                <span data-hmr-id="element:span">existing</span>
            </div>
        `);

        const count = simulatePatch(oldDoc, newDoc, liveDoc);
        expect(count).toBe(1);
        expect(liveDoc.querySelector('p[data-hmr-id]')).not.toBeNull();
    });

    it('patches form when raw text is removed between instrumented children', () => {
        const html = (text, child) => boundary('component:form',
            `<form data-hmr-id="element:form">` +
            `<div data-hmr-id="element:div">${child}</div>` +
            `${text}` +
            `<button data-hmr-id="element:button">Submit</button>` +
            `</form>`);

        const oldDoc = makeDoc(html(' asdf ', 'old'));
        const newDoc = makeDoc(html('', 'new'));
        const liveDoc = makeDoc(html(' asdf ', 'old'));

        const count = simulatePatch(oldDoc, newDoc, liveDoc);
        expect(count).toBe(1);
        expect(liveDoc.querySelector('form').textContent).not.toContain('asdf');
        expect(liveDoc.querySelector('[data-hmr-id="element:div"]').textContent).toBe('new');
    });

    it('preserves implicit checkbox state across repeated mixed patch cycles', () => {
        const html = (title, note, extra = '') => boundary('component:panel',
            `<section data-hmr-id="element:section">` +
            `<h2 data-hmr-id="element:h2">${title}</h2>` +
            `<label data-hmr-id="element:label">` +
            `<input type="checkbox" name="remember"> Remember` +
            `</label>` +
            `<input data-hmr-id="element:input" type="text" name="note" value="${note}">` +
            `${extra}` +
            `</section>`);

        const oldHtml = html('Alpha', 'server-a');
        const newHtml = html('Beta', 'server-b', '<p data-hmr-id="element:p">Extra copy</p>');
        const newerHtml = html('Gamma', 'server-c');
        document.body.innerHTML = makeDoc(oldHtml).body.innerHTML;
        const liveDoc = document;

        const remember = liveDoc.querySelector('input[name="remember"]');
        const note = liveDoc.querySelector('input[name="note"]');
        remember.checked = true;
        note.value = 'client note';

        const firstSnapshot = captureState();
        const firstCount = simulatePatch(makeDoc(oldHtml), makeDoc(newHtml), liveDoc);
        expect(firstCount).toBeGreaterThan(0);
        restoreState(firstSnapshot);

        expect(liveDoc.querySelector('h2').textContent).toBe('Beta');
        expect(liveDoc.querySelector('input[name="remember"]').checked).toBe(true);
        expect(liveDoc.querySelector('input[name="note"]').value).toBe('client note');
        expect(liveDoc.querySelector('p').textContent).toBe('Extra copy');

        const secondSnapshot = captureState();
        const secondCount = simulatePatch(makeDoc(newHtml), makeDoc(newerHtml), liveDoc);
        expect(secondCount).toBeGreaterThan(0);
        restoreState(secondSnapshot);

        expect(liveDoc.querySelector('h2').textContent).toBe('Gamma');
        expect(liveDoc.querySelector('input[name="remember"]').checked).toBe(true);
        expect(liveDoc.querySelector('input[name="note"]').value).toBe('client note');
        expect(liveDoc.querySelector('p')).toBeNull();
    });
});
