import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const directory = 'dist';
const maxFiles = 20_000;
const maxFileBytes = 25 * 1024 * 1024;
const files = [];

async function collect(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
        const entryPath = join(path, entry.name);
        if (entry.isDirectory()) {
            await collect(entryPath);
        } else if (entry.isFile()) {
            files.push({ path: entryPath, bytes: (await stat(entryPath)).size });
        } else {
            throw new Error(`Unsupported Pages asset: ${entryPath}`);
        }
    }
}

await stat(join(directory, 'index.html'));
await collect(directory);

if (files.length > maxFiles) {
    throw new Error(`Pages Free supports ${maxFiles} files; found ${files.length}.`);
}
for (const file of files) {
    if (file.bytes > maxFileBytes) {
        throw new Error(`Pages asset exceeds 25 MiB: ${file.path} (${file.bytes} bytes).`);
    }
}

const bytes = files.reduce((total, file) => total + file.bytes, 0);
const largest = files.reduce((max, file) => Math.max(max, file.bytes), 0);
console.log(`Pages assets: ${files.length} files, ${bytes} bytes total, ${largest} bytes largest file.`);
