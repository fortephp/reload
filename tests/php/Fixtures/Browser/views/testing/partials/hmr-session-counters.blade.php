<script data-session-key="{{ $sessionKey }}">
    (() => {
        const key = document.currentScript?.dataset.sessionKey || '';
        const loads = Number(sessionStorage.getItem(key) || '0') + 1;
        sessionStorage.setItem(key, String(loads));
        window.__hmrLoadCount = loads;
        window.__reloadPatchedEvents = 0;
        document.addEventListener('reload:patched', () => {
            window.__reloadPatchedEvents += 1;
        });
    })();
</script>

