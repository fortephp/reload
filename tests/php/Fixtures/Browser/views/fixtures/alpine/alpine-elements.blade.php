<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <script type="module" src="{{ rtrim($viteDevUrl, '/') }}/@@vite/client"></script>
    <script type="module" src="{{ rtrim($viteDevUrl, '/') }}/resources/js/app.js"></script>
</head>
<body>
    <section>
        <div x-data="{ count: 1 }" data-test="alpine-card" class="card">
            <h2 x-text="'Alpine Card'">Alpine Card</h2>
            <p data-test="alpine-copy">Initial alpine copy</p>
            <!-- hmr-edit:alpine -->
        </div>
    </section>

    @include('testing.partials.hmr-session-counters')
</body>
</html>
