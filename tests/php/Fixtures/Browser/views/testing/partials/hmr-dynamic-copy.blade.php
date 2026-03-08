@php
    $path = storage_path('framework/testing/hmr-partial-copy.txt');
    $value = is_file($path) ? trim((string) file_get_contents($path)) : 'partial-missing';
@endphp
<p data-test="partial-copy">{{ $value }}</p>
