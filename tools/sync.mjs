#!/usr/bin/env node
// Keeps the portfolio's prototypes in step with the apps' working folders.
// Copies anything that changed, then re-captures that app's card thumbnail.
//   node tools/sync.mjs              sync now (prints what it did)
//   node tools/sync.mjs --background return at once, sync in a detached process (used by the Claude Code hook)
//   node tools/sync.mjs --thumbs     force every thumbnail to be re-captured
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const DOCS = path.join(os.homedir(), 'Documents');
const TOOLS = path.join(ROOT, 'tools');
const LOG = path.join(TOOLS, 'sync.log');
const LOCK = path.join(TOOLS, '.sync.lock');
const STATE = path.join(TOOLS, '.sync-state.json');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// Source paths are relative to ~/Documents, destinations to the portfolio root.
const APPS = [
  { key: 'calendar', copy: [['calendar-prototype/index.html', 'prototypes/calendar/index.html']],
    page: 'prototypes/calendar/index.html', prep: "localStorage.setItem('calproto.hint','1')" },
  { key: 'workplace', copy: [['workplace-dashboard/index.html', 'prototypes/workplace/index.html']],
    page: 'prototypes/workplace/index.html' },
  { key: 'teaminbox', copy: [
      ['portfolio/public/prototypes/teaminbox-screens', 'prototypes/teaminbox'],
      ['portfolio/public/prototypes/teaminbox', 'prototypes/teaminbox-views'],
      ['portfolio/public/prototypes/teaminbox-upload', 'prototypes/teaminbox-uploads']],
    image: 'prototypes/teaminbox/s/vertical-1.webp' },
  { key: 'ulaa', copy: [], // built directly inside the portfolio
    watch: ['prototypes/ulaa-browser'], page: 'prototypes/ulaa-browser/index.html' },
  { key: 'om', build: { dir: 'om-builder', cmd: ['python3', 'build.py'], inputs: ['app.js', 'styles.css', 'index.html', 'assets', 'build.py'], output: 'om-builder.html' },
    copy: [['om-builder/om-builder.html', 'prototypes/om/index.html']], page: 'prototypes/om/index.html' },
  { key: 'wakemethere', copy: [['WakeMeThere/prototype', 'prototypes/wakemethere']] }, // card uses the app's own screenshots, no captured thumb
  { key: 'forge', copy: [['ForgeTrainer/prototype', 'prototypes/forge']] }, // screenshots come from the app's UI test (testPortfolioShots)
  { key: 'farm', copy: [['farm-manager/prototype', 'prototypes/farm']] }, // screenshots captured from the running Expo web build
  { key: 'dryhouse', build: { dir: 'solar-dry-house', cmd: ['node', 'tools/build-prototype.mjs'], inputs: ['index.html', 'styles.css', 'app.js', 'materials.js', 'weather.js', 'location.js', 'images', 'icons', 'prototype-src'], output: 'prototype/web/index.html' },
    copy: [['solar-dry-house/prototype', 'prototypes/dryhouse']] }, // web and mobile builds; screenshots from build-prototype.mjs --shots
  { key: 'zuis', copy: [['zuis-v2/prototype.html', 'prototypes/zuis/index.html']],
    page: 'prototypes/zuis/index.html', seed: 'zuis-v2/dist-export/zuis-guidelines.html' },
];

const args = new Set(process.argv.slice(2));
const log = (...m) => { const line = `[${new Date().toLocaleString()}] ${m.join(' ')}`; console.log(line); fs.appendFileSync(LOG, line + '\n'); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (args.has('--background')) {
  const out = fs.openSync(LOG, 'a');
  spawn(process.execPath, [import.meta.filename, ...[...args].filter((a) => a !== '--background')], { detached: true, stdio: ['ignore', out, out] }).unref();
  process.exit(0);
}

// One sync at a time; a stale lock from a crashed run is ignored after 10 minutes.
try {
  const st = fs.statSync(LOCK);
  if (Date.now() - st.mtimeMs < 600_000) process.exit(0);
} catch {}
fs.writeFileSync(LOCK, String(process.pid));
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch {} });

const walk = (p) => { // newest mtime under a file or folder
  const st = fs.statSync(p, { throwIfNoEntry: false });
  if (!st) return 0;
  if (!st.isDirectory()) return st.mtimeMs;
  return fs.readdirSync(p).reduce((m, n) => (n.startsWith('.') ? m : Math.max(m, walk(path.join(p, n)))), st.mtimeMs);
};

function copyChanged(src, dst) { // returns number of files copied
  const st = fs.statSync(src, { throwIfNoEntry: false });
  if (!st) { log(`missing source ${src}`); return 0; }
  if (st.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    return fs.readdirSync(src).filter((n) => !n.startsWith('.')).reduce((c, n) => c + copyChanged(path.join(src, n), path.join(dst, n)), 0);
  }
  const d = fs.statSync(dst, { throwIfNoEntry: false });
  if (d && d.size === st.size && d.mtimeMs >= st.mtimeMs) return 0;
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  fs.utimesSync(dst, st.atime, st.mtime);
  return 1;
}

