<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <script type="module" src="{{ rtrim($viteDevUrl, '/') }}/@@vite/client"></script>
    @livewireScriptConfig
    <script type="module" src="{{ rtrim($viteDevUrl, '/') }}/resources/js/hmr-browser-test.js"></script>
    @livewireStyles
</head>
<body>
    <section data-test="shell-before">
        <p data-test="shell-copy">Parent shell copy v2</p>

        <x-hmr.input
            name="outer-email"
            label="Outer contact email"
            type="email"
        />

        <!-- hmr-edit:shell -->
        <p data-test="shell-note">Shell note v2</p>

    </section>

    <section
        x-data="{ open: true, count: 1, note: 'draft note' }"
        data-test="alpine-root"
        class="alpine-shell"
    >
        <h2 data-test="alpine-heading" x-text="open ? 'Alpine shell ready' : 'Alpine shell closed'">
            Alpine shell ready
        </h2>

        <button type="button" data-test="alpine-toggle" @click="open = ! open">
            Toggle Alpine
        </button>

        <button type="button" data-test="alpine-increment" @click="count++">
            Increment Alpine
        </button>

        <p data-test="alpine-count" x-text="count">1</p>

        <label>
            Alpine note
            <input type="text" name="alpine-note" x-model="note" data-test="alpine-input">
        </label>

        <p data-test="alpine-note-preview" x-text="note">draft note</p>

        <!-- hmr-edit:alpine -->
        <span data-test="alpine-extra">Alpine extra copy</span>

    </section>

    <livewire:hmr-browser.state-panel
        title="Livewire control panel"
        helper-copy="Helper copy v2"
        checkbox-label="Remember this browser"
    />

    <section data-test="shell-after">
        <p data-test="footer-copy">Footer shell copy v2</p>
    </section>

    @include('testing.partials.hmr-session-counters')
</body>
</html>
