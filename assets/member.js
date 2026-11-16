/* Welcome back: members are recognised on their own phone/browser.
   - After joining, we keep their first name and Kahila on this device only (localStorage "cg_member").
   - When a member opens the site fresh on the front page, they go straight to their Kahila page.
   - On their Kahila page they see "Welcome back, [name]" once per visit.
   - Clicking Home / the logo from inside the site never redirects, so they can go anywhere.
   - A member is NEVER shown a join form again on this device: every join section (home, Netanya, Center,
     Jerusalem, and the French pages) shows "Welcome back, [name], you're already in the [area] Kahila" instead,
     with the apartment films one tap away. The form is hidden from the first paint (class on <html>).
   First-time visitors are never redirected.
   Loaded in <head> so the redirect happens before the front page paints. */
(function () {
  var FR = /^fr/i.test(document.documentElement.lang || ""), P = FR ? "/fr" : "";
  var KAHILOT = FR
    ? { netanya: { path: "/fr/netanya/", name: "de Netanya" }, center: { path: "/fr/center/", name: "de Tel-Aviv\u2013Jaffa" }, jerusalem: { path: "/fr/jerusalem/", name: "de J\u00e9rusalem" } }
    : { netanya: { path: "/netanya/", name: "Netanya" }, center: { path: "/center/", name: "Tel Aviv–Jaffa" }, jerusalem: { path: "/jerusalem/", name: "Jerusalem" } };
  var KEY = "cg_member", SEEN = "cg_wb_seen", JUMPED = "cg_wb_jumped";

  function get() { try { var m = JSON.parse(localStorage.getItem(KEY) || "null"); return m && typeof m === "object" ? m : null; } catch (e) { return null; } }
  function set(m) { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (e) {} }
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } }

  // Called by the sign-up form (site.js) and the email-confirmed page (verified.js)
  window.cgMember = {
    remember: function (area, firstName) {
      var m = get() || {};
      if (KAHILOT[area]) m.area = area;              // a "home" sign-up keeps any Kahila they already had
      if (firstName) m.name = String(firstName).slice(0, 40);
      m.since = m.since || new Date().toISOString().slice(0, 10);
      set(m);
      ss(SEEN, "1");                                  // they've just been welcomed on this visit
    },
    get: get,
    films: films,
    filmsHTML: filmsHTML
  };

  // The apartment films. Netanya is the first Kahila with filmed apartments; other areas get theirs when a builder signs.
  function films() { return P + "/netanya/halperin/"; }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function filmsHTML(area) {
    var k = KAHILOT[area];
    var note = (!area || area === "netanya" || !k)
      ? (FR ? "Les vrais films des appartements de Netanya — les pièces, la vue depuis le balcon, l’immeuble et la rue."
            : "Real films of the Netanya apartments — the rooms, the view from the balcony, the building and the street.")
      : (FR ? "Nos premiers films viennent de Netanya. Ceux de votre Kahila " + esc(k.name) + " arrivent dès qu’un promoteur signe."
            : "Our first films are from Netanya. Your " + esc(k.name) + " films come as soon as a builder there signs.");
    return '<div class="cg-films-box"><a class="cg-films" href="' + films() + '" data-where="member">' +
      '<span class="cg-films-play" aria-hidden="true">▶</span>' + (FR ? "Voir les films des appartements" : "Watch the apartment films") + '</a>' +
      '<p class="cg-films-note">' + note + '</p></div>';
  }
  var FILMS_CSS =
    ".cg-films-box{display:flex;flex-direction:column;gap:8px;margin:4px 0 2px}" +
    ".cg-films{display:inline-flex;align-items:center;justify-content:center;gap:12px;align-self:flex-start;min-height:56px;padding:0 28px 0 12px;border-radius:999px;background:#0A0A0A;color:#FFFFFF!important;border:1.5px solid #D4AF37;font:600 17px/1.2 Inter,system-ui,sans-serif;text-decoration:none!important}" +
    ".cg-films:hover{background:#1D1D1F}.cg-films:focus-visible{outline:3px solid #D4AF37;outline-offset:3px}" +
    ".cg-films-play{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:999px;background:#D4AF37;color:#0A0A0A;font-size:13px;padding-left:2px}" +
    ".cg-films-note{margin:0;font-size:15px!important;line-height:1.5;color:#424245!important}" +
    "@media (max-width:560px){.cg-films{align-self:stretch}}";
  (function () { var c = document.createElement("style"); c.textContent = FILMS_CSS; document.head.appendChild(c); })();

  var m = get();
  if (!m) return;                                     // first-time visitor: nothing changes
  var k = KAHILOT[m.area];

  // 0) Recognised at once: hide every join form (and its "Join the … Kahila" heading) before the page paints
  document.documentElement.classList.add("cg-member");
  (function () {
    var c = document.createElement("style");
    c.textContent = ".cg-member form[data-area],.cg-member #join>div>div:first-child:not(.cg-member-card),.cg-member .cg-join-head{display:none!important}" +
      ".cg-member-card{max-width:680px;margin:0 auto;width:100%}" +
      "#kahilot .cg-member-card{margin-top:40px}";
    document.head.appendChild(c);
  })();

  var path = location.pathname.replace(/index\.html$/, "");
  var isHome = path === P + "/" || /\/preview\/$/.test(path);

  // 1) Front page, fresh visit (not clicked from inside the site) → their Kahila
  var fromInside = false;
  try { fromInside = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch (e) {}
  var stay = /[?&]home=1\b/.test(location.search);    // escape hatch: /?home=1 always shows the front page
  if (isHome && k && !fromInside && !stay && !ss(JUMPED)) {
    ss(JUMPED, "1");                                  // only once per visit, so typing the address again shows Home
    location.replace(k.path + location.search + location.hash);
    return;
  }

  function track(ev, p) { try { window.posthog && window.posthog.capture && window.posthog.capture(ev, p || {}); } catch (e) {} }
  function onReady(fn) { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn); else fn(); }

  // 2) Every join section → "Welcome back, [name], you're already in the [area] Kahila" + the films, never a form
  function memberCard() {
    var card = document.createElement("div");
    card.className = "tcg-welcome cg-member-card";
    card.setAttribute("role", "status");
    var who = m.name ? ", " + esc(m.name) : "";
    var head = FR
      ? "Bon retour" + who + ", vous faites déjà partie " + (k ? "de la Kahila " + esc(k.name) : "de The Closing Group") + "."
      : "Welcome back" + who + ", you're already in " + (k ? "the " + esc(k.name) + " Kahila" : "The Closing Group") + ".";
    var rest = FR
      ? "Rien à remplir de nouveau. Nous vous écrirons dès qu’il y aura une vraie nouvelle."
      : "Nothing to fill in again. We'll message you the moment there's real news.";
    card.innerHTML = '<p class="tcg-welcome-head">' + head + "</p>" + filmsHTML(m.area) + "<p>" + rest + "</p>";
    return card;
  }
  onReady(function () {
    var shown = false;
    document.querySelectorAll("form[data-area]").forEach(function (form) {
      var holder = form.parentNode;
      var first = holder.firstElementChild;
      if (first && first !== form) first.classList.add("cg-join-head");   // the "Join the … Kahila" heading
      holder.insertBefore(memberCard(), holder.firstChild);
      form.remove();
      shown = true;
    });
    var choose = document.getElementById("kahilot");           // front page: "Choose your Kahila"
    if (choose) {
      var intro = choose.firstElementChild;
      if (intro) intro.insertAdjacentElement("afterend", memberCard());
      choose.querySelectorAll(".tcg-card-go").forEach(function (g) {
        var t = g.textContent.replace(/^(Join free|Rejoindre gratuitement)\s*·\s*/, "");
        g.textContent = t.charAt(0).toUpperCase() + t.slice(1);
      });
      shown = true;
    }
    // "Join the Kahila free →" buttons in the page → the films
    document.querySelectorAll('a.k-btn[href="#join"]').forEach(function (a) {
      a.setAttribute("href", films());
      a.innerHTML = (FR ? "Voir les films des appartements" : "Watch the apartment films") + ' <span aria-hidden="true">→</span>';
    });
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a.cg-films, a.k-btn");
      if (a && a.getAttribute("href") === films()) track("member_films_clicked", { kahila: m.area || null, page: location.pathname });
    });
    if (shown) track("member_recognised", { kahila: m.area || null, page: location.pathname });
  });

  // 3) Their Kahila page (or the front page if they joined without a Kahila) → "Welcome back" bar, once per visit
  var onTheirPage = k ? path.slice(-k.path.length) === k.path : isHome;
  if (!onTheirPage || ss(SEEN)) return;
  ss(SEEN, "1");

  function show() {
    var css = document.createElement("style");
    css.textContent =
      ".cg-wb{background:#FBF6E6;border-bottom:1px solid rgba(212,175,55,.35);color:#1D1D1F;font-family:Inter,system-ui,sans-serif}" +
      ".cg-wb-in{max-width:1240px;margin:0 auto;padding:14px max(22px,env(safe-area-inset-right,0px)) 14px max(22px,env(safe-area-inset-left,0px));display:flex;align-items:center;gap:12px 18px;flex-wrap:wrap}" +
      ".cg-wb p{margin:0;flex:1 1 260px;font-size:16px;line-height:1.45}.cg-wb b{font-weight:600}" +
      ".cg-wb a{color:#8A6A12;font-weight:600;text-decoration:none;white-space:nowrap}.cg-wb a:hover{text-decoration:underline}" +
      ".cg-wb button{min-width:44px;min-height:44px;border:0;background:none;color:#424245;font-size:22px;line-height:1;cursor:pointer;border-radius:999px}" +
      ".cg-wb button:hover{background:rgba(0,0,0,.05)}" +
      "@media (prefers-reduced-motion:no-preference){.cg-wb{animation:cgwb .5s cubic-bezier(.2,.8,.2,1)}@keyframes cgwb{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}}";
    document.head.appendChild(css);
    var bar = document.createElement("div");
    bar.className = "cg-wb";
    bar.setAttribute("role", "status");
    var hello = (FR ? "Bon retour" : "Welcome back") + (m.name ? ", " + esc(m.name) : "") + ".";
    var line = FR
      ? (k ? " <b>Vous faites déjà partie de la Kahila " + esc(k.name) + ".</b>" : " <b>Ravis de vous revoir.</b>")
      : (k ? " <b>You're already in the " + esc(k.name) + " Kahila.</b>" : " <b>Good to see you again.</b>");
    var link = ' <a class="cg-films-link" href="' + films() + '">▶ ' + (FR ? "Voir les films des appartements" : "Watch the apartment films") + ' ›</a>';
    bar.innerHTML = '<div class="cg-wb-in"><p>' + hello + line + link + '</p><button type="button" aria-label="' + (FR ? "Fermer le message de bienvenue" : "Close welcome message") + '">×</button></div>';
    var top = document.querySelector(".cg-top");
    var after = top && top.nextElementSibling && top.nextElementSibling.classList.contains("cg-sub") ? top.nextElementSibling : top;
    if (after) after.insertAdjacentElement("afterend", bar); else document.body.insertBefore(bar, document.body.firstChild);
    bar.querySelector("button").addEventListener("click", function () { bar.remove(); });
    bar.querySelector(".cg-films-link").addEventListener("click", function () { track("member_films_clicked", { kahila: m.area || null, where: "welcome_bar" }); });
    track("member_welcomed_back", { kahila: m.area || null });
  }
  // nav.js adds the Back bar on DOMContentLoaded; wait a tick so the welcome sits under it
  onReady(function () { setTimeout(show, 0); });
})();
