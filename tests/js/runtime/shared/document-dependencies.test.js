import { describe, it, expect } from 'vitest';
import {
    collectDocumentDependencyFiles,
    documentMayMatchChangedFiles,
} from '@runtime';
import { makeDoc, boundary } from '@test-helpers/dom.js';

describe('document dependency helpers', () => {
    it('collects blade dependency files from element attributes and directive markers', () => {
        const doc = makeDoc(
            `<section data-hmr-id="element:section" data-hmr-file="resources/views/pages/auth/login.blade.php">` +
            '<h1>Login</h1>' +
            '</section>' +
            boundary(
                'component:auth-card',
                '<div>Card</div>',
                'resources/views/components/auth/card.blade.php',
            ),
        );

        expect(collectDocumentDependencyFiles(doc)).toEqual([
            'resources/views/pages/auth/login.blade.php',
            'resources/views/components/auth/card.blade.php',
        ]);
    });

    it('matches changed files when the current page depends on them', () => {
        const doc = makeDoc(
            '<div data-hmr-id="element:div" data-hmr-file="resources/views/pages/auth/login.blade.php">Login</div>',
        );

        expect(documentMayMatchChangedFiles(doc, ['resources/views/pages/auth/login.blade.php'])).toBe(true);
    });

    it('rejects unrelated changed files when the page has dependency metadata', () => {
        const doc = makeDoc(
            '<div data-hmr-id="element:div" data-hmr-file="resources/views/pages/auth/login.blade.php">Login</div>',
        );

        expect(documentMayMatchChangedFiles(doc, ['resources/views/pages/dashboard.blade.php'])).toBe(false);
    });

    it('stays permissive when a page has no dependency metadata yet', () => {
        const doc = makeDoc('<div>No instrumentation yet</div>');

        expect(documentMayMatchChangedFiles(doc, ['resources/views/pages/dashboard.blade.php'])).toBe(true);
    });
});
