/* "Stay in touch — add to your home screen".
   Registers the service worker, and shows the install button in the footer and in the welcome after joining.
   Android / Chrome: the button opens the system install sheet (beforeinstallprompt).
   iPhone / iPad: Apple doesn't let a website install itself, so the button shows the two steps instead.
   Hidden when the site is already open as an installed app. */
(function () {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () {}); });
  }
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  if (standalone) return;
  var ua = navigator.userAgent || '';
  var ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var prompt = null;

  var css = '.cg-install-wrap[hidden],.cg-a2hs[hidden]{display:none!important}' +
    '.cg-install-foot{max-width:1024px;margin:0 auto 18px;display:flex;justify-content:center}' +
    '.cg-install{display:inline-flex;align-items:center;gap:10px;min-height:48px;padding:8px 20px 8px 10px;border-radius:999px;border:1.5px solid #D4AF37;background:#0A0A0A;color:#FFFFFF;font:600 15px/1.2 Inter,system-ui,sans-serif;cursor:pointer}' +
    '.cg-install img{border-radius:8px}.cg-install:hover{background:#1D1D1F}.cg-install:focus-visible{outline:3px solid #D4AF37;outline-offset:3px}' +
    '.cg-install-welcome{margin-top:16px;padding-top:16px;border-top:1px solid rgba(0,0,0,.1)}.cg-install-welcome p{margin:0 0 10px;font-weight:600}' +
    '.cg-a2hs{position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;padding:16px}' +
    '.cg-a2hs-box{width:min(440px,100%);background:#FFFFFF;color:#1D1D1F;border-radius:22px;padding:24px 22px;font:16px/1.55 Inter,system-ui,sans-serif}' +
    '.cg-a2hs-box h2{margin:0 0 12px;font-size:21px}.cg-a2hs-box ol{margin:0 0 12px;padding-left:22px}.cg-a2hs-box li{margin-bottom:8px}.cg-a2hs-box p{margin:0 0 16px;color:#424245}' +
    '.cg-a2hs-ok{width:100%;min-height:48px;border:none;border-radius:999px;background:#D4AF37;color:#0A0A0A;font:700 16px Inter,system-ui,sans-serif;cursor:pointer}.cg-a2hs-ok:focus-visible{outline:3px solid #0A0A0A;outline-offset:3px}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function track(ev, p) { try { window.posthog && window.posthog.capture && window.posthog.capture(ev, p || {}); } catch (e) {} }

  function steps() {
    var d = document.getElementById('cg-a2hs');
    if (!d) {
      d = document.createElement('div');
      d.id = 'cg-a2hs'; d.className = 'cg-a2hs'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-labelledby', 'cg-a2hs-t');
      d.innerHTML = '<div class="cg-a2hs-box"><h2 id="cg-a2hs-t">Add us to your home screen</h2>' +
        '<ol><li>Tap <b>Share</b> <span aria-hidden="true">(the square with the arrow pointing up)</span> at the bottom of Safari.</li>' +
        '<li>Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.</li></ol>' +
        '<p>The gold CG icon appears on your phone. Tap it to come straight back to us.</p>' +
        '<button type="button" class="cg-a2hs-ok">Got it</button></div>';
      document.body.appendChild(d);
      d.addEventListener('click', function (e) { if (e.target === d || e.target.classList.contains('cg-a2hs-ok')) close(); });
      d.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    }
    d.hidden = false; d.querySelector('.cg-a2hs-ok').focus();
    function close() { d.hidden = true; if (steps.from) steps.from.focus(); }
  }

  function onClick(e) {
    var btn = e.currentTarget; track('install_button_clicked', { where: btn.getAttribute('data-where'), platform: prompt ? 'android' : ios ? 'ios' : 'other' });
    if (prompt) {
      prompt.prompt();
      prompt.userChoice.then(function (r) { track('install_choice', { outcome: r && r.outcome }); if (r && r.outcome === 'accepted') hideAll(); prompt = null; refresh(); });
    } else { steps.from = btn; steps(); }
  }

  function makeButton(where, label) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'cg-install'; b.setAttribute('data-where', where);
    b.innerHTML = '<img src="/assets/icons/icon-192.png" width="28" height="28" alt=""><span>' + label + '</span>';
    b.addEventListener('click', onClick);
    return b;
  }

  function canInstall() { return !!prompt || ios; }
  function hideAll() { document.querySelectorAll('.cg-install-wrap').forEach(function (w) { w.hidden = true; }); }
  function refresh() { document.querySelectorAll('.cg-install-wrap').forEach(function (w) { w.hidden = !canInstall(); }); }

  // Footer, on every page
  function addFooter() {
    var foot = document.querySelector('footer'); if (!foot || foot.querySelector('.cg-install-wrap')) return;
    var w = document.createElement('div'); w.className = 'cg-install-wrap cg-install-foot'; w.hidden = true;
    w.appendChild(makeButton('footer', 'Stay in touch — add to your home screen'));
    foot.insertBefore(w, foot.firstChild);
  }

  // Welcome after joining: watch for the welcome box and add the button inside it
  function addWelcome(el) {
    if (!el || el.querySelector('.cg-install-wrap')) return;
    var w = document.createElement('div'); w.className = 'cg-install-wrap cg-install-welcome'; w.hidden = true;
    w.innerHTML = '<p>You\'re in — add the icon so you don\'t lose us.</p>';
    w.appendChild(makeButton('welcome', 'Add to your home screen'));
    el.appendChild(w); refresh();
  }

  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); prompt = e; refresh(); });
  window.addEventListener('appinstalled', function () { track('app_installed'); hideAll(); });

  function start() {
    addFooter();
    document.querySelectorAll('.tcg-welcome').forEach(addWelcome);
    if ('MutationObserver' in window) {
      new MutationObserver(function (muts) {
        muts.forEach(function (m) { m.addedNodes.forEach(function (n) {
          if (n.nodeType !== 1) return;
          if (n.classList && n.classList.contains('tcg-welcome')) addWelcome(n);
          else if (n.querySelectorAll) n.querySelectorAll('.tcg-welcome').forEach(addWelcome);
        }); });
      }).observe(document.body, { childList: true, subtree: true });
    }
    refresh();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
