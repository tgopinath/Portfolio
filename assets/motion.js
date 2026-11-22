/* Motion layer for the home page (styles in assets/motion.css). Runs after the project tiles are built.
   Sets html.mo, numbers the panels, and on scroll writes a few CSS variables:
   --sp on <html> (reading progress), --hs on the hero, --p on each panel near the screen,
   and --mx/--my on the panel under a mouse pointer. Nothing moves when "reduce motion" is on. */
(function(){
  var root=document.documentElement;
  var tiles=[].slice.call(document.querySelectorAll('.ptiles .ptile'));
  if(!tiles.length) return;
  root.classList.add('mo');
  var still=matchMedia('(prefers-reduced-motion: reduce)');

  /* panel extras: a running number per section and an "open" cue */
  document.querySelectorAll('.ptiles').forEach(function(grid){
    var list=[].slice.call(grid.querySelectorAll('.ptile')), n=list.length;
    list.forEach(function(t,i){
      var body=t.querySelector('.pt-body'); if(!body||body.querySelector('.pt-n')) return;
      var num=document.createElement('span'); num.className='pt-n'; num.setAttribute('aria-hidden','true');
      num.textContent=String(i+1).padStart(2,'0')+' / '+String(n).padStart(2,'0');
      body.insertBefore(num,body.firstChild);
      var go=document.createElement('span'); go.className='pt-go'; go.setAttribute('aria-hidden','true');
      go.innerHTML='Open the project <i>→</i>';
      body.appendChild(go);
    });
  });

  var bar=document.createElement('div'); bar.className='mo-progress'; document.body.appendChild(bar);
  var hero=document.querySelector('.hero');

  /* ease in headings and panels the first time they reach the screen */
  var seen=new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); seen.unobserve(e.target) } }) },{rootMargin:'0px 0px -12% 0px'});
  document.querySelectorAll('.shead').forEach(function(h){ seen.observe(h) });
  tiles.forEach(function(t){ seen.observe(t) });

  /* only panels near the screen are updated on scroll */
  var live=new Set();
  var near=new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting) live.add(e.target); else live.delete(e.target) }) },{rootMargin:'25% 0px'});
  tiles.forEach(function(t){ near.observe(t) });

  var queued=false;
  function frame(){
    queued=false;
    var vh=innerHeight, max=root.scrollHeight-vh;
    root.style.setProperty('--sp',max>0?(scrollY/max).toFixed(4):0);
    if(still.matches) return;
    if(hero){ var hs=Math.min(1,Math.max(0,scrollY/(hero.offsetHeight||vh))); hero.style.setProperty('--hs',hs.toFixed(4)) }
    live.forEach(function(t){
      var r=t.getBoundingClientRect(), p=((r.top+r.height/2)-vh/2)/vh;
      t.style.setProperty('--p',Math.max(-1.2,Math.min(1.2,p)).toFixed(4));
    });
  }
  function ask(){ if(!queued){ queued=true; requestAnimationFrame(frame) } }
  addEventListener('scroll',ask,{passive:true});
  addEventListener('resize',ask);
  still.addEventListener&&still.addEventListener('change',function(){
    if(still.matches){ tiles.forEach(function(t){ t.style.removeProperty('--p') }); if(hero) hero.style.removeProperty('--hs') }
    ask();
  });
  frame();

  /* a small tilt toward the mouse (not on touch, not with reduce motion) */
  if(matchMedia('(hover: hover) and (pointer: fine)').matches){
    tiles.forEach(function(t){
      t.addEventListener('pointermove',function(e){
        if(still.matches) return;
        var r=t.getBoundingClientRect();
        t.style.setProperty('--mx',((e.clientX-r.left)/r.width*2-1).toFixed(3));
        t.style.setProperty('--my',((e.clientY-r.top)/r.height*2-1).toFixed(3));
      });
      t.addEventListener('pointerleave',function(){ t.style.setProperty('--mx',0); t.style.setProperty('--my',0) });
    });
  }
})();

/* Round two (styles at the end of assets/motion.css): welcome animation, word-by-word headings, skeleton
   screenshots, a filter that fades and steps aside while scrolling down, and a one-time nudge on the
   contact link. Text that is split into letters or words keeps its words for screen readers (aria-label). */
