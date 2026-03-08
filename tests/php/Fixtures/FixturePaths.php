<?php

namespace Forte\Reload\Tests\Fixtures;

final class FixturePaths
{
    public static function packageRoot(string $path = ''): string
    {
        return self::join(dirname(__DIR__, 3), $path);
    }

    public static function root(string $path = ''): string
    {
        return self::join(__DIR__, $path);
    }

    public static function browser(string $path = ''): string
    {
        return self::root(self::join('Browser', $path));
    }

    public static function feature(string $path = ''): string
    {
        return self::root(self::join('Feature', $path));
    }

    private static function join(string $base, string $path = ''): string
    {
        if ($path === '') {
            return $base;
        }

        return rtrim($base, DIRECTORY_SEPARATOR)
            .DIRECTORY_SEPARATOR
            .str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $path);
    }
}
