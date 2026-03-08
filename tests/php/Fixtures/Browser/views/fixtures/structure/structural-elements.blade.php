<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <script type="module" src="{{ rtrim($viteDevUrl, '/') }}/@@vite/client"></script>
    <script type="module" src="{{ rtrim($viteDevUrl, '/') }}/resources/js/app.js"></script>
</head>
<body>
    <section class="p-4 border rounded" data-test="structural-root">
        <h1>Structural Playground</h1>

        <ul class="space-y-1" data-test="item-list">
            <li>Alpha</li>
            <!-- hmr-edit:list -->
            <li>Beta</li>
        </ul>

        <a href="/login" data-test="login-link" class="inline-block px-3 py-1">
            <strong>Log in</strong>
        </a>
    </section>

    @include('testing.partials.hmr-session-counters')
</body>
</html>
