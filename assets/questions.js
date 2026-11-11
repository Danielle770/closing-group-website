/* Questions & Answers: search, topic filters, most asked, inquiry link into the chat, and anonymous counts. */
(function () {
  var QA = window.CG_QA || [], MOST = window.CG_QA_MOST || [];
  var $ = function (id) { return document.getElementById(id); };
  var listEl = $('qa-list'), chipsEl = $('qa-chips'), mostEl = $('qa-most-list'), mostBox = $('qa-most'),
      emptyEl = $('qa-empty'), countEl = $('qa-count'), searchEl = $('qa-search');
  var cats = []; QA.forEach(function (x) { if (cats.indexOf(x.c) < 0) cats.push(x.c); });
  var cur = 'All', term = '';
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  function track(ev, props) {
    try { if (window.posthog && window.posthog.capture) window.posthog.capture(ev, props); } catch (e) {}
    try { if (ev === 'qa_answer_opened') navigator.sendBeacon && navigator.sendBeacon('/api/qa-event', new Blob([JSON.stringify(props)], { type: 'application/json' })); } catch (e) {}
  }
  function ask(q) {
    if (window.cgChatOpen) window.cgChatOpen(q || '');
    else location.href = '/questions/#ask';
  }
  function chips() {
    chipsEl.innerHTML = ['All'].concat(cats).map(function (c) {
      return '<button type="button" class="qa-chip" aria-pressed="' + (c === cur) + '" data-c="' + esc(c) + '">' + esc(c) + '</button>';
    }).join('');
  }
  function render() {
    var q = term.trim().toLowerCase(), words = q.split(/\s+/).filter(Boolean), html = '', shown = 0, last = '';
    QA.forEach(function (x, i) {
      if (cur !== 'All' && x.c !== cur) return;
      var hay = (x.q + ' ' + x.a + ' ' + x.k + ' ' + x.c).toLowerCase();
      if (words.length && !words.every(function (w) { return hay.indexOf(w) >= 0; })) return;
      if (x.c !== last) { html += '<h2 class="qa-cat">' + esc(x.c) + '</h2>'; last = x.c; }
      html += '<details class="qa-card" id="q' + (i + 1) + '" data-i="' + i + '"><summary>' + esc(x.q) + '</summary><div class="qa-a"><p>' + esc(x.a) + '</p>' +
        '<button type="button" class="qa-ask" data-q="' + esc(x.q) + '">Still have a question? Leave your inquiry</button></div></details>';
      shown++;
    });
    listEl.innerHTML = html;
    emptyEl.hidden = shown > 0;
    mostBox.hidden = !!q || cur !== 'All';
    countEl.textContent = (q || cur !== 'All') ? shown + (shown === 1 ? ' answer' : ' answers') : QA.length + ' answers';
  }
  function renderMost(list) {
    mostEl.innerHTML = list.map(function (q) {
      var i = -1; QA.forEach(function (x, j) { if (x.q === q) i = j; });
      return i < 0 ? '' : '<li><button type="button" data-i="' + i + '">' + esc(q) + '</button></li>';
    }).join('');
  }
  function openCard(i) {
    var card = listEl.querySelector('.qa-card[data-i="' + i + '"]');
    if (!card) { cur = 'All'; term = ''; searchEl.value = ''; chips(); render(); card = listEl.querySelector('.qa-card[data-i="' + i + '"]'); }
    if (card) { card.open = true; card.scrollIntoView({ behavior: 'smooth', block: 'center' }); card.querySelector('summary').focus({ preventScroll: true }); }
  }
  chipsEl.addEventListener('click', function (e) { var b = e.target.closest('.qa-chip'); if (!b) return; cur = b.getAttribute('data-c'); chips(); render(); track('qa_filter', { topic: cur }); });
  mostEl.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) openCard(+b.getAttribute('data-i')); });
  document.addEventListener('click', function (e) { var b = e.target.closest('.qa-ask'); if (b) ask(b.getAttribute('data-q')); });
  listEl.addEventListener('toggle', function (e) {
    var d = e.target; if (!d.open) return;
    track('qa_answer_opened', { question: QA[+d.getAttribute('data-i')].q, search: term || null });
  }, true);
  var t; searchEl.addEventListener('input', function () {
    term = searchEl.value; render();
    clearTimeout(t); t = setTimeout(function () { if (term.trim().length > 2) track('qa_search', { search: term.trim().slice(0, 120) }); }, 900);
  });
  chips(); renderMost(MOST); render();
  // Most asked: real counts from the server once there are enough; otherwise the starter list.
  fetch('/api/qa-top').then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
    if (d && d.top && d.top.length >= 4) renderMost(d.top.slice(0, 6));
  }).catch(function () {});
  var m = location.hash.match(/^#q(\d+)$/); if (m) openCard(+m[1] - 1);
})();
