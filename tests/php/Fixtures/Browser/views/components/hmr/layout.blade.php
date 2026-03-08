@props(['viteDevUrl', 'sessionKey'])
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <script type="module" src="{{ rtrim($viteDevUrl, '/') }}/@@vite/client"></script>
    <script type="module" src="{{ rtrim($viteDevUrl, '/') }}/resources/js/app.js"></script>
</head>
<body>
    {{ $slot }}
    @include('testing.partials.hmr-session-counters', ['sessionKey' => $sessionKey])
</body>
</html>
