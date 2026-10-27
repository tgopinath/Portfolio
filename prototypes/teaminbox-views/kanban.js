// Kanban view: status boards, show/hide boards, collapse, drag to move, drop-on-Open assigns.
(() => {
  const A = () => window.TIBApp;
  const { INBOXES, TAGS, MEMBERS } = window.TIB;
  const BOARDS = [
    { id: 'unassigned', name: 'Unassigned', color: '#d98cf0', drop: ['Unassign', 'from someone'] },
    { id: 'open', name: 'Open', color: '#2fa8f0', drop: ['Assign', 'someone'] },
    { id: 'archived', name: 'Archived', color: '#5ccb8a', drop: ['Archive', 'your docket'] },
    { id: 'snoozed', name: 'Snoozed', color: '#9b87f5', drop: ['Snooze', 'your docket'] },
    { id: 'trash', name: 'Trash', color: '#f5b320', drop: ['Trash', 'your docket'] },
    { id: 'spam', name: 'Spam', color: '#f27b7b', drop: ['Mark as spam', 'your docket'] },
  ];
  const k = { order: BOARDS.map((b) => b.id), hidden: new Set(), collapsed: new Set(), justMoved: null };
  const board = (id) => BOARDS.find((b) => b.id === id);
  let stageEl;

  function bar() {
    const { state, svg, I } = A();
    const n = state.checked.size;
    if (n) {
      const boards = new Set([...state.checked].map((id) => A().byId(id).status));
      const where = boards.size > 1 ? '<b>Various</b> boards' : `<b>${board([...boards][0]).name}</b> board`;
      return `<button class="check-btn" data-k-clear aria-label="Clear selection"><span class="check is-mixed"></span></button>
        <div class="bulk"><button class="act" data-k-bulk="archived">${svg(I.archive)}Archive</button><button class="act" data-k-bulk="snoozed">${svg(I.snooze)}Snooze</button><button class="act" data-k-bulk="tags">${svg(I.tag)}Tags</button><button class="act" data-k-bulk="trash">${svg(I.trash)}Trash</button>
        <span class="bulk__note">${String(n).padStart(2, '0')} docket${n > 1 ? 's are' : ' is'} selected from ${where}</span></div>`;
    }
    return `<button class="kb-boards" data-k-boards aria-expanded="false">All Boards ${svg(I.down, 12, 2.4)}</button>
      <span class="dot" style="margin:0 6px"></span><button class="icon-btn" aria-label="Sort">${svg(I.sort, 17)}</button><span class="sep"></span><button class="icon-btn" aria-label="Search">${svg(I.search, 17)}</button>`;
  }

  const boardsPop = () => `<h4>Show/Hide boards</h4><p>You can show or hide your<br>boards as your wish</p>` +
    k.order.map((id) => `<button class="pop-row" data-k-toggle="${id}"><span style="display:flex;gap:8px;align-items:center"><i class="kb-dot" style="background:${board(id).color}"></i>${board(id).name}</span><span class="toggle ${k.hidden.has(id) ? '' : 'is-on'}"></span></button>`).join('');

  function cardHtml(d) {
    const { state, chIcon, avatar, svg, I, inboxName } = A();
    const checked = state.checked.has(d.id);
    return `<div class="kc ${checked ? 'is-checked' : ''} ${k.justMoved === d.id ? 'is-new' : ''} ${d.unread ? 'is-unread' : ''}" data-kid="${d.id}" tabindex="0" role="button" aria-label="${A().escapeHtml(d.subject)}. Drag to move, or press Enter to open.">
      <div class="kc__row"><button class="check-btn kc__check" data-k-check="${d.id}" aria-label="Select docket"><span class="check ${checked ? 'is-on' : ''}"></span></button><span class="kc__ch">${chIcon(d)}</span>
        <span class="sender">${d.from}</span><span class="dot"></span><span class="inbox-name">${inboxName(d.inbox)}</span><span class="kc__date">${d.short}</span></div>
      <div class="kc__row"><span class="subject">${d.subject}</span>${d.discussions ? `<span class="disc">${String(d.discussions).padStart(2, '0')} ${svg(I.chat, 13)}</span>` : ''}</div>
      <div class="kc__row">${d.thread ? `<span class="thread-count">${d.thread}</span>` : ''}<span class="snippet">${d.preview}</span>${d.status === 'open' ? avatar(d.assignee) : ''}</div>
    </div>`;
  }

  function render(stage) {
    stageEl = stage;
    const { svg, I } = A();
    const dockets = window.TIB.dockets;
    const shown = k.order.filter((id) => !k.hidden.has(id));
    stage.innerHTML = `<div class="kb" id="kb">${shown.map((id) => {
      const b = board(id);
      const cards = dockets.filter((d) => d.status === id);
      if (k.collapsed.has(id)) {
        return `<section class="kb-col is-collapsed" data-board="${id}"><button class="kb-strip" data-k-expand="${id}" aria-label="Expand ${b.name}">${svg('<path d="M4 4v16M20 12H8M12 8l-4 4 4 4"/>', 14)}<i class="kb-dot" style="background:${b.color}"></i><span>${b.name}</span><small>${cards.length}</small></button></section>`;
      }
      return `<section class="kb-col" data-board="${id}" aria-label="${b.name} board">
        <header class="kb-head"><i class="kb-dot" style="background:${b.color}"></i>${b.name}<small>${cards.length}</small>
          <span class="kb-tools"><button class="icon-btn" data-k-collapse="${id}" aria-label="Collapse ${b.name}" title="Collapse">${svg('<path d="M20 4v16M4 12h12M12 8l4 4-4 4"/>', 14)}</button></span></header>
        <div class="kb-cards">${cards.map(cardHtml).join('') || '<p class="kb-empty">No dockets here</p>'}</div>
        <div class="kb-drop" aria-hidden="true"><span>Drop here to <b>${b.drop[0]}</b> ${b.drop[1]}</span></div>
      </section>`;
    }).join('')}</div><button class="kb-more" id="kbMore" hidden></button>`;
    const kb = stage.querySelector('#kb');
    kb.addEventListener('scroll', moreTab);
    requestAnimationFrame(moreTab);
    if (k.justMoved) { kb.querySelector(`[data-kid="${k.justMoved}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); setTimeout(() => { k.justMoved = null; kb.querySelector('.is-new')?.classList.remove('is-new'); }, 2400); }
  }

  // "View N more boards" tab
  function moreTab() {
    const kb = stageEl.querySelector('#kb'), btn = stageEl.querySelector('#kbMore');
    if (!kb || !btn) return;
    const right = kb.getBoundingClientRect().right;
    const off = [...kb.children].filter((c) => c.getBoundingClientRect().left > right - 40).length;
    btn.hidden = !off;
    btn.innerHTML = `View ${off} more board${off > 1 ? 's' : ''} ${A().svg(A().I.right, 12, 2.4)}`;
  }

  // ---------- Clicks ----------
  document.addEventListener('click', (e) => {
    const app = A(); if (!app || app.state.view !== 'kanban') return;
    const t = e.target;
    if (t.closest('[data-k-boards]')) { app.togglePop(t.closest('[data-k-boards]'), boardsPop); return; }
    const tog = t.closest('[data-k-toggle]');
    if (tog) {
      const id = tog.dataset.kToggle;
      if (k.hidden.has(id)) k.hidden.delete(id); else { if (k.order.length - k.hidden.size === 1) { app.toast('Keep at least one board on'); return; } k.hidden.add(id); }
      tog.querySelector('.toggle').classList.toggle('is-on', !k.hidden.has(id));
      render(stageEl); return;
    }
    if (t.closest('#kbMore')) { const kb = stageEl.querySelector('#kb'); kb.scrollBy({ left: kb.clientWidth * 0.8, behavior: 'smooth' }); return; }
    const col = t.closest('[data-k-collapse]'); if (col) { k.collapsed.add(col.dataset.kCollapse); render(stageEl); return; }
    const exp = t.closest('[data-k-expand]'); if (exp) { k.collapsed.delete(exp.dataset.kExpand); render(stageEl); return; }
    const chk = t.closest('[data-k-check]');
    if (chk) { const id = Number(chk.dataset.kCheck); app.state.checked.has(id) ? app.state.checked.delete(id) : app.state.checked.add(id); app.render(); return; }
    if (t.closest('[data-k-clear]')) { app.state.checked.clear(); app.render(); return; }
    const bulk = t.closest('[data-k-bulk]');
    if (bulk) {
      if (bulk.dataset.kBulk === 'tags') { app.toast('Tag picker is out of scope for this prototype'); return; }
      const ids = [...app.state.checked]; app.state.checked.clear(); move(ids, bulk.dataset.kBulk); return;
    }
  });
  document.addEventListener('keydown', (e) => {
    const app = A(); if (!app || app.state.view !== 'kanban') return;
    if (e.key === 'Enter' && e.target.matches('.kc')) app.openModal(Number(e.target.dataset.kid));
  });

  // ---------- Move + undo ----------
  const VERB = { unassigned: (n) => `Your docket is unassigned from <b>${n}</b>`, archived: () => '01 docket archived', snoozed: () => '01 docket snoozed', trash: () => '01 docket trashed', spam: () => 'Thread has been <b>Marked as Spam</b>' };
  function move(ids, to, assignee) {
    const app = A();
    const prev = ids.map((id) => { const d = app.byId(id); return [d, d.status, d.assignee]; });
    ids.forEach((id) => { const d = app.byId(id); d.status = to; if (assignee) d.assignee = assignee; });
    k.justMoved = ids[ids.length - 1];
    if (k.collapsed.has(to)) k.collapsed.delete(to);
    if (k.hidden.has(to)) k.hidden.delete(to);
    app.render();
    const msg = to === 'open' ? `Your docket is assigned to <b>${assignee}</b>` : ids.length > 1 ? `${String(ids.length).padStart(2, '0')} dockets moved to <b>${board(to).name}</b>` : VERB[to](prev[0][2]);
    app.toast(msg, () => { prev.forEach(([d, s, a]) => { d.status = s; d.assignee = a; }); k.justMoved = prev[0][0].id; app.render(); }, 'ok');
  }

  // ---------- Drag and drop (pointer events, so it works with mouse, pen and touch) ----------
  let drag = null;
  document.addEventListener('pointerdown', (e) => {
    const app = A(); if (!app || app.state.view !== 'kanban' || e.button !== 0) return;
    const card = e.target.closest('.kc'); if (!card || e.target.closest('[data-k-check]')) return;
    drag = { card, id: Number(card.dataset.kid), x0: e.clientX, y0: e.clientY, started: false, pid: e.pointerId };
  });
  document.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    if (!drag.started) {
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 6) return;
      start(e);
    }
    const r = drag.rect;
    drag.ghost.style.transform = `translate(${e.clientX - drag.dx}px, ${e.clientY - drag.dy}px) rotate(3deg)`;
    const kb = stageEl.querySelector('#kb');
    const kr = kb.getBoundingClientRect();
    drag.edge = e.clientX > kr.right - 60 ? 1 : e.clientX < kr.left + 40 ? -1 : 0;
    // Target board under the pointer
    drag.ghost.style.display = 'none';
    const under = document.elementFromPoint(e.clientX, e.clientY)?.closest('.kb-col');
    drag.ghost.style.display = '';
    const target = under && under.dataset.board !== drag.from ? under : null;
    stageEl.querySelectorAll('.kb-col.is-target').forEach((c) => c !== target && c.classList.remove('is-target'));
    if (target) target.classList.add('is-target');
    drag.target = target?.dataset.board || null;
    void r;
  });
  function start(e) {
    const r = drag.card.getBoundingClientRect();
    drag.started = true; drag.rect = r; drag.dx = e.clientX - r.left; drag.dy = e.clientY - r.top;
    drag.from = A().byId(drag.id).status;
    const g = drag.card.cloneNode(true);
    g.className = 'kc kc--ghost'; g.style.width = r.width + 'px';
    document.body.appendChild(g); drag.ghost = g;
    drag.card.classList.add('is-placeholder');
    document.body.classList.add('is-dragging');
    stageEl.querySelector('#kb').classList.add('is-dragging');
    const loop = () => { if (!drag) return; if (drag.edge) stageEl.querySelector('#kb').scrollLeft += drag.edge * 12; drag.raf = requestAnimationFrame(loop); };
    drag.raf = requestAnimationFrame(loop);
  }
  document.addEventListener('pointerup', (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    const d = drag; drag = null;
    if (!d.started) { A().openModal(d.id); return; }
    cancelAnimationFrame(d.raf);
    d.ghost.remove(); document.body.classList.remove('is-dragging');
    const kb = stageEl.querySelector('#kb'); kb.classList.remove('is-dragging');
    const to = d.target;
    if (!to) { d.card.classList.remove('is-placeholder'); stageEl.querySelectorAll('.is-target').forEach((c) => c.classList.remove('is-target')); return; }
    if (to === 'open') { assignModal(d.id); return; }
    move([d.id], to);
  });
  document.addEventListener('pointercancel', () => { if (drag?.started) { drag.ghost.remove(); document.body.classList.remove('is-dragging'); render(stageEl); } drag = null; });

  // ---------- Assign to modal ----------
  function assignModal(id) {
    const app = A();
    const wrap = document.createElement('div');
    wrap.className = 'scrim scrim--assign';
    const row = ([n, mail, me]) => `<button class="mem" data-assign-to="${n}">${app.avatar(n)}<span><b>${n}</b>${me ? ' <em>Me</em>' : ''}<small>${mail}</small></span><span class="mem__btn">Assign</span></button>`;
    wrap.innerHTML = `<div class="assign" role="dialog" aria-modal="true" aria-label="Assign to">
      <header><b>Assign to</b><button class="icon-btn" data-assign-close aria-label="Close">${app.svg(app.I.x, 14, 2.2)}</button></header>
      <label class="pop-search">${app.svg(app.I.search, 14)}<input placeholder="Search member" aria-label="Search member"></label>
      <div class="assign__list"><h5>Inbox members</h5>${MEMBERS.inbox.map(row).join('')}<h5>Org members</h5>${MEMBERS.org.map(row).join('')}</div></div>`;
    document.body.appendChild(wrap);
    const input = wrap.querySelector('input'); input.focus();
    const close = (assignee) => {
      wrap.remove();
      stageEl.querySelectorAll('.is-target').forEach((c) => c.classList.remove('is-target'));
      if (assignee) move([id], 'open', assignee === 'Gopinath T' ? 'Me' : assignee);
      else render(stageEl);
    };
    input.addEventListener('input', () => { const q = input.value.toLowerCase(); wrap.querySelectorAll('.mem').forEach((m) => { m.hidden = !m.dataset.assignTo.toLowerCase().includes(q); }); });
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap || e.target.closest('[data-assign-close]')) { close(); return; }
      const m = e.target.closest('[data-assign-to]'); if (m) close(m.dataset.assignTo);
    });
    wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  }

  window.TIBKanban = { bar, render };
})();
