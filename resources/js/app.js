import Alpine from 'alpinejs';
import './runtime.js';

window.Alpine = Alpine;

if (!window.__reloadAlpineStarted) {
    window.__reloadAlpineStarted = true;
    Alpine.start();
}
