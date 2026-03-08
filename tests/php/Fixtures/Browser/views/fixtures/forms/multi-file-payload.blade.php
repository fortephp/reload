<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <script type="module" src="{{ rtrim($viteDevUrl, '/') }}/@@vite/client"></script>
    <script type="module" src="{{ rtrim($viteDevUrl, '/') }}/resources/js/app.js"></script>
</head>
<body>
    @php
        $parentPath = storage_path('framework/testing/hmr-parent-copy.txt');
        $parentValue = is_file($parentPath) ? trim((string) file_get_contents($parentPath)) : 'parent-missing';
    @endphp

    <section data-test="multi-file-shell">
        <p data-test="parent-copy">{{ $parentValue }}</p>
        @include('testing.partials.hmr-dynamic-copy')
    </section>

    @include('testing.partials.hmr-session-counters')
</body>
</html>
