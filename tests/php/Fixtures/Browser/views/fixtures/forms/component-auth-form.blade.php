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

        <x-hmr.input
            name="email"
            label="Email address"
            type="email"
        />

        <!-- hmr-edit:insert -->

        <div class="relative">
            <x-hmr.input
                name="password"
                label="Password"
                type="password"
            />

            @if (true)
                <x-hmr.link class="absolute top-0 text-sm end-0" href="/password/reset">
                    {{ __('Forgot your password?... well. did you?') }}
                </x-hmr.link>
            @endif
        </div>

        <x-hmr.checkbox name="remember" label="Remember me" />

        <div class="flex items-center justify-end">
            <x-hmr.button type="submit" class="w-full" data-test="login-button">
                {{ __('Log in to your account') }}
            </x-hmr.button>
        </div>
    </form>

    @include('testing.partials.hmr-session-counters')
</body>
</html>
