/* Phone menu: the ☰ button opens and closes the links. */
(function () {
  var top = document.querySelector('.cg-top'), btn = top && top.querySelector('.cg-burger');
  if (!btn) return;
  btn.addEventListener('click', function () {
    var open = top.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  top.querySelectorAll('.cg-nav a').forEach(function (a) {
    a.addEventListener('click', function () { top.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && top.classList.contains('is-open')) { top.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
  });
})();

/* ← Back on every page, and "Switch community" on every Kahila page, so a visitor is never stuck. */
(function () {
  var top = document.querySelector('.cg-top'); if (!top) return;
  var path = location.pathname;
  var K = [['/netanya/index.html', 'Netanya'], ['/center/index.html', 'Center'], ['/jerusalem/index.html', 'Jerusalem']];
  var here = null; K.forEach(function (k) { if (path.slice(-k[0].length) === k[0]) here = k; });
  var isHome = path === '/' || /\/preview\/$/.test(path);
  var sameSite = false; try { sameSite = !!document.referrer && new URL(document.referrer).origin === location.origin && document.referrer !== location.href; } catch (e) {}
  function switcher() {
    return '<nav class="cg-switch" aria-label="Switch community"><span>Switch community:</span>' + K.map(function (k) {
      var on = here && k[0] === here[0];
      return '<a href="' + '..' + k[0].replace('/index.html','/') + 'index.html"' + (on ? ' aria-current="page"' : '') + '>' + k[1] + (on ? ' · you\'re here' : ' →') + '</a>';
    }).join('') + '</nav>';
  }
  if (isHome && !sameSite) return;
  var bar = document.createElement('div'); bar.className = 'cg-sub';
  bar.innerHTML = '<div class="cg-sub-in"><button type="button" class="cg-back"><span aria-hidden="true">←</span> Back</button>' + (here ? switcher() : '') + '</div>';
  top.insertAdjacentElement('afterend', bar);
  bar.querySelector('.cg-back').addEventListener('click', function () {
    if (sameSite && history.length > 1) history.back(); else location.href = '/';
  });
  if (here) {
    var foot = document.querySelector('footer');
    if (foot) { var s = document.createElement('div'); s.className = 'cg-switch-foot'; s.innerHTML = switcher(); foot.parentNode.insertBefore(s, foot); }
  }
})();
