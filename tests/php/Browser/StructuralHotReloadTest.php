<?php

uses(Forte\Reload\Tests\Browser\HmrBrowserTestCase::class);

test('hot reload applies structural element additions removals and attribute updates', function () {
    $this->initializeBrowserViewData('__reload_browser_structural_');
    $this->applyFixture('structure/structural-elements');

    $page = visit($this->routePath)
        ->assertSee('Structural Playground')
        ->assertSee('Alpha')
        ->assertSee('Beta')
        ->assertAttributeDoesntContain('[data-test="login-link"]', 'class', 'text-red-500')
        ->assertScript('window.__hmrLoadCount', 1)
        ->wait(1);

    $patchesAfterInsert = $this->applyEditsAndWait($page, function ($edits): void {
        $edits
            ->insertAfterOnce('<!-- hmr-edit:list -->', "\n            <li data-test=\"item-extra\">Gamma</li>\n")
            ->replaceOnce(
                'class="inline-block px-3 py-1"',
                'class="inline-block px-3 py-1 text-red-500"',
            );
    });

    $page
        ->assertSee('Gamma')
        ->assertAttributeContains('[data-test="login-link"]', 'class', 'text-red-500')
        ->assertScript("window.__reloadPatchedEvents >= {$patchesAfterInsert}", true);

    $patchesAfterRemoval = $this->applyEditsAndWait($page, function ($edits): void {
        $edits
            ->removeOnce('<li data-test="item-extra">Gamma</li>')
            ->replaceOnce(
                'class="inline-block px-3 py-1 text-red-500"',
                'class="inline-block px-3 py-1"',
            );
    });

    $page
        ->assertDontSee('Gamma')
        ->assertAttributeDoesntContain('[data-test="login-link"]', 'class', 'text-red-500')
        ->assertScript("window.__reloadPatchedEvents >= {$patchesAfterRemoval}", true)
        ->assertScript('window.__hmrLoadCount', 1);
});

test('hot reload preserves typed input values during non-input edits', function () {
    $this->initializeBrowserViewData('__reload_browser_input_state_');
    $this->applyFixture('forms/component-auth-form');

    $page = visit($this->routePath)
        ->assertSee('Email address')
        ->assertSee('Log in to your account')
        ->type('email', 'alice@example.com')
        ->assertValue('email', 'alice@example.com');

    $this->applyEditsAndWait($page, function ($edits): void {
        $edits
            ->insertAfterOnce('<!-- hmr-edit:insert -->', "\n        <p data-test=\"notice\">Extra copy</p>\n")
            ->replaceOnce("{{ __('Log in to your account') }}", "{{ __('Sign in now') }}");
    });

    $page
        ->assertSee('Extra copy')
        ->assertSee('Sign in now')
        ->assertValue('email', 'alice@example.com')
        ->assertScript('window.__hmrLoadCount', 1);
});

test('hot reload handles add and removal of trailing content after html close tag', function () {
    $this->initializeBrowserViewData('__reload_browser_after_html_');
    $this->applyFixture('forms/simple-form');

    $page = visit($this->routePath)
        ->assertSee('Email address')
        ->assertDontSee('after-html text')
        ->wait(1);

    $patchesAfterInsert = $this->applyEditsAndWait($page, function ($edits): void {
        $edits->insertAfterOnce('</html>', "\nafter-html text\n");
    });

    $page
        ->assertSee('after-html text')
        ->assertScript("window.__reloadPatchedEvents >= {$patchesAfterInsert}", true)
        ->assertScript('window.__hmrLoadCount', 1);

    $patchesAfterRemoval = $this->applyEditsAndWait($page, function ($edits): void {
        $edits->removeOnce('after-html text');
    });

    $page
        ->assertDontSee('after-html text')
        ->assertScript("window.__reloadPatchedEvents >= {$patchesAfterRemoval}", true);
});

test('hot reload applies data attribute changes on instrumented elements', function () {
    $this->initializeBrowserViewData('__reload_browser_data_attrs_');
    $this->applyFixture('structure/structural-elements');

    $page = visit($this->routePath)
        ->assertAttribute('[data-test="login-link"]', 'data-test', 'login-link')
        ->assertAttributeDoesntContain('[data-test="login-link"]', 'data-state', 'ready')
        ->wait(1);

    $patchesAfterUpdate = $this->applyEditsAndWait($page, function ($edits): void {
        $edits
            ->replaceOnce('data-test="login-link"', 'data-test="login-link-primary" data-state="ready"');
    });

    $page
        ->assertAttribute('[data-test="login-link-primary"]', 'data-test', 'login-link-primary')
        ->assertAttributeContains('[data-test="login-link-primary"]', 'data-state', 'ready')
        ->assertScript("window.__reloadPatchedEvents >= {$patchesAfterUpdate}", true);

    $patchesAfterRevert = $this->applyEditsAndWait($page, function ($edits): void {
        $edits
            ->replaceOnce('data-test="login-link-primary" data-state="ready"', 'data-test="login-link"');
    });

    $page
        ->assertAttribute('[data-test="login-link"]', 'data-test', 'login-link')
        ->assertAttributeDoesntContain('[data-test="login-link"]', 'data-state', 'ready')
        ->assertScript("window.__reloadPatchedEvents >= {$patchesAfterRevert}", true);
});
