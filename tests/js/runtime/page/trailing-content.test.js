import { beforeEach, describe, expect, it } from 'vitest';
import { patchElements, patchTrailingContent, trailingContentAfterHtml } from '@runtime';

describe('patchTrailingContent', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div>base</div>';
        document.getElementById('reload-trailing-content')?.remove();
    });

    it('does not duplicate trailing content already parsed into body', () => {
        const html = '<!DOCTYPE html><html><body><div>base</div></body></html>\nasdf\n';
        const parsed = new DOMParser().parseFromString(html, 'text/html');
        const trailing = trailingContentAfterHtml(html);

        document.body.innerHTML = parsed.body.innerHTML;

        const count = patchTrailingContent(trailing, trailing);

        expect(count).toBe(0);
        expect(document.body.textContent.match(/asdf/g)).toHaveLength(1);
        expect(document.getElementById('reload-trailing-content')).toBeNull();
    });

    it('updates adopted trailing content in place', () => {
        const initialHtml = '<!DOCTYPE html><html><body><div>base</div></body></html>\nasdf\n';
        const parsed = new DOMParser().parseFromString(initialHtml, 'text/html');
        const previous = trailingContentAfterHtml(initialHtml);
        const next = '\nqwer\n';

        document.body.innerHTML = parsed.body.innerHTML;

        const count = patchTrailingContent(previous, next);

        expect(count).toBe(1);
        expect(document.body.textContent).toContain('qwer');
        expect(document.body.textContent).not.toContain('asdf');
        expect(document.getElementById('reload-trailing-content')).toBeNull();
    });

    it('removes adopted trailing content when server output clears it', () => {
        const html = '<!DOCTYPE html><html><body><div>base</div></body></html>\nasdf\n';
        const parsed = new DOMParser().parseFromString(html, 'text/html');
        const trailing = trailingContentAfterHtml(html);

        document.body.innerHTML = parsed.body.innerHTML;

        const count = patchTrailingContent(trailing, '');

        expect(count).toBe(1);
        expect(document.body.textContent).not.toContain('asdf');
        expect(document.getElementById('reload-trailing-content')).toBeNull();
    });

    it('collapses duplicate literal trailing text and transient container to a single copy', () => {
        document.body.innerHTML = '<div>base</div>\n1<div id="reload-trailing-content" data-reload-transient="1">1</div>';

        const count = patchTrailingContent('\n1', '\n1');

        expect(count).toBe(1);
        expect(document.getElementById('reload-trailing-content')).toBeNull();
        expect(document.body.textContent.match(/1/g)).toHaveLength(1);
    });

    it('does not duplicate when body patch and trailing patch run in the same cycle', () => {
        const oldHtml = '<!DOCTYPE html><html><body data-hmr-id="element:body"><div>base</div></body></html>';
        const newHtml = '<!DOCTYPE html><html><body data-hmr-id="element:body"><div>base</div></body></html>\n1';

        const oldDoc = new DOMParser().parseFromString(oldHtml, 'text/html');
        const newDoc = new DOMParser().parseFromString(newHtml, 'text/html');
        document.documentElement.innerHTML = oldDoc.documentElement.innerHTML;

        expect(patchElements(oldDoc, newDoc, document, 25)).toBe(1);
        expect(document.body.textContent.match(/1/g)).toHaveLength(1);

        expect(patchTrailingContent('', trailingContentAfterHtml(newHtml))).toBe(0);
        expect(document.body.textContent.match(/1/g)).toHaveLength(1);
        expect(document.getElementById('reload-trailing-content')).toBeNull();
    });
});
