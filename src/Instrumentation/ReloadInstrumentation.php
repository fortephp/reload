<?php

namespace Forte\Reload\Instrumentation;

use Forte\Rewriting\Passes\Instrumentation;
use Illuminate\Support\Facades\Blade;
use Illuminate\View\Factory;
use Illuminate\View\FileViewFinder;
use Livewire\Compiler\Compiler as LivewireCompiler;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use SplFileInfo;

class ReloadInstrumentation
{
    /**
     * @var array<string, string>
     */
    private static array $livewireSourceHashIndex = [];

    private static ?string $livewireSourceHashIndexSignature = null;

    /**
     * @var array<string, string>
     */
    private static array $relativePathCache = [];

    /**
     * @var array<string, array<int, string>>
     */
    private static array $workspaceRootCache = [];

    /**
     * @param  array<string, mixed>  $constructs
     */
    public static function make(array $constructs = []): Instrumentation
    {
        $inst = Instrumentation::make();

        $settings = self::normalizeConstructs($constructs);

        if ($settings['elements']) {
            $inst->elements();
        }

        if ($settings['components']) {
            $inst->components();
        }

        if ($settings['directives']) {
            $inst->directives();
        } elseif ($settings['includes']) {
            $inst->directives(['include', 'includeIf', 'includeWhen', 'includeFirst']);
        }

        if ($settings['directive_blocks']) {
            $inst->directiveBlocks();
        }

        /** @param array<string, mixed> $meta */
        $inst->using(function (array $meta) {
            $type = self::metaString($meta, 'type');
            $name = self::metaString($meta, 'componentName', self::metaString($meta, 'name'));
            $id = $type.':'.$name;
            $file = self::currentRelativePath();
            $key = self::boundaryKey($meta, $id, $file);

            if (in_array($type, ['component', 'directive', 'directiveBlock'], true)) {
                $begin = '<!--bl:begin id="'.self::escape($id).'" key="'.self::escape($key).'" file="'.self::escape($file).'"-->';
                $end = '<!--bl:end id="'.self::escape($id).'" key="'.self::escape($key).'"-->';

                return [$begin, $end];
            }

            $skip = ['html', 'head', 'meta', 'link', 'style', 'script', 'title', 'br', 'hr', 'base', 'noscript', 'template'];

            if (in_array(self::metaString($meta, 'name'), $skip, true)) {
                return ['', '', []];
            }

            return ['', '', ['data-hmr-id' => $id, 'data-hmr-file' => $file]];
        });

        return $inst;
    }

    private static function currentRelativePath(): string
    {
        $absolutePath = Blade::getPath();

        if (! $absolutePath) {
            return 'unknown';
        }

        $originalPath = self::resolveLivewireSourcePath($absolutePath) ?? $absolutePath;

        return self::relativePathFor($originalPath);
    }

    public static function relativePathFor(string $path): string
    {
        return self::relativePath($path);
    }

    private static function escape(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
    }

    /**
     * @param  array<string, mixed>  $meta
     */
    private static function boundaryKey(array $meta, string $id, string $file): string
    {
        /** @var array{id: string, name: string, componentName: string, arguments: string, depth: string, file: string} $seed */
        $seed = [
            'id' => $id,
            'name' => self::metaString($meta, 'name'),
            'componentName' => self::metaString($meta, 'componentName'),
            'arguments' => self::normalizeArguments($meta['arguments'] ?? null),
            'depth' => self::metaString($meta, 'depth'),
            'file' => $file,
        ];

        $json = json_encode($seed);
        if ($json === false) {
            $json = implode('|', $seed);
        }

        return substr(hash('sha256', $json), 0, 16);
    }

    private static function normalizeArguments(mixed $arguments): string
    {
        if (is_string($arguments)) {
            return $arguments;
        }

        if ($arguments === null) {
            return '';
        }

        $encoded = json_encode($arguments);

        return $encoded === false ? '' : $encoded;
    }

    /**
     * @param  array<string, mixed>  $meta
     */
    private static function metaString(array $meta, string $key, string $default = ''): string
    {
        $value = $meta[$key] ?? $default;

        if (is_string($value)) {
            return $value;
        }

        if (is_scalar($value)) {
            return (string) $value;
        }

        return $default;
    }

    /**
     * @param  array<string, mixed>  $constructs
     * @return array{elements: bool, components: bool, directives: bool, directive_blocks: bool, includes: bool}
     */
    private static function normalizeConstructs(array $constructs): array
    {
        return [
            'elements' => self::constructEnabled($constructs, 'elements', true),
            'components' => self::constructEnabled($constructs, 'components', true),
            'directives' => self::constructEnabled($constructs, 'directives', true),
            'directive_blocks' => self::constructEnabled($constructs, 'directive_blocks', true),
            'includes' => self::constructEnabled($constructs, 'includes', false),
        ];
    }

