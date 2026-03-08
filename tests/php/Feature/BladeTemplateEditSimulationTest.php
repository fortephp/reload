<?php

use Forte\Ast\Document\Document;
use Forte\Reload\Instrumentation\ReloadInstrumentation;
use Forte\Reload\ServiceProvider;
use Forte\Reload\Tests\Fixtures\FixturePaths;
use Illuminate\Support\Facades\Blade;
use Illuminate\Support\Facades\View;

uses(Forte\Reload\Tests\TestCase::class);

beforeEach(function () {
    $instrumentation = ReloadInstrumentation::make();
    Blade::anonymousComponentPath(FixturePaths::feature('views/components'));

    Blade::prepareStringsForCompilationUsing(function (string $template) use ($instrumentation): string {
        $path = Blade::getPath();

        if (! $path || ServiceProvider::shouldSkipInstrumentation($template, $path)) {
            return $template;
        }

        $doc = Document::parse($template);

        return $instrumentation->rewrite($doc)->render();
    });

    $this->tempViewDir = storage_path('framework/testing/hmr-edit-simulation');
    if (! is_dir($this->tempViewDir)) {
        mkdir($this->tempViewDir, 0777, true);
    }

    View::prependLocation($this->tempViewDir);
});

afterEach(function () {
    foreach (glob($this->tempViewDir.'/*.blade.php') ?: [] as $file) {
        @unlink($file);
    }
});

function renderFreshView(string $viewName): string
{
    $engine = app('view.engine.resolver')->resolve('blade');

    if (method_exists($engine, 'forgetCompiledOrNotExpired')) {
        $engine->forgetCompiledOrNotExpired();
    }

    app('view')->flushState();

    return view($viewName)->render();
}

function beginEndCounts(string $html): array
{
    preg_match_all('/<!--bl:begin id="([^"]+)"/', $html, $begins);
    preg_match_all('/<!--bl:end id="([^"]+)"/', $html, $ends);

    return [array_count_values($begins[1]), array_count_values($ends[1])];
}

test('blade file edit cycle adds and removes plain text safely', function () {
    $viewName = 'hmr-edit-cycle';
    $viewPath = $this->tempViewDir.'/'.$viewName.'.blade.php';

    $initial = editFixture('cycle/edit-cycle-initial');
    $withText = editFixture('cycle/edit-cycle-with-text');
    $afterRemoval = editFixture('cycle/edit-cycle-after-removal');

    file_put_contents($viewPath, $initial);
    $initialHtml = renderFreshView($viewName);

    file_put_contents($viewPath, $withText);
    $withTextHtml = renderFreshView($viewName);

    file_put_contents($viewPath, $afterRemoval);
    $afterRemovalHtml = renderFreshView($viewName);

    expect($initialHtml)->toContain('Log in');
    expect($withTextHtml)->toContain('asdf');
    expect($afterRemovalHtml)->toContain('Log in final');
    expect($afterRemovalHtml)->not->toContain('asdf');

    [$beginCounts, $endCounts] = beginEndCounts($afterRemovalHtml);
    expect($beginCounts)->toEqual($endCounts);
});

test('interpolation edits remain renderable and keep balanced boundaries', function () {
    $viewName = 'hmr-interpolation-edit';
    $viewPath = $this->tempViewDir.'/'.$viewName.'.blade.php';

    $oldTemplate = editFixture('interpolation/interpolation-old');
    $newTemplate = editFixture('interpolation/interpolation-new');

    file_put_contents($viewPath, $oldTemplate);
    $oldHtml = renderFreshView($viewName);

    file_put_contents($viewPath, $newTemplate);
    $newHtml = renderFreshView($viewName);

    expect($oldHtml)->toContain('Log in')
        ->and($newHtml)->toContain('Forgot your password?... well. did you?');

    [$beginCounts, $endCounts] = beginEndCounts($newHtml);
    expect($beginCounts)->toEqual($endCounts);
});

