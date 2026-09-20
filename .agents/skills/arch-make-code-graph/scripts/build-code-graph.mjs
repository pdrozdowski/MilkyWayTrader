#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import ts from 'typescript';

const GENERATOR = 'arch-make-code-graph';
const GENERATOR_VERSION = 1;
const SCHEMA_VERSION = 1;
const CACHE_VERSION = 1;
const RULES_VERSION = 1;
const DATA_MODULES = new Set(['definition.ts', 'types.ts', 'contracts.ts', 'registry.ts', 'gameobjects.ts']);
const ASSET_EXTENSIONS = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.mp3', '.ogg', '.png', '.svg', '.wav', '.webp', '.woff', '.woff2']);

const slash = value => value.replaceAll('\\', '/');
const hash = value => createHash('sha256').update(value).digest('hex');
const json = value => `${JSON.stringify(value, null, 2)}\n`;

function usage(message)
{
    if (message) console.error(message);
    console.error('Usage: build-code-graph.mjs [--root <dir>] [--source <dir>] [--output <file>] [--cache <file>] [--check] [--force]');
    process.exit(message ? 2 : 0);
}

function argumentsOf(values)
{
    const options = { root: '.', source: 'src', output: 'context/foundation/code-graph.json', cache: '.cache/arch-make-code-graph/cache-v1.json', check: false, force: false };
    while (values.length) {
        const flag = values.shift();
        if (flag === '--help') usage();
        if (flag === '--check' || flag === '--force') options[flag.slice(2)] = true;
        else if (['--root', '--source', '--output', '--cache'].includes(flag) && values.length) options[flag.slice(2)] = values.shift();
        else usage(`Unknown or incomplete option: ${flag}`);
    }
    options.root = resolve(options.root);
    for (const key of ['source', 'output', 'cache']) if (!isAbsolute(options[key])) options[key] = resolve(options.root, options[key]);
    return options;
}

async function filesBelow(directory)
{
    const found = [];
    async function visit(current)
    {
        let entries;
        try { entries = await readdir(current, { withFileTypes: true }); }
        catch (error) { if (error.code === 'ENOENT') return; throw error; }
        for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
            const path = join(current, entry.name);
            if (entry.isDirectory()) await visit(path);
            else if (entry.isFile() && entry.name.endsWith('.ts')) found.push(path);
        }
    }
    await visit(directory);
    return found;
}

