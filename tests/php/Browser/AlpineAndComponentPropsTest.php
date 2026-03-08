<?php

uses(Forte\Reload\Tests\Browser\HmrBrowserTestCase::class);

test('hot reload applies edits on alpine-annotated html elements', function () {
    $this->initializeBrowserViewData('__reload_browser_alpine_elements_');
    $this->applyFixture('alpine/alpine-elements');

    $page = visit($this->routePath);
    $this->stabilizeAfterVisit($page);
    $initialLoadCount = (int) $page->script('window.__hmrLoadCount');

    $page = $page
        ->assertSee('Initial alpine copy')
        ->assertAttributeContains('[data-test="alpine-card"]', 'x-data', 'count: 1')
        ->assertAttributeDoesntContain('[data-test="alpine-card"]', 'x-data', 'ready:')
        ->assertScript('window.__hmrLoadCount', $initialLoadCount);

    $patchesAfterInsert = $this->applyEditsAndWait($page, function ($edits): void {
        $edits
            ->replaceOnce('x-data="{ count: 1 }"', 'x-data="{ count: 1, ready: true }"')
            ->replaceOnce('class="card"', 'class="card is-ready"')
            ->replaceOnce('Initial alpine copy', 'Updated alpine copy')
            ->insertAfterOnce('<!-- hmr-edit:alpine -->', "\n            <span data-test=\"alpine-extra\">Extra alpine node</span>\n");
    });

    $page
        ->assertSee('Updated alpine copy')
        ->assertSee('Extra alpine node')
        ->assertAttributeContains('[data-test="alpine-card"]', 'x-data', 'ready: true')
        ->assertAttributeContains('[data-test="alpine-card"]', 'class', 'is-ready')
        ->assertScript("window.__reloadPatchedEvents >= {$patchesAfterInsert}", true);

    $patchesAfterRemoval = $this->applyEditsAndWait($page, function ($edits): void {
        $edits
            ->removeOnce('<span data-test="alpine-extra">Extra alpine node</span>')
            ->replaceOnce('x-data="{ count: 1, ready: true }"', 'x-data="{ count: 1 }"')
            ->replaceOnce('class="card is-ready"', 'class="card"')
            ->replaceOnce('Updated alpine copy', 'Initial alpine copy');
    });

    $page
        ->assertDontSee('Extra alpine node')
        ->assertSee('Initial alpine copy')
        ->assertAttributeContains('[data-test="alpine-card"]', 'x-data', 'count: 1')
        ->assertAttributeDoesntContain('[data-test="alpine-card"]', 'x-data', 'ready:')
        ->assertScript("window.__reloadPatchedEvents >= {$patchesAfterRemoval}", true)
        ->assertScript('window.__hmrLoadCount', $initialLoadCount);
});

test('hot reload applies blade component prop changes in templates', function () {
    $this->initializeBrowserViewData('__reload_browser_component_props_');
    $this->applyFixture('forms/component-auth-form');

    $page = visit($this->routePath);
    $this->stabilizeAfterVisit($page);
    $initialLoadCount = (int) $page->script('window.__hmrLoadCount');

    $page = $page
        ->assertSee('Email address')
        ->assertAttribute('input[name="email"]', 'type', 'email')
        ->assertScript('window.__hmrLoadCount', $initialLoadCount);

    $patchesAfterUpdate = $this->applyEditsAndWait($page, function ($edits): void {
        $edits
            ->replaceOnce('label="Email address"', 'label="Primary email"')
            ->replaceOnce('type="email"', 'type="text"')
            ->replaceOnce('label="Remember me"', 'label="Remember this browser"');
    });

    $page
        ->assertSee('Primary email')
        ->assertSee('Remember this browser')
        ->assertAttribute('input[name="email"]', 'type', 'text')
        ->assertScript("window.__reloadPatchedEvents >= {$patchesAfterUpdate}", true);

    $patchesAfterRevert = $this->applyEditsAndWait($page, function ($edits): void {
        $edits
            ->replaceOnce('label="Primary email"', 'label="Email address"')
            ->replaceOnce('type="text"', 'type="email"')
            ->replaceOnce('label="Remember this browser"', 'label="Remember me"');
    });

    $page
        ->assertSee('Email address')
        ->assertSee('Remember me')
        ->assertAttribute('input[name="email"]', 'type', 'email')
        ->assertScript("window.__reloadPatchedEvents >= {$patchesAfterRevert}", true)
        ->assertScript('window.__hmrLoadCount', $initialLoadCount);
});

test('hot update from parent blade file applies component prop changes', function () {
    $this->initializeBrowserViewData('__reload_browser_component_props_hot_update_');
    $this->applyFixture('forms/component-auth-form');

    $page = visit($this->routePath);
    $this->stabilizeAfterVisit($page);
    $initialLoadCount = (int) $page->script('window.__hmrLoadCount');

    $page = $page
        ->assertSee('Email address')
        ->assertScript('window.__hmrLoadCount', $initialLoadCount);

    $patchesAfterUpdate = $this->applyEditsAndWaitForSimulatedHotUpdate(
        $page,
        function ($edits): void {
            $edits
                ->replaceOnce('label="Email address"', 'label="Email address!!"')
                ->replaceOnce('label="Remember me"', 'label="Remember me!!"');
        },
        'testing/hmr-browser.blade.php',
    );

    $page
        ->assertSee('Email address!!')
        ->assertSee('Remember me!!')
        ->assertScript("window.__reloadPatchedEvents >= {$patchesAfterUpdate}", true);

    $patchesAfterRevert = $this->applyEditsAndWaitForSimulatedHotUpdate(
        $page,
        function ($edits): void {
            $edits
                ->replaceOnce('label="Email address!!"', 'label="Email address"')
                ->replaceOnce('label="Remember me!!"', 'label="Remember me"');
        },
        'testing/hmr-browser.blade.php',
    );

    $page
        ->assertSee('Email address')
        ->assertSee('Remember me')
        ->assertScript("window.__reloadPatchedEvents >= {$patchesAfterRevert}", true)
        ->assertScript('window.__hmrLoadCount', $initialLoadCount);
});
