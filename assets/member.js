/* Welcome back: members are recognised on their own phone/browser.
   - After joining, we keep their first name and Kahila on this device only (localStorage "cg_member").
   - When a member opens the site fresh on the front page, they go straight to their Kahila page.
   - On their Kahila page they see "Welcome back, [name]" once per visit.
   - Clicking Home / the logo from inside the site never redirects, so they can go anywhere.
   First-time visitors are never redirected.
   Loaded in <head> so the redirect happens before the front page paints. */
(function () {
  var KAHILOT = { netanya: { path: "/netanya/", name: "Netanya" }, center: { path: "/center/", name: "Tel Aviv–Jaffa" }, jerusalem: { path: "/jerusalem/", name: "Jerusalem" } };
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
    get: get
  };

  var m = get();
  if (!m) return;                                     // first-time visitor: nothing changes
  var k = KAHILOT[m.area];
  var path = location.pathname.replace(/index\.html$/, "");
  var isHome = path === "/" || /\/preview\/$/.test(path);

  // 1) Front page, fresh visit (not clicked from inside the site) → their Kahila
  var fromInside = false;
  try { fromInside = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch (e) {}
  var stay = /[?&]home=1\b/.test(location.search);    // escape hatch: /?home=1 always shows the front page
  if (isHome && k && !fromInside && !stay && !ss(JUMPED)) {
    ss(JUMPED, "1");                                  // only once per visit, so typing the address again shows Home
    location.replace(k.path + location.search + location.hash);
    return;
  }

  // 2) Their Kahila page (or the front page if they joined without a Kahila) → "Welcome back" bar, once per visit
  var onTheirPage = k ? path.slice(-k.path.length) === k.path : isHome;
  if (!onTheirPage || ss(SEEN)) return;
  ss(SEEN, "1");

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
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
    var hello = "Welcome back" + (m.name ? ", " + esc(m.name) : "") + ".";
    var line = k
      ? " <b>Here's what's new in your " + esc(k.name) + " Kahila.</b>"
      : " <b>Good to see you again.</b> Choose a Kahila below to see the apartments.";
    var link = k && document.getElementById("apartments") ? ' <a href="#apartments">See the apartments ↓</a>' : "";
    bar.innerHTML = '<div class="cg-wb-in"><p>' + hello + line + link + '</p><button type="button" aria-label="Close welcome message">×</button></div>';
    var top = document.querySelector(".cg-top");
    var after = top && top.nextElementSibling && top.nextElementSibling.classList.contains("cg-sub") ? top.nextElementSibling : top;
    if (after) after.insertAdjacentElement("afterend", bar); else document.body.insertBefore(bar, document.body.firstChild);
    bar.querySelector("button").addEventListener("click", function () { bar.remove(); });
    try { window.posthog && window.posthog.capture && window.posthog.capture("member_welcomed_back", { kahila: m.area || null }); } catch (e) {}
  }
  // nav.js adds the Back bar on DOMContentLoaded; wait a tick so the welcome sits under it
  function later() { setTimeout(show, 0); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", later); else later();
})();
