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
  return `<a class="card org-card" href="#/organic/${o.id}">
    <span class="org-icon t-${o.type}">${icon(TYPE_ICON[o.type])}</span>
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
  const calCrops = CROPS.filter(c => filt === 'all' || c.cat === filt);
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

      <section class="section">
        <div class="section-head"><div><h2>${L.calendar}</h2><p>${L.calendarSub}</p></div></div>
        <div class="chips scroll" style="margin-bottom:12px">
          ${[['all', L.allCrops], ...Object.entries(CATEGORIES)].map(([k, v]) => `<button class="chip ${k === filt ? 'on' : ''}" data-calcat="${k}">${v}</button>`).join('')}
        </div>
        <div class="legend" style="margin-bottom:10px"><span><i style="background:var(--green)"></i>${L.sowing}</span><span><i style="background:var(--sun)"></i>${L.harvest}</span><span><i style="background:var(--green-soft)"></i>${L.thisMonth}</span></div>
        <div class="card cal"><div class="cal-table">
          <div class="cal-row head"><span class="cal-name">${L.crop}</span>${L.monthsShort.map(x => `<span>${x}</span>`).join('')}</div>
          ${calCrops.map(c => `<div class="cal-row"><a class="cal-name" href="#/crop/${c.id}">${esc(c.name)}</a>${MONTHS.map((_, i) =>
            `<span class="cal-cell ${i + 1 === m ? 'cur' : ''}">${c.sow.includes(i + 1) ? '<i class="s"></i>' : ''}${c.harvest.includes(i + 1) ? '<i class="h"></i>' : ''}</span>`).join('')}</div>`).join('')}
        </div></div>
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
    ${disclaimerHtml()}
  </div>`;
}
function bindCrops() {
  const st = store.get('cropFilter', { cat: 'all', season: 'all', q: '' });
  const draw = () => {
    const q = st.q.trim().toLowerCase();
    const list = CROPS.filter(c => (st.cat === 'all' || c.cat === st.cat) && (st.season === 'all' || c.seasons.includes(st.season)) &&
      (!q || [c.name, c.ta, enName(c.id), c.sci, CATEGORIES[c.cat], BASE.cats[c.cat]].some(x => x.toLowerCase().includes(q))));
    $('#cropGrid').innerHTML = list.map(cropCard).join('') || `<p class="empty">${L.noMatch}</p>`;
    $('#count').textContent = L.countOf(list.length, CROPS.length);
    store.set('cropFilter', st);
  };
  $('#q').addEventListener('input', e => { st.q = e.target.value; draw(); });
  $('#catChips').addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (!b) return; st.cat = b.dataset.cat; $('#catChips').querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  $('#seasonChips').addEventListener('click', e => { const b = e.target.closest('[data-season]'); if (!b) return; st.season = b.dataset.season; $('#seasonChips').querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  draw();
}

function viewCrop(id) {
  const c = cropById(id); if (!c) return notFound();
  const m = nowMonth(), p = CROP_IMAGES[c.id];
  const F = L.facts;
  const facts = [[F.season, c.seasons.map(s => SEASONS[s].name).join(', ')], [F.days, c.days], [F.soil, c.soil], [F.ph, c.ph],
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
        <div class="tags">${seasonTags(c)}<span class="tag">${icon('drop')}${L.water[c.water]}</span>${sowingNow ? `<span class="tag" style="background:var(--green-soft);color:var(--green)">${icon('check')}${L.sowThisMonth}</span>` : ''}</div>
      </div>
    </div>
    <div class="facts">${facts.map(([k, v]) => `<div class="fact"><small>${k}</small><b>${esc(v)}</b></div>`).join('')}</div>

    <section class="section">
      <div class="section-head"><div><h2>${L.calendar}</h2><p>${esc(L.expectedYield(c.yield))}</p></div></div>
      <div class="card crop-cal"><div class="bars">
        <span></span>${L.monthsTiny.map((x, i) => `<span class="mn ${i + 1 === m ? 'cur' : ''}">${x}</span>`).join('')}
        ${row(L.sowRow, c.sow, 's')}${c.harvest.length ? row(L.harvestRow, c.harvest, 'h') : ''}
      </div>${c.harvest.length ? '' : `<p class="note">${esc(L.harvestAfter(c.days))}</p>`}</div>
    </section>

    <section class="section">
      <div class="section-head"><div><h2>${L.howToGrow}</h2><p>${L.howToGrowSub}</p></div></div>
      <div class="steps">${Object.entries(c.steps).map(([k, v], i) => `<div class="card step"><span class="step-num">${i + 1}</span><div><h3>${L.steps[k]}</h3><p>${esc(v)}</p></div></div>`).join('')}</div>
    </section>

    <section class="section">
      <div class="section-head"><div><h2>${L.pests}</h2><p>${L.pestsSub}</p></div></div>
      <div class="card pests">${c.pests.map(([n, t]) => `<div class="pest"><b>${icon('bug')}${esc(n)}</b><p>${esc(t)}</p></div>`).join('')}</div>
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

const notFound = () => `<div class="fade-in"><a class="back" href="#/">${icon('back')}${L.home}</a><h1 class="page-title">${L.notFound}</h1></div>`;

/* ---------- Router ---------- */
function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  const [a, b, c] = parts;
  let html, after, tab;
  if (!a) { html = viewHome(); after = loadWeather; tab = 'home'; }
  else if (a === 'seasons') { html = b === 'month' ? viewSeasons(null, +c) : viewSeasons(b); tab = 'seasons'; after = () => bindSeasons(b === 'month'); }
  else if (a === 'crops') { html = viewCrops(); after = bindCrops; tab = 'crops'; }
  else if (a === 'crop') { html = viewCrop(b); tab = 'crops'; }
  else if (a === 'organic' && b) { html = viewInput(b); after = () => bindInput(b); tab = 'compost'; }
  else if (a === 'sources') { html = viewSources(); }
  else if (a === 'organic' || a === 'compost') { html = viewOrganic(); after = bindOrganic; tab = 'compost'; }
  else html = notFound();
  app.innerHTML = html;
  document.querySelectorAll('.tabs a').forEach(x => x.classList.toggle('on', x.dataset.tab === tab));
  const t = tab && tab !== 'home' ? `${L.titles[tab]} · FarmerFriend` : 'FarmerFriend';
  document.title = a === 'crop' && cropById(b) ? `${cropById(b).name} · FarmerFriend` : a === 'organic' && inputById(b) ? `${inputById(b).name} · FarmerFriend` : t || 'FarmerFriend';
  after && after();
  if (!(a === 'seasons' && b === 'month')) window.scrollTo(0, 0);
}
function bindSeasons(scrollToMonth) {
  if (scrollToMonth) $('#month').scrollIntoView({ block: 'start' });
  document.querySelectorAll('[data-calcat]').forEach(b => b.addEventListener('click', () => {
    store.set('calCat', b.dataset.calcat);
    const y = window.scrollY; route(); window.scrollTo(0, y);
  }));
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
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
