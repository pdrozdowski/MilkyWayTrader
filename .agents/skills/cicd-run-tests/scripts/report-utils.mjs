import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';

const included = new Set(['.ts', '.mjs', '.js', '.json', '.html', '.css', '.md', '.yaml', '.yml']);
const ignoredDirectories = new Set(['.cache', '.git', 'dist', 'node_modules']);

async function projectFiles (directory, root)
{
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
        const path = join(directory, entry.name);
        if (entry.isDirectory()) files.push(...await projectFiles(path, root));
        else if (included.has(extname(entry.name))) files.push({ path, name: relative(root, path).replaceAll('\\', '/') });
    }
    return files;
}

export async function workspaceFingerprint (rootDirectory)
{
    const root = resolve(rootDirectory);
    const hash = createHash('sha256');
    const files = (await projectFiles(root, root)).sort((left, right) => left.name.localeCompare(right.name));
    for (const file of files) {
        hash.update(file.name).update('\0');
        hash.update(await readFile(file.path)).update('\0');
    }
    return hash.digest('hex');
}

export function stripAnsi (value)
{
    return value.replace(/[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d\/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g, '');
}

export function normalizedFailure (value, root)
{
    return stripAnsi(value)
        .replaceAll(resolve(root), '<workspace>')
        .replaceAll(resolve(root).replaceAll('\\', '/'), '<workspace>')
        .replace(/\b\d+(?:\.\d+)?ms\b/g, '<duration>')
        .replace(/\b20\d{2}-\d{2}-\d{2}T[^\s]+/g, '<timestamp>')
        .trim();
}
