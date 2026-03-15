<?php

namespace Forte\Reload\Support;

class Runtime
{
    private bool $disabled = false;

    private bool $active = false;

    public function enabled(): bool
    {
        if ($this->disabled) {
            return false;
        }

        $enabled = config('reload.enabled');

        if ($enabled === null) {
            return (bool) app()->environment('local');
        }

        return (bool) $enabled;
    }

    public function active(): bool
    {
        return $this->active;
    }

    public function disable(): void
    {
        $this->disabled = true;
    }

    public function enable(): void
    {
        $this->disabled = false;
    }

    public function setActive(bool $active): void
    {
        $this->active = $active;
    }

    public function disabled(): bool
    {
        return $this->disabled;
    }
}