async function readOptional(path)
{
    try { return await readFile(path, 'utf8'); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function readJson(path)
{
    const source = await readOptional(path);
    if (source === null) return { source: null, value: null, valid: true };
    try { return { source, value: JSON.parse(source), valid: true }; }
    catch { return { source, value: null, valid: false }; }
}

function moduleName(root, file)
{
    return slash(relative(root, file)).replace(/(?:\.d)?\.ts$/i, '');
}

function layerOf(root, file)
{
    const path = slash(relative(root, file)).toLowerCase();
    const name = basename(path);
    if (path.startsWith('src/assets/')) return 'asset';
    if (path.startsWith('src/data/') || path.includes('/definitions/') || path.endsWith('.d.ts') || DATA_MODULES.has(name)) return 'data';
    if (path === 'src/main.ts' || path === 'src/game/main.ts' || path.startsWith('src/ui/') ||
        ['src/game/scenes/', 'src/game/effects/', 'src/game/visual/'].some(prefix => path.startsWith(prefix))) return 'ui';
    return 'model';
}

function modifiersOf(node)
{
    return ts.canHaveModifiers(node) ? ts.getModifiers(node) ?? [] : [];
}

function exportedNames(node, name, parent)
{
    const modifiers = modifiersOf(parent ?? node);
    if (!modifiers.some(item => item.kind === ts.SyntaxKind.ExportKeyword)) return [];
    return [modifiers.some(item => item.kind === ts.SyntaxKind.DefaultKeyword) ? 'default' : name];
}

function declarationKind(node)
{
    if (ts.isClassDeclaration(node)) return 'class';
    if (ts.isInterfaceDeclaration(node)) return 'interface';
    if (ts.isTypeAliasDeclaration(node)) return 'type';
    if (ts.isFunctionDeclaration(node)) return 'function';
    if (ts.isEnumDeclaration(node)) return 'enum';
    return 'variable';
}

function isDeclarationName(node)
{
    const parent = node.parent;
    if (!parent) return false;
    if (ts.isShorthandPropertyAssignment(parent)) return false;
    if ('name' in parent && parent.name === node) return true;
    if (ts.isPropertyAccessExpression(parent) && parent.name === node) return true;
    if (ts.isPropertyAssignment(parent) && parent.name === node) return true;
    if (ts.isBindingElement(parent) && parent.propertyName === node) return true;
    if (ts.isQualifiedName(parent) && parent.right === node) return true;
    return ts.isLabeledStatement(parent) || ts.isBreakOrContinueStatement(parent);
}

function heritageKind(node)
{
    let current = node.parent;
    while (current) {
        if (ts.isHeritageClause(current)) return current.token === ts.SyntaxKind.ImplementsKeyword ? 'implements' : 'extends';
        if (ts.isClassElement(current) || ts.isTypeElement(current) || ts.isStatement(current)) break;
        current = current.parent;
    }
    return null;
}

function globCall(node)
{
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return null;
    const receiver = node.expression.expression;
    if (!ts.isMetaProperty(receiver) || receiver.keywordToken !== ts.SyntaxKind.ImportKeyword || receiver.name.text !== 'meta') return null;
    if (!['glob', 'globEager'].includes(node.expression.name.text) || !ts.isStringLiteralLike(node.arguments[0])) return null;
    let imported = '*';
    const settings = node.arguments[1];
    if (settings && ts.isObjectLiteralExpression(settings)) {
        const property = settings.properties.find(item => ts.isPropertyAssignment(item) && item.name.getText() === 'import');
        if (property && ts.isPropertyAssignment(property) && ts.isStringLiteralLike(property.initializer)) imported = property.initializer.text;
    }
    return { pattern: node.arguments[0].text, imported };
}

function factsForDeclaration(node, name, kind, exports)
{
    const references = [];
    const assets = [];
    const globs = [];
    function visit(current)
    {
        const glob = globCall(current);
        if (glob) globs.push(glob);
        if (ts.isStringLiteralLike(current)) {
            const clean = current.text.split(/[?#]/, 1)[0];
            if (ASSET_EXTENSIONS.has(extname(clean).toLowerCase())) assets.push(current.text);
        }
        if (ts.isIdentifier(current) && !isDeclarationName(current)) {
            let member = null;
            if (ts.isPropertyAccessExpression(current.parent) && current.parent.expression === current) member = current.parent.name.text;
            references.push({ name: current.text, member, kind: heritageKind(current) ?? 'uses' });
        }
        ts.forEachChild(current, visit);
    }
    ts.forEachChild(node, visit);
    return {
        name,
        kind,
        exports,
        references: [...new Map(references.map(item => [`${item.name}|${item.member ?? ''}|${item.kind}`, item])).values()],
        assets: [...new Set(assets)].sort(),
        globs: [...new Map(globs.map(item => [`${item.pattern}|${item.imported}`, item])).values()]
    };
}

function parseSource(root, file, source)
{
    const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const diagnostics = parsed.parseDiagnostics ?? [];
    if (diagnostics.length) {
        const problem = diagnostics[0];
        const position = parsed.getLineAndCharacterOfPosition(problem.start ?? 0);
        throw new Error(`${slash(relative(root, file))}:${position.line + 1}:${position.character + 1} ${ts.flattenDiagnosticMessageText(problem.messageText, '\n')}`);
    }
    const declarations = [];
    const imports = [];
    const reexports = [];
    for (const node of parsed.statements) {
        if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
            const specifier = node.moduleSpecifier.text;
            const clause = node.importClause;
            if (clause?.name) imports.push({ local: clause.name.text, imported: 'default', specifier });
            if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) imports.push({ local: clause.namedBindings.name.text, imported: '*', specifier });
            if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
                for (const item of clause.namedBindings.elements) imports.push({ local: item.name.text, imported: item.propertyName?.text ?? item.name.text, specifier });
            }
            continue;
        }
        if (ts.isExportDeclaration(node)) {
            const specifier = node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier) ? node.moduleSpecifier.text : null;
            if (!node.exportClause) reexports.push({ exported: '*', imported: '*', specifier });
            else if (ts.isNamedExports(node.exportClause)) {
                for (const item of node.exportClause.elements) reexports.push({ exported: item.name.text, imported: item.propertyName?.text ?? item.name.text, specifier });
            }
            continue;
        }
        if (ts.isVariableStatement(node)) {
            for (const item of node.declarationList.declarations) if (ts.isIdentifier(item.name)) {
                declarations.push(factsForDeclaration(item, item.name.text, 'variable', exportedNames(node, item.name.text)));
            }
            continue;
        }
        if ((ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) ||
            ts.isFunctionDeclaration(node) || ts.isEnumDeclaration(node)) && node.name) {
            declarations.push(factsForDeclaration(node, node.name.text, declarationKind(node), exportedNames(node, node.name.text)));
        }
    }
    return { module: moduleName(root, file), layer: layerOf(root, file), declarations, imports, reexports };
}

