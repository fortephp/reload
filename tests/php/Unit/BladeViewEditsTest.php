<?php

use Forte\Reload\Tests\Browser\Support\BladeViewEdits;

uses(Forte\Reload\Tests\TestCase::class);

test('blade view edits apply fluent fixture and edit operations', function () {
    $base = sys_get_temp_dir().DIRECTORY_SEPARATOR.'reload-edits-'.uniqid('', true);
    $fixtures = $base.DIRECTORY_SEPARATOR.'fixtures';
    $working = $base.DIRECTORY_SEPARATOR.'working.blade.php';

    mkdir($fixtures, 0777, true);
    file_put_contents($fixtures.DIRECTORY_SEPARATOR.'sample.blade.php', "alpha\n<!-- marker -->\nbeta");
    file_put_contents($working, 'placeholder');

    $writes = 0;
    $edits = new BladeViewEdits(
        fixturesDirectory: $fixtures,
        workingViewPath: $working,
        afterWrite: function () use (&$writes): void {
            $writes++;
        },
    );

    $edits
        ->fromFixture('sample')
        ->replace('alpha', 'ALPHA')
        ->insertAfter('<!-- marker -->', "\ninserted")
        ->apply();

    $edits
        ->edit()
        ->remove('inserted')
        ->replace('beta', 'BETA')
        ->apply();

    $result = file_get_contents($working);
    expect($result)->toContain('ALPHA')
        ->and($result)->toContain('BETA')
        ->and($result)->not->toContain('inserted')
        ->and($writes)->toBe(2);

    @unlink($fixtures.DIRECTORY_SEPARATOR.'sample.blade.php');
    @unlink($working);
    @rmdir($fixtures);
    @rmdir($base);
});

test('blade view edits fail fast when a needle is missing', function () {
    $base = sys_get_temp_dir().DIRECTORY_SEPARATOR.'reload-edits-'.uniqid('', true);
    $fixtures = $base.DIRECTORY_SEPARATOR.'fixtures';
    $working = $base.DIRECTORY_SEPARATOR.'working.blade.php';

    mkdir($fixtures, 0777, true);
    file_put_contents($fixtures.DIRECTORY_SEPARATOR.'sample.blade.php', 'abc');
    file_put_contents($working, 'abc');

    $edits = new BladeViewEdits(
        fixturesDirectory: $fixtures,
        workingViewPath: $working,
        afterWrite: static fn () => null,
    );

    expect(fn () => $edits->edit()->replace('missing', 'x'))
        ->toThrow(RuntimeException::class, 'Edit needle not found');

    @unlink($fixtures.DIRECTORY_SEPARATOR.'sample.blade.php');
    @unlink($working);
    @rmdir($fixtures);
    @rmdir($base);
});

test('blade view edits support strict single-occurrence operations', function () {
    $base = sys_get_temp_dir().DIRECTORY_SEPARATOR.'reload-edits-'.uniqid('', true);
    $fixtures = $base.DIRECTORY_SEPARATOR.'fixtures';
    $formsFixtures = $fixtures.DIRECTORY_SEPARATOR.'forms';
    $working = $base.DIRECTORY_SEPARATOR.'working.blade.php';

    mkdir($formsFixtures, 0777, true);
    file_put_contents($fixtures.DIRECTORY_SEPARATOR.'single.blade.php', "hello\n<!-- marker -->\nworld");
    file_put_contents($fixtures.DIRECTORY_SEPARATOR.'duplicate.blade.php', "x\nx\n");
    file_put_contents($formsFixtures.DIRECTORY_SEPARATOR.'nested.blade.php', "foo\nbar");
    file_put_contents($working, 'placeholder');

    $edits = new BladeViewEdits(
        fixturesDirectory: $fixtures,
        workingViewPath: $working,
        afterWrite: static fn () => null,
    );

    $edits
        ->fromFixture('single')
        ->insertAfterOnce('<!-- marker -->', "\nINSERT")
        ->insertBefore('world', "before-world\n")
        ->replaceOnce('hello', 'HELLO')
        ->removeOnce('INSERT')
        ->apply();

    $result = file_get_contents($working);
    expect($result)->toContain('HELLO')
        ->and($result)->toContain('before-world')
        ->and($result)->not->toContain('INSERT')
        ->and(fn () => $edits->fromFixture('duplicate')->replaceOnce('x', 'y'))
        ->toThrow(RuntimeException::class, 'Expected exactly one occurrence');

    $edits->fromFixture('forms/nested')->replaceOnce('foo', 'FOO')->apply();
    expect(file_get_contents($working))->toContain('FOO');

    @unlink($fixtures.DIRECTORY_SEPARATOR.'single.blade.php');
    @unlink($fixtures.DIRECTORY_SEPARATOR.'duplicate.blade.php');
    @unlink($formsFixtures.DIRECTORY_SEPARATOR.'nested.blade.php');
    @rmdir($formsFixtures);
    @unlink($working);
    @rmdir($fixtures);
    @rmdir($base);
});

test('blade view edits can target a different working view path', function () {
    $base = sys_get_temp_dir().DIRECTORY_SEPARATOR.'reload-edits-'.uniqid('', true);
    $fixtures = $base.DIRECTORY_SEPARATOR.'fixtures';
    $primaryWorking = $base.DIRECTORY_SEPARATOR.'primary.blade.php';
    $secondaryWorking = $base.DIRECTORY_SEPARATOR.'secondary.blade.php';

    mkdir($fixtures, 0777, true);
    file_put_contents($fixtures.DIRECTORY_SEPARATOR.'sample.blade.php', 'old');
    file_put_contents($primaryWorking, 'primary');
    file_put_contents($secondaryWorking, 'secondary');

    $edits = new BladeViewEdits(
        fixturesDirectory: $fixtures,
        workingViewPath: $primaryWorking,
        afterWrite: static fn () => null,
    );

    $edits
        ->forWorkingViewPath($secondaryWorking)
        ->edit()
        ->replaceOnce('secondary', 'updated-secondary')
        ->apply();

    expect(file_get_contents($primaryWorking))->toBe('primary')
        ->and(file_get_contents($secondaryWorking))->toBe('updated-secondary');

    @unlink($fixtures.DIRECTORY_SEPARATOR.'sample.blade.php');
    @unlink($primaryWorking);
    @unlink($secondaryWorking);
    @rmdir($fixtures);
    @rmdir($base);
});
