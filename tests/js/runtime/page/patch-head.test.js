import { describe, it, expect, beforeEach } from 'vitest';
import { patchHead, patchHeadDetailed } from '@runtime';

describe('patchHead', () => {
    beforeEach(() => {
        document.head.innerHTML = '';
        document.title = '';
    });

    it('updates document title when it changed', () => {
        document.title = 'Old Title';
        const newDoc = new DOMParser().parseFromString(
            '<!DOCTYPE html><html><head><title>New Title</title></head><body></body></html>',
            'text/html',
        );

        const count = patchHead(newDoc);
        expect(count).toBe(1);
        expect(document.title).toBe('New Title');
    });

    it('returns 0 when title unchanged', () => {
        document.title = 'Same Title';
        const newDoc = new DOMParser().parseFromString(
            '<!DOCTYPE html><html><head><title>Same Title</title></head><body></body></html>',
            'text/html',
        );

        expect(patchHead(newDoc)).toBe(0);
    });

    it('handles missing title in new doc', () => {
        document.title = 'Existing';
        const newDoc = new DOMParser().parseFromString(
            '<!DOCTYPE html><html><head></head><body></body></html>',
            'text/html',
        );

        expect(patchHead(newDoc)).toBe(1);
        expect(document.title).toBe('');
    });

    it('updates existing meta tag content by name', () => {
        document.head.innerHTML = '<meta name="description" content="old">';

        const newDoc = new DOMParser().parseFromString(
            '<!DOCTYPE html><html><head><meta name="description" content="new"></head><body></body></html>',
            'text/html',
        );

        const count = patchHead(newDoc);
        expect(count).toBe(1);
        expect(document.head.querySelector('meta[name="description"]').getAttribute('content')).toBe('new');
    });

    it('appends missing property meta tags', () => {
        document.head.innerHTML = '';

        const newDoc = new DOMParser().parseFromString(
            '<!DOCTYPE html><html><head><meta property="og:title" content="Blade HMR"></head><body></body></html>',
            'text/html',
        );

        const count = patchHead(newDoc);
        expect(count).toBe(1);
        expect(document.head.querySelector('meta[property="og:title"]')).not.toBeNull();
    });

    it('removes stale managed meta tags', () => {
        document.head.innerHTML = '<meta name="description" content="old"><meta property="og:title" content="old">';

        const newDoc = new DOMParser().parseFromString(
            '<!DOCTYPE html><html><head><meta name="description" content="old"></head><body></body></html>',
            'text/html',
        );

        const count = patchHead(newDoc);
        expect(count).toBe(1);
        expect(document.head.querySelector('meta[name="description"]')).not.toBeNull();
        expect(document.head.querySelector('meta[property="og:title"]')).toBeNull();
    });

    it('flags unsupported head changes for reload', () => {
        const oldDoc = new DOMParser().parseFromString(
            '<!DOCTYPE html><html><head><link rel="canonical" href="/old"></head><body></body></html>',
            'text/html',
        );
        const newDoc = new DOMParser().parseFromString(
            '<!DOCTYPE html><html><head><link rel="canonical" href="/new"></head><body></body></html>',
            'text/html',
        );

        const result = patchHeadDetailed(oldDoc, newDoc);

        expect(result.patchCount).toBe(0);
        expect(result.requiresReload).toBe(true);
    });

    it('flags inline style changes in head for reload', () => {
        const oldDoc = new DOMParser().parseFromString(
            '<!DOCTYPE html><html><head><style>.banner { color: red; }</style></head><body></body></html>',
            'text/html',
        );
        const newDoc = new DOMParser().parseFromString(
            '<!DOCTYPE html><html><head><style>.banner { color: blue; }</style></head><body></body></html>',
            'text/html',
        );

        const result = patchHeadDetailed(oldDoc, newDoc);

        expect(result.patchCount).toBe(0);
        expect(result.requiresReload).toBe(true);
    });

    it('flags script changes in head for reload', () => {
        const oldDoc = new DOMParser().parseFromString(
            '<!DOCTYPE html><html><head><script>window.__hmrHeadScript = "old";</script></head><body></body></html>',
            'text/html',
        );
        const newDoc = new DOMParser().parseFromString(
            '<!DOCTYPE html><html><head><script>window.__hmrHeadScript = "new";</script></head><body></body></html>',
            'text/html',
        );

        const result = patchHeadDetailed(oldDoc, newDoc);

        expect(result.patchCount).toBe(0);
        expect(result.requiresReload).toBe(true);
    });

    it('ignores livewire progress styles when checking unsupported head changes', () => {
        const livewireProgressStyle = '<style>#nprogress { pointer-events: none; }:root {--livewire-progress-bar-color: #2299dd;}</style>';
        const oldDoc = new DOMParser().parseFromString(
            `<!DOCTYPE html><html><head>${livewireProgressStyle}</head><body></body></html>`,
            'text/html',
        );
        const newDoc = new DOMParser().parseFromString(
            '<!DOCTYPE html><html><head></head><body></body></html>',
            'text/html',
        );

        const result = patchHeadDetailed(oldDoc, newDoc);

        expect(result.patchCount).toBe(0);
        expect(result.requiresReload).toBe(false);
    });
});
