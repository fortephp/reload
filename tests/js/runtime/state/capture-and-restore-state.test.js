import { describe, it, expect, beforeEach } from 'vitest';
import { captureState, restoreState } from '@runtime';
import '@test-helpers/dom.js';

describe('captureState', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('captures scroll position', () => {
        const state = captureState();
        expect(state).toHaveProperty('scrollX');
        expect(state).toHaveProperty('scrollY');
    });

    it('captures focused element by id', () => {
        document.body.innerHTML = '<input id="email" type="text">';
        const input = document.querySelector('#email');
        input.focus();

        const state = captureState();
        expect(state.focusSelector).toBe('#email');
    });

    it('captures focused element by name when no id', () => {
        document.body.innerHTML = '<input name="email" type="text">';
        const input = document.querySelector('[name="email"]');
        input.focus();

        const state = captureState();
        expect(state.focusSelector).toContain('email');
    });

    it('captures text input values', () => {
        document.body.innerHTML = '<input id="name" type="text" value="">';
        const input = document.querySelector('#name');
        input.value = 'typed text';

        const state = captureState();
        const captured = state.inputs.find(i => i.selector === '#name');
        expect(captured).toBeDefined();
        expect(captured.value).toBe('typed text');
    });

    it('captures checkbox checked state', () => {
        document.body.innerHTML = '<input id="remember" type="checkbox" value="yes">';
        const input = document.querySelector('#remember');
        input.checked = true;

        const state = captureState();
        const captured = state.inputs.find(i => i.selector === '#remember');
        expect(captured).toBeDefined();
        expect(captured.checked).toBe(true);
    });

    it('captures select value', () => {
        document.body.innerHTML = '<select id="country"><option>US</option><option>UK</option></select>';
        const select = document.querySelector('#country');
        select.selectedIndex = 1;

        const state = captureState();
        const captured = state.inputs.find(i => i.selector === '#country');
        expect(captured).toBeDefined();
        expect(captured.selectedValue).toBe('UK');
    });

    it('captures multiple select values', () => {
        document.body.innerHTML = `
            <select id="countries" multiple>
                <option value="us">US</option>
                <option value="uk">UK</option>
                <option value="ca">CA</option>
            </select>
        `;
        const select = document.querySelector('#countries');
        select.options[0].selected = true;
        select.options[2].selected = true;

        const state = captureState();
        const captured = state.inputs.find((input) => input.selector === '#countries');

        expect(captured).toBeDefined();
        expect(captured.selectedValues).toEqual(['us', 'ca']);
    });

    it('skips hidden inputs', () => {
        document.body.innerHTML = '<input type="hidden" name="_token" value="abc">';
        const state = captureState();
        expect(state.inputs).toHaveLength(0);
    });

    it('captures null focusSelector when nothing focused', () => {
        document.body.innerHTML = '<div>no inputs</div>';
        const state = captureState();
        expect(state.focusSelector).toBeNull();
    });
});

