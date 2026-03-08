@props(['name' => null, 'label' => null, 'type' => 'text'])
<label class="test-input">
    <span>{{ $label }}</span>
    <input name="{{ $name }}" type="{{ $type }}" {{ $attributes }}>
</label>
