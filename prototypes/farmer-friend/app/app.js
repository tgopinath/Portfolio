// FarmerFriend: hash-routed single page app. Data lives in data-crops.js / data-compost.js.
const $ = (s, el = document) => el.querySelector(s);
const app = $('#app');
const MONTHS = I18N.en.monthsShort;
const SEASON_MONTHS = { kharif: [6, 7, 8, 9, 10], rabi: [10, 11, 12, 1, 2, 3], zaid: [3, 4, 5, 6] };
const TYPE_ICON = { compost: 'worm', liquid: 'flask', seed: 'sprout', pest: 'shield', soil: 'layers' };

const store = {
  get(k, d) { try { const v = localStorage.getItem('ff.' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('ff.' + k, JSON.stringify(v)); } catch {} },
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = (n, cls = '') => `<svg class="${cls}"><use href="#i-${n}"/></svg>`;
const cropById = id => CROPS.find(c => c.id === id);
const inputById = id => COMPOSTS.find(c => c.id === id);
const nowMonth = () => new Date().getMonth() + 1;

// Crops added from batch files carry their own references.
Object.assign(SOURCES.crops, window.SOURCES_MORE || {});

/* ---------- Language ---------- */
// English data is kept as a snapshot; switching to Tamil copies the Tamil text over the same objects,
// so every view keeps reading CROPS / COMPOSTS / SEASONS as before.
let LANG = store.get('lang', 'en') === 'ta' ? 'ta' : 'en';
let L = I18N[LANG];
const BASE = { crops: structuredClone(CROPS), inputs: structuredClone(COMPOSTS), seasons: structuredClone(SEASONS), cats: { ...CATEGORIES },
  types: structuredClone(INPUT_TYPES), method: SOURCES.report.method, fixes: structuredClone(SOURCES.report.fixes) };
const enName = id => (BASE.crops.find(c => c.id === id) || {}).name || '';
function applyLang() {
  L = I18N[LANG];
  const ta = LANG === 'ta', CT = window.CROPS_TA || {}, IT = window.COMPOSTS_TA || {}, RT = window.REPORT_TA;
  CROPS.forEach((c, i) => Object.assign(c, structuredClone(BASE.crops[i]), ta && CT[c.id] ? structuredClone(CT[c.id]) : {}));
  COMPOSTS.forEach((o, i) => {
    const b = structuredClone(BASE.inputs[i]), t = ta && IT[o.id] ? structuredClone(IT[o.id]) : {};
    if (t.batch) t.batch = { ...b.batch, label: t.batch.label };
    if (t.dose) t.dose = { ...b.dose, label: t.dose.label };
    Object.assign(o, b, t);
  });
  for (const k in SEASONS) Object.assign(SEASONS[k], BASE.seasons[k], ta ? I18N.ta.seasons[k] : {});
  Object.assign(CATEGORIES, BASE.cats, ta ? I18N.ta.categories : {});
  for (const k in INPUT_TYPES) Object.assign(INPUT_TYPES[k], BASE.types[k], ta ? I18N.ta.inputTypes[k] : {});
  SOURCES.report.method = ta && RT ? RT.method : BASE.method;
  SOURCES.report.fixes = BASE.fixes.map((f, i) => ta && RT && RT.fixes[i] ? [...RT.fixes[i].slice(0, 3), f[3]] : f);
  document.documentElement.lang = LANG;
  document.body.classList.toggle('lang-ta', ta);
  document.querySelectorAll('[data-i18n]').forEach(el => { const v = el.dataset.i18n.split('.').reduce((o, k) => o[k], L); el.textContent = v; });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = L[el.dataset.i18nPh]; });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label', L[el.dataset.i18nAria]));
  const lb = $('#langBtn'); if (lb) { lb.textContent = L.langSwitch; lb.setAttribute('aria-label', L.langLabel); lb.lang = ta ? 'en' : 'ta'; }
}
// The other-language name shown under each title: Tamil under English, English under Tamil.
const altName = c => LANG === 'ta' ? enName(c.id) : c.ta;
const monthName = m => L.months[m - 1];

// Season in force for a month: Oct–Feb Rabi, Mar–May Zaid, Jun–Sep Kharif.
function seasonFor(m) { return m >= 6 && m <= 9 ? 'kharif' : m >= 3 && m <= 5 ? 'zaid' : 'rabi'; }

function photo(id, cls = '') {
  const p = CROP_IMAGES[id], c = cropById(id);
  const ph = `<span class="ph">${esc(c.name[0])}</span>`;
  return p ? `<img class="${cls}" src="${esc(p.thumb)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'ph',textContent:'${c.name[0]}'}))">` : ph;
}
const seasonTags = c => c.seasons.map(s => `<span class="tag ${s}">${SEASONS[s].name}</span>`).join('');

function cropCard(c) {
  return `<a class="card crop-card" href="#/crop/${c.id}">
    <div class="crop-photo">${photo(c.id)}<span class="water-badge">${icon('drop')}${L.waterShort[c.water]}</span></div>
    <div class="crop-body">
      <h3>${esc(c.name)}</h3>
      <span class="ta">${esc(altName(c))}</span>
      <div class="tags">${seasonTags(c)}</div>
      <span class="meta">${icon('clock')}${esc(c.days)}</span>
    </div></a>`;
}
function orgCard(o) {
  const hero = (window.MEDIA_INPUTS || {})[o.id]?.[0];
  return `<a class="card org-card${hero ? ' has-photo' : ''}" href="#/organic/${o.id}">
    ${hero ? `<span class="org-photo"><img src="${esc(hero.thumb || hero.src)}" alt="" loading="lazy" onerror="this.parentNode.remove()"><span class="org-icon t-${o.type}">${icon(TYPE_ICON[o.type])}</span></span>` : `<span class="org-icon t-${o.type}">${icon(TYPE_ICON[o.type])}</span>`}
    <div><span class="eyebrow">${INPUT_TYPES[o.type].name}</span></div>
    <h3>${esc(o.name)}</h3><span class="ta">${esc(inputAlt(o))}</span>
    <p>${esc(o.summary)}</p>
    <div class="org-facts"><span>${icon('clock')}${esc(o.time)}</span><span>${icon('check')}${esc(o.effort)}</span><span>${icon('scale')}${esc(L.cost(o.cost))}</span></div>
  </a>`;
}
const inputAlt = o => LANG === 'ta' ? BASE.inputs.find(x => x.id === o.id).name : o.ta;
const disclaimerHtml = () => `<div class="disclaimer">${icon('alert')}<p>${L.disclaimer(`<a class="link" href="#/sources">${L.seeReport}</a>`)}</p></div>`;
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const sourceLinks = refs => `<ul class="refs">${refs.map(([t, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${icon('next')}<span><b>${esc(t)}</b><small>${esc(hostOf(u))}</small></span></a></li>`).join('')}</ul>`;
function sourcesBlock(refs) {
  if (!refs || !refs.length) return '';
  return `<section class="section"><div class="section-head"><div><h2>${L.sourcesTitle}</h2><p>${L.sourcesSub}</p></div></div>
    <div class="card">${sourceLinks(refs)}</div></section>`;
}

/* ---------- Photos & videos ---------- */
const MEDIA = window.MEDIA || {}, MEDIA_INPUTS = window.MEDIA_INPUTS || {}, VIDEOS = window.VIDEOS || {};
// Galleries, pest photos and videos for the crops added later live in *-more files.
MEDIA.gallery = { ...(MEDIA.gallery || {}), ...((window.MEDIA_MORE || {}).gallery || {}) };
MEDIA.pests = { ...(MEDIA.pests || {}), ...((window.MEDIA_MORE || {}).pests || {}) };
VIDEOS.crops = { ...(VIDEOS.crops || {}), ...((window.VIDEOS_MORE || {}).crops || {}) };
const CAPTIONS_TA = window.CAPTIONS_TA || {};
const capOf = m => LANG === 'ta' && m.caption && CAPTIONS_TA[m.caption] ? CAPTIONS_TA[m.caption] : (m.caption || '');
let LB = [];  // photos the open lightbox can page through
function galleryBlock(items, title, sub) {
  items = (items || []).filter(Boolean);
  if (!items.length) return '';
  const start = LB.length; LB.push(...items);
  return `<section class="section"><div class="section-head"><div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div></div>
    <div class="gallery">${items.map((m, i) => `<button type="button" class="shot" data-lb="${start + i}" aria-label="${esc(L.openPhoto)}${capOf(m) ? ': ' + esc(capOf(m)) : ''}">
      <img src="${esc(m.thumb || m.src)}" alt="${esc(capOf(m))}" loading="lazy" onerror="this.closest('.shot').remove()">${capOf(m) ? `<span>${esc(capOf(m))}</span>` : ''}</button>`).join('')}</div></section>`;
}
const LANG_NAME = { ta: 'தமிழ்', en: 'English', hi: 'हिन्दी' };
function videoBlock(list, title, sub) {
  list = (list || []).slice().sort((a, b) => (b.lang === LANG) - (a.lang === LANG));
  if (!list.length) return '';
  return `<section class="section"><div class="section-head"><div><h2>${title}</h2><p>${sub}</p></div></div>
    <div class="videos">${list.map(v => `<div class="card video">
      <button type="button" class="video-frame" data-yt="${esc(v.id)}" aria-label="${esc(L.playVideo)}: ${esc(v.title)}">
        <img src="https://i.ytimg.com/vi/${esc(v.id)}/hqdefault.jpg" alt="" loading="lazy"><span class="play">${icon('play')}</span>
        <span class="vlang">${LANG_NAME[v.lang] || v.lang}</span></button>
      <div class="video-body"><b>${esc(v.title)}</b><small>${esc(v.channel)} · YouTube</small></div></div>`).join('')}</div>
    <p class="muted" style="font-size:12.5px;margin-top:8px">${L.videoNote}</p></section>`;
}
function bindMedia() {
  app.querySelectorAll('[data-yt]').forEach(b => b.addEventListener('click', () => {
    const f = document.createElement('iframe');
    f.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(b.dataset.yt)}?autoplay=1&rel=0`;
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; f.allowFullscreen = true; f.title = b.getAttribute('aria-label');
    b.replaceWith(f);
  }, { once: true }));
  app.querySelectorAll('[data-lb]').forEach(b => b.addEventListener('click', () => openLightbox(+b.dataset.lb)));
}
const lbDlg = $('#lightbox');
let lbAt = 0;
function showLb() {
  const m = LB[lbAt]; if (!m) return;
  $('#lbImg').src = m.src || m.thumb; $('#lbImg').alt = capOf(m);
  $('#lbCap').textContent = capOf(m); $('#lbCredit').textContent = m.credit || '';
  $('#lbCount').textContent = `${lbAt + 1} / ${LB.length}`;
}
function openLightbox(i) { lbAt = i; showLb(); lbDlg.showModal(); }
const lbStep = d => { lbAt = (lbAt + d + LB.length) % LB.length; showLb(); };
$('#lbPrev').addEventListener('click', () => lbStep(-1));
$('#lbNext').addEventListener('click', () => lbStep(1));
lbDlg.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') lbStep(-1); if (e.key === 'ArrowRight') lbStep(1); });
lbDlg.addEventListener('click', e => { if (e.target === lbDlg) lbDlg.close(); });
let tx = null;
lbDlg.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
lbDlg.addEventListener('touchend', e => { if (tx == null) return; const dx = e.changedTouches[0].clientX - tx; if (Math.abs(dx) > 50) lbStep(dx < 0 ? 1 : -1); tx = null; });

