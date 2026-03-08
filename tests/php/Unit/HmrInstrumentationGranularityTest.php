<?php

use Forte\Ast\Document\Document;
use Forte\Reload\Instrumentation\ReloadInstrumentation;

uses(Forte\Reload\Tests\TestCase::class);

test('components construct instruments components but not elements or conditionals', function () {
    $template = <<<'BLADE'
<div>
    <x-test-badge>active</x-test-badge>
    @if(true)
        <span>shown</span>
    @endif
</div>
BLADE;

    $output = ReloadInstrumentation::make([
        'elements' => false,
        'components' => true,
        'directives' => false,
        'directive_blocks' => false,
        'includes' => false,
    ])->rewrite(Document::parse($template))->render();

    expect($output)->toContain('<!--bl:begin id="component:')
        ->and($output)->not->toContain('data-hmr-id="element:div"')
        ->and($output)->not->toContain('directive:if');
});

test('includes construct instruments include directives but not conditionals', function () {
    $template = <<<'BLADE'
<x-test-badge>active</x-test-badge>
@include('partials.flash')
@if(true)
    <div>conditional</div>
@endif
BLADE;

    $output = ReloadInstrumentation::make([
        'elements' => false,
        'components' => true,
        'directives' => false,
        'directive_blocks' => false,
        'includes' => true,
    ])->rewrite(Document::parse($template))->render();

    expect($output)->toContain('<!--bl:begin id="component:')
        ->and($output)->toContain('directive:include')
        ->and($output)->not->toContain('directive:if')
        ->and($output)->not->toContain('data-hmr-id="element:div"');
});

test('default constructs instrument elements and directive blocks', function () {
    $template = <<<'BLADE'
<div>
    @if(true)
        <span>hello</span>
    @endif
</div>
BLADE;

    $output = ReloadInstrumentation::make()->rewrite(Document::parse($template))->render();

    expect($output)->toContain('data-hmr-id="element:div"')
        ->and($output)->toContain('directive:if')
        ->and($output)->toContain('directiveBlock:if');
});
