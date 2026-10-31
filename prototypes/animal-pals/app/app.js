import { BEINGS, CATEGORIES, KINGDOM, GLB_MODELS } from './data.js';
import { VIDEOS } from './videos.js';
import { TA } from './data-ta.js';
import { CALLS } from './calls.js';
import { STR, TA_LABELS } from './i18n.js';

const INAT = 'https://api.inaturalist.org/v1';
const app = document.getElementById('app');
const byKey = Object.fromEntries(BEINGS.map(b => [b.key, b]));
const byId = Object.fromEntries(BEINGS.map(b => [b.id, b]));
const catByKey = Object.fromEntries(CATEGORIES.map(c => [c.key, c]));
// Home filters: the library species in each group first, then every other species iNaturalist knows.
const GROUPS = [
  { key: 'all', label: 'All animals', taxa: [1] },
  { key: 'mammals', label: 'Mammals', taxa: [40151] },
  { key: 'birds', label: 'Birds', taxa: [3] },
  { key: 'reptiles', label: 'Reptiles', taxa: [26036] },
  { key: 'amphibians', label: 'Frogs & amphibians', taxa: [20978] },
  { key: 'sea', label: 'Fish & sea life', taxa: [47178, 47273, 47534, 152871, 372234, 47459, 47549, 372843, 46306] },
  { key: 'insects', label: 'Insects', taxa: [47158] },
  { key: 'crawlies', label: 'Spiders, snails & more', taxa: [47119, 47115, 144128, 85493], without: [47459] },
];
const groupByKey = Object.fromEntries(GROUPS.map(g => [g.key, g]));
// Interface text in the current language (English or Tamil); {placeholders} are filled from vars.
const tr = (k, vars = {}) => (STR[lang]?.[k] ?? STR.en[k] ?? k).replace(/\{(\w+)\}/g, (_, v) => vars[v] ?? '');
const isTa = () => lang === 'ta';
const groupLabel = g => (isTa() && TA_LABELS.groups[g.key]) || g.label;
const catLabel = k => (isTa() && TA_LABELS.cats[k]) || catByKey[k].label;
const kingdomLabel = k => (isTa() && TA_LABELS.kingdom[k.id]) || k.label;
const kindLabel = iconic => (isTa() && TA_LABELS.kinds[iconic]) || GROUP[iconic] || (isTa() ? TA_LABELS.living : 'Living being');
// A library species' name in the current language.
const nm = b => (isTa() && TA[b.key]?.n) || b.name;

// ---------------------------------------------------------------- utils
const $ = (sel, el = document) => el.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cap = s => s ? s.replace(/\b\w/g, c => c.toUpperCase()) : '';
const icon = (n, cls = 'ico') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
function toast(msg) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
}

const memo = new Map();
async function api(path) {
  if (memo.has(path)) return memo.get(path);
  const p = fetch(INAT + path).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
  memo.set(path, p);
  p.catch(() => memo.delete(path));
  return p;
}
const bigPhoto = url => url?.replace(/\/(square|small|medium|thumb)\./, '/large.');
const smallPhoto = url => url?.replace(/\/(large|medium|original)\./, '/small.');

// ---------------------------------------------------------------- photos for curated beings
let photos = store.get('ap.photos.v3', null);
async function loadCuratedPhotos() {
  if (photos && Date.now() - photos.t < 864e5) return photos.map;
  const ids = BEINGS.map(b => b.id), map = {};
  for (let i = 0; i < ids.length; i += 30) {
    const r = await api(`/taxa/${ids.slice(i, i + 30).join(',')}`);
    for (const t of r.results) if (t.default_photo) map[t.id] = { url: t.default_photo.medium_url, by: t.default_photo.attribution, sci: t.name, anc: t.ancestor_ids, iconic: t.iconic_taxon_name };
  }
  photos = { t: Date.now(), map }; store.set('ap.photos.v3', photos);
  return map;
}
const photoOf = b => photos?.map?.[b?.id]?.url;
const inGroup = (b, g) => g.key === 'all' || g.taxa.some(id => photos?.map?.[b.id]?.anc?.includes(id));

// ---------------------------------------------------------------- video (real footage from Wikimedia Commons)
const COMMONS = 'https://commons.wikimedia.org/w/api.php?';
// Keep clips kid-appropriate: skip predation, injury and mating footage.
const BAD_VIDEO = /dead|death|kill|hunt|prey|eat(ing|s)? (a|an|the)|feeding on|carcass|corpse|slaughter|butcher|blood|injur|wound|attack|fight|mating|copulat|sex|necrop|dissect|roadkill|skeleton|skull/i;
const probe = document.createElement('video');
const videoMemo = new Map();
const canWebm = probe.canPlayType('video/webm; codecs="vp9"') !== '';
function pinned(key) {
  const p = VIDEOS[key];
  if (!p) return null;
  const s = canWebm ? p.webmS : p.mov, l = canWebm ? p.webmL : p.mov;
  return s || l ? { small: s || l, large: l || s, page: p.page, title: p.title.replace(/\.\w+$/, '') } : null;
}
// Commons rate-limits bursts, so live lookups run one at a time and results are cached for a week.
let queue = Promise.resolve();
const throttled = fn => (queue = queue.then(fn, fn).then(r => new Promise(ok => setTimeout(() => ok(r), 700))));
const vcache = store.get('ap.vcache.v1', {});
// Library species only ever use their reviewed clip; everything else is looked up live.
function getVideo(sci, common, beingKey) {
  if (beingKey) return Promise.resolve(pinned(beingKey));
  const key = sci || common;
  if (!key) return Promise.resolve(null);
  const hit = vcache[key];
  if (hit && Date.now() - hit.t < 7 * 864e5) return Promise.resolve(hit.v);
  if (!videoMemo.has(key)) videoMemo.set(key, throttled(() => findVideo(sci, common)).then(v => {
    if (v === undefined) { videoMemo.delete(key); return null; }
    vcache[key] = { t: Date.now(), v }; store.set('ap.vcache.v1', vcache);
    return v;
  }));
  return videoMemo.get(key);
}
async function findVideo(sci, common) {
  {
    for (const term of [sci && `"${sci}"`, common && `intitle:"${common}"`].filter(Boolean)) {
      const r = await fetch(COMMONS + new URLSearchParams({
        action: 'query', generator: 'search', gsrsearch: `filetype:video ${term}`, gsrnamespace: 6, gsrlimit: 12,
        prop: 'videoinfo', viprop: 'url|size|mime|derivatives', viurlwidth: 960, format: 'json', origin: '*',
      })).then(r => r.json()).catch(() => undefined);
      if (r === undefined) return undefined; // rate-limited or offline: don't cache
      // Prefer sharp, well-titled, short clips over whatever the search ranks first.
      const want = [sci, common].filter(Boolean).map(x => x.toLowerCase());
      const score = p => {
        const v = p.videoinfo?.[0] || {}, t = p.title.toLowerCase();
        return (want.some(w => t.includes(w)) ? 3 : 0) + (v.width >= 1280 ? 3 : v.width >= 854 ? 2 : v.width >= 640 ? 1 : -2)
          + (v.duration >= 8 && v.duration <= 90 ? 1 : 0) - p.index / 20;
      };
      const pages = Object.values(r?.query?.pages || {}).sort((a, b) => score(b) - score(a));
      for (const p of pages) {
        const v = p.videoinfo?.[0];
        if (!v || BAD_VIDEO.test(p.title) || !(v.duration >= 4 && v.duration <= 240) || v.width < 480) continue;
        const ds = (v.derivatives || []).filter(d => d.src && probe.canPlayType(d.type) !== '');
        if (!ds.length) continue;
        const pick = keys => keys.map(k => ds.find(d => d.transcodekey === k)).find(Boolean) || ds[0];
        return {
          small: pick(['240p.vp9.webm', '360p.mpeg4.mov', '360p.vp9.webm', '480p.vp9.webm']).src,
          large: pick(['720p.vp9.webm', '480p.vp9.webm', '360p.mpeg4.mov', '1080p.vp9.webm']).src,
          poster: v.thumburl, page: v.descriptionurl,
          title: p.title.replace(/^File:/, '').replace(/\.\w+$/, '').replace(/_/g, ' '),
        };
      }
    }
    return null;
  }
}
function videoEl(src, { poster, muted = true, cls = '', autoplay = true } = {}) {
  const v = document.createElement('video');
  Object.assign(v, { src, muted, loop: true, autoplay, playsInline: true, preload: autoplay ? 'auto' : 'metadata' });
  v.setAttribute('playsinline', ''); v.setAttribute('muted', ''); v.disablePictureInPicture = true;
  if (poster) v.poster = poster;
  if (cls) v.className = cls;
  v.addEventListener('playing', () => v.classList.add('on'), { once: true });
  if (autoplay) v.addEventListener('canplay', () => { if (v.paused) v.play().catch(() => {}); }, { once: true });
  return v;
}

// Cards preview a muted clip only while hovered (or pressed and held on touch screens).
// No clip for a species? The photo simply stays.
let previewBox = null, holdTimer, suppressClick = false;
function startPreview(box) {
  if (previewBox === box) return;
  stopPreview();
  previewBox = box;
  getVideo(box.dataset.sci, null, box.dataset.being).then(vid => {
    if (!vid || previewBox !== box || box.querySelector('video')) return;
    box.prepend(videoEl(vid.small, { cls: 'card-video' }));
  });
}
function stopPreview() {
  previewBox?.querySelector('video')?.remove();
  previewBox = null;
}
const previewTarget = e => e.target.closest?.('.card-img[data-sci], .card-img[data-being]');
app.addEventListener('pointerover', e => {
  if (e.pointerType !== 'mouse') return;
  const box = previewTarget(e); if (box) startPreview(box);
});
app.addEventListener('pointerout', e => {
  if (e.pointerType !== 'mouse' || !previewBox) return;
  if (!previewBox.contains(e.relatedTarget)) stopPreview();
});
app.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' || e.target.closest('button')) return;
  const box = previewTarget(e); if (!box) return;
  suppressClick = false;
  holdTimer = setTimeout(() => { suppressClick = true; startPreview(box); }, 350);
});
const endHold = () => { clearTimeout(holdTimer); if (suppressClick) stopPreview(); };
['pointerup', 'pointercancel'].forEach(t => app.addEventListener(t, e => { if (e.pointerType !== 'mouse') endHold(); }));
// A long press previews the clip; it shouldn't also open the page.
app.addEventListener('click', e => { if (suppressClick && previewTarget(e)) { e.preventDefault(); e.stopPropagation(); suppressClick = false; } }, true);

