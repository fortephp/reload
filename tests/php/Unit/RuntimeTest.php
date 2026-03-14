<?php

use Forte\Reload\Support\Runtime;

uses(Forte\Reload\Tests\TestCase::class);

test('enabled returns true when config is true', function () {
    config(['reload.enabled' => true]);

    expect(app(Runtime::class)->enabled())->toBeTrue();
});

test('enabled returns false when config is false', function () {
    config(['reload.enabled' => false]);

    expect(app(Runtime::class)->enabled())->toBeFalse();
});

test('enabled auto-enables in local environment when config is null', function () {
    config(['reload.enabled' => null]);
    app()->detectEnvironment(fn () => 'local');

    expect(app(Runtime::class)->enabled())->toBeTrue();
});

test('enabled auto-disables in non-local environment when config is null', function () {
    config(['reload.enabled' => null]);
    app()->detectEnvironment(fn () => 'production');

    expect(app(Runtime::class)->enabled())->toBeFalse();
});

test('disable makes enabled return false regardless of config', function () {
    config(['reload.enabled' => true]);

    $runtime = app(Runtime::class);
    $runtime->disable();

    expect($runtime->enabled())->toBeFalse();
});

test('enable reverses a prior disable call', function () {
    config(['reload.enabled' => true]);

    $runtime = app(Runtime::class);
    $runtime->disable();

    expect($runtime->enabled())->toBeFalse();

    $runtime->enable();

    expect($runtime->enabled())->toBeTrue();
});

test('enable does not force-enable when config is false', function () {
    config(['reload.enabled' => false]);

    $runtime = app(Runtime::class);
    $runtime->enable();

    expect($runtime->enabled())->toBeFalse();
});

test('active returns false by default', function () {
    expect(app(Runtime::class)->active())->toBeFalse();
});

test('setActive true makes active return true', function () {
    $runtime = app(Runtime::class);
    $runtime->setActive(true);

    expect($runtime->active())->toBeTrue();
});

test('setActive false resets active state', function () {
    $runtime = app(Runtime::class);
    $runtime->setActive(true);
    $runtime->setActive(false);

    expect($runtime->active())->toBeFalse();
});

test('disabled reflects the disabled state', function () {
    $runtime = app(Runtime::class);

    expect($runtime->disabled())->toBeFalse();

    $runtime->disable();

    expect($runtime->disabled())->toBeTrue();

    $runtime->enable();

    expect($runtime->disabled())->toBeFalse();
});

test('runtime is bound as a singleton', function () {
    $first = app(Runtime::class);
    $second = app(Runtime::class);

    expect($first)->toBe($second);
});
