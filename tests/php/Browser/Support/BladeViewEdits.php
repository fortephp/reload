<?php

namespace Forte\Reload\Tests\Browser\Support;

use RuntimeException;

final class BladeViewEdits
{
    private ?string $buffer = null;

    /**
     * @param  callable():void  $afterWrite
     */
    public function __construct(
        private readonly string $fixturesDirectory,
        private readonly string $workingViewPath,
        private readonly mixed $afterWrite,
    ) {}

    public function fromFixture(string $fixtureName): self
    {
        $fixturePath = $this->fixturePath($fixtureName);
        if (! is_file($fixturePath)) {
            throw new RuntimeException("Fixture [{$fixtureName}] does not exist at [{$fixturePath}].");
        }

        $contents = file_get_contents($fixturePath);
        if ($contents === false) {
            throw new RuntimeException("Unable to read fixture [{$fixturePath}].");
        }

        $this->buffer = $contents;

        return $this;
    }

    public function edit(): self
    {
        $contents = file_get_contents($this->workingViewPath);
        if ($contents === false) {
            throw new RuntimeException("Unable to read working view [{$this->workingViewPath}].");
        }

        $this->buffer = $contents;

        return $this;
    }

    public function forWorkingViewPath(string $workingViewPath): self
    {
        return new self(
            fixturesDirectory: $this->fixturesDirectory,
            workingViewPath: $workingViewPath,
            afterWrite: $this->afterWrite,
        );
    }

    public function replace(string $search, string $replace): self
    {
        $this->ensureContains($search, 'replace');
        $this->buffer = str_replace($search, $replace, $this->buffer);

        return $this;
    }

    public function replaceOnce(string $search, string $replace): self
    {
        $this->ensureContains($search, 'replaceOnce');

        $occurrences = substr_count($this->buffer, $search);
        if ($occurrences !== 1) {
            throw new RuntimeException("Expected exactly one occurrence for replaceOnce(), found {$occurrences}: {$search}");
        }

        $this->buffer = str_replace($search, $replace, $this->buffer);

        return $this;
    }

    public function insertAfter(string $needle, string $snippet): self
    {
        $this->ensureContains($needle, 'insertAfter');
        $this->buffer = str_replace($needle, $needle.$snippet, $this->buffer);

        return $this;
    }

    public function insertBefore(string $needle, string $snippet): self
    {
        $this->ensureContains($needle, 'insertBefore');
        $this->buffer = str_replace($needle, $snippet.$needle, $this->buffer);

        return $this;
    }

    public function insertAfterOnce(string $needle, string $snippet): self
    {
        $this->ensureContains($needle, 'insertAfterOnce');

        $occurrences = substr_count($this->buffer, $needle);
        if ($occurrences !== 1) {
            throw new RuntimeException("Expected exactly one occurrence for insertAfterOnce(), found {$occurrences}: {$needle}");
        }

        $this->buffer = str_replace($needle, $needle.$snippet, $this->buffer);

        return $this;
    }

    public function remove(string $snippet): self
    {
        return $this->replace($snippet, '');
    }

    public function removeOnce(string $snippet): self
    {
        return $this->replaceOnce($snippet, '');
    }

    public function apply(): self
    {
        if ($this->buffer === null) {
            throw new RuntimeException('No edit buffer loaded. Call fromFixture() or edit() first.');
        }

        file_put_contents($this->workingViewPath, $this->buffer, LOCK_EX);
        ($this->afterWrite)();

        return $this;
    }

    public function contents(): string
    {
        if ($this->buffer === null) {
            throw new RuntimeException('No edit buffer loaded. Call fromFixture() or edit() first.');
        }

        return $this->buffer;
    }

    private function ensureContains(string $needle, string $operation): void
    {
        if ($this->buffer === null) {
            throw new RuntimeException("No edit buffer loaded before {$operation}().");
        }

        if (! str_contains($this->buffer, $needle)) {
            throw new RuntimeException("Edit needle not found for {$operation}(): {$needle}");
        }
    }

    private function fixturePath(string $fixtureName): string
    {
        return rtrim($this->fixturesDirectory, DIRECTORY_SEPARATOR)
            .DIRECTORY_SEPARATOR
            .$fixtureName
            .'.blade.php';
    }
}