// ---------------------------------------------------------------- sound
const audio = new Audio();
audio.preload = 'auto';
let stopTimer, playingBtn;
const canPlay = url => {
  const ext = (url.split('?')[0].split('.').pop() || '').toLowerCase();
  const type = { mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', flac: 'audio/flac', aac: 'audio/aac' }[ext];
  return !type || audio.canPlayType(type) !== '';
};
async function getSounds(taxonId) {
  const key = `/observations?taxon_id=${taxonId}&sounds=true&order_by=votes&per_page=15`;
  let r = await api(key + '&quality_grade=research');
  if (!r.results.length) r = await api(key);
  return r.results.flatMap(o => (o.sounds || []).filter(s => s.file_url && canPlay(s.file_url)).map(s => ({
    url: s.file_url, by: s.attribution || o.user?.login, obs: o.id, place: o.place_guess,
  })));
}
// Sound files on Wikimedia Commons for a species (many are clean xeno-canto bird recordings).
async function getCommonsSounds(sci) {
  if (!sci) return [];
  const r = await fetch('https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
    action: 'query', generator: 'search', gsrsearch: `filetype:audio "${sci}"`, gsrnamespace: 6, gsrlimit: 6,
    prop: 'videoinfo', viprop: 'url|size|derivatives', format: 'json', origin: '*',
  })).then(r => r.json()).catch(() => null);
  return Object.values(r?.query?.pages || {}).flatMap(p => {
    const v = p.videoinfo?.[0];
    if (!v || v.size > 15e6 || !(v.duration > 1 && v.duration < 240) || BAD_SOUND.test(p.title)) return [];
    const url = /\.(mp3|wav|m4a)$/i.test(v.url) ? v.url : (v.derivatives || []).find(d => /mp3/.test(d.transcodekey || d.type))?.src;
    return url ? [{ url, by: 'Wikimedia Commons', page: v.descriptionurl, src: 'commons' }] : [];
  });
}
const BAD_SOUND = /train|traffic|car |engine|music|song by|speech|interview|lecture|church|bell|crowd|market|street/i;
// Several candidate recordings are decoded and measured; the clearest plays first.
const ranked = new Map();
const rankCache = store.get('ap.rank.v1', {});
function rankedSounds(taxonId) {
  if (ranked.has(taxonId)) return ranked.get(taxonId);
  const p = (async () => {
    const [inat, sci] = await Promise.all([getSounds(taxonId), api(`/taxa/${taxonId}`).then(r => r.results[0]?.name).catch(() => null)]);
    const commons = await getCommonsSounds(sci).catch(() => []);
    const all = [...inat, ...commons];
    const order = rankCache[taxonId];
    if (order) return [...order.map(u => all.find(s => s.url === u)).filter(Boolean), ...all.filter(s => !order.includes(s.url))];
    const pool = [...inat.slice(0, 5), ...commons.slice(0, 3)];
    const timeout = ms => new Promise((_, no) => setTimeout(() => no(new Error('slow')), ms));
    const scores = await Promise.all(pool.map(s => Promise.race([loadBoosted(s.url), timeout(9000)]).then(m => m.clarity, () => -99)));
    const best = pool.map((s, i) => ({ s, c: scores[i] })).filter(x => x.c > -99).sort((a, b) => b.c - a.c).map(x => x.s);
    const rest = all.filter(s => !best.includes(s));
    if (best.length) { rankCache[taxonId] = best.map(s => s.url); store.set('ap.rank.v1', rankCache); }
    return [...best, ...rest];
  })();
  ranked.set(taxonId, p); p.catch(() => ranked.delete(taxonId));
  return p;
}
function setPlaying(btn, on) {
  if (!btn) return;
  btn.classList.toggle('playing', on);
  btn.closest('[data-wave]')?.classList.toggle('playing-wrap', on);
  const use = btn.querySelector('use'); if (use) use.setAttribute('href', on ? '#i-pause' : '#i-play');
  const lbl = btn.querySelector('.lbl'); if (lbl) lbl.textContent = on ? tr('card_stop') : tr('card_hear');
  btn.setAttribute('aria-pressed', on);
}
// On iPhones, play through the silent switch like a media app would.
try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}

