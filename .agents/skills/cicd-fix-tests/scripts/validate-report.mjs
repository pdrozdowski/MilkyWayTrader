#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { workspaceFingerprint } from '../../cicd-run-tests/scripts/report-utils.mjs';

const reportArg = process.argv[2];
if (!reportArg || process.argv.includes('--help')) {
    console.error('Usage: validate-report.mjs <results.md>');
    process.exit(reportArg ? 0 : 2);
}
const report = resolve(reportArg);
if (!report.endsWith('results.md')) {
    console.error('Input must be a cicd-run-tests results.md file.');
    process.exit(2);
}
let source;
try { source = await readFile(report, 'utf8'); }
catch { console.error('Report is missing or unreadable.'); process.exit(2); }
const workspace = source.match(/^- Workspace: `([^`]+)`$/m)?.[1];
const expected = source.match(/^- Workspace fingerprint: `([a-f0-9]{64})`$/m)?.[1];
const status = source.match(/^- Status: \*\*([A-Z_]+)\*\*$/m)?.[1];
if (!workspace || !expected || !status) {
    console.error('Report does not satisfy the cicd-run-tests contract.');
    process.exit(2);
}
const root = resolve(workspace);
const cacheRoot = resolve(root, '.cache/test-runs');
if (!report.startsWith(cacheRoot) || dirname(report) === cacheRoot) {
    console.error('Report is outside this workspace test-run directory.');
    process.exit(2);
}
const actual = await workspaceFingerprint(root);
if (actual !== expected) {
    console.error('STALE_REPORT: workspace files changed; run cicd-run-tests again.');
    process.exit(1);
}
console.log(`CURRENT ${status} ${report}`);