/* ---------- Accuracy report ---------- */
function viewSources() {
  const R = SOURCES.report, tot = R.totals, n = tot.correct + tot.approx + tot.wrong + tot.unverified;
  const pct = x => Math.round(x / n * 100);
  const bar = [['correct', 'var(--green)'], ['approx', 'var(--sun)'], ['wrong', 'var(--danger)'], ['unverified', 'var(--muted)']].map(([k, c]) => [k, L.bar[k], c]);
  return `<div class="fade-in">
    <span class="eyebrow">${L.repEyebrow(new Date(2026, 9, 30).toLocaleDateString(L.locale, { day: 'numeric', month: 'long', year: 'numeric' }))}</span>
    <h1 class="page-title">${L.repTitle}</h1>
    <p class="page-lede">${esc(R.method)}</p>
    <div class="facts" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
      <div class="fact"><small>${L.claims}</small><b style="font-size:28px;font-family:var(--serif)">${n}</b></div>
      <div class="fact"><small>${L.correctClose}</small><b style="font-size:28px;font-family:var(--serif);color:var(--green)">${pct(tot.correct + tot.approx)}%</b></div>
      <div class="fact"><small>${L.exact}</small><b style="font-size:28px;font-family:var(--serif)">${pct(tot.correct)}%</b></div>
      <div class="fact"><small>${L.wrongFixed}</small><b style="font-size:28px;font-family:var(--serif);color:var(--danger)">${tot.wrong}</b></div>
    </div>
    <div class="acc-bar">${bar.map(([k, , c]) => `<i style="flex:${tot[k]};background:${c}"></i>`).join('')}</div>
    <div class="legend">${bar.map(([k, l, c]) => `<span><i style="background:${c}"></i>${l}: ${tot[k]} (${pct(tot[k])}%)</span>`).join('')}</div>
    ${CROPS.length > 30 ? `<p class="card season-about" style="margin-top:16px">${L.moreNote(CROPS.length - 30)}</p>` : ''}
    <section class="section"><div class="section-head"><div><h2>${L.bySection}</h2></div></div>
      <div class="card"><table class="use-table">${R.groups.map((g, i) => { const m = g.correct + g.approx + g.wrong + g.unverified;
        return `<tr><td>${esc(L.groups[i])}</td><td>${L.sectionLine(m, Math.round((g.correct + g.approx) / m * 100), g.wrong)}</td></tr>`; }).join('')}</table></div></section>
    <section class="section"><div class="section-head"><div><h2>${L.whatChanged}</h2></div></div>
      <div class="card pests">${R.fixes.map(([what, before, after, u]) => `<div class="pest"><b>${icon('check')}${esc(what)}</b><p>${L.was}: ${esc(before)}<br>${L.nowIs}: <strong>${esc(after)}</strong>${u ? ` · <a class="link" href="${esc(u)}" target="_blank" rel="noopener">${L.source}</a>` : ''}</p></div>`).join('')}</div></section>
    <section class="section"><div class="section-head"><div><h2>${L.mainRefs}</h2><p>${L.mainRefsSub}</p></div></div>
      <div class="card">${sourceLinks(R.main)}</div></section>
    ${disclaimerHtml()}
  </div>`;
}

