import { describe, it, expect } from 'vitest';
import { normalizePath, pathMatchesChangedFiles } from '@runtime';

describe('path matching helpers', () => {
    it('normalizes slashes and casing', () => {
        expect(normalizePath('C:\\Project\\Resources\\Views\\Home.blade.php'))
            .toBe('c:/project/resources/views/home.blade.php');
    });

    it('matches exact and suffix paths', () => {
        expect(pathMatchesChangedFiles(
            '/var/www/project/resources/views/home.blade.php',
            ['resources/views/home.blade.php'],
        )).toBe(true);

        expect(pathMatchesChangedFiles(
            'resources/views/admin/dashboard.blade.php',
            ['/var/www/project/resources/views/admin/dashboard.blade.php'],
        )).toBe(true);
    });

    it('returns false for unrelated paths', () => {
        expect(pathMatchesChangedFiles(
            'resources/views/a.blade.php',
            ['resources/views/b.blade.php'],
        )).toBe(false);
    });
});
