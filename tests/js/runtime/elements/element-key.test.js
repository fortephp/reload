import { describe, it, expect } from 'vitest';
import { elementKey } from '@runtime';
import { makeDoc } from '@test-helpers/dom.js';

describe('elementKey', () => {
    it('returns empty string for element without data-hmr-id', () => {
        const doc = makeDoc('<div>hello</div>');
        const el = doc.querySelector('div');
        expect(elementKey(el)).toBe('');
    });

    it('returns single id with index for element with data-hmr-id', () => {
        const doc = makeDoc('<div data-hmr-id="element:div">hello</div>');
        const el = doc.querySelector('[data-hmr-id]');
        expect(elementKey(el)).toBe('element:div[0]');
    });

    it('returns ancestor chain path', () => {
        const doc = makeDoc(`
            <section data-hmr-id="element:section">
                <div data-hmr-id="element:div">inner</div>
            </section>
        `);
        const inner = doc.querySelector('div[data-hmr-id="element:div"]');
        expect(elementKey(inner)).toBe('element:section[0]/element:div[0]');
    });

    it('includes sibling index for duplicate ids', () => {
        const doc = makeDoc(`
            <div data-hmr-id="element:div">first</div>
            <div data-hmr-id="element:div">second</div>
        `);
        const divs = doc.querySelectorAll('[data-hmr-id="element:div"]');
        expect(elementKey(divs[0])).toBe('element:div[0]');
        expect(elementKey(divs[1])).toBe('element:div[1]');
    });

    it('uses stable wire:key identity before sibling position', () => {
        const doc = makeDoc(`
            <div data-hmr-id="element:item" wire:key="alpha">first</div>
            <div data-hmr-id="element:item" wire:key="beta">second</div>
        `);
        const items = doc.querySelectorAll('[data-hmr-id="element:item"]');

        expect(elementKey(items[0])).toBe('element:item{alpha}');
        expect(elementKey(items[1])).toBe('element:item{beta}');
    });

    it('falls back to wire:id when no more stable identity is available', () => {
        const doc = makeDoc(`
            <div data-hmr-id="element:item" wire:id="component-1">first</div>
            <div data-hmr-id="element:item" wire:id="component-2">second</div>
        `);
        const items = doc.querySelectorAll('[data-hmr-id="element:item"]');

        expect(elementKey(items[0])).toBe('element:item{component-1}');
        expect(elementKey(items[1])).toBe('element:item{component-2}');
    });

    it('ignores wire:id on livewire roots because it changes across renders', () => {
        const doc = makeDoc(`
            <div data-hmr-id="element:item" wire:id="component-1" wire:snapshot="{}">first</div>
            <div data-hmr-id="element:item" wire:id="component-2" wire:snapshot="{}">second</div>
        `);
        const items = doc.querySelectorAll('[data-hmr-id="element:item"]');

        expect(elementKey(items[0])).toBe('element:item[0]');
        expect(elementKey(items[1])).toBe('element:item[1]');
    });

    it('falls back to id identity before sibling position', () => {
        const doc = makeDoc(`
            <div data-hmr-id="element:item" id="first-item">first</div>
            <div data-hmr-id="element:item" id="second-item">second</div>
        `);
        const items = doc.querySelectorAll('[data-hmr-id="element:item"]');

        expect(elementKey(items[0])).toBe('element:item{first-item}');
        expect(elementKey(items[1])).toBe('element:item{second-item}');
    });

    it('handles deeply nested structures', () => {
        const doc = makeDoc(`
            <main data-hmr-id="element:main">
                <section data-hmr-id="element:section">
                    <div data-hmr-id="element:div">
                        <span data-hmr-id="element:span">deep</span>
                    </div>
                </section>
            </main>
        `);
        const span = doc.querySelector('span[data-hmr-id]');
        expect(elementKey(span)).toBe('element:main[0]/element:section[0]/element:div[0]/element:span[0]');
    });

    it('skips ancestors without data-hmr-id', () => {
        const doc = makeDoc(`
            <div data-hmr-id="element:div">
                <ul>
                    <li data-hmr-id="element:li">item</li>
                </ul>
            </div>
        `);
        const li = doc.querySelector('li[data-hmr-id]');
        expect(elementKey(li)).toBe('element:div[0]/element:li[0]');
    });

    it('produces different keys for same id in different branches', () => {
        const doc = makeDoc(`
            <div data-hmr-id="element:div">
                <span data-hmr-id="element:span">left</span>
            </div>
            <section data-hmr-id="element:section">
                <span data-hmr-id="element:span">right</span>
            </section>
        `);
        const spans = doc.querySelectorAll('span[data-hmr-id]');
        const key1 = elementKey(spans[0]);
        const key2 = elementKey(spans[1]);
        expect(key1).not.toBe(key2);
        expect(key1).toContain('element:div');
        expect(key2).toContain('element:section');
    });
});
