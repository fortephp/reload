<?php

namespace Forte\Reload\Tests\Browser;

use Forte\Ast\Document\Document;
use Forte\Reload\Instrumentation\ReloadInstrumentation;
use Forte\Reload\ServiceProvider;
use Forte\Reload\Tests\Browser\Support\BladeViewEdits;
use Forte\Reload\Tests\Browser\Support\HotReloadEdits;
use Forte\Reload\Tests\Fixtures\Browser\Livewire\StatePanel;
use Forte\Reload\Tests\Fixtures\FixturePaths;
use Forte\Reload\Tests\TestCase;
use Illuminate\Support\Facades\Blade;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\View;
use JsonException;
use Livewire\Livewire;
use RuntimeException;
use Symfony\Component\Process\Process;

abstract class HmrBrowserTestCase extends TestCase
{
    protected array $browserViewData = [];

    protected string $viewName = 'testing.hmr-browser';

    protected string $routePath = '/__hmr-browser';

    protected string $viteDevUrl = '';

    protected BladeViewEdits $fixtureEditor;

    protected string $fixturesRoot = '';

    protected string $workingViewPath = '';

    private string $originalWorkingView = '';

    /**
     * @var array<string, string>
     */
    private array $fileRestoreMap = [];

    private static ?Process $viteProcess = null;

    private static ?string $projectRoot = null;

    /**
     * @var array<int, true>
     */
    private static array $preparedBladeCompilers = [];

    private static bool $viteEntriesPrewarmed = false;

    protected function setUp(): void
    {
        parent::setUp();
        $this->requireLivewire();
        $this->ensureViteServerRunning();
        $this->prepareBladeInstrumentation();

        $this->fixturesRoot = FixturePaths::browser('views');
        $this->workingViewPath = $this->fixturesRoot.DIRECTORY_SEPARATOR.'testing'.DIRECTORY_SEPARATOR.'hmr-browser.blade.php';
        $this->originalWorkingView = (string) file_get_contents($this->workingViewPath);

        $this->fixtureEditor = new BladeViewEdits(
            fixturesDirectory: $this->fixturesRoot.DIRECTORY_SEPARATOR.'fixtures',
            workingViewPath: $this->workingViewPath,
            afterWrite: function (): void {
                $this->afterFixtureWrite();
            },
        );

        $this->viteDevUrl = $this->resolveViteDevUrl();
        $this->prewarmViteEntries();
        View::prependLocation($this->fixturesRoot);
        Livewire::component('hmr-browser.state-panel', StatePanel::class);

        Route::middleware('web')
            ->get($this->routePath, fn () => view($this->viewName, $this->browserViewData));

        $this->clearHmrCompiledViews();
    }

    protected function tearDown(): void
    {
        foreach ($this->fileRestoreMap as $path => $contents) {
            file_put_contents($path, $contents, LOCK_EX);
        }
        $this->fileRestoreMap = [];

        if ($this->workingViewPath !== '' && $this->originalWorkingView !== '') {
            file_put_contents($this->workingViewPath, $this->originalWorkingView, LOCK_EX);
        }

        $this->clearHmrCompiledViews();

        parent::tearDown();
    }

    protected function applyFixture(string $fixtureName): void
    {
        $this->fixtureEditor->fromFixture($fixtureName)->apply();
    }

    protected function hotReload($page): HotReloadEdits
    {
        return new HotReloadEdits(
            apply: fn (callable $mutate): int => $this->applyEditsAndWait($page, $mutate),
            applyHotUpdate: fn (callable $mutate): int => $this->applyEditsAndWaitForHotUpdate($page, $mutate),
            applySimulatedHotUpdate: fn (callable $mutate, array|string|null $changedFiles = null, int $timeoutMs = 8000): int => $this->applyEditsAndWaitForSimulatedHotUpdate($page, $mutate, $changedFiles, $timeoutMs),
            applyFixture: fn (string $relativePath, callable $mutate): int => $this->applyFixtureFileEditsAndWait($page, $relativePath, $mutate),
            applyFixtureHotUpdate: fn (string $relativePath, callable $mutate): int => $this->applyFixtureFileEditsAndWaitForHotUpdate($page, $relativePath, $mutate),
        );
    }

