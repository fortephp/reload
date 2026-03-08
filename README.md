# Reload

Reload is an experimental package that adds hot reload functionality for Laravel Blade.

## Installation

To install Reload, run the following from the root of your project:

```bash
composer require fortephp/reload --dev
```

If you want to customize the package config, you may publish it by running:

```bash
php artisan vendor:publish --tag=reload-config
```

## Vite Setup

Import the plugin from Composer `vendor`:

```js
// vite.config.js
import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import reload from './vendor/fortephp/reload/resources/js/vite-plugin.js';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/js/app.js'],
            refresh: true,
        }),
        reload(),
    ],
});
```

Reload watches `resources/views/**/*.blade.php` by default.

If your Blade files live elsewhere, add more watch patterns:

```js
reload({
    watch: [
        'resources/views/**/*.blade.php',
        'packages/**/resources/views/**/*.blade.php'
    ],
})
```

The plugin also injects the Reload runtime into `resources/js/app.js` and `resources/js/app.ts` by default. If your app uses different entry files, configure `entries`:

```js
reload({
    entries: ['resources/js/admin.js'],
})
```

Available plugin options:

- `watch`: Additional Blade globs to watch.
- `log`: Set to `false` to silence Reload logs.

## Configuration

The package config lives at `config/reload.php`.

- `enabled`: `null` by default, which enables Reload automatically in the local environment. Set it to `true` or `false` to force the behavior.
- `constructs`: Controls which Blade constructs are instrumented. Available flags are `elements`, `components`, `directives`, `directive_blocks`, and `includes`.
- `include_vendor_views`: Includes vendor Blade views in instrumentation when set to `true`.
- `max_patches_before_reload`: The maximum number of incremental patches Reload will attempt before falling back to a full refresh.

## Reporting Issues

When reporting issues, please include all necessary steps to reproduce the issue. Linking to a small repository that contains the setup to reproduce the helps a lot. Include any dependencies required to reproduce the bug.

## License

Reload is free software, released under the MIT license.
