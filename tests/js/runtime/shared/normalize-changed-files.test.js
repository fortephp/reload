import { describe, it, expect } from 'vitest';
import { normalizeChangedFiles } from '@runtime';

describe('normalizeChangedFiles', () => {
    it('returns null for empty input', () => {
        expect(normalizeChangedFiles(null)).toBeNull();
        expect(normalizeChangedFiles(undefined)).toBeNull();
        expect(normalizeChangedFiles('')).toBeNull();
        expect(normalizeChangedFiles([])).toBeNull();
    });

    it('normalizes single file string to array', () => {
        expect(normalizeChangedFiles('resources/views/welcome.blade.php'))
            .toEqual(['resources/views/welcome.blade.php']);
    });

    it('filters empty values from arrays', () => {
        expect(normalizeChangedFiles(['a.blade.php', '', null, ' b.blade.php ']))
            .toEqual(['a.blade.php', 'b.blade.php']);
    });
});
