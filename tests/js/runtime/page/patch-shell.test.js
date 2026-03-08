import { describe, it, expect } from 'vitest';
import { patchShell } from '@runtime';

function resetShellAttributes() {
    for (const attr of [...document.documentElement.attributes]) {
        document.documentElement.removeAttribute(attr.name);
    }

    for (const attr of [...document.body.attributes]) {
        document.body.removeAttribute(attr.name);
    }
}

describe('patchShell', () => {
    it('updates html attributes and removes stale ones', () => {
        resetShellAttributes();
        const oldDoc = new DOMParser().parseFromString(
            '<!doctype html><html lang="en" data-theme="old"><head></head><body></body></html>',
            'text/html',
        );
        const newDoc = new DOMParser().parseFromString(
            '<!doctype html><html lang="fr" data-shell="ready"><head></head><body></body></html>',
            'text/html',
        );

        document.documentElement.setAttribute('lang', 'en');
        document.documentElement.setAttribute('data-theme', 'old');

        const count = patchShell(oldDoc, newDoc);
        expect(count).toBe(1);
        expect(document.documentElement.getAttribute('lang')).toBe('fr');
        expect(document.documentElement.getAttribute('data-shell')).toBe('ready');
        expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    });

    it('updates body attributes and removes stale ones', () => {
        resetShellAttributes();
        const oldDoc = new DOMParser().parseFromString(
            '<!doctype html><html><head></head><body class="page old" data-state="old"></body></html>',
            'text/html',
        );
        const newDoc = new DOMParser().parseFromString(
            '<!doctype html><html><head></head><body class="page ready" data-mode="live"></body></html>',
            'text/html',
        );

        document.body.setAttribute('class', 'page old');
        document.body.setAttribute('data-state', 'old');

        const count = patchShell(oldDoc, newDoc);
        expect(count).toBeGreaterThan(0);
        expect(document.body.getAttribute('class')).toBe('page ready');
        expect(document.body.getAttribute('data-mode')).toBe('live');
        expect(document.body.hasAttribute('data-state')).toBe(false);
    });

    it('returns 0 when shell attributes are unchanged', () => {
        resetShellAttributes();
        const oldDoc = new DOMParser().parseFromString(
            '<!doctype html><html lang="en"><head></head><body class="page"></body></html>',
            'text/html',
        );
        const newDoc = new DOMParser().parseFromString(
            '<!doctype html><html lang="en"><head></head><body class="page"></body></html>',
            'text/html',
        );

        document.documentElement.setAttribute('lang', 'en');
        document.body.setAttribute('class', 'page');

        expect(patchShell(oldDoc, newDoc)).toBe(0);
    });

    it('preserves live runtime-only shell attributes when server attrs are unchanged', () => {
        resetShellAttributes();
        const oldDoc = new DOMParser().parseFromString(
            '<!doctype html><html lang="en"><head></head><body></body></html>',
            'text/html',
        );
        const newDoc = new DOMParser().parseFromString(
            '<!doctype html><html lang="en"><head></head><body></body></html>',
            'text/html',
        );

        document.documentElement.setAttribute('lang', 'en');
        document.documentElement.setAttribute('class', 'theme-dark runtime');
        document.body.setAttribute('style', 'background: black;');

        expect(patchShell(oldDoc, newDoc)).toBe(0);
        expect(document.documentElement.getAttribute('class')).toBe('theme-dark runtime');
        expect(document.body.getAttribute('style')).toBe('background: black;');
    });
});