test('raw-text interpolation edits remain renderable and keep marker text out of textarea, pre, and style content', function () {
    $viewName = 'hmr-raw-text-edit';
    $viewPath = $this->tempViewDir.'/'.$viewName.'.blade.php';

    $oldTemplate = editFixture('raw-text/raw-text-elements-old');
    $newTemplate = editFixture('raw-text/raw-text-elements-new');

    file_put_contents($viewPath, $oldTemplate);
    $oldHtml = renderFreshView($viewName);

    file_put_contents($viewPath, $newTemplate);
    $newHtml = renderFreshView($viewName);

    expect($oldHtml)->toContain('Old note body')
        ->and($newHtml)->toContain('Updated note body')
        ->and($newHtml)->toContain("Updated heading\n  updated details")
        ->and($newHtml)->toContain('content: "new badge"')
        ->and($newHtml)->not->toMatch('/<textarea[^>]*>.*bl:begin.*<\/textarea>/s')
        ->and($newHtml)->not->toMatch('/<pre[^>]*>.*bl:begin.*<\/pre>/s')
        ->and($newHtml)->not->toMatch('/<style[^>]*>.*bl:begin.*<\/style>/s');

    [$beginCounts, $endCounts] = beginEndCounts($newHtml);
    expect($beginCounts)->toEqual($endCounts);
});

test('inline script interpolation edits remain renderable and keep marker text out of script content', function () {
    $viewName = 'hmr-inline-script-edit';
    $viewPath = $this->tempViewDir.'/'.$viewName.'.blade.php';

    $oldTemplate = editFixture('script/inline-script-old');
    $newTemplate = editFixture('script/inline-script-new');

    file_put_contents($viewPath, $oldTemplate);
    $oldHtml = renderFreshView($viewName);

    file_put_contents($viewPath, $newTemplate);
    $newHtml = renderFreshView($viewName);

    expect($oldHtml)->toContain('window.__hmrInlineScriptLabel = "old script label";')
        ->and($newHtml)->toContain('window.__hmrInlineScriptLabel = "new script label";')
        ->and($newHtml)->not->toMatch('/<script[^>]*>.*bl:begin.*<\/script>/s');

    [$beginCounts, $endCounts] = beginEndCounts($newHtml);
    expect($beginCounts)->toEqual($endCounts);
});

test('structural and attribute edits remain renderable and keep balanced boundaries', function () {
    $viewName = 'hmr-structural-edit';
    $viewPath = $this->tempViewDir.'/'.$viewName.'.blade.php';

    $oldTemplate = editFixture('structural/structural-old');
    $newTemplate = editFixture('structural/structural-new');

    file_put_contents($viewPath, $oldTemplate);
    $oldHtml = renderFreshView($viewName);

    file_put_contents($viewPath, $newTemplate);
    $newHtml = renderFreshView($viewName);

    expect($oldHtml)->toContain('class="btn"')
        ->and($newHtml)->toContain('class="btn active"')
        ->and($newHtml)->toContain('Beta')
        ->and($newHtml)->toContain('New explanatory copy.');

    [$beginCounts, $endCounts] = beginEndCounts($newHtml);
    expect($beginCounts)->toEqual($endCounts);
});

test('alpine html element edits remain renderable and keep balanced boundaries', function () {
    $viewName = 'hmr-alpine-edit';
    $viewPath = $this->tempViewDir.'/'.$viewName.'.blade.php';

    $oldTemplate = editFixture('alpine/alpine-element-old');
    $newTemplate = editFixture('alpine/alpine-element-new');

    file_put_contents($viewPath, $oldTemplate);
    $oldHtml = renderFreshView($viewName);

    file_put_contents($viewPath, $newTemplate);
    $newHtml = renderFreshView($viewName);

    expect($oldHtml)->toContain('x-data="{ count: 1 }"')
        ->and($newHtml)->toContain('x-data="{ count: 1, ready: true }"')
        ->and($newHtml)->toContain('Updated alpine copy')
        ->and($newHtml)->toContain('Extra alpine node');

    [$beginCounts, $endCounts] = beginEndCounts($newHtml);
    expect($beginCounts)->toEqual($endCounts);
});

test('blade component prop edits remain renderable and keep balanced boundaries', function () {
    $viewName = 'hmr-component-props-edit';
    $viewPath = $this->tempViewDir.'/'.$viewName.'.blade.php';

    $oldTemplate = editFixture('components/component-props-old');
    $newTemplate = editFixture('components/component-props-new');

    file_put_contents($viewPath, $oldTemplate);
    $oldHtml = renderFreshView($viewName);

    file_put_contents($viewPath, $newTemplate);
    $newHtml = renderFreshView($viewName);

    expect($oldHtml)->toContain('Email address')
        ->and($oldHtml)->toContain('type="email"')
        ->and($newHtml)->toContain('Primary email')
        ->and($newHtml)->toContain('type="text"');

    [$beginCounts, $endCounts] = beginEndCounts($newHtml);
    expect($beginCounts)->toEqual($endCounts);
});

