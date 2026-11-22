/* Motion layer for the home page (styles in assets/motion.css). Runs after the project tiles are built.
   Sets html.mo; tiles cascade in row by row (--d) the first time they reach the screen; on scroll it writes
   --sp on <html> (reading progress) and --hs on the hero; --mx/--my on the tile under a mouse pointer.
   Nothing moves when "reduce motion" is on. */
(function(){
  var root=document.documentElement;
  var tiles=[].slice.call(document.querySelectorAll('.ptiles .ptile'));
  if(!tiles.length) return;
  root.classList.add('mo');
  var still=matchMedia('(prefers-reduced-motion: reduce)');

  var bar=document.createElement('div'); bar.className='mo-progress'; document.body.appendChild(bar);
  var hero=document.querySelector('.hero');

  /* headings and tiles ease in the first time they reach the screen; tiles that arrive together cascade,
     left to right and row by row, 70 ms apart */
  var seen=new IntersectionObserver(function(es){
    var arriving=es.filter(function(e){ return e.isIntersecting }).map(function(e){ return e.target });
    arriving.filter(function(el){ return el.classList.contains('ptile') })
      .sort(function(a,b){ var ra=a.getBoundingClientRect(), rb=b.getBoundingClientRect(); return (ra.top-rb.top)||(ra.left-rb.left) })
      .forEach(function(t,i){ t.style.setProperty('--d',Math.min(i,8)*70+'ms') });
    arriving.forEach(function(el){ el.classList.add('in'); seen.unobserve(el) });
  },{rootMargin:'0px 0px -8% 0px'});
  document.querySelectorAll('.shead').forEach(function(h){ seen.observe(h) });
  tiles.forEach(function(t){ seen.observe(t) });
  /* once a tile has arrived, later moves (hover, filter) should not wait for the cascade */
  tiles.forEach(function(t){ t.addEventListener('transitionend',function(e){ if(e.propertyName==='opacity') t.style.setProperty('--d','0ms') }) });

  var queued=false;
  function frame(){
    queued=false;
    var vh=innerHeight, max=root.scrollHeight-vh;
    root.style.setProperty('--sp',max>0?(scrollY/max).toFixed(4):0);
    if(still.matches) return;
    if(hero){ var hs=Math.min(1,Math.max(0,scrollY/(hero.offsetHeight||vh))); hero.style.setProperty('--hs',hs.toFixed(4)) }
  }
  function ask(){ if(!queued){ queued=true; requestAnimationFrame(frame) } }
  addEventListener('scroll',ask,{passive:true});
  addEventListener('resize',ask);
  still.addEventListener&&still.addEventListener('change',function(){ if(still.matches&&hero) hero.style.removeProperty('--hs'); ask() });
  frame();

  /* the light and a small tilt follow the mouse (not on touch, not with reduce motion) */
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
   screenshots, a filter whose tiles glide into place and whose bar steps aside while scrolling down, and a
   one-time nudge on the contact link. Text that is split into letters or words keeps its words for screen readers (aria-label). */
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

  /* skeleton: shimmer until every screenshot in a tile has loaded, then fade the pictures in */
  document.querySelectorAll('.ptiles .pt-img').forEach(function(box){
    var imgs=[].slice.call(box.querySelectorAll('img')); if(!imgs.length) return;
    var left=imgs.length; box.classList.add('mo-sk');
    imgs.forEach(function(img){
      function done(){ img.classList.add('mo-ok'); if(--left<=0) box.classList.remove('mo-sk') }
      if(img.complete&&img.naturalWidth) done(); else { img.addEventListener('load',done,{once:true}); img.addEventListener('error',done,{once:true}) }
    });
  });

  /* the filter: tiles glide to their new places (FLIP) and newly shown ones grow in, instead of a hard cut.
     This listener runs first (capture); the page's own handler then shows and hides tiles, and the next frame
     animates every tile from where it was to where it is now. */
  document.querySelectorAll('.pfilter').forEach(function(bar){
    var grid=bar.nextElementSibling&&bar.nextElementSibling.classList.contains('ptiles')?bar.nextElementSibling:document.querySelector('#side-projects .ptiles');
    bar.addEventListener('click',function(e){
      if(!e.target.closest('button')||!grid||still||!Element.prototype.animate) return;
      var all=[].slice.call(grid.querySelectorAll('.ptile')), first=new Map();
      all.forEach(function(t){ if(!t.hidden) first.set(t,t.getBoundingClientRect()) });
      requestAnimationFrame(function(){
        var top=grid.getBoundingClientRect().top; if(top<0) scrollTo({top:scrollY+top-90,behavior:'instant'});
        var fresh=0;
        all.forEach(function(t){
          if(t.hidden) return;
          var last=t.getBoundingClientRect(), f=first.get(t);
          if(f){
            var dx=f.left-last.left, dy=f.top-last.top;
            if(dx||dy) t.animate([{transform:'translate('+dx+'px,'+dy+'px)'},{transform:'none'}],{duration:520,easing:'cubic-bezier(.2,.8,.2,1)'});
          } else {
            t.classList.add('in'); t.style.setProperty('--d','0ms');
            t.animate([{opacity:0,transform:'scale(.88)'},{opacity:1,transform:'none'}],{duration:420,delay:120+Math.min(fresh++,8)*50,easing:'cubic-bezier(.2,.8,.2,1)',fill:'backwards'});
          }
        });
      });
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
