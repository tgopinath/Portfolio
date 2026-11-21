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