function resolveModule(fromFile, specifier, sourceFiles)
{
    if (!specifier.startsWith('.')) return null;
    let base = slash(resolve(dirname(fromFile), specifier));
    if (/\.(?:mjs|cjs|js)$/i.test(base)) base = base.replace(/\.(?:mjs|cjs|js)$/i, '');
    for (const candidate of [base, `${base}.ts`, `${base}.d.ts`, `${base}/index.ts`, `${base}/index.d.ts`]) {
        const found = sourceFiles.get(candidate.toLowerCase());
        if (found) return found;
    }
    return null;
}

function globRegex(pattern)
{
    let expression = '';
    for (let index = 0; index < pattern.length; index++) {
        const character = pattern[index];
        if (character === '*' && pattern[index + 1] === '*') { expression += '.*'; index++; }
        else if (character === '*') expression += '[^/]*';
        else if (character === '?') expression += '[^/]';
        else expression += character.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
    }
    return new RegExp(`^${expression}$`, 'i');
}

const nodeId = (facts, name) => `${facts.module}#${name}`;

async function existingAsset(root, sourceFile, literal)
{
    if (/^(?:data:|https?:)/i.test(literal)) return null;
    const clean = literal.split(/[?#]/, 1)[0].replace(/^\/+/, '');
    const candidates = literal.startsWith('/')
        ? [resolve(root, 'public', clean)]
        : [resolve(dirname(sourceFile), clean), resolve(root, 'public', clean), resolve(root, 'public/assets', clean)];
    for (const candidate of candidates) {
        try { if ((await stat(candidate)).isFile()) return candidate; }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    return null;
}

async function buildGraph(root, sourceRoot, cachedFiles)
{
    const entries = Object.entries(cachedFiles);
    const sourceFiles = new Map(entries.map(([file]) => [slash(resolve(root, file)).toLowerCase(), slash(resolve(root, file))]));
    const factsByFile = new Map(entries.map(([file, cached]) => [slash(resolve(root, file)), cached.facts]));
    const nodes = new Map();
    const edges = new Map();
    for (const facts of factsByFile.values()) for (const declaration of facts.declarations) {
        const id = nodeId(facts, declaration.name);
        if (!nodes.has(id)) nodes.set(id, { id, name: declaration.name, layer: facts.layer, module: facts.module, kind: declaration.kind });
    }
    const addEdge = (from, to, kind) => {
        if (from !== to && nodes.has(from) && nodes.has(to)) edges.set(`${from}|${to}|${kind}`, { from, to, kind });
    };
    const exportMemo = new Map();
    const resolving = new Set();
    function exported(file, name)
    {
        const key = `${file}|${name}`;
        if (exportMemo.has(key)) return exportMemo.get(key);
        if (resolving.has(key)) return [];
        resolving.add(key);
        const facts = factsByFile.get(file);
        const targets = [];
        if (facts) {
            for (const declaration of facts.declarations) if (declaration.exports.includes(name)) targets.push(nodeId(facts, declaration.name));
            for (const item of facts.reexports) {
                if (item.exported !== name && item.exported !== '*') continue;
                if (!item.specifier) {
                    const local = facts.declarations.find(declaration => declaration.name === item.imported);
                    if (local) targets.push(nodeId(facts, local.name));
                } else {
                    const targetFile = resolveModule(file, item.specifier, sourceFiles);
                    if (targetFile) targets.push(...exported(targetFile, item.exported === '*' ? name : item.imported));
                }
            }
        }
        resolving.delete(key);
        const unique = [...new Set(targets)];
        exportMemo.set(key, unique);
        return unique;
    }
    for (const [file, facts] of factsByFile) {
        const locals = new Map(facts.declarations.map(declaration => [declaration.name, nodeId(facts, declaration.name)]));
        const imports = new Map(facts.imports.map(item => [item.local, item]));
        for (const declaration of facts.declarations) {
            const from = nodeId(facts, declaration.name);
            for (const reference of declaration.references) {
                if (locals.has(reference.name)) addEdge(from, locals.get(reference.name), reference.kind);
                const binding = imports.get(reference.name);
                if (!binding) continue;
                const targetFile = resolveModule(file, binding.specifier, sourceFiles);
                if (!targetFile) continue;
                const imported = binding.imported === '*' ? reference.member : binding.imported;
                if (!imported) continue;
                for (const target of exported(targetFile, imported)) addEdge(from, target, reference.kind === 'uses' ? 'imports' : reference.kind);
            }
            for (const item of declaration.globs) {
                const matcher = globRegex(slash(resolve(dirname(file), item.pattern)));
                for (const targetFile of factsByFile.keys()) if (matcher.test(targetFile)) {
                    const targetFacts = factsByFile.get(targetFile);
                    const targets = item.imported === '*'
                        ? targetFacts.declarations.filter(candidate => candidate.exports.length).map(candidate => nodeId(targetFacts, candidate.name))
                        : exported(targetFile, item.imported);
                    for (const target of targets) addEdge(from, target, 'glob-imports');
                }
            }
            for (const literal of declaration.assets) {
                const asset = await existingAsset(root, file, literal);
                if (!asset) continue;
                const module = slash(relative(root, asset));
                const id = `asset:${module}`;
                nodes.set(id, { id, name: basename(asset), layer: 'asset', module, kind: 'asset' });
                addEdge(from, id, 'asset');
            }
        }
    }
    return {
        schemaVersion: SCHEMA_VERSION,
        generator: GENERATOR,
        sourceRoot: slash(relative(root, sourceRoot)) || '.',
        nodes: [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id)),
        edges: [...edges.values()].sort((a, b) => `${a.from}|${a.to}|${a.kind}`.localeCompare(`${b.from}|${b.to}|${b.kind}`))
    };
}

async function writeChanged(path, content)
{
    if (await readOptional(path) === content) return false;
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
    return true;
}

async function main()
{
    const options = argumentsOf(process.argv.slice(2));
    const output = await readJson(options.output);
    if (output.source !== null && (!output.valid || output.value?.generator !== GENERATOR) && !options.force) {
        throw new Error(`Refusing to overwrite JSON not owned by ${GENERATOR}: ${slash(relative(options.root, options.output))}. Use --force to replace it.`);
    }
    const sourcePaths = await filesBelow(options.source);
    const tsconfig = await readOptional(join(options.root, 'tsconfig.json')) ?? '';
    const cacheRead = await readJson(options.cache);
    const sourceRootName = slash(relative(options.root, options.source)) || '.';
    const cacheValid = cacheRead.valid && cacheRead.value?.cacheVersion === CACHE_VERSION &&
        cacheRead.value?.generatorVersion === GENERATOR_VERSION && cacheRead.value?.schemaVersion === SCHEMA_VERSION &&
        cacheRead.value?.rulesVersion === RULES_VERSION && cacheRead.value?.sourceRoot === sourceRootName &&
        cacheRead.value?.tsconfigHash === hash(tsconfig) && cacheRead.value?.files && typeof cacheRead.value.files === 'object';
    const previousFiles = cacheValid ? cacheRead.value.files : {};
    const files = {};
    let parsed = 0;
    let reused = 0;
    for (const file of sourcePaths) {
        const source = await readFile(file, 'utf8');
        const digest = hash(source);
        const key = slash(relative(options.root, file));
        if (previousFiles[key]?.hash === digest) {
            files[key] = previousFiles[key];
            reused++;
        } else {
            files[key] = { hash: digest, facts: parseSource(options.root, file, source) };
            parsed++;
        }
    }
    const deleted = Object.keys(previousFiles).filter(file => !files[file]).length;
    const orderedFiles = Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)));
    const graph = await buildGraph(options.root, options.source, orderedFiles);
    const graphText = json(graph);
    if (options.check) {
        const current = output.valid && output.source === graphText;
        console.log(`Graph ${current ? 'CURRENT' : 'STALE'} ${slash(relative(options.root, options.output))}; parsed ${parsed}, reused ${reused}, deleted ${deleted}, nodes ${graph.nodes.length}, edges ${graph.edges.length}`);
        process.exit(current ? 0 : 1);
    }
    const cache = {
        cacheVersion: CACHE_VERSION,
        generatorVersion: GENERATOR_VERSION,
        schemaVersion: SCHEMA_VERSION,
        rulesVersion: RULES_VERSION,
        sourceRoot: sourceRootName,
        tsconfigHash: hash(tsconfig),
        files: orderedFiles
    };
    const changed = await writeChanged(options.output, graphText);
    await writeChanged(options.cache, json(cache));
    const state = output.source === null ? 'CREATED' : changed ? 'UPDATED' : 'UNCHANGED';
    console.log(`Graph ${state} ${slash(relative(options.root, options.output))}; parsed ${parsed}, reused ${reused}, deleted ${deleted}, nodes ${graph.nodes.length}, edges ${graph.edges.length}`);
}

main().catch(error => {
    console.error(`Code graph failed: ${error.message}`);
    process.exit(2);
});