    protected function initializeBrowserViewData(string $sessionPrefix = '__reload_browser_', array $extra = []): void
    {
        $this->browserViewData = array_merge([
            'sessionKey' => $sessionPrefix.bin2hex(random_bytes(8)),
            'viteDevUrl' => $this->viteDevUrl,
        ], $extra);
    }

    protected function editView(): BladeViewEdits
    {
        return $this->fixtureEditor->edit();
    }

    protected function editFixtureFile(string $relativePath): BladeViewEdits
    {
        $targetPath = $this->resolveFixtureFilePath($relativePath);

        if (! array_key_exists($targetPath, $this->fileRestoreMap)) {
            $original = file_get_contents($targetPath);
            if ($original === false) {
                throw new RuntimeException("Unable to read fixture file [{$targetPath}] for backup.");
            }

            $this->fileRestoreMap[$targetPath] = $original;
        }

        return $this->fixtureEditor
            ->forWorkingViewPath($targetPath)
            ->edit();
    }

    protected function renderBrowserView(): string
    {
        return view($this->viewName, $this->browserViewData)->render();
    }

    protected function clearHmrCompiledViews(): void
    {
        $compiledDir = config('view.compiled');

        if (! $compiledDir || ! is_dir($compiledDir)) {
            return;
        }

        foreach (glob($compiledDir.'/*.php') ?: [] as $file) {
            @unlink($file);
        }
    }

    protected function waitUntil(callable $condition, int $timeoutMs, callable $onTick, string|callable $timeoutMessage): void
    {
        $deadline = microtime(true) + ($timeoutMs / 1000);

        while (microtime(true) < $deadline) {
            if ((bool) $condition()) {
                return;
            }

            $onTick();
        }

        $message = is_string($timeoutMessage) ? $timeoutMessage : $timeoutMessage();
        throw new RuntimeException($message);
    }

    protected function waitForPatchCountIncrease($page, int $previousCount, int $timeoutMs = 8000): void
    {
        $this->waitForRuntimeReady($page);
        $page->script('if (window.__reloadPatchNow) window.__reloadPatchNow();');
        $nextTriggerAt = microtime(true) + 0.6;
        $this->waitUntil(
            condition: fn (): bool => ((int) $page->script('window.__reloadPatchedEvents || 0')) > $previousCount,
            timeoutMs: $timeoutMs,
            onTick: function () use ($page, &$nextTriggerAt): void {
                if (microtime(true) >= $nextTriggerAt) {
                    $page->script('if (window.__reloadPatchNow) window.__reloadPatchNow();');
                    $nextTriggerAt = microtime(true) + 0.6;
                }
                $page->wait(0.1);
            },
            timeoutMessage: function () use ($page, $previousCount): string {
                $current = (int) $page->script('window.__reloadPatchedEvents || 0');
                $loadCount = (int) $page->script('window.__hmrLoadCount || 0');
                $runtimeReady = (bool) $page->script("typeof window.__reloadPatchNow === 'function'");
                $errorText = trim((string) $page->script(
                    "document.getElementById('reload-error')?.textContent || ''"
                ));

                $suffix = $errorText !== '' ? " Last runtime error: {$errorText}" : '';

                return
                    "Timed out waiting for Reload patch count to exceed {$previousCount}. ".
                    "Current patch count: {$current}. Load count: {$loadCount}. Runtime ready: ".($runtimeReady ? 'yes' : 'no').".{$suffix}";
            },
        );
    }

