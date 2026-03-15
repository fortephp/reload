<?php

namespace Forte\Reload\Facades;

use Forte\Reload\Support\Runtime;
use Illuminate\Support\Facades\Facade;

/**
 * @method static bool enabled()
 * @method static bool active()
 * @method static void disable()
 * @method static void enable()
 * @method static void setActive(bool $active)
 * @method static bool disabled()
 *
 * @see \Forte\Reload\Support\Runtime
 */
class Reload extends Facade
{
    protected static function getFacadeAccessor(): string
    {
        return Runtime::class;
    }
}
