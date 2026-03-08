<?php

use Forte\Reload\Middleware\RequestFlag;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

uses(Forte\Reload\Tests\TestCase::class);

test('sets reload_hmr instance when X-Reload header is 1', function () {
    $middleware = new RequestFlag;
    $request = Request::create('/test', 'GET');
    $request->headers->set('X-Reload', '1');

    $response = $middleware->handle($request, fn () => new Response('ok'));

    expect(app()->bound('reload_hmr'))->toBeTrue()
        ->and(app('reload_hmr'))->toBeTrue()
        ->and($response->headers->get('X-Reload-Max-Patches'))->toBe('25');
});

test('sets reload_hmr false when header is absent', function () {
    $middleware = new RequestFlag;
    $request = Request::create('/test', 'GET');

    $response = $middleware->handle($request, fn () => new Response('ok'));

    expect(app()->bound('reload_hmr'))->toBeTrue()
        ->and(app('reload_hmr'))->toBeFalse()
        ->and($response->headers->has('X-Reload-Max-Patches'))->toBeFalse();
});

test('sets reload_hmr false when header value is not 1', function () {
    $middleware = new RequestFlag;
    $request = Request::create('/test', 'GET');
    $request->headers->set('X-Reload', '0');

    $response = $middleware->handle($request, fn () => new Response('ok'));

    expect(app()->bound('reload_hmr'))->toBeTrue()
        ->and(app('reload_hmr'))->toBeFalse()
        ->and($response->headers->has('X-Reload-Max-Patches'))->toBeFalse();
});

test('passes request through to next middleware', function () {
    $middleware = new RequestFlag;
    $request = Request::create('/test', 'GET');

    $response = $middleware->handle($request, fn () => new Response('passed'));

    expect($response->getContent())->toBe('passed');
});

test('terminate clears reload_hmr instance between requests', function () {
    $middleware = new RequestFlag;
    $request = Request::create('/test', 'GET');
    $request->headers->set('X-Reload', '1');
    $response = new Response('ok');

    $middleware->handle($request, fn () => $response);

    expect(app('reload_hmr'))->toBeTrue();

    $middleware->terminate($request, $response);

    expect(app('reload_hmr'))->toBeFalse();
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