/* ---------- Today ---------- */
function viewHome() {
  const m = nowMonth(), s = seasonFor(m), S = SEASONS[s];
  const sowNow = CROPS.filter(c => c.sow.includes(m));
  const harvestNow = CROPS.filter(c => c.harvest.includes(m));
  const nextM = m % 12 + 1, sowNext = CROPS.filter(c => c.sow.includes(nextM) && !c.sow.includes(m));
  const heading = L.seasonHeading[s];
  const strip = MONTHS.map((_, i) => `<span class="${i + 1 === m ? 'now' : SEASON_MONTHS[s].includes(i + 1) ? 'in' : ''}"></span>`).join('');
  const featured = ['jeevamrutham', 'vermicompost', 'neemastra'].map(inputById);
  return `
    <form class="search home-search" id="homeSearch" role="search">${icon('search')}<input id="hq" type="search" placeholder="${esc(L.homeSearchPh)}" autocomplete="off" aria-label="${esc(L.homeSearchPh)}"></form>
    <div class="hero fade-in">
      <section class="season-card ${s}">
        <span class="season-art">${icon(s === 'kharif' ? 'rain' : s === 'rabi' ? 'leaf' : 'sun')}</span>
        <span class="eyebrow">${new Date().toLocaleDateString(L.locale, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        <h1>${heading}</h1>
        <p>${LANG === 'ta' ? '' : `<span class="ta">${S.ta} · </span>`}${S.months}. ${S.about}</p>
        <div class="month-strip">${strip}</div>
        <div class="month-labels">${L.monthsTiny.map(x => `<span>${x}</span>`).join('')}</div>
        <div class="actions">
          <a class="btn btn-light" href="#/seasons/${s}">${icon('calendar')}${L.seasonPlanner}</a>
          <a class="btn btn-ghost" href="#/crops">${icon('leaf')}${L.allCrops}</a>
        </div>
      </section>
      <section class="card weather" id="weather" aria-live="polite">
        <div class="skeleton" style="height:56px"></div>
        <div class="skeleton" style="height:76px"></div>
        <div class="skeleton" style="height:60px"></div>
      </section>
    </div>

    <section class="section">
      <div class="section-head"><div><h2>${L.sowIn(monthName(m))}</h2><p>${L.cropsThisMonth(sowNow.length)}</p></div>
        <a class="link" href="#/seasons/month/${m}">${L.monthPlanner}${icon('next')}</a></div>
      <div class="rail">${sowNow.map(cropCard).join('')}</div>
    </section>

    ${harvestNow.length ? `<section class="section">
      <div class="section-head"><div><h2>${L.readyHarvest}</h2><p>${L.harvestedIn(monthName(m))}</p></div></div>
      <div class="mini-list">${harvestNow.map(miniRow).join('')}</div>
    </section>` : ''}

    ${sowNext.length ? `<section class="section">
      <div class="section-head"><div><h2>${L.getReady(monthName(nextM))}</h2><p>${L.getReadySub}</p></div></div>
      <div class="mini-list">${sowNext.map(miniRow).join('')}</div>
    </section>` : ''}

    <section class="section">
      <div class="section-head"><div><h2>${L.makeOnFarm}</h2><p>${L.makeOnFarmSub}</p></div>
        <a class="link" href="#/organic">${L.seeAll(COMPOSTS.length)}${icon('next')}</a></div>
      <div class="org-grid">${featured.map(orgCard).join('')}</div>
    </section>
    ${disclaimerHtml()}`;
}
const miniRow = c => `<a class="card mini" href="#/crop/${c.id}">${photo(c.id)}<div><b>${esc(c.name)}</b><small>${esc(altName(c))} · ${esc(c.days)}</small></div>${icon('next')}</a>`;

/* ---------- Weather ---------- */
const WX = [
  [[0], 'clear', 'sun'], [[1, 2], 'partly', 'cloud'], [[3], 'overcast', 'cloud'], [[45, 48], 'fog', 'fog'],
  [[51, 53, 55, 56, 57], 'drizzle', 'rain'], [[61, 63, 65, 66, 67, 80, 81, 82], 'rain', 'rain'], [[71, 73, 75, 77, 85, 86], 'snow', 'cloud'], [[95, 96, 99], 'storm', 'storm'],
];
const wx = code => { const r = WX.find(([c]) => c.includes(code)) || WX[1]; return { label: L.wx[r[1]], icon: r[2] }; };
const place = () => store.get('place', { name: 'Chennai', admin: 'Tamil Nadu', lat: 13.0827, lon: 80.2707 });

