<?php

use Forte\Reload\Middleware\RequestFlag;
use Forte\Reload\Support\Runtime;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

uses(Forte\Reload\Tests\TestCase::class);

test('sets active state when X-Reload header is 1', function () {
    $middleware = new RequestFlag;
    $request = Request::create('/test', 'GET');
    $request->headers->set('X-Reload', '1');

    $response = $middleware->handle($request, fn () => new Response('ok'));

    expect(app(Runtime::class)->active())->toBeTrue()
        ->and($response->headers->get('X-Reload-Max-Patches'))->toBe('25');
});

test('sets active false when header is absent', function () {
    $middleware = new RequestFlag;
    $request = Request::create('/test', 'GET');

    $response = $middleware->handle($request, fn () => new Response('ok'));

    expect(app(Runtime::class)->active())->toBeFalse()
        ->and($response->headers->has('X-Reload-Max-Patches'))->toBeFalse();
});

test('sets active false when header value is not 1', function () {
    $middleware = new RequestFlag;
    $request = Request::create('/test', 'GET');
    $request->headers->set('X-Reload', '0');

    $response = $middleware->handle($request, fn () => new Response('ok'));

    expect(app(Runtime::class)->active())->toBeFalse()
        ->and($response->headers->has('X-Reload-Max-Patches'))->toBeFalse();
});

test('passes request through to next middleware', function () {
    $middleware = new RequestFlag;
    $request = Request::create('/test', 'GET');

    $response = $middleware->handle($request, fn () => new Response('passed'));

    expect($response->getContent())->toBe('passed');
});

test('terminate clears active state between requests', function () {
    $middleware = new RequestFlag;
    $request = Request::create('/test', 'GET');
    $request->headers->set('X-Reload', '1');
    $response = new Response('ok');

    $middleware->handle($request, fn () => $response);

    expect(app(Runtime::class)->active())->toBeTrue();

    $middleware->terminate($request, $response);

    expect(app(Runtime::class)->active())->toBeFalse();
});

test('uses configured max patch limit header for hmr requests', function () {
    config(['reload.max_patches_before_reload' => 7]);

    $middleware = new RequestFlag;
    $request = Request::create('/test', 'GET');
    $request->headers->set('X-Reload', '1');

    $response = $middleware->handle($request, fn () => new Response('ok'));

    expect($response->headers->get('X-Reload-Max-Patches'))->toBe('7');
});

test('falls back to default max patch limit when configured value is invalid', function () {
    config(['reload.max_patches_before_reload' => 0]);

    $middleware = new RequestFlag;
    $request = Request::create('/test', 'GET');
    $request->headers->set('X-Reload', '1');

    $response = $middleware->handle($request, fn () => new Response('ok'));

    expect($response->headers->get('X-Reload-Max-Patches'))->toBe('25');
});
