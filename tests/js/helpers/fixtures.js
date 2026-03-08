import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const helperDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(helperDir, '../../..');

export function readPackageFixture(relativePath) {
    return readFileSync(resolve(packageRoot, relativePath), 'utf8');
}

export function readFeatureEditFixture(name) {
    return readPackageFixture(`tests/php/Fixtures/Feature/views/edit-simulation/${name}.blade.php`);
}
