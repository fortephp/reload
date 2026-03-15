<?php

use Forte\Reload\Facades\Reload;
use Forte\Reload\Support\Runtime;

uses(Forte\Reload\Tests\TestCase::class);

test('facade resolves to the runtime singleton', function () {
    Reload::disable();

    expect(app(Runtime::class)->disabled())->toBeTrue();
});

test('facade enabled returns config-driven value', function () {
    config(['reload.enabled' => true]);

    expect(Reload::enabled())->toBeTrue();

    config(['reload.enabled' => false]);

    expect(Reload::enabled())->toBeFalse();
});

test('facade active reflects middleware state', function () {
    expect(Reload::active())->toBeFalse();

    app(Runtime::class)->setActive(true);

    expect(Reload::active())->toBeTrue();
});

test('facade disable suppresses enabled', function () {
    config(['reload.enabled' => true]);

    Reload::disable();

    expect(Reload::enabled())->toBeFalse();

    Reload::enable();

    expect(Reload::enabled())->toBeTrue();
});
