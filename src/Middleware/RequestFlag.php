<?php

namespace Forte\Reload\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequestFlag
{
    private const DEFAULT_MAX_PATCHES = 25;

    public function handle(Request $request, Closure $next): mixed
    {
        $isHmrRequest = $this->isHmrRequest($request);

        app()->instance('reload_hmr', $isHmrRequest);

        $response = $next($request);

        if ($response instanceof Response && $isHmrRequest) {
            $response->headers->set('X-Reload-Max-Patches', (string) $this->resolveMaxPatches());
        }

        return $response;
    }

    public function terminate(Request $request, mixed $response): void
    {
        app()->instance('reload_hmr', false);
    }

    private function isHmrRequest(Request $request): bool
    {
        return $request->header('X-Reload') === '1';
    }

    private function resolveMaxPatches(): int
    {
        $configuredMaxPatches = $this->config('max_patches_before_reload', self::DEFAULT_MAX_PATCHES);
        $maxPatches = is_numeric($configuredMaxPatches) ? (int) $configuredMaxPatches : self::DEFAULT_MAX_PATCHES;

        return $maxPatches > 0 ? $maxPatches : self::DEFAULT_MAX_PATCHES;
    }

    private function config(string $key, mixed $default = null): mixed
    {
        return config("reload.{$key}", $default);
    }
}
