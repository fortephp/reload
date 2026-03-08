<?php

use Forte\Reload\Tests\Browser\Support\BladeViewEdits;
use Forte\Reload\Tests\Browser\Support\HotReloadEdits;

it('delegates apply-style callbacks and returns their patch counts', function () {
    $calls = [];

    $scenario = new HotReloadEdits(
        apply: function (callable $mutate) use (&$calls): int {
            $calls[] = 'apply';

            return 11;
        },
        applyHotUpdate: function (callable $mutate) use (&$calls): int {
            $calls[] = 'hot';

            return 22;
        },
        applySimulatedHotUpdate: function (callable $mutate, array|string|null $changedFiles = null, int $timeoutMs = 8000) use (&$calls): int {
            $calls[] = ['simulated', $changedFiles, $timeoutMs];

            return 33;
        },
        applyFixture: function (string $relativePath, callable $mutate) use (&$calls): int {
            $calls[] = ['fixture', $relativePath];

            return 44;
        },
        applyFixtureHotUpdate: function (string $relativePath, callable $mutate) use (&$calls): int {
            $calls[] = ['fixture-hot', $relativePath];

            return 55;
        },
    );

    expect($scenario->apply(fn (BladeViewEdits $edits) => null))->toBe(11)
        ->and($scenario->applyAndWaitHotUpdate(fn (BladeViewEdits $edits) => null))->toBe(22)
        ->and($scenario->applyAndWaitSimulatedHotUpdate(fn (BladeViewEdits $edits) => null, 'foo.blade.php', 9000))->toBe(33)
        ->and($scenario->applyFixture('components/hmr/input.blade.php', fn (BladeViewEdits $edits) => null))->toBe(44)
        ->and($scenario->applyFixtureAndWaitHotUpdate('components/hmr/input.blade.php', fn (BladeViewEdits $edits) => null))->toBe(55)
        ->and($calls)->toBe([
            'apply',
            'hot',
            ['simulated', 'foo.blade.php', 9000],
            ['fixture', 'components/hmr/input.blade.php'],
            ['fixture-hot', 'components/hmr/input.blade.php'],
        ]);
});

it('swapFixture helpers load fixture contents into the working view', function () {
    $root = sys_get_temp_dir().DIRECTORY_SEPARATOR.'reload-hot-edits-'.uniqid('', true);
    $fixturesDir = $root.DIRECTORY_SEPARATOR.'fixtures';
    $workingPath = $root.DIRECTORY_SEPARATOR.'working.blade.php';
    mkdir($fixturesDir, 0777, true);
    file_put_contents($fixturesDir.DIRECTORY_SEPARATOR.'fixture-a.blade.php', '<div>fixture-a</div>');
    file_put_contents($fixturesDir.DIRECTORY_SEPARATOR.'fixture-b.blade.php', '<div>fixture-b</div>');
    file_put_contents($workingPath, '<div>original</div>');

    $editorFactory = fn (): BladeViewEdits => new BladeViewEdits(
        fixturesDirectory: $fixturesDir,
        workingViewPath: $workingPath,
        afterWrite: static fn () => null,
    );

    $scenario = new HotReloadEdits(
        apply: function (callable $mutate) use ($editorFactory): int {
            $editor = $editorFactory();
            $mutate($editor);
            $editor->apply();

            return 1;
        },
        applyHotUpdate: function (callable $mutate) use ($editorFactory): int {
            $editor = $editorFactory();
            $mutate($editor);
            $editor->apply();

            return 2;
        },
        applySimulatedHotUpdate: function (callable $mutate, array|string|null $changedFiles = null, int $timeoutMs = 8000) use ($editorFactory): int {
            $editor = $editorFactory();
            $mutate($editor);
            $editor->apply();

            return 3;
        },
        applyFixture: fn (string $relativePath, callable $mutate): int => 4,
        applyFixtureHotUpdate: fn (string $relativePath, callable $mutate): int => 5,
    );

    try {
        expect($scenario->swapFixture('fixture-a'))->toBe(1)
            ->and(file_get_contents($workingPath))->toBe('<div>fixture-a</div>')
            ->and($scenario->swapFixtureAndWaitHotUpdate('fixture-b'))->toBe(2)
            ->and(file_get_contents($workingPath))->toBe('<div>fixture-b</div>')
            ->and($scenario->swapFixtureAndWaitSimulatedHotUpdate('fixture-a', 'testing/hmr-browser.blade.php', 1200))->toBe(3)
            ->and(file_get_contents($workingPath))->toBe('<div>fixture-a</div>');
    } finally {
        @unlink($fixturesDir.DIRECTORY_SEPARATOR.'fixture-a.blade.php');
        @unlink($fixturesDir.DIRECTORY_SEPARATOR.'fixture-b.blade.php');
        @unlink($workingPath);
        @rmdir($fixturesDir);
        @rmdir($root);
    }
});
