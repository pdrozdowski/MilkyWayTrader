import { spawn } from 'node:child_process';
import { mkdir, writeFile, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function verifyBrowsers(url, output) {
    await mkdir(output, { recursive: true });
    const results = [];
    for (const [name, executable] of [
        ['chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe'],
        ['edge', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']
    ]) {
        const profile = await mkdtemp(join(tmpdir(), 'mwt-prod-qa-'));
        const child = spawn(executable, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--enable-unsafe-swiftshader', '--remote-debugging-port=0', '--window-size=1100,900', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
        let ws;
        try {
            const endpoint = await new Promise((resolve, reject) => {
                let stderr = '';
                const timer = setTimeout(() => reject(new Error(`${name}: startup timeout`)), 20000);
                child.on('error', () => { clearTimeout(timer); reject(new Error(`${name}: could not start installed browser`)); });
                child.stderr.on('data', chunk => {
                    stderr += chunk.toString();
                    const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
                    if (match) { clearTimeout(timer); resolve(match[1]); }
                });
            });
            ws = new WebSocket(endpoint);
            await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = () => reject(new Error(`${name}: debug connection failed`)); });
            let id = 0;
            let session;
            const pending = new Map();
            const errors = [];
            const failures = [];
            const requests = new Map();
            ws.onmessage = ({ data }) => {
                const message = JSON.parse(data);
                if (message.id) {
                    const promise = pending.get(message.id);
                    if (!promise) return;
                    pending.delete(message.id);
                    clearTimeout(promise.timer);
                    message.error ? promise.reject(new Error(`${name}: ${message.error.message}`)) : promise.resolve(message.result);
                } else if (message.sessionId === session) {
                    const params = message.params;
                    if (message.method === 'Runtime.exceptionThrown') errors.push(params.exceptionDetails.text);
                    if (message.method === 'Runtime.consoleAPICalled' && params.type === 'error') errors.push(params.args.map(arg => arg.value ?? arg.description).join(' '));
                    if (message.method === 'Network.requestWillBeSent') requests.set(params.requestId, params.request.url);
                    if (message.method === 'Network.responseReceived' && params.response.status >= 400) failures.push(`${params.response.status}: ${params.response.url}`);
                    if (message.method === 'Network.loadingFailed' && !params.canceled) failures.push(`${requests.get(params.requestId)}: ${params.errorText}`);
                }
            };
            const send = (method, params = {}, sessionId = session) => new Promise((resolve, reject) => {
                const key = ++id;
                const timer = setTimeout(() => { pending.delete(key); reject(new Error(`${name}: ${method} timeout`)); }, 15000);
                pending.set(key, { resolve, reject, timer });
                ws.send(JSON.stringify({ id: key, method, params, ...(sessionId ? { sessionId } : {}) }));
            });
            const targets = await send('Target.getTargets');
            const target = targets.targetInfos.find(target => target.type === 'page');
            session = (await send('Target.attachToTarget', { targetId: target.targetId, flatten: true })).sessionId;
            const version = await send('Browser.getVersion', {}, null);
            await send('Runtime.enable');
            await send('Network.enable');
            await send('Page.enable');
            await send('Page.navigate', { url });
            // Read only DOM-visible state; scene visuals are captured for review.
            let canvas;
            for (let i = 0; i < 40; i++) {
                await wait(250);
                const evaluation = await send('Runtime.evaluate', { expression: `(() => { const c = document.querySelector('canvas'); if (!c) return null; const r = c.getBoundingClientRect(); return { count: document.querySelectorAll('canvas').length, x: r.x + r.width / 2, y: r.y + r.height / 2, width: r.width }; })()`, returnByValue: true });
                canvas = evaluation.result.value;
                if (canvas?.width > 0) break;
            }
            if (!canvas || canvas.count !== 1 || canvas.width <= 0) throw new Error(`${name}: expected one visible canvas`);
            const shot = async label => {
                const screenshot = await send('Page.captureScreenshot');
                await writeFile(join(output, `${name}-${label}.png`), Buffer.from(screenshot.data, 'base64'));
            };
            await wait(3000);
            await shot('upward');
            await wait(8500);
            await shot('downward');
            const click = async () => {
                const position = { x: canvas.x, y: canvas.y, button: 'left', clickCount: 1 };
                await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...position });
                await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...position });
                await wait(350);
            };
            for (const label of ['game', 'game-over', 'returned-menu']) { await click(); await shot(label); }
            await send('Page.reload');
            await wait(2000);
            await shot('reloaded-menu');
            const result = { browser: name, version: version.product, status: errors.length || failures.length ? 'failed' : 'passed', errors, failures };
            results.push(result);
            await writeFile(join(output, 'results.json'), JSON.stringify(results, null, 2));
            if (result.status !== 'passed') throw new Error(`${name}: browser/resource errors; inspect ${join(output, 'results.json')}`);
        } finally {
            ws?.close();
            child.kill();
        }
    }
    return results;
}
