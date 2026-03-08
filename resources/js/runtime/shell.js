export function patchShell(oldDoc, newDoc, liveDoc = document) {
    let count = 0;

    const oldHtml = oldDoc?.documentElement;
    const newHtml = newDoc?.documentElement;
    const liveHtml = liveDoc?.documentElement ?? document.documentElement;
    if (oldHtml && newHtml && liveHtml && applyAttributeDiff(liveHtml, oldHtml, newHtml)) {
        count++;
    }

    const oldBody = oldDoc?.body;
    const newBody = newDoc?.body;
    const liveBody = liveDoc?.body ?? document.body;
    if (oldBody && newBody && liveBody && applyAttributeDiff(liveBody, oldBody, newBody)) {
        count++;
    }

    return count;
}

function applyAttributeDiff(target, oldSource, newSource) {
    let changed = false;
    const attributeNames = new Set([
        ...[...oldSource.attributes].map((attr) => attr.name),
        ...[...newSource.attributes].map((attr) => attr.name),
    ]);

    for (const name of attributeNames) {
        const oldValue = oldSource.getAttribute(name);
        const newValue = newSource.getAttribute(name);
        if (oldValue === newValue) {
            continue;
        }

        if (newValue === null) {
            if (target.hasAttribute(name)) {
                target.removeAttribute(name);
                changed = true;
            }
            continue;
        }

        if (target.getAttribute(name) !== newValue) {
            target.setAttribute(name, newValue);
            changed = true;
        }
    }

    return changed;
}
