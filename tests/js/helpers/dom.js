
export function makeDoc(bodyHTML) {
    return new DOMParser().parseFromString(
        `<!DOCTYPE html><html><head><title>Test</title></head><body>${bodyHTML}</body></html>`,
        'text/html',
    );
}

export function boundary(id, content, file = 'test.blade.php', key = null) {
    const keyAttr = key ? ` key="${key}"` : '';
    return `<!--bl:begin id="${id}"${keyAttr} file="${file}"-->${content}<!--bl:end id="${id}"${keyAttr}-->`;
}