    /**
     * @param  array<string, mixed>  $constructs
     */
    private static function constructEnabled(array $constructs, string $key, bool $default): bool
    {
        if (! array_key_exists($key, $constructs)) {
            return $default;
        }

        return (bool) $constructs[$key];
    }

    private static function resolveLivewireSourcePath(string $path): ?string
    {
        $normalizedPath = str_replace('\\', '/', $path);

        if (! preg_match('#/storage/framework/views/livewire/views/([a-f0-9]{8})\.blade\.php$#i', $normalizedPath, $matches)) {
            return null;
        }

        $hash = strtolower($matches[1]);
        $index = self::livewireSourceHashIndex();

        return $index[$hash] ?? null;
    }

    /**
     * @return array<string, string>
     */
    private static function livewireSourceHashIndex(): array
    {
        $locations = self::livewireSourceLocations();
        $signature = md5(json_encode($locations, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?: '[]');

        if (self::$livewireSourceHashIndexSignature === $signature) {
            return self::$livewireSourceHashIndex;
        }

        self::$livewireSourceHashIndexSignature = $signature;
        self::$livewireSourceHashIndex = [];

        foreach ($locations as $location) {
            $root = realpath($location);

            if ($root === false || ! is_dir($root)) {
                continue;
            }

            $normalizedRoot = rtrim(str_replace('\\', '/', $root), '/');
            $iterator = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator($root, RecursiveDirectoryIterator::SKIP_DOTS),
                RecursiveIteratorIterator::SELF_FIRST,
            );

            foreach ($iterator as $entry) {
                /** @var SplFileInfo $entry */
                $actualPath = $entry->getPathname();
                $normalizedActualPath = str_replace('\\', '/', $actualPath);
                $relativePath = ltrim(substr($normalizedActualPath, strlen($normalizedRoot)), '/');

                if ($relativePath === '') {
                    continue;
                }

                $sourcePath = self::livewireLocationSourcePath($root, $relativePath);

                if ($entry->isDir()) {
                    $viewPath = self::resolveLivewireMultiFileViewPath($actualPath);

                    if ($viewPath !== null) {
                        self::indexLivewireSourcePath($sourcePath, $viewPath);
                    }

                    continue;
                }

                if (! self::isLivewireSingleFileComponentSource($actualPath)) {
                    continue;
                }

                self::indexLivewireSourcePath($sourcePath, $actualPath);
            }
        }

        return self::$livewireSourceHashIndex;
    }

    /**
     * @return array<int, string>
     */
    private static function livewireSourceLocations(): array
    {
        $finder = self::viewFactory()->getFinder();
        $viewPaths = $finder instanceof FileViewFinder
            ? $finder->getPaths()
            : [];
        $viewHints = self::viewFinderHintPaths($finder);
        $locations = config('livewire.component_locations', []);
        $namespaces = config('livewire.component_namespaces', []);

        $candidates = [];

        foreach ([
            $viewPaths,
            $viewHints,
            $locations,
            is_array($namespaces) ? array_values($namespaces) : [],
        ] as $group) {
            if (! is_array($group)) {
                continue;
            }

            foreach ($group as $path) {
                if (! is_string($path) || trim($path) === '') {
                    continue;
                }

                $candidates[] = $path;
            }
        }

        return array_values(array_unique($candidates));
    }

    /**
     * @return array<int, string>
     */
    private static function viewFinderHintPaths(mixed $finder): array
    {
        if (! $finder instanceof FileViewFinder) {
            return [];
        }

        $paths = [];

        foreach ($finder->getHints() as $hintPaths) {
            foreach ($hintPaths as $path) {
                if (! is_string($path) || trim($path) === '') {
                    continue;
                }

                $paths[] = $path;
            }
        }

        return $paths;
    }

    private static function livewireLocationSourcePath(string $location, string $relativePath): string
    {
        return rtrim($location, '/').'/'.str_replace('\\', '/', $relativePath);
    }

    private static function resolveLivewireMultiFileViewPath(string $directory): ?string
    {
        if (! is_dir($directory)) {
            return null;
        }

        $baseName = basename($directory);
        $fileBaseName = str_contains($baseName, 'index')
            ? 'index'
            : self::stripLivewireZapPrefix($baseName);

        if ($fileBaseName === '') {
            return null;
        }

        $classPath = $directory.DIRECTORY_SEPARATOR.$fileBaseName.'.php';
        $viewPath = $directory.DIRECTORY_SEPARATOR.$fileBaseName.'.blade.php';

        return is_file($classPath) && is_file($viewPath) ? $viewPath : null;
    }

    private static function stripLivewireZapPrefix(string $value): string
    {
        return preg_replace('/^⚡[\x{FE0E}\x{FE0F}]?/u', '', $value) ?? $value;
    }

