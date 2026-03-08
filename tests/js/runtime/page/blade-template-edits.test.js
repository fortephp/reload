import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { patchElements, patchDirectives } from '@runtime';
import { makeDoc } from '@test-helpers/dom.js';
import { readFeatureEditFixture } from '@test-helpers/fixtures.js';

const thisDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(thisDir, '../../../..');
const rendererScript = resolve(packageRoot, 'tests/php/Support/render-instrumented-view.php');
const phpCandidates = Array.from(new Set([
    process.env.BLADE_HMR_TEST_PHP,
    process.env.PHP_BINARY,
    process.env.PHP,
    ...discoverPhpCommands(),
    'php',
].filter(Boolean)));
let phpBinary = phpCandidates[phpCandidates.length - 1];
const canRunPhpRenderer = (() => {
    for (const candidate of phpCandidates) {
        try {
            execFileSync(candidate, ['-v'], {
                stdio: ['ignore', 'ignore', 'ignore'],
                shell: shouldUseShell(candidate),
            });
            phpBinary = candidate;
            return true;
        } catch {
        }
    }

    return false;
})();

function renderTemplate(template, data = {}) {
    return execFileSync(phpBinary, [rendererScript], {
        cwd: packageRoot,
        encoding: 'utf8',
        input: JSON.stringify({ template, data }),
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: shouldUseShell(phpBinary),
    });
}

function discoverPhpCommands() {
    const commands = [];

    try {
        const lookupCommand = process.platform === 'win32' ? 'where.exe' : 'which';
        const result = execFileSync(lookupCommand, ['php'], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        });

        commands.push(
            ...result
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean),
        );
    } catch {
    }

    return commands;
}

function shouldUseShell(command) {
    return process.platform === 'win32' && !String(command).toLowerCase().endsWith('.exe');
}

function simulatePatch(oldHtml, newHtml, liveDoc) {
    const oldDoc = makeDoc(oldHtml);
    const newDoc = makeDoc(newHtml);

    let count = 0;
    count += patchElements(oldDoc, newDoc, liveDoc, 25);
    count += patchDirectives(oldDoc, newDoc, liveDoc, 25 - count);

    return count;
}

const describeWithPhp = canRunPhpRenderer ? describe : describe.skip;

