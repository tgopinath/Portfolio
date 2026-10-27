(() => {
  const { INBOXES, TAGS, dockets } = window.TIB;
  const $ = (s, el = document) => el.querySelector(s);
  const stage = $('#stage'), barLeft = $('#barLeft');

  // ---------- State ----------
  const store = (() => { try { return JSON.parse(localStorage.getItem('tib-proto') || '{}'); } catch (e) { return {}; } })();
  const state = {
    view: store.view || 'vertical',        // vertical | sheet | kanban | grid | settings
    lastView: store.lastView || 'vertical',
    mode: store.mode || 'light',
    theme: store.theme || '#1a73e8',
    bg: store.bg || 'none',
    bgDark: store.bgDark ?? 35,
    bgBlur: store.bgBlur ?? 0,
    tab: 'open',
    nav: 'assigned',
    selected: 1,
    checked: new Set(),
    hiddenCols: new Set(),
    inboxFilter: new Set(INBOXES.map((i) => i.id)),
    modal: null,
    discussOpen: false,
    discussions: { 1: [{ who: 'Gopinath thandapani', text: 'Reg : TIB View types' }, { who: 'Gopinath thandapani', text: 'Hi' }] },
  };
  const save = () => { try { localStorage.setItem('tib-proto', JSON.stringify({ view: state.view, lastView: state.lastView, mode: state.mode, theme: state.theme, bg: state.bg, bgDark: state.bgDark, bgBlur: state.bgBlur })); } catch (e) {} };

  // ---------- Icons ----------
  const svg = (d, s = 15, w = 1.8) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const I = {
    assigned: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c.8-3.4 3-5 6-5s5.2 1.6 6 5M16 11l2 2 4-4"/>',
    others: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c.8-3.4 3-5 6-5s5.2 1.6 6 5M17 8h5M19.5 5.5 22 8l-2.5 2.5"/>',
    following: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c.8-3.4 3-5 6-5s5.2 1.6 6 5"/>',
    shared: '<path d="M7 4v13a3 3 0 0 0 3 3h10M17 16l3 4-3 4M4 7l3-3 3 3"/>',
    drafts: '<path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/>',
    sent: '<path d="m22 2-7 20-4-9-9-4z"/>',
    snoozed: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M5 3 2 6M22 6l-3-3"/>',
    spam: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    unread: '<rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="18" cy="6" r="3" fill="#e5534b" stroke="none"/>',
    discussion: '<path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12z"/>',
    team: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 19c.7-3 2.8-4.5 6-4.5s5.3 1.5 6 4.5M15.5 14.5c2.5 0 4.5 1.3 5.2 4"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
    sort: '<path d="M7 4v16M3 8l4-4 4 4M14 6h7M14 12h5M14 18h3"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    columns: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11M15 9v11"/>',
    archive: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10h14V9M10 13h4"/>',
    snooze: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/>',
    more: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
    reply: '<path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 6 6v5"/>',
    replyAll: '<path d="M7 14 2 9l5-5M12 14 7 9l5-5M7 9h7a6 6 0 0 1 6 6v5"/>',
    forward: '<path d="m15 14 5-5-5-5M20 9H10a6 6 0 0 0-6 6v5"/>',
    print: '<path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M7 14h10v7H7z"/>',
    pin: '<circle cx="12" cy="7" r="4"/><path d="M12 11v10"/>',
    follow: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c.8-3.4 3-5 6-5 1.4 0 2.6.3 3.6 1M18 14v6M15 17h6"/>',
    chat: '<path d="M21 11.5a7.5 7.5 0 0 1-11 6.6L4 19.5l1.4-4.6A7.5 7.5 0 1 1 21 11.5z"/>',
    down: '<path d="m6 9 6 6 6-6"/>', up: '<path d="m18 15-6-6-6 6"/>',
    right: '<path d="m9 6 6 6-6 6"/>', left: '<path d="m15 6-6 6 6 6"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
    ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>',
    clip: '<path d="M21.4 11.1 12.2 20.3a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>',
    smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/>',
    send: '<path d="m22 2-7 20-4-9-9-4z"/>',
  };
  const CH = {
    mail: (c = '#1a73e8') => `<svg class="ch" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.9"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>`,
    whatsapp: () => `<svg class="ch" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#25d366"/><path d="M8.5 7.5c.3-.3.8-.3 1 .1l.8 1.7c.1.3 0 .6-.2.8l-.5.5c.6 1.3 1.6 2.3 2.9 2.9l.5-.5c.2-.2.5-.3.8-.2l1.7.8c.4.2.4.7.1 1-.9.9-2.2 1.2-3.3.6-1.9-1-3.5-2.6-4.5-4.5-.6-1.1-.3-2.4.6-3.3z" fill="#fff"/></svg>`,
    twitter: () => `<svg class="ch" viewBox="0 0 24 24"><path fill="#1d9bf0" d="M22 6c-.7.3-1.5.5-2.3.6.8-.5 1.5-1.3 1.8-2.2-.8.5-1.7.8-2.6 1a4 4 0 0 0-6.9 3.7A11.4 11.4 0 0 1 3.7 4.9a4 4 0 0 0 1.2 5.4c-.7 0-1.3-.2-1.8-.5 0 2 1.4 3.6 3.2 4-.6.2-1.2.2-1.8.1.5 1.6 2 2.8 3.8 2.8A8 8 0 0 1 2 18.3 11.4 11.4 0 0 0 8.2 20c7.4 0 11.5-6.2 11.5-11.5v-.5c.9-.6 1.6-1.3 2.3-2z"/></svg>`,
    facebook: () => `<svg class="ch" viewBox="0 0 24 24"><path fill="#1877f2" d="M14 8h3V4h-3c-2.8 0-4.5 1.8-4.5 4.6V11H7v4h2.5v9h4v-9h3l.5-4h-3.5V9c0-.6.4-1 1-1z"/></svg>`,
  };
  const chIcon = (d) => CH[d.ch](d.unread ? '#1a73e8' : '#7f8792');
  const COLORS = ['#c0784f', '#5b7fa8', '#7c6aa6', '#4f9a7c', '#b0656e', '#8a7a52', '#5f8f9e', '#a35f8f'];
  const initials = (n) => n.replace(/@.*/, '').split(/[\s._]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  const color = (n) => COLORS[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
  const avatar = (n, cls = '') => `<span class="avatar ${cls}" style="background:${color(n)}" title="${n}">${initials(n)}</span>`;
  const tagbar = (d) => d.tags.length ? `<span class="tagbar" aria-label="Tags: ${d.tags.map((t) => TAGS[t].name).join(', ')}">${d.tags.map((t) => `<i style="background:${TAGS[t].color}"></i>`).join('')}</span>` : '';
  const inboxName = (id) => INBOXES.find((i) => i.id === id).name;
  const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- Filtering ----------
  const TABS = [['unassigned', 'Unassigned'], ['open', 'Open'], ['archived', 'Archived'], ['snoozed', 'Snoozed'], ['trash', 'Trash'], ['spam', 'Spam']];
  const visible = () => dockets.filter((d) => d.status === state.tab && state.inboxFilter.has(d.inbox));
  const byId = (id) => dockets.find((d) => d.id === id);

  // ---------- Sidebar ----------
  function renderSide() {
    const items = [
      ['assigned', 'Assigned to me'], ['others', 'Assigned to others'], ['following', 'Following'], ['shared', 'Shared with me'],
      ['drafts', 'Drafts'], ['sent', 'Sent', 1], ['snoozed', 'Snoozed'], ['spam', 'Spam'], ['trash', 'Trash', 1], ['unread', 'Unread', 2008], ['discussion', 'Discussion'],
    ];
    $('#sideNav').innerHTML =
      items.map(([id, label, n]) => `<button class="nav-item ${state.nav === id && state.view !== 'settings' ? 'is-on' : ''}" data-nav="${id}">${svg(I[id], 16)}${label}${n ? `<span class="count">${n}</span>` : ''}</button>`).join('') +
      `<div class="nav-head">${svg(I.team, 15)}Teams</div>
       <div class="team">${svg(I.down, 12, 2.4)}<span class="team__dot">J</span>JAMBAV</div>` +
      INBOXES.map((i) => `<button class="nav-item nav-item--inbox" data-nav="inbox-${i.id}">${CH[i.ch]('#e5534b')}${i.name}${i.count ? `<span class="count">${i.count}</span>` : ''}</button>`).join('') +
      `<div class="nav-head">${svg(I.tag, 15)}Tags</div>` +
      ['progress', 'almost', 'official', 'important'].map((t) => `<button class="nav-item"><span class="tag-dot" style="background:${TAGS[t].color}"></span>${TAGS[t].name}</button>`).join('');
  }
  $('#sideNav').addEventListener('click', (e) => {
    const b = e.target.closest('[data-nav]');
    if (!b) return;
    state.nav = b.dataset.nav;
    if (state.view === 'settings') setView(state.lastView); else renderSide();
  });

  // ---------- Top bar ----------
  function renderBar() {
    if (openPop && barLeft.contains(openPop.anchor)) closePop();
    if (state.view === 'settings') { barLeft.innerHTML = window.TIBSettings ? window.TIBSettings.bar() : ''; return; }
    if (state.view === 'kanban') { barLeft.innerHTML = window.TIBKanban ? window.TIBKanban.bar() : ''; return; }
    const list = visible();
    const n = state.checked.size;
    const allOn = n && list.every((d) => state.checked.has(d.id));
    const master = `<button class="check-btn" data-master aria-label="${n ? 'Clear selection' : 'Select all'}"><span class="check ${allOn ? 'is-on' : n ? 'is-mixed' : ''}"></span></button>`;
    if (n) {
      barLeft.innerHTML = `${master}<div class="bulk"><button class="act" data-bulk="archived">${svg(I.archive)}Archive</button><button class="act" data-bulk="snoozed">${svg(I.snooze)}Snooze</button><button class="act" data-bulk="tags">${svg(I.tag)}Tags</button><button class="act" data-bulk="trash">${svg(I.trash)}Trash</button><span class="sep"></span><button class="icon-btn" aria-label="More">${svg(I.down, 14)}</button><span class="bulk__note">${String(n).padStart(2, '0')} docket${n > 1 ? 's are' : ' is'} selected from <b>${TABS.find((t) => t[0] === state.tab)[1]}</b> tab · <button data-show-selected>Show selected</button></span></div>`;
    } else {
      barLeft.innerHTML = `${master}${TABS.map(([id, l]) => `<button class="tab ${state.tab === id ? 'is-on' : ''}" data-tab="${id}">${l}</button>`).join('')}
        <button class="icon-btn" aria-label="Sort">${svg(I.sort, 17)}</button>
        ${state.view === 'sheet' ? `<button class="icon-btn" data-cols aria-label="Show or hide columns" aria-expanded="false">${svg(I.columns, 17)}</button>` : ''}
        <span class="sep"></span><button class="icon-btn" aria-label="Search">${svg(I.search, 17)}</button>`;
    }
  }
  barLeft.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) { state.tab = t.dataset.tab; state.checked.clear(); const l = visible(); state.selected = l[0]?.id || null; render(); return; }
    if (e.target.closest('[data-master]')) {
      const l = visible();
      if (state.checked.size) state.checked.clear(); else l.forEach((d) => state.checked.add(d.id));
      render(); return;
    }
    const b = e.target.closest('[data-bulk]');
    if (b) {
      if (b.dataset.bulk === 'tags') { toast('Tag picker is out of scope for this prototype'); return; }
      moveDockets([...state.checked], b.dataset.bulk); return;
    }
    if (e.target.closest('[data-show-selected]')) { const first = [...state.checked][0]; const el = stage.querySelector(`[data-id="${first}"]`); el?.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    const c = e.target.closest('[data-cols]');
    if (c) { togglePop(c, colsPop); return; }
  });

  const LABEL = { archived: 'Archived', snoozed: 'Snoozed', trash: 'Moved to trash', open: 'Moved to Open', unassigned: 'Moved to Unassigned' };
  function moveDockets(ids, to) {
    const prev = ids.map((id) => [id, byId(id).status]);
    ids.forEach((id) => { byId(id).status = to; });
    state.checked.clear();
    if (ids.includes(state.selected)) state.selected = visible()[0]?.id || null;
    closeModal();
    render();
    toast(`${ids.length > 1 ? ids.length + ' dockets' : '1 docket'} ${LABEL[to].toLowerCase()}`, () => { prev.forEach(([id, s]) => { byId(id).status = s; }); render(); });
  }

  // ---------- Popovers ----------
  let openPop = null;
  function togglePop(anchor, build) {
    if (openPop && openPop.anchor === anchor) { closePop(); return; }
    closePop();
    const el = document.createElement('div');
    el.className = 'pop';
    el.innerHTML = build();
    document.body.appendChild(el);
    const r = anchor.getBoundingClientRect();
    el.style.top = r.bottom + 6 + 'px';
    el.style.left = Math.min(window.innerWidth - el.offsetWidth - 10, Math.max(10, r.left - 20)) + 'px';
    anchor.setAttribute('aria-expanded', 'true');
    openPop = { el, anchor, build };
    el.addEventListener('click', (e) => popClick(e, build));
    el.addEventListener('input', (e) => popInput(e));
  }
  function closePop() { if (!openPop) return; openPop.anchor.setAttribute('aria-expanded', 'false'); openPop.el.remove(); openPop = null; }
  function refreshPop() { if (openPop) { const keep = openPop.el.querySelector('input')?.value; openPop.el.innerHTML = openPop.build(); if (keep != null) { const i = openPop.el.querySelector('input'); i.value = keep; popInput({ target: i }); } } }
  document.addEventListener('mousedown', (e) => { if (openPop && !openPop.el.contains(e.target) && !openPop.anchor.contains(e.target)) closePop(); });

  const COLS = [
    ['type', 'Type', true], ['from', 'from', true], ['inbox', 'Inbox'], ['subject', 'Subject', true], ['content', 'Content'],
    ['tags', 'Tags'], ['attachments', 'Attachments'], ['assigned', 'Assigned to'], ['discussion', 'Discussion'], ['time', 'Time', true],
  ];
  const colsPop = () => `<h4>Show/Hide column</h4><p>You can show or hide your<br>Columns as your wish</p>` +
    COLS.filter((c) => !c[2]).map(([id, l]) => `<button class="pop-row" data-col="${id}">${l}<span class="toggle ${state.hiddenCols.has(id) ? '' : 'is-on'}"></span></button>`).join('');
  const inboxPop = () => `<label class="pop-search">${svg(I.search, 14)}<input placeholder="Search inbox" aria-label="Search inbox"></label>` +
    INBOXES.map((i) => `<button class="pop-row" data-inbox="${i.id}"><span style="display:flex;gap:8px;align-items:center">${CH[i.ch]('#e5534b')}${i.name}</span><span class="toggle ${state.inboxFilter.has(i.id) ? 'is-on' : ''}"></span></button>`).join('');
  function popClick(e) {
    const c = e.target.closest('[data-col]');
    if (c) { const id = c.dataset.col; state.hiddenCols.has(id) ? state.hiddenCols.delete(id) : state.hiddenCols.add(id); refreshPop(); renderStage(); return; }
    const i = e.target.closest('[data-inbox]');
    if (i) {
      const id = i.dataset.inbox;
      if (state.inboxFilter.has(id)) { if (state.inboxFilter.size === 1) { toast('Keep at least one inbox on'); return; } state.inboxFilter.delete(id); } else state.inboxFilter.add(id);
      refreshPop(); renderStage(); return;
    }
  }
  function popInput(e) {
    if (!e.target.matches('.pop-search input')) return;
    const q = e.target.value.toLowerCase();
    openPop.el.querySelectorAll('[data-inbox]').forEach((r) => { r.hidden = !inboxName(r.dataset.inbox).toLowerCase().includes(q); });
  }

  // ---------- Docket card (split + grid) ----------
  function card(d, { grid = false } = {}) {
    const sel = !grid && d.id === state.selected;
    return `<div class="dk ${sel ? 'is-sel' : ''} ${state.checked.has(d.id) ? 'is-checked is-sel' : ''} ${d.unread ? 'is-unread' : ''}" data-id="${d.id}" role="button" tabindex="0" aria-label="${escapeHtml(d.subject)} from ${escapeHtml(d.from)}" ${sel ? 'aria-current="true"' : ''}>
      <span class="dk__ch">${chIcon(d)}</span>
      <button class="dk__check check-btn" data-check="${d.id}" aria-label="Select docket" style="position:absolute;left:4px;top:8px"><span class="check ${state.checked.has(d.id) ? 'is-on' : ''}"></span></button>
      <div class="meta"><span class="sender">${d.from}</span>${d.thread && grid ? `<span class="thread-count">${d.thread}</span>` : ''}<span class="dot"></span><span class="inbox-name">${inboxName(d.inbox)}</span></div>
      <div class="dk__row"><span class="subject">${d.subject}</span>${d.discussions ? `<span class="disc">${String(d.discussions).padStart(2, '0')} ${svg(I.chat, 14)}</span>` : ''}</div>
      <div class="dk__row"><span class="snippet">${d.preview}</span></div>
      ${d.thread && !grid ? `<span class="thread-count dk__thread">${d.thread}</span>` : ''}
      <div class="dk__foot"><span class="date">${d.date}</span>${tagbar(d)}${avatar(d.assignee)}</div>
    </div>`;
  }

  function preview(d, { inModal = false } = {}) {
    if (!d) return `<div class="empty"><div><b>No docket selected</b>Pick a docket from the list to read it here.</div></div>`;
    const list = visible();
    const idx = list.findIndex((x) => x.id === d.id);
    return `<div class="pv">
      <div class="pv__head">
        <div class="pv__title"><span style="color:var(--muted)">${svg(I.pin, 15)}</span>${CH.mail()}<h2>${d.subject}</h2>
          ${inModal ? '' : `<button class="icon-btn" data-discuss aria-label="Open discussions">${svg(I.chat, 19)}</button>`}</div>
        <div class="pv__tools">
          <span class="updown"><button data-step="-1" aria-label="Previous docket" ${idx <= 0 ? 'disabled' : ''}>${svg(I.up, 12, 2.4)}</button><button data-step="1" aria-label="Next docket" ${idx < 0 || idx >= list.length - 1 ? 'disabled' : ''}>${svg(I.down, 12, 2.4)}</button></span>
          <button class="act" data-move="archived">${svg(I.archive)}Archive</button>
          <button class="act" data-move="snoozed">${svg(I.snooze)}Snooze</button>
          <button class="act" data-tags>${svg(I.tag)}Tags</button>
          <button class="act" data-move="trash">${svg(I.trash)}Trash</button>
          <span class="sep"></span><button class="icon-btn" aria-label="More actions">${svg(I.more)}</button>
          <span class="grow"></span>
          <button class="btn" data-follow>${svg(I.follow)}${d.following ? 'Following' : 'Follow'}</button>
          <button class="btn" data-assign>${d.status === 'unassigned' ? 'Assign' : 'Reassign'}</button>
          ${inModal ? `<button class="icon-btn ${state.discussOpen ? 'is-on' : ''}" data-discuss aria-label="${state.discussOpen ? 'Hide' : 'Show'} discussions" aria-pressed="${state.discussOpen}">${svg(I.chat, 19)}</button>` : ''}
        </div>
        <div class="pv__tags">${d.tags.map((t) => `<span class="chip-tag" style="background:${TAGS[t].color}1f;color:${TAGS[t].color}">${TAGS[t].name}</span>`).join('')}</div>
      </div>
      <div class="pv__body">
        <article class="mail">
          <div class="mail__head"><span class="avatar avatar--gt">GT</span>
            <div class="mail__who"><b>Gopinath Thandapani</b> <span class="addr">&lt;tgopinath1992@...&gt; · SENT · ${d.date}</span><div class="to">To &lt;${d.from.includes('@') ? d.from : 'kcampbell@innotype.gov'}&gt;</div></div>
            <div class="mail__ic"><button class="icon-btn" data-reply aria-label="Reply">${svg(I.reply)}</button><button class="icon-btn" data-reply aria-label="Reply all">${svg(I.replyAll)}</button><button class="icon-btn" data-reply aria-label="Forward">${svg(I.forward)}</button><button class="icon-btn" aria-label="Print">${svg(I.print)}</button></div>
          </div>
          <div class="mail__content"><h3>${d.subject}</h3>${d.body.map((p) => `<p>${p}</p>`).join('')}</div>
          <div class="mail__foot"><button class="act" data-reply>${svg(I.reply)}Reply</button><button class="act" data-reply>${svg(I.replyAll)}Reply all</button><button class="act" data-reply>${svg(I.forward)}Forward</button></div>
        </article>
        <div data-composer></div>
        ${d.thread ? `<article class="mail"><div class="mail__head"><span class="avatar avatar--gt">GT</span><div class="mail__who"><b>Gopinath Thandapani</b> <span class="addr">&lt;tgopinath1992..&gt; · SENT · ${d.date}</span><div class="to">To &lt;kcampbell@innotype.gov&gt;</div><p style="margin-top:6px">Shared team inboxes can be a very simple yet effective way to make it easier for your team to ..</p></div></div><div style="height:10px"></div></article>` : ''}
      </div>
    </div>`;
  }

  // Shared preview actions (split reader + modal)
  function previewClick(e, d, root) {
    if (!d) return false;
    const m = e.target.closest('[data-move]');
    if (m) { moveDockets([d.id], m.dataset.move); return true; }
    const s = e.target.closest('[data-step]');
    if (s) {
      const l = visible(); const i = l.findIndex((x) => x.id === d.id) + Number(s.dataset.step);
      if (l[i]) { if (state.modal) openModal(l[i].id); else select(l[i].id, true); }
      return true;
    }
    if (e.target.closest('[data-follow]')) { d.following = !d.following; toast(d.following ? 'You’re following this docket' : 'Unfollowed'); rerenderPreview(); return true; }
    if (e.target.closest('[data-assign]')) { toast('Assignee picker is out of scope for this prototype'); return true; }
    if (e.target.closest('[data-tags]')) { toast('Tag picker is out of scope for this prototype'); return true; }
    if (e.target.closest('[data-reply]')) {
      const slot = root.querySelector('[data-composer]');
      slot.innerHTML = slot.innerHTML ? '' : `<div class="composer-note">Reply composer opens here, inline with the thread.</div>`;
      return true;
    }
    if (e.target.closest('[data-discuss]')) {
      if (state.modal) { state.discussOpen = !state.discussOpen; renderModal(); }
      else openModal(d.id, true);
      return true;
    }
    return false;
  }
  function rerenderPreview() { if (state.modal) renderModal(); else renderStage(); }

  // ---------- Views ----------
  function renderVertical() {
    const list = visible();
    if (!list.find((d) => d.id === state.selected)) state.selected = list[0]?.id || null;
    stage.innerHTML = `<div class="split" style="--list-w:${state.listW || 380}px">
      <div class="list-wrap"><div class="list ${state.checked.size ? 'is-selecting' : ''}" id="list">${list.length ? list.map((d) => card(d)).join('') : emptyState()}</div></div>
      <div class="grip" id="grip" role="separator" aria-orientation="vertical" aria-label="Resize list" tabindex="0"></div>
      <div class="reader" id="reader">${preview(byId(state.selected))}</div>
    </div>`;
    const listEl = $('#list');
    listEl.addEventListener('scroll', gotoPill);
    if (state.scrollTo) { listEl.querySelector(`[data-id="${state.scrollTo}"]`)?.scrollIntoView({ block: 'nearest' }); state.scrollTo = null; }
    gotoPill();
    // Resizable split
    const grip = $('#grip');
    grip.addEventListener('pointerdown', (e) => {
      grip.setPointerCapture(e.pointerId); grip.classList.add('is-drag');
      const x0 = e.clientX, w0 = state.listW || 380;
      const move = (ev) => { state.listW = Math.max(300, Math.min(620, w0 + ev.clientX - x0)); stage.firstElementChild.style.setProperty('--list-w', state.listW + 'px'); gotoPill(); };
      const up = () => { grip.classList.remove('is-drag'); grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); };
      grip.addEventListener('pointermove', move); grip.addEventListener('pointerup', up);
    });
    grip.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      state.listW = Math.max(300, Math.min(620, (state.listW || 380) + (e.key === 'ArrowRight' ? 20 : -20)));
      stage.firstElementChild.style.setProperty('--list-w', state.listW + 'px');
    });
  }

  // "Go to selected docket" pill when the selected card scrolls out of view
  function gotoPill() {
    const listEl = $('#list'); if (!listEl) return;
    listEl.parentElement.querySelector('.goto')?.remove();
    const sel = listEl.querySelector('.dk[aria-current]'); if (!sel) return;
    const top = sel.offsetTop, bottom = top + sel.offsetHeight;
    const vTop = listEl.scrollTop, vBottom = vTop + listEl.clientHeight;
    let dir = null;
    if (bottom < vTop + 10) dir = 'up'; else if (top > vBottom - 10) dir = 'down';
    if (!dir) return;
    const b = document.createElement('button');
    b.className = 'goto' + (dir === 'down' ? ' goto--down' : '');
    b.style[dir === 'up' ? 'top' : 'bottom'] = '0';
    b.innerHTML = `Go to selected docket ${svg(dir === 'up' ? '<path d="M12 19V5M5 12l7-7 7 7"/>' : '<path d="M12 5v14M5 12l7 7 7-7"/>', 12, 2.2)}`;
    b.addEventListener('click', () => sel.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    listEl.parentElement.appendChild(b);
  }

  function emptyState() {
    return `<div class="empty"><div><b>Nothing in ${TABS.find((t) => t[0] === state.tab)[1]}</b>Dockets you move here will show up in this list.</div></div>`;
  }

  function renderSheet() {
    const list = visible();
    const cols = COLS.filter((c) => !state.hiddenCols.has(c[0]));
    const filtered = state.inboxFilter.size < INBOXES.length;
    const head = cols.map(([id, l]) => id === 'inbox'
      ? `<th><button class="th-btn ${filtered ? 'is-filtered' : ''}" data-inbox-filter aria-expanded="false">${l} ${svg(filtered ? I.filter : I.down, 12, 2.2)}</button></th>`
      : `<th>${l}</th>`).join('');
    const cell = (d, id) => {
      switch (id) {
        case 'type': return `<td>${chIcon(d)}</td>`;
        case 'from': return `<td class="c-from">${d.from}${d.thread ? ` <span class="thread-count">${d.thread}</span>` : ''}</td>`;
        case 'inbox': return `<td>${inboxName(d.inbox)}</td>`;
        case 'subject': return `<td class="c-subject">${d.subject}</td>`;
        case 'content': return `<td>${d.preview}</td>`;
        case 'tags': return `<td>${tagbar(d)}</td>`;
        case 'attachments': return `<td>${d.attachment ? `<span class="att ${d.attachment.endsWith('zip') ? 'att--zip' : ''}"><i></i>${d.attachment}${d.attachment.endsWith('img') ? ' <small>3+</small>' : ''}</span>` : ''}</td>`;
        case 'assigned': return `<td><span class="person">${avatar(d.assignee)}${d.assignee}</span></td>`;
        case 'discussion': return `<td>${d.discussions ? `<span class="disc">${svg(I.chat, 14)} ${d.discussions}</span>` : ''}</td>`;
        case 'time': return `<td style="font-size:11px">${d.short}</td>`;
      }
    };
    stage.innerHTML = `<div class="sheet">${list.length ? `<table><thead><tr><th></th>${head}</tr></thead><tbody>${list.map((d) =>
      `<tr data-id="${d.id}" class="${state.checked.has(d.id) ? 'is-checked' : ''}" tabindex="0"><td><button class="check-btn" data-check="${d.id}" aria-label="Select docket"><span class="check ${state.checked.has(d.id) ? 'is-on' : ''}"></span></button></td>${cols.map((c) => cell(d, c[0])).join('')}</tr>`).join('')}</tbody></table>` : emptyState()}</div>`;
    const f = stage.querySelector('[data-inbox-filter]');
    f?.addEventListener('click', () => togglePop(f, inboxPop));
  }

  function renderGrid() {
    const list = visible();
    stage.innerHTML = `<div class="grid ${state.checked.size ? 'is-selecting' : ''}">${list.length ? list.map((d) => card(d, { grid: true })).join('') : emptyState()}</div>`;
  }

  // ---------- Selection + open ----------
  function select(id, scroll) {
    state.selected = id; byId(id).unread = false;
    if (scroll) state.scrollTo = id;
    renderStage();
  }
  stage.addEventListener('click', (e) => {
    const chk = e.target.closest('[data-check]');
    if (chk) { e.stopPropagation(); const id = Number(chk.dataset.check); state.checked.has(id) ? state.checked.delete(id) : state.checked.add(id); render(); return; }
    if (state.view === 'vertical') {
      const reader = $('#reader');
      if (reader && reader.contains(e.target)) { previewClick(e, byId(state.selected), reader); return; }
    }
    const item = e.target.closest('[data-id]');
    if (!item || !['vertical', 'sheet', 'grid'].includes(state.view)) return;
    const id = Number(item.dataset.id);
    if (state.checked.size) { state.checked.has(id) ? state.checked.delete(id) : state.checked.add(id); render(); return; }
    if (state.view === 'vertical') select(id); else openModal(id);
  });
  stage.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-id]')) { e.preventDefault(); e.target.click(); }
    if (state.view === 'vertical' && (e.key === 'ArrowDown' || e.key === 'ArrowUp') && e.target.matches('.dk')) {
      e.preventDefault(); const sib = e.key === 'ArrowDown' ? e.target.nextElementSibling : e.target.previousElementSibling; sib?.focus();
    }
  });

  // ---------- Modal ----------
  const modal = $('#modal'), scrim = $('#scrim');
  let lastFocus = null;
  function openModal(id, withDiscuss) {
    if (!state.modal) lastFocus = document.activeElement;
    state.modal = id; byId(id).unread = false;
    if (withDiscuss != null) state.discussOpen = withDiscuss;
    renderModal();
    modal.hidden = false; scrim.hidden = false;
    modal.querySelector('.modal__close').focus();
  }
  function renderModal() {
    const d = byId(state.modal); if (!d) return;
    const msgs = state.discussions[d.id] || [];
    modal.classList.toggle('has-side', state.discussOpen);
    modal.innerHTML = `<button class="modal__close" data-close aria-label="Close preview">${svg(I.x, 14, 2.4)}</button>${preview(d, { inModal: true })}` +
      (state.discussOpen ? `<aside class="discuss" aria-label="Discussions">
        <div class="discuss__tabs" role="tablist"><button class="is-on" role="tab" aria-selected="true">Discussions</button><button role="tab" data-ext>Extensions</button></div>
        <div class="discuss__list" id="dlist">${msgs.length ? msgs.map((m) => `<div class="bubble">${avatar('Gopinath Thandapani')}<div><small>${m.who}</small><p>${escapeHtml(m.text)}</p></div></div>`).join('') + '<div class="discuss__day">DEC 24, 2021</div>' : '<div class="ext-empty">Discuss this docket privately with your team. Customers never see it.</div>'}</div>
        <form class="discuss__input" id="dform"><input id="dinput" placeholder="Enter your comment here..." aria-label="Comment"><div><span style="display:flex;gap:8px">${svg(I.clip, 15)}${svg(I.smile, 15)}</span><button class="send-btn" aria-label="Send comment">${svg(I.send, 13, 2)}</button></div></form>
      </aside>` : '');
    if (state.discussOpen) {
      $('#dform').addEventListener('submit', (e) => {
        e.preventDefault(); const v = $('#dinput').value.trim(); if (!v) return;
        (state.discussions[d.id] ||= []).push({ who: 'Gopinath thandapani', text: v });
        d.discussions = (state.discussions[d.id] || []).length;
        renderModal(); $('#dinput').focus();
      });
    }
  }
  function closeModal() {
    if (!state.modal) return;
    state.modal = null; modal.hidden = true; scrim.hidden = true;
    renderStage(); lastFocus?.focus?.();
  }
  modal.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) { closeModal(); return; }
    if (e.target.closest('[data-ext]')) { toast('Extensions are out of scope for this prototype'); return; }
    previewClick(e, byId(state.modal), modal);
  });
  scrim.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (openPop) closePop(); else if (state.modal) closeModal(); else if (!$('#qs').hidden) closeQS();
  });

  // ---------- Quick settings ----------
  const qs = $('#qs'), gear = $('#gear');
  const VIEWS = [
    ['vertical', 'Vertical', '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>'],
    ['sheet', 'Sheet', '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14h18M9 4v16M15 4v16"/>'],
    ['kanban', 'Kanban', '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/>'],
    ['grid', 'Grid', '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>'],
    ['horizontal', 'Horizontal', '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 11h18"/>'],
  ];
  const THEMES = ['#1a73e8', '#e5534b', '#17a96b', '#e9a81c'];
  function renderQS() {
    qs.innerHTML = `<div class="qs__head"><b>Quick Settings</b><button data-more-settings>${svg(I.ext, 13)}More Settings</button></div>
      <section class="qs__sec"><h4>View</h4><p>Choose how you’d want your interface to appear</p>
        <div class="views">${VIEWS.map(([id, l, d]) => `<button class="view-opt ${state.view === id || (state.view === 'settings' && state.lastView === id) ? 'is-on' : ''}" data-view="${id}" aria-pressed="${state.view === id}"><span>${svg(d, 20, 1.6)}</span>${l}</button>`).join('')}</div></section>
      <section class="qs__sec"><h4>Appearance</h4><p>Choose how you’d want your interface to appear</p>
        ${[['light', 'Light Mode'], ['dark', 'Dark Mode'], ['auto', 'Auto Mode']].map(([id, l]) => `<button class="radio ${state.mode === id ? 'is-on' : ''}" data-mode="${id}" role="radio" aria-checked="${state.mode === id}"><i></i>${l}</button>`).join('')}</section>
      <section class="qs__sec"><h4>Theme</h4><p>View your inboxes in your favorite colors</p>
        <div class="swatches">${THEMES.map((c) => `<button class="swatch ${state.theme === c ? 'is-on' : ''}" style="background:${c}" data-theme="${c}" aria-label="Theme ${c}" aria-pressed="${state.theme === c}"></button>`).join('')}<button class="more" data-more-settings>More</button></div></section>
      <section class="qs__sec"><h4>Set Background Image</h4><p>Select an image to set as the background of your left panel</p>
        <div class="bg-thumbs">${Object.entries(BG).slice(0, 3).map(([id, g]) => `<button class="${state.bg === id ? 'is-on' : ''}" data-qs-bg="${id}" style="background:${g || 'var(--side)'}" aria-label="Background ${id}" aria-pressed="${state.bg === id}"></button>`).join('')}</div></section>`;
  }
  function openQS() { renderQS(); qs.hidden = false; gear.setAttribute('aria-expanded', 'true'); qs.querySelector('.view-opt.is-on')?.focus(); }
  function closeQS() { qs.hidden = true; gear.setAttribute('aria-expanded', 'false'); }
  gear.addEventListener('click', () => (qs.hidden ? openQS() : closeQS()));
  document.addEventListener('mousedown', (e) => { if (!qs.hidden && !qs.contains(e.target) && !gear.contains(e.target)) closeQS(); });
  qs.addEventListener('click', (e) => {
    const v = e.target.closest('[data-view]');
    if (v) {
      if (v.dataset.view === 'horizontal') { toast('Horizontal split isn’t part of this prototype'); return; }
      setView(v.dataset.view); renderQS(); return;
    }
    const m = e.target.closest('button[data-mode]');
    if (m) { state.mode = m.dataset.mode; applyMode(); save(); renderQS(); return; }
    const bgb = e.target.closest('[data-qs-bg]');
    if (bgb) { state.bg = bgb.dataset.qsBg; applyMode(); renderQS(); return; }
    const t = e.target.closest('[data-theme]');
    if (t) { state.theme = t.dataset.theme; applyMode(); save(); renderQS(); return; }
    if (e.target.closest('[data-more-settings]')) { closeQS(); setView('settings'); }
  });
  function applyMode() {
    const dark = state.mode === 'dark' || (state.mode === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.mode = dark ? 'dark' : 'light';
    document.documentElement.style.setProperty('--brand', state.theme);
    // Background image for the left panel (gradients stand in for the photo backgrounds in the design)
    const g = BG[state.bg];
    const side = document.querySelector('.side');
    if (side) {
      side.classList.toggle('has-bg', !!g);
      side.style.setProperty('--side-bg', g || 'none');
      side.style.setProperty('--side-dark', (state.bgDark ?? 35) / 100);
      side.style.setProperty('--side-blur', (state.bgBlur ?? 0) + 'px');
    }
    save();
  }
  const BG = { none: '', dusk: 'linear-gradient(160deg,#2b3a67 0%,#7b4b94 55%,#f08a5d 100%)', forest: 'linear-gradient(160deg,#16302b 0%,#2d6a4f 60%,#95d5b2 100%)', sand: 'linear-gradient(160deg,#5c4033,#b08968 60%,#ede0d4)', ocean: 'linear-gradient(160deg,#03045e,#0077b6 55%,#90e0ef)', rose: 'linear-gradient(160deg,#590d22,#a4133c 55%,#ffb3c1)', slate: 'linear-gradient(160deg,#0f172a,#334155 60%,#94a3b8)', citrus: 'linear-gradient(160deg,#3a5a40,#a3b18a 50%,#f2cc8f)' };

  function setView(v) {
    if (v !== 'settings') { state.lastView = v; document.body.classList.remove('in-settings'); }
    state.view = v; state.checked.clear(); closePop(); closeModal(); save(); render();
  }

  // ---------- Toast ----------
  let tt;
  function toast(msg, undo, kind) {
    const el = $('#toast');
    el.classList.toggle('toast--ok', kind === 'ok');
    el.innerHTML = `<span>${msg}</span>${undo ? '<button>Undo</button>' : ''}`;
    el.classList.add('is-on');
    if (undo) el.querySelector('button').onclick = () => { undo(); el.classList.remove('is-on'); };
    clearTimeout(tt); tt = setTimeout(() => el.classList.remove('is-on'), 4000);
  }

  // ---------- Render ----------
  function renderStage() {
    ({ vertical: renderVertical, sheet: renderSheet, grid: renderGrid,
       kanban: () => window.TIBKanban ? window.TIBKanban.render(stage) : null,
       settings: () => window.TIBSettings ? window.TIBSettings.render(stage) : null })[state.view]();
  }
  function render() { renderSide(); renderBar(); renderStage(); }

  // Expose helpers for the kanban + settings modules
  window.TIBApp = { state, applyMode, svg, I, CH, chIcon, avatar, tagbar, inboxName, escapeHtml, byId, visible, openModal, toast, togglePop, closePop, render, renderBar, renderStage, setView, card, TABS };

  applyMode();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyMode);
  document.addEventListener('DOMContentLoaded', render);
  if (document.readyState !== 'loading') setTimeout(render);
})();
