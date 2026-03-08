import reloadLogoSvg from '../../svg/reload.svg?raw';

export function showErrorOverlay(message, options = {}) {
    removeErrorOverlay();

    const title = options.title || 'Reload Error';
    const html = options.html || null;
    const showReload = options.showReload !== false;

    const backdrop = document.createElement('div');
    backdrop.id = 'reload-error';
    backdrop.setAttribute('style',
        'position:fixed;inset:0;z-index:2147483647;' +
        'background:radial-gradient(1200px 640px at 20% 0%,rgba(24,83,106,0.24),rgba(0,0,0,0) 60%),' +
        'radial-gradient(900px 540px at 84% 12%,rgba(106,87,34,0.16),rgba(0,0,0,0) 58%),' +
        'rgba(1,3,9,0.86);display:flex;align-items:flex-start;justify-content:center;padding:16px;'
    );

    const panel = document.createElement('div');
    panel.setAttribute('style',
        'width:min(1600px,calc(100vw - 32px));height:calc(100vh - 32px);overflow:hidden;' +
        'background:linear-gradient(180deg,#05070d 0%,#070b14 52%,#0a1020 100%);' +
        'color:#f0f5ff;border:1px solid #23364c;border-radius:14px;' +
        'box-shadow:0 20px 80px rgba(0,0,0,0.58);' +
        'display:flex;flex-direction:column;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;'
    );

    const header = document.createElement('div');
    header.setAttribute('style',
        'display:flex;align-items:center;justify-content:space-between;' +
        'gap:12px;padding:14px 16px;border-bottom:1px solid #1e2f42;' +
        'background:linear-gradient(90deg,#0b1321 0%,#101a2b 56%,#172033 100%);'
    );

    const badge = createBrandIcon();

    const headerTitle = document.createElement('div');
    headerTitle.setAttribute('style', 'display:flex;align-items:center;gap:10px;');

    const titleEl = document.createElement('strong');
    titleEl.textContent = formatModalTitle(title);
    titleEl.setAttribute('style', 'font-size:14px;font-weight:800;color:#f0f6ff;');

    headerTitle.appendChild(badge);
    headerTitle.appendChild(titleEl);

    const controls = document.createElement('div');
    controls.setAttribute('style', 'display:flex;align-items:center;gap:8px;');

    const makeIconButton = (label, svgMarkup, onClick) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('aria-label', label);
        button.setAttribute('title', label);
        button.setAttribute('style',
            'width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;' +
            'border:1px solid #304761;background:rgba(12,20,34,0.84);color:#d9e8f6;' +
            'border-radius:8px;cursor:pointer;padding:0;'
        );
        button.innerHTML = svgMarkup;
        button.addEventListener('click', onClick);

        return button;
    };

    if (showReload) {
        const reloadButton = makeIconButton(
            'Reload page',
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
            '<path d="M20 12a8 8 0 1 1-2.34-5.66" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
            '<path d="M20 4v5h-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
            '</svg>',
            () => location.reload(),
        );
        controls.appendChild(reloadButton);
    }

    const closeButton = makeIconButton(
        'Close overlay',
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
        '</svg>',
        removeErrorOverlay,
    );
    controls.appendChild(closeButton);

    header.appendChild(headerTitle);
    header.appendChild(controls);
    panel.appendChild(header);

    const body = document.createElement('div');
    body.setAttribute('style',
        'position:relative;flex:1;min-height:0;display:flex;overflow:hidden;' +
        'background:radial-gradient(1200px 460px at 10% 0%,rgba(20,72,92,0.2),transparent 62%),' +
        'linear-gradient(180deg,#05070d 0%,#080d19 100%);'
    );

    const messageEl = document.createElement('span');
    messageEl.id = 'reload-error-message';
    messageEl.textContent = message;
    messageEl.setAttribute('style',
        'position:absolute;left:-99999px;top:auto;width:1px;height:1px;overflow:hidden;'
    );
    panel.appendChild(messageEl);

    if (html) {
        const frameWrap = document.createElement('div');
        frameWrap.setAttribute('style', 'flex:1;min-height:0;display:flex;');

        const frame = document.createElement('iframe');
        frame.id = 'reload-error-frame';
        frame.setAttribute('sandbox', 'allow-same-origin');
        frame.setAttribute('style',
            'display:block;border:0;background:#fff;width:100%;height:100%;'
        );
        frame.srcdoc = html;
        frameWrap.appendChild(frame);
        body.appendChild(frameWrap);
    } else {
        const plainMessage = document.createElement('pre');
        plainMessage.textContent = message;
        plainMessage.setAttribute('style',
            'margin:20px;padding:14px;border-radius:10px;border:1px solid #2f455d;' +
            'background:#0d1624;color:#c6d7e8;white-space:pre-wrap;line-height:1.5;font-size:12px;'
        );
        body.appendChild(plainMessage);
    }

    panel.appendChild(body);
    backdrop.appendChild(panel);
    backdrop.addEventListener('click', (event) => {
        if (event.target === backdrop) {
            removeErrorOverlay();
        }
    });
    document.body.appendChild(backdrop);
}

export function removeErrorOverlay() {
    document.getElementById('reload-error')?.remove();
}

export function showConnectionStatus(status) {
    let el = document.getElementById('reload-status');
    if (!el) {
        el = document.createElement('div');
        el.id = 'reload-status';
        el.setAttribute('style',
            'position:fixed;bottom:12px;right:12px;z-index:99999;' +
            'background:#1a1a2e;color:#f5a623;font-family:monospace;' +
            'padding:8px 14px;font-size:12px;border-radius:6px;' +
            'border:1px solid #f5a623;opacity:0.9;'
        );
        document.body.appendChild(el);
    }
    el.textContent = '[reload] ' + status;
}

export function removeConnectionStatus() {
    document.getElementById('reload-status')?.remove();
}

function createBrandIcon() {
    const iconWrap = document.createElement('span');
    iconWrap.setAttribute('aria-hidden', 'true');
    iconWrap.setAttribute('style',
        'display:inline-flex;align-items:center;justify-content:center;' +
        'width:22px;height:22px;'
    );
    iconWrap.innerHTML = reloadLogoSvg
        .replaceAll('#1E293B', '#E6F0FF')
        .replaceAll('#94A3B8', '#8FB7D6');

    const svg = iconWrap.querySelector('svg');
    if (svg) {
        svg.setAttribute('width', '20');
        svg.setAttribute('height', '20');
        svg.setAttribute('style', 'display:block;');
    }

    return iconWrap;
}

function formatModalTitle(title) {
    const normalized = String(title ?? '').trim();

    if (normalized === '') {
        return 'Reload Error';
    }

    if (/^reload\b/i.test(normalized)) {
        return normalized;
    }

    return `Reload ${normalized}`;
}
