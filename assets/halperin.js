/* Halperin Street page (/netanya/halperin/ and /fr/netanya/halperin/).
   - The apartment picker: the room-name buttons on top, and nine apartment cards. Each card's picture is its own
     carousel: swipe it to walk through that apartment (furnished visualisation first, then the real rooms).
     The room name follows the picture. Double-click / double-tap a card (or its name) to open that apartment's page.
   - The apartment page (#apt-65 …): everything about one apartment, and one button, "Ask us about Apartment 65",
     which opens the chat right there.
   - The chat: answers from the Q&A bank, the apartment facts and the area facts (or from the AI agent on our
     server, when it is switched on), collects questions and concerns, the best time to call and the WhatsApp
     number, and sends a lead card for the liaison to our team.
   Facts live in assets/halperin-data.js. This file is separate because the site's Content-Security-Policy
   (script-src 'self') blocks inline scripts. The page language comes from <html lang="fr">. */
(function () {
  "use strict";
  var FR = (document.documentElement.lang || "").toLowerCase().indexOf("fr") === 0;
  var DATA = window.CG_HALPERIN;
  if (!DATA) return;
  var L = FR ? DATA.fr : DATA.en;
  var BASE = "/netanya/halperin/";
  var IMG = BASE + "img/";
  var MEDIA = BASE + "media/";
  var LOGO = "/assets/room-no-photo.jpg";
  var reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function track(ev, p) { try { window.posthog && window.posthog.capture && window.posthog.capture(ev, p || {}); } catch (e) {} }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } }

  var T = FR ? {
    aptWord: "Appartement", aptShort: "Appt", of: "sur", penthouse: "Penthouse",
    stagedNote: "Visualisation : une idée de l’appartement meublé. Ce n’est pas une photo, et les meubles ne sont pas inclus.",
    stagedBadge: "Visualisation meublée",
    notShown: function (id) { return "Le film de l’appartement " + id + " ne montre pas cette pièce : le logo de The Closing Group la remplace."; },
    roomAlt: function (r, id) { return r + " de l’appartement " + id + ", tel qu’il est aujourd’hui"; },
    stagedAlt: function (id) { return "Visualisation de l’appartement " + id + " meublé : une idée, pas une photo"; },
    logoAlt: "Logo de The Closing Group : pas encore de photo de cette pièce",
    cardLabel: function (id) { return "Appartement " + id + ". Faites glisser l’image pour voir ses pièces ; touchez deux fois pour ouvrir sa page."; },
    open: function (id) { return "Ouvrir l’appartement " + id + " →"; },
    prevRoom: function (id) { return "Pièce précédente, appartement " + id; },
    nextRoom: function (id) { return "Pièce suivante, appartement " + id; },
    viewAlt: function (id) { return "Vue depuis le balcon de l’appartement " + id; },
    viewCap: function (id) { return "La vue depuis le balcon · Appartement " + id; },
    filmTitle: function (id) { return "Visite de l’appartement " + id; },
    filmText: function (id, len) { return "Visite de l’appartement " + id + ", " + len + ". Sans son : juste l’appartement tel qu’il est aujourd’hui."; },
    film6054: "Les appartements 54 et 60 partagent ce film : il montre le plan à 4 chambres de l’appartement 54. L’appartement 60 a 3 chambres.",
    ask: function (id) { return "Posez-nous vos questions sur l’appartement " + id; },
    ctaTitle: function (id) { return "C’est celui-ci ? Appartement " + id; }
  } : {
    aptWord: "Apartment", aptShort: "Apt", of: "of", penthouse: "Penthouse",
    stagedNote: "Visualisation: an idea of how the apartment could look furnished. It is not a photo, and the furniture is not included.",
    stagedBadge: "Visualisation, furnished",
    notShown: function (id) { return "The film of apartment " + id + " doesn't show this room, so the Closing Group logo stands in its place."; },
    roomAlt: function (r, id) { return r + " in apartment " + id + ", as it is today"; },
    stagedAlt: function (id) { return "Visualisation of apartment " + id + " furnished: an idea, not a photo"; },
    logoAlt: "The Closing Group logo: no photo of this room yet",
    cardLabel: function (id) { return "Apartment " + id + ". Swipe the picture to see its rooms; double-tap to open its page."; },
    open: function (id) { return "Open Apartment " + id + " →"; },
    prevRoom: function (id) { return "Previous room in apartment " + id; },
    nextRoom: function (id) { return "Next room in apartment " + id; },
    viewAlt: function (id) { return "View from the balcony of apartment " + id; },
    viewCap: function (id) { return "The view from the balcony · Apartment " + id; },
    filmTitle: function (id) { return "Walk-through of apartment " + id; },
    filmText: function (id, len) { return "Walk-through of apartment " + id + ", " + len + ". No sound: just the apartment as it is today."; },
    film6054: "Apartments 54 and 60 share this film: it shows the 4-bedroom layout of Apartment 54. Apartment 60 has 3 bedrooms.",
    ask: function (id) { return "Ask us about Apartment " + id; },
    ctaTitle: function (id) { return "Found the one? Apartment " + id; }
  };

  var APTS = L.apts;
  function aptById(id) { for (var i = 0; i < APTS.length; i++) if (APTS[i].id === id) return APTS[i]; return null; }
  function fact(a, labels) { for (var i = 0; i < a.facts.length; i++) if (labels.indexOf(a.facts[i][0]) >= 0) return a.facts[i][1]; return null; }

  // Slides of one apartment: the furnished visualisation first, then every room (Apartment 60 has no bedroom 4).
  function keysFor(id) {
    var skip = DATA.noRoom[id] || [];
    return ["staged"].concat(DATA.roomKeys.filter(function (k) { return skip.indexOf(k) < 0; }));
  }
  var FILE = { bathp: "bath-parents", bathf: "bath-family", wc: "guest-wc" };
  function roomSrc(id, k) { return k === "live" ? IMG + "room-" + id + ".jpg" : IMG + "room-" + id + "-" + (FILE[k] || k) + ".jpg"; }
  function shows(id, k) { return (DATA.shown[id] || []).indexOf(k) >= 0; }
  function roomName(id, k, short) {
    var n = (L.rename[id] && L.rename[id][k]) || L.rooms[k];
    return short && k === "bed1" ? n.replace(/\s*\(.*\)$/, "") : n;
  }
  function slideHTML(id, k, eager) {
    var lazy = eager ? "" : ' loading="lazy"';
    if (k === "staged") {
      return '<figure class="hp-staged"><img src="' + IMG + "staged-" + id + '.jpg" alt="' + esc(T.stagedAlt(id)) + '"' + lazy + ' decoding="async">' +
        '<span class="hp-badge">' + esc(T.stagedBadge) + "</span></figure>";
    }
    if (shows(id, k)) return '<figure><img src="' + roomSrc(id, k) + '" alt="' + esc(T.roomAlt(roomName(id, k), id)) + '" loading="lazy" decoding="async"></figure>';
    return '<figure><img class="hp-logo" src="' + LOGO + '" alt="' + esc(T.logoAlt) + '" loading="lazy" decoding="async"></figure>';
  }

  /* ---------- What the visitor looked at (for the liaison's lead card) ---------- */
  var V = { pageStart: Date.now(), apts: {}, rooms: {}, staged: {}, films: {}, opened: [] };
  if (!ls("cg_first_seen")) ls("cg_first_seen", new Date().toISOString());
  if (!ss("cg_sess_start")) ss("cg_sess_start", String(Date.now()));
  function noteRoom(id, k) {
    if (k === "staged") { V.staged[id] = true; return; }
    (V.rooms[id] = V.rooms[id] || {})[roomName(id, k, true)] = true;
  }

  /* ---------- Room-name buttons ---------- */
  function buildRoomButtons(holder, onPick, onlyKeys) {
    var btns = {};
    var rows = { main: document.createElement("div"), bath: document.createElement("div") };
    rows.main.className = "hp-roomrow"; rows.bath.className = "hp-roomrow hp-baths";
    rows.main.setAttribute("role", "group"); rows.bath.setAttribute("role", "group");
    rows.main.setAttribute("aria-label", FR ? "Pièces" : "Rooms");
    rows.bath.setAttribute("aria-label", FR ? "Salles de bains" : "Bathrooms");
    ["staged"].concat(DATA.roomKeys).forEach(function (k) {
      if (onlyKeys && onlyKeys.indexOf(k) < 0) return;
      var b = document.createElement("button");
      b.type = "button";
      b.className = "hp-roombtn" + (k === "staged" ? " hp-roombtn-staged" : "");
      b.textContent = k === "staged" ? "✦ " + L.rooms.staged : L.rooms[k];
      b.setAttribute("aria-pressed", k === "staged" ? "true" : "false");
      b.addEventListener("click", function () { onPick(k); });
      (/^bath|^wc$/.test(k) ? rows.bath : rows.main).appendChild(b);
      btns[k] = b;
    });
    holder.appendChild(rows.main); holder.appendChild(rows.bath);
    return btns;
  }
  function setPressed(btns, key, scroll) {
    Object.keys(btns).forEach(function (k) { btns[k].setAttribute("aria-pressed", k === key ? "true" : "false"); });
    var b = btns[key];
    if (b && scroll) {
      var row = b.parentNode;
      var left = b.offsetLeft - (row.clientWidth - b.offsetWidth) / 2;
      row.scrollTo({ left: Math.max(0, left), behavior: reduced ? "auto" : "smooth" });
    }
  }

  // A carousel track: snap-scroll sideways; reports the index it settles on.
  function watchTrack(track, onIndex) {
    var raf = null;
    track.addEventListener("scroll", function () {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = null;
        if (!track.clientWidth) return;
        onIndex(Math.round(track.scrollLeft / track.clientWidth));
      });
    }, { passive: true });
  }
  function scrollTrack(track, i, instant) {
    if (!track.clientWidth) return;
    track.scrollTo({ left: i * track.clientWidth, behavior: reduced || instant ? "auto" : "smooth" });
  }

  /* ---------- List view: room band + cards ---------- */
  var grid = $("hp-grid");
  var band = $("hp-roomband");
  var cards = {};
  var currentKey = "staged";
  var jumpAll = 0;

  if (grid && band) {
    var listBtns = buildRoomButtons(band, function (k) {
      currentKey = k;
      setPressed(listBtns, k, true);
      jumpAll = Date.now();
      Object.keys(cards).forEach(function (id) {
        var c = cards[id], i = c.keys.indexOf(k);
        if (i >= 0) scrollTrack(c.track, i);
      });
      track("halperin_room_all", { room: k });
    });

    DATA.order.forEach(function (id) {
      var a = aptById(id);
      var keys = keysFor(id);
      var card = document.createElement("article");
      card.className = "hp-card";
      card.id = "card-" + id;
      card.tabIndex = 0;
      card.setAttribute("aria-label", T.cardLabel(id));
      card.innerHTML =
        '<div class="hp-car"><div class="hp-track">' + keys.map(function (k, i) { return slideHTML(id, k, i === 0); }).join("") + "</div>" +
        '<button type="button" class="hp-chev hp-prev" aria-label="' + esc(T.prevRoom(id)) + '">‹</button>' +
        '<button type="button" class="hp-chev hp-next" aria-label="' + esc(T.nextRoom(id)) + '">›</button></div>' +
        '<div class="hp-cardbody"><div class="hp-roomline"><span class="hp-rname"></span><span class="hp-pos"></span></div>' +
        '<div class="hp-dots" aria-hidden="true">' + keys.map(function () { return "<i></i>"; }).join("") + "</div>" +
        '<h3 class="hp-name">' + esc(T.aptShort + " " + id) + (a.tag === "Penthouse" ? ' <span class="hp-ph">' + esc(T.penthouse) + "</span>" : "") + "</h3>" +
        '<p class="hp-short">' + esc(a.short) + "</p>" +
        '<button type="button" class="hp-openlink">' + esc(T.open(id)) + "</button></div>";
      grid.appendChild(card);
      var c = { id: id, keys: keys, idx: 0, card: card, track: card.querySelector(".hp-track"),
        rname: card.querySelector(".hp-rname"), pos: card.querySelector(".hp-pos"),
        dots: Array.prototype.slice.call(card.querySelectorAll(".hp-dots i")) };
      cards[id] = c;
      updateCard(c);

      function step(d) { scrollTrack(c.track, Math.max(0, Math.min(keys.length - 1, c.idx + d))); }
      card.querySelector(".hp-prev").addEventListener("click", function (e) { e.stopPropagation(); step(-1); });
      card.querySelector(".hp-next").addEventListener("click", function (e) { e.stopPropagation(); step(1); });
      card.querySelector(".hp-openlink").addEventListener("click", function (e) { e.stopPropagation(); openApt(id, "link"); });
      watchTrack(c.track, function (i) {
        if (i === c.idx || i < 0 || i >= keys.length) return;
        c.idx = i; updateCard(c);
        if (Date.now() - jumpAll > 700 && keys[i] !== currentKey) { currentKey = keys[i]; setPressed(listBtns, currentKey, true); }
      });
      // One tap selects; a double tap / double click opens the apartment's page.
      var lastTap = 0;
      card.addEventListener("click", function (e) {
        if (e.target.closest("button")) return;
        selectCard(id);
        var t = Date.now();
        if (t - lastTap < 400) { lastTap = 0; openApt(id, "double-tap"); } else lastTap = t;
      });
      card.addEventListener("dblclick", function (e) { if (!e.target.closest("button")) openApt(id, "double-click"); });
      card.addEventListener("keydown", function (e) {
        if (e.target !== card) return;
        if (e.key === "Enter") { e.preventDefault(); openApt(id, "keyboard"); }
        else if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); step(e.key === "ArrowRight" ? 1 : -1); }
      });
    });
  }
  function updateCard(c) {
    var k = c.keys[c.idx];
    noteRoom(c.id, k);
    c.rname.textContent = roomName(c.id, k, true);
    c.rname.classList.toggle("is-staged", k === "staged");
    c.pos.textContent = (c.idx + 1) + " " + T.of + " " + c.keys.length;
    c.dots.forEach(function (d, i) { d.className = i === c.idx ? "on" : ""; });
  }
  function selectCard(id) { Object.keys(cards).forEach(function (k) { cards[k].card.classList.toggle("selected", k === id); }); }

  /* ---------- Apartment page ---------- */
  var page = $("hp-aptpage");
  var listParts = Array.prototype.slice.call(document.querySelectorAll("[data-hp-list]"));
  var ap = { id: null, keys: [], idx: 0, btns: null };

  function buildAptPage(a) {
    var id = a.id, keys = keysFor(id);
    ap = { id: id, keys: keys, idx: 0, btns: null };
    V.apts[id] = true;
    if (V.opened.indexOf(id) < 0) V.opened.push(id);
    $("ap-title").textContent = T.aptWord + " " + id + (a.tag === "Penthouse" ? " · " + T.penthouse : "");
    $("ap-sub").textContent = a.short;
    $("ap-desc").textContent = a.text;
    // Room carousel (visualisation first)
    var bandEl = $("ap-roomband"); bandEl.innerHTML = "";
    ap.btns = buildRoomButtons(bandEl, function (k) { var i = keys.indexOf(k); if (i >= 0) scrollTrack($("ap-track"), i); }, keys);
    $("ap-track").innerHTML = keys.map(function (k, i) { return slideHTML(id, k, i === 0); }).join("");
    $("ap-dots").innerHTML = keys.map(function () { return "<i></i>"; }).join("");
    // Stage
    var stage = L.stage.slice();
    if (L.stageExtra[id]) stage.unshift(["open", L.stageExtra[id]]);
    $("ap-stage").innerHTML = stage.map(function (s) { return '<li class="' + s[0] + '">' + esc(s[1]) + "</li>"; }).join("");
    // View
    var v = $("ap-view"); v.src = IMG + "view-" + id + ".jpg"; v.alt = T.viewAlt(id);
    $("ap-view-cap").textContent = T.viewCap(id);
    // Full specification: this apartment, then what every apartment has
    var spec = a.facts.concat(L.shared);
    $("ap-facts").innerHTML = spec.map(function (f) { return "<div><dt>" + esc(f[0]) + "</dt><dd>" + esc(f[1]) + "</dd></div>"; }).join("");
    // Film
    $("ap-film-title").textContent = T.filmTitle(id);
    $("ap-film-text").textContent = T.filmText(id, a.len) + (id === "60" || id === "54" ? " " + T.film6054 : "");
    var vid = $("ap-video");
    vid.pause();
    vid.poster = IMG + "view-" + id + ".jpg";
    vid.src = MEDIA + "apt-" + id + ".mp4";
    vid.setAttribute("aria-label", T.filmTitle(id));
    // The one button
    $("ap-cta-title").textContent = T.ctaTitle(id);
    $("ap-cta-btn").textContent = T.ask(id);
    Chat.reset(a);
    updateAp();
  }
  function updateAp() {
    var k = ap.keys[ap.idx];
    noteRoom(ap.id, k);
    $("ap-cap").textContent = k === "staged" ? T.stagedBadge + " · " + T.aptWord + " " + ap.id : roomName(ap.id, k) + " · " + T.aptWord + " " + ap.id;
    $("ap-pos").textContent = (ap.idx + 1) + " " + T.of + " " + ap.keys.length;
    $("ap-note").textContent = k === "staged" ? T.stagedNote : (shows(ap.id, k) ? "" : T.notShown(ap.id));
    Array.prototype.forEach.call($("ap-dots").children, function (d, i) { d.className = i === ap.idx ? "on" : ""; });
    setPressed(ap.btns, k, true);
  }
  if (page) {
    watchTrack($("ap-track"), function (i) { if (i !== ap.idx && i >= 0 && i < ap.keys.length) { ap.idx = i; updateAp(); } });
    $("ap-prev").addEventListener("click", function () { scrollTrack($("ap-track"), Math.max(0, ap.idx - 1)); });
    $("ap-next").addEventListener("click", function () { scrollTrack($("ap-track"), Math.min(ap.keys.length - 1, ap.idx + 1)); });
    $("ap-back").addEventListener("click", function () {
      if (history.state && history.state.hpApt) history.back();
      else { try { history.replaceState(null, "", location.pathname + location.search + "#apartments"); } catch (e) {} route(); }
    });
    $("ap-video").addEventListener("play", function () { V.films[ap.id] = V.films[ap.id] || 0; });
    $("ap-video").addEventListener("timeupdate", function (e) { var t = Math.round(e.target.currentTime); if (t > (V.films[ap.id] || 0)) V.films[ap.id] = t; });
  }

  var lastCard = null;
  function openApt(id, how) {
    if (!aptById(id)) return;
    lastCard = id;
    track("halperin_apartment_opened", { apartment: id, how: how });
    try { history.pushState({ hpApt: id }, "", "#apt-" + id); } catch (e) { location.hash = "apt-" + id; return; }
    route();
  }
  function route() {
    var m = /^#apt-(\d+)$/.exec(location.hash);
    var a = m && aptById(m[1]);
    if (!page) return;
    if (a) {
      if (ap.id !== a.id || page.hidden) buildAptPage(a);
      listParts.forEach(function (el) { el.hidden = true; });
      page.hidden = false;
      window.scrollTo(0, 0);
      $("ap-track").scrollLeft = 0;
      try { $("ap-back").focus({ preventScroll: true }); } catch (e) {}
      document.title = T.aptWord + " " + a.id + " · Halperin Street, Netanya";
    } else {
      if (!page.hidden) { $("ap-video").pause(); Chat.close(); }
      page.hidden = true;
      listParts.forEach(function (el) { el.hidden = false; });
      document.title = FR ? "Rue Halperin, Netanya" : "Halperin Street Netanya";
      var target = lastCard && $("card-" + lastCard);
      if (target) { target.scrollIntoView({ block: "center" }); try { target.focus({ preventScroll: true }); } catch (e) {} }
      else if (location.hash === "#apartments" && $("apartments")) $("apartments").scrollIntoView();
    }
  }
  window.addEventListener("popstate", route);
  window.addEventListener("hashchange", route);

  /* ---------- The chat (agent) ---------- */
  var Chat = (function () {
    var panel = $("ap-chat"), log = $("chat-log"), form = $("chat-form"), input = $("chat-input"), quick = $("chat-quick");
    var GLAD = FR
      ? "Je suis ravi de vous aider. Je rassemble toutes vos questions et je reviens vers vous. Nous organiserons les réponses."
      : "I'm glad to assist you. Let me collect all your questions and I'll get back to you. We will organise the answers.";
    var C = FR ? {
      who: "Agent The Closing Group", you: "Vous",
      hi: function (a) { return "Bonjour ! Vous regardez l’appartement " + a.id + " (" + a.short + "), rue Halperin, Netanya. Posez-moi toutes vos questions : l’appartement en détail (pièces, balcon, vue, état des travaux), le fonctionnement de The Closing Group, la sécurité, où va votre argent, les taxes en Israël, ou le quartier. Questions ou inquiétudes, tout est bienvenu."; },
      more: function (id) { return "Autre chose sur l’appartement " + id + " ? Une autre question ou une inquiétude ? Sinon, touchez ci-dessous et nous organisons l’appel."; },
      setup: "C’est tout, organisons mon appel",
      time: function (id, who) { return "L’un de nos conseillers vous contactera au sujet de l’appartement " + id + " : " + who + ". Quel est le meilleur moment pour vous appeler ?"; },
      timePh: "ex. demain après 18 h (heure de Paris)",
      wa: function (id) { return "Pouvons-nous échanger sur WhatsApp ? Le conseiller pourra aussi vous y envoyer tout ce qui concerne l’appartement " + id + " avant l’appel."; },
      waYes: "Oui, WhatsApp me va", waNo: "Non, plutôt un appel", yn: "Oui ou non",
      num: "Quel est votre numéro WhatsApp ? Avec l’indicatif du pays, par exemple +33 6 12 34 56 78.",
      numNoWa: "Entendu, ce sera un appel. Il nous faut quand même votre numéro WhatsApp, au cas où : avec l’indicatif du pays, s’il vous plaît.",
      numPh: "Votre numéro WhatsApp", numBad: "Ce numéro semble incomplet, et sans lui le conseiller ne pourra pas vous joindre. Pouvez-vous le retaper, avec l’indicatif du pays ?",
      needTime: "Je n’ai pas saisi d’horaire : quand préférez-vous être appelé ?",
      needYN: "Pour bien le noter : pouvons-nous échanger sur WhatsApp ? Oui ou non suffit.",
      empty: function (id) { return "Écrivez votre question sur l’appartement " + id + " et je vous réponds."; },
      summary: function (s) { return "Merci ! Voici le petit résumé que j’ai préparé.\nAppartement : " + s.apt + "\nVos questions : " + s.qs + "\nMeilleur moment pour appeler : " + s.time + "\nNuméro WhatsApp : " + s.num + (s.waOk ? " (WhatsApp OK)" : " (appel préféré)") + "\n\nL’un de nos conseillers, " + s.who + ", vous contactera à ce moment-là." + (s.open ? " Les questions auxquelles je n’ai pas pu répondre ici seront traitées pendant l’appel." : ""); },
      sent: "C’est transmis à notre équipe.",
      notSent: "Je n’ai pas pu transmettre le message pour l’instant. Touchez « Réessayer », ou écrivez-nous à closinggroupisrael@gmail.com.",
      retry: "Réessayer", after: function (id) { return "Vous pouvez continuer à poser des questions sur l’appartement " + id + " : je les ajoute à votre résumé pour le conseiller."; },
      added: "Je l’ajoute à votre résumé pour le conseiller.",
      noQ: "Pas de question précise : intérêt général", ph: "Écrivez votre question…", send: "Envoyer",
      nudge: "Le plus simple pour avancer : un court appel avec notre conseiller, qui vous répondra sur tout. Voulez-vous que nous l’organisions ?"
    } : {
      who: "Closing Group agent", you: "You",
      hi: function (a) { return "Hi! You're looking at Apartment " + a.id + " (" + a.short + "), Halperin Street, Netanya. Ask me anything: this apartment in detail (rooms, balcony, view, how finished it is), how The Closing Group works, why it's safe, where your money goes, taxes in Israel, or what's near the building. Questions or concerns, everything is welcome."; },
      more: function (id) { return "Anything else about Apartment " + id + "? Another question or a concern? Or tap below and we'll set up your call."; },
      setup: "That's all, set up my call",
      time: function (id, who) { return "One of our liaisons will contact you about Apartment " + id + ": " + who + ". What is the best time to call you?"; },
      timePh: "e.g. Tomorrow after 6pm New York time",
      wa: function (id) { return "Can we talk on WhatsApp? Then the liaison can also send you anything about Apartment " + id + " before the call."; },
      waYes: "Yes, WhatsApp is fine", waNo: "No, a phone call is better", yn: "Yes or no",
      num: "What's your WhatsApp number? Please include the country code, for example +1 212 555 0100.",
      numNoWa: "Understood, a phone call it is. We still need your WhatsApp number to reach you: with the country code, please.",
      numPh: "Your WhatsApp number", numBad: "That number looks incomplete, and without it the liaison can't reach you. Could you type it again, with the country code?",
      needTime: "I didn't catch a time there. When suits you best for a call?",
      needYN: "Just so I note it right: can we talk on WhatsApp? A yes or no is fine.",
      empty: function (id) { return "Type your question about Apartment " + id + " and I'll answer."; },
      summary: function (s) { return "Thank you! Here's the little summary I've made.\nApartment: " + s.apt + "\nYour questions: " + s.qs + "\nBest time to call: " + s.time + "\nWhatsApp number: " + s.num + (s.waOk ? " (WhatsApp OK)" : " (phone call preferred)") + "\n\nOne of our liaisons, " + s.who + ", will contact you at that time." + (s.open ? " Anything I couldn't answer here, they'll go through with you on the call." : ""); },
      sent: "It's with our team.",
      notSent: "I couldn't pass this on just now. Tap \"Try again\", or email us at closinggroupisrael@gmail.com.",
      retry: "Try again", after: function (id) { return "You can keep asking about Apartment " + id + ": I'll add every question to your summary for the liaison."; },
      added: "I've added it to your summary for the liaison.",
      noQ: "No specific question: general interest", ph: "Type your question…", send: "Send",
      nudge: "The quickest way forward is a short call with our liaison, who'll go through everything with you. Shall we set it up?"
    };
    var st = null, apt = null, agentOn = null, busy = false, chatStart = 0;

    function reset(a) {
      apt = a;
      st = { step: "idle", questions: [], open: [], transcript: [], time: "", waOk: null, number: "", french: FR, sent: false };
      if (!log) return;
      log.innerHTML = ""; quick.innerHTML = ""; quick.hidden = true;
      panel.hidden = true;
      input.value = ""; input.placeholder = C.ph;
    }
    function liaison() { return st.french ? DATA.liaisons.fr : DATA.liaisons.en + (FR ? "" : " (or Levy Levin, if you'd like to speak French)"); }
    function add(who, text) {
      var d = document.createElement("div");
      d.className = "hp-msg " + who;
      var w = document.createElement("span"); w.className = "hp-who"; w.textContent = who === "agent" ? C.who : C.you;
      var t = document.createElement("span"); t.className = "hp-text"; t.textContent = text;
      d.appendChild(w); d.appendChild(t);
      log.appendChild(d);
      log.scrollTop = log.scrollHeight;
      st.transcript.push((who === "agent" ? "Agent: " : "Visitor: ") + String(text).replace(/\n+/g, " | "));
      return d;
    }
    function setQuick(items) {
      quick.innerHTML = "";
      if (!items || !items.length) { quick.hidden = true; return; }
      items.forEach(function (it) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "hp-quick"; b.textContent = it.label;
        b.addEventListener("click", function () { if (it.fn) it.fn(); else says(it.value); });
        quick.appendChild(b);
      });
      quick.hidden = false;
    }
    function typing() { var d = add("agent", "…"); d.classList.add("hp-typing"); st.transcript.pop(); return d; }

    function open() {
      if (!apt) return;
      panel.hidden = false;
      if (st.step === "idle") {
        st.step = "question"; chatStart = Date.now();
        add("agent", C.hi(apt));
        setQuick([{ label: C.setup, fn: askTime }]);
        track("halperin_chat_opened", { apartment: apt.id });
      }
      panel.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
      try { input.focus({ preventScroll: true }); } catch (e) {}
    }
    function close() { if (panel) panel.hidden = true; }

    /* --- Answers: the AI agent on our server when it is on; otherwise the facts and the Q&A bank on this page --- */
    function answer(q, done) {
      var local = localAnswer(q);
      if (agentOn === false) return done(local);
      var ctrl = window.AbortController ? new AbortController() : null;
      var timer = setTimeout(function () { ctrl && ctrl.abort(); }, 15000);
      fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl && ctrl.signal,
        body: JSON.stringify({ apt: apt.id, lang: FR ? "fr" : "en", question: q, history: st.transcript.slice(-12).map(function (l) { return l.replace(/\+?\d[\d\s().-]{6,}\d/g, "[number]"); }), page: location.pathname }) })
        .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
        .then(function (j) {
          clearTimeout(timer);
          if (!j || !j.ok || !j.answer) throw new Error("no answer");
          agentOn = true;
          done({ text: cleanAnswer(j.answer), known: j.answered !== false });
        })
        .catch(function () { clearTimeout(timer); if (agentOn === null) agentOn = false; done(local); });
    }
    // The agent never says "I don't know" or "it's not in my list".
    function cleanAnswer(t) {
      if (/\b(i don'?t know|i do not know|not in my (list|knowledge|data)|i'?m not sure|i have no information|je ne sais pas|pas dans ma liste)\b/i.test(t)) return GLAD;
      return t;
    }

    function localAnswer(q) {
      var a = apt, t = q.toLowerCase();
      var size = fact(a, ["Interior", "Intérieur"]), balc = fact(a, ["Balcony", "Balcon"]), terr = fact(a, ["Terrace", "Terrasse"]),
          view = fact(a, ["View", "Vue"]), floor = fact(a, ["Floor", "Étage"]), beds = fact(a, ["Bedrooms", "Chambres"]),
          baths = fact(a, ["Bathrooms", "Salles de bains"]), rooms = fact(a, ["Rooms", "Pièces"]), list = fact(a, ["List price", "Prix catalogue"]);
      var ph = a.tag === "Penthouse", outdoor = terr ? (FR ? "une terrasse de " + terr : "a " + terr + " terrace") : (FR ? "un balcon de " + balc : "a " + balc + " balcony");
      var id = a.id, W = FR ? "L’appartement " : "Apartment ";
      if (/french|fran[cç]ais|parler fran/.test(t)) st.french = true;
      function ok(s) { return { text: s, known: true }; }
      // This apartment
      if (/balcon|balcony|terrace|terrasse/.test(t)) return ok(FR ? W + id + " a " + outdoor + ", accessible depuis le salon." + (view ? " Vue : " + view.toLowerCase() + "." : "") + " La photo « La vue depuis le balcon » sur cette page est la vraie vue."
        : W + id + " has " + outdoor + ", off the living room." + (view ? " View: " + view.toLowerCase() + "." : "") + " The \"view from the balcony\" photo on this page is the real view from it.");
      if (/size|how big|sqm|m²|m2|square|metre|meter|superficie|surface|taille|grand/.test(t)) return ok(FR ? W + id + " fait " + size + " à l’intérieur, plus " + outdoor + "."
        : W + id + " is " + size + " inside, plus " + outdoor + ".");
      if (/bedroom|rooms|mamad|safe room|chambre|pièce|piece/.test(t)) return ok(FR ? W + id + " : " + rooms + " (en Israël, le salon compte comme une pièce)." + (ph ? " Trois chambres sont en suite, plus un mamad (pièce de sécurité)." : " La chambre parentale est une suite avec sa propre salle de bains.")
        : W + id + ": " + rooms + " (in Israel the living room counts as a room)." + (ph ? " Three of the bedrooms are en-suite, plus a mamad (safe room)." : " The parents' bedroom is a suite with its own bathroom."));
      if (/bathroom|toilet|\bwc\b|en-suite|ensuite|shower|salle de bain|douche|toilette/.test(t)) return ok(ph
        ? (FR ? "Les penthouses ont trois salles de bains en suite, plus des WC invités près de l’entrée." : "The penthouses have three en-suite bathrooms, plus a guest toilet by the entrance.")
        : (FR ? W + id + " a " + baths + " salles de bains : la suite parentale, une salle de bains familiale (avec baignoire) entre les chambres, et des WC invités près de l’entrée."
              : W + id + " has " + baths + " bathrooms: the parents' en-suite, a family bathroom (with the bath) between the bedrooms, and a guest toilet by the entrance."));
      if (/\bview\b|outlook|\bsea\b|\bvue\b|\bmer\b/.test(t) && !/beach|plage|far|loin/.test(t)) return ok(FR ? "Depuis l’appartement " + id + " : " + (view || "la ville") + ". La photo du balcon sur cette page est la vraie vue." : "From Apartment " + id + ": " + (view || "across the city") + ". The balcony photo on this page is the real view.");
      if (/floor|storey|story|level|étage|etage/.test(t) && !/tile|carrel/.test(t)) return floor ? ok(FR ? W + id + " est au " + floor + "e étage." : W + id + " is on floor " + floor + ".") : { text: GLAD, known: false };
      if (/stage|finished|ready|works|état|travaux|fini/.test(t)) return ok((FR ? "Où en est l’appartement " + id + " : " : "Where Apartment " + id + " stands: ") + ((L.stageExtra[id] ? L.stageExtra[id] + " " : "") + L.stage.map(function (s) { return s[1]; }).join(" ")));
      if (/visuali[sz]ation|staged|furnish|meubl/.test(t)) return ok(T.stagedNote);
      if (/film|video|vidéo|walk-?through|visite filmée/.test(t)) return ok(T.filmText(id, a.len) + (id === "60" || id === "54" ? " " + T.film6054 : ""));
      if (/parking|storage|cave|\bcar\b|voiture/.test(t)) return ok(FR ? "Une place de parking et une cave sont incluses avec l’appartement " + id + "." : "One parking space and a storage room come with Apartment " + id + ".");
      if (/air|a\/c|cooling|condition|clim/.test(t)) return ok(FR ? "Climatisation centrale, plus une unité séparée dans la chambre parentale. Les unités extérieures sont sur le balcon technique." : "Central air conditioning, plus a separate unit in the parents' bedroom. The outdoor units sit on the service balcony.");
      if (/kitchen|cuisine/.test(t)) return ok(FR ? "Chaque appartement, celui-ci compris, a une cuisine Dekel master posée par le promoteur." : "Every apartment, this one included, has a Dekel master kitchen fitted by the builder.");
      if (/\bgas\b|\bgaz\b|heater|hot water|barbecue|bbq|chauffage|eau chaude/.test(t)) return ok(FR ? "Eau chaude au gaz, un point gaz sur le balcon (prêt pour un barbecue) et un chauffage au gaz." : "Gas hot water, a gas point on the balcony (ready for a barbecue), and a gas heater.");
      if (/price|cost|how much|shekel|\bnis\b|₪|prix|combien|co[uû]t/.test(t)) return ok(FR
        ? (list ? "L’appartement " + id + " est au prix catalogue de " + list + ". " : "") + "Notre objectif : un prix de groupe environ 12 à 15 % sous le prix catalogue du promoteur. C’est un objectif, pas une garantie : le prix final n’est fixé que dans le contrat signé. Le conseiller vous donnera le chiffre exact pour l’appartement " + id + " pendant l’appel."
        : (list ? "Apartment " + id + " lists at " + list + ". " : "") + "Our goal is a group price about 12–15% below the builder's list price" + (ph ? " (about ₪690,000–₪862,500 on a penthouse)." : " (about ₪390,000–₪488,000 on a regular apartment).") + " A goal, not a guarantee: the final price is fixed only in the signed contract. The liaison will go through the exact figure for Apartment " + id + " on the call.");
      if (/where|street|area|neighbo|near|close|beach|netanya|location|promenade|quartier|plage|où|proche/.test(t)) return ok(L.area);
      if (/handover|move in|keys|form 4|tofes|livraison|clés|cles|emménag/.test(t)) return ok(FR ? "Livraison prévue en mars 2027. Les appartements sont déjà construits : il s’agit des finitions, pas de la construction." : "Handover is estimated for March 2027. The apartments are already built: what's left is finishing, not construction.");
      if (/visit|viewing|see it|come and see|tour|visiter|rendez-vous/.test(t)) return ok(FR ? "Oui : vous, ou une personne de confiance, pouvez visiter l’appartement " + id + " avant de vous engager, et nous proposons des visites vidéo en direct si vous êtes à l’étranger. C’est justement le but de l’appel." : "Yes: you, or someone you trust, can walk through Apartment " + id + " before you commit, and we offer live video tours if you're abroad. That's exactly what the call is for.");
      // The Q&A bank (the 50 questions and answers)
      var hit = qaSearch(q);
      if (hit) return ok(hit);
      return { text: GLAD, known: false };
    }

    // Search the Q&A bank (same scoring as the site-wide chat)
    var STOP = "a an and are as at be but by can do does for from get got have how i if in is it its me my of on or our so that the their them there they this to was we what when where which who why will with would you your yours im ive id please tell know about le la les un une des de du et est que qui pour pas sur avec dans vous nous je mon ma mes ce cette".split(" ");
    function words(s) { return String(s).toLowerCase().replace(/[^a-z0-9àâäçéèêëîïôöùûüœ\s]/g, " ").split(/\s+/).filter(function (w) { return w.length > 2 && STOP.indexOf(w) < 0; }); }
    function near(w, list) { for (var i = 0; i < list.length; i++) { var x = list[i]; if (x === w || (w.length > 4 && x.length > 4 && (x.indexOf(w.slice(0, 5)) === 0 || w.indexOf(x.slice(0, 5)) === 0))) return true; } return false; }
    function qaSearch(text) {
      var bank = window.CG_QA || [], qw = words(text);
      if (!qw.length || !bank.length) return null;
      var best = null, bs = 0;
      // A wrong answer is worse than none: most of the visitor's words must match the question or its keywords.
      bank.forEach(function (x) {
        var Q = words(x.q), K = words(x.k || ""), A = words(x.a), s = 0, hits = 0;
        qw.forEach(function (w) { if (near(w, Q)) { s += 3; hits++; } else if (near(w, K)) { s += 2.5; hits++; } else if (near(w, A)) s += 0.8; });
        s = s / Math.sqrt(qw.length);
        if (hits / qw.length >= 0.6 && s > bs) { bs = s; best = x; }
      });
      return bs >= 2 ? best.a : null;
    }

    /* --- The conversation --- */
    function askTime() {
      if (st.step === "time" || st.step === "wa" || st.step === "number") return;
      st.step = "time";
      input.placeholder = C.timePh;
      setQuick(null);
      add("agent", C.time(apt.id, liaison()));
    }
    function askWa() {
      st.step = "wa";
      input.placeholder = C.yn;
      add("agent", C.wa(apt.id));
      setQuick([{ label: C.waYes, value: FR ? "Oui" : "Yes" }, { label: C.waNo, value: FR ? "Non" : "No" }]);
    }
    function askNumber() {
      st.step = "number";
      input.placeholder = C.numPh;
      input.type = "tel";
      setQuick(null);
      add("agent", st.waOk ? C.num : C.numNoWa);
    }
    function finish() {
      st.step = "done";
      input.type = "text";
      input.placeholder = C.ph;
      setQuick(null);
      var who = st.french ? DATA.liaisons.fr : DATA.liaisons.en;
      add("agent", C.summary({ apt: T.aptWord + " " + apt.id + " (" + apt.short + ")", qs: st.questions.length ? st.questions.join(" · ") : C.noQ,
        time: st.time, num: st.number, waOk: st.waOk, who: who, open: st.open.length > 0 }));
      sendLead();
    }
    function sendLead() {
      var status = add("agent", "…");
      st.transcript.pop();
      var payload = leadPayload();
      fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        .then(function (r) { return r.json().catch(function () { return { ok: false }; }).then(function (j) { j.status = r.status; return j; }); })
        .then(function (j) {
          if (!j.ok) throw new Error(j.error || "failed");
          st.sent = true;
          status.querySelector(".hp-text").textContent = C.sent + " " + C.after(apt.id);
          track("halperin_lead_sent", { apartment: apt.id, questions: st.questions.length, liaison: payload.liaison });
        })
        .catch(function () {
          status.querySelector(".hp-text").textContent = C.notSent;
          setQuick([{ label: C.retry, fn: function () { setQuick(null); status.remove(); sendLead(); } }]);
        });
    }
    function says(text) {
      text = String(text || "").trim();
      if (!st || busy) return;
      if (!text) {
        add("agent", st.step === "time" ? C.needTime : st.step === "number" ? C.numBad : st.step === "wa" ? C.needYN : C.empty(apt.id));
        return;
      }
      add("visitor", text);
      input.value = "";
      if (/\b(bonjour|merci|je|vous|est-ce|français|francais)\b/i.test(text)) st.french = true;
      if (st.step === "question" || st.step === "done") {
        if (st.step === "question" && /^(no|nope|done|that'?s all|nothing else|no more|set up|c'?est tout|non merci|rien d'autre)\b/i.test(text)) { askTime(); return; }
        st.questions.push(text);
        busy = true;
        var dots = typing();
        answer(text, function (res) {
          busy = false; dots.remove();
          if (!res.known) st.open.push(text);
          add("agent", res.text);
          if (st.step === "done") {
            add("agent", C.added);
            if (st.sent) resendUpdate();
            return;
          }
          if (!res.known || st.questions.length % 3 === 0) add("agent", C.nudge);
          else add("agent", C.more(apt.id));
          setQuick([{ label: C.setup, fn: askTime }]);
        });
      } else if (st.step === "time") {
        st.time = text; askWa();
      } else if (st.step === "wa") {
        if (/^(y|yes|yeah|yep|sure|ok|okay|fine|oui|ouais|d'accord|bien sûr)/i.test(text)) { st.waOk = true; askNumber(); }
        else if (/^(n|no|nope|non|pas)/i.test(text)) { st.waOk = false; askNumber(); }
        else add("agent", C.needYN);
      } else if (st.step === "number") {
        var digits = text.replace(/[^\d]/g, "");
        if (digits.length < 8 || digits.length > 15) { add("agent", C.numBad); return; }
        st.number = text;
        finish();
      }
    }
    // Questions asked after the lead went out are sent as an update, so the liaison has them all.
    var updTimer = null;
    function resendUpdate() {
      clearTimeout(updTimer);
      updTimer = setTimeout(function () {
        var p = leadPayload(); p.update = true;
        fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) }).catch(function () {});
      }, 4000);
    }

    function leadPayload() {
      var optedOut = false;
      try { optedOut = !!(window.posthog && window.posthog.has_opted_out_capturing && window.posthog.has_opted_out_capturing()); } catch (e) {}
      var trail = []; try { trail = JSON.parse(ss("cg_trail") || "[]"); } catch (e) {}
      var sess = Number(ss("cg_sess_start")) || V.pageStart;
      var roomsSeen = {}; Object.keys(V.rooms).forEach(function (k) { roomsSeen[k] = Object.keys(V.rooms[k]); });
      var replay = "", did = "";
      try { did = window.posthog && window.posthog.get_distinct_id ? window.posthog.get_distinct_id() : ""; } catch (e) {}
      try { replay = window.posthog && window.posthog.get_session_replay_url ? window.posthog.get_session_replay_url({ withTimestamp: true }) : ""; } catch (e) {}
      return {
        apt: apt.id, lang: FR ? "fr" : "en", liaison: st.french ? DATA.liaisons.fr : DATA.liaisons.en,
        questions: st.questions, open_questions: st.open, best_time: st.time, whatsapp_ok: !!st.waOk, whatsapp: st.number,
        transcript: st.transcript.slice(-60), page: location.pathname, ref: ls("cg_ref") || "",
        analytics: optedOut ? { opted_out: true } : {
          seconds_on_site_this_visit: Math.round((Date.now() - sess) / 1000),
          seconds_on_this_page: Math.round((Date.now() - V.pageStart) / 1000),
          seconds_in_chat: chatStart ? Math.round((Date.now() - chatStart) / 1000) : 0,
          first_visit: ls("cg_first_seen") || "",
          pages_this_visit: trail.slice(-25),
          apartments_opened: V.opened,
          rooms_looked_at: roomsSeen,
          visualisations_seen: Object.keys(V.staged),
          films_watched_seconds: V.films,
          referrer: document.referrer || "",
          device: (navigator.userAgentData && navigator.userAgentData.mobile) || /Mobi|Android|iPhone/i.test(navigator.userAgent) ? "phone" : "computer",
          posthog_id: did, replay_url: replay
        }
      };
    }

    if (form) {
      form.addEventListener("submit", function (e) { e.preventDefault(); says(input.value); });
      $("ap-cta-btn").addEventListener("click", open);
      $("chat-close").addEventListener("click", close);
    }
    return { reset: reset, open: open, close: close };
  })();

  /* ---------- Start ---------- */
  route();

  // Only one film plays at a time.
  document.addEventListener("play", function (e) {
    document.querySelectorAll("video").forEach(function (v) { if (v !== e.target && v.id !== "heroVideo") v.pause(); });
  }, true);

  // Respect reduced motion: keep the hero still.
  var hero = $("heroVideo");
  if (hero) {
    if (reduced) { hero.removeAttribute("autoplay"); hero.pause(); }
    else { var p = hero.play(); if (p && p.catch) p.catch(function () {}); }
  }
})();
