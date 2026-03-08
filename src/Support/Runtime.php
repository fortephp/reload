<?php

namespace Forte\Reload\Support;

class Runtime
{
    public static function active(): bool
    {
        return app()->bound('reload_hmr') && app('reload_hmr') === true;
    }

    public static function enabled(): bool
    {
        $enabled = config('reload.enabled');

        if ($enabled === null) {
            return (bool) app()->environment('local');
        }

        return (bool) $enabled;
    }
}
