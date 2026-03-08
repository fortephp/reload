import { describe, it, expect } from 'vitest';
import { visibleContent } from '@runtime';
import { makeDoc } from '@test-helpers/dom.js';

function el(html) {
    return makeDoc(html).querySelector('body > *');
}

describe('visibleContent', () => {
    it('returns outerHTML for element without hidden inputs', () => {
        const element = el('<div><span>visible</span></div>');
        expect(visibleContent(element)).toBe(element.outerHTML);
    });

    it('strips input[type=hidden] from comparison', () => {
        const element = el('<form><input type="hidden" name="_token" value="abc"><input type="text" name="email"></form>');
        const result = visibleContent(element);
        expect(result).not.toContain('_token');
        expect(result).not.toContain('type="hidden"');
        expect(result).toContain('type="text"');
    });

    it('preserves visible inputs', () => {
        const element = el('<form><input type="text" name="name"><input type="email" name="email"></form>');
        const result = visibleContent(element);
        expect(result).toContain('type="text"');
        expect(result).toContain('type="email"');
    });

    it('does not mutate the original element', () => {
        const element = el('<form><input type="hidden" name="_token" value="abc"><span>visible</span></form>');
        visibleContent(element);
        expect(element.querySelector('input[type="hidden"]')).not.toBeNull();
    });
});
