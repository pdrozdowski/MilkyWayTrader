import { execFileSync } from 'node:child_process';

function readPayload ()
{
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { input += chunk; });
    return new Promise(resolve => process.stdin.on('end', () => {
        try {
            resolve(JSON.parse(input));
        } catch {
            resolve({});
        }
    }));
}

function outputOf (command, argumentsList, cwd)
{
    try {
        return { ok: true, output: execFileSync(command, argumentsList, { cwd, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' } }) };
    } catch (error) {
        return { ok: false, output: `${error.stdout ?? ''}${error.stderr ?? error.message}` };
    }
}

function npmOutputOf (argumentsList, cwd)
{
    if (process.platform !== 'win32') return outputOf('npm', argumentsList, cwd);

    return outputOf(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `npm.cmd ${argumentsList.join(' ')}`], cwd);
}

const payload = await readPayload();
if (payload.stop_hook_active === true) {
    console.log('{}');
    process.exit(0);
}

const repository = outputOf('git', ['rev-parse', '--show-toplevel'], payload.cwd ?? process.cwd());
if (!repository.ok || !repository.output.trim()) {
    console.log('{}');
    process.exit(0);
}

const cwd = repository.output.trim();
const changed = outputOf('git', ['diff', '--name-only', 'HEAD'], cwd);
const untracked = outputOf('git', ['ls-files', '--others', '--exclude-standard'], cwd);
if (!changed.ok || !untracked.ok) {
    console.log('{}');
    process.exit(0);
}

const changedFiles = [...new Set(`${changed.output}\n${untracked.output}`.split(/\r?\n/).filter(Boolean))];
if (!changedFiles.length) {
    console.log('{}');
    process.exit(0);
}

const changedIn = (...patterns) => changedFiles.some(file => patterns.some(pattern => pattern.test(file)));
const scripts = new Set();
const broadChange = changedIn(
    /^(?:package(?:-lock)?\.json|tsconfig(?:\.[^.]+)?\.json|vite\/|playwrightConfig\.ts|tests\/architecture\.test\.mjs)$/
);

if (broadChange) {
    ['test:domain', 'test:mechanics', 'test:objects', 'test:audio'].forEach(script => scripts.add(script));
} else {
    if (changedIn(/^(?:src\/game\/(?:domain|application|state)\/|src\/game\/definitions\/(?:initialGameState|serotonMarketDefinitions)\.ts|tests\/domain\/)/)) scripts.add('test:domain');
    if (changedIn(/^(?:src\/game\/(?:mechanics|definitions|scenes\/gameObjects|visual)\/|tests\/game-mechanics\.test\.mjs)/)) scripts.add('test:mechanics');
    if (changedIn(/^(?:src\/game\/audio\/|public\/assets\/audio\/|src\/game\/objects\/spaceship\/shipWeapon\.ts|tests\/game-audio\.test\.mjs|\.agents\/skills\/utils-add-sound\/)/)) scripts.add('test:audio');
    if (changedIn(/^(?:tests\/object-scaffold\.test\.mjs|\.agents\/skills\/utils-add-object-to-scene\/)/)) scripts.add('test:objects');
}

if (changedIn(/^(?:src\/|tests\/|tsconfig(?:\.[^.]+)?\.json|package(?:-lock)?\.json)/)) scripts.add('test:architecture');

const needsTypecheck = changedIn(/^(?:src\/.*\.(?:ts|tsx|mts|cts)|tests\/.*\.(?:ts|tsx|mts|cts)|(?:tsconfig(?:\.[^.]+)?\.json|package(?:-lock)?\.json))/);
const checks = [
    ...[...scripts].map(script => [script, ['run', script]]),
    ...(needsTypecheck ? [['Typecheck', ['run', 'typecheck']]] : [])
];

if (!checks.length) {
    console.log('{}');
    process.exit(0);
}
const failures = [];
for (const [name, argumentsList] of checks) {
    const result = npmOutputOf(argumentsList, cwd);
    if (!result.ok) failures.push(`${name} failed:\n${result.output}`);
}

if (failures.length) {
    process.stderr.write(`Fix these before you finish:\n${failures.join('\n\n')}`);
    process.exit(2);
}

console.log('{}');