// Field recordings vary hugely in loudness. They are fetched through the app's relay (iNaturalist
// sends no CORS headers), measured, boosted to a steady level with a limiter, and started where the
// animal is actually audible. If any of that fails, the plain <audio> element plays the file as is.
const SOUND_RELAY = 'https://animal-pals-ivory.vercel.app/api/sound?u=';
const bufCache = new Map();
let boosted = null; // { src, gain } while a boosted recording plays
async function loadBoosted(url) {
  if (bufCache.has(url)) return bufCache.get(url);
  const p = (async () => {
    const direct = /^https:\/\/upload\.wikimedia\.org\//.test(url);
    const r = await fetch(direct ? url : SOUND_RELAY + encodeURIComponent(url));
    if (!r.ok) throw new Error(r.status);
    const buf = await ac().decodeAudioData(await r.arrayBuffer());
    // Measure the first 30 s: overall loudness (RMS) and where the sound first rises above the background.
    const ch = buf.getChannelData(0), n = Math.min(ch.length, buf.sampleRate * 30);
    let peak = 0, sum = 0;
    for (let i = 0; i < n; i++) { const v = Math.abs(ch[i]); if (v > peak) peak = v; sum += v * v; }
    const rms = Math.sqrt(sum / Math.max(1, n)) || 1e-4;
    const win = Math.floor(buf.sampleRate * .05), floor = Math.max(rms * 1.6, peak * .12);
    let start = 0;
    for (let i = 0; i + win < n; i += win) {
      let e = 0; for (let j = i; j < i + win; j++) e += ch[j] * ch[j];
      if (Math.sqrt(e / win) > floor) { start = Math.max(0, i / buf.sampleRate - .15); break; }
    }
    // Clarity: how far the loud moments (the call) stand above the quiet ones (background), in dB.
    const frames = [];
    for (let i = 0; i + win < n; i += win) { let e = 0; for (let j = i; j < i + win; j += 4) e += ch[j] * ch[j]; frames.push(Math.sqrt(e / (win / 4))); }
    frames.sort((a, b) => a - b);
    const q = p => frames[Math.min(frames.length - 1, Math.floor(frames.length * p))] || 1e-5;
    const clarity = 20 * Math.log10(q(.95) / Math.max(q(.2), 1e-5)) - (peak < .02 ? 10 : 0);
    // Aim for a strong, even level; the limiter catches peaks the boost pushes too high.
    const gain = Math.min(14, Math.max(1, .3 / rms), 1.4 / Math.max(peak, 1e-3) * 2.5);
    return { buf, gain, clarity, start: Math.min(start, Math.max(0, buf.duration - 3)) };
  })();
  bufCache.set(url, p);
  p.catch(() => bufCache.delete(url));
  if (bufCache.size > 24) bufCache.delete(bufCache.keys().next().value);
  return p;
}
// Every play or stop bumps soundGen; async work (loading, timers, fallbacks) checks it before acting,
// so a sound that finishes loading after the child tapped something else never takes over.
let soundGen = 0;
function stopSound() {
  soundGen++;
  audio.pause(); clearTimeout(stopTimer); audio.volume = 1;
  if (boosted) { try { boosted.src.onended = null; boosted.src.stop(); } catch {} boosted = null; }
  setPlaying(playingBtn, false); playingBtn = null;
}
const isPlaying = () => !!boosted || !audio.paused;
function muteVideos() {
  document.querySelectorAll('video').forEach(v => { v.muted = true; });
  document.querySelectorAll('.mute.on').forEach(m => { m.classList.remove('on'); m.querySelector('span').textContent = tr('unmute'); });
}
// Field recordings can run for minutes; play a short clip and fade it out.
async function playUrl(url, btn, maxSec = 14, { direct = false } = {}) {
  stopSound(); window.speechSynthesis?.cancel(); muteVideos();
  const my = soundGen;
  playingBtn = btn; setPlaying(btn, true);
  const c = ac(); c.resume?.(); // inside the tap, so phones allow sound
  try {
    if (direct) throw new Error('direct'); // bundled calls are already trimmed and levelled
    const { buf, gain, start } = await loadBoosted(url);
    if (my !== soundGen) return; // tapped something else while loading
    const src = c.createBufferSource(); src.buffer = buf;
    const g = c.createGain(), lim = c.createDynamicsCompressor();
    lim.threshold.value = -10; lim.knee.value = 6; lim.ratio.value = 12; lim.attack.value = .003; lim.release.value = .2;
    const t = c.currentTime, len = Math.min(maxSec, buf.duration - start);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .05);
    g.gain.setValueAtTime(gain, t + Math.max(.1, len - .8)); g.gain.linearRampToValueAtTime(0, t + len);
    src.connect(g).connect(lim).connect(c.destination);
    src.start(t, start, len);
    boosted = { src, gain: g };
    src.onended = () => { if (boosted?.src === src) { boosted = null; setPlaying(playingBtn, false); playingBtn = null; } };
  } catch {
    if (my !== soundGen) return;
    audio.src = url; audio.currentTime = 0;
    stopTimer = setTimeout(() => {
      const fade = setInterval(() => { if (my !== soundGen) return clearInterval(fade); audio.volume = Math.max(0, audio.volume - .1); if (audio.volume <= 0) { clearInterval(fade); stopSound(); } }, 80);
    }, maxSec * 1000);
    // A file that won't play must not leave the button stuck on "Stop".
    return audio.play().catch(e => { if (my === soundGen) stopSound(); throw e; });
  }
}
audio.addEventListener('ended', stopSound);
const soundIdx = {};
// Library species start with their bundled call: a clear, checked recording (tools/pick-calls.mjs).
const callOfId = id => { const b = byId[id]; return b && CALLS[b.key] ? { key: b.key, ...CALLS[b.key] } : null; };
function playCall(call, btn, noteEl) {
  if (noteEl) noteEl.innerHTML = `${tr('clear_call')} · ${esc(call.by)} (${esc(call.license)}) · <a href="${esc(call.page)}" target="_blank" rel="noopener">${tr('source')}</a>. ${tr('clear_call_more')}`;
  return playUrl(`audio/calls/${call.key}.m4a`, btn, 10, { direct: true });
}
async function playBeing(taxonId, btn, noteEl, fallbackSay, { callOnly = false, tries = 0 } = {}) {
  // Tapping the same button again stops it, even while its recording is still loading.
  if (btn && playingBtn === btn) { stopSound(); return; }
  ac().resume?.(); // unlock audio during the tap, before any waiting
  const call = callOfId(taxonId);
  // First tap: the clear call. Later taps step through wild recordings, then back to the call.
  if (call && (callOnly || soundIdx[taxonId] === undefined)) {
    if (!callOnly) soundIdx[taxonId] = -1;
    return playCall(call, btn, noteEl).catch(() => {});
  }
  stopSound(); window.speechSynthesis?.cancel();
  const my = soundGen;
  playingBtn = btn; setPlaying(btn, true);
  if (noteEl && !ranked.has(taxonId) && !rankCache[taxonId]) noteEl.textContent = tr('finding_sound');
  try {
    const list = await rankedSounds(taxonId);
    if (my !== soundGen) return;
    if (!list.length) {
      stopSound();
      if (fallbackSay) speak(fallbackSay);
      if (noteEl) noteEl.textContent = tr('no_rec_note');
      else toast(tr('no_rec_toast'));
      return;
    }
    const prev = soundIdx[taxonId] ?? -1;
    if (call && prev + 1 >= list.length) { soundIdx[taxonId] = undefined; return playBeing(taxonId, btn, noteEl, fallbackSay); } // loop back to the clear call
    const i = (soundIdx[taxonId] = (prev + 1) % list.length);
    const s = list[i];
    if (noteEl) noteEl.innerHTML = `${tr('wild_rec', { i: i + 1, n: list.length })}${s.place ? ` · ${esc(s.place)}` : ''} ${s.src === 'commons' ? '' : ` · ${esc(s.by)} ${tr('via')}`} ${s.src === 'commons' ? `<a href="${esc(s.page)}" target="_blank" rel="noopener">Wikimedia Commons</a>` : `<a href="https://www.inaturalist.org/observations/${s.obs}" target="_blank" rel="noopener">iNaturalist</a>`}`;
    const title = btn?.closest('[data-wave]')?.querySelector('.sound-title small');
    if (title) title.textContent = `${i + 1} / ${list.length}`;
    await playUrl(s.url, btn);
  } catch (e) {
    // Another sound started meanwhile, or the child left the page: leave things alone.
    if ((playingBtn && playingBtn !== btn) || (btn && !btn.isConnected)) return;
    stopSound();
    // Some recordings fail to decode in some browsers; try the next one (a few times at most).
    if (e?.name === 'NotSupportedError' && tries < 3) return playBeing(taxonId, btn, noteEl, fallbackSay, { tries: tries + 1 });
    if (fallbackSay) speak(fallbackSay);
  }
}
let warnedTamil = false;
function speak(text, { rate = .92, lang = 'en' } = {}) {
  if (!('speechSynthesis' in window)) return;
  stopSound();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = rate;
  const voices = speechSynthesis.getVoices();
  let v;
  if (lang === 'ta') {
    u.lang = 'ta-IN';
    v = voices.find(v => /^ta/i.test(v.lang));
    if (!v && voices.length && !warnedTamil) { warnedTamil = true; toast(tr('no_ta_voice')); }
  } else {
    v = voices.find(v => /en[-_](IN|GB|US)/i.test(v.lang) && /samantha|veena|google|natural/i.test(v.name)) || voices.find(v => v.lang.startsWith('en'));
  }
  if (v) u.voice = v;
  speak.last = u; // keep a reference: some browsers drop utterances that get garbage-collected mid-speech
  const busy = speechSynthesis.speaking || speechSynthesis.pending;
  speechSynthesis.cancel();
  if (busy) setTimeout(() => speechSynthesis.speak(u), 120); else speechSynthesis.speak(u);
}
const hasTamilVoice = () => speechSynthesis.getVoices?.().some(v => /^ta/i.test(v.lang));
// Explanations can be shown and read in English or Tamil (remembered per device).
let lang = store.get('ap.lang', 'en');
const setLang = l => { lang = l; store.set('ap.lang', l); syncLangBtn(); };
function syncLangBtn() {
  document.documentElement.lang = lang === 'ta' ? 'ta' : 'en';
  const btn = document.getElementById('langBtn'); if (!btn) return;
  btn.setAttribute('aria-checked', lang === 'ta');
  btn.setAttribute('aria-label', tr('lang_label'));
  // The fixed parts of the page (menus, search, voice and 3D panels) follow the language too.
  document.querySelectorAll('[data-t]').forEach(el => { el.textContent = tr(el.dataset.t); });
  document.querySelectorAll('[data-t-ph]').forEach(el => { el.placeholder = tr(el.dataset.tPh); });
  document.querySelectorAll('[data-t-label]').forEach(el => { el.setAttribute('aria-label', tr(el.dataset.tLabel)); });
}
const hasTamil = s => /[\u0B80-\u0BFF]/.test(s || '');
// Tamil names for a batch of species, from Wikidata (it links iNaturalist IDs to names in every
// language; iNaturalist itself has almost none in Tamil). Cached per device; species without a
// Tamil name keep their English one.
const taCache = store.get('ap.taNames.v1', {});
async function taNameMap(ids) {
  const want = ids.filter(id => !(id in taCache));
  if (want.length) {
    const q = `SELECT ?id ?label WHERE { VALUES ?id { ${want.map(id => `"${+id}"`).join(' ')} } ?item wdt:P3151 ?id . ?item rdfs:label ?label FILTER(lang(?label) = "ta") }`;
    try {
      const r = await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q)).then(r => r.json());
      want.forEach(id => { taCache[id] = null; });
      for (const x of r.results.bindings) taCache[x.id.value] = x.label.value;
      store.set('ap.taNames.v1', taCache);
    } catch {} // offline or busy: show English this time
  }
  return Object.fromEntries(ids.filter(id => taCache[id]).map(id => [id, taCache[id]]));
}
// Tamil name and summary for species outside the library: iNaturalist's Tamil name, Tamil Wikipedia's summary.
async function tamilFor(id, wikiUrl) {
  const out = {};
  try { const n = (await api(`/taxa/${id}?locale=ta`)).results[0]?.preferred_common_name; if (hasTamil(n)) out.n = n; } catch {}
  const title = wikiUrl && decodeURIComponent(wikiUrl.split('/wiki/')[1] || '');
  if (title) try {
    const ll = await fetch('https://en.wikipedia.org/w/api.php?' + new URLSearchParams({ action: 'query', prop: 'langlinks', lllang: 'ta', titles: title, redirects: 1, format: 'json', origin: '*' })).then(r => r.json());
    const ta = Object.values(ll.query?.pages || {})[0]?.langlinks?.[0]?.['*'];
    if (ta) {
      const sum = await fetch(`https://ta.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(ta.replace(/ /g, '_'))}`).then(r => r.json());
      if (sum.extract) { out.bio = firstSentences(sum.extract, 3); out.url = sum.content_urls?.desktop?.page; if (!out.n) out.n = ta; }
    }
  } catch {}
  return out;
}
const sayLine = b => b.quiet || b.says.startsWith('(') ? `${b.name}. ${b.fun}` : `${b.name}. The ${b.name.toLowerCase()} says ${b.says}`;
const callOf = b => b.says.startsWith('(') ? tr('quiet') : b.says;

// ---------------------------------------------------------------- saved
const faves = () => store.get('ap.faves', []);
const isFave = id => faves().some(f => f.id === id);
function toggleFave(item) {
  const list = faves(); const i = list.findIndex(f => f.id === item.id);
  if (i >= 0) list.splice(i, 1); else list.unshift(item);
  store.set('ap.faves', list); return i < 0;
}

// ---------------------------------------------------------------- cards
const imgTag = (url, alt, lazy = true) => url ? `<img src="${url}" alt="${esc(alt)}" ${lazy ? 'loading="lazy"' : ''} onload="this.classList.add('loaded')">` : '';
function beingCard(b) {
  return `<a class="card" href="#/b/${b.key}">
    <div class="card-img" data-being="${b.key}">
      ${imgTag(photoOf(b), b.name)}
      ${b.m3d ? `<span class="tag3d">${icon('cube')}3D</span>` : ''}
      ${cardBtns(b.id, nm(b), sayLine(b), false)}
    </div>
    <div class="card-meta"><div>${nameRow(nm(b), b.name, b.key)}<div class="card-sub">${esc(callOf(b))}</div></div></div>
  </a>`;
}
const SILENT = ['Plantae', 'Fungi', 'Chromista', 'Protozoa'];
// A blue speaker that says a name; it sits beside the name wherever one is shown.
const nameBtn = (name, key, cls = 'say-name') => `<button class="${cls}" data-name="${esc(name)}"${key ? ` data-key="${key}"` : ''}${TA[key] ? ` data-name-ta="${esc(TA[key].n)}"` : ''} aria-label="${esc(tr('say_name_of', { name: key && isTa() && TA[key] ? TA[key].n : name }))}">${icon('speak')}</button>`;
const hearBtn = (id, name, say) => `<button class="play-mini" data-play="${id}" data-say="${esc(say)}" aria-label="${esc(tr('hear_the', { name }))}">${icon('play')}<span class="lbl">${tr('card_hear')}</span></button>`;
const cardBtns = (id, name, say, silent) => silent ? '' : `<div class="card-btns">${hearBtn(id, name, say)}</div>`;
const nameRow = (label, nameForVoice, key) => `<div class="name-row"><h3 class="card-name">${esc(label)}</h3>${nameBtn(nameForVoice, key)}</div>`;
function taxonCard(t, taName) {
  if (byId[t.id]) return beingCard(byId[t.id]);
  const en = cap(t.preferred_common_name || t.name);
  const name = (isTa() && taName) || en;
  return `<a class="card" href="#/t/${t.id}">
    <div class="card-img" data-sci="${esc(t.name)}">${imgTag(t.default_photo?.medium_url, name)}${cardBtns(t.id, name, name, SILENT.includes(t.iconic_taxon_name))}</div>
    <div class="card-meta"><div>${nameRow(name, en, null).replace('data-name=', taName ? `data-name-ta="${esc(taName)}" data-name=` : 'data-name=')}<div class="card-sub">${esc(t.name)}</div></div></div>
  </a>`;
}
const GROUP = { Mammalia: 'Mammal', Aves: 'Bird', Reptilia: 'Reptile', Amphibia: 'Amphibian', Actinopterygii: 'Fish', Insecta: 'Insect', Arachnida: 'Arachnid', Mollusca: 'Mollusk', Plantae: 'Plant', Fungi: 'Fungus', Chromista: 'Algae', Protozoa: 'Protozoan', Animalia: 'Animal' };
const skeletonGrid = n => `<div class="grid">${Array.from({ length: n }, () => '<div class="card"><div class="card-img skeleton"></div><div class="card-meta"><div class="skeleton" style="height:14px;border-radius:6px;width:60%;margin-top:4px"></div></div></div>').join('')}</div>`;

