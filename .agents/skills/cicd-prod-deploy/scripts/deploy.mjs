import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseEnv } from 'node:util';
import { join, resolve } from 'node:path';
import { verifyBrowsers } from './verify-browsers.mjs';

const args = process.argv.slice(2);
if (args.includes('--help')) {
    console.log('Run in MilkyWayTrader: node --use-system-ca deploy.mjs [--deploy-authorized]. No commits/pushes. Logs: .cache/prod-deploy/; report: context/deployment/releases/.');
    process.exit(0);
}
if (args.some(arg => arg !== '--deploy-authorized')) throw new Error('Unknown argument; use --help.');
const authorized = args.includes('--deploy-authorized');
const repo = 'pdrozdowski/MilkyWayTrader';
const project = 'milky-way-trader';
const production = 'https://milky-way-trader.pages.dev/';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const workingStatus = () => git('status', '--porcelain', '--', '.', ':(exclude)context/deployment/releases/*.md');
const sha = git('rev-parse', 'HEAD');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const directory = resolve('.cache/prod-deploy', `${stamp}-${sha.slice(0, 7)}`);
await mkdir(directory, { recursive: true });
const logFile = join(directory, 'run.json');
const state = { started: new Date().toISOString(), sha, steps: [], status: 'running' };
const record = async (step, details = {}) => {
    state.steps.push({ at: new Date().toISOString(), step, ...details });
    await writeFile(logFile, JSON.stringify(state, null, 2));
};
const requireTrue = (condition, message) => { if (!condition) throw new Error(message); };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const request = async (url, options = {}) => {
    const response = await fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
    requireTrue(response.ok, `${new URL(url).hostname}: HTTP ${response.status}`);
    return response;
};
const ghHeaders = { Accept: 'application/vnd.github+json', 'User-Agent': 'MilkyWayTrader-prod-deploy' };
const gh = async endpoint => (await request(`https://api.github.com/repos/${repo}/${endpoint}`, { headers: ghHeaders })).json();

