// Settings: Personal (My Preferences, Snooze, Notification) and Organization (Dashboard, Teams, Org settings).
(() => {
  const A = () => window.TIBApp;
  const s = {
    tab: 'personal',
    page: 'prefs',
    team: 'sample',
    orgOpen: true,
    snoozes: [
      ['Contacts meeting', 'FRI JULY 16, 4:59 pm'], ['Analytics meeting', 'today 4:59 pm'], ['Settings meeting', 'tomorrow 10:30 am'],
      ['Reg : Profile page meeting', 'FRI JULY 23, 5.30 pm'], ['Reg : Debugging', 'tomorrow 12.20 pm'],
    ].map(([name, when], i) => ({ id: i + 1, name, when })),
    snoozeSel: new Set(),
    adding: false,
    prefs: { notify: false, password: false, sendArchive: false, conv: 'Newest on top', font: 'Lato', org: 'Jambav Workspace', lang: 'English' },
    tags: [], canned: [],
    form: null,
    members: [
      ['Alexander D', 'alexander.d@zohocorp.com', 'Team admin'], ['Stephen Walsh', 'stephen.w@zohocorp.com', 'Member'], ['Philip Turner', 'philip.t@zohocorp.com', 'Member'],
      ['Carl Ellis', 'carl.e@zohocorp.com', 'Member'], ['Harold Rodriguez', 'harold.r@zohocorp.com', 'Member'], ['Randy Henry', 'randy.h@zohocorp.com', 'Member'],
    ],
    weekend: ['Saturday', 'Sunday'],
    seq: 100,
  };
  const TEAMS = [['sample', '#Sample team', 'ST', '#f26b1d'], ['final', 'Final team', 'FT', '#3cc8b4'], ['avengers', 'Avengers', 'A', '#f4b400'], ['mail360', 'Mail360 Support', 'MS', '#4aa8e8'], ['zmail', 'Zoho mail support', 'ZM', '#b65bd6']];
  const TEAM_SUB = [['inboxes', 'Inboxes'], ['members', 'Members'], ['roles', 'Roles'], ['rules', 'Rules'], ['signature', 'Signature'], ['canned', 'Canned responses'], ['tags', 'Tags'], ['vacation', 'Vacation reply'], ['more', 'More settings']];
  const ORG_SUB = [['details', 'Details'], ['orgmembers', 'Members'], ['sender', 'Sender address'], ['deliver', 'Deliverability'], ['migration', 'Migration']];
  const BGS = [
    ['none', 'None', ''], ['dusk', 'Dusk', 'linear-gradient(160deg,#2b3a67 0%,#7b4b94 55%,#f08a5d 100%)'],
    ['forest', 'Forest', 'linear-gradient(160deg,#16302b 0%,#2d6a4f 60%,#95d5b2 100%)'], ['sand', 'Sand', 'linear-gradient(160deg,#5c4033,#b08968 60%,#ede0d4)'],
    ['ocean', 'Ocean', 'linear-gradient(160deg,#03045e,#0077b6 55%,#90e0ef)'], ['rose', 'Rose', 'linear-gradient(160deg,#590d22,#a4133c 55%,#ffb3c1)'],
    ['slate', 'Slate', 'linear-gradient(160deg,#0f172a,#334155 60%,#94a3b8)'], ['citrus', 'Citrus', 'linear-gradient(160deg,#3a5a40,#a3b18a 50%,#f2cc8f)'],
  ];
  const TAG_COLORS = ['#1a73e8', '#f08c2e', '#17a99b', '#e9b41c', '#e0504a', '#3fb36a', '#5c6bc0', '#a46ad8'];
  const DASH = [
    ['Manage org members', 'Add/Remove members to the organization.', 'Add member', 'orgmembers', '#cde6fa', true],
    ['Manage team', 'Create team for teammates to work together.', 'Add team', 'team', '#fce7a6'],
    ['Manage inbox', 'Create inbox for teammates to work together.', 'Add inbox', 'inboxes', '#f9c9b0'],
    ['Canned response', 'Save repeated replies and use them directly in your responses.', 'Create canned response', 'canned', '#e5c6f2'],
    ['Create signature', 'Have a common signature for every email that goes out from your inbox.', 'Add Signature', 'signature', '#c8eee2'],
    ['Vacation reply', 'Create predefined replies when you are on vacation.', 'Add reply', 'vacation', '#d3f0c4'],
    ['Create rules', 'Create rules for messages', 'Add rule', 'rules', '#d9d4f5'],
    ['Deliverability Status', 'You can view or change your deliverability status here.', null, 'deliver', '#f3dfb8'],
    ['Sender address', 'Choose which addresses your team can send from.', 'Add sender address', 'sender', '#e3f3c0'],
  ];

  const esc = (x) => A().escapeHtml(String(x));
  const toggle = (on, attr, label) => `<button class="toggle ${on ? 'is-on' : ''}" ${attr} role="switch" aria-checked="${!!on}" aria-label="${label}"></button>`;
  const select = (key, value, opts, label) => `<label class="st-select"><span class="sr">${label}</span><select data-pref="${key}">${opts.map((o) => `<option ${o === value ? 'selected' : ''}>${o}</option>`).join('')}</select></label>`;
  const row = (title, desc, control) => `<div class="st-row"><div><h4>${title}</h4><p>${desc}</p></div><div class="st-row__ctl">${control}</div></div>`;

  // ---------- Nav ----------
  function nav() {
    const item = (id, label, extra = '', depth = 0) => `<button class="st-nav__item depth-${depth} ${s.page === id ? 'is-on' : ''}" data-page="${id}">${extra}${label}</button>`;
    if (s.tab === 'personal') return item('prefs', 'My Preferences') + item('snooze', 'Snooze') + item('notify', 'Notification');
    const { svg, I } = A();
    return item('dashboard', 'Dashboard') +
      `<div class="st-nav__group"><button class="st-nav__item ${s.page === 'teams' ? 'is-on' : ''}" data-page="team">${svg(I.right, 12, 2.4)}Teams<span class="st-nav__plus" aria-hidden="true">+</span></button>` +
      TEAMS.map(([id, name, ini, c]) => {
        const open = s.team === id && TEAM_SUB.some(([p]) => p === s.page) || (s.team === id && s.page === 'team');
        return `<button class="st-nav__item depth-1 ${s.team === id && s.page === 'team' ? 'is-on' : ''}" data-team="${id}"><span class="st-ini" style="background:${c}">${ini}</span>${name}</button>` +
          (open ? TEAM_SUB.map(([p, l]) => item(p, l, '', 2)).join('') : '');
      }).join('') + '</div>' +
      `<button class="st-nav__item" data-org-toggle aria-expanded="${s.orgOpen}">${svg(s.orgOpen ? I.down : I.right, 12, 2.4)}Organisation settings</button>` +
      (s.orgOpen ? ORG_SUB.map(([p, l]) => item(p, l, '', 1)).join('') : '') +
      item('timeline', 'Timeline');
  }

  // ---------- Pages ----------
  const pages = {
    prefs() {
      const st = A().state;
      return `<h1 class="st-title">My Preferences</h1><div class="st-card">
        ${row('Theme', 'Pick how TeamInbox looks on this device.', `<div class="st-themes">${[['light', 'Light mode'], ['dark', 'Dark mode']].map(([m, l]) => `<button class="st-theme ${st.mode === m ? 'is-on' : ''}" data-mode="${m}" aria-pressed="${st.mode === m}"><span class="st-theme__img st-theme__img--${m}"><i></i><i></i><i></i></span><span class="st-theme__lab">${l}<span class="toggle ${st.mode === m ? 'is-on' : ''}" aria-hidden="true"></span></span></button>`).join('')}</div>`)}
        ${row('Desktop notification', 'Get notified about incoming messages even when on a different tab.', toggle(s.prefs.notify, 'data-ptoggle="notify"', 'Desktop notification'))}
        ${row('Theme color', 'View your inboxes in your favorite colors.', `<div class="st-swatches">${['#1a73e8', '#ef5b5b', '#1db47a', '#f0c020'].map((c) => `<button class="st-swatch ${st.theme === c ? 'is-on' : ''}" style="background:${c}" data-color="${c}" aria-label="Theme color ${c}" aria-pressed="${st.theme === c}"></button>`).join('')}</div>`)}
        <div class="st-row st-row--stack"><div><h4>Set background</h4><p>Select one image from the below images to set as teaminbox background.</p></div>
          <div class="st-bgs">${BGS.map(([id, l, g]) => `<button class="st-bg ${(st.bg || 'none') === id ? 'is-on' : ''}" data-bg="${id}" style="${g ? `background:${g}` : ''}" aria-pressed="${(st.bg || 'none') === id}"><span>${l}</span></button>`).join('')}</div>
          ${st.bg && st.bg !== 'none' ? `<div class="st-bgtune"><div><h5>Adjust image darkness</h5><p>Slide to increase image darkness</p><input type="range" min="0" max="80" step="1" value="${st.bgDark ?? 35}" data-bgdark aria-label="Image darkness"></div><div><h5>Adjust blur</h5><p>Slide to blur background image.</p><input type="range" min="0" max="12" step="1" value="${st.bgBlur ?? 0}" data-bgblur aria-label="Blur"></div></div>` : ''}
        </div>
        ${row('Conversation view', 'Select the order in which you want to view conversations.', select('conv', s.prefs.conv, ['Newest on top', 'Oldest on top'], 'Conversation view'))}
        ${row('Choose font', 'Select the font used across your inbox.', select('font', s.prefs.font, ['Lato', 'Inter', 'Roboto'], 'Font'))}
        ${row('Default Organisation', 'Select the organisation you want to land on after logging in', select('org', s.prefs.org, ['Jambav Workspace', 'Zoho Mail'], 'Default organisation'))}
        ${row('Display Language', 'Select a default language for your interface', select('lang', s.prefs.lang, ['English', 'தமிழ்', 'हिन्दी', 'Español'], 'Display language'))}
        ${row('Enable password', 'Protect all your downloaded files with passwords', toggle(s.prefs.password, 'data-ptoggle="password"', 'Enable password'))}
        ${row('Enable send and archive as default', 'Have the send and archive option as default while composing', toggle(s.prefs.sendArchive, 'data-ptoggle="sendArchive"', 'Send and archive'))}
      </div>`;
    },
    snooze() {
      const n = s.snoozeSel.size, all = n && n === s.snoozes.length;
      return `<h1 class="st-title">My Preferences</h1>
        <div class="st-sub"><b>Snooze</b>${n ? `<span class="st-sub__right"><button class="st-link" data-snz-all>${all ? 'Deselect all' : 'Select all'}</button><span class="sep"></span><button class="st-link st-link--danger" data-snz-del>${all ? 'Delete all' : 'Delete'}</button></span>` : `<span class="dot"></span><button class="st-link" data-snz-add>+Add new Snooze</button>`}</div>
        <div class="st-card st-card--list">
          ${s.adding ? `<form class="st-inline" data-snz-form><label class="st-field"><span>Snooze name</span><input name="name" placeholder="New TIB design support" required></label>
            <div class="st-box"><h5>Reopens</h5><div class="st-radios"><label><input type="radio" name="r" checked> After a time</label><label><input type="radio" name="r"> On a day</label></div>
            <div class="st-inline__grid"><label class="st-field"><span>Value</span><input name="v" type="number" min="1" value="4"></label><label class="st-field"><span>Repeat by</span><select name="u"><option>hours</option><option>days</option><option selected>weeks</option></select></label></div></div>
            <div class="st-actions"><button type="button" class="btn btn--ghost st-cancel" data-snz-cancel>Cancel</button><button class="btn btn--primary">Save</button></div></form>` : ''}
          ${s.snoozes.length ? s.snoozes.map((z) => `<div class="st-li ${s.snoozeSel.has(z.id) ? 'is-sel' : ''}"><button class="check-btn" data-snz-check="${z.id}" aria-label="Select ${esc(z.name)}"><span class="check ${s.snoozeSel.has(z.id) ? 'is-on' : ''}"></span></button><b>${esc(z.name)}</b><span class="muted">is snoozed upto</span><span class="st-when">${esc(z.when)}</span><button class="icon-btn st-li__del" data-snz-rm="${z.id}" aria-label="Delete ${esc(z.name)}">${A().svg(A().I.trash, 15)}</button></div>`).join('') : empty('Snooze dockets to bring them back when you’re ready.', 'data-snz-add')}
        </div>`;
    },
    notify() {
      const rows = ['Inbound message', 'Outbound message / reply', 'Thread assigned to you', '@mentioned you in comment', 'Thread unsnoozed', 'New message received in thread assigned to you', 'New comment made in thread assigned to you'];
      const on = [[1, 1, 0], [1, 0, 0], [1, 1, 0], [1, 1, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0]];
      return `<h1 class="st-title">Notification</h1><div class="st-card">
        ${row('Turn on email notifications', 'Receive email notifications whenever there is new activity in TeamInbox.', toggle(true, 'data-noop', 'Email notifications'))}
        ${row('Turn on mobile notifications', 'Receive mobile notifications whenever there is new activity in TeamInbox.', toggle(true, 'data-noop', 'Mobile notifications'))}
        ${row('Bot notifications on Cliq', 'We could not find a Cliq profile associated with your account.', toggle(false, 'data-noop', 'Cliq notifications'))}
        <h4 style="margin:20px 0 10px">Set preferences</h4>
        <table class="st-matrix"><thead><tr><th></th><th>Email</th><th>Push</th><th>Cliq BOT</th></tr></thead><tbody>${rows.map((r, i) => `<tr><td>${r}</td>${on[i].map((v, j) => `<td><button class="check-btn" data-noop aria-label="${r} ${['email', 'push', 'Cliq'][j]}"><span class="check ${v ? 'is-on' : ''}"></span></button></td>`).join('')}</tr>`).join('')}</tbody></table>
      </div>`;
    },
    dashboard() {
      return `<label class="st-search">${A().svg(A().I.search, 14)}<input placeholder="Search teams, teammates, inbox, signature, roles, rules." aria-label="Search settings"></label>
        <div class="st-dash">${DASH.map(([t, d, b, go, c, viewAll]) => `<article class="st-dcard"><span class="st-dcard__ic" style="background:${c}"></span><h4>${t}</h4><p>${d}</p>
          <div class="st-dcard__foot">${b ? `<button class="btn" data-go="${go}">${b}</button>` : `<span class="st-dkim">3 addresses need DKIM verification</span>`}${viewAll ? '<button class="st-link" data-go="orgmembers">View all</button>' : ''}</div></article>`).join('')}</div>`;
    },
    team() {
      const t = TEAMS.find((x) => x[0] === s.team);
      return `<h1 class="st-title">Teams</h1><div class="st-sub"><b>${t[1]}</b></div><div class="st-card">
        <div class="st-profile"><span class="st-ini st-ini--xl" style="background:${t[3]}">${t[2]}</span><label class="st-field"><span>Name</span><input value="${esc(t[1])}"></label></div>
        ${row('Automatically add contact', 'Turn this on to add new outgoing email address as team contact', toggle(false, 'data-noop', 'Automatically add contact'))}
        <p class="st-hint">Use the team menu on the left for inboxes, members, tags and canned responses.</p></div>`;
    },
    inboxes() {
      const { svg, I } = A();
      return back('Inboxes', `<button class="st-link" data-noop-msg="Inbox wizard">+Add new inbox</button>`) + `<div class="st-card st-card--list">${[['#Sample inbox', '05 members'], ['Iphone inbox', '04 members'], ['Android inbox', '06 members']].map(([n, m]) => `<div class="st-li"><span><b>${n}</b><small>${m}</small></span><span class="st-li__tools"><button class="icon-btn" aria-label="Edit ${n}" data-noop-msg="Inbox editor">${svg(I.drafts, 15)}</button><button class="icon-btn" aria-label="Delete ${n}" data-noop-msg="Deleting inboxes">${svg(I.trash, 15)}</button></span></div>`).join('')}</div>`;
    },
    members() { return memberList(back('Members')); },
    orgmembers() { return memberList(`<h1 class="st-title">Organisation settings</h1><div class="st-sub"><b>Members</b></div>`); },
    tags() { return collection('tags'); },
    canned() { return collection('canned'); },
    details() {
      const days = ['Friday', 'Saturday', 'Sunday', 'Monday'];
      return `<h1 class="st-title">Organisation settings</h1><div class="st-card">
        <div class="st-org"><small>Organization</small><b>Jambav workspace</b></div>
        ${row('Weekend', 'Days your team is off. SLAs and reminders pause on these days.', `<span class="st-pair"><select data-weekend="0" aria-label="Weekend from">${days.map((d) => `<option ${s.weekend[0] === d ? 'selected' : ''}>${d}</option>`).join('')}</select><span class="muted">to</span><select data-weekend="1" aria-label="Weekend to">${days.map((d) => `<option ${s.weekend[1] === d ? 'selected' : ''}>${d}</option>`).join('')}</select></span>`)}
        ${row('Time zone', 'Used for timestamps, snoozes and working hours.', `<label class="st-select st-select--wide"><select aria-label="Time zone"><option>GMT+05:30 Kolkata, India (Asia/Kolkata)</option><option>GMT+00:00 London, UK</option><option>GMT-08:00 Pacific Time (US)</option></select></label>`)}
      </div>`;
    },
  };

  function back(title, action = '') {
    const t = TEAMS.find((x) => x[0] === s.team);
    return `<div class="st-crumb"><button class="st-link" data-team="${s.team}">‹ Back</button><span class="sep"></span><b>${t[1]}</b></div><div class="st-sub"><b>${title}</b>${action ? `<span class="dot"></span>${action}` : ''}</div>`;
  }
  function memberList(head) {
    return head + `<label class="st-search st-search--sm">${A().svg(A().I.search, 14)}<input placeholder="Search members" aria-label="Search members" data-mem-q></label><div class="st-card st-card--list">${s.members.map(([n, e, r], i) => `<div class="st-li st-mem" data-mem-name="${n.toLowerCase()}">${A().avatar(n)}<span><b>${n}</b><small>${e}</small></span><label class="st-role ${r === 'Team admin' ? 'is-admin' : ''}"><span class="sr">Role for ${n}</span><select data-role="${i}"><option ${r === 'Member' ? 'selected' : ''}>Member</option><option ${r === 'Team admin' ? 'selected' : ''}>Team admin</option></select></label></div>`).join('')}</div>`;
  }
  function empty(text, attr) {
    return `<div class="st-empty"><span class="st-empty__art" aria-hidden="true"><i></i><i></i><i></i></span><p>${text}</p><button class="btn btn--primary" ${attr}>Create now</button></div>`;
  }

  // Empty state → form → list, shared by Tags and Canned responses
  const COLL = {
    tags: { title: 'Tags', add: 'Add new tag', empty: 'Group threads by labeling them with tags.' },
    canned: { title: 'Canned responses', add: '+Add canned response', empty: 'Create canned responses to save repeated replies and use them directly in your responses.' },
  };
  function collection(kind) {
    const c = COLL[kind], items = s[kind], f = s.form?.kind === kind ? s.form : null;
    const { svg, I } = A();
    let body;
    if (f) {
      const ready = f.name.trim() && (kind === 'tags' || f.content.trim());
      body = `<form class="st-card st-form" data-coll-form="${kind}">
        <label class="st-field"><span>Name</span><input name="name" value="${esc(f.name)}" placeholder="${kind === 'tags' ? 'Feedback tag' : 'Feedback'}" autocomplete="off"></label>
        ${kind === 'tags' ? `<div class="st-field"><span>Tag color</span><div class="st-tagcolors">${TAG_COLORS.map((col) => `<button type="button" class="st-tagcolor ${f.color === col ? 'is-on' : ''}" data-tagcolor="${col}" style="--c:${col}" aria-label="Tag color ${col}" aria-pressed="${f.color === col}">${svg(I.tag, 18, 2)}</button>`).join('')}</div></div>`
          : `<label class="st-field"><span>Subject name</span><input name="subject" value="${esc(f.subject)}" placeholder="Thanks for your valuable feedback"></label>
             <label class="st-field"><span>Content</span><textarea name="content" rows="5" placeholder="Type something...">${esc(f.content)}</textarea></label>
             <p class="st-hint">Use curly braces { } to include variables like {customer_name} that are replaced with real values.</p>`}
        <label class="st-check"><input type="checkbox" checked> Accessible to all the inboxes under this team</label>
        <div class="st-actions"><button type="button" class="btn btn--ghost st-cancel" data-coll-cancel>Cancel</button><button class="btn btn--primary" ${ready ? '' : 'disabled'} data-coll-save>Save</button></div>
      </form>`;
    } else if (!items.length) {
      body = `<div class="st-card">${empty(c.empty, `data-coll-new="${kind}"`)}</div>`;
    } else {
      body = `<div class="st-card st-card--list">${items.map((it) => `<div class="st-li">${kind === 'tags' ? `<span style="color:${it.color}">${svg(I.tag, 18, 2)}</span>` : `<span class="st-li__ic">${svg(I.chat, 16)}</span>`}<span><b>${esc(it.name)}</b><small>${kind === 'tags' ? 'For all inboxes' : esc(it.subject || it.content)}</small></span><span class="st-li__tools"><button class="icon-btn" data-coll-rm="${kind}:${it.id}" aria-label="Delete ${esc(it.name)}">${svg(I.trash, 15)}</button></span></div>`).join('')}</div>`;
    }
    return back(c.title, f ? '' : `<button class="st-link" data-coll-new="${kind}">${c.add}</button>`) + body;
  }

  // ---------- Render ----------
  let root;
  function render(stage) {
    root = stage;
    document.body.classList.add('in-settings');
    const page = pages[s.page] ? pages[s.page]() : `<div class="st-card"><div class="st-empty"><p><b>${label(s.page)}</b><br>This page isn’t part of the prototype. The minimal flows are in My Preferences, Snooze, Dashboard, Members, Tags and Canned responses.</p></div></div>`;
    stage.innerHTML = `<div class="st">
      <aside class="st-nav" aria-label="Settings navigation">
        <div class="st-nav__brand"><span class="logo__mark" aria-hidden="true"></span>TeamInbox</div>
        <h2>Settings</h2>
        <div class="st-tabs" role="tablist">${[['personal', 'Personal'], ['org', 'Organization']].map(([id, l]) => `<button role="tab" aria-selected="${s.tab === id}" class="${s.tab === id ? 'is-on' : ''}" data-st-tab="${id}">${l}</button>`).join('')}</div>
        <nav class="st-nav__list">${nav()}</nav>
      </aside>
      <section class="st-main" id="stMain"><button class="st-close" data-st-close aria-label="Close settings">${A().svg(A().I.x, 16, 2.2)}</button><div class="st-page">${page}</div></section>
    </div>`;
  }
  const label = (p) => ([...TEAM_SUB, ...ORG_SUB, ['timeline', 'Timeline']].find(([id]) => id === p) || [, p])[1];
  const rerender = () => render(root);

  // ---------- Events ----------
  document.addEventListener('click', (e) => {
    const app = A(); if (!app || app.state.view !== 'settings') return;
    const t = e.target;
    const go = (page) => { s.page = page; s.form = null; s.adding = false; rerender(); root.querySelector('#stMain').scrollTop = 0; };
    if (t.closest('[data-st-close]')) { document.body.classList.remove('in-settings'); app.setView(app.state.lastView); return; }
    const tab = t.closest('[data-st-tab]'); if (tab) { s.tab = tab.dataset.stTab; go(s.tab === 'personal' ? 'prefs' : 'dashboard'); return; }
    const pg = t.closest('[data-page]'); if (pg) { go(pg.dataset.page); return; }
    const tm = t.closest('[data-team]'); if (tm) { s.team = tm.dataset.team; go('team'); return; }
    if (t.closest('[data-org-toggle]')) { s.orgOpen = !s.orgOpen; rerender(); return; }
    const g = t.closest('[data-go]'); if (g) { const p = g.dataset.go; if (TEAM_SUB.some(([x]) => x === p)) s.team = 'sample'; go(p); if (COLL[p]) { s.form = { kind: p, name: '', subject: '', content: '', color: TAG_COLORS[0] }; rerender(); root.querySelector('[name=name]')?.focus(); } return; }
    const nm = t.closest('[data-noop-msg]'); if (nm) { app.toast(`${nm.dataset.noopMsg} isn’t part of this prototype`); return; }
    if (t.closest('[data-noop]')) { const tg = t.closest('.toggle'); if (tg) { tg.classList.toggle('is-on'); tg.setAttribute('aria-checked', tg.classList.contains('is-on')); } const ck = t.closest('.check-btn .check, .check-btn')?.querySelector?.('.check') || t.closest('.check'); if (ck && !tg) ck.classList.toggle('is-on'); return; }

    // Preferences
    const m = t.closest('button[data-mode]'); if (m) { app.state.mode = m.dataset.mode; app.applyMode(); rerender(); return; }
    const col = t.closest('[data-color]'); if (col) { app.state.theme = col.dataset.color; app.applyMode(); rerender(); return; }
    const bg = t.closest('[data-bg]'); if (bg) { app.state.bg = bg.dataset.bg; app.applyMode(); rerender(); return; }
    const pt = t.closest('[data-ptoggle]'); if (pt) { const k = pt.dataset.ptoggle; s.prefs[k] = !s.prefs[k]; rerender(); return; }

    // Snooze
    if (t.closest('[data-snz-add]')) { s.adding = true; s.snoozeSel.clear(); rerender(); root.querySelector('[data-snz-form] input')?.focus(); return; }
    if (t.closest('[data-snz-cancel]')) { s.adding = false; rerender(); return; }
    const sc = t.closest('[data-snz-check]'); if (sc) { const id = Number(sc.dataset.snzCheck); s.snoozeSel.has(id) ? s.snoozeSel.delete(id) : s.snoozeSel.add(id); rerender(); return; }
    if (t.closest('[data-snz-all]')) { if (s.snoozeSel.size === s.snoozes.length) s.snoozeSel.clear(); else s.snoozes.forEach((z) => s.snoozeSel.add(z.id)); rerender(); return; }
    if (t.closest('[data-snz-del]')) { removeSnoozes([...s.snoozeSel]); return; }
    const sr = t.closest('[data-snz-rm]'); if (sr) { removeSnoozes([Number(sr.dataset.snzRm)]); return; }

    // Collections
    const cn = t.closest('[data-coll-new]'); if (cn) { s.form = { kind: cn.dataset.collNew, name: '', subject: '', content: '', color: TAG_COLORS[0] }; rerender(); root.querySelector('[name=name]').focus(); return; }
    if (t.closest('[data-coll-cancel]')) { s.form = null; rerender(); return; }
    const tc = t.closest('[data-tagcolor]'); if (tc) { s.form.color = tc.dataset.tagcolor; rerender(); return; }
    const cr = t.closest('[data-coll-rm]');
    if (cr) {
      const [kind, id] = cr.dataset.collRm.split(':'); const idx = s[kind].findIndex((x) => x.id === Number(id)); const [gone] = s[kind].splice(idx, 1);
      rerender(); app.toast(`${gone.name} deleted`, () => { s[kind].splice(idx, 0, gone); rerender(); });
    }
  });
  function removeSnoozes(ids) {
    const before = s.snoozes.slice();
    s.snoozes = s.snoozes.filter((z) => !ids.includes(z.id)); s.snoozeSel.clear(); rerender();
    A().toast(`${ids.length > 1 ? ids.length + ' snoozes' : '1 snooze'} deleted`, () => { s.snoozes = before; rerender(); });
  }

  document.addEventListener('submit', (e) => {
    const app = A(); if (!app || app.state.view !== 'settings') return;
    const f = e.target;
    if (f.matches('[data-snz-form]')) {
      e.preventDefault();
      const name = f.name.value.trim(); if (!name) { f.name.focus(); return; }
      s.snoozes.unshift({ id: ++s.seq, name, when: `in ${f.v.value} ${f.u.value}` }); s.adding = false; rerender(); app.toast('Snooze added');
    }
    if (f.matches('[data-coll-form]')) {
      e.preventDefault(); const kind = f.dataset.collForm, d = s.form;
      if (!d.name.trim()) return;
      s[kind].unshift({ id: ++s.seq, name: d.name.trim(), subject: d.subject, content: d.content, color: d.color });
      if (kind === 'tags') window.TIB.TAGS['custom' + s.seq] = { name: d.name.trim(), color: d.color };
      s.form = null; rerender(); app.toast(kind === 'tags' ? 'Tag created' : 'Canned response saved');
    }
  });
  document.addEventListener('input', (e) => {
    const app = A(); if (!app || app.state.view !== 'settings') return;
    const t = e.target;
    if (t.closest('[data-coll-form]') && s.form) {
      s.form[t.name] = t.value;
      const ready = s.form.name.trim() && (s.form.kind === 'tags' || s.form.content.trim());
      root.querySelector('[data-coll-save]').disabled = !ready;
    }
    if (t.matches('[data-bgdark]')) { app.state.bgDark = Number(t.value); app.applyMode(); }
    if (t.matches('[data-bgblur]')) { app.state.bgBlur = Number(t.value); app.applyMode(); }
    if (t.matches('[data-mem-q]')) { const q = t.value.toLowerCase(); root.querySelectorAll('[data-mem-name]').forEach((r) => { r.hidden = !r.dataset.memName.includes(q); }); }
  });
  document.addEventListener('change', (e) => {
    const app = A(); if (!app || app.state.view !== 'settings') return;
    const t = e.target;
    if (t.matches('[data-pref]')) { s.prefs[t.dataset.pref] = t.value; app.toast(`${t.closest('.st-row').querySelector('h4').textContent} set to ${t.value}`); }
    if (t.matches('[data-role]')) { const m = s.members[Number(t.dataset.role)]; m[2] = t.value; t.parentElement.classList.toggle('is-admin', t.value === 'Team admin'); app.toast(`${m[0]} is now ${t.value === 'Team admin' ? 'a Team admin' : 'a Member'}`); }
    if (t.matches('[data-weekend]')) { s.weekend[Number(t.dataset.weekend)] = t.value; app.toast(`Weekend set to ${s.weekend[0]} – ${s.weekend[1]}`); }
  });

  window.TIBSettings = { render, bar: () => '' };
})();
