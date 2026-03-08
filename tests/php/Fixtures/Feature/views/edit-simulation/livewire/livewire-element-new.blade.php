<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Livewire Element Fixture</title>
</head>
<body>
    <section>
        <ul>
            <li wire:key="todo-1">Updated first task</li>
            <li wire:key="todo-2">Second task</li>
            <li wire:key="todo-3">Third task</li>
        </ul>

        <a href="/dashboard" wire:navigate.hover>Go to dashboard</a>
        <input name="search" type="text" wire:model.blur="filters.query">
    </section>
</body>
</html>
