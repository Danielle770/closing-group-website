/* "Ask us anything": answers from our Questions & Answers, then takes the visitor's name,
   WhatsApp number and question so the team can call back at a time that suits them.
   No live chat and no calls at odd hours. */
(function () {
  if (window.cgChatOpen) return;
  var V = '20261115a';
  var FR = /^fr/i.test(document.documentElement.lang || '');
  var T = FR ? {
    ask: 'Demandez-nous n\u2019importe quoi', sub: 'Des r\u00e9ponses tout de suite. Aucune coordonn\u00e9e demand\u00e9e.', close: 'Fermer',
    yourQ: 'Votre question', ph: 'Posez votre question\u2026', askBtn: 'Demander', callback: 'Vous voulez que l\u2019on vous rappelle\u00a0?',
    callbackLow: 'souhaitez-vous que l\u2019on vous rappelle\u00a0?',
    none: 'Je n\u2019ai pas encore de r\u00e9ponse \u00e0 cette question. Vous pouvez me demander autre chose, ou ', noneEnd: ' Notre \u00e9quipe vous r\u00e9pondra au moment qui vous convient.',
    related: 'Questions li\u00e9es\u00a0:', more: 'Posez-moi une autre question, ou ',
    fine: 'Laissez votre num\u00e9ro WhatsApp et nous vous recontacterons au moment qui vous convient. Pas d\u2019appels \u00e0 des heures indues. Ces deux informations sont facultatives et ne sont transmises qu\u2019\u00e0 notre \u00e9quipe.',
    name: 'Votre nom', opt: '(facultatif)', wa: 'Votre num\u00e9ro WhatsApp, avec l\u2019indicatif du pays', waPh: '+33 6 12 34 56 78', web: 'Site web',
    send: 'Envoyer', cancel: 'Non merci, je continue \u00e0 poser des questions', needQ: 'Veuillez \u00e9crire votre question.',
    needWa: 'Veuillez saisir votre num\u00e9ro WhatsApp avec l\u2019indicatif du pays, par exemple +33 6 12 34 56 78.', sending: 'Envoi\u2026',
    thanks: 'Merci', got: ' Nous avons bien re\u00e7u votre question. ',
    willWa: 'Un membre de notre \u00e9quipe vous \u00e9crira sur WhatsApp d\u00e8s que possible, au moment qui vous convient.',
    noWa: 'Sans num\u00e9ro, nous ne pouvons pas vous rappeler, mais votre question nous aide \u00e0 am\u00e9liorer nos r\u00e9ponses. Continuez \u00e0 poser vos questions.',
    oops: 'Un probl\u00e8me est survenu. Veuillez r\u00e9essayer.',
    down: 'Impossible d\u2019envoyer votre message pour le moment. \u00c9crivez-nous votre question \u00e0 <b>closinggroupisrael@gmail.com</b> et nous vous r\u00e9pondrons.',
    retry: 'R\u00e9essayer',
    hi: 'Bonjour\u00a0! Posez-moi n\u2019importe quelle question sur l\u2019achat avec une Kahila, je vous r\u00e9ponds tout de suite. Aucune coordonn\u00e9e demand\u00e9e.',
    enNote: ' <i>Pour l\u2019instant, nos r\u00e9ponses sont en anglais. La version fran\u00e7aise arrive bient\u00f4t.</i>'
  } : {
    ask: 'Ask us anything', sub: 'Answers right away. No details needed.', close: 'Close',
    yourQ: 'Your question', ph: 'Ask anything\u2026', askBtn: 'Ask', callback: 'Want us to call you back?', callbackLow: 'want us to call you back?',
    none: 'I don\'t have an answer to that one yet. You can ask me something else, or ', noneEnd: ' Our team will answer you at a time that suits you.',
    related: 'Related questions:', more: 'Ask me anything else, or ',
    fine: 'Leave your WhatsApp number and we\'ll get back to you at a time that suits you. No calls at odd hours. Both details are optional, and they go only to our team.',
    name: 'Your name', opt: '(optional)', wa: 'Your WhatsApp number, with country code', waPh: '+1 212 555 0100', web: 'Website',
    send: 'Send', cancel: 'No thanks, keep asking', needQ: 'Please write your question.',
    needWa: 'Please enter your WhatsApp number with the country code, for example +1 212 555 0100.', sending: 'Sending\u2026',
    thanks: 'Thank you', got: ' We have your question. ',
    willWa: 'Someone from our team will message you on WhatsApp at a time that suits you, as soon as possible.',
    noWa: 'Without a number we can\'t call you back, but it helps us improve our answers. Keep asking anything.',
    oops: 'Something went wrong. Please try again.',
    down: 'We couldn\'t send that just now. Please email your question to <b>closinggroupisrael@gmail.com</b> and we\'ll get back to you.',
    retry: 'Try again', hi: 'Hi! Ask me anything about buying with a Kahila and I\'ll answer right away. No details needed.', enNote: ''
  };
  // Messages that come back from our server in English
  var SERVER_FR = {
    'Too many messages. Please try again in a few minutes.': 'Trop de messages. Veuillez r\u00e9essayer dans quelques minutes.',
    'Please write your question.': T.needQ,
    'Please enter your WhatsApp number with the country code, for example +1 212 555 0100.': T.needWa
  };
  function srv(m) { return FR && m && SERVER_FR[m] ? SERVER_FR[m] : m; }
  var STOP = 'a an and are as at be but by can do does for from get got have how i if in is it its me my of on or our so that the their them there they this to was we what when where which who why will with would you your yours im ive id please tell know about'.split(' ');
  var state = { asked: [] };
  var ref = (function () { try { var r = new URLSearchParams(location.search).get('ref'); if (r) localStorage.setItem('cg_ref', r.slice(0, 80)); return r || localStorage.getItem('cg_ref') || ''; } catch (e) { return ''; } })();
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  function track(ev, p) { try { window.posthog && window.posthog.capture && window.posthog.capture(ev, p); } catch (e) {} }

  var ICON = '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M17 12h-4.5a2.5 2.5 0 0 0-2.4 1.9L7 26" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M31 12h4.5a2.5 2.5 0 0 1 2.4 1.9L41 26" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><rect x="17" y="10" width="14" height="10" rx="3" fill="currentColor"/><path d="M21 20h6v7h-6z" fill="currentColor"/><circle cx="13" cy="31" r="8" fill="#FFFFFF" stroke="currentColor" stroke-width="3"/><circle cx="35" cy="31" r="8" fill="#FFFFFF" stroke="currentColor" stroke-width="3"/><circle cx="13" cy="31" r="3.4" fill="currentColor"/><circle cx="35" cy="31" r="3.4" fill="currentColor"/><circle cx="11.6" cy="29.6" r="1.1" fill="#FFFFFF"/><circle cx="33.6" cy="29.6" r="1.1" fill="#FFFFFF"/></svg>';

  var btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'cgc-btn'; btn.setAttribute('aria-label', T.ask); btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', 'cgc-panel');
  btn.innerHTML = ICON + '<span class="cgc-tip" aria-hidden="true">' + T.ask + '</span>';
  var panel = document.createElement('div');
  panel.id = 'cgc-panel'; panel.className = 'cgc-panel'; panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'false'); panel.setAttribute('aria-labelledby', 'cgc-title');
  panel.innerHTML =
    '<div class="cgc-head"><div><b id="cgc-title">' + T.ask + '</b><span>' + T.sub + '</span></div><button type="button" class="cgc-x" aria-label="' + T.close + '">×</button></div>' +
    '<div class="cgc-log" id="cgc-log" aria-live="polite"></div>' +
    '<form class="cgc-form" id="cgc-askform" autocomplete="off"><label class="cgc-label" for="cgc-q">' + T.yourQ + '</label><div class="cgc-ask"><input id="cgc-q" type="text" maxlength="300" placeholder="' + T.ph + '"><button class="cgc-send" type="submit">' + T.askBtn + '</button></div>' +
    '<button type="button" class="cgc-link" id="cgc-leave">' + T.callback + '</button></form>';
  document.body.appendChild(panel); document.body.appendChild(btn);

  var log = panel.querySelector('#cgc-log'), askForm = panel.querySelector('#cgc-askform'), qIn = panel.querySelector('#cgc-q');

  function loadQA(cb) {
    if (window.CG_QA) return cb();
    var s = document.createElement('script'); s.src = '/assets/qa-data.js?v=' + V; s.onload = cb; s.onerror = cb; document.head.appendChild(s);
  }
  function words(t) {
    return String(t).toLowerCase().replace(/[^a-z0-9א-ת\s]/g, ' ').split(/\s+/).filter(function (w) { return w.length > 2 && STOP.indexOf(w) < 0; });
  }
  function hit(w, list) { for (var i = 0; i < list.length; i++) { var x = list[i]; if (x === w || (w.length > 4 && x.length > 4 && (x.indexOf(w.slice(0, 5)) === 0 || w.indexOf(x.slice(0, 5)) === 0))) return true; } return false; }
  function search(text) {
    var qw = words(text); if (!qw.length) return [];
    return (window.CG_QA || []).map(function (x, i) {
      var Q = words(x.q), K = words(x.k), A = words(x.a), s = 0;
      qw.forEach(function (w) { if (hit(w, Q)) s += 3; else if (hit(w, K)) s += 2.5; else if (hit(w, A)) s += 0.8; });
      return { i: i, s: s / Math.sqrt(qw.length) };
    }).filter(function (r) { return r.s >= 2; }).sort(function (a, b) { return b.s - a.s; });
  }
  function add(html, me) { var d = document.createElement('div'); d.className = 'cgc-msg' + (me ? ' me' : ''); d.innerHTML = html; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; }
  function chips(list) {
    var d = document.createElement('div'); d.className = 'cgc-rel';
    d.innerHTML = list.map(function (i) { return '<button type="button" class="cgc-chip" data-i="' + i + '">' + esc(window.CG_QA[i].q) + '</button>'; }).join('');
    log.appendChild(d); log.scrollTop = log.scrollHeight;
  }
  function answer(text) {
    text = String(text || '').trim(); if (!text) return;
    state.asked.push(text);
    add(esc(text), true);
    loadQA(function () {
      var r = search(text);
      track('chat_question', { question: text.slice(0, 200), matched: r.length ? window.CG_QA[r[0].i].q : null });
      if (!r.length) {
        var no = add(T.none + '<button type="button" class="cgc-link cgc-more">' + T.callbackLow + '</button>' + T.noneEnd);
        no.querySelector('.cgc-more').onclick = function () { showLeave(text); }; return;
      }
      var x = window.CG_QA[r[0].i];
      add('<b class="cgc-q">' + esc(x.q) + '</b>' + esc(x.a));
      var rel = r.slice(1, 3).map(function (z) { return z.i; });
      if (rel.length) { add(T.related); chips(rel); }
      var more = add(T.more + '<button type="button" class="cgc-link cgc-more">' + T.callbackLow + '</button>');
      more.querySelector('.cgc-more').onclick = function () { showLeave(text); };
    });
  }
  function showLeave(question) {
    if (log.querySelector('#cgc-leaveform')) { var t = log.querySelector('#cgc-lq'); if (question && !t.value) t.value = question; log.querySelector('#cgc-ln').focus(); return; }
    var f = document.createElement('form'); f.id = 'cgc-leaveform'; f.className = 'cgc-form cgc-msg'; f.noValidate = true;
    f.style.cssText = 'max-width:100%;border:1px solid #E8E8ED;background:#FFFFFF;padding:12px';
    f.innerHTML = '<b>' + T.callback + '</b><p class="cgc-fine" style="font-size:13px">' + T.fine + '</p>' +
      '<label class="cgc-label" for="cgc-ln">' + T.name + ' <span class="cgc-opt">' + T.opt + '</span></label><input id="cgc-ln" type="text" autocomplete="name" maxlength="120">' +
      '<label class="cgc-label" for="cgc-lw">' + T.wa + ' <span class="cgc-opt">' + T.opt + '</span></label><input id="cgc-lw" type="tel" autocomplete="tel" inputmode="tel" placeholder="' + T.waPh + '" maxlength="40">' +
      '<label class="cgc-label" for="cgc-lq">' + T.yourQ + '</label><textarea id="cgc-lq" maxlength="1500"></textarea>' +
      '<div class="cgc-hp" aria-hidden="true"><label for="cgc-lweb">' + T.web + '</label><input id="cgc-lweb" type="text" tabindex="-1" autocomplete="off"></div>' +
      '<p class="cgc-err" id="cgc-lerr" role="alert" hidden></p><button class="cgc-gold" type="submit">' + T.send + '</button><button type="button" class="cgc-link cgc-cancel">' + T.cancel + '</button>';
    log.appendChild(f);
    f.querySelector('#cgc-lq').value = question || state.asked.slice(-3).join(' / ');
    f.querySelector('#cgc-ln').focus();
    log.scrollTop = log.scrollHeight;
    f.querySelector('.cgc-cancel').onclick = function () { f.remove(); qIn.focus(); };
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var err = f.querySelector('#cgc-lerr'), b = f.querySelector('.cgc-gold');
      var data = { full_name: f.querySelector('#cgc-ln').value.trim(), whatsapp: f.querySelector('#cgc-lw').value.trim(), question: f.querySelector('#cgc-lq').value.trim(),
        website: f.querySelector('#cgc-lweb').value, page: location.pathname, ref: ref };
      err.hidden = true;
      if (!data.question) { err.textContent = T.needQ; err.hidden = false; f.querySelector('#cgc-lq').focus(); return; }
      if (data.whatsapp && !/^\+?[\d\s().-]{8,}$/.test(data.whatsapp)) { err.textContent = T.needWa; err.hidden = false; f.querySelector('#cgc-lw').focus(); return; }
      b.disabled = true; b.textContent = T.sending;
      var ctrl = window.AbortController ? new AbortController() : null; var timer = setTimeout(function () { ctrl && ctrl.abort(); }, 15000);
      fetch('/api/inquiry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: ctrl && ctrl.signal })
        .then(function (r) { return r.json().catch(function () { return { ok: false, status: r.status }; }).then(function (j) { j.status = r.status; return j; }); })
        .then(function (j) {
          clearTimeout(timer);
          if (j.ok) {
            try { window.cgAnalytics && window.cgAnalytics.inquiry(data); } catch (e) {}
            track('chat_inquiry_sent', { page: location.pathname, ref: ref || null });
            f.outerHTML = '<div class="cgc-msg cgc-ok"><b>' + T.thanks + (data.full_name ? ', ' + esc(data.full_name.split(' ')[0]) : '') + '.</b>' + T.got + (data.whatsapp ? T.willWa : T.noWa) + '</div>';
            log.scrollTop = log.scrollHeight; return;
          }
          if (j.status === 404 || j.status >= 500) throw new Error('down');
          err.textContent = srv(j.error) || T.oops; err.hidden = false; b.disabled = false; b.textContent = T.send;
        })
        .catch(function () {
          clearTimeout(timer);
          err.innerHTML = T.down;
          err.hidden = false; b.disabled = false; b.textContent = T.retry;
        });
    });
  }
  var started = false;
  function start() {
    if (started) return; started = true;
    add(T.hi + T.enNote);
    loadQA(function () {
      var most = (window.CG_QA_MOST || []).slice(0, 4), idx = [];
      most.forEach(function (q) { (window.CG_QA || []).forEach(function (x, i) { if (x.q === q) idx.push(i); }); });
      if (idx.length) chips(idx);
    });
  }
  function open(q) {
    panel.hidden = false; document.documentElement.classList.add('cgc-open'); btn.setAttribute('aria-expanded', 'true');
    start(); track('chat_opened', { page: location.pathname });
    if (q) { answer(q); setTimeout(function () { showLeave(q); }, 60); } else setTimeout(function () { qIn.focus(); }, 30);
  }
  function close() { panel.hidden = true; document.documentElement.classList.remove('cgc-open'); btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
  window.cgChatOpen = open;
  btn.addEventListener('click', function () { panel.hidden ? open() : close(); });
  panel.querySelector('.cgc-x').addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) close(); });
  askForm.addEventListener('submit', function (e) { e.preventDefault(); var t = qIn.value; qIn.value = ''; answer(t); });
  panel.querySelector('#cgc-leave').addEventListener('click', function () { showLeave(''); });
  log.addEventListener('click', function (e) { var c = e.target.closest('.cgc-chip'); if (c) answer(window.CG_QA[+c.getAttribute('data-i')].q); });
  // A gentle hint the first time, then it stays quiet.
  try { if (!sessionStorage.getItem('cgc_hint')) { sessionStorage.setItem('cgc_hint', '1'); setTimeout(function () { btn.classList.add('cgc-hint'); setTimeout(function () { btn.classList.remove('cgc-hint'); }, 4000); }, 2500); } } catch (e) {}
  if (location.hash === '#ask') open();
})();
