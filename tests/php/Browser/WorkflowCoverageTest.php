<?php

uses(Forte\Reload\Tests\Browser\HmrBrowserTestCase::class);

test('hot reload toggles conditional directive branches inside templates', function () {
    $this->initializeBrowserViewData('__reload_browser_conditional_toggle_');
    $this->applyFixture('forms/component-auth-form');

    $page = visit($this->routePath)
        ->assertSee('Forgot your password?... well. did you?')
        ->assertScript('window.__hmrLoadCount', 1)
        ->wait(1);

    $hot = $this->hotReload($page);

    $patchesAfterDisable = $hot->apply(function ($edits): void {
        $edits->replaceOnce('@if (true)', '@if (false)');
    });

    $page
        ->assertDontSee('Forgot your password?... well. did you?')
        ->assertScript("window.__reloadPatchedEvents >= {$patchesAfterDisable}", true);

    $patchesAfterEnable = $hot->apply(function ($edits): void {
        $edits->replaceOnce('@if (false)', '@if (true)');
    });

    $page
        ->assertSee('Forgot your password?... well. did you?')
        ->assertScript("window.__reloadPatchedEvents >= {$patchesAfterEnable}", true)
        ->assertScript('window.__hmrLoadCount', 1);
});

test('hot reload applies edits made directly in blade component template files', function () {
    $this->initializeBrowserViewData('__reload_browser_component_template_');
    $this->applyFixture('forms/component-auth-form');

    $page = visit($this->routePath)
        ->assertSee('Email address')
        ->assertDontSee('Email address (edited)')
        ->assertScript('window.__hmrLoadCount', 1)
        ->wait(1);

    $hot = $this->hotReload($page);

    $patchesAfterEdit = $hot->applyFixtureAndWaitHotUpdate(
        'components/hmr/input.blade.php',
        function ($edits): void {
            $edits->replaceOnce('<label>{{ $label }}</label>', '<label>{{ $label }} (edited)</label>');
        },
    );

    $page
        ->assertSee('Email address (edited)')
        ->assertScript("window.__reloadPatchedEvents >= {$patchesAfterEdit}", true);

    $patchesAfterRevert = $hot->applyFixtureAndWaitHotUpdate(
        'components/hmr/input.blade.php',
        function ($edits): void {
            $edits->replaceOnce('<label>{{ $label }} (edited)</label>', '<label>{{ $label }}</label>');
        },
    );

    $page
        ->assertSee('Email address')
        ->assertDontSee('Email address (edited)')
        ->assertScript("window.__reloadPatchedEvents >= {$patchesAfterRevert}", true)
        ->assertScript('window.__hmrLoadCount', 1);
});

test('hot reload applies edits made in included partial blade files', function () {
    $this->initializeBrowserViewData('__reload_browser_partial_edit_');
    $this->applyFixture('forms/simple-form-with-partial');

    $page = visit($this->routePath)
        ->assertSee('Shared copy v1')
        ->assertScript('window.__hmrLoadCount', 1)
        ->wait(1);

    $hot = $this->hotReload($page);

    $patchesAfterEdit = $hot->applyFixtureAndWaitHotUpdate(
        'testing/partials/hmr-shared-copy.blade.php',
        function ($edits): void {
            $edits->replaceOnce('Shared copy v1', 'Shared copy v2');
        },
    );

    $page
        ->assertSee('Shared copy v2')
        ->assertScript("window.__reloadPatchedEvents >= {$patchesAfterEdit}", true);

    $patchesAfterRevert = $hot->applyFixtureAndWaitHotUpdate(
        'testing/partials/hmr-shared-copy.blade.php',
        function ($edits): void {
            $edits->replaceOnce('Shared copy v2', 'Shared copy v1');
        },
    );

    $page
        ->assertSee('Shared copy v1')
        ->assertScript("window.__reloadPatchedEvents >= {$patchesAfterRevert}", true)
        ->assertScript('window.__hmrLoadCount', 1);
});