describe('restoreState', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('restores input values', () => {
        document.body.innerHTML = '<input id="name" type="text" value="">';
        const snapshot = {
            focusSelector: null,
            selectionStart: null,
            selectionEnd: null,
            scrollX: 0,
            scrollY: 0,
            inputs: [{ selector: '#name', value: 'restored text' }],
        };

        restoreState(snapshot);
        expect(document.querySelector('#name').value).toBe('restored text');
    });

    it('dispatches input events when restoring text values', () => {
        document.body.innerHTML = '<input id="name" type="text" value="">';
        const input = document.querySelector('#name');
        let events = 0;
        input.addEventListener('input', () => {
            events++;
        });

        restoreState({
            focusSelector: null,
            selectionStart: null,
            selectionEnd: null,
            scrollX: 0,
            scrollY: 0,
            inputs: [{ selector: '#name', value: 'restored text' }],
        });

        expect(events).toBe(1);
    });

    it('restores checkbox checked state', () => {
        document.body.innerHTML = '<input id="check" type="checkbox">';
        const snapshot = {
            focusSelector: null,
            selectionStart: null,
            selectionEnd: null,
            scrollX: 0,
            scrollY: 0,
            inputs: [{ selector: '#check', checked: true }],
        };

        restoreState(snapshot);
        expect(document.querySelector('#check').checked).toBe(true);
    });

    it('dispatches change events when restoring checkbox state', () => {
        document.body.innerHTML = '<input id="check" type="checkbox">';
        const input = document.querySelector('#check');
        let events = 0;
        input.addEventListener('change', () => {
            events++;
        });

        restoreState({
            focusSelector: null,
            selectionStart: null,
            selectionEnd: null,
            scrollX: 0,
            scrollY: 0,
            inputs: [{ selector: '#check', checked: true }],
        });

        expect(events).toBe(1);
    });

    it('restores checkbox state when the checkbox uses the implicit default value', () => {
        document.body.innerHTML = '<input type="checkbox" name="remember">';
        const snapshot = {
            focusSelector: null,
            selectionStart: null,
            selectionEnd: null,
            scrollX: 0,
            scrollY: 0,
            inputs: [{ selector: 'input[name="remember"]', index: 0, checked: true }],
        };

        restoreState(snapshot);
        expect(document.querySelector('input[name="remember"]').checked).toBe(true);
    });

    it('restores focus', () => {
        document.body.innerHTML = '<input id="target" type="text">';
        const snapshot = {
            focusSelector: '#target',
            selectionStart: null,
            selectionEnd: null,
            scrollX: 0,
            scrollY: 0,
            inputs: [],
        };

        restoreState(snapshot);
        expect(document.activeElement).toBe(document.querySelector('#target'));
    });

    it('handles missing elements gracefully', () => {
        document.body.innerHTML = '<div>empty</div>';
        const snapshot = {
            focusSelector: '#nonexistent',
            selectionStart: null,
            selectionEnd: null,
            scrollX: 0,
            scrollY: 0,
            inputs: [{ selector: '#gone', value: 'nope' }],
        };
        expect(() => restoreState(snapshot)).not.toThrow();
    });

    it('restores select value after options reorder', () => {
        document.body.innerHTML = '<select id="sel"><option value="a">A</option><option value="b">B</option><option value="c">C</option></select>';
        const snapshot = {
            focusSelector: null,
            focusIndex: 0,
            selectionStart: null,
            selectionEnd: null,
            scrollX: 0,
            scrollY: 0,
            inputs: [{ selector: '#sel', index: 0, selectedValue: 'c' }],
        };

        document.body.innerHTML = '<select id="sel"><option value="c">C</option><option value="a">A</option><option value="b">B</option></select>';

        restoreState(snapshot);
        expect(document.querySelector('#sel').value).toBe('c');
    });

    it('restores the correct duplicate-name input by index', () => {
        document.body.innerHTML = `
            <form><input name="email" type="text" value="first"></form>
            <form><input name="email" type="text" value="second"></form>
        `;
        const snapshot = {
            focusSelector: 'input[name="email"]',
            focusIndex: 1,
            selectionStart: null,
            selectionEnd: null,
            scrollX: 0,
            scrollY: 0,
            inputs: [{ selector: 'input[name="email"]', index: 1, value: 'restored second' }],
        };

        restoreState(snapshot);
        expect(document.querySelectorAll('input[name="email"]')[0].value).toBe('first');
        expect(document.querySelectorAll('input[name="email"]')[1].value).toBe('restored second');
    });

    it('restores single select value by option value', () => {
        document.body.innerHTML = '<select id="sel"><option value="a">A</option><option value="b">B</option><option value="c">C</option></select>';
        const snapshot = {
            focusSelector: null,
            focusIndex: 0,
            selectionStart: null,
            selectionEnd: null,
            scrollX: 0,
            scrollY: 0,
            inputs: [{ selector: '#sel', index: 0, selectedValue: 'c' }],
        };

        restoreState(snapshot);
        expect(document.querySelector('#sel').value).toBe('c');
    });

    it('restores multiple select values by option value', () => {
        document.body.innerHTML = `
            <select id="sel" multiple>
                <option value="a">A</option>
                <option value="b">B</option>
                <option value="c">C</option>
            </select>
        `;
        const snapshot = {
            focusSelector: null,
            focusIndex: 0,
            selectionStart: null,
            selectionEnd: null,
            scrollX: 0,
            scrollY: 0,
            inputs: [{ selector: '#sel', index: 0, selectedValues: ['a', 'c'] }],
        };

        restoreState(snapshot);

        expect(Array.from(document.querySelector('#sel').selectedOptions).map((option) => option.value)).toEqual(['a', 'c']);
    });
});
