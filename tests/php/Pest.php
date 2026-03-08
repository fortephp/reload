<?php

pest()->extend(Forte\Reload\Tests\TestCase::class)->in(
    __DIR__.DIRECTORY_SEPARATOR.'Unit',
    __DIR__.DIRECTORY_SEPARATOR.'Feature',
    __DIR__.DIRECTORY_SEPARATOR.'Browser',
);

pest()->browser()->timeout(20000);