const state = (() => { try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return {}; } })();
const stale = [];

for (const app of APPS) {
  if (app.build) {
    const dir = path.join(DOCS, app.build.dir);
    const newest = Math.max(...app.build.inputs.map((i) => walk(path.join(dir, i))));
    if (newest > walk(path.join(dir, app.build.output))) {
      try { execFileSync(app.build.cmd[0], app.build.cmd.slice(1), { cwd: dir, stdio: 'pipe' }); log(`${app.key}: rebuilt ${app.build.output}`); }
      catch (e) { log(`${app.key}: build failed — ${String(e.stderr || e.message).trim().split('\n').pop()}`); }
    }
  }
  const copied = app.copy.reduce((c, [s, d]) => c + copyChanged(path.join(DOCS, s), path.join(ROOT, d)), 0);
  if (copied) log(`${app.key}: copied ${copied} file(s)`);
  const dests = [...app.copy.map(([, d]) => d), ...(app.watch || [])];
  const newest = Math.max(...dests.map((d) => walk(path.join(ROOT, d))));
  if (args.has('--thumbs') || !state[app.key] || newest > state[app.key]) stale.push([app, newest]);
}

if (stale.length) {
  log(`refreshing thumbnails: ${stale.map(([a]) => a.key).join(', ')}`);
  await captureThumbs(stale.map(([a]) => a));
  for (const [app, newest] of stale) state[app.key] = newest;
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
} else if (!args.has('--background')) {
  log('everything already up to date');
}

async function captureThumbs(apps) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-thumbs-'));
  const toJpg = (src, key) => execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', '--resampleWidth', '760', src, '--out', path.join(ROOT, 'assets/thumbs', `${key}.jpg`)], { stdio: 'pipe' });
  for (const a of apps.filter((a) => a.image)) toJpg(path.join(ROOT, a.image), a.key);
  const pages = apps.filter((a) => a.page);
  if (!pages.length || !fs.existsSync(CHROME)) return;

  const port = 5300 + Math.floor(Math.random() * 400), dbg = port + 1000;
  const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', ROOT], { stdio: 'ignore' });
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${dbg}`, `--user-data-dir=${tmp}/profile`, 'about:blank'], { stdio: 'ignore' });
  try {
    let ws;
    for (let i = 0; i < 60 && !ws; i++) {
      try { const p = (await (await fetch(`http://127.0.0.1:${dbg}/json`)).json()).find((t) => t.type === 'page'); if (p) ws = new WebSocket(p.webSocketDebuggerUrl); } catch {}
      if (!ws) await sleep(250);
    }
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    let id = 0; const pending = {};
    ws.onmessage = (e) => { const m = JSON.parse(e.data); if (pending[m.id]) { pending[m.id](m); delete pending[m.id]; } };
    const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
    const evaluate = (expression) => send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

    for (const a of pages) {
      try {
        await send('Page.navigate', { url: `http://127.0.0.1:${port}/${a.page}` }); await sleep(3000);
        if (a.prep) { await evaluate(a.prep); await send('Page.reload'); await sleep(3000); }
        if (a.seed) await seedZuis(a, tmp, evaluate);
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        const png = path.join(tmp, `${a.key}.png`);
        fs.writeFileSync(png, Buffer.from(shot.result.data, 'base64'));
        toJpg(png, a.key);
        log(`${a.key}: thumbnail updated`);
      } catch (e) { log(`${a.key}: thumbnail failed — ${e.message}`); }
    }
    ws.close();
  } finally {
    // Chrome keeps writing its profile for a moment after it is told to quit.
    const exited = new Promise((r) => chrome.once('exit', r));
    chrome.kill(); server.kill();
    await Promise.race([exited, sleep(5000)]);
    try { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {}
  }
}

// ZUIS opens to an empty library, so load the guidelines deck into it before the screenshot.
async function seedZuis(a, tmp, evaluate) {
  const pdf = path.join(tmp, 'seed.pdf');
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--user-data-dir=${tmp}/pdf-profile`, '--virtual-time-budget=5000', `--print-to-pdf=${pdf}`, 'file://' + path.join(DOCS, a.seed)], { stdio: 'pipe' });
  const b64 = fs.readFileSync(pdf).toString('base64');
  await evaluate(`(async()=>{const b=Uint8Array.from(atob('${b64}'),c=>c.charCodeAt(0));
    const f=new File([b],'Design Unification.pdf',{type:'application/pdf'});
    S.upload=S.upload??{collection:null};stageFiles([f]);await new Promise(r=>setTimeout(r,1200));
    [...document.querySelectorAll('.modal button,[role=dialog] button')].find(x=>x.textContent.trim()==='Add')?.click();
    await new Promise(r=>setTimeout(r,10000));})()`);
}