test('livewire style element edits remain renderable and keep balanced boundaries', function () {
    $viewName = 'hmr-livewire-edit';
    $viewPath = $this->tempViewDir.'/'.$viewName.'.blade.php';

    $oldTemplate = editFixture('livewire/livewire-element-old');
    $newTemplate = editFixture('livewire/livewire-element-new');

    file_put_contents($viewPath, $oldTemplate);
    $oldHtml = renderFreshView($viewName);

    file_put_contents($viewPath, $newTemplate);
    $newHtml = renderFreshView($viewName);

    expect($oldHtml)->toContain('wire:navigate')
        ->and($oldHtml)->toContain('wire:model.live="filters.search"')
        ->and($newHtml)->toContain('wire:navigate.hover')
        ->and($newHtml)->toContain('wire:model.blur="filters.query"')
        ->and($newHtml)->toContain('Third task');

    [$beginCounts, $endCounts] = beginEndCounts($newHtml);
    expect($beginCounts)->toEqual($endCounts);
});

test('trailing content after html close tag remains renderable and balanced through edit cycle', function () {
    $viewName = 'hmr-trailing-after-html-edit';
    $viewPath = $this->tempViewDir.'/'.$viewName.'.blade.php';

    $initialTemplate = editFixture('trailing/trailing-after-html-initial');
    $withTextTemplate = editFixture('trailing/trailing-after-html-with-text');
    $afterRemovalTemplate = editFixture('trailing/trailing-after-html-after-removal');

    file_put_contents($viewPath, $initialTemplate);
    $initialHtml = renderFreshView($viewName);

    file_put_contents($viewPath, $withTextTemplate);
    $withTextHtml = renderFreshView($viewName);

    file_put_contents($viewPath, $afterRemovalTemplate);
    $afterRemovalHtml = renderFreshView($viewName);

    expect($initialHtml)->not->toContain('after-html text')
        ->and($withTextHtml)->toContain('after-html text')
        ->and($afterRemovalHtml)->not->toContain('after-html text');

    [$beginCounts, $endCounts] = beginEndCounts($afterRemovalHtml);
    expect($beginCounts)->toEqual($endCounts);
});

test('data attribute edits remain renderable and keep balanced boundaries', function () {
    $viewName = 'hmr-data-attribute-edit';
    $viewPath = $this->tempViewDir.'/'.$viewName.'.blade.php';

    $oldTemplate = editFixture('attributes/data-attributes-old');
    $newTemplate = editFixture('attributes/data-attributes-new');

    file_put_contents($viewPath, $oldTemplate);
    $oldHtml = renderFreshView($viewName);

    file_put_contents($viewPath, $newTemplate);
    $newHtml = renderFreshView($viewName);

    expect($oldHtml)->toContain('data-test="login-link"')
        ->and($oldHtml)->toContain('data-mode="default"')
        ->and($newHtml)->toContain('data-test="login-link-primary"')
        ->and($newHtml)->toContain('data-mode="ready"');

    [$beginCounts, $endCounts] = beginEndCounts($newHtml);
    expect($beginCounts)->toEqual($endCounts);
});

test('conditional directive branch toggles remain renderable and keep balanced boundaries', function () {
    $viewName = 'hmr-conditional-directive-edit';
    $viewPath = $this->tempViewDir.'/'.$viewName.'.blade.php';

    $oldTemplate = editFixture('directives/conditional-text-old');
    $newTemplate = editFixture('directives/conditional-text-new');

    file_put_contents($viewPath, $oldTemplate);
    $oldHtml = renderFreshView($viewName);

    file_put_contents($viewPath, $newTemplate);
    $newHtml = renderFreshView($viewName);

    expect($oldHtml)->toContain('Alpha branch')
        ->and($oldHtml)->not->toContain('Beta branch')
        ->and($newHtml)->toContain('Beta branch')
        ->and($newHtml)->not->toContain('Alpha branch');

    [$beginCounts, $endCounts] = beginEndCounts($newHtml);
    expect($beginCounts['directiveBlock:if'] ?? 0)->toBe($endCounts['directiveBlock:if'] ?? 0)
        ->and($beginCounts['directive:endif'] ?? 0)->toBe($endCounts['directive:endif'] ?? 0);
});

function editFixture(string $name): string
{
    $path = FixturePaths::feature("views/edit-simulation/{$name}.blade.php");

    $contents = file_get_contents($path);
    if ($contents === false) {
        throw new RuntimeException("Unable to load edit simulation fixture: {$name}");
    }

    return $contents;
}
