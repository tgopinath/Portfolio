/* Card stages (styles in assets/stage.css). kStage.dress(box, card, platforms, kind) turns a cloned project
   thumbnail inside box (.pt-img on the home page, .pp-art on a project page) into a lit stage: it picks the
   device composition from the thumbnail's classes, frames the phones with a bezel and island, turns a desktop
   screenshot into a laptop, and adds the app's monogram, platform pills and a light sweep.
   kStage.platforms(card) reads the platforms from the card (download buttons, tags, live link). */
(function(){
  var ICON={
    Web:'<circle cx="8" cy="8" r="6.2"/><path d="M1.8 8h12.4M8 1.8c2.1 2.2 2.1 10.2 0 12.4M8 1.8c-2.1 2.2-2.1 10.2 0 12.4"/>',
    Android:'<path d="M2.6 12.6a5.4 5.4 0 0 1 10.8 0z"/><path d="M4.9 6 3.7 4M11.1 6l1.2-2"/><path d="M5.9 9.7h.01M10.1 9.7h.01"/>',
    iPhone:'<rect x="4.3" y="1.6" width="7.4" height="12.8" rx="1.9"/><path d="M7.1 3.5h1.8"/>',
    Mac:'<rect x="2.6" y="3" width="10.8" height="7.4" rx="1"/><path d="M1.2 12.9h13.6"/>',
    Windows:'<rect x="2" y="2" width="5.3" height="5.3" rx=".6"/><rect x="8.7" y="2" width="5.3" height="5.3" rx=".6"/><rect x="2" y="8.7" width="5.3" height="5.3" rx=".6"/><rect x="8.7" y="8.7" width="5.3" height="5.3" rx=".6"/>'
  };
  function el(t,c){ var e=document.createElement(t); if(c) e.className=c; return e }
  function platforms(card){
    var out=[], tags=card.querySelector('.tags');
    card.querySelectorAll('.get-app a b').forEach(function(b){ var m=b.textContent.match(/Download for (\w+)/); if(m&&out.indexOf(m[1])<0) out.push(m[1]) });
    if(/\biOS\b|iPhone/.test(tags?tags.textContent:'')&&out.indexOf('iPhone')<0) out.unshift('iPhone');
    if(card.querySelector('.live-dl:not(.src-dl)')) out.push('Web');
    return out;
  }
  var fine=matchMedia('(hover: hover) and (pointer: fine)'), still=matchMedia('(prefers-reduced-motion: reduce)');
  function dress(box, card, plats, kind){
    if(!box||box.classList.contains('stage')) return;
    var th=box.querySelector('.thumb.wmt'), comp;
    if(th) comp=th.classList.contains('desk')?'desk':th.querySelectorAll('.web-win').length>1?'web2':th.classList.contains('duo')?'web':'mobile';
    else {
      var shot=box.querySelector(':scope > img'); if(!shot) return;
      comp='work';
      var win=el('figure','web-win'), bar=el('span','wbar'); bar.innerHTML='<i></i><i></i><i></i><b></b>'; bar.setAttribute('aria-hidden','true');
      shot.replaceWith(win); win.append(bar,shot);
    }
    box.classList.add('stage','st-'+comp);
    (th||box).insertBefore(el('i','st-bg'),(th||box).firstChild);
    if(th){
      var imgs=[].slice.call(th.querySelectorAll('.phones > img'));
      box.dataset.n=imgs.length;
      imgs.forEach(function(img){
        var s=el('span',comp==='desk'?'pn':'ph'); img.replaceWith(s); s.appendChild(img);
        if(comp!=='desk'){ var isl=el('i','isl'); s.appendChild(isl) }
      });
      if(comp==='desk'){ var w=th.querySelector('.web-win'); if(w){ w.append(el('i','notch'),el('i','deck')) } }
    }
    /* the app's colour, for the tile body and the project-page frame */
    var src=th&&th.isConnected?th:card&&card.querySelector('.thumb.wmt'), base='';
    try{ if(src&&src.isConnected) base=getComputedStyle(src).getPropertyValue('--base').trim() }catch(e){}
    var host=box.closest('.ptile,.pp-head');
    function tint(b){ if(!b) return; box.style.setProperty('--base',b); if(host){ host.style.setProperty('--base',b); host.classList.add('st-tint') } }
    if(base) tint(base);
    else if(th) requestAnimationFrame(function(){ if(th.isConnected) tint(getComputedStyle(th).getPropertyValue('--base').trim()) });
    if(kind==='side'){
      var name=((card.querySelector('h3')||{}).textContent||'').trim();
      var head=el('div','st-head'), badge=el('span','st-badge');
      badge.textContent=name.charAt(0).toUpperCase(); badge.setAttribute('aria-hidden','true'); head.appendChild(badge);
      var list=(plats||[]).filter(function(p){ return ICON[p] });
      if(list.length){
        var pills=el('span','st-plats'); pills.setAttribute('role','list'); pills.setAttribute('aria-label','Platforms'); pills.dataset.c=list.length;
        list.forEach(function(p){ var s=el('span','st-p'); s.setAttribute('role','listitem'); s.innerHTML='<svg viewBox="0 0 16 16" aria-hidden="true">'+ICON[p]+'</svg><span></span>'; s.lastChild.textContent=p; pills.appendChild(s) });
        head.appendChild(pills);
      }
      box.appendChild(head);
      if(comp==='desk'&&list.indexOf('Windows')>=0){ var tray=el('span','st-tray'); tray.setAttribute('aria-hidden','true'); tray.innerHTML='<i></i><i></i><i></i><b></b>'; tray.lastChild.textContent=name.charAt(0).toUpperCase(); box.appendChild(tray) }
    }
    box.appendChild(el('i','st-sweep'));
    /* parallax: the pointer's place over the stage, for a mouse only */
    var target=host&&host.classList.contains('ptile')?host:box;
    target.addEventListener('pointermove',function(e){
      if(e.pointerType!=='mouse'||!fine.matches||still.matches) return;
      var r=box.getBoundingClientRect();
      box.style.setProperty('--px',Math.max(-1,Math.min(1,(e.clientX-r.left)/r.width*2-1)).toFixed(3));
      box.style.setProperty('--py',Math.max(-1,Math.min(1,(e.clientY-r.top)/r.height*2-1)).toFixed(3));
    });
    target.addEventListener('pointerleave',function(){ box.style.setProperty('--px',0); box.style.setProperty('--py',0) });
  }
  window.kStage={dress:dress,platforms:platforms};
})();
