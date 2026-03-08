<section data-test="livewire-root" class="livewire-panel">
    <h2 data-test="livewire-title">{{ $title }}</h2>
    <p data-test="livewire-helper">{{ $helperCopy }}</p>

    <label data-test="livewire-search-label">
        Search
        <input
            type="text"
            name="livewire-search"
            wire:model.defer="search"
            data-test="livewire-search"
        >
    </label>

    <label data-test="livewire-remember-label">
        <input
            type="checkbox"
            name="livewire-remember"
            wire:model.defer="remember"
            data-test="livewire-remember"
        >
        {{ $checkboxLabel }}
    </label>
    <p data-test="livewire-status">Livewire component hydrated</p>

    <!-- hmr-edit:livewire -->
</section>