    protected function waitForPatchCountIncreaseFromHotUpdate($page, int $previousCount, int $timeoutMs = 12000, bool $allowManualFallback = true): void
    {
        $this->waitForRuntimeReady($page);

        try {
            $this->waitUntil(
                condition: fn (): bool => ((int) $page->script('window.__reloadPatchedEvents || 0')) > $previousCount,
                timeoutMs: $timeoutMs,
                onTick: fn (): mixed => $page->wait(0.1),
                timeoutMessage: function () use ($page, $previousCount): string {
                    $current = (int) $page->script('window.__reloadPatchedEvents || 0');
                    $loadCount = (int) $page->script('window.__hmrLoadCount || 0');
                    $errorText = trim((string) $page->script(
                        "document.getElementById('reload-error')?.textContent || ''"
                    ));
                    $suffix = $errorText !== '' ? " Last runtime error: {$errorText}" : '';

                    return
                        "Timed out waiting for websocket-driven Reload patch count to exceed {$previousCount}. ".
                        "Current patch count: {$current}. Load count: {$loadCount}.{$suffix}";
                },
            );
        } catch (RuntimeException $e) {
            if (! $allowManualFallback) {
                throw $e;
            }

            $this->waitForPatchCountIncrease($page, $previousCount);
        }
    }

    protected function waitForRuntimeReady($page, int $timeoutMs = 10000): void
    {
        $this->waitUntil(
            condition: fn (): bool => (bool) $page->script("typeof window.__reloadPatchNow === 'function'"),
            timeoutMs: $timeoutMs,
            onTick: fn (): mixed => $page->wait(0.1),
            timeoutMessage: 'Timed out waiting for Reload runtime to initialize.',
        );
    }

    protected function waitForFrameworkRuntimeReady($page, int $timeoutMs = 10000): void
    {
        $this->waitUntil(
            condition: fn (): bool => (bool) $page->script('Boolean(window.Livewire) && Boolean(window.Alpine)'),
            timeoutMs: $timeoutMs,
            onTick: fn (): mixed => $page->wait(0.1),
            timeoutMessage: 'Timed out waiting for Livewire and Alpine to initialize.',
        );
    }

    protected function waitForAlpineComponentReady($page, string $selector, int $timeoutMs = 10000): void
    {
        $selectorJson = json_encode($selector, JSON_THROW_ON_ERROR);

        $this->waitUntil(
            condition: fn (): bool => (bool) $page->script(
                '(() => {'.
                "const el = document.querySelector({$selectorJson});".
                'return !!el && Boolean(el._x_dataStack || el.__x);'.
                '})()'
            ),
            timeoutMs: $timeoutMs,
            onTick: fn (): mixed => $page->wait(0.1),
            timeoutMessage: "Timed out waiting for Alpine component [{$selector}] to initialize.",
        );
    }

    protected function waitForLivewireComponentReady($page, string $selector, int $timeoutMs = 10000): void
    {
        $selectorJson = json_encode($selector, JSON_THROW_ON_ERROR);

        $this->waitUntil(
            condition: fn (): bool => (bool) $page->script(
                '(() => {'.
                "const el = document.querySelector({$selectorJson});".
                "return !!el && Boolean(el.__livewire || el.getAttribute('wire:id'));".
                '})()'
            ),
            timeoutMs: $timeoutMs,
            onTick: fn (): mixed => $page->wait(0.1),
            timeoutMessage: "Timed out waiting for Livewire component [{$selector}] to initialize.",
        );
    }

    protected function waitForErrorOverlay($page, int $timeoutMs = 10000): void
    {
        $this->waitUntil(
            condition: fn (): bool => (bool) $page->script("Boolean(document.getElementById('reload-error'))"),
            timeoutMs: $timeoutMs,
            onTick: fn (): mixed => $page->wait(0.1),
            timeoutMessage: 'Timed out waiting for Reload error overlay.',
        );
    }

    protected function waitForErrorOverlayToDisappear($page, int $timeoutMs = 10000): void
    {
        $this->waitUntil(
            condition: fn (): bool => ! (bool) $page->script("Boolean(document.getElementById('reload-error'))"),
            timeoutMs: $timeoutMs,
            onTick: fn (): mixed => $page->wait(0.1),
            timeoutMessage: 'Timed out waiting for Reload error overlay to disappear.',
        );
    }

