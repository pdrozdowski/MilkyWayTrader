#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

function usage(message)
{
    if (message) console.error(message);
    console.error('Usage: check-prd.mjs [path-to-prd.md]');
    process.exit(message ? 2 : 0);
}

const args = process.argv.slice(2);
if (args.includes('--help')) usage();
if (args.length > 1) usage('Only one PRD path may be supplied.');

const target = resolve(args[0] ?? 'context/foundation/prd.md');
let source;
try { source = await readFile(target, 'utf8'); }
catch (error) {
    console.error(`Cannot read PRD: ${target}\n${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
}

const lines = source.split(/\r?\n/);
const findings = [];
const add = (line, code, message) => findings.push({ line, code, message });

const polishCharacters = /[ąćęłńóśźż]/i;
const polishWords = /\b(?:brak|czas|gra|gracz|gracza|gracze|jest|kiedy|który|która|które|może|mogą|oraz|planeta|pozostały|pytania|statek|towar|wymagania|zalogowany)\b/i;
for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (polishCharacters.test(line) || polishWords.test(line)) {
        add(index + 1, 'NON_ENGLISH', 'Polish-language text detected; the PRD must be English.');
    }
}

const start = lines.findIndex(line => line === '## Functional Requirements');
if (start < 0) add(0, 'MISSING_SECTION', 'Missing exact `## Functional Requirements` section.');
let end = lines.length;
if (start >= 0) {
    const relativeEnd = lines.slice(start + 1).findIndex(line => line.startsWith('## '));
    if (relativeEnd >= 0) end = start + 1 + relativeEnd;
}

const requirements = [];
const frPattern = /^- FR-(\d{3}): (.+?) can (.+)\. Priority: (must-have|nice-to-have)$/;
const forbiddenSolution = /\b(?:api|button|checkbox|click|cloudflare|component|configuration|database|dialog|dom|dropdown|firebase|google|graphql|html|icon|jwt|modal|oauth|page|panel|phaser|postgresql|press|screen|slider|supabase|tap|timestamp|tooltip|typescript|websocket)\b/i;
const forbiddenDetail = /[`=×]|(?:>=|<=|=>)|\b(?:round|rounded|percent|percentage|per-second|per-minute)\b/i;
const likelyComposite = /\b(?:and|or) can\b|;|\b(?:and then|followed by|as well as)\b/i;

if (start >= 0) {
    for (let index = start + 1; index < end; index++) {
        const line = lines[index];
        if (!line || line.startsWith('### ')) continue;
        if (!line.startsWith('- FR-')) {
            add(index + 1, 'FR_SECTION_CONTENT', 'Functional Requirements may contain only thematic headings and FR lines.');
            continue;
        }
        const match = line.match(frPattern);
        if (!match) {
            add(index + 1, 'FR_FORMAT', 'Expected `- FR-NNN: Actor can capability. Priority: must-have|nice-to-have`.');
            continue;
        }
        const [, id, actor, capability] = match;
        requirements.push({ id: Number(id), line: index + 1 });
        if (!actor.trim() || !capability.trim()) add(index + 1, 'FR_EMPTY', 'Actor and capability must both be present.');
        if ((line.match(/\bcan\b/g) ?? []).length !== 1) add(index + 1, 'FR_MULTIPLE_CAN', 'An FR must contain exactly one capability predicate.');
        if (forbiddenSolution.test(`${actor} ${capability}`)) add(index + 1, 'FR_SOLUTION', 'Move UI, provider, schema, or implementation details outside the FR.');
        if (forbiddenDetail.test(capability)) add(index + 1, 'FR_DETAIL', 'Move formulas, calculations, and numeric mechanics outside the FR.');
        if (likelyComposite.test(capability)) add(index + 1, 'FR_COMPOSITE', 'This wording likely combines multiple independently testable capabilities.');
    }
}

if (start >= 0 && !requirements.length) add(start + 1, 'NO_REQUIREMENTS', 'Functional Requirements contains no valid FR lines.');
for (let index = 0; index < requirements.length; index++) {
    const expected = index + 1;
    if (requirements[index].id !== expected) {
        add(requirements[index].line, 'FR_SEQUENCE', `Expected FR-${String(expected).padStart(3, '0')} at this position.`);
    }
}

const firstLineById = new Map();
for (const requirement of requirements) {
    if (firstLineById.has(requirement.id)) {
        add(requirement.line, 'FR_DUPLICATE', `FR-${String(requirement.id).padStart(3, '0')} duplicates line ${firstLineById.get(requirement.id)}.`);
    } else {
        firstLineById.set(requirement.id, requirement.line);
    }
}

if (findings.length) {
    console.error(`PRD capability validation FAILED: ${target}`);
    for (const finding of findings) console.error(`  ${finding.line ? `line ${finding.line}` : 'document'} [${finding.code}] ${finding.message}`);
    process.exit(1);
}

console.log(`PRD capability validation PASS: ${target} (${requirements.length} sequential English capability FRs)`);
