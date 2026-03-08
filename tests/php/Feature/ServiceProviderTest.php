<?php

use Forte\Reload\ServiceProvider;

uses(Forte\Reload\Tests\TestCase::class);

test('service provider does not register a script asset publish tag', function () {
    $assetPublishes = ServiceProvider::pathsToPublish(
        ServiceProvider::class,
        'reload-assets',
    );

    expect($assetPublishes)->toBeArray()->toBeEmpty();
});

test('service provider registers config publish tag', function () {
    $configPublishes = ServiceProvider::pathsToPublish(
        ServiceProvider::class,
        'reload-config',
    );

    expect($configPublishes)->toBeArray()->not->toBeEmpty()
        ->and(array_values($configPublishes))->toContain(config_path('reload.php'));
});

test('service provider detects laravel exception templates for instrumentation skip', function () {
    expect(ServiceProvider::shouldSkipInstrumentation('<div class="laravel-exceptions"></div>'))->toBeFalse()
        ->and(ServiceProvider::shouldSkipInstrumentation('<x-laravel-exceptions-renderer::layout />'))->toBeTrue()
        ->and(ServiceProvider::shouldSkipInstrumentation("@extends('laravel-exceptions::layout')"))->toBeTrue()
        ->and(ServiceProvider::shouldSkipInstrumentation('<div>ok</div>', '/vendor/laravel/framework/src/Illuminate/Foundation/resources/exceptions/renderer.blade.php'))->toBeTrue()
        ->and(ServiceProvider::shouldSkipInstrumentation('<div>ok</div>', '/app/resources/views/welcome.blade.php'))->toBeFalse();
});

test('service provider skips vendor views unless include_vendor_views is enabled', function () {
    $vendorPath = base_path('vendor/acme/package/resources/views/widget.blade.php');

    expect(ServiceProvider::shouldSkipInstrumentation('<div>ok</div>', $vendorPath, false))->toBeTrue()
        ->and(ServiceProvider::shouldSkipInstrumentation('<div>ok</div>', $vendorPath, true))->toBeFalse();
});