    protected function stabilizeAfterVisit($page, int $timeoutMs = 12000, int $quietMs = 600): void
    {
        $this->waitForRuntimeReady($page, $timeoutMs);

        $lastSignature = null;
        $stableSince = microtime(true);

        $this->waitUntil(
            condition: function () use ($page, $quietMs, &$lastSignature, &$stableSince): bool {
                $signature = json_encode([
                    'loads' => (int) $page->script('window.__hmrLoadCount || 0'),
                    'patches' => (int) $page->script('window.__reloadPatchedEvents || 0'),
                    'error' => (bool) $page->script("Boolean(document.getElementById('reload-error'))"),
                ], JSON_THROW_ON_ERROR);

                if ($signature !== $lastSignature) {
                    $lastSignature = $signature;
                    $stableSince = microtime(true);

                    return false;
                }

                $hasErrorOverlay = (bool) $page->script("Boolean(document.getElementById('reload-error'))");
                if ($hasErrorOverlay) {
                    return false;
                }

                return (microtime(true) - $stableSince) * 1000 >= $quietMs;
            },
            timeoutMs: $timeoutMs,
            onTick: function () use ($page): void {
                if ((bool) $page->script("Boolean(document.getElementById('reload-error'))")) {
                    $page->script('if (window.__reloadPatchNow) window.__reloadPatchNow();');
                }

                $page->wait(0.1);
            },
            timeoutMessage: 'Timed out waiting for browser page state to stabilize after visit.',
        );
    }

    protected function currentPatchCount($page): int
    {
        return (int) $page->script('window.__reloadPatchedEvents || 0');
    }

    protected function waitForTextContent($page, string $selector, string $expected, int $timeoutMs = 10000): void
    {
        $selectorJson = json_encode($selector, JSON_THROW_ON_ERROR);
        $expectedJson = json_encode($expected, JSON_THROW_ON_ERROR);

        $this->waitUntil(
            condition: fn (): bool => (bool) $page->script(
                '(() => {'.
                "const el = document.querySelector({$selectorJson});".
                "return !!el && el.textContent.includes({$expectedJson});".
                '})()'
            ),
            timeoutMs: $timeoutMs,
            onTick: fn (): mixed => $page->wait(0.1),
            timeoutMessage: "Timed out waiting for [{$selector}] to contain [{$expected}].",
        );
    }

    protected function waitForInputValue($page, string $selector, string $expected, int $timeoutMs = 10000): void
    {
        $selectorJson = json_encode($selector, JSON_THROW_ON_ERROR);
        $expectedJson = json_encode($expected, JSON_THROW_ON_ERROR);

        $this->waitUntil(
            condition: fn (): bool => (bool) $page->script(
                '(() => {'.
                "const el = document.querySelector({$selectorJson});".
                "return !!el && el.value === {$expectedJson};".
                '})()'
            ),
            timeoutMs: $timeoutMs,
            onTick: fn (): mixed => $page->wait(0.1),
            timeoutMessage: "Timed out waiting for [{$selector}] value [{$expected}].",
        );
    }

    protected function waitForCheckedState($page, string $selector, bool $checked, int $timeoutMs = 10000): void
    {
        $selectorJson = json_encode($selector, JSON_THROW_ON_ERROR);
        $checkedJson = $checked ? 'true' : 'false';

        $this->waitUntil(
            condition: fn (): bool => (bool) $page->script(
                '(() => {'.
                "const el = document.querySelector({$selectorJson});".
                "return !!el && el.checked === {$checkedJson};".
                '})()'
            ),
            timeoutMs: $timeoutMs,
            onTick: fn (): mixed => $page->wait(0.1),
            timeoutMessage: "Timed out waiting for [{$selector}] checked state [{$checkedJson}].",
        );
    }

    /**
     * @param  callable(BladeViewEdits):void  $mutate
     */
    protected function applyEditsAndWait($page, callable $mutate): int
    {
        $before = $this->currentPatchCount($page);
        $editor = $this->editView();
        $mutate($editor);
        $editor->apply();

        $this->waitForPatchCountIncrease($page, $before);

        return $this->currentPatchCount($page);
    }