// The list a card was opened from, so a page can offer Previous / Next through it.
let navList = (() => { try { return JSON.parse(sessionStorage.getItem('ap.nav') || '[]'); } catch { return []; } })();
document.addEventListener('click', e => {
  const a = e.target.closest('a.card');
  if (!a || e.target.closest('button')) return;
  const items = [...app.querySelectorAll('a.card')].map(c => ({ h: c.getAttribute('href'), n: c.querySelector('.card-name')?.textContent || '', img: c.querySelector('img')?.getAttribute('src') || '' }));
  navList = items.filter((x, i) => items.findIndex(y => y.h === x.h) === i);
  try { sessionStorage.setItem('ap.nav', JSON.stringify(navList)); } catch {}
}, true);
function neighbours(href, b) {
  let list = navList;
  if (!list.some(x => x.h === href) && b) list = BEINGS.map(x => ({ h: `#/b/${x.key}`, n: x.name, img: photoOf(x) || '' }));
  const i = list.findIndex(x => x.h === href);
  return i < 0 ? {} : { prev: list[i - 1], next: list[i + 1] };
}
function detailBar(href, b) {
  const { prev, next } = neighbours(href, b);
  const nav = (x, dir) => x
    ? `<a class="pn ${dir}" href="${x.h}" data-pn="${dir}" aria-label="${dir === 'prev' ? tr('prev') : tr('next')}: ${esc(x.n)}">${dir === 'prev' ? icon('back') : ''}${x.img ? `<img src="${esc(smallPhoto(x.img))}" alt="">` : ''}<span><small>${dir === 'prev' ? tr('prev') : tr('next')}</small>${esc(x.n)}</span>${dir === 'next' ? icon('arrow') : ''}</a>`
    : `<span class="pn ${dir} off" aria-hidden="true"></span>`;
  return `<div class="dbar">
    <a class="back-big" href="${b ? '#/' : '#/explore'}" data-back>${icon('back')}<span>${tr('back')}</span></a>
    <div class="pn-wrap">${nav(prev, 'prev')}${nav(next, 'next')}</div>
  </div>`;
}
// Arrow keys flip through the list too.
document.addEventListener('keydown', e => {
  if (!/^#\/(b|t)\//.test(location.hash) || e.target.closest('input, textarea') || !$('#viewer3d').hidden) return;
  const a = e.key === 'ArrowRight' ? $('[data-pn=next]') : e.key === 'ArrowLeft' ? $('[data-pn=prev]') : null;
  if (a) { e.preventDefault(); location.replace(a.getAttribute('href')); }
});
// Previous / Next replace the history entry, so one Back always returns to the list.
document.addEventListener('click', e => { const a = e.target.closest('[data-pn]'); if (a && a.href) { e.preventDefault(); location.replace(a.getAttribute('href')); } });

// Says just the name, slowly and clearly, for little ones learning to say it.
// Pre-recorded Tamil voice (audio/ta, made by tools/tamil-audio.mjs) works on every phone,
// even without a Tamil voice installed. Falls back to the device voice if a clip can't play.
function playClip(url, btn, fallback) {
  stopSound(); window.speechSynthesis?.cancel();
  const my = soundGen;
  audio.src = url;
  btn?.classList.add('speaking');
  let started = false, gaveUp = false;
  const done = () => btn?.classList.remove('speaking');
  const giveUp = () => { if (started || gaveUp) return; gaveUp = true; done(); if (my !== soundGen) return; audio.pause(); fallback?.(); };
  audio.addEventListener('playing', () => { started = true; }, { once: true });
  audio.addEventListener('ended', done, { once: true });
  audio.addEventListener('pause', done, { once: true });
  audio.addEventListener('error', giveUp, { once: true });
  // If the clip hasn't started soon (slow network, a browser quirk), say it with the device voice instead.
  setTimeout(giveUp, 1800);
  audio.play().catch(giveUp);
}
const taClip = (key, kind) => TA[key] ? `audio/ta/${key}-${kind}.m4a` : null;
const enClip = (key, kind) => byKey[key] ? `audio/en/${key}-${kind}.m4a` : null;
// Library species play recorded clips (reliable on every phone); others use the device voice.
function sayName(name, btn, nameTa, key) {
  const flash = () => { if (!btn) return; btn.classList.add('speaking'); setTimeout(() => btn.classList.remove('speaking'), 1200); };
  const sayEn = () => { speak(`${name}.`, { rate: .8 }); flash(); };
  if (lang === 'ta' && taClip(key, 'name')) return playClip(taClip(key, 'name'), btn, () => { speak(`${nameTa || TA[key].n}.`, { rate: .8, lang: 'ta' }); flash(); });
  if (lang === 'ta' && nameTa && hasTamilVoice()) { speak(`${nameTa}.`, { rate: .8, lang: 'ta' }); return flash(); }
  if (enClip(key, 'name')) return playClip(enClip(key, 'name'), btn, sayEn);
  sayEn();
}

// Little game sounds, made on the fly (no files): a happy chime and a "flop".
let actx;
const ac = () => (actx ||= new (window.AudioContext || window.webkitAudioContext)());
function tone(freqs, { type = 'triangle', dur = .14, gap = .09, vol = .22, slide } = {}) {
  try {
    const c = ac(); c.resume?.();
    freqs.forEach((f, i) => {
      const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + i * gap;
      o.type = type; o.frequency.setValueAtTime(f, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(f * slide, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + .05);
    });
  } catch {}
}
const sfxWin = () => tone([523.3, 659.3, 784, 1046.5, 1318.5], { dur: .22, gap: .08 });
const sfxFlop = () => { tone([311, 233], { type: 'sawtooth', dur: .32, gap: .3, vol: .12, slide: .72 }); };
function confetti(from) {
  const r = from.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const colors = ['#1F5A43', '#7CC6A3', '#F2B33D', '#E5487A', '#4D8DF7', '#FF7A45'];
  const box = document.createElement('div'); box.className = 'confetti'; document.body.appendChild(box);
  for (let i = 0; i < 70; i++) {
    const p = document.createElement('i');
    p.style.cssText = `left:${cx}px;top:${cy}px;background:${colors[i % colors.length]};${i % 3 ? '' : 'border-radius:50%;'}`;
    box.appendChild(p);
    const a = Math.random() * Math.PI * 2, d = 120 + Math.random() * 260;
    p.animate([
      { transform: 'translate(-50%,-50%) rotate(0)', opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d - 120}px)) rotate(${Math.random() * 720}deg)`, opacity: 1, offset: .6 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * d * 1.1}px), calc(-50% + ${Math.sin(a) * d + 220}px)) rotate(${Math.random() * 900}deg)`, opacity: 0 },
    ], { duration: 1300 + Math.random() * 600, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
  }
  setTimeout(() => box.remove(), 2200);
}
function celebrate(el) { sfxWin(); confetti(el); }
function flop(el) { sfxFlop(); el.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(0)' }], { duration: 380 }); }
app.addEventListener('click', e => {
  const n = e.target.closest('[data-name]');
  if (n) { e.preventDefault(); e.stopPropagation(); sayName(n.dataset.name, n, n.dataset.nameTa, n.dataset.key); return; }
  const b = e.target.closest('[data-play]');
  if (!b) return;
  e.preventDefault(); e.stopPropagation();
  playBeing(+b.dataset.play, b, null, b.dataset.say);
});

// ---------------------------------------------------------------- views
const featured = () => { const pool = BEINGS.filter(b => b.m3d && !b.quiet); return pool[Math.floor(Date.now() / 864e5) % pool.length]; };

async function viewHome(groupKey = 'all') {
  const g = groupByKey[groupKey] || GROUPS[0];
  const f = featured();
  const render = () => {
    const lib = photos?.map ? BEINGS.filter(b => inGroup(b, g)) : (g.key === 'all' ? BEINGS : []);
    app.innerHTML = `
      ${g.key !== 'all' ? `<div class="page-head"><span class="eyebrow">${tr('group')}</span><h1 class="h-display">${esc(groupLabel(g))}</h1><p class="lede">${tr('group_lede')}</p></div>` : `
      <section class="feature">
        <a class="feature-img" href="#/b/${f.key}" aria-label="${esc(nm(f))}">${imgTag(bigPhoto(photoOf(f)), nm(f), false)}</a>
        <div class="feature-body">
          <span class="eyebrow">${tr('featured')}</span>
          <div class="title-row"><h1 class="h-display"${isTa() ? ' lang="ta"' : ''}>${esc(nm(f))}</h1>${nameBtn(f.name, f.key, 'say-name big')}</div>
          <p${isTa() ? ' lang="ta"' : ''}>${esc(isTa() && TA[f.key] ? TA[f.key].bio : f.bio)}</p>
          <div class="row">
            <a class="btn accent" href="#/b/${f.key}">${tr('meet', { name: isTa() ? nm(f) : f.name.toLowerCase() })} ${icon('arrow')}</a>
            <button class="btn outline" data-play="${f.id}" data-say="${esc(sayLine(f))}">${icon('play')} ${tr('hear_it')}</button>
          </div>
        </div>
      </section>
      <div class="section-head"><div><span class="eyebrow">${tr('library')}</span><h2 class="h-section">${tr('lib_title')}</h2></div></div>`}
      <nav class="filters" aria-label="${tr('groups_label')}">
        ${GROUPS.map(x => `<a class="filter" data-g="${x.key}" href="${x.key === 'all' ? '#/' : `#/g/${x.key}`}" aria-current="${x.key === g.key}">${esc(groupLabel(x))}<span class="n"></span></a>`).join('')}
      </nav>
      ${lib.length ? `<div class="grid">${lib.map(beingCard).join('')}</div>` : ''}
      <div class="section-head"><div><span class="eyebrow">${tr('every_species')}</span><h2 class="h-section">${g.key === 'all' ? esc(groupLabel(g)) : tr('all_x', { group: esc(isTa() ? groupLabel(g) : g.label.toLowerCase()) })}</h2></div></div>
      <div id="list">${skeletonGrid(8)}</div>
      <div class="load-more" id="more" aria-live="polite"></div>`;
    fillTotals();
    infiniteSpecies($('#list'), $('#more'), { taxa: g.taxa, without: g.without, skip: new Set(lib.map(b => b.id)) });
  };
  if (!photos?.map) await loadCuratedPhotos().catch(() => toast(tr('photos_fail')));
  if ((location.hash || '#/') === (g.key === 'all' ? '#/' : `#/g/${g.key}`) || (g.key === 'all' && location.hash === '')) render();
}

const kingdomTiles = list => `<div class="tiles">${list.map(k => `
  <a class="tile" href="#/explore/${k.id}" data-kid="${k.id}"><span>${esc(tr('nav_explore'))}</span><b>${esc(kingdomLabel(k))}</b></a>`).join('')}</div>`;
function decorateKingdom() {
  // Each tile shows a real photo of the most-observed species in that group.
  for (const el of document.querySelectorAll('.tile[data-kid]')) {
    api(`/observations/species_counts?taxon_id=${el.dataset.kid}&quality_grade=research&per_page=1&photos=true`).then(r => {
      const t = r.results[0]?.taxon;
      if (!t || !el.isConnected) return;
      el.style.backgroundImage = `url("${t.default_photo.medium_url}")`;
      el.querySelector('span').textContent = tr('eg', { name: cap(t.preferred_common_name || t.name) });
    }).catch(() => {});
  }
}

function viewExplore() {
  app.innerHTML = `
    <div class="page-head"><span class="eyebrow">${tr('tree')}</span><h1 class="h-display">${tr('every_being')}</h1>
    <p class="lede">${tr('tree_lede')}</p></div>
    ${kingdomTiles(KINGDOM)}`;
  decorateKingdom();
}

// Infinite list of species under the given taxa, loaded as the user scrolls.
let listIO = null; // the current page's scroll watcher (released on every route change)
function infiniteSpecies(listEl, more, { taxa, without = [], skip = new Set() }) {
  let page = 1, grid, busy = false, end = false;
  const q = `taxon_id=${taxa.join(',')}${without.length ? `&without_taxon_id=${without.join(',')}` : ''}&quality_grade=research&per_page=30&photos=true`;
  async function load() {
    if (busy || end || !more.isConnected) return;
    busy = true;
    if (grid) more.innerHTML = `<div class="spinner" role="status" aria-label="${tr('loading_more')}"></div>`;
    try {
      const r = await api(`/observations/species_counts?${q}&page=${page}`);
      if (!more.isConnected) return;
      if (!grid) { listEl.innerHTML = '<div class="grid"></div>'; grid = listEl.firstChild; }
      const items = r.results.filter(x => x.taxon.default_photo && !skip.has(x.taxon.id)).map(x => x.taxon);
      const taNames = isTa() ? await taNameMap(items.map(t => t.id)) : {};
      if (!more.isConnected) return;
      grid.insertAdjacentHTML('beforeend', items.map(t => taxonCard(t, taNames[t.id])).join(''));
      end = r.results.length < 30; page++;
      more.innerHTML = end ? `<p class="end">${tr('seen_all')}</p>` : '';
      busy = false;
      // Keep filling while the bottom is still near the screen (tall displays) — only after a success.
      if (!end && more.isConnected && more.getBoundingClientRect().top < innerHeight + 600) load();
    } catch {
      busy = false;
      if (!more.isConnected) return;
      // Offline or rate-limited: wait for the child to tap, don't retry in a loop.
      if (grid) { more.innerHTML = `<button class="btn outline">${tr('try_again')}</button>`; more.firstChild.onclick = load; }
      else listEl.innerHTML = `<div class="empty"><b>${tr('no_connect')}</b>${tr('check_net')}<div style="margin-top:14px"><button class="btn outline" id="retryList">${tr('try_again')}</button></div></div>`, $('#retryList').onclick = () => { listEl.innerHTML = skeletonGrid(8); load(); };
    }
  }
  listIO?.disconnect();
  listIO = new IntersectionObserver(es => { if (es[0].isIntersecting && !busy && !more.querySelector('button')) load(); }, { rootMargin: '800px 0px' });
  listIO.observe(more);
  load();
}
const groupTotals = store.get('ap.totals.v1', {});
function fillTotals() {
  for (const el of document.querySelectorAll('.filter[data-g]')) {
    const g = groupByKey[el.dataset.g], n = el.querySelector('.n');
    const show = v => { n.textContent = v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : v; };
    if (groupTotals[g.key]) { show(groupTotals[g.key]); continue; }
    api(`/observations/species_counts?taxon_id=${g.taxa.join(',')}${g.without ? `&without_taxon_id=${g.without.join(',')}` : ''}&quality_grade=research&per_page=1`)
      .then(r => { groupTotals[g.key] = r.total_results; store.set('ap.totals.v1', groupTotals); if (n.isConnected) show(r.total_results); }).catch(() => {});
  }
}

async function viewExploreGroup(id) {
  const k = KINGDOM.find(k => k.id === id);
  if (!k) return location.replace('#/explore'); // an unknown group link goes back to Explore
  app.innerHTML = `
    <a class="crumb" href="#/explore">${icon('back')} ${tr('tree')}</a>
    <div class="page-head"><span class="eyebrow">${tr('most_seen')}</span><h1 class="h-display">${esc(kingdomLabel(k))}</h1></div>
    <div id="list">${skeletonGrid(12)}</div>
    <div class="load-more" id="more" aria-live="polite"></div>`;
  infiniteSpecies($('#list'), $('#more'), { taxa: [id] });
}

async function viewSearch(q) {
  q = q.trim();
  const input = $('#searchInput'); if (input.value !== q) input.value = q;
  const ql = q.toLowerCase();
  const local = BEINGS.filter(b => b.name.toLowerCase().includes(ql) || b.key.includes(ql) || catByKey[b.cat].label.toLowerCase().includes(ql) || (TA[b.key] && (TA[b.key].n.includes(q) || TA_LABELS.cats[b.cat].includes(q))));
  app.innerHTML = `
    <div class="page-head"><span class="eyebrow" id="sub">${tr('searching')}</span><h1 class="h-display">“${esc(q)}”</h1></div>
    ${local.length ? `<div class="grid">${local.map(beingCard).join('')}</div><div class="section-head"><div><span class="eyebrow">${tr('from_tree')}</span><h2 class="h-section">${tr('more_matches')}</h2></div></div>` : ''}
    <div id="remote">${skeletonGrid(6)}</div>`;
  try {
    const r = await api(`/taxa/autocomplete?q=${encodeURIComponent(q)}&per_page=24&is_active=true`);
    if ($('#searchInput').value.trim() !== q) return;
    const seen = new Set(local.map(b => b.id));
    const res = r.results.filter(t => t.default_photo && !seen.has(t.id));
    const taNames = isTa() ? await taNameMap(res.map(t => t.id)) : {};
    if (!$('#remote')) return;
    $('#remote').innerHTML = res.length ? `<div class="grid">${res.map(t => taxonCard(t, taNames[t.id])).join('')}</div>` :
      (local.length ? '' : `<div class="empty"><b>${tr('no_matches')}</b>${tr('no_matches_hint')}</div>`);
    $('#sub').textContent = tr('results', { n: local.length + res.length });
  } catch {
    if (!$('#remote')) return; // the child already left the search page
    $('#remote').innerHTML = `<div class="empty"><b>${tr('offline')}</b>${tr('offline_hint')}</div>`;
    $('#sub').textContent = tr('results', { n: local.length });
  }
}

function firstSentences(html, n = 2) {
  const div = document.createElement('div'); div.innerHTML = html || '';
  const text = div.textContent.replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  const parts = text.match(/[^.!?]+[.!?]+/g) || [text];
  return parts.slice(0, n).join(' ').trim();
}

async function viewDetail({ being: b, taxonId }) {
  const id = b?.id ?? taxonId;
  const back = detailBar(b ? `#/b/${b.key}` : `#/t/${id}`, b);
  app.innerHTML = `${back}<div class="detail"><div class="gallery"><div class="hero"><div class="slides skeleton"></div></div></div>
    <div>${b ? `<h1 class="h-display">${esc(nm(b))}</h1>` : '<div class="skeleton" style="height:48px;border-radius:12px;width:70%"></div>'}</div></div>`;
  let t;
  try { t = (await api(`/taxa/${id}`)).results[0]; }
  catch { if (!b) { if (location.hash === `#/t/${id}`) app.innerHTML = `${back}<div class="empty"><b>${tr('no_load')}</b>${tr('check_net')}</div>`; return; } }
  if (location.hash !== (b ? `#/b/${b.key}` : `#/t/${id}`)) return;

  const name = b?.name || cap(t?.preferred_common_name || t?.name);
  const iconic = t?.iconic_taxon_name;
  const silentKind = ['Plantae', 'Fungi', 'Chromista', 'Protozoa'].includes(iconic);
  const pics = (t?.taxon_photos || []).slice(0, 8).map(p => ({ url: bigPhoto(p.photo.medium_url || p.photo.url), by: p.photo.attribution }));
  if (!pics.length && photoOf(b)) pics.push({ url: bigPhoto(photoOf(b)), by: photos.map[b.id].by });
  const bio = b?.bio || firstSentences(t?.wikipedia_summary, 3) || `${name} is a ${GROUP[iconic]?.toLowerCase() || 'living being'} found in nature.`;
  const family = t?.ancestors?.find(a => a.rank === 'family');
  const order = t?.ancestors?.find(a => a.rank === 'order');
  const facts = b ? [
    ['home2', 'Habitat', b.home], ['food', 'Diet', b.food], ['spark', 'Did you know', b.fun],
    family && ['family', 'Family', cap(family.preferred_common_name || family.name)],
  ] : [
    ['tree', 'Group', kindLabel(iconic)],
    family && ['family', 'Family', cap(family.preferred_common_name || family.name)],
    order && ['tree', 'Order', cap(order.preferred_common_name || order.name)],
    t?.observations_count && ['eye', 'Observed', tr('times', { n: t.observations_count.toLocaleString() })],
    t?.conservation_status?.status_name && ['shield', 'Status', cap(t.conservation_status.status_name)],
  ];
  const say = b ? sayLine(b) : `${name}.`;
  const ta = b ? TA[b.key] : null;
  const L = { about: tr('about'), home: tr('home'), food: tr('food'), fun: tr('fun'), family: tr('family'), group: tr('group_fact'), order: tr('order'), seen: tr('seen'), status: tr('status'), name: tr('name'), read: tr('read') };
  const tamil = lang === 'ta';
  const factsTa = ta ? [['home2', L.home, ta.home], ['food', L.food, ta.food], ['spark', L.fun, ta.fun]] : null;
  const label = { Habitat: 'home', Diet: 'food', 'Did you know': 'fun', Family: 'family', Group: 'group', Order: 'order', Observed: 'seen', Status: 'status' };
  const shownFacts = tamil && factsTa ? factsTa : facts.filter(Boolean).map(([i, l, v]) => [i, L[label[l]] || l, v]);
  const fav = { id, key: b?.key, name, photo: smallPhoto(pics[0]?.url) || photoOf(b) };

  app.innerHTML = `${back}
    <article class="detail">
      <div class="gallery">
        <div class="hero">
          <div class="slides" id="slides">${pics.map((p, i) => `<figure><img src="${p.url}" alt="${esc(name)}, ${tr('photo_n', { n: i + 1 })}" ${i ? 'loading="lazy"' : ''}></figure>`).join('') || '<figure></figure>'}</div>
          <button class="save ${isFave(id) ? 'on' : ''}" id="fave" aria-pressed="${isFave(id)}">${icon('bookmark')}<span>${isFave(id) ? tr('saved_btn') : tr('save')}</span></button>
        </div>
        ${pics.length > 1 ? `<div class="thumbs" id="thumbs">${pics.map((p, i) => `<button class="${i ? '' : 'on'}" aria-label="${tr('photo_n', { n: i + 1 })}"><img src="${smallPhoto(p.url)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
        <p class="credit" id="credit">${esc(pics[0]?.by || '')}</p>
      </div>
      <div>
        <div class="d-tax"><span class="pill">${esc(b ? catLabel(b.cat) : kindLabel(iconic))}</span>${t?.conservation_status?.status_name && b ? `<span class="pill" style="background:var(--surface-2);color:var(--ink-2)">${esc(cap(t.conservation_status.status_name))}</span>` : ''}</div>
        <h1 class="h-display" style="margin-top:12px" id="dname">${esc(tamil && ta ? ta.n : name)}</h1>
        <p class="d-sci" id="dsub">${tamil && ta ? `${esc(name)} · ` : ''}${esc(t?.name || '')}</p>

        ${silentKind ? '' : `
        <section class="sound" data-wave>
          <button class="sound-play" id="playBtn" aria-label="${tr('play_sound')}">${icon('play')}</button>
          <div>
            <div class="sound-title"><span>${b && !b.says.startsWith('(') ? `${tr('call')} · “${esc(b.says)}”` : tr('field_rec')}</span><small></small></div>
            <p class="sound-note" id="note">${b && CALLS[b.key] ? tr('note_call') : b?.quiet ? tr('note_quiet') : tr('note_wild')}</p>
          </div>
        </section>`}
        <div class="d-actions">
          ${b?.m3d ? `<button class="btn accent" id="btn3d">${icon('cube')} ${tr('view3d')}</button>` : ''}
          <button class="btn blue" id="nameBtn">${icon('speak')} <span>${L.name}</span></button>
          <button class="btn outline" id="sayBtn">${icon('speak')} <span>${L.read}</span></button>
        </div>

        <section class="about"><span class="eyebrow">${L.about}</span><p id="dbio"${tamil ? ' lang="ta"' : ''}>${esc(tamil && ta ? ta.bio : bio)}</p><p class="ta-note" id="tanote" hidden></p></section>
        <dl class="facts">${shownFacts.map(([i, l, v]) => `<div class="fact">${icon(i)}<dt>${l}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
        <p class="source">${tr('photos_by')} <a href="https://www.inaturalist.org/taxa/${id}" target="_blank" rel="noopener">iNaturalist</a>${t?.wikipedia_url && !b ? ` · ${tr('summary_from')} <a href="${esc(t.wikipedia_url)}" target="_blank" rel="noopener">Wikipedia</a>` : ''}.</p>
      </div>
    </article>`;

  const slides = $('#slides'), thumbs = $('#thumbs');
  const setIdx = i => {
    thumbs && [...thumbs.children].forEach((d, j) => d.classList.toggle('on', i === j));
    const c = $('#credit'); if (!c) return;
    if (pics[i]?.html) c.innerHTML = pics[i].html; else c.textContent = pics[i]?.by || '';
  };
  slides.addEventListener('scroll', () => setIdx(Math.round(slides.scrollLeft / slides.clientWidth)), { passive: true });
  thumbs?.addEventListener('click', e => {
    const btn = e.target.closest('button'); if (!btn) return;
    const i = [...thumbs.children].indexOf(btn);
    slides.scrollTo({ left: i * slides.clientWidth, behavior: 'smooth' }); setIdx(i);
  });
  $('#fave').onclick = e => {
    const on = toggleFave(fav), btn = e.currentTarget;
    btn.classList.toggle('on', on); btn.setAttribute('aria-pressed', on); btn.querySelector('span').textContent = on ? tr('saved_btn') : tr('save');
    toast(on ? tr('saved_toast', { name: tamil && ta ? ta.n : name }) : tr('unsaved_toast'));
  };
  $('#playBtn')?.addEventListener('click', e => playBeing(id, e.currentTarget, $('#note'), say));
  let taInfo = ta ? { n: ta.n, bio: ta.bio } : null;
  $('#sayBtn').onclick = e => {
    const speakTa = () => speak(`${taInfo.n || name}. ${taInfo.bio}`, { lang: 'ta' });
    if (tamil && b && taClip(b.key, 'about')) playClip(taClip(b.key, 'about'), e.currentTarget, speakTa);
    else if (tamil && taInfo?.bio) speakTa();
    else if (b && enClip(b.key, 'about')) playClip(enClip(b.key, 'about'), e.currentTarget, () => speak(`${name}. ${bio}`));
    else speak(`${name}. ${bio}`);
  };
  $('#nameBtn').onclick = e => sayName(name, e.currentTarget, taInfo?.n, b?.key);
  if (tamil && !ta) {
    // Species outside the library: look for a Tamil name and Tamil Wikipedia summary.
    $('#tanote').hidden = false; $('#tanote').textContent = 'தமிழ் விளக்கத்தைத் தேடுகிறோம்…';
    const note = $('#tanote');
    tamilFor(id, t?.wikipedia_url).then(r => {
      if (!note.isConnected || lang !== 'ta') return; // the child moved on, or switched back to English
      taInfo = r;
      if (r.n) { $('#dname').textContent = r.n; $('#dsub').textContent = `${name} · ${t?.name || ''}`; }
      if (r.bio) { $('#dbio').textContent = r.bio; $('#dbio').lang = 'ta'; $('#tanote').innerHTML = `விளக்கம்: <a href="${esc(r.url || '#')}" target="_blank" rel="noopener">தமிழ் விக்கிப்பீடியா</a>`; }
      else $('#tanote').textContent = 'இதற்குத் தமிழ் விளக்கம் இன்னும் இல்லை — ஆங்கிலத்தில் காட்டுகிறோம்.';
    });
  }
  $('#btn3d')?.addEventListener('click', () => open3d(tamil && ta ? ta.n : name, b.m3d));
  // No checked model for this species: look for one automatically and add the button if found.
  if (!b?.m3d) find3d(id, b?.name || cap(t?.preferred_common_name || ''), t?.name, iconic).then(m3d => {
    const row = $('.d-actions'); if (!m3d || !row?.isConnected || $('#btn3d')) return;
    row.insertAdjacentHTML('afterbegin', `<button class="btn accent" id="btn3d">${icon('cube')} ${tr('view3d')}</button>`);
    $('#btn3d').onclick = () => open3d(tamil && ta ? ta.n : name, m3d);
  });

  // Lead with real footage when Commons has a suitable clip.
  getVideo(t?.name, name, b?.key).then(vid => {
    if (!vid || !slides.isConnected) return;
    const fig = document.createElement('figure'); fig.className = 'vfig';
    const v = videoEl(vid.large, { poster: vid.poster || pics[0]?.url, cls: 'hero-video on', autoplay: false });
    const playBig = document.createElement('button');
    playBig.className = 'vplay'; playBig.setAttribute('aria-label', tr('play_video')); playBig.innerHTML = icon('play');
    const go = () => { v.play().catch(() => {}); fig.classList.add('live'); };
    const halt = () => { v.pause(); fig.classList.remove('live'); };
    fig.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') go(); });
    fig.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') halt(); });
    playBig.onclick = () => (v.paused ? go() : halt());
    v.addEventListener('click', () => (v.paused ? go() : halt()));
    const mute = document.createElement('button');
    mute.className = 'mute'; mute.innerHTML = `${icon('speak')}<span>${tr('unmute')}</span>`;
    mute.onclick = () => { v.muted = !v.muted; if (!v.muted) stopSound(); mute.querySelector('span').textContent = v.muted ? tr('unmute') : tr('mute'); mute.classList.toggle('on', !v.muted); };
    fig.append(v, playBig, mute);
    slides.prepend(fig); slides.scrollLeft = 0;
    pics.unshift({ html: `${tr('video')}: <a href="${esc(vid.page)}" target="_blank" rel="noopener">${esc(vid.title)}</a> · Wikimedia Commons` });
    let th = $('#thumbs');
    if (!th) { th = document.createElement('div'); th.className = 'thumbs'; th.id = 'thumbs'; slides.closest('.hero').after(th); th.addEventListener('click', e => { const btn = e.target.closest('button'); if (!btn) return; const i = [...th.children].indexOf(btn); slides.scrollTo({ left: i * slides.clientWidth, behavior: 'smooth' }); }); }
    th.insertAdjacentHTML('afterbegin', `<button class="vthumb" aria-label="${tr('video')}">${vid.poster ? `<img src="${esc(vid.poster)}" alt="">` : ''}${icon('play')}</button>`);
    setIdx(0);
  });
}

// Words that rule a model out for a kids' app (cartoons of people, monsters, weapons, gore and so on).
const BAD_3D = /skull|skeleton|bone|cranium|jaw\b|teeth|organs?\b|anatom|internal|dissect|x-?ray|train|locomotive|vehicle|\bcar\b|truck|ship\b|boat|plane|aircraft|building|furniture|chair|lamp|drone|vertebra|fossil|anime|manga|mecha|robot|cyber|droid|furry|anthro|gwen|man\b|woman|girl|boy|lady|guy|human|avatar|vrchat|chibi|fantasy|dragon|demon|devil|monster|zombie|undead|alien|creature|beast|kaiju|statue|sculpt|bust|head\b|mask|costume|plush|toy|lego|pokemon|minecraft|fortnite|fnaf|lost ark|warrior|knight|armou?r|weapon|gun|sword|tank|nsfw|sexy|nude|blood|gore|dead|death|horror|scary|evil|diorama|scene|pack|kit|logo|game ready character|rig only|base mesh|hybrid|mutant|cartoon|toon|kawaii|cute/i;
const found3d = store.get('ap.3d.v1', {});
async function find3d(taxonId, common, sci, iconic) {
  if (taxonId in found3d) return found3d[taxonId];
  const words = [common, sci].filter(Boolean).map(s => s.toLowerCase());
  const key = words.flatMap(w => [w, w.split(/\s+/).pop()]);
  const ok = m => !m.isAgeRestricted && !BAD_3D.test(m.name) && key.some(k => k.length > 2 && m.name.toLowerCase().includes(k));
  const cat = ['Plantae', 'Fungi'].includes(iconic) ? 'nature-plants' : 'animals-pets';
  const search = async params => (await fetch('https://api.sketchfab.com/v3/search?' + new URLSearchParams({ type: 'models', count: 24, ...params })).then(r => r.json())).results || [];
  let uid = null;
  try {
    for (const q of [common, sci].filter(Boolean)) {
      const pick = (await search({ q, staffpicked: true, categories: cat })).find(ok) || (await search({ q, categories: cat, sort_by: '-likeCount' })).find(m => ok(m) && m.likeCount >= 10);
      if (pick) { uid = pick.uid; break; }
    }
  } catch { return null; } // offline: try again next time
  found3d[taxonId] = uid ? `sf:${uid}` : null; store.set('ap.3d.v1', found3d);
  return found3d[taxonId];
}
function open3d(title, m3d) {
  const stage = $('#viewer3dStage');
  $('#viewer3dTitle').textContent = title;
  stopSound();
  if (m3d.startsWith('glb:')) {
    stage.innerHTML = `<model-viewer src="${GLB_MODELS[m3d.slice(4)]}" alt="${esc(title)} 3D model" camera-controls touch-action="pan-y" auto-rotate autoplay shadow-intensity="1" exposure="1.05" ar ar-modes="webxr scene-viewer quick-look"><button slot="ar-button" class="btn" style="position:absolute;bottom:18px;left:50%;transform:translateX(-50%);background:#fff;color:#151714">View in your space</button></model-viewer>`;
  } else {
    stage.innerHTML = `<iframe title="${esc(title)} 3D model" allow="autoplay; fullscreen; xr-spatial-tracking" allowfullscreen src="https://sketchfab.com/models/${m3d.slice(3)}/embed?autostart=1&preload=1&ui_theme=dark&ui_infos=0&ui_watermark=0&ui_hint=2&ui_help=0&ui_settings=0&ui_vr=0&ui_annotations=0&ui_inspector=0&dnt=1"></iframe>`;
  }
  $('#viewer3d').hidden = false;
  history.pushState({ v3d: 1 }, '');
}
function close3d() { const v = $('#viewer3d'); if (v.hidden) return; v.hidden = true; $('#viewer3dStage').innerHTML = ''; }
$('#close3d').onclick = () => history.back();

function viewFaves() {
  const list = faves();
  app.innerHTML = `<div class="page-head"><span class="eyebrow">${tr('collection')}</span><h1 class="h-display">${tr('saved_title')}</h1></div>
    ${list.length ? `<div class="grid">${list.map(f => f.key && byKey[f.key] ? beingCard(byKey[f.key]) : `
      <a class="card" href="#/t/${f.id}"><div class="card-img">${imgTag(f.photo, f.name)}</div>
      <div class="card-meta"><div>${nameRow(f.name, f.name, null)}</div></div></a>`).join('')}</div>`
      : `<div class="empty"><b>${tr('nothing_saved')}</b>${tr('nothing_saved_hint')}</div>`}`;
}

// ---------------------------------------------------------------- quiz
// Two games: "Who's calling?" (hear a call, pick the photo) and "Name it" (see a photo, pick the name).
const scores = { sound: store.get('ap.score', { stars: 0, played: 0, streak: 0 }), name: store.get('ap.score.name', { stars: 0, played: 0, streak: 0 }) };
const saveScore = mode => store.set(mode === 'name' ? 'ap.score.name' : 'ap.score', scores[mode]);
const cheer = () => { const c = tr('cheers').split('|'); return c[Math.floor(Math.random() * c.length)]; };
function quizHead(mode) {
  const sc = scores[mode];
  return `<nav class="quiz-modes" aria-label="${tr('quiz_types')}">
      <a href="#/game" aria-current="${mode === 'sound'}">${icon('quiz')} ${tr('q_sound')}</a>
      <a href="#/game/name" aria-current="${mode === 'name'}">${icon('eye')} ${tr('q_name')}</a>
    </nav>
    <div class="quiz-top">
      <div><span class="eyebrow">${mode === 'name' ? tr('picture_quiz') : tr('sound_quiz')}</span><h1 class="h-display">${mode === 'name' ? tr('who_is') : tr('q_sound')}</h1></div>
      <div class="stats"><div class="stat"><b>${sc.stars}</b><span>${tr('correct')}</span></div><div class="stat"><b>${sc.streak || 0}</b><span>${tr('streak')}</span></div></div>
    </div>`;
}
function scoreAnswer(mode, missed) {
  const sc = scores[mode];
  sc.played++;
  if (!missed) { sc.stars++; sc.streak = (sc.streak || 0) + 1; } else sc.streak = 0;
  saveScore(mode);
  const stats = app.querySelectorAll('.stat b');
  if (stats.length) { stats[0].textContent = sc.stars; stats[1].textContent = sc.streak; }
}
let lastAnswer;
let announceTimer, autoNextTimer;
// After a right answer the next question comes by itself in 2 s; the Next button fills up meanwhile.
function autoNext(c) {
  const next = $('#next'); if (!next) return;
  next.classList.add('auto');
  clearTimeout(autoNextTimer);
  autoNextTimer = setTimeout(() => { if (c.isConnected && next.isConnected) next.click(); }, 2000);
}
const quizEmpty = msg => { app.innerHTML = `<section class="quiz">${quizHead(location.hash.includes('name') ? 'name' : 'sound')}<div class="empty"><b>${tr('quiz_empty')}</b>${msg}<div style="margin-top:14px"><button class="btn outline" onclick="location.reload()">${tr('try_again')}</button></div></div></section>`; };
const pickAnswer = pool => { let a; do { a = pool[Math.floor(Math.random() * pool.length)]; } while (pool.length > 1 && a === lastAnswer); return (lastAnswer = a); };

async function viewGame(mode = 'sound') {
  const here = location.hash;
  await loadCuratedPhotos().catch(() => {});
  if (location.hash !== here) return; // the child tapped elsewhere while photos loaded
  if (mode === 'name') return viewNameGame();
  let pool = BEINGS.filter(b => CALLS[b.key] && photoOf(b));
  if (pool.length < 4) pool = BEINGS.filter(b => !b.quiet && photoOf(b)); // too few clear calls: use wild recordings
  if (pool.length < 4) return quizEmpty(tr('quiz_need_net'));
  const answer = pickAnswer(pool);
  const opts = shuffle([answer, ...shuffle(pool.filter(b => b !== answer)).slice(0, 3)]);
  app.innerHTML = `<section class="quiz">
    ${quizHead('sound')}
    <div class="quiz-player" data-wave>
      <button class="sound-play" id="gplay" aria-label="${tr('play_mystery')}">${icon('play')}</button>
      <p>${tr('tap_again_sound')}</p>
    </div>
    <div class="choices">${opts.map(o => `<div class="choice-wrap"><button class="choice" data-k="${o.key}"><img src="${photoOf(o)}" alt=""><div${isTa() ? ' lang="ta"' : ''}>${esc(nm(o))}</div></button>${nameBtn(o.name, o.key, 'say-opt in-choice')}</div>`).join('')}</div>
    <div class="feedback"><p id="cheer"></p><button class="btn" id="next" hidden>${tr('next_sound')} ${icon('arrow')}</button></div>
  </section>`;
  const play = () => playBeing(answer.id, $('#gplay'), null, answer.says, { callOnly: true });
  $('#gplay').onclick = play;
  play();
  let done = false, missed = false;
  app.querySelectorAll('.choice').forEach(c => c.onclick = () => {
    if (done) return;
    if (c.dataset.k === answer.key) {
      done = true; c.classList.add('right'); scoreAnswer('sound', missed);
      stopSound(); celebrate(c);
      $('#cheer').innerHTML = `<span class="ok">${missed ? tr('got_it') : cheer()} — ${tr('its_the', { name: esc(isTa() ? nm(answer) : answer.name.toLowerCase()) })}</span>`;
      announceTimer = setTimeout(() => { if (c.isConnected) sayName(answer.name, null, TA[answer.key]?.n, answer.key); }, 550);
      $('#next').hidden = false; autoNext(c);
    } else {
      missed = true; c.classList.add('wrong'); stopSound(); flop(c); $('#cheer').textContent = tr('not_quite_sound');
    }
  });
  $('#next').onclick = () => { clearTimeout(announceTimer); clearTimeout(autoNextTimer); viewGame('sound'); };
}

async function viewNameGame() {
  const pool = BEINGS.filter(b => photoOf(b));
  if (pool.length < 4) return quizEmpty(tr('quiz_need_net'));
  const answer = pickAnswer(pool);
  // Two look-alikes from the same group keep it interesting; one from elsewhere keeps it fair.
  const near = shuffle(pool.filter(b => b !== answer && b.cat === answer.cat)).slice(0, 2);
  const far = shuffle(pool.filter(b => b !== answer && !near.includes(b))).slice(0, 3 - near.length);
  const opts = shuffle([answer, ...near, ...far]);
  app.innerHTML = `<section class="quiz">
    ${quizHead('name')}
    <figure class="name-photo"><img id="qimg" src="${bigPhoto(photoOf(answer))}" alt="${tr('mystery_animal')}"><figcaption id="qcredit"></figcaption></figure>
    <div class="name-choices">${opts.map(o => `<div class="name-opt">
      <button class="name-choice" data-k="${o.key}"${isTa() ? ' lang="ta"' : ''}>${esc(nm(o))}</button>
      ${nameBtn(o.name, o.key, 'say-opt')}
    </div>`).join('')}</div>
    <div class="feedback">
      <p id="cheer"></p>
      <div class="row">
        <button class="btn outline" id="hint">${icon('speak')} ${tr('hint')}</button>
        <button class="btn" id="next" hidden>${tr('next_picture')} ${icon('arrow')}</button>
      </div>
    </div>
  </section>`;
  // Show a random real photo, not always the same one the library card uses.
  api(`/taxa/${answer.id}`).then(r => {
    const ph = shuffle(r.results[0]?.taxon_photos || [])[0]?.photo;
    if (ph && lastAnswer === answer && $('#qimg')) { $('#qimg').src = bigPhoto(ph.medium_url); $('#qcredit').textContent = ph.attribution || ''; }
  }).catch(() => {});
  $('#hint').onclick = e => playBeing(answer.id, e.currentTarget, null, answer.quiet || answer.says.startsWith('(') ? answer.fun : answer.says, { callOnly: true });
  let done = false, missed = false;
  app.querySelectorAll('.name-choice').forEach(c => c.onclick = () => {
    if (done) return;
    if (c.dataset.k === answer.key) {
      done = true; c.classList.add('right'); scoreAnswer('name', missed);
      stopSound(); celebrate(c);
      app.querySelectorAll('.name-choice:not(.right)').forEach(x => x.classList.add('dim'));
      $('#cheer').innerHTML = `<span class="ok">${missed ? tr('got_it') : cheer()} — ${tr('its_the', { name: esc(isTa() ? nm(answer) : answer.name.toLowerCase()) })}</span> <a class="more-link" href="#/b/${answer.key}">${tr('learn_more')}</a>`;
      announceTimer = setTimeout(() => { if (c.isConnected) sayName(answer.name, null, TA[answer.key]?.n, answer.key); }, 550);
      $('#hint').hidden = true; $('#next').hidden = false; autoNext(c);
    } else {
      missed = true; c.classList.add('wrong'); stopSound(); flop(c); $('#cheer').textContent = tr('not_quite_pic');
    }
  });
  $('#next').onclick = () => { clearTimeout(announceTimer); clearTimeout(autoNextTimer); viewNameGame(); };
}

// ---------------------------------------------------------------- search + voice
const input = $('#searchInput');
let deb;
input.addEventListener('input', () => {
  clearTimeout(deb);
  deb = setTimeout(() => {
    const q = input.value.trim();
    const to = `#/search/${encodeURIComponent(q)}`;
    if (q.length >= 2) location.hash.startsWith('#/search/') ? location.replace(to) : (location.hash = to);
    else if (!q && location.hash.startsWith('#/search')) location.hash = '#/';
  }, 350);
});
$('#searchForm').addEventListener('submit', e => { e.preventDefault(); input.blur(); const q = input.value.trim(); if (q) location.hash = `#/search/${encodeURIComponent(q)}`; });

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec;
$('#micBtn').addEventListener('click', () => {
  if (!SR) { toast(tr('voice_need')); input.focus(); return; }
  stopSound();
  rec = new SR(); rec.lang = isTa() ? 'ta-IN' : 'en-IN'; rec.interimResults = true; rec.maxAlternatives = 1;
  const panel = $('#listening'), txt = $('#listeningText');
  txt.textContent = tr('listen_hint'); panel.hidden = false;
  let final = '';
  rec.onresult = e => {
    const r = [...e.results].map(r => r[0].transcript).join(' ');
    txt.textContent = `“${r}”`;
    if (e.results[e.results.length - 1].isFinal) final = r;
  };
  rec.onerror = e => { panel.hidden = true; if (e.error === 'not-allowed') toast(tr('mic_allow')); else if (e.error !== 'aborted') toast(tr('didnt_catch')); };
  rec.onend = () => {
    panel.hidden = true;
    const q = final.toLowerCase().replace(/^(show( me)?|find|search( for)?|where is|what is|i want( to see)?|look for)\s+/, '').replace(/^(a|an|the)\s+/, '').replace(/[.?!]/g, '').trim();
    if (q) { input.value = q; location.hash = `#/search/${encodeURIComponent(q)}`; }
  };
  rec.start();
});
$('#stopListen').onclick = () => { rec?.abort(); $('#listening').hidden = true; };

// ---------------------------------------------------------------- router
function setTab(tab) {
  document.querySelectorAll('[data-tab]').forEach(a => a.dataset.tab === tab ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
}
function route({ keepScroll = false } = {}) {
  close3d(); stopSound(); stopPreview(); window.speechSynthesis?.cancel(); clearTimeout(announceTimer); clearTimeout(autoNextTimer);
  if (!keepScroll) { listIO?.disconnect(); listIO = null; }
  let h = location.hash.slice(1) || '/';
  try { h = decodeURIComponent(h); } catch {} // a hand-typed "50%" shouldn't break the app
  const [, a, b] = h.split('/');
  if (!keepScroll) window.scrollTo(0, 0);
  if (a !== 'search' && input.value && document.activeElement !== input) input.value = '';
  if (!a) { setTab('home'); return viewHome(); }
  if (a === 'g' && groupByKey[b]) { setTab('home'); return viewHome(b); }
  if (a === 'c') { location.replace('#/'); return; }
  if (a === 'b' && byKey[b]) { setTab('home'); return viewDetail({ being: byKey[b] }); }
  if (a === 't' && +b) { setTab('explore'); return byId[+b] ? location.replace(`#/b/${byId[+b].key}`) : viewDetail({ taxonId: +b }); }
  if (a === 'explore') { setTab('explore'); return b ? viewExploreGroup(+b) : viewExplore(); }
  if (a === 'search') { setTab(''); return viewSearch(h.slice(8)); }
  if (a === 'game') { setTab('game'); return viewGame(b === 'name' ? 'name' : 'sound'); }
  if (a === 'faves') { setTab('faves'); return viewFaves(); }
  location.hash = '#/';
}
// Back returns to the previous screen only if this tab has moved within the app; a page opened
// straight from a link goes to its list instead of leaving the app.
let movedInApp = false;
window.addEventListener('hashchange', () => { movedInApp = true; route(); });
document.addEventListener('click', e => { const a = e.target.closest('[data-back]'); if (a && movedInApp) { e.preventDefault(); history.back(); } });
window.addEventListener('popstate', () => { if (!$('#viewer3d').hidden) close3d(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#viewer3d').hidden) history.back(); });
// Keeps the detail bar pinned just under the header, whatever its height.
const setTopH = () => document.documentElement.style.setProperty('--top-h', `${$('.top').offsetHeight}px`);
setTopH(); addEventListener('resize', setTopH);
window.speechSynthesis?.getVoices();
syncLangBtn();
$('#langBtn').onclick = () => {
  setLang(lang === 'ta' ? 'en' : 'ta');
  toast(tr('lang_toast'));
  // Mid-quiz, relabel the answers in place instead of starting a new question.
  if (location.hash.startsWith('#/game') && app.querySelector('.choice, .name-choice')) {
    app.querySelectorAll('.name-choice, .choice > div').forEach(el => { const b = byKey[(el.dataset.k || el.parentElement.dataset.k)]; if (!b) return; el.textContent = nm(b); el.lang = isTa() ? 'ta' : ''; });
    const head = app.querySelector('.quiz-modes'); if (head) { const mode = location.hash.includes('name') ? 'name' : 'sound'; const tmp = document.createElement('div'); tmp.innerHTML = quizHead(mode); head.nextElementSibling.replaceWith(tmp.children[1]); head.replaceWith(tmp.children[0]); }
    ['#hint', '#next'].forEach(sel => { const el = $(sel); if (!el) return; const k = { '#hint': 'hint', '#next': location.hash.includes('name') ? 'next_picture' : 'next_sound' }[sel]; el.childNodes.forEach(n => { if (n.nodeType === 3 && n.textContent.trim()) n.textContent = ` ${tr(k)} `; }); });
    const p = app.querySelector('.quiz-player p'); if (p) p.textContent = tr('tap_again_sound');
    return;
  }
  route({ keepScroll: true });
};
route();

if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
