<?php

uses(Forte\Reload\Tests\Browser\HmrBrowserTestCase::class);

test('shows error overlay when included partial render fails', function () {
    $this->initializeBrowserViewData('__reload_browser_partial_error_');
    $this->applyFixture('forms/simple-form-with-partial');

    $page = visit($this->routePath)
        ->assertSee('Shared copy v1')
        ->assertScript('window.__hmrLoadCount', 1)
        ->wait(1);

    $this->editFixtureFile('testing/partials/hmr-shared-copy.blade.php')
        ->replaceOnce('<p data-test="shared-copy">Shared copy v1</p>', '@php($broken = )')
        ->apply();

    $page->script('if (window.__reloadPatchNow) window.__reloadPatchNow();');
    $this->waitForErrorOverlay($page);

    $page
        ->assertScript("Boolean(document.querySelector('#reload-error-frame'))", true)
        ->assertScript("document.querySelector('#reload-error-message')?.textContent.includes('HTTP 500')", true)
        ->assertScript('window.__hmrLoadCount', 1);
});

test('shows error overlay when blade component view render fails', function () {
    $this->initializeBrowserViewData('__reload_browser_component_error_');
    $this->applyFixture('forms/component-auth-form');

    $page = visit($this->routePath)
        ->assertScript('window.__hmrLoadCount', 1)
        ->wait(1);

    $this->editFixtureFile('components/hmr/input.blade.php')
        ->replaceOnce('<label>{{ $label }}</label>', '@php($broken = )')
        ->apply();

    $page->script('if (window.__reloadPatchNow) window.__reloadPatchNow();');
    $this->waitForErrorOverlay($page);

    $page
        ->assertScript("Boolean(document.querySelector('#reload-error-frame'))", true)
        ->assertScript("document.querySelector('#reload-error-message')?.textContent.includes('HTTP 500')", true)
        ->assertScript('window.__hmrLoadCount', 1);
});
