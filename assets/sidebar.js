/* Left-hand panel for the portfolio: name, section links and every project, on the home page and on project pages.
   Built from the project cards in index.html, so new projects appear here on their own.
     buildSidebar({ doc, current, onHome })
   doc: a Document holding index.html; current: project key to highlight (project pages); onHome: links use #anchors. */
window.buildSidebar = function ({ doc = document, current = null, onHome = false } = {}) {
  const home = onHome ? '' : 'index.html';
  const el = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e };
  const side = el('aside', 'lhs'); side.id = 'lhs'; side.setAttribute('aria-label', 'Site navigation');

  const brand = el('a', 'lhs-brand'); brand.href = home + '#home';
  const av = el('span', 'lhs-av'); const img = el('img'); img.src = 'assets/photo/gopinath.png'; img.alt = ''; av.appendChild(img);
  const nm = el('span'); nm.append(el('b', null, 'Gopinath Thandapani'), el('small', null, 'Product designer and vibe coder'));
  brand.append(av, nm); side.appendChild(brand);

  const nav = el('nav', 'lhs-nav'); nav.setAttribute('aria-label', 'Sections');
  [['home', 'Home'], ['work', 'Product work'], ['side-projects', 'Side projects'], ['kudos', 'Kind words'], ['contact', 'Contact']].forEach(([id, label]) => {
    if (!doc.getElementById(id)) return;
    const a = el('a', null, label); a.href = home + '#' + id; a.dataset.sec = id; nav.appendChild(a);
  });
  side.appendChild(nav);

  const groups = [['work', 'Zoho product work'], ['side-projects', 'Side projects']];
  const list = el('div', 'lhs-projects');
  list.appendChild(el('p', 'lhs-label', 'All projects'));
  groups.forEach(([id, label]) => {
    const cards = [...doc.querySelectorAll('#' + id + ' .card[data-project]')]; if (!cards.length) return;
    const d = el('details'); d.open = true;
    const s = el('summary'); s.append(el('span', null, label), el('i', null, String(cards.length))); d.appendChild(s);
    const ul = el('ul');
    cards.forEach(c => {
      const key = c.dataset.project, li = el('li'), a = el('a', null, (c.querySelector('h3') || {}).textContent || key);
      a.href = 'project.html?p=' + encodeURIComponent(key);
      if (key === current) { a.setAttribute('aria-current', 'page'); d.open = true }
      li.appendChild(a); ul.appendChild(li);
    });
    d.appendChild(ul); list.appendChild(d);
  });
  side.appendChild(list);

  // phones and small windows: the panel slides in from a menu button
  const btn = el('button', 'lhs-toggle'); btn.type = 'button'; btn.setAttribute('aria-controls', 'lhs'); btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = '<span aria-hidden="true"></span><span class="sr">Menu</span>';
  const scrim = el('div', 'lhs-scrim');
  const setOpen = (o) => { document.documentElement.classList.toggle('lhs-open', o); btn.setAttribute('aria-expanded', String(o)); if (o) side.querySelector('a').focus() };
  btn.addEventListener('click', () => setOpen(!document.documentElement.classList.contains('lhs-open')));
  scrim.addEventListener('click', () => setOpen(false));
  side.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false) });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.documentElement.classList.contains('lhs-open')) { setOpen(false); btn.focus() } });
  document.body.prepend(side, scrim, btn);

  // on the home page, mark the section in view
  if (onHome && 'IntersectionObserver' in window) {
    const links = [...nav.querySelectorAll('a')];
    const io = new IntersectionObserver(es => es.forEach(en => {
      if (en.isIntersecting) links.forEach(a => a.toggleAttribute('aria-current', a.dataset.sec === en.target.id));
    }), { rootMargin: '-45% 0px -50% 0px' });
    links.forEach(a => { const s = document.getElementById(a.dataset.sec); if (s) io.observe(s) });
  }
  const cur = side.querySelector('[aria-current=page]'); if (cur) side.scrollTop = cur.offsetTop - side.clientHeight / 2;
};
