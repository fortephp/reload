<?php

uses(Forte\Reload\Tests\Browser\HmrBrowserTestCase::class);

test('shows server exception response in error modal when blade render fails', function () {
    $this->initializeBrowserViewData('__reload_browser_error_modal_');
    $this->applyFixture('forms/simple-form');

    $page = visit($this->routePath)
        ->assertSee('Log in')
        ->assertScript('window.__hmrLoadCount', 1)
        ->wait(1);

    $this->editView()
        ->replaceOnce('<strong>Log in</strong>', '@php($broken = )')
        ->apply();

    $page->script('if (window.__reloadPatchNow) window.__reloadPatchNow();');
    $this->waitForErrorOverlay($page);

    $page
        ->assertScript("Boolean(document.querySelector('#reload-error-frame'))", true)
        ->assertScript("document.querySelector('#reload-error-message')?.textContent.includes('HTTP 500')", true)
        ->assertScript('window.__hmrLoadCount', 1);
});

test('auto closes error modal after next successful hmr render', function () {
    $this->initializeBrowserViewData('__reload_browser_error_auto_close_');
    $this->applyFixture('forms/simple-form');

    $page = visit($this->routePath)
        ->assertSee('Log in')
        ->assertScript('window.__hmrLoadCount', 1)
        ->wait(1);

    $this->editView()
        ->replaceOnce('<strong>Log in</strong>', '@php($broken = )')
        ->apply();

    $page->script('if (window.__reloadPatchNow) window.__reloadPatchNow();');
    $this->waitForErrorOverlay($page);

    $this->editView()
        ->replaceOnce('@php($broken = )', '<strong>Log in</strong>')
        ->apply();

    $page->script('if (window.__reloadPatchNow) window.__reloadPatchNow();');
    $this->waitForErrorOverlayToDisappear($page);

    $page
        ->assertScript("Boolean(document.getElementById('reload-error'))", false)
        ->assertSee('Log in')
        ->assertScript('window.__hmrLoadCount', 1);
});
