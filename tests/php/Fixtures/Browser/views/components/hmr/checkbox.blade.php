@props(['name' => null, 'label' => null])
<label {{ $attributes->class(['hmr-checkbox']) }}>
    <input type="checkbox" name="{{ $name }}">
    {{ $label }}
</label>