try {
    requireTrue(Number(process.versions.node.split('.')[0]) >= 24, 'Node 24 required.');
    requireTrue(git('branch', '--show-current') === 'main', 'STOP: production requires main.');
    requireTrue(git('remote', 'get-url', 'origin') === `https://github.com/${repo}.git`, 'STOP: unexpected origin.');
    requireTrue(workingStatus() === '', 'STOP: deployment sources must be clean; preserve user changes.');
    const remote = git('-c', 'http.sslBackend=schannel', 'ls-remote', 'origin', 'refs/heads/main').split(/\s/)[0];
    requireTrue(remote === sha, 'STOP: HEAD is not origin/main. Explicit permission required before git push.');
    git('check-ignore', '.env.deploy.local');
    await record('preflight', { node: process.version, branch: 'main', remoteSha: remote, clean: true });

    const findRun = async () => {
        const data = await gh('actions/workflows/deploy.yml/runs?branch=main&per_page=30');
        return data.workflow_runs.find(run => run.head_sha === sha && run.event === 'push');
    };
    let run = await findRun();
    if (!run) {
        // Allow time for a recent push to become visible before any mutation.
        await wait(5000);
        run = await findRun();
    }
    if (!run) {
        requireTrue(authorized, 'STOP: no push workflow for HEAD; production deployment authorization required.');
        const active = await gh('actions/workflows/deploy.yml/runs?branch=main&per_page=30');
        requireTrue(!active.workflow_runs.some(item => item.status !== 'completed'), 'STOP: main workflow already active; inspect it before dispatch.');
        // Credential-helper output stays in memory and is never logged.
        const credential = execFileSync('git', ['credential', 'fill'], {
            input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8', windowsHide: true,
            env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' }, stdio: ['pipe', 'pipe', 'pipe']
        });
        const token = credential.split('\n').find(line => line.startsWith('password='))?.slice(9).trim();
        requireTrue(token, 'STOP: GitHub credential helper has no credential.');
        const dispatched = Date.now();
        await record('workflow-dispatch-attempt', { ref: 'main', target: 'production' });
        await request(`https://api.github.com/repos/${repo}/actions/workflows/deploy.yml/dispatches`, {
            method: 'POST', headers: { ...ghHeaders, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ ref: 'main', inputs: { target: 'production' } })
        });
        for (let i = 0; i < 12 && !run; i++) {
            await wait(5000);
            const data = await gh('actions/workflows/deploy.yml/runs?branch=main&event=workflow_dispatch&per_page=10');
            run = data.workflow_runs.find(item => item.head_sha === sha && Date.parse(item.created_at) >= dispatched - 1000);
        }
        requireTrue(run, 'STOP: dispatched run not visible; do not dispatch again automatically.');
    }
    await record('workflow-selected', { id: run.id, url: run.html_url, event: run.event });
    const deadline = Date.now() + 15 * 60 * 1000;
    while (run.status !== 'completed' && Date.now() < deadline) {
        await wait(5000);
        run = await gh(`actions/runs/${run.id}`);
    }
    requireTrue(run.status === 'completed' && run.conclusion === 'success', `STOP: CI ${run.status}/${run.conclusion}; ${run.html_url}`);
    const jobs = await gh(`actions/runs/${run.id}/jobs`);
    const job = jobs.jobs.find(job => job.steps.some(step => step.name === 'Publish to Cloudflare Pages' && step.conclusion === 'success'));
    requireTrue(job?.conclusion === 'success', 'STOP: CI publication step did not succeed.');
    await record('ci-success', { url: run.html_url, job: job.id, steps: job.steps.map(step => ({ name: step.name, conclusion: step.conclusion })) });

    const env = parseEnv(await readFile('.env.deploy.local', 'utf8'));
    requireTrue(env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN, 'STOP: missing local Cloudflare credentials.');
    const cfBase = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID)}/pages/projects/${project}`;
    const cf = async suffix => {
        const data = await (await request(cfBase + suffix, { headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` } })).json();
        requireTrue(data.success, 'STOP: Cloudflare API unsuccessful.');
        return data.result;
    };
    let current = await cf('');
    requireTrue(current.production_branch === 'main', 'STOP: unexpected production branch.');
    for (let i = 0; i < 12 && current.canonical_deployment?.deployment_trigger?.metadata?.commit_hash !== sha; i++) {
        await wait(5000);
        current = await cf('');
    }
    const deployment = current.canonical_deployment;
    const metadata = deployment?.deployment_trigger?.metadata;
    requireTrue(deployment?.environment === 'production' && deployment.latest_stage?.status === 'success' && metadata?.commit_hash === sha && metadata?.branch === 'main' && metadata?.commit_dirty === false, 'STOP: canonical production does not match clean HEAD with successful deployment.');
    const deployments = await cf('/deployments?per_page=20');
    const rollback = deployments.find(item => item.environment === 'production' && item.latest_stage?.status === 'success' && item.id !== deployment.id);
    await record('cloudflare-production', { id: deployment.id, url: deployment.url, created: deployment.created_on, sha: metadata.commit_hash, dirty: metadata.commit_dirty, rollback: rollback?.id ?? null });

    const files = git('ls-tree', '-r', '--name-only', sha, '--', 'public').split('\n').filter(Boolean).map(file => file.slice('public/'.length));
    const hash = bytes => createHash('sha256').update(bytes).digest('hex');
    for (const file of files) {
        // Compare the committed bytes used by Linux CI, not Windows CRLF checkout.
        const local = hash(execFileSync('git', ['cat-file', 'blob', `${sha}:public/${file}`], { windowsHide: true, maxBuffer: 32 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] }));
        const response = await request(new URL(file, production));
        requireTrue(local === hash(Buffer.from(await response.arrayBuffer())), `STOP: production asset differs: ${file}`);
        await record('asset-sha256', { file, sha256: local, matches: true });
    }
    const browsers = await verifyBrowsers(production, join(directory, 'screenshots'));
    await record('browser-qa', { results: browsers });
    requireTrue(git('rev-parse', 'HEAD') === sha && workingStatus() === '', 'STOP: repository changed during verification.');
    const finalProject = await cf('');
    requireTrue(finalProject.canonical_deployment.id === deployment.id, 'STOP: production changed during verification.');
    await record('final-production-confirmed', { id: deployment.id });
    state.status = 'passed';
    const reportDir = 'context/deployment/releases';
    await mkdir(reportDir, { recursive: true });
    const report = join(reportDir, `${stamp}-${sha.slice(0, 7)}.md`);
    await writeFile(report, `# Production release verification\n\n- UTC: ${state.started}\n- Commit: \`${sha}\`; clean main, confirmed on origin.\n- CI: ${run.html_url} — success; locked install, typecheck, audit HIGH/CRITICAL, build-nolog, Pages limits, publication passed.\n- Production: ${production}\n- Deployment: \`${deployment.id}\`, ${deployment.created_on}, dirty=false.\n- Immutable URL: ${deployment.url}\n- Previous successful production / rollback candidate: \`${rollback?.id ?? 'none'}\` (rollback not executed).\n- Public assets: ${files.length} SHA-256 matches.\n- Browsers: ${browsers.map(item => `${item.browser} ${item.version}: PASS`).join('; ')}. Menu flights, scene clicks, reload; no runtime/console/resource errors. Screenshots require visual review.\n- Existing successful CI reused when available; no duplicate publication, commit, push, or automatic retry.\n- Detailed steps: \`${logFile}\` (ignored, no credentials).\n- Screenshots: \`${join(directory, 'screenshots')}\`.\n`);
    state.report = report;
    await record('report-written', { report });
    console.log(`PASS ${production}\nSHA ${sha}\nCI ${run.html_url}\nDeployment ${deployment.id}\nReport ${report}\nMenu screenshot ${join(directory, 'screenshots', 'chrome-upward.png')}\nLog ${logFile}`);
} catch (error) {
    state.status = 'failed';
    // Avoid printing external exception objects or credential-helper stdout/stderr.
    const message = error instanceof Error && !('stdout' in error) ? error.message : 'Command failed; inspect permissions/credentials without printing secret output.';
    await record('stopped', { message });
    console.error(`${message}\nLog ${logFile}`);
    process.exitCode = 1;
}
