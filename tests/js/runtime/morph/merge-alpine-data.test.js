import { describe, it, expect } from 'vitest';
import { mergeAlpineData } from '@runtime';

function makeAlpineEl(xData, currentState) {
    const el = document.createElement('div');
    el.setAttribute('x-data', xData);
    el._x_dataStack = [{ ...currentState }];
    return el;
}

describe('mergeAlpineData', () => {
    it('adds new properties with defaults', () => {
        const el = makeAlpineEl('{ count: 0 }', { count: 5 });
        mergeAlpineData(el, '{ count: 0, name: "" }');
        expect(el._x_dataStack[0].count).toBe(5);
        expect(el._x_dataStack[0].name).toBe('');
    });

    it('preserves existing property values', () => {
        const el = makeAlpineEl('{ open: false }', { open: true });
        mergeAlpineData(el, '{ open: false }');
        expect(el._x_dataStack[0].open).toBe(true);
    });

    it('removes properties no longer in expression', () => {
        const el = makeAlpineEl('{ count: 0, name: "" }', { count: 5, name: 'John' });
        mergeAlpineData(el, '{ count: 0 }');
        expect(el._x_dataStack[0].count).toBe(5);
        expect('name' in el._x_dataStack[0]).toBe(false);
    });

    it('preserves init and destroy hooks', () => {
        const initFn = () => {};
        const destroyFn = () => {};
        const el = makeAlpineEl('{ count: 0 }', { count: 5, init: initFn, destroy: destroyFn });
        mergeAlpineData(el, '{ count: 0 }');
        expect(el._x_dataStack[0].init).toBe(initFn);
        expect(el._x_dataStack[0].destroy).toBe(destroyFn);
    });

    it('does nothing when element has no data stack', () => {
        const el = document.createElement('div');
        mergeAlpineData(el, '{ count: 0 }');
    });

    it('handles invalid expressions gracefully', () => {
        const el = makeAlpineEl('{ count: 0 }', { count: 5 });
        mergeAlpineData(el, 'dropdown()');
        expect(el._x_dataStack[0].count).toBe(5);
    });

    it('handles empty data stack array', () => {
        const el = document.createElement('div');
        el._x_dataStack = [];
        mergeAlpineData(el, '{ count: 0 }');
    });
});
