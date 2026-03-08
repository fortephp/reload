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

    Blade::prepareStringsForCompilationUsing(function (string $template) use ($instrumentation): string {
        $path = Blade::getPath();

        if (! $path || ServiceProvider::shouldSkipInstrumentation($template, $path)) {
            return $template;
        }

        $doc = Document::parse($template);

        return $instrumentation->rewrite($doc)->render();
    });

    View::addLocation(FixturePaths::feature('views'));
});

test('compiled Blade view contains comment boundary markers for components', function () {
    $html = view('hmr-test-component')->render();

    expect($html)->toContain('<!--bl:begin id="component:')
        ->and($html)->toContain('<!--bl:end id="component:')
        ->and($html)->toMatch('/<!--bl:begin id="component:[^"]+" key="[a-f0-9]{16}" file="[^"]+"-->/')
        ->and($html)->toMatch('/<!--bl:end id="component:[^"]+" key="[a-f0-9]{16}"-->/');
});

test('compiled Blade view contains data-hmr-id attributes for elements', function () {
    $html = view('hmr-test-elements')->render();

    expect($html)->toContain('data-hmr-id="element:div"')
        ->and($html)->toContain('data-hmr-id="element:span"');
});

test('structural elements do not get data-hmr-id', function () {
    $html = view('hmr-test-document')->render();
    expect($html)->not->toMatch('/\<html[^>]*data-hmr-id/')
        ->and($html)->not->toMatch('/\<head[^>]*data-hmr-id/')
        ->and($html)->toMatch('/\<body[^>]*data-hmr-id="element:body"/');
});

test('non-framework templates containing laravel-exceptions content are still instrumented', function () {
    $html = view('hmr-test-laravel-exception')->render();

    expect($html)->toContain('data-hmr-id=');
});

test('laravel exception renderer namespace markup is skipped without relying on file path', function () {
    $instrumentation = ReloadInstrumentation::make();
    $template = '<x-laravel-exceptions-renderer::layout><div>Whoops</div></x-laravel-exceptions-renderer::layout>';
    $output = ServiceProvider::shouldSkipInstrumentation($template, null)
        ? $template
        : $instrumentation->rewrite(Document::parse($template))->render();

    expect($output)->not->toContain('data-hmr-id=')
        ->and($output)->not->toContain('<!--bl:begin');
});