async function loadWeather() {
  const el = $('#weather'); if (!el) return;
  const p = place();
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&timezone=auto&forecast_days=5`;
  try {
    const cacheKey = 'wx.' + p.lat + ',' + p.lon, cached = store.get(cacheKey);
    const d = cached && Date.now() - cached.t < 30 * 60e3 ? cached.d : await fetch(url).then(r => { if (!r.ok) throw 0; return r.json(); });
    if (!cached || cached.d !== d) store.set(cacheKey, { t: Date.now(), d });
    if (!$('#weather')) return;
    renderWeather(el, d, p);
  } catch {
    el.innerHTML = `<div class="weather-top"><span class="weather-icon">${icon('cloud')}</span><div><b>${L.wxFail}</b><p class="muted" style="font-size:14px">${L.wxFailSub}</p></div></div>`;
  }
}
function farmAdvice(d) {
  const c = d.current, dl = d.daily, tips = [];
  const rain2 = Math.max(dl.precipitation_probability_max[0] ?? 0, dl.precipitation_probability_max[1] ?? 0);
  const mm2 = (dl.precipitation_sum[0] || 0) + (dl.precipitation_sum[1] || 0);
  const hot = Math.max(...dl.temperature_2m_max.slice(0, 3)), cold = Math.min(...dl.temperature_2m_min.slice(0, 3));
  if (rain2 >= 60 || mm2 >= 10) tips.push(['warn', 'rain', L.adv.rain(Math.round(mm2))]);
  else tips.push(['ok', 'check', L.adv.dry]);
  if (c.wind_speed_10m >= 20) tips.push(['warn', 'wind', L.adv.wind(Math.round(c.wind_speed_10m))]);
  if (hot >= 36) tips.push(['warn', 'temp', L.adv.hot(Math.round(hot))]);
  if (cold <= 10) tips.push(['warn', 'temp', L.adv.cold(Math.round(cold))]);
  if (c.relative_humidity_2m >= 85 && c.temperature_2m >= 20) tips.push(['warn', 'drop', L.adv.humid]);
  if (rain2 < 30 && hot < 36 && tips.length < 3) tips.push(['ok', 'drop', L.adv.little]);
  return tips.slice(0, 3);
}
function renderWeather(el, d, p) {
  const c = d.current, w = wx(c.weather_code), dl = d.daily;
  const days = dl.time.map((t, i) => {
    const dt = new Date(t + 'T00:00'), ww = wx(dl.weather_code[i]);
    return `<div class="fday"><b>${i === 0 ? L.today : dt.toLocaleDateString(L.locale, { weekday: 'short' })}</b>${icon(ww.icon)}
      <span class="hi">${Math.round(dl.temperature_2m_max[i])}°</span> <span class="lo">${Math.round(dl.temperature_2m_min[i])}°</span>
      <span class="rain">${dl.precipitation_probability_max[i] ?? 0}%</span></div>`;
  }).join('');
  el.innerHTML = `
    <div class="weather-top">
      <span class="weather-icon">${icon(w.icon)}</span>
      <div><div class="weather-temp">${Math.round(c.temperature_2m)}°C</div><div class="muted" style="font-size:14px">${w.label} · ${esc(p.mine ? L.myFarm : p.name)}</div></div>
    </div>
    <div class="weather-meta"><span>${icon('drop')}${L.humidity} ${c.relative_humidity_2m}%</span><span>${icon('wind')}${L.wind} ${Math.round(c.wind_speed_10m)} ${L.kmh}</span></div>
    <div class="forecast" aria-label="5 day forecast, with chance of rain">${days}</div>
    <div class="advice"><span class="eyebrow">${L.adviceTitle}</span>
      <ul>${farmAdvice(d).map(([k, ic, t]) => `<li><span class="dot ${k === 'warn' ? 'warn' : ''}">${icon(ic)}</span><span>${t}</span></li>`).join('')}</ul></div>`;
}

/* ---------- Seasons ---------- */
function viewSeasons(sel, month) {
  const m = nowMonth(), cur = seasonFor(m);
  const s = sel && SEASONS[sel] ? sel : cur;
  const pickM = month || m;
  const inSeason = CROPS.filter(c => c.seasons.includes(s));
  const sow = CROPS.filter(c => c.sow.includes(pickM)), harv = CROPS.filter(c => c.harvest.includes(pickM));
  const pill = c => `<a class="pill" href="#/crop/${c.id}">${photo(c.id)}${esc(c.name)}</a>`;
  const filt = store.get('calCat', 'all');
  return `
    <div class="fade-in">
      <span class="eyebrow">${L.plannerEyebrow}</span>
      <h1 class="page-title">${L.plannerTitle}</h1>
      <p class="page-lede">${L.plannerLede}</p>
      <div class="season-tabs" role="tablist">
        ${Object.entries(SEASONS).map(([k, v]) => `<a role="tab" aria-selected="${k === s}" class="season-tab ${k} ${k === s ? 'on' : ''}" href="#/seasons/${k}">
          ${k === cur ? `<span class="now-pill">${L.now}</span>` : ''}<b>${v.name}</b><small>${v.months}<br>${v.short}</small></a>`).join('')}
      </div>
      <p class="card season-about">${LANG === 'ta' ? '' : `<span class="ta">${SEASONS[s].ta}</span> · `}${SEASONS[s].about}</p>
      <section class="section" style="margin-top:22px">
        <div class="section-head"><div><h2>${L.seasonCrops(SEASONS[s].name)}</h2><p>${L.seasonCount(inSeason.length)}</p></div></div>
        <div class="grid">${inSeason.map(cropCard).join('')}</div>
      </section>

      <section class="section" id="month">
        <div class="section-head"><div><h2>${L.monthByMonth}</h2><p>${L.tapMonth}</p></div></div>
        <div class="month-picker">${MONTHS.map((x, i) => `<a class="month-btn ${i + 1 === pickM ? 'on' : ''} ${i + 1 === m ? 'today' : ''}" href="#/seasons/month/${i + 1}">${L.monthsShort[i]}</a>`).join('')}</div>
        <div class="two-col">
          <div class="card col-card"><h3><span class="sw" style="background:var(--green)"></span>${L.sowIn(monthName(pickM))} (${sow.length})</h3>
            <div class="pill-list">${sow.map(pill).join('') || `<p class="empty">${L.noSow}</p>`}</div></div>
          <div class="card col-card"><h3><span class="sw" style="background:var(--sun)"></span>${L.harvestIn(monthName(pickM))} (${harv.length})</h3>
            <div class="pill-list">${harv.map(pill).join('') || `<p class="empty">${L.noHarvest}</p>`}</div></div>
        </div>
      </section>

      <section class="section" id="calendar">
        <div class="section-head"><div><h2>${L.calendar}</h2><p>${L.calendarSub}</p></div></div>
        <div class="cal-tools">
          <label class="search cal-search">${icon('search')}<input id="calQ" type="search" placeholder="${esc(L.calSearch)}" autocomplete="off" aria-label="${esc(L.calSearch)}"></label>
          <div class="seg" id="calSort" role="group" aria-label="${esc(L.calSortLabel)}">
            <button type="button" data-sort="group" class="${store.get('calSort', 'group') === 'group' ? 'on' : ''}">${L.calByType}</button>
            <button type="button" data-sort="soon" class="${store.get('calSort', 'group') === 'soon' ? 'on' : ''}">${L.calSoon}</button>
            <button type="button" data-sort="az" class="${store.get('calSort', 'group') === 'az' ? 'on' : ''}">${L.calAZ}</button>
          </div>
        </div>
        <div class="chips scroll" style="margin:12px 0">
          ${[['all', L.allCrops], ...Object.entries(CATEGORIES)].map(([k, v]) => `<button class="chip ${k === filt ? 'on' : ''}" data-calcat="${k}">${v}</button>`).join('')}
        </div>
        <div class="cal-legend">
          <span><i class="lg-s"></i>${L.sowing}</span><span><i class="lg-h"></i>${L.harvest}</span>
          <span><i class="lg-now"></i>${L.thisMonth}: ${monthName(m)}</span>
          <span><i class="sow-dot static"></i>${L.sowThisMonth}</span>
          <span class="muted" id="calCount"></span>
        </div>
        <div class="card cal2" id="calWrap"></div>
        <p class="muted" style="font-size:13px;margin-top:10px">${L.longCrops}</p>
      </section>
      ${disclaimerHtml()}
    </div>`;
}

/* ---------- Crops ---------- */
function viewCrops() {
  const st = store.get('cropFilter', { cat: 'all', season: 'all', q: '' });
  return `<div class="fade-in">
    <span class="eyebrow">${L.libEyebrow}</span>
    <h1 class="page-title">${L.libTitle(CROPS.length)}</h1>
    <p class="page-lede">${L.libLede}</p>
    <label class="search">${icon('search')}<input id="q" type="search" placeholder="${esc(L.searchPh)}" value="${esc(st.q)}" autocomplete="off" aria-label="${esc(L.searchPh)}"></label>
    <div class="chips scroll" id="catChips">${[['all', L.all], ...Object.entries(CATEGORIES)].map(([k, v]) => `<button class="chip ${k === st.cat ? 'on' : ''}" data-cat="${k}">${v}</button>`).join('')}</div>
    <div class="chips scroll" id="seasonChips" style="margin-top:8px">${[['all', L.anySeason], ...Object.entries(SEASONS).map(([k, v]) => [k, v.name])].map(([k, v]) => `<button class="chip ${k === st.season ? 'on' : ''}" data-season="${k}">${v}</button>`).join('')}</div>
    <p class="result-count" id="count"></p>
    <div class="grid" id="cropGrid"></div>
    <section class="section" id="worldSec" hidden><div class="section-head"><div><h2>${L.worldTitle}</h2><p>${L.worldSub}</p></div></div><div class="grid" id="worldGrid"></div></section>
    ${disclaimerHtml()}
  </div>`;
}
function bindCrops() {
  const st = store.get('cropFilter', { cat: 'all', season: 'all', q: '' });
  const draw = () => {
    const q = st.q.trim().toLowerCase();
    const list = CROPS.filter(c => (st.cat === 'all' || c.cat === st.cat) && (st.season === 'all' || c.seasons.includes(st.season)) &&
      (!q || [c.name, c.ta, enName(c.id), c.sci, CATEGORIES[c.cat], BASE.cats[c.cat]].some(x => x && x.toLowerCase().includes(q))));
    $('#cropGrid').innerHTML = list.map(cropCard).join('') || `<p class="empty">${L.noMatch}</p>`;
    $('#count').textContent = L.countOf(list.length, CROPS.length);
    store.set('cropFilter', st);
    clearTimeout(worldT);
    const sec = $('#worldSec');
    if (q.length < 3) { sec.hidden = true; return; }
    worldT = setTimeout(async () => {
      sec.hidden = false; $('#worldGrid').innerHTML = `<p class="empty">${L.searching}</p>`;
      try {
        const res = await worldSearch(st.q.trim());
        if (st.q.trim().toLowerCase() !== q) return;
        $('#worldGrid').innerHTML = res.map(plantCard).join('') || `<p class="empty">${L.worldNone}</p>`;
      } catch { $('#worldGrid').innerHTML = `<p class="empty">${L.needNet}</p>`; }
    }, 450);
  };
  let worldT;
  $('#q').addEventListener('input', e => { st.q = e.target.value; draw(); });
  $('#catChips').addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (!b) return; st.cat = b.dataset.cat; $('#catChips').querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  $('#seasonChips').addEventListener('click', e => { const b = e.target.closest('[data-season]'); if (!b) return; st.season = b.dataset.season; $('#seasonChips').querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  draw();
}

function viewCrop(id) {
  const c = cropById(id); if (!c) return notFound();
  const m = nowMonth(), p = CROP_IMAGES[c.id];
  const F = L.facts;
  const facts = [[F.season, c.seasons.map(s => `${SEASONS[s].name} · ${SEASONS[s].months}`)], [F.days, c.days], [F.soil, c.soil], [F.ph, c.ph],
    [F.temp, c.temp], [F.water, `${L.water[c.water]} · ${L.rainWord(c.rain)}`], [F.spacing, c.spacing], [F.seed, c.seed]];
  const row = (lab, arr, cls) => `<span class="lab">${lab}</span>${MONTHS.map((_, i) => `<i class="${arr.includes(i + 1) ? cls : ''}" title="${L.months[i]}"></i>`).join('')}`;
  const sowingNow = c.sow.includes(m);
  return `<div class="fade-in">
    <a class="back" href="#/crops">${icon('back')}${L.allCrops}</a>
    <div class="detail-hero">
      <figure class="detail-photo" style="margin:0">${p ? `<img src="${esc(p.src)}" alt="${esc(L.plantPhoto(c.name))}">` : ''}${p ? `<figcaption>${esc(p.credit)}</figcaption>` : ''}</figure>
      <div class="detail-head">
        <span class="eyebrow">${CATEGORIES[c.cat]}</span>
        <h1>${esc(c.name)}</h1>
        <div class="ta">${esc(altName(c))}</div>
        <div class="sci">${esc(c.sci)}</div>
        <p class="intro">${esc(c.intro)}</p>
        <div class="tags">${seasonTags(c)}<span class="tag">${icon('drop')}${L.water[c.water]}</span>${sowingNow ? `<span class="tag" style="background:var(--green-soft);color:var(--green)">${icon('check')}${L.sowThisMonth}</span>` : ''}${c.custom ? `<span class="tag">${icon('sprout')}${L.addedByAdmin}</span>` : ''}</div>
      </div>
    </div>
    ${c.custom ? `<p class="card season-about" style="margin-top:18px">${L.customNote}</p>` : ''}
    <div class="facts">${facts.map(([k, v]) => `<div class="fact"><small>${k}</small><b>${Array.isArray(v) ? v.map(x => `<span class="fact-line">${esc(x)}</span>`).join('') : esc(v)}</b></div>`).join('')}</div>
    ${galleryBlock((MEDIA.gallery || {})[c.id], L.photos, L.photosSub(c.name.split(' (')[0]))}

    <section class="section">
      <div class="section-head"><div><h2>${L.calendar}</h2><p>${esc(L.expectedYield(c.yield))}</p></div></div>
      <div class="card crop-cal"><div class="bars">
        <span></span>${L.monthsTiny.map((x, i) => `<span class="mn ${i + 1 === m ? 'cur' : ''}">${x}</span>`).join('')}
        ${row(L.sowRow, c.sow, 's')}${c.harvest.length ? row(L.harvestRow, c.harvest, 'h') : ''}
      </div>${c.harvest.length ? '' : `<p class="note">${esc(L.harvestAfter(c.days))}</p>`}</div>
    </section>

    <section class="section">
      <div class="section-head"><div><h2>${L.howToGrow}</h2><p>${L.howToGrowSub}</p></div></div>
      <div class="steps">${Object.entries(c.steps).filter(([, v]) => v).map(([k, v], i) => `<div class="card step"><span class="step-num">${i + 1}</span><div><h3>${L.steps[k]}</h3><p>${esc(v)}</p></div></div>`).join('')}</div>
    </section>
    ${videoBlock((VIDEOS.crops || {})[c.id], L.watchGrow, L.watchSub)}

    <section class="section">
      <div class="section-head"><div><h2>${L.pests}</h2><p>${L.pestsSub}</p></div></div>
      <div class="card pests">${c.pests.map(([n, t], i) => { const ph = ((MEDIA.pests || {})[c.id] || [])[i];
        const lb = ph ? LB.push({ ...ph, caption: n }) - 1 : -1;
        return `<div class="pest${ph ? ' has-photo' : ''}">${ph ? `<button type="button" class="pest-photo" data-lb="${lb}" aria-label="${esc(L.openPhoto)}: ${esc(n)}"><img src="${esc(ph.thumb || ph.src)}" alt="" loading="lazy" onerror="this.parentNode.remove()"></button>` : ''}<b>${ph ? '' : icon('bug')}${esc(n)}</b><p>${esc(t)}</p></div>`; }).join('')}</div>
    </section>

    <section class="section two-col" style="margin-top:28px">
      <div class="card note-card"><span class="org-icon t-seed">${icon('sun')}</span><div><h3>${L.tips}</h3><ul>${c.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div></div>
      <div class="card note-card"><span class="org-icon t-liquid">${icon('leaf')}</span><div><h3>${L.companion}</h3><p>${esc(c.companion)}</p></div></div>
    </section>

    <section class="section">
      <div class="section-head"><div><h2>${esc(L.inputsFor(c.name.split(' (')[0]))}</h2><p>${L.makeThese}</p></div></div>
      <div class="org-grid">${c.compost.map(inputById).filter(Boolean).map(orgCard).join('')}</div>
    </section>
    ${sourcesBlock(SOURCES.crops[c.id])}
    ${disclaimerHtml()}
  </div>`;
}

/* ---------- Organic ---------- */
function viewOrganic() {
  const t = store.get('orgType', 'all');
  return `<div class="fade-in">
    <span class="eyebrow">${L.orgEyebrow}</span>
    <h1 class="page-title">${L.orgTitle}</h1>
    <p class="page-lede">${L.orgLede}</p>
    <div class="chips scroll" id="typeChips" style="margin-top:20px;margin-bottom:16px">${[['all', L.all], ...Object.entries(INPUT_TYPES).map(([k, v]) => [k, v.name])].map(([k, v]) => `<button class="chip ${k === t ? 'on' : ''}" data-type="${k}">${v}</button>`).join('')}</div>
    <div class="org-grid" id="orgGrid"></div>
    <section class="section">
      <div class="section-head"><div><h2>${L.schedule}</h2><p>${L.scheduleSub}</p></div></div>
      <div class="steps">
        ${L.scheduleSteps.map(([h, p], i) =>
          `<div class="card step"><span class="step-num">${i + 1}</span><div><h3>${h}</h3><p>${p}</p></div></div>`).join('')}
      </div>
    </section>
    ${disclaimerHtml()}
  </div>`;
}
function bindOrganic() {
  let t = store.get('orgType', 'all');
  const draw = () => { $('#orgGrid').innerHTML = COMPOSTS.filter(o => t === 'all' || o.type === t).map(orgCard).join(''); store.set('orgType', t); };
  $('#typeChips').addEventListener('click', e => { const b = e.target.closest('[data-type]'); if (!b) return; t = b.dataset.type; $('#typeChips').querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  draw();
}

function viewInput(id) {
  const o = inputById(id); if (!o) return notFound();
  const usedBy = CROPS.filter(c => c.compost.includes(o.id));
  return `<div class="fade-in">
    <a class="back" href="#/organic">${icon('back')}${L.backInputs}</a>
    ${(() => { const h = (MEDIA_INPUTS[o.id] || [])[0]; if (!h) return ''; const i = LB.push(h) - 1;
      return `<button type="button" class="org-banner" data-lb="${i}" aria-label="${esc(L.openPhoto)}"><img src="${esc(h.src || h.thumb)}" alt="${esc(capOf(h))}" onerror="this.parentNode.remove()"><span>${esc(h.credit || '')}</span></button>`; })()}
    <div class="org-hero">
      <span class="org-icon t-${o.type}">${icon(TYPE_ICON[o.type])}</span>
      <div class="detail-head">
        <span class="eyebrow">${INPUT_TYPES[o.type].name} · ${INPUT_TYPES[o.type].hint}</span>
        <h1>${esc(o.name)}</h1>
        <div class="ta">${esc(inputAlt(o))}</div>
        <p class="intro">${esc(o.summary)}</p>
        <div class="tags"><span class="tag">${icon('clock')}${esc(L.readyIn(o.time))}</span><span class="tag">${icon('check')}${esc(o.effort)}</span><span class="tag">${icon('scale')}${esc(L.cost(o.cost))}</span></div>
      </div>
    </div>

    <div class="org-layout">
      <div class="mini-stack">
        <section>
          <div class="section-head"><div><h2>${L.need}</h2><p>${esc(L.oneBatch(o.batch.label))}</p></div></div>
          <div class="card"><table class="ing">${o.ingredients.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</table></div>
        </section>
        <section class="section" style="margin-top:28px">
          <div class="section-head"><div><h2>${L.howMake}</h2></div></div>
          <div class="card" style="padding:22px 20px"><ol class="howto">${o.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol></div>
        </section>
        ${videoBlock((VIDEOS.inputs || {})[o.id], L.watchMake, L.watchSub)}
        ${galleryBlock((MEDIA_INPUTS[o.id] || []).slice(1), L.photos, '')}
        <div class="ready">${icon('check')}<div><b>${L.howReady}</b><p>${esc(o.ready)}</p></div></div>
        <section class="section" style="margin-top:28px">
          <div class="section-head"><div><h2>${L.howUse}</h2><p>${esc(o.nutrients)}</p></div></div>
          <div class="card"><table class="use-table">${o.use.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</table></div>
        </section>
        <div class="two-col">
          <div class="card note-card"><span class="org-icon t-liquid">${icon('check')}</span><div><h3>${L.benefits}</h3><ul>${o.benefits.map(b => `<li>${esc(b)}</li>`).join('')}</ul></div></div>
          <div class="card note-card"><span class="org-icon t-seed">${icon('alert')}</span><div><h3>${L.careful}</h3><ul>${o.cautions.map(b => `<li>${esc(b)}</li>`).join('')}</ul></div></div>
        </div>
        <div class="card note-card"><span class="org-icon t-compost">${icon('clock')}</span><div><h3>${L.storage}</h3><p>${esc(o.storage)}</p></div></div>
      </div>
      <aside class="card calc" id="calc" aria-label="${L.forField}"></aside>
    </div>

    ${usedBy.length ? `<section class="section">
      <div class="section-head"><div><h2>${L.goodFor}</h2></div></div>
      <div class="rail">${usedBy.map(cropCard).join('')}</div>
    </section>` : ''}
    ${sourcesBlock(SOURCES.inputs[o.id])}
    ${disclaimerHtml()}
  </div>`;
}

// Scales every number in a quantity string ("5–10 L", "1,400 kg") by f.
function scaleQty(s, f) {
  if (!/\d/.test(s) || /^—$/.test(s)) return s;
  return s.replace(/(\d[\d,]*\.?\d*)/g, n => fmt(parseFloat(n.replace(/,/g, '')) * f));
}
function fmt(n) {
  if (n >= 100) return Math.round(n).toLocaleString('en-IN');
  if (n >= 10) return String(Math.round(n * 2) / 2);
  return String(Math.round(n * 10) / 10);
}
// Quantities that stay the same however big the batch (a starter handful, a base layer, one jar).
const FIXED_QTY = /handful|layer|bottle|கைப்பிடி|அடுக்கு|பாட்டில்|^1$/;
const AREA = { acre: 1, cent: 0.01, hectare: 2.471 };

function bindInput(id) {
  const o = inputById(id), el = $('#calc');
  const st = store.get('area', { v: 1, u: 'acre' });
  const draw = () => {
    const acres = Math.max(0, (parseFloat(st.v) || 0) * AREA[st.u]);
    const need = o.dose.amount * acres;
    const sameUnit = o.batch.unit === o.dose.unit;
    const f = sameUnit ? need / o.batch.amount : acres;
    const batches = sameUnit ? Math.max(1, Math.ceil(f - 1e-9)) : null;
    const showUnit = o.dose.unit === 't' && need < 1 ? `${fmt(need * 1000)} ${L.kg}` : `${fmt(need)} ${L.unit(fmt(need), o.dose.unit)}`;
    const what = L.what[o.type];
    const scaled = o.id !== 'green-manure' && sameUnit && acres > 0;
    $('#calcOut').innerHTML = acres > 0 ? `
      <div class="calc-out"><div class="big">${showUnit}</div><p>${L.forAcres(what, fmt(acres))}</p>
      ${batches ? `<p>${o.type === 'compost' ? L.makeUnits(batches, o.id) : f < 1 ? L.oneEnough(fmt(o.batch.amount / o.dose.amount)) : L.makeX(fmt(f), o.batch.unit === 'L' ? batches : 0, o.batch.amount)}</p>` : ''}</div>
      ${scaled ? `<table>${o.ingredients.filter(([, q]) => /\d/.test(q) && !FIXED_QTY.test(q)).map(([a, q]) => `<tr><td>${esc(a)}</td><td>${esc(scaleQty(q, f))}</td></tr>`).join('')}</table>
      <p class="muted">${L.scaledFor(fmt(f))}</p>` : ''}` : `<p class="empty">${L.enterSize}</p>`;
    store.set('area', st);
  };
  el.innerHTML = `<h2>${icon('scale')}${L.forField}</h2>
    <p class="muted" style="margin-top:6px;font-size:14px">${esc(o.dose.label)}</p>
    <div class="row"><input id="areaIn" type="number" inputmode="decimal" min="0" step="0.1" value="${esc(st.v)}" aria-label="${L.fieldSize}">
      <div class="seg" id="unitSeg">${Object.keys(AREA).map(u => `<button type="button" data-u="${u}" class="${u === st.u ? 'on' : ''}">${L.areaUnits[u]}</button>`).join('')}</div></div>
    <div id="calcOut"></div>`;
  $('#areaIn').addEventListener('input', e => { st.v = e.target.value; draw(); });
  $('#unitSeg').addEventListener('click', e => { const b = e.target.closest('[data-u]'); if (!b) return; st.u = b.dataset.u; $('#unitSeg').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  draw();
}

/* ---------- Plants added by the admin ---------- */
// The live API sits on Vercel; copies of the app elsewhere (the portfolio) read it from there.
const API = /vercel\.app$|localhost|127\.0\.0\.1/.test(location.hostname) && location.port !== '5240' ? '' : 'https://farmer-friend-kappa.vercel.app';
const builtInIds = new Set(CROPS.map(c => c.id));
function addCustomPlants(list) {
  if (!Array.isArray(list)) return false;
  let changed = false;
  for (const p of list) {
    if (!p || !p.id || builtInIds.has(p.id)) continue;
    const crop = { ...p, cat: CATEGORIES[p.cat] || BASE.cats[p.cat] ? p.cat : 'vegetable', custom: true,
      seasons: p.seasons?.length ? p.seasons : ['kharif'], sow: p.sow || [], harvest: p.harvest || [],
      steps: { prep: '', sow: '', water: '', feed: '', weed: '', harvest: '', ...p.steps }, pests: p.pests || [], tips: p.tips || [], compost: (p.compost || []).filter(id => COMPOSTS.some(o => o.id === id)) };
    delete crop.taText; delete crop.image; delete crop.sources;
    const i = CROPS.findIndex(c => c.id === p.id);
    if (i >= 0) { CROPS[i] = crop; BASE.crops[i] = structuredClone(crop); } else { CROPS.push(crop); BASE.crops.push(structuredClone(crop)); }
    if (p.image?.src) CROP_IMAGES[p.id] = p.image; else delete CROP_IMAGES[p.id];
    SOURCES.crops[p.id] = p.sources || [];
    // Only filled-in Tamil fields replace the English; lists must match the English length.
    const t = p.taText || {}, ta = {};
    for (const k of ['name', 'intro', 'days', 'soil', 'temp', 'rain', 'spacing', 'seed', 'yield', 'companion']) if (t[k]) ta[k] = t[k];
    if (t.steps && Object.values(t.steps).some(Boolean)) ta.steps = Object.fromEntries(Object.keys(crop.steps).map(k => [k, t.steps[k] || crop.steps[k]]));
    if (t.pests?.length === crop.pests.length) ta.pests = t.pests;
    if (t.tips?.length === crop.tips.length) ta.tips = t.tips;
    window.CROPS_TA = window.CROPS_TA || {};
    if (Object.keys(ta).length) window.CROPS_TA[p.id] = ta; else delete window.CROPS_TA[p.id];
    if (!crop.ta && ta.name) crop.ta = ta.name;
    changed = true;
  }
  // Drop plants the admin has deleted.
  const ids = new Set(list.map(p => p && p.id));
  for (let i = CROPS.length - 1; i >= 0; i--) if (CROPS[i].custom && !ids.has(CROPS[i].id)) { CROPS.splice(i, 1); BASE.crops.splice(i, 1); changed = true; }
  return changed;
}
async function loadCustomPlants() {
  const cached = store.get('customPlants');
  if (cached && addCustomPlants(cached)) applyLang();
  try {
    const list = await fetch(API + '/api/plants', { cache: 'no-store' }).then(r => r.ok ? r.json() : Promise.reject());
    store.set('customPlants', list);
    if (addCustomPlants(list)) { applyLang(); const y = scrollY; route(); scrollTo(0, y); }
  } catch {}
}

/* ---------- Any plant (iNaturalist + Wikipedia) ---------- */
const stripTags = h => String(h || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const libraryBySci = sci => CROPS.find(c => sci && c.sci && (sci.toLowerCase() === c.sci.toLowerCase() || sci.toLowerCase().startsWith(c.sci.toLowerCase() + ' ')));
const isTamil = s => /[\u0B80-\u0BFF]/.test(s || '');
async function worldSearch(q) {
  const u = l => `https://api.inaturalist.org/v1/taxa/autocomplete?q=${encodeURIComponent(q)}&iconic_taxa=Plantae&per_page=12&preferred_place_id=6681&locale=${l}`;
  const [en, ta] = await Promise.all([fetch(u('en')).then(r => r.json()), LANG === 'ta' || isTamil(q) ? fetch(u('ta')).then(r => r.json()) : { results: [] }]);
  // iNaturalist does not index Tamil names: map a Tamil word to English page titles through Tamil Wikipedia.
  if (isTamil(q) && !(en.results || []).length) {
    try {
      const w = await fetch(`https://ta.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrlimit=3&prop=langlinks&lllang=en&format=json&origin=*`).then(r => r.json());
      const titles = Object.values(w.query?.pages || {}).sort((a, b) => a.index - b.index).map(p => p.langlinks?.[0]?.['*']).filter(Boolean);
      for (const tl of titles) {
        const r = await fetch(u('en').replace(`q=${encodeURIComponent(q)}`, `q=${encodeURIComponent(tl)}`)).then(r => r.json());
        en.results = [...(en.results || []), ...(r.results || []).slice(0, 4)];
      }
    } catch {}
  }
  const taName = Object.fromEntries((ta.results || []).filter(t => isTamil(t.preferred_common_name)).map(t => [t.id, t.preferred_common_name]));
  const seen = new Set();
  return [...(en.results || []), ...(ta.results || [])].filter(t => t.default_photo && t.iconic_taxon_name === 'Plantae' && !libraryBySci(t.name) && !seen.has(t.id) && seen.add(t.id))
    .map(t => ({ ...t, en: isTamil(t.preferred_common_name) ? '' : t.preferred_common_name, taName: taName[t.id] || (isTamil(t.preferred_common_name) ? t.preferred_common_name : '') }));
}
const plantName = t => (LANG === 'ta' && t.taName) || t.en || t.taName || t.name;
const plantCard = t => `<a class="card crop-card" href="#/plant/${t.id}">
    <div class="crop-photo"><img src="${esc(t.default_photo.medium_url)}" alt="" loading="lazy"><span class="water-badge">${icon('search')}${L.worldBadge}</span></div>
    <div class="crop-body"><h3>${esc(plantName(t))}</h3><span class="ta sci">${esc(t.name)}</span>
      <span class="meta">${esc(L.ranks[t.rank] || t.rank)}</span></div></a>`;

function viewPlant(id) {
  return `<div class="fade-in" id="plantPage"><a class="back" href="#/crops">${icon('back')}${L.allCrops}</a>
    <div class="skeleton" style="height:320px;border-radius:22px"></div><div class="skeleton" style="height:120px;margin-top:16px"></div></div>`;
}
async function loadPlant(id) {
  const el = $('#plantPage'); if (!el) return;
  try {
    const get = l => fetch(`https://api.inaturalist.org/v1/taxa/${encodeURIComponent(id)}?locale=${l}&preferred_place_id=6681`).then(r => r.json()).then(r => r.results?.[0]);
    const [t, tt] = await Promise.all([get('en'), get('ta').catch(() => null)]);
    if (!t) throw 0;
    t.en = t.preferred_common_name; t.taName = isTamil(tt?.preferred_common_name) ? tt.preferred_common_name : '';
    const lib = libraryBySci(t.name);
    if (lib) { location.replace('#/crop/' + lib.id); return; }
    let summary = stripTags(t.wikipedia_summary), wiki = t.wikipedia_url, wikiLang = 'en';
    if (LANG === 'ta' && wiki) {
      try {
        const title = decodeURIComponent(wiki.split('/wiki/')[1] || '');
        const ll = await fetch(`https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=ta&format=json&origin=*&titles=${encodeURIComponent(title)}`).then(r => r.json());
        const taTitle = Object.values(ll.query?.pages || {})[0]?.langlinks?.[0]?.['*'];
        if (taTitle) {
          const sm = await fetch(`https://ta.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(taTitle)}`).then(r => r.json());
          if (sm.extract) { summary = sm.extract; wiki = sm.content_urls?.desktop?.page || wiki; wikiLang = 'ta'; if (!t.taName && isTamil(sm.title)) t.taName = sm.title; }
        }
      } catch {}
    }
    const photos = (t.taxon_photos || []).slice(0, 8).map(x => ({ src: x.photo.large_url || x.photo.medium_url, thumb: x.photo.medium_url, credit: x.photo.attribution }));
    const hero = photos[0];
    if (!$('#plantPage')) return;
    LB = [];
    el.innerHTML = `<a class="back" href="#/crops">${icon('back')}${L.allCrops}</a>
      <div class="detail-hero">
        <figure class="detail-photo" style="margin:0">${hero ? `<img src="${esc(hero.src)}" alt="${esc(plantName(t))}"><figcaption>${esc(hero.credit)}</figcaption>` : ''}</figure>
        <div class="detail-head">
          <span class="eyebrow">${L.worldEyebrow}</span>
          <h1>${esc(plantName(t))}</h1>
          ${LANG === 'ta' && t.taName && t.en ? `<div class="ta">${esc(t.en)}</div>` : LANG === 'en' && t.taName ? `<div class="ta">${esc(t.taName)}</div>` : ''}
          <div class="sci">${esc(t.name)}${t.ancestors?.find(a => a.rank === 'family') ? ` · ${esc(t.ancestors.find(a => a.rank === 'family').name)}` : ''}</div>
          ${summary ? `<p class="intro">${esc(summary)}</p>${wikiLang === 'en' && LANG === 'ta' ? `<p class="muted" style="font-size:13px;margin-top:6px">${L.noTamilWiki}</p>` : ''}` : `<p class="intro">${L.noSummary}</p>`}
          <div class="tags" style="margin-top:14px">${wiki ? `<a class="tag" href="${esc(wiki)}" target="_blank" rel="noopener">${icon('next')}Wikipedia</a>` : ''}<a class="tag" href="https://www.inaturalist.org/taxa/${t.id}" target="_blank" rel="noopener">${icon('next')}iNaturalist</a></div>
        </div>
      </div>
      <div class="note-card card" style="margin-top:22px"><span class="org-icon t-seed">${icon('alert')}</span><div><h3>${L.worldNoteTitle}</h3><p>${L.worldNote}</p></div></div>
      ${galleryBlock(photos.slice(1), L.photos, '')}
      ${disclaimerHtml()}`;
    bindMedia();
  } catch {
    if ($('#plantPage')) $('#plantPage').innerHTML = `<a class="back" href="#/crops">${icon('back')}${L.allCrops}</a><h1 class="page-title">${L.worldFail}</h1>`;
  }
}

const notFound = () => `<div class="fade-in"><a class="back" href="#/">${icon('back')}${L.home}</a><h1 class="page-title">${L.notFound}</h1></div>`;

/* ---------- Router ---------- */
function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  const [a, b, c] = parts;
  let html, after, tab;
  LB = [];
  if (!a) { html = viewHome(); after = () => { loadWeather(); bindHomeSearch(); }; tab = 'home'; }
  else if (a === 'seasons') { html = b === 'month' ? viewSeasons(null, +c) : viewSeasons(b); tab = 'seasons'; after = () => bindSeasons(b === 'month'); }
  else if (a === 'crops') { html = viewCrops(); after = bindCrops; tab = 'crops'; }
  else if (a === 'crop') { html = viewCrop(b); tab = 'crops'; }
  else if (a === 'plant') { html = viewPlant(b); tab = 'crops'; after = () => loadPlant(b); }
  else if (a === 'organic' && b) { html = viewInput(b); after = () => bindInput(b); tab = 'compost'; }
  else if (a === 'sources') { html = viewSources(); }
  else if (a === 'organic' || a === 'compost') { html = viewOrganic(); after = bindOrganic; tab = 'compost'; }
  else html = notFound();
  app.innerHTML = html;
  bindMedia();
  document.querySelectorAll('.tabs a').forEach(x => x.classList.toggle('on', x.dataset.tab === tab));
  const t = tab && tab !== 'home' ? `${L.titles[tab]} · FarmerFriend` : 'FarmerFriend';
  document.title = a === 'crop' && cropById(b) ? `${cropById(b).name} · FarmerFriend` : a === 'organic' && inputById(b) ? `${inputById(b).name} · FarmerFriend` : t || 'FarmerFriend';
  after && after();
  if (!(a === 'seasons' && b === 'month')) window.scrollTo(0, 0);
}
function bindHomeSearch() {
  $('#homeSearch').addEventListener('submit', e => {
    e.preventDefault();
    const q = $('#hq').value.trim(); if (!q) return;
    store.set('cropFilter', { cat: 'all', season: 'all', q });
    location.hash = '#/crops';
  });
}
// Runs of consecutive months as [start, length], wrapping Dec → Jan into two pieces.
function monthRuns(months) {
  const set = new Set(months), runs = [];
  for (let mm = 1; mm <= 12; mm++) {
    if (!set.has(mm) || set.has(mm - 1)) continue;
    let n = 1; while (set.has(mm + n)) n++;
    runs.push([mm, n]);
  }
  return runs;
}
const runLabel = (lab, months) => monthRuns(months).map(([st, n]) => n === 1 ? L.monthsShort[st - 1] : `${L.monthsShort[st - 1]} – ${L.monthsShort[st + n - 2]}`).join(', ');
// Months until the crop's next sowing month (0 = sow now).
const untilSow = (c, m) => Math.min(...c.sow.map(x => (x - m + 12) % 12), 99);

function renderCalendar() {
  const el = $('#calWrap'); if (!el) return;
  const m = nowMonth(), filt = store.get('calCat', 'all'), sort = store.get('calSort', 'group');
  const q = ($('#calQ')?.value || '').trim().toLowerCase();
  let list = CROPS.filter(c => (filt === 'all' || c.cat === filt) &&
    (!q || [c.name, c.ta, enName(c.id), c.sci].some(x => x && x.toLowerCase().includes(q))));
  if (sort === 'az') list.sort((a, b) => a.name.localeCompare(b.name, L.locale));
  if (sort === 'soon') list.sort((a, b) => untilSow(a, m) - untilSow(b, m) || a.name.localeCompare(b.name, L.locale));
  $('#calCount').textContent = L.countOf(list.length, CROPS.length);
  const seasonBand = `<div class="cal2-row cal2-band"><span class="cal2-name"></span>
      <span class="band kharif" style="grid-column:7 / span 4">${SEASONS.kharif.name}</span>
      <span class="band rabi" style="grid-column:11 / span 3">${SEASONS.rabi.name}</span>
      <span class="band rabi" style="grid-column:2 / span 2">${SEASONS.rabi.name}</span>
      <span class="band zaid" style="grid-column:4 / span 3">${SEASONS.zaid.name}</span></div>`;
  const head = `<div class="cal2-row cal2-head"><span class="cal2-name">${L.crop}</span>${L.monthsShort.map((x, i) =>
    `<span class="mh ${i + 1 === m ? 'cur' : ''}" style="grid-column:${i + 2}">${x}</span>`).join('')}</div>`;
  const bars = (months, cls, lab) => monthRuns(months).map(([st, n]) => {
    const wrapL = st === 1 && months.includes(12), wrapR = st + n - 1 === 12 && months.includes(1);
    return `<i class="bar ${cls}${wrapL ? ' wl' : ''}${wrapR ? ' wr' : ''}" style="grid-column:${st + 1} / span ${n}" title="${esc(lab)}: ${esc(runLabel(lab, months))}"></i>`;
  }).join('');
  const row = c => {
    const p = CROP_IMAGES[c.id], soon = untilSow(c, m);
    return `<a class="cal2-row crop" href="#/crop/${c.id}">
      <span class="cal2-name"><span class="thumb">${p ? `<img src="${esc(p.thumb)}" alt="" loading="lazy">` : `<span class="ph">${esc(c.name[0])}</span>`}${soon === 0 ? `<i class="sow-dot" title="${esc(L.sowThisMonth)}"></i>` : ''}</span>
        <span><b>${esc(c.name)}</b><small>${esc(altName(c) || '')}</small></span></span>
      <span class="now-col" style="grid-column:${m + 1}"></span>
      <span class="lane s">${bars(c.sow, 's', L.sowRow)}</span>
      <span class="lane h">${c.harvest.length ? bars(c.harvest, 'h', L.harvestRow) : `<i class="bar long" style="grid-column:2 / span 12">${esc(c.days)}</i>`}</span>
    </a>`;
  };
  let body;
  if (sort === 'group' && filt === 'all' && !q) {
    body = Object.keys(CATEGORIES).map(k => { const g = list.filter(c => c.cat === k); return g.length ? `<div class="cal2-group">${esc(CATEGORIES[k])} <span>${g.length}</span></div>${g.map(row).join('')}` : ''; }).join('');
  } else body = list.map(row).join('');
  el.innerHTML = `<div class="cal2-scroll"><div class="cal2-table">${seasonBand}${head}${body || `<p class="empty" style="padding:18px">${L.noMatch}</p>`}</div></div>`;
  // Bring the current month into view when the table is wider than the screen.
  const sc = el.querySelector('.cal2-scroll'), mh = el.querySelector('.mh.cur'), nm = el.querySelector('.cal2-head .cal2-name');
  if (sc && mh && nm && sc.scrollWidth > sc.clientWidth) sc.scrollLeft = Math.max(0, mh.offsetLeft - nm.offsetWidth - mh.offsetWidth * 2);
}

function bindSeasons(scrollToMonth) {
  if (scrollToMonth) $('#month').scrollIntoView({ block: 'start' });
  renderCalendar();
  document.querySelectorAll('[data-calcat]').forEach(b => b.addEventListener('click', () => {
    store.set('calCat', b.dataset.calcat);
    document.querySelectorAll('[data-calcat]').forEach(x => x.classList.toggle('on', x === b));
    renderCalendar();
  }));
  $('#calSort')?.addEventListener('click', e => {
    const b = e.target.closest('[data-sort]'); if (!b) return;
    store.set('calSort', b.dataset.sort);
    $('#calSort').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    renderCalendar();
  });
  $('#calQ')?.addEventListener('input', renderCalendar);
}
window.addEventListener('hashchange', route);

/* ---------- Location ---------- */
const dlg = $('#placeDialog');
function setPlace(p) { store.set('place', p); $('#placeName').textContent = p.mine ? L.myFarm : p.name; dlg.close(); if (!location.hash || location.hash === '#/') route(); }
applyLang();
$('#placeName').textContent = place().mine ? L.myFarm : place().name;
$('#langBtn').addEventListener('click', () => {
  LANG = LANG === 'ta' ? 'en' : 'ta'; store.set('lang', LANG); applyLang();
  $('#placeName').textContent = place().mine ? L.myFarm : place().name;
  const y = window.scrollY; route(); window.scrollTo(0, y);
});
$('#placeBtn').addEventListener('click', () => { $('#placeResults').innerHTML = ''; $('#placeInput').value = ''; dlg.showModal(); });
$('#locateBtn').addEventListener('click', () => {
  if (!navigator.geolocation) return;
  $('#locateBtn').lastChild.textContent = L.finding;
  navigator.geolocation.getCurrentPosition(
    pos => { $('#locateBtn').lastChild.textContent = L.useLoc; setPlace({ name: 'My farm', mine: true, admin: '', lat: +pos.coords.latitude.toFixed(3), lon: +pos.coords.longitude.toFixed(3) }); },
    () => { $('#locateBtn').lastChild.textContent = L.blocked; },
    { timeout: 10000 });
});
let searchT;
$('#placeInput').addEventListener('input', e => {
  clearTimeout(searchT);
  const q = e.target.value.trim(); if (q.length < 2) { $('#placeResults').innerHTML = ''; return; }
  searchT = setTimeout(async () => {
    try {
      const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=6&language=en&name=${encodeURIComponent(q)}`).then(r => r.json());
      const list = (r.results || []).sort((a, b) => (b.country_code === 'IN') - (a.country_code === 'IN'));
      $('#placeResults').innerHTML = list.map((p, i) => `<li><button type="button" data-i="${i}">${esc(p.name)}<small>${esc([p.admin2, p.admin1, p.country].filter(Boolean).join(', '))}</small></button></li>`).join('') || `<li class="empty">${L.noPlaces}</li>`;
      $('#placeResults').onclick = ev => { const b = ev.target.closest('[data-i]'); if (!b) return; const p = list[+b.dataset.i]; setPlace({ name: p.name, admin: p.admin1 || '', lat: p.latitude, lon: p.longitude }); };
    } catch { $('#placeResults').innerHTML = `<li class="empty">${L.needNet}</li>`; }
  }, 300);
});

route();
loadCustomPlants();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
