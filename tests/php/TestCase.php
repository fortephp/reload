<?php

namespace Forte\Reload\Tests;

use Forte\Reload\ServiceProvider;
use Forte\Reload\Tests\Fixtures\FixturePaths;
use Illuminate\Contracts\Console\Kernel;
use Orchestra\Testbench\TestCase as OrchestraTestCase;

abstract class TestCase extends OrchestraTestCase
{
    /**
     * @return array<int, string>
     */
    protected function getPackageProviders($app): array
    {
        $providers = [
            ServiceProvider::class,
        ];

        if (class_exists(\Livewire\LivewireServiceProvider::class)) {
            $providers[] = \Livewire\LivewireServiceProvider::class;
        }

        return $providers;
    }

    protected function getEnvironmentSetUp($app): void
    {
        $app['config']->set('app.key', 'base64:'.base64_encode(random_bytes(32)));
        $app['config']->set('app.url', 'http://localhost');
        $app['config']->set('reload.enabled', true);
        $app['config']->set('view.paths', [
            FixturePaths::feature('views'),
            FixturePaths::browser('views'),
        ]);
        $app['config']->set('view.compiled', $this->compiledViewsPath());
    }

    protected function setUp(): void
    {
        parent::setUp();

        $this->ensureDirectoryExists($this->compiledViewsPath());
        $this->clearCompiledViewsForTestIsolation();

        $this->app->make(Kernel::class)->bootstrap();
    }

    protected function packagePath(string $path = ''): string
    {
        $packageRoot = FixturePaths::packageRoot();

        if ($path === '') {
            return $packageRoot;
        }

        return $packageRoot.DIRECTORY_SEPARATOR.str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $path);
    }

    protected function compiledViewsPath(): string
    {
        $processId = getmypid() ?: 'main';

        return $this->packagePath('build/testing/compiled-views/'.$processId);
    }

    protected function ensureDirectoryExists(string $path): void
    {
        if (! is_dir($path)) {
            mkdir($path, 0777, true);
        }
    }

    protected function clearCompiledViewsForTestIsolation(): void
    {
        foreach (glob($this->compiledViewsPath().DIRECTORY_SEPARATOR.'*.php') ?: [] as $file) {
            @unlink($file);
        }
    }

    protected function livewireAvailable(): bool
    {
        return class_exists(\Livewire\LivewireServiceProvider::class);
    }

    protected function requireLivewire(): void
    {
        if (! $this->livewireAvailable()) {
            $this->markTestSkipped('Livewire is not installed.');
        }
    }
}