    /**
     * @param  callable(BladeViewEdits):void  $mutate
     */
    protected function applyEditsAndWaitForHotUpdate($page, callable $mutate): int
    {
        $before = $this->currentPatchCount($page);
        $editor = $this->editView();
        $mutate($editor);
        $editor->apply();

        $this->waitForPatchCountIncreaseFromHotUpdate($page, $before);

        return $this->currentPatchCount($page);
    }

    /**
     * @param  callable(BladeViewEdits):void  $mutate
     * @param  array<int, string>|string|null  $changedFiles
     */
    protected function applyEditsAndWaitForSimulatedHotUpdate($page, callable $mutate, array|string|null $changedFiles = null, int $timeoutMs = 8000): int
    {
        $before = $this->currentPatchCount($page);
        $editor = $this->editView();
        $mutate($editor);
        $editor->apply();

        $this->dispatchBladeChangePayloadAndWait($page, $before, $changedFiles, $timeoutMs);

        return $this->currentPatchCount($page);
    }

    /**
     * @param  callable(BladeViewEdits):void  $mutate
     */
    protected function applyFixtureFileEditsAndWait($page, string $relativePath, callable $mutate): int
    {
        $before = $this->currentPatchCount($page);
        $editor = $this->editFixtureFile($relativePath);
        $mutate($editor);
        $editor->apply();

        $this->waitForPatchCountIncrease($page, $before);

        return $this->currentPatchCount($page);
    }

    /**
     * @param  callable(BladeViewEdits):void  $mutate
     */
    protected function applyFixtureFileEditsAndWaitForHotUpdate($page, string $relativePath, callable $mutate): int
    {
        $before = $this->currentPatchCount($page);
        $editor = $this->editFixtureFile($relativePath);
        $mutate($editor);
        $editor->apply();

        $this->waitForPatchCountIncreaseFromHotUpdate($page, $before);

        return $this->currentPatchCount($page);
    }

    /**
     * @param  array<int, string>|string|null  $changedFiles
     */
    protected function dispatchBladeChangePayloadAndWait($page, int $previousCount, array|string|null $changedFiles = null, int $timeoutMs = 8000): void
    {
        $payload = [];
        if (is_array($changedFiles)) {
            $payload['files'] = array_values($changedFiles);
        } elseif (is_string($changedFiles) && $changedFiles !== '') {
            $payload['file'] = $changedFiles;
        }

        try {
            $encoded = json_encode($payload, JSON_THROW_ON_ERROR);
        } catch (JsonException $e) {
            throw new RuntimeException('Failed to encode reload:change payload for browser test.', 0, $e);
        }

        $page->script(
            "if (window.__reloadHandleChangePayload) window.__reloadHandleChangePayload({$encoded});"
        );

        $this->waitForPatchCountIncreaseFromHotUpdate($page, $previousCount, $timeoutMs, false);
    }

    private function afterFixtureWrite(): void
    {
        $this->clearHmrCompiledViews();
        usleep(300000);
    }

    private function resolveFixtureFilePath(string $relativePath): string
    {
        $relativePath = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $relativePath);
        $candidate = $this->fixturesRoot.DIRECTORY_SEPARATOR.ltrim($relativePath, DIRECTORY_SEPARATOR);
        $resolved = realpath($candidate);

        if ($resolved === false || ! is_file($resolved)) {
            throw new RuntimeException("Fixture file [{$relativePath}] does not exist.");
        }

        $fixturesRoot = realpath($this->fixturesRoot) ?: $this->fixturesRoot;
        $normalizedFixturesRoot = rtrim(str_replace('\\', '/', strtolower($fixturesRoot)), '/').'/';
        $normalizedResolved = str_replace('\\', '/', strtolower($resolved));

        if (! str_starts_with($normalizedResolved, $normalizedFixturesRoot)) {
            throw new RuntimeException("Fixture file [{$relativePath}] is outside fixture root.");
        }

