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
