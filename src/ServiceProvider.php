<?php

namespace Forte\Reload;

use Closure;
use Forte\Ast\Document\Document;
use Forte\Reload\Instrumentation\ReloadInstrumentation;
use Forte\Reload\Middleware\RequestFlag;
use Forte\Reload\Support\Runtime;
use Forte\Rewriting\Passes\Instrumentation;
use Illuminate\Foundation\Http\Kernel;
use Illuminate\Support\Facades\Blade;
use Illuminate\Support\ServiceProvider as LaravelServiceProvider;
use Illuminate\View\Compilers\BladeCompiler;
use Livewire\Compiler\Compiler as LivewireCompiler;
use RuntimeException;

class ServiceProvider extends LaravelServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__.'/../config/reload.php', 'reload');
    }

    public function boot(): void
    {
        $this->publishConfig();

        if (! Runtime::enabled()) {
            return;
        }

        $this->registerInstrumentation();
        $this->registerMiddleware();
    }

    private function publishConfig(): void
    {
        $this->publishes([
            __DIR__.'/../config/reload.php' => config_path('reload.php'),
        ], 'reload-config');
    }

    private function registerInstrumentation(): void
    {
        $configuredConstructs = $this->config('constructs', []);
        /** @var array<string, mixed> $constructs */
        $constructs = is_array($configuredConstructs) ? $configuredConstructs : [];
        $instrumentation = ReloadInstrumentation::make($constructs);

        Blade::prepareStringsForCompilationUsing(function (string $template) use ($instrumentation): string {
            $path = Blade::getPath();

            return $this->instrumentTemplate($template, $instrumentation, $path);
        });

        $livewireCompiler = $this->livewireCompiler();

        if ($livewireCompiler !== null) {
            $livewireCompiler->prepareViewsForCompilationUsing(function (string $template, string $path) use ($instrumentation): string {
                if (! $this->isLivewireSingleFileComponentSource($path, $template)) {
                    return $template;
                }

                return $this->instrumentLivewireSingleFileTemplate($template, $instrumentation, $path);
            });
        }
    }

    public static function shouldSkipInstrumentation(string $template, ?string $path = null, ?bool $includeVendorViews = null): bool
    {
        if (self::containsLaravelExceptionRendererMarkup($template)) {
            return true;
        }

        if ($path === null) {
            return false;
        }

        $normalized = str_replace('\\', '/', $path);

        if (str_contains($normalized, '/laravel/framework/src/Illuminate/Foundation/resources/exceptions/')) {
            return true;
        }

        $includeVendorViews ??= (bool) config('reload.include_vendor_views', false);

        return ! $includeVendorViews && str_contains($normalized, '/vendor/');
    }

    private function registerMiddleware(): void
    {
        $kernel = $this->app->make(Kernel::class);
        $kernel->pushMiddleware(RequestFlag::class);
    }

    private function config(string $key, mixed $default = null): mixed
    {
        return config("reload.{$key}", $default);
    }

    private static function containsLaravelExceptionRendererMarkup(string $template): bool
    {
        return str_contains($template, 'laravel-exceptions-renderer::')
            || str_contains($template, '<x-laravel-exceptions-renderer::')
            || str_contains($template, 'laravel-exceptions::')
            || str_contains($template, '<x-laravel-exceptions::');
    }

    private function instrumentTemplate(string $template, Instrumentation $instrumentation, ?string $path = null): string
    {
        if (! $path || self::shouldSkipInstrumentation($template, $path)) {
            return $template;
        }

        return $this->withBladeCompilerPath($path, function () use ($template, $instrumentation): string {
            $doc = Document::parse($template);

            return $instrumentation->rewrite($doc)->render();
        });
    }

    private function instrumentLivewireSingleFileTemplate(string $template, Instrumentation $instrumentation, string $path): string
    {
        if (! preg_match('/\A(\s*<\?php\s*.*?\?>)(.*)\z/s', $template, $matches)) {
            return $this->instrumentTemplate($template, $instrumentation, $path);
        }

        $classPortion = $matches[1];
        $viewPortion = $matches[2];

        if (trim($viewPortion) === '') {
            return $template;
        }

        return $classPortion.$this->instrumentTemplate($viewPortion, $instrumentation, $path);
    }

    private function isLivewireSingleFileComponentSource(string $path, string $template): bool
    {
        return str_ends_with(str_replace('\\', '/', $path), '.blade.php')
            && preg_match('/<\?php.*new\s+.*class/s', $template) === 1;
    }

    /**
     * @param  Closure(): string  $callback
     */
    private function withBladeCompilerPath(string $path, Closure $callback): string
    {
        $compiler = $this->bladeCompiler();
        $previousPath = $compiler->getPath();

        $compiler->setPath($path);

        try {
            return $callback();
        } finally {
            $compiler->setPath($previousPath);
        }
    }

    private function bladeCompiler(): BladeCompiler
    {
        $compiler = app('blade.compiler');

        if (! $compiler instanceof BladeCompiler) {
            throw new RuntimeException('Reload expected the Blade compiler to be bound.');
        }

        return $compiler;
    }

    private function livewireCompiler(): ?LivewireCompiler
    {
        if (! app()->bound('livewire.compiler')) {
            return null;
        }

        $compiler = app('livewire.compiler');

        if (! class_exists(LivewireCompiler::class) || ! $compiler instanceof LivewireCompiler) {
            return null;
        }

        return $compiler;
    }
}
