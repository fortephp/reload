<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Reload Enabled
    |--------------------------------------------------------------------------
    |
    | When set to null, Reload automatically enables itself in local
    | environments. Set this to true or false to force the behavior.
    |
    */

    'enabled' => env('RELOAD_ENABLED', null),

    /*
    |--------------------------------------------------------------------------
    | Instrumented Blade Constructs
    |--------------------------------------------------------------------------
    |
    | Reload can instrument Blade elements, components, directives, and
    | directive blocks. If directives are disabled, you may still enable
    | include-like directives separately.
    |
    */

    'constructs' => [
        'elements' => true,
        'components' => true,
        'directives' => true,
        'directive_blocks' => true,
        'includes' => false,
    ],

    /*
    |--------------------------------------------------------------------------
    | Vendor View Instrumentation
    |--------------------------------------------------------------------------
    |
    | By default, Reload ignores vendor views and only
    | instruments your application's Blade templates.
    |
    */

    'include_vendor_views' => false,

    /*
    |--------------------------------------------------------------------------
    | Maximum Incremental Patches
    |--------------------------------------------------------------------------
    |
    | Reload falls back to a full page refresh when a single
    | hot update would require more than this many patches.
    |
    */

    'max_patches_before_reload' => 25,

];
