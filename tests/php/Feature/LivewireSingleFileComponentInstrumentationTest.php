<?php

use Forte\Ast\Document\Document;
use Forte\Reload\Instrumentation\ReloadInstrumentation;
use Forte\Reload\ServiceProvider;
use Forte\Reload\Tests\Fixtures\FixturePaths;
use Illuminate\Support\Facades\Blade;

uses(Forte\Reload\Tests\TestCase::class);

test('livewire single-file component elements are tagged with the original source path', function () {
    $this->requireLivewire();

    $componentLocation = FixturePaths::feature('views/livewire-single-file');

    $instrumentation = ReloadInstrumentation::make();

    Blade::prepareStringsForCompilationUsing(function (string $template) use ($instrumentation): string {
        $path = Blade::getPath();

        if (! $path || ServiceProvider::shouldSkipInstrumentation($template, $path)) {
            return $template;
        }

        $doc = Document::parse($template);

        return $instrumentation->rewrite($doc)->render();
    });

    config()->set('livewire.component_locations', array_values(array_unique(array_merge(
        config('livewire.component_locations', []),
        [$componentLocation],
    ))));

    app('livewire.finder')->addLocation(viewPath: $componentLocation);
    app('blade.compiler')->anonymousComponentPath($componentLocation);
    app('view')->addLocation($componentLocation);

    foreach (glob(storage_path('framework/views/livewire/{classes,views}/*'), GLOB_BRACE) ?: [] as $file) {
        @unlink($file);
    }

    foreach (glob(config('view.compiled').'/*.php') ?: [] as $file) {
        @unlink($file);
    }

    $html = app('livewire')->mount('hmr-source-mapped');
    $expectedPath = ReloadInstrumentation::relativePathFor(
        FixturePaths::feature('views/livewire-single-file/⚡hmr-source-mapped.blade.php')
    );

    expect($html)->toContain('Single-file component source mapping')
        ->and($html)->toContain('data-hmr-file="'.$expectedPath.'"')
        ->and($html)->not->toContain('data-hmr-file="storage/framework/views/livewire/views/');
});
