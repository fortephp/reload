<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <script type="module" src="{{ rtrim($viteDevUrl, '/') }}/@@vite/client"></script>
    <script type="module" src="{{ rtrim($viteDevUrl, '/') }}/resources/js/app.js"></script>
</head>
<body>
    <form method="POST" action="/login" class="flex flex-col gap-6">
        @csrf

        <div>
            <span>Email address</span>
        </div>

        <!-- hmr-edit:insert -->

        <div>
            <button type="submit">
                <strong>Log in</strong>
            </button>
        </div>
    </form>

    @include('testing.partials.hmr-shared-copy')
    @include('testing.partials.hmr-session-counters')
</body>
</html>
