<?php

uses(Forte\Reload\Tests\Browser\HmrBrowserTestCase::class);

test('hot reload applies livewire style attribute and keyed list edits', function () {
    $this->initializeBrowserViewData('__reload_browser_livewire_');
    $this->applyFixture('livewire/livewire-elements');

    $page = visit($this->routePath)
        ->assertSee('First task')
        ->assertSee('Dashboard')
        ->assertAttribute('[data-test="livewire-link"]', 'wire:navigate', '')
        ->assertAttributeContains('[data-test="livewire-input"]', 'wire:model.live', 'filters.search')
        ->wait(1);

    $patchesAfterUpdate = $this->applyEditsAndWait($page, function ($edits): void {
        $edits
            ->insertAfterOnce('<!-- hmr-edit:livewire-list -->', "\n            <li wire:key=\"todo-3\" data-test=\"todo-item-3\">Third task</li>\n")
            ->replaceOnce('wire:navigate', 'wire:navigate.hover')
            ->replaceOnce('wire:model.live="filters.search"', 'wire:model.blur="filters.query"')
            ->replaceOnce('Dashboard', 'Go to dashboard');
    });

    $page
        ->assertSee('Third task')
        ->assertSee('Go to dashboard')
        ->assertAttribute('[data-test="livewire-link"]', 'wire:navigate.hover', '')
        ->assertAttributeContains('[data-test="livewire-input"]', 'wire:model.blur', 'filters.query')
        ->assertScript("window.__reloadPatchedEvents >= {$patchesAfterUpdate}", true);

    $patchesAfterRevert = $this->applyEditsAndWait($page, function ($edits): void {
        $edits
            ->removeOnce('<li wire:key="todo-3" data-test="todo-item-3">Third task</li>')
            ->replaceOnce('wire:navigate.hover', 'wire:navigate')
            ->replaceOnce('wire:model.blur="filters.query"', 'wire:model.live="filters.search"')
            ->replaceOnce('Go to dashboard', 'Dashboard');
    });

    $page
        ->assertDontSee('Third task')
        ->assertSee('Dashboard')
        ->assertAttribute('[data-test="livewire-link"]', 'wire:navigate', '')
        ->assertAttributeContains('[data-test="livewire-input"]', 'wire:model.live', 'filters.search')
        ->assertScript("window.__reloadPatchedEvents >= {$patchesAfterRevert}", true)
        ->assertScript('window.__hmrLoadCount', 1);
});

test('hot reload preserves typed input value during livewire style markup edits', function () {
    $this->initializeBrowserViewData('__reload_browser_livewire_input_');
    $this->applyFixture('livewire/livewire-elements');

    $page = visit($this->routePath)
        ->type('search', 'kept-value@example.test')
        ->assertValue('search', 'kept-value@example.test')
        ->wait(1);

    $this->applyEditsAndWait($page, function ($edits): void {
        $edits
            ->replaceOnce('First task', 'Updated first task')
            ->insertAfterOnce('</section>', "\n    <p data-test=\"livewire-note\">Livewire note</p>\n");
    });

    $page
        ->assertSee('Updated first task')
        ->assertSee('Livewire note')
        ->assertValue('search', 'kept-value@example.test')
        ->assertScript('window.__hmrLoadCount', 1);
});
