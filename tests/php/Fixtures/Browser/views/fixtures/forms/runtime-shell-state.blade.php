<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <script>
        document.documentElement.classList.add('runtime-shell-dark');
    </script>
    <script type="module" src="{{ rtrim($viteDevUrl, '/') }}/@@vite/client"></script>
    <script type="module" src="{{ rtrim($viteDevUrl, '/') }}/resources/js/app.js"></script>
</head>
<body>
    <script>
        document.body.setAttribute('data-runtime-bg', 'black');
        document.body.style.background = 'rgb(0, 0, 0)';
    </script>

    <main>
        <p>Runtime shell state fixture</p>
    </main>

    @include('testing.partials.hmr-session-counters')
</body>
</html>
