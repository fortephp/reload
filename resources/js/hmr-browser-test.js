import './runtime.js';
import { Livewire, Alpine } from '../../vendor/livewire/livewire/dist/livewire.esm.js';

window.Alpine = Alpine;
window.Livewire = Livewire;

if (!window.__reloadLivewireStarted) {
    window.__reloadLivewireStarted = true;
    Livewire.start();
}