    private static function isLivewireSingleFileComponentSource(string $path): bool
    {
        if (! is_file($path) || ! str_ends_with(str_replace('\\', '/', $path), '.blade.php')) {
            return false;
        }

        $contents = file_get_contents($path);

        if ($contents === false) {
            return false;
        }

        return preg_match('/<\?php.*new\s+.*class/s', $contents) === 1;
    }

    private static function indexLivewireSourcePath(string $sourcePath, string $viewPath): void
    {
        $hash = self::livewireHashForSourcePath($sourcePath);

        self::$livewireSourceHashIndex[$hash] ??= $viewPath;
    }

    private static function livewireHashForSourcePath(string $sourcePath): string
    {
        if (app()->bound('livewire.compiler')) {
            $compiler = app('livewire.compiler');

            if (class_exists(LivewireCompiler::class) && $compiler instanceof LivewireCompiler) {
                return strtolower($compiler->cacheManager->getHash($sourcePath));
            }
        }

        return substr(md5($sourcePath), 0, 8);
    }

    private static function relativePath(string $path): string
    {
        $resolvedPath = realpath($path) ?: $path;
        $normalizedPath = self::normalizePath($resolvedPath);

        if ($normalizedPath === '') {
            return 'unknown';
        }

        return self::$relativePathCache[$normalizedPath]
            ??= self::resolveRelativePath($resolvedPath, $normalizedPath);
    }

    private static function resolveRelativePath(string $path, string $normalizedPath): string
    {
        foreach (self::relativePathRoots($path) as $root) {
            $normalizedRoot = self::normalizedRoot($root);

            if ($normalizedRoot === '') {
                continue;
            }

            if (str_starts_with(strtolower($normalizedPath), strtolower($normalizedRoot))) {
                return substr($normalizedPath, strlen($normalizedRoot));
            }
        }

        return $normalizedPath;
    }

    /**
     * @return array<int, string>
     */
    private static function relativePathRoots(string $path): array
    {
        $roots = [];
        $basePath = base_path();

        if (trim($basePath) !== '') {
            $roots[] = $basePath;
        }

        $roots = [
            ...$roots,
            ...self::discoverWorkspaceRoots($path),
        ];

        $cwd = getcwd();

        if (is_string($cwd) && trim($cwd) !== '') {
            $roots[] = $cwd;
        }

        return self::uniquePaths($roots);
    }

    /**
     * @return array<int, string>
     */
    private static function discoverWorkspaceRoots(string $path): array
    {
        $directory = is_dir($path) ? $path : dirname($path);
        $resolvedDirectory = realpath($directory) ?: $directory;
        $cacheKey = self::normalizePath($resolvedDirectory);

        if ($cacheKey === '') {
            return [];
        }

        if (array_key_exists($cacheKey, self::$workspaceRootCache)) {
            return self::$workspaceRootCache[$cacheKey];
        }

        $roots = [];
        $current = $resolvedDirectory;

        while ($current !== '') {
            if (self::directoryLooksLikeWorkspaceRoot($current)) {
                $roots[] = $current;
            }

            $parent = dirname($current);

            if ($parent === $current) {
                break;
            }

            $current = $parent;
        }

        return self::$workspaceRootCache[$cacheKey] = array_reverse(self::uniquePaths($roots));
    }

    private static function directoryLooksLikeWorkspaceRoot(string $directory): bool
    {
        return is_file($directory.DIRECTORY_SEPARATOR.'composer.json')
            || file_exists($directory.DIRECTORY_SEPARATOR.'.git');
    }

    /**
     * @param  array<int, string>  $paths
     * @return array<int, string>
     */
    private static function uniquePaths(array $paths): array
    {
        $unique = [];
        $seen = [];

        foreach ($paths as $path) {
            if (trim($path) === '') {
                continue;
            }

            $normalized = self::canonicalPath($path);

            if ($normalized === '') {
                continue;
            }

            $key = strtolower($normalized);

            if (isset($seen[$key])) {
                continue;
            }

            $seen[$key] = true;
            $unique[] = $normalized;
        }

        return $unique;
    }

    private static function normalizedRoot(string $path): string
    {
        $normalized = self::canonicalPath($path);

        if ($normalized === '') {
            return '';
        }

        return $normalized === '/' ? '/' : $normalized.'/';
    }

    private static function canonicalPath(string $path): string
    {
        $normalized = self::normalizePath($path);

        if ($normalized === '/') {
            return '/';
        }

        return rtrim($normalized, '/');
    }

    private static function normalizePath(string $path): string
    {
        return str_replace('\\', '/', $path);
    }

    private static function viewFactory(): Factory
    {
        /** @var Factory $factory */
        $factory = app('view');

        return $factory;
    }
}
