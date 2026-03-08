<?php

uses(Forte\Reload\Tests\Browser\HmrBrowserTestCase::class);

test('hot reload applies blade edits and removals without full page reload', function () {
    $this->initializeBrowserViewData('__reload_browser_loads_');

    $this->applyFixture('forms/simple-form');

    $page = visit($this->routePath)
        ->assertSee('Email address')
        ->assertSee('Log in')
        ->assertScript('window.__hmrLoadCount', 1)
        ->wait(1);

    $patchesAfterInsert = $this->applyEditsAndWait($page, function ($edits): void {
        $edits
            ->insertAfterOnce('<!-- hmr-edit:insert -->', "\n        asdf\n")
            ->replaceOnce('<strong>Log in</strong>', '<strong>Log in now</strong>');
    });

    expect($this->renderBrowserView())->toContain('asdf');

    $page = $page
        ->assertSee('asdf')
        ->assertSee('Log in now')
        ->assertScript('window.__reloadPatchedEvents > 0', true)
        ->assertScript('window.__hmrLoadCount', 1);

    $patchesAfterRemoval = $this->applyEditsAndWait($page, function ($edits): void {
        $edits
            ->removeOnce('asdf')
            ->replaceOnce('<strong>Log in now</strong>', '<strong>Log in final</strong>');
    });

    $page
        ->assertDontSee('asdf')
        ->assertSee('Log in final')
        ->assertScript("window.__reloadPatchedEvents >= {$patchesAfterRemoval}", true)
        ->assertScript('window.__hmrLoadCount', 1);
});

test('hot reload handles add/remove text in component heavy auth form', function () {
    $this->initializeBrowserViewData('__reload_browser_components_');

    $this->applyFixture('forms/component-auth-form');

    $page = visit($this->routePath)
        ->assertSee('Email address')
        ->assertSee('Forgot your password?... well. did you?')
        ->assertSee('Log in to your account')
        ->assertScript('window.__hmrLoadCount', 1)
        ->wait(1);

    $patchesAfterInsert = $this->applyEditsAndWait($page, function ($edits): void {
        $edits
            ->insertAfterOnce('<!-- hmr-edit:insert -->', "\n        asdf\n")
            ->replaceOnce("{{ __('Log in to your account') }}", "{{ __('Log in now') }}");
    });

    $page = $page
        ->assertSee('asdf')
        ->assertSee('Log in now')
        ->assertScript('window.__reloadPatchedEvents > 0', true)
        ->assertScript('window.__hmrLoadCount', 1);

    $patchesAfterRemoval = $this->applyEditsAndWait($page, function ($edits): void {
        $edits
            ->removeOnce('asdf')
            ->replaceOnce("{{ __('Log in now') }}", "{{ __('Log in final') }}");
    });

    $page
        ->assertDontSee('asdf')
        ->assertSee('Log in final')
        ->assertScript("window.__reloadPatchedEvents >= {$patchesAfterRemoval}", true)
        ->assertScript('window.__hmrLoadCount', 1);
});

test('hot reload applies edits from simulated blade change payload events', function () {
    $this->initializeBrowserViewData('__reload_browser_ws_only_');
    $this->applyFixture('forms/simple-form');

    $page = visit($this->routePath)
        ->assertSee('Log in')
        ->assertScript('window.__hmrLoadCount', 1)
        ->wait(1);

    $patchesAfterUpdate = $this->applyEditsAndWaitForSimulatedHotUpdate(
        $page,
        function ($edits): void {
            $edits
                ->replaceOnce('<strong>Log in</strong>', '<strong>Log in via blade-change payload</strong>');
        },
        'testing/hmr-browser.blade.php',
    );

    $page
        ->assertSee('Log in via blade-change payload')
        ->assertScript("window.__reloadPatchedEvents >= {$patchesAfterUpdate}", true)
        ->assertScript('window.__hmrLoadCount', 1);
});
