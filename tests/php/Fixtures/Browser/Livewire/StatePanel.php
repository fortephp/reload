<?php

namespace Forte\Reload\Tests\Fixtures\Browser\Livewire;

use Illuminate\Contracts\View\View;
use Livewire\Component;

class StatePanel extends Component
{
    public string $title = 'Livewire panel';

    public string $helperCopy = 'Helper copy v1';

    public string $checkboxLabel = 'Remember this browser';

    public string $search = '';

    public bool $remember = false;

    public int $refreshes = 0;

    public function mount(
        string $title = 'Livewire panel',
        string $helperCopy = 'Helper copy v1',
        string $checkboxLabel = 'Remember this browser',
    ): void {
        $this->title = $title;
        $this->helperCopy = $helperCopy;
        $this->checkboxLabel = $checkboxLabel;
    }

    public function refreshPanel(): void
    {
        $this->refreshes++;
    }

    public function render(): View
    {
        return view('testing.livewire.state-panel');
    }
}
