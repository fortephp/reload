<?php

namespace Forte\Reload\Tests\Browser\Support;

use Closure;

class HotReloadEdits
{
    private Closure $apply;

    private Closure $applyHotUpdate;

    private Closure $applySimulatedHotUpdate;

    private Closure $applyFixture;

    private Closure $applyFixtureHotUpdate;

    public function __construct(
        callable $apply,
        callable $applyHotUpdate,
        callable $applySimulatedHotUpdate,
        callable $applyFixture,
        callable $applyFixtureHotUpdate,
    ) {
        $this->apply = Closure::fromCallable($apply);
        $this->applyHotUpdate = Closure::fromCallable($applyHotUpdate);
        $this->applySimulatedHotUpdate = Closure::fromCallable($applySimulatedHotUpdate);
        $this->applyFixture = Closure::fromCallable($applyFixture);
        $this->applyFixtureHotUpdate = Closure::fromCallable($applyFixtureHotUpdate);
    }

    /**
     * @param  callable(BladeViewEdits):void  $mutate
     */
    public function apply(callable $mutate): int
    {
        return ($this->apply)($mutate);
    }

    /**
     * @param  callable(BladeViewEdits):void  $mutate
     */
    public function applyAndWaitHotUpdate(callable $mutate): int
    {
        return ($this->applyHotUpdate)($mutate);
    }

    /**
     * @param  callable(BladeViewEdits):void  $mutate
     * @param  array<int, string>|string|null  $changedFiles
     */
    public function applyAndWaitSimulatedHotUpdate(callable $mutate, array|string|null $changedFiles = null, int $timeoutMs = 8000): int
    {
        return ($this->applySimulatedHotUpdate)($mutate, $changedFiles, $timeoutMs);
    }

    /**
     * @param  callable(BladeViewEdits):void  $mutate
     */
    public function applyFixture(string $relativePath, callable $mutate): int
    {
        return ($this->applyFixture)($relativePath, $mutate);
    }

    /**
     * @param  callable(BladeViewEdits):void  $mutate
     */
    public function applyFixtureAndWaitHotUpdate(string $relativePath, callable $mutate): int
    {
        return ($this->applyFixtureHotUpdate)($relativePath, $mutate);
    }

    public function swapFixture(string $fixtureName): int
    {
        return $this->apply(function (BladeViewEdits $edits) use ($fixtureName): void {
            $edits->fromFixture($fixtureName);
        });
    }

    public function swapFixtureAndWaitHotUpdate(string $fixtureName): int
    {
        return $this->applyAndWaitHotUpdate(function (BladeViewEdits $edits) use ($fixtureName): void {
            $edits->fromFixture($fixtureName);
        });
    }

    /**
     * @param  array<int, string>|string|null  $changedFiles
     */
    public function swapFixtureAndWaitSimulatedHotUpdate(string $fixtureName, array|string|null $changedFiles = null, int $timeoutMs = 8000): int
    {
        return $this->applyAndWaitSimulatedHotUpdate(
            function (BladeViewEdits $edits) use ($fixtureName): void {
                $edits->fromFixture($fixtureName);
            },
            $changedFiles,
            $timeoutMs,
        );
    }
}
