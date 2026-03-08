<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <script type="module" src="{{ rtrim($viteDevUrl, '/') }}/@@vite/client"></script>
    <script type="module" src="{{ rtrim($viteDevUrl, '/') }}/resources/js/app.js"></script>
</head>
<body>
    <section data-test="livewire-shell">
        <ul>
            <li wire:key="todo-1" data-test="todo-item-1">First task</li>
            <li wire:key="todo-2" data-test="todo-item-2">Second task</li>
            <!-- hmr-edit:livewire-list -->
        </ul>

        <a href="/dashboard" wire:navigate data-test="livewire-link">Dashboard</a>

        <label>
            Search
            <input name="search" type="text" wire:model.live="filters.search" data-test="livewire-input">
        </label>
    </section>

    @include('testing.partials.hmr-session-counters')
</body>
</html>
