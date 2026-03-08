<?php

uses(Forte\Reload\Tests\Browser\HmrBrowserTestCase::class);

test('hot reload applies html and body attribute changes without full reload', function () {
    $this->initializeBrowserViewData('__reload_browser_shell_attrs_');
    $this->applyFixture('forms/simple-form');

    $page = visit($this->routePath)
        ->assertScript("document.documentElement.getAttribute('lang')", 'en')
        ->assertScript("document.documentElement.hasAttribute('data-shell')", false)
        ->assertScript("document.body.classList.contains('hmr-shell-ready')", false)
        ->assertScript('window.__hmrLoadCount', 1)
        ->wait(1);

    $patchesAfterUpdate = $this->applyEditsAndWait($page, function ($edits): void {
        $edits
            ->replaceOnce('<html lang="en">', '<html lang="fr" data-shell="ready">')
            ->replaceOnce('<body>', '<body class="hmr-shell-ready" data-body-state="live">');
    });

    $page
        ->assertScript("document.documentElement.getAttribute('lang')", 'fr')
        ->assertScript("document.documentElement.getAttribute('data-shell')", 'ready')
        ->assertScript("document.body.classList.contains('hmr-shell-ready')", true)
        ->assertScript("document.body.getAttribute('data-body-state')", 'live')
        ->assertScript("window.__reloadPatchedEvents >= {$patchesAfterUpdate}", true);

    $patchesAfterRevert = $this->applyEditsAndWait($page, function ($edits): void {
        $edits
            ->replaceOnce('<html lang="fr" data-shell="ready">', '<html lang="en">')
            ->replaceOnce('<body class="hmr-shell-ready" data-body-state="live">', '<body>');
    });

    $page
        ->assertScript("document.documentElement.getAttribute('lang')", 'en')
        ->assertScript("document.documentElement.hasAttribute('data-shell')", false)
        ->assertScript("document.body.classList.contains('hmr-shell-ready')", false)
        ->assertScript("document.body.hasAttribute('data-body-state')", false)
        ->assertScript("window.__reloadPatchedEvents >= {$patchesAfterRevert}", true)
        ->assertScript('window.__hmrLoadCount', 1);
});

test('hot reload applies multi-file changed payloads from data.files list', function () {
    $this->initializeBrowserViewData('__reload_browser_multi_files_');
    $this->applyFixture('forms/multi-file-payload');

    $storageTestingDir = storage_path('framework/testing');
    if (! is_dir($storageTestingDir)) {
        mkdir($storageTestingDir, 0777, true);
    }

    $parentDataPath = $storageTestingDir.DIRECTORY_SEPARATOR.'hmr-parent-copy.txt';
    $partialDataPath = $storageTestingDir.DIRECTORY_SEPARATOR.'hmr-partial-copy.txt';

    try {
        file_put_contents($parentDataPath, "Parent v1\n", LOCK_EX);
        file_put_contents($partialDataPath, "Partial v1\n", LOCK_EX);
        $this->clearHmrCompiledViews();

        $page = visit($this->routePath)
            ->assertSee('Parent v1')
            ->assertSee('Partial v1')
            ->assertScript('window.__hmrLoadCount', 1)
            ->wait(1);

        $before = $this->currentPatchCount($page);

        file_put_contents($parentDataPath, "Parent v2\n", LOCK_EX);
        file_put_contents($partialDataPath, "Partial v2\n", LOCK_EX);
        $this->clearHmrCompiledViews();

        $page->script(
            'if (window.__reloadHandleChangePayload) window.__reloadHandleChangePayload({ '.
            "files: ['testing/hmr-browser.blade.php', 'testing/partials/hmr-dynamic-copy.blade.php'] ".
            '});'
        );

        $this->waitForPatchCountIncreaseFromHotUpdate($page, $before, 12000, false);

        $page
            ->assertSee('Parent v2')
            ->assertSee('Partial v2')
            ->assertScript('window.__hmrLoadCount', 1);
    } finally {
        @unlink($parentDataPath);
        @unlink($partialDataPath);
    }
});

test('hot reload does not clobber runtime-managed html body shell attributes', function () {
    $this->initializeBrowserViewData('__reload_browser_runtime_shell_state_');
    $this->applyFixture('forms/runtime-shell-state');

    $page = visit($this->routePath)
        ->assertSee('Runtime shell state fixture')
        ->assertScript("document.documentElement.classList.contains('runtime-shell-dark')", true)
        ->assertScript("document.body.getAttribute('data-runtime-bg')", 'black')
        ->assertScript('document.body.style.background', 'rgb(0, 0, 0)')
        ->wait(1);

    $page->script('if (window.__reloadPatchNow) window.__reloadPatchNow();');
    $page->wait(1);

    $page
        ->assertScript("document.documentElement.classList.contains('runtime-shell-dark')", true)
        ->assertScript("document.body.getAttribute('data-runtime-bg')", 'black')
        ->assertScript('document.body.style.background', 'rgb(0, 0, 0)')
        ->assertScript('window.__hmrLoadCount', 1);
});

test('hot reload applies trailing content changes from simulated blade change payload', function () {
    $this->initializeBrowserViewData('__reload_browser_trailing_payload_');
    $this->applyFixture('forms/simple-form');

    $page = visit($this->routePath)
        ->assertSee('Email address')
        ->assertDontSee('payload-after-html text')
        ->assertScript('window.__hmrLoadCount', 1)
        ->wait(1);

    $patchesAfterInsert = $this->applyEditsAndWaitForSimulatedHotUpdate(
        $page,
        fn ($edits) => $edits->insertAfterOnce('</html>', "\npayload-after-html text\n"),
        'testing/hmr-browser.blade.php',
    );

    $page
        ->assertSee('payload-after-html text')
        ->assertScript("window.__reloadPatchedEvents >= {$patchesAfterInsert}", true)
        ->assertScript('window.__hmrLoadCount', 1);

    $patchesAfterRemoval = $this->applyEditsAndWaitForSimulatedHotUpdate(
        $page,
        fn ($edits) => $edits->removeOnce('payload-after-html text'),
        'testing/hmr-browser.blade.php',
    );

    $page
        ->assertDontSee('payload-after-html text')
        ->assertScript("window.__reloadPatchedEvents >= {$patchesAfterRemoval}", true)
        ->assertScript('window.__hmrLoadCount', 1);
});

test('hot reload applies trailing content when template ends with a layout component', function () {
    $this->initializeBrowserViewData('__reload_browser_component_layout_trailing_');
    $this->applyFixture('forms/component-layout-trailing');

    $page = visit($this->routePath)
        ->assertSee('Component Layout Trailing Fixture')
        ->assertDontSee('component-layout trailing text')
        ->assertScript('window.__hmrLoadCount', 1)
        ->wait(1);

    $patchesAfterInsert = $this->applyEditsAndWait($page, function ($edits): void {
        $edits->insertAfterOnce('</x-hmr.layout>', "\ncomponent-layout trailing text\n");
    });

    $page
        ->assertSee('component-layout trailing text')
        ->assertScript("window.__reloadPatchedEvents >= {$patchesAfterInsert}", true)
        ->assertScript('window.__hmrLoadCount', 1);

    $patchesAfterRemoval = $this->applyEditsAndWait($page, function ($edits): void {
        $edits->removeOnce('component-layout trailing text');
    });

    $page
        ->assertDontSee('component-layout trailing text')
        ->assertScript("window.__reloadPatchedEvents >= {$patchesAfterRemoval}", true)
        ->assertScript('window.__hmrLoadCount', 1);
});
