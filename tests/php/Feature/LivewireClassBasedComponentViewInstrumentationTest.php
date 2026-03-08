<?php

use Forte\Ast\Document\Document;
use Forte\Reload\Instrumentation\ReloadInstrumentation;
use Forte\Reload\ServiceProvider;
use Forte\Reload\Tests\Fixtures\Browser\Livewire\StatePanel;
use Forte\Reload\Tests\Fixtures\FixturePaths;
use Illuminate\Support\Facades\Blade;
use Illuminate\Support\Facades\View;
use Livewire\Livewire;

uses(Forte\Reload\Tests\TestCase::class);

test('livewire class-based component view elements are tagged with the original source path', function () {
    $this->requireLivewire();

    $instrumentation = ReloadInstrumentation::make();

    Blade::prepareStringsForCompilationUsing(function (string $template) use ($instrumentation): string {
        $path = Blade::getPath();

        if (! $path || ServiceProvider::shouldSkipInstrumentation($template, $path)) {
            return $template;
        }

        $doc = Document::parse($template);

        return $instrumentation->rewrite($doc)->render();
    });

    $browserViewsPath = FixturePaths::browser('views');

    View::prependLocation($browserViewsPath);
    app('view')->addLocation($browserViewsPath);
    Livewire::component('hmr-browser.state-panel', StatePanel::class);

    foreach (glob(storage_path('framework/views/livewire/{classes,views}/*'), GLOB_BRACE) ?: [] as $file) {
        @unlink($file);
    }

    foreach (glob(config('view.compiled').'/*.php') ?: [] as $file) {
        @unlink($file);
    }

    $html = app('livewire')->mount('hmr-browser.state-panel');
    $expectedPath = ReloadInstrumentation::relativePathFor(
        FixturePaths::browser('views/testing/livewire/state-panel.blade.php')
    );

    expect($html)->toContain('Livewire component hydrated')
        ->and($html)->toContain('data-hmr-file="'.$expectedPath.'"')
        ->and($html)->not->toContain('data-hmr-file="storage/framework/views/livewire/views/');
});
