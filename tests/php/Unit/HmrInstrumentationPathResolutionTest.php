<?php

use Forte\Reload\Instrumentation\ReloadInstrumentation;

uses(Forte\Reload\Tests\TestCase::class);

test('relative path prefers the outermost workspace root when testbench base_path does not match', function () {
    $workspace = createTempWorkspacePath('reload-workspace-root');
    $target = $workspace.DIRECTORY_SEPARATOR.'packages'.DIRECTORY_SEPARATOR.'hmr'.DIRECTORY_SEPARATOR.'tests'.DIRECTORY_SEPARATOR.'php'.DIRECTORY_SEPARATOR.'Fixtures'.DIRECTORY_SEPARATOR.'Browser'.DIRECTORY_SEPARATOR.'views'.DIRECTORY_SEPARATOR.'testing'.DIRECTORY_SEPARATOR.'livewire'.DIRECTORY_SEPARATOR.'state-panel.blade.php';

    file_put_contents($workspace.DIRECTORY_SEPARATOR.'composer.json', "{}\n");
    ensureDirectoryExists($workspace.DIRECTORY_SEPARATOR.'packages'.DIRECTORY_SEPARATOR.'hmr');
    file_put_contents($workspace.DIRECTORY_SEPARATOR.'packages'.DIRECTORY_SEPARATOR.'hmr'.DIRECTORY_SEPARATOR.'composer.json', "{}\n");
    ensureDirectoryExists(dirname($target));
    file_put_contents($target, "<div>panel</div>\n");

    expect(ReloadInstrumentation::relativePathFor($target))
        ->toBe('packages/hmr/tests/php/Fixtures/Browser/views/testing/livewire/state-panel.blade.php');

    removeDirectory($workspace);
});

test('relative path falls back to the package root when no outer workspace root exists', function () {
    $packageRoot = createTempWorkspacePath('reload-package-root');
    $target = $packageRoot.DIRECTORY_SEPARATOR.'tests'.DIRECTORY_SEPARATOR.'php'.DIRECTORY_SEPARATOR.'Fixtures'.DIRECTORY_SEPARATOR.'Feature'.DIRECTORY_SEPARATOR.'views'.DIRECTORY_SEPARATOR.'livewire-single-file'.DIRECTORY_SEPARATOR.'single-file.blade.php';

    file_put_contents($packageRoot.DIRECTORY_SEPARATOR.'composer.json', "{}\n");
    ensureDirectoryExists(dirname($target));
    file_put_contents($target, "<div>single-file</div>\n");

    expect(ReloadInstrumentation::relativePathFor($target))
        ->toBe('tests/php/Fixtures/Feature/views/livewire-single-file/single-file.blade.php');

    removeDirectory($packageRoot);
});

function createTempWorkspacePath(string $prefix): string
{
    $base = sys_get_temp_dir().DIRECTORY_SEPARATOR.$prefix.'-'.bin2hex(random_bytes(8));
    ensureDirectoryExists($base);

    return $base;
}

function ensureDirectoryExists(string $directory): void
{
    if (! is_dir($directory)) {
        mkdir($directory, 0777, true);
    }
}

function removeDirectory(string $directory): void
{
    if (! is_dir($directory)) {
        return;
    }

    $items = scandir($directory);

    if ($items === false) {
        return;
    }

    foreach ($items as $item) {
        if ($item === '.' || $item === '..') {
            continue;
        }

        $path = $directory.DIRECTORY_SEPARATOR.$item;

        if (is_dir($path)) {
            removeDirectory($path);

            continue;
        }

        @unlink($path);
    }

    @rmdir($directory);
}