describeWithPhp('blade template edit simulation', () => {
    it('applies add and remove text edits between instrumented children', () => {
        const baseTemplate = readFeatureEditFixture('cycle/edit-cycle-initial');
        const withInsertedText = readFeatureEditFixture('cycle/edit-cycle-with-text');
        const afterRemoval = readFeatureEditFixture('cycle/edit-cycle-after-removal');

        const baseHtml = renderTemplate(baseTemplate);
        const insertedHtml = renderTemplate(withInsertedText);
        const removedHtml = renderTemplate(afterRemoval);

        const liveDoc = makeDoc(baseHtml);

        const firstCount = simulatePatch(baseHtml, insertedHtml, liveDoc);
        expect(firstCount).toBeGreaterThan(0);
        expect(liveDoc.body.textContent).toContain('asdf');
        expect(liveDoc.body.textContent).toContain('Log in now');

        const secondCount = simulatePatch(insertedHtml, removedHtml, liveDoc);
        expect(secondCount).toBeGreaterThan(0);
        expect(liveDoc.body.textContent).not.toContain('asdf');
        expect(liveDoc.body.textContent).toContain('Log in final');
    });

    it('applies interpolation text edits without leaking marker text', () => {
        const oldTemplate = readFeatureEditFixture('interpolation/interpolation-old');
        const newTemplate = readFeatureEditFixture('interpolation/interpolation-new');

        const oldHtml = renderTemplate(oldTemplate);
        const newHtml = renderTemplate(newTemplate);
        const liveDoc = makeDoc(oldHtml);

        const patchCount = simulatePatch(oldHtml, newHtml, liveDoc);

        expect(patchCount).toBeGreaterThan(0);
        expect(liveDoc.body.textContent).toContain('Forgot your password?... well. did you?');
        expect(liveDoc.body.textContent).not.toContain('bl:begin id=');
        expect(liveDoc.body.textContent).not.toContain('bl:end id=');
    });

    it('applies interpolation edits inside textarea, pre, and inline style elements', () => {
        const oldTemplate = readFeatureEditFixture('raw-text/raw-text-elements-old');
        const newTemplate = readFeatureEditFixture('raw-text/raw-text-elements-new');

        const oldHtml = renderTemplate(oldTemplate);
        const newHtml = renderTemplate(newTemplate);
        const liveDoc = makeDoc(oldHtml);

        const patchCount = simulatePatch(oldHtml, newHtml, liveDoc);

        expect(patchCount).toBeGreaterThan(0);
        expect(liveDoc.querySelector('textarea').value).toBe('Updated note body');
        expect(liveDoc.querySelector('textarea').value).not.toContain('bl:begin id=');
        expect(liveDoc.querySelector('pre').textContent).toBe('Updated heading\n  updated details');
        expect(liveDoc.querySelector('pre').textContent).not.toContain('bl:begin id=');
        expect(liveDoc.querySelector('style').textContent).toContain('new badge');
        expect(liveDoc.querySelector('style').textContent).toContain('rgb(0, 0, 255)');
    });

    it('applies structural and attribute edits from file fixtures', () => {
        const oldTemplate = readFeatureEditFixture('structural/structural-old');
        const newTemplate = readFeatureEditFixture('structural/structural-new');

        const oldHtml = renderTemplate(oldTemplate);
        const newHtml = renderTemplate(newTemplate);
        const liveDoc = makeDoc(oldHtml);

        const patchCount = simulatePatch(oldHtml, newHtml, liveDoc);

        expect(patchCount).toBeGreaterThan(0);
        expect(liveDoc.querySelector('a').getAttribute('class')).toContain('active');
        expect(liveDoc.body.textContent).toContain('Beta');
        expect(liveDoc.body.textContent).toContain('New explanatory copy.');
    });

    it('applies edits to Alpine-annotated HTML elements', () => {
        const oldTemplate = readFeatureEditFixture('alpine/alpine-element-old');
        const newTemplate = readFeatureEditFixture('alpine/alpine-element-new');

        const oldHtml = renderTemplate(oldTemplate);
        const newHtml = renderTemplate(newTemplate);
        const liveDoc = makeDoc(oldHtml);

        const patchCount = simulatePatch(oldHtml, newHtml, liveDoc);

        expect(patchCount).toBeGreaterThan(0);
        expect(liveDoc.querySelector('[data-test="alpine-card"]').getAttribute('x-data')).toContain('ready');
        expect(liveDoc.body.textContent).toContain('Updated alpine copy');
        expect(liveDoc.body.textContent).toContain('Extra alpine node');
    });

    it('applies add/remove edits for trailing content after html close tag', () => {
        const baseTemplate = readFeatureEditFixture('trailing/trailing-after-html-initial');
        const withTrailingTextTemplate = readFeatureEditFixture('trailing/trailing-after-html-with-text');
        const afterRemovalTemplate = readFeatureEditFixture('trailing/trailing-after-html-after-removal');

        const baseHtml = renderTemplate(baseTemplate);
        const withTrailingTextHtml = renderTemplate(withTrailingTextTemplate);
        const afterRemovalHtml = renderTemplate(afterRemovalTemplate);
        const liveDoc = makeDoc(baseHtml);

        const firstCount = simulatePatch(baseHtml, withTrailingTextHtml, liveDoc);
        expect(firstCount).toBeGreaterThan(0);
        expect(liveDoc.body.textContent).toContain('after-html text');

        const secondCount = simulatePatch(withTrailingTextHtml, afterRemovalHtml, liveDoc);
        expect(secondCount).toBeGreaterThan(0);
        expect(liveDoc.body.textContent).not.toContain('after-html text');
    });

    it('applies livewire style attribute and keyed list edits from fixtures', () => {
        const oldTemplate = readFeatureEditFixture('livewire/livewire-element-old');
        const newTemplate = readFeatureEditFixture('livewire/livewire-element-new');

        const oldHtml = renderTemplate(oldTemplate);
        const newHtml = renderTemplate(newTemplate);
        const liveDoc = makeDoc(oldHtml);

        const patchCount = simulatePatch(oldHtml, newHtml, liveDoc);

        expect(patchCount).toBeGreaterThan(0);
        expect(liveDoc.body.textContent).toContain('Updated first task');
        expect(liveDoc.body.textContent).toContain('Third task');
        expect(liveDoc.querySelector('a').hasAttribute('wire:navigate.hover')).toBe(true);
        expect(liveDoc.querySelector('input').getAttribute('wire:model.blur')).toBe('filters.query');
    });

    it('applies data-attribute edits from fixtures', () => {
        const oldTemplate = readFeatureEditFixture('attributes/data-attributes-old');
        const newTemplate = readFeatureEditFixture('attributes/data-attributes-new');

        const oldHtml = renderTemplate(oldTemplate);
        const newHtml = renderTemplate(newTemplate);
        const liveDoc = makeDoc(oldHtml);

        const patchCount = simulatePatch(oldHtml, newHtml, liveDoc);

        expect(patchCount).toBeGreaterThan(0);
        const link = liveDoc.querySelector('a');
        expect(link.getAttribute('data-test')).toBe('login-link-primary');
        expect(link.getAttribute('data-mode')).toBe('ready');
    });

    it('applies conditional directive branch toggles from fixtures', () => {
        const oldTemplate = readFeatureEditFixture('directives/conditional-text-old');
        const newTemplate = readFeatureEditFixture('directives/conditional-text-new');

        const oldHtml = renderTemplate(oldTemplate);
        const newHtml = renderTemplate(newTemplate);
        const liveDoc = makeDoc(oldHtml);

        const patchCount = simulatePatch(oldHtml, newHtml, liveDoc);

        expect(patchCount).toBeGreaterThan(0);
        expect(liveDoc.body.textContent).not.toContain('Alpha branch');
        expect(liveDoc.body.textContent).toContain('Beta branch');
    });
});
