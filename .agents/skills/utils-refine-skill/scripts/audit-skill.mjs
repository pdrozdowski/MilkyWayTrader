#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';

function usage (message)
{
    if (message) console.error(message);
    console.error('Usage: audit-skill.mjs <skill-directory> [--report-dir <directory>]');
    process.exit(message ? 2 : 0);
}

const args = process.argv.slice(2);
if (args.includes('--help')) usage();
const targetArg = args.shift();
if (!targetArg) usage('A skill directory is required.');
let reportDir = '.cache/skill-refinement';
while (args.length) {
    const flag = args.shift();
    if (flag === '--report-dir' && args.length) reportDir = args.shift();
    else usage(`Unknown or incomplete option: ${flag}`);
}

const root = resolve('.');
const target = resolve(targetArg);
const skillFile = join(target, 'SKILL.md');
const findings = [];
const checks = [];
const add = (severity, message) => findings.push({ severity, message });
let source = '';
try { source = await readFile(skillFile, 'utf8'); }
catch { add('HIGH', 'SKILL.md is missing or unreadable.'); }

const name = source.match(/^name:\s*([^\r\n]+)$/m)?.[1]?.trim();
const description = source.match(/^description:\s*([^\r\n]+)$/m)?.[1]?.trim();
if (!source.startsWith('---')) add('HIGH', 'YAML frontmatter is missing.');
if (!name) add('HIGH', 'Frontmatter name is missing.');
if (name && name !== basename(target)) add('HIGH', `Frontmatter name '${name}' differs from directory '${basename(target)}'.`);
if (!description || description.length < 30) add('MEDIUM', 'Description does not clearly route the skill.');
if (/\b(?:TODO|FIXME|PLACEHOLDER)\b/i.test(source)) add('HIGH', 'Unfinished scaffold marker remains.');
if (source.split(/\r?\n/).length > 250) add('MEDIUM', 'SKILL.md exceeds 250 lines; move conditional detail to references.');

const links = [...source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map(match => match[1]).filter(link => !/^(?:https?:|#)/.test(link));
for (const link of links) {
    const path = resolve(dirname(skillFile), link.split('#')[0]);
    try { await stat(path); checks.push(`link ${relative(root, path)}: PASS`); }
    catch { add('HIGH', `Broken local reference: ${link}`); }
}

async function scripts (directory)
{
    try {
        const entries = await readdir(directory, { withFileTypes: true });
        const result = [];
        for (const entry of entries) {
            const path = join(directory, entry.name);
            if (entry.isDirectory()) result.push(...await scripts(path));
            else if (/\.(?:mjs|js)$/.test(entry.name)) result.push(path);
        }
        return result;
    } catch { return []; }
}

for (const script of await scripts(join(target, 'scripts'))) {
    const check = spawnSync(process.execPath, ['--check', script], { encoding: 'utf8', windowsHide: true });
    if (check.status === 0) checks.push(`syntax ${relative(root, script)}: PASS`);
    else add('HIGH', `Invalid script ${relative(root, script)}: ${(check.stderr || check.stdout).trim()}`);
}

if (!isAbsolute(reportDir)) reportDir = resolve(root, reportDir);
await mkdir(reportDir, { recursive: true });
const stamp = new Date().toISOString().replaceAll(':', '-');
const report = join(reportDir, `${basename(target)}-${stamp}.md`);
const counts = severity => findings.filter(item => item.severity === severity).length;
const body = [
    `# Skill refinement: ${basename(target)}`,
    '',
    `- Skill: \`${relative(root, target)}\``,
    `- UTC: ${new Date().toISOString()}`,
    `- Findings: HIGH ${counts('HIGH')}, MEDIUM ${counts('MEDIUM')}, LOW ${counts('LOW')}`,
    '',
    '## Automated checks',
    '',
    ...(checks.length ? checks.map(item => `- ${item}`) : ['- No executable scripts or local links found.']),
    '',
    '## Findings',
    '',
    ...(findings.length ? findings.map(item => `- **${item.severity}** ${item.message}`) : ['- No automated high- or medium-priority findings. Complete the qualitative checklist before acceptance.']),
    '',
    '## Qualitative refinement',
    '',
    '- Review trigger, scope, permissions, progressive disclosure, failure evidence and stopping conditions using `references/review-checklist.md`.',
    '- Record applied changes and final validation commands here when the refinement pass is complete.',
    ''
].join('\n');
await writeFile(report, body);
console.log(`Report ${relative(root, report)}\nHIGH ${counts('HIGH')} MEDIUM ${counts('MEDIUM')}`);
process.exit(counts('HIGH') || counts('MEDIUM') ? 1 : 0);
