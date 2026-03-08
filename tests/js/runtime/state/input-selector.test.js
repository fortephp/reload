import { describe, it, expect } from 'vitest';
import { inputSelector } from '@runtime';
import { makeDoc } from '@test-helpers/dom.js';

function input(html) {
    return makeDoc(html).querySelector('input, textarea, select');
}

describe('inputSelector', () => {
    it('returns id-based selector when element has id', () => {
        const el = input('<input id="email" type="text">');
        expect(inputSelector(el)).toBe('#email');
    });

    it('returns name-based selector when element has name but no id', () => {
        const el = input('<input name="email" type="text">');
        expect(inputSelector(el)).toBe('input[name="email"]');
    });

    it('includes value for radio inputs', () => {
        const el = input('<input type="radio" name="color" value="red">');
        expect(inputSelector(el)).toBe('input[name="color"][value="red"]');
    });

    it('includes value for checkbox inputs', () => {
        const el = input('<input type="checkbox" name="agree" value="yes">');
        expect(inputSelector(el)).toBe('input[name="agree"][value="yes"]');
    });

    it('does not include implicit checkbox values that are not present as attributes', () => {
        const el = input('<input type="checkbox" name="agree">');
        expect(inputSelector(el)).toBe('input[name="agree"]');
    });

    it('returns null when element has neither id nor name', () => {
        const el = input('<input type="text">');
        expect(inputSelector(el)).toBeNull();
    });

    it('prefers id over name', () => {
        const el = input('<input id="my-input" name="my-name" type="text">');
        expect(inputSelector(el)).toBe('#my-input');
    });

    it('works with textarea', () => {
        const el = input('<textarea name="body"></textarea>');
        expect(inputSelector(el)).toBe('textarea[name="body"]');
    });

    it('works with select', () => {
        const el = input('<select name="country"><option>US</option></select>');
        expect(inputSelector(el)).toBe('select[name="country"]');
    });
});
