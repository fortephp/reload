if (typeof globalThis.CSS === 'undefined') globalThis.CSS = {};
if (typeof CSS.escape !== 'function') {
    CSS.escape = (s) => String(s).replace(/([^\w-])/g, '\\$1');
}
window.scrollTo = () => {};
