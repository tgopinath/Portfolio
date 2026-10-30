(function () {
  var k = 1;
  function lift() {
    var p = document.querySelector('.phone');
    if (!p || p.parentNode === document.body) return;
    document.body.appendChild(p); // out of the portfolio layout; listeners stay attached
    [].forEach.call(document.body.children, function (el) { if (el !== p && el.tagName !== 'SCRIPT') el.style.display = 'none'; });
  }
  // Forge sizes its exercise canvases with its own `phoneScale`; once the frame is hidden that reads 0, so keep it equal to ours and redraw.
  function syncScale() {
    try {
      if (typeof phoneScale !== 'undefined' && Math.abs(phoneScale - k) > 0.001) {
        phoneScale = k;
        if (typeof mountFigs === 'function') { document.querySelectorAll('canvas.fig').forEach(function (c) { c.removeAttribute('data-on'); }); figs = []; mountFigs(); }
      }
    } catch (e) {}
  }
  function fit() {
    lift();
    k = Math.min(innerWidth / 360, innerHeight / 780);
    var r = document.documentElement.style;
    r.setProperty('--app-k', k); r.setProperty('--app-x', ((innerWidth - 360 * k) / 2) + 'px'); r.setProperty('--app-y', '0px');
    var sc = document.querySelector('.screen-area') || document.querySelector('.phone > .screen') || document.querySelector('.screen');
    if (sc) r.setProperty('--app-bg', getComputedStyle(sc).backgroundColor);
    syncScale();
  }
  addEventListener('resize', function () { setTimeout(fit, 0); }); document.addEventListener('DOMContentLoaded', fit); addEventListener('load', fit); setInterval(fit, 500);
})();
