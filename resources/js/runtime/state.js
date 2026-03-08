export function captureState() {
    const active = document.activeElement;
    let focusSelector = null;
    let focusIndex = 0;
    let selectionStart = null;
    let selectionEnd = null;

    if (active && active !== document.body) {
        try {
            if (active.id) {
                focusSelector = '#' + CSS.escape(active.id);
            } else if (active.name) {
                focusSelector = `[name="${CSS.escape(active.name)}"]`;
                focusIndex = selectorIndex(active, focusSelector);
            }

            if (active.selectionStart !== undefined) {
                selectionStart = active.selectionStart;
                selectionEnd = active.selectionEnd;
            }
        } catch (_e) {
        }
    }

    const inputs = [];
    for (const el of document.querySelectorAll('input, textarea, select')) {
        if (el.type === 'hidden') continue;

        const selector = inputSelector(el);
        if (!selector) continue;

        const index = selectorIndex(el, selector);

        if (el.type === 'checkbox' || el.type === 'radio') {
            inputs.push({ selector, index, checked: el.checked });
        } else if (el.tagName === 'SELECT' && el.multiple) {
            inputs.push({
                selector,
                index,
                selectedValues: Array.from(el.selectedOptions, (option) => option.value),
            });
        } else if (el.tagName === 'SELECT') {
            inputs.push({ selector, index, selectedValue: el.value });
        } else {
            inputs.push({ selector, index, value: el.value });
        }
    }

    return {
        focusSelector,
        focusIndex,
        selectionStart,
        selectionEnd,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        inputs,
    };
}

export function inputSelector(el) {
    if (el.id) return '#' + CSS.escape(el.id);
    if (el.name) {
        let selector = `${el.tagName.toLowerCase()}[name="${CSS.escape(el.name)}"]`;
        if ((el.type === 'radio' || el.type === 'checkbox') && el.hasAttribute('value')) {
            selector += `[value="${CSS.escape(el.value)}"]`;
        }
        return selector;
    }
    return null;
}

export function restoreState(snapshot) {
    window.scrollTo(snapshot.scrollX, snapshot.scrollY);

    for (const input of snapshot.inputs) {
        const el = resolveSelectorTarget(input.selector, input.index ?? 0);
        if (!el) continue;

        if ('checked' in input) {
            const changed = el.checked !== input.checked;
            el.checked = input.checked;
            syncControlBindings(el, changed ? 'change' : null);
        } else if ('selectedValues' in input) {
            const previous = Array.from(el.selectedOptions ?? [], (option) => option.value);
            for (const option of Array.from(el.options ?? [])) {
                option.selected = input.selectedValues.includes(option.value);
            }
            syncControlBindings(el, arraysEqual(previous, input.selectedValues) ? null : 'change');
        } else if ('selectedValue' in input) {
            if (Array.from(el.options ?? []).some((option) => option.value === input.selectedValue)) {
                const changed = el.value !== input.selectedValue;
                el.value = input.selectedValue;
                syncControlBindings(el, changed ? 'change' : null);
            }
        } else if ('value' in input) {
            const changed = el.value !== input.value;
            el.value = input.value;
            syncControlBindings(el, changed ? 'input' : null);
        }
    }

    if (snapshot.focusSelector) {
        const el = resolveSelectorTarget(snapshot.focusSelector, snapshot.focusIndex ?? 0);
        if (el) {
            el.focus();
            if (snapshot.selectionStart !== null && el.setSelectionRange) {
                try {
                    el.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd);
                } catch (_e) {
                }
            }
        }
    }
}

function selectorIndex(el, selector) {
    const matches = Array.from(document.querySelectorAll(selector));

    return Math.max(matches.indexOf(el), 0);
}

function resolveSelectorTarget(selector, index = 0) {
    const matches = document.querySelectorAll(selector);

    return matches[index] ?? null;
}

function syncControlBindings(el, eventName) {
    if (!eventName) {
        return;
    }

    el.dispatchEvent(new Event(eventName, { bubbles: true }));
}

function arraysEqual(left, right) {
    if (left.length !== right.length) {
        return false;
    }

    for (let i = 0; i < left.length; i++) {
        if (left[i] !== right[i]) {
            return false;
        }
    }

    return true;
}