        return $resolved;
    }

    private function prepareBladeInstrumentation(): void
    {
        $compiler = app('blade.compiler');
        $compilerId = spl_object_id($compiler);

        if (isset(self::$preparedBladeCompilers[$compilerId])) {
            return;
        }

        $instrumentation = ReloadInstrumentation::make();

        Blade::prepareStringsForCompilationUsing(function (string $template) use ($instrumentation): string {
            $path = Blade::getPath();

            if (! $path || ServiceProvider::shouldSkipInstrumentation($template, $path)) {
                return $template;
            }

            $doc = Document::parse($template);

            return $instrumentation->rewrite($doc)->render();
        });

        self::$preparedBladeCompilers[$compilerId] = true;
    }

    private function resolveViteDevUrl(): string
    {
        return self::viteDevUrl();
    }

    private function prewarmViteEntries(): void
    {
        if (self::$viteEntriesPrewarmed) {
            return;
        }

        foreach (['/resources/js/app.js', '/resources/js/hmr-browser-test.js'] as $path) {
            $context = stream_context_create([
                'http' => [
                    'timeout' => 5,
                    'ignore_errors' => true,
                ],
            ]);

            @file_get_contents($this->viteDevUrl.$path, false, $context);
        }

        self::$viteEntriesPrewarmed = true;
    }

    private static function viteDevUrl(): string
    {
        return 'http://127.0.0.1:5173';
    }

    private function ensureViteServerRunning(): void
    {
        if (self::$viteProcess instanceof Process && self::$viteProcess->isRunning()) {
            if ($this->waitForViteDevUrl(3000) !== null) {
                return;
            }

            self::$viteProcess->stop(2);
            self::$viteProcess = null;
        }

        self::$projectRoot = self::$projectRoot ?? FixturePaths::packageRoot();

        $command = strtoupper(substr(PHP_OS, 0, 3)) === 'WIN'
            ? 'npm.cmd run dev:browser -- --host 127.0.0.1 --port 5173 --strictPort'
            : 'npm run dev:browser -- --host 127.0.0.1 --port 5173 --strictPort';

        self::$viteProcess = Process::fromShellCommandline($command, self::$projectRoot);
        self::$viteProcess->setTimeout(null);
        self::$viteProcess->start();

        $startedAt = microtime(true);
        $buffer = '';

        while ((microtime(true) - $startedAt) < 60) {
            if (! self::$viteProcess->isRunning()) {
                throw new RuntimeException(
                    "Vite dev server exited early.\n".self::$viteProcess->getOutput().self::$viteProcess->getErrorOutput()
                );
            }

            $buffer .= self::$viteProcess->getIncrementalOutput();
            $buffer .= self::$viteProcess->getIncrementalErrorOutput();

            if ($this->waitForViteDevUrl(250) !== null) {
                register_shutdown_function(static function (): void {
                    if (self::$viteProcess instanceof Process && self::$viteProcess->isRunning()) {
                        self::$viteProcess->stop(2);
                    }
                });

                return;
            }

            usleep(150000);
        }

        throw new RuntimeException("Timed out waiting for Vite to start.\n".$buffer);
    }

    private function waitForViteDevUrl(int $timeoutMs = 10000): ?string
    {
        $deadline = microtime(true) + ($timeoutMs / 1000);
        $viteDevUrl = self::viteDevUrl();

        while (microtime(true) < $deadline) {
            if ($this->isViteReachable($viteDevUrl)) {
                return $viteDevUrl;
            }

            usleep(100000);
        }

        return null;
    }

    private function isViteReachable(string $viteDevUrl): bool
    {
        $url = rtrim($viteDevUrl, '/').'/@vite/client';
        $context = stream_context_create([
            'http' => [
                'timeout' => 1,
                'ignore_errors' => true,
            ],
        ]);

        $body = @file_get_contents($url, false, $context, 0, 128);
        if ($body === false) {
            return false;
        }

        foreach ($http_response_header ?? [] as $header) {
            if (preg_match('/^HTTP\/\S+\s+(\d{3})/i', $header, $matches)) {
                return (int) $matches[1] >= 200 && (int) $matches[1] < 400;
            }
        }

        return true;
    }
}
