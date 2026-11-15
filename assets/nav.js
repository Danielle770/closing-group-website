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
  var path = location.pathname.replace(/index\.html$/, '');
  var FR = /^fr/i.test(document.documentElement.lang || ''), P = FR ? '/fr' : '';
  var L = FR ? { sw: 'Changer de communaut\u00e9', here: ' \u00b7 vous \u00eates ici', back: 'Retour' } : { sw: 'Switch community', here: ' \u00b7 you\'re here', back: 'Back' };
  var K = FR ? [['/fr/netanya/', 'Netanya'], ['/fr/center/', 'Centre'], ['/fr/jerusalem/', 'J\u00e9rusalem']] : [['/netanya/', 'Netanya'], ['/center/', 'Center'], ['/jerusalem/', 'Jerusalem']];
  var here = null; K.forEach(function (k) { if (path.slice(-k[0].length) === k[0]) here = k; });
  var isHome = path === P + '/' || /\/preview\/$/.test(path);
  var sameSite = false; try { sameSite = !!document.referrer && new URL(document.referrer).origin === location.origin && document.referrer !== location.href; } catch (e) {}
  function switcher() {
    return '<nav class="cg-switch" aria-label="' + L.sw + '"><span>' + L.sw + (FR ? '\u00a0:' : ':') + '</span>' + K.map(function (k) {
      var on = here && k[0] === here[0];
      return '<a href="' + k[0] + '"' + (on ? ' aria-current="page"' : '') + '>' + k[1] + (on ? L.here : ' →') + '</a>';
    }).join('') + '</nav>';
  }
  if (isHome && !sameSite) return;
  var bar = document.createElement('div'); bar.className = 'cg-sub';
  bar.innerHTML = '<div class="cg-sub-in"><button type="button" class="cg-back"><span aria-hidden="true">←</span> ' + L.back + '</button>' + (here ? switcher() : '') + '</div>';
  top.insertAdjacentElement('afterend', bar);
  bar.querySelector('.cg-back').addEventListener('click', function () {
    if (sameSite && history.length > 1) history.back(); else location.href = P + '/';
  });
  if (here) {
    var foot = document.querySelector('footer');
    if (foot) { var s = document.createElement('div'); s.className = 'cg-switch-foot'; s.innerHTML = switcher(); foot.parentNode.insertBefore(s, foot); }
  }
})();
