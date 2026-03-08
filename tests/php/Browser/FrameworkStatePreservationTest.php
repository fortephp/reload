<?php

uses(Forte\Reload\Tests\Browser\HmrBrowserTestCase::class);

test('hot reload preserves alpine and livewire state across parent prop and surrounding content edits', function () {
    $this->initializeBrowserViewData('__reload_browser_framework_parent_edits_');
    $this->applyFixture('frameworks/livewire-alpine-state');

    $page = visit($this->routePath);
    $this->stabilizeAfterVisit($page, quietMs: 1800);

    $page = $page
        ->assertSee('Parent shell copy v1')
        ->assertSee('Livewire panel')
        ->assertSee('Helper copy v1')
        ->assertSee('Alpine shell ready');

    $this->waitForFrameworkRuntimeReady($page);
    $this->waitForAlpineComponentReady($page, '[data-test="alpine-root"]');
    $this->waitForLivewireComponentReady($page, '[data-test="livewire-root"]');

    $page->script(
        '(() => {'.
        "const input = document.querySelector('[data-test=\"alpine-input\"]');".
        "input.value = 'client draft';".
        "input.dispatchEvent(new Event('input', { bubbles: true }));".
        '})()'
    );
    $page
        ->type('livewire-search', 'persisted search')
        ->click('[data-test="livewire-remember"]');

    $hot = $this->hotReload($page);

    $patchesAfterParentEdit = $hot->apply(function ($edits): void {
        $edits
            ->replaceOnce('Parent shell copy v1', 'Parent shell copy v2')
            ->replaceOnce('label="Outer email"', 'label="Outer contact email"')
            ->replaceOnce('title="Livewire panel"', 'title="Livewire control panel"')
            ->replaceOnce('helper-copy="Helper copy v1"', 'helper-copy="Helper copy v2"')
            ->replaceOnce('Footer shell copy v1', 'Footer shell copy v2')
            ->insertAfterOnce('<!-- hmr-edit:alpine -->', "\n        <span data-test=\"alpine-extra\">Alpine extra copy</span>\n")
            ->insertAfterOnce('<!-- hmr-edit:shell -->', "\n        <p data-test=\"shell-note\">Shell note v2</p>\n");
    });
    $this->stabilizeAfterVisit($page, quietMs: 1200);

    $page
        ->assertSee('Parent shell copy v2')
        ->assertSee('Outer contact email')
        ->assertSee('Helper copy v2')
        ->assertSee('Footer shell copy v2')
        ->assertSee('Alpine extra copy')
        ->assertSee('Shell note v2')
        ->assertScript("window.__reloadPatchedEvents >= {$patchesAfterParentEdit}", true);

    $this->waitForLivewireComponentReady($page, '[data-test="livewire-root"]');
    $this->waitForCheckedState($page, '[data-test="livewire-remember"]', true);
    $this->waitForInputValue($page, '[data-test="livewire-search"]', 'persisted search');
    $page->assertScript("Boolean(document.querySelector('[data-test=\"livewire-root\"]').__livewire)", true);
});

test('hot reload preserves framework state across component template edits and multi-file change payloads', function () {
    $this->initializeBrowserViewData('__reload_browser_framework_component_edits_');
    $this->applyFixture('frameworks/livewire-alpine-state');

    $page = visit($this->routePath);
    $this->stabilizeAfterVisit($page, quietMs: 1800);

    $page = $page
        ->assertSee('Outer email')
        ->assertSee('Livewire component hydrated');

    $this->waitForFrameworkRuntimeReady($page);
    $this->waitForAlpineComponentReady($page, '[data-test="alpine-root"]');
    $this->waitForLivewireComponentReady($page, '[data-test="livewire-root"]');

    $page->script(
        '(() => {'.
        "const input = document.querySelector('[data-test=\"alpine-input\"]');".
        "input.value = 'framework note';".
        "input.dispatchEvent(new Event('input', { bubbles: true }));".
        '})()'
    );
    $page
        ->type('livewire-search', 'carry this state')
        ->click('[data-test="livewire-remember"]');

    $before = $this->currentPatchCount($page);

    $this->editFixtureFile('components/hmr/input.blade.php')
        ->replaceOnce('<label>{{ $label }}</label>', '<label>{{ $label }} <span data-test="input-template-suffix">template suffix</span></label>')
        ->apply();

    $this->editFixtureFile('testing/livewire/state-panel.blade.php')
        ->insertAfterOnce('<p data-test="livewire-helper">{{ $helperCopy }}</p>', "\n    <p data-test=\"livewire-static-note\">Livewire template note v2</p>\n")
        ->apply();

    $this->dispatchBladeChangePayloadAndWait(
        $page,
        $before,
        ['components/hmr/input.blade.php', 'testing/livewire/state-panel.blade.php'],
        12000,
    );
    $this->stabilizeAfterVisit($page, quietMs: 1200);

    $page
        ->assertSee('template suffix')
        ->assertSee('Livewire template note v2')
        ->assertSee('Livewire component hydrated');

    $this->waitForInputValue($page, '[data-test="alpine-input"]', 'framework note');
    $this->waitForTextContent($page, '[data-test="alpine-note-preview"]', 'framework note');
    $this->waitForLivewireComponentReady($page, '[data-test="livewire-root"]');
    $this->waitForCheckedState($page, '[data-test="livewire-remember"]', true);
    $this->waitForInputValue($page, '[data-test="livewire-search"]', 'carry this state');
    $page->assertScript("Boolean(document.querySelector('[data-test=\"livewire-root\"]').__livewire)", true);
});