(function(){
  var root=document.documentElement;
  if(!root.classList.contains('mo')) return;
  var still=matchMedia('(prefers-reduced-motion: reduce)').matches;

  function split(el, mode){
    if(!el||el.dataset.moSplit) return 0;
    var text=el.textContent.trim(), n=0; el.dataset.moSplit='1';
    el.setAttribute('aria-label',text); el.textContent='';
    text.split(/\s+/).forEach(function(word,wi){
      if(wi) el.appendChild(document.createTextNode(' '));
      var w=document.createElement('span'); w.setAttribute('aria-hidden','true');
      if(mode==='letters'){ w.className='mo-w'; word.split('').forEach(function(ch){ var l=document.createElement('span'); l.className='mo-l'; l.style.setProperty('--i',n++); l.textContent=ch; w.appendChild(l) }) }
      else { w.className='mo-word'; w.style.setProperty('--i',wi); w.textContent=word; n++ }
      el.appendChild(w);
    });
    return n;
  }

  /* welcome: once per browser tab, so coming back from a project page does not replay it */
  var name=document.querySelector('.hero-name');
  var seen=false; try{ seen=sessionStorage.getItem('mo-welcomed')==='1' }catch(e){}
  if(name&&!still&&!seen){
    var n=split(name,'letters'); var hero=document.querySelector('.hero'); if(hero) hero.style.setProperty('--n',n);
    root.classList.add('mo-welcome');
    try{ sessionStorage.setItem('mo-welcomed','1') }catch(e){}
    setTimeout(function(){ root.classList.remove('mo-welcome') },3200);
  }

  /* headings: words rise in when the heading reaches the screen (motion.js part one adds .in) */
  if(!still) document.querySelectorAll('.shead h2').forEach(function(h){ split(h,'words') });

  /* skeleton: shimmer until every screenshot in a panel has loaded, then fade the pictures in */
  document.querySelectorAll('.ptiles .pt-img').forEach(function(box){
    var imgs=[].slice.call(box.querySelectorAll('img')); if(!imgs.length) return;
    var left=imgs.length; box.classList.add('mo-sk');
    imgs.forEach(function(img){
      function done(){ img.classList.add('mo-ok'); if(--left<=0) box.classList.remove('mo-sk') }
      if(img.complete&&img.naturalWidth) done(); else { img.addEventListener('load',done,{once:true}); img.addEventListener('error',done,{once:true}) }
    });
  });

  /* the filter: fade the panels out, switch, fade back, and bring the list's start into view */
  document.querySelectorAll('.pfilter').forEach(function(bar){
    var grid=bar.nextElementSibling&&bar.nextElementSibling.classList.contains('ptiles')?bar.nextElementSibling:document.querySelector('#side-projects .ptiles');
    bar.addEventListener('click',function(e){
      var btn=e.target.closest('button'); if(!btn||!grid||still) return;
      if(btn._moPass){ btn._moPass=false; return }
      e.stopImmediatePropagation(); e.preventDefault();
      grid.classList.add('mo-out');
      setTimeout(function(){
        btn._moPass=true; btn.click();
        var top=grid.getBoundingClientRect().top; if(top<0) scrollTo({top:scrollY+top-90,behavior:'instant'});
        requestAnimationFrame(function(){ grid.classList.remove('mo-out') });
      },180);
    },true);
  });

  /* dynamic menu: the filter bar steps aside while you scroll down and comes back as soon as you scroll up */
  var lastY=scrollY, ticking=false;
  addEventListener('scroll',function(){
    if(ticking) return; ticking=true;
    requestAnimationFrame(function(){
      ticking=false; var y=scrollY, dy=y-lastY;
      if(Math.abs(dy)>6){ root.classList.toggle('mo-down',dy>0&&y>innerHeight); lastY=y }
    });
  },{passive:true});
  document.querySelectorAll('.pfilter').forEach(function(bar){ bar.addEventListener('focusin',function(){ root.classList.remove('mo-down') }) });

  /* attention: the contact block gets .in once, which plays a short nudge on its link */
  var closing=document.querySelector('.closing');
  if(closing&&'IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){ es.forEach(function(en){ if(en.isIntersecting){ closing.classList.add('in'); io.disconnect() } }) },{threshold:.4});
    io.observe(closing);
  }
})();
