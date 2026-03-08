@props(['name' => null, 'label' => null, 'type' => 'text', 'value' => null])
<div {{ $attributes->class(['hmr-input']) }}>
    <label>{{ $label }}</label>
    <input name="{{ $name }}" type="{{ $type }}" value="{{ $value }}">
</div>
