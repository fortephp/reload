<?php

declare(strict_types=1);

use Forte\Ast\Document\Document;
use Forte\Reload\Instrumentation\ReloadInstrumentation;
use Forte\Reload\ServiceProvider;
use Forte\Reload\Tests\Fixtures\FixturePaths;
use Illuminate\Support\Facades\Blade;
use Illuminate\Support\Facades\View;
use Orchestra\Testbench\Foundation\Application as TestbenchApplication;

$packageRoot = dirname(__DIR__, 3);
require $packageRoot.'/vendor/autoload.php';

$payload = json_decode((string) file_get_contents('php://stdin'), true);

if (! is_array($payload) || ! is_string($payload['template'] ?? null)) {
    fwrite(STDERR, "Invalid payload. Expected JSON: {\"template\": string, \"data\"?: object}\n");
    exit(1);
}

$template = $payload['template'];
$data = is_array($payload['data'] ?? null) ? $payload['data'] : [];

$app = TestbenchApplication::create(options: [
    'extra' => [
        'providers' => array_values(array_filter([
            ServiceProvider::class,
            class_exists(\Livewire\LivewireServiceProvider::class)
                ? \Livewire\LivewireServiceProvider::class
                : null,
        ])),
        'dont-discover' => ['*'],
    ],
    'load_environment_variables' => false,
]);
$buildDir = $packageRoot.'/build/testing';
$fixtureDir = $buildDir.'/reload-js-fixtures';
$compiledDir = $buildDir.'/reload-compiled-views';
$componentDir = FixturePaths::feature('views/components');

foreach ([$buildDir, $fixtureDir, $compiledDir] as $directory) {
    if (! is_dir($directory)) {
        mkdir($directory, 0777, true);
    }
}

$app['config']->set('view.compiled', $compiledDir);
$app['config']->set('app.key', 'base64:'.base64_encode(random_bytes(32)));
$app['config']->set('app.url', 'http://localhost');
$app['config']->set('view.paths', [
    $fixtureDir,
    FixturePaths::feature('views'),
    FixturePaths::browser('views'),
]);
$app['config']->set('reload.enabled', true);

$instrumentation = ReloadInstrumentation::make();

Blade::anonymousComponentPath($componentDir);
Blade::prepareStringsForCompilationUsing(function (string $input) use ($instrumentation): string {
    $path = Blade::getPath();

    if (! $path || ServiceProvider::shouldSkipInstrumentation($input, $path)) {
        return $input;
    }

    $doc = Document::parse($input);

    return $instrumentation->rewrite($doc)->render();
});

$viewName = 'hmr_js_'.str_replace('.', '', uniqid('', true));
$viewPath = $fixtureDir.'/'.$viewName.'.blade.php';

file_put_contents($viewPath, $template);

View::prependLocation($fixtureDir);

foreach (glob($compiledDir.'/*.php') ?: [] as $compiledFile) {
    @unlink($compiledFile);
}

try {
    echo view($viewName, $data)->render();
} catch (Throwable $e) {
    fwrite(STDERR, $e->getMessage().PHP_EOL);
    @unlink($viewPath);
    exit(1);
}

@unlink($viewPath);
