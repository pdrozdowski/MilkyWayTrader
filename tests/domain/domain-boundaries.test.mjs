import assert from 'node:assert/strict';
import { test } from 'node:test';
import { access, readdir, readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, relative, resolve } from 'node:path';

const root = resolve('.');
const domainRoot = join(root, 'src/game/domain');

async function files (directory)
{
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(entries.map(entry => entry.isDirectory()
        ? files(join(directory, entry.name))
        : Promise.resolve(extname(entry.name) === '.ts' ? [join(directory, entry.name)] : [])));
    return nested.flat();
}

test('domain testing contract and source boundary are present', async () => {
    await access(join(domainRoot, 'AGENTS.md'));
    await access(join(root, 'context/foundation/testing.md'));
    const importPattern = /(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g;
    const browserGlobal = /\b(?:document|window|HTMLElement|localStorage|fetch|Phaser)\b/;
    for (const file of await files(domainRoot)) {
        const source = await readFile(file, 'utf8');
        assert(!browserGlobal.test(source), `${relative(root, file)} uses a platform global`);
        for (const match of source.matchAll(importPattern)) {
            const specifier = match[1];
            assert(specifier.startsWith('.'), `${relative(root, file)} imports external module ${specifier}`);
            const target = normalize(resolve(dirname(file), specifier));
            assert(target.startsWith(domainRoot), `${relative(root, file)} imports outside the domain`);
        }
    }
});
