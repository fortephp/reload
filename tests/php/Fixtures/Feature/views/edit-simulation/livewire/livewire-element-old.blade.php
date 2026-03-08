<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Livewire Element Fixture</title>
</head>
<body>
    <section>
        <ul>
            <li wire:key="todo-1">First task</li>
            <li wire:key="todo-2">Second task</li>
        </ul>

        <a href="/dashboard" wire:navigate>Dashboard</a>
        <input name="search" type="text" wire:model.live="filters.search">
    </section>
</body>
</html>
