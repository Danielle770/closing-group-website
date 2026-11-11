// The Closing Group — sign-up forms.
// 1) POST /api/join  2) show the welcome at once (no email link to click)  3) WhatsApp code box only if a code was sent
(function () {
  // Referral: ?ref=<leader> on any page is remembered and sent with the sign-up
  var REF = (function () {
    try { var r = new URLSearchParams(location.search).get("ref"); if (r) localStorage.setItem("cg_ref", r.slice(0, 80)); return r || localStorage.getItem("cg_ref") || ""; }
    catch (e) { return ""; }
  })();
  var KAHILA = { netanya: "Netanya", center: "Center", jerusalem: "Jerusalem" };
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
  function welcomeHTML(area, firstName) {
    var k = KAHILA[area];
    var head = "You're in! Welcome to The Closing Group Israel" + (k ? " — and to your " + k + " Kahila!" : "!");
    var deal = area === "netanya"
      ? "<p><b>We're putting together a group to buy 9 apartments in Netanya — at the builder's cost, below the list price.</b> Our goal is to save roughly ₪390,000–₪488,000 on a regular apartment. Parking and storage are included.</p>"
      : "<p><b>We're gathering families for a group in " + (k ? "the " + k + " area" : "your area") + ".</b> When a builder agrees to sell his last finished apartments at his cost, you'll be among the first to know.</p>";
    return '<div class="tcg-welcome" role="status" tabindex="-1">' +
      '<p class="tcg-welcome-head"><span aria-hidden="true">🎉 </span>' + esc(head) + "</p>" +
      (firstName ? "<p>Good to have you, " + esc(firstName) + ". You're one of the first people in — and that's a good place to be. Here's what happens next:</p>" : "<p>You're one of the first people in — and that's a good place to be. Here's what happens next:</p>") +
      deal +
      "<p><b>You don't pay anything now, and you don't commit to anything.</b> When the group opens, we'll show you the real apartments, the real prices and the fair-price check. If you choose one, your ₪50,000 deposit goes straight into our partner law firm's trust account — never to us. Buyers pay no broker fee and no legal fee; the builder pays.</p>" +
      "<p><b>What you need to do now: nothing.</b> We'll message you the moment there's news — when the builder agrees, when the group opens, when the last apartments are left. One message at a time, only when it matters.</p>" +
      '<p>Questions? Tap the binoculars <span aria-hidden="true">🔭</span> at the bottom of the page and ask anything.</p>' +
      '<p class="tcg-welcome-sign">Welcome aboard,<br>Ram &amp; The Closing Group</p></div>';
  }
  function showWelcome(form, area, firstName, returning) {
    var box = document.createElement("div");
    box.innerHTML = returning
      ? '<div class="tcg-welcome" role="status" tabindex="-1"><p class="tcg-welcome-head">Welcome back' + (firstName ? ", " + esc(firstName) : "") + "! You're already in" + (KAHILA[area] ? " the " + KAHILA[area] + " Kahila" : "") + ".</p><p>We've updated your details. We'll message you the moment there's real news.</p></div>"
      : welcomeHTML(area, firstName);
    var el = box.firstChild;
    form.parentNode.replaceChild(el, form);
    el.focus({ preventScroll: true });
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    try { window.posthog && window.posthog.capture && window.posthog.capture("kahila_joined", { kahila: area, ref: REF || null, returning: !!returning }); } catch (e) {}
  }

  function fieldName(input) {
    if (input.name) return input.name;
    var label = input.closest("label");
    var text = label ? label.textContent.trim().toLowerCase() : input.type;
    if (input.type === "email") return "email";
    if (input.type === "tel") return "whatsapp";
    if (input.type === "checkbox") return text.indexOf("alert") > -1 ? "consent_alerts" : "consent_terms";
    if (text.indexOf("name") > -1) return "full_name";
    if (text.indexOf("country") > -1) return "country_city";
    if (text.indexOf("community") > -1) return "community";
    if (text.indexOf("sent you") > -1) return "referred_by";
    return "field";
  }

  function message(form, text, ok) {
    var el = form.querySelector(".tcg-msg");
    if (!el) { el = document.createElement("p"); el.className = "tcg-msg"; el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite"); form.appendChild(el); }
    el.textContent = text;
    el.classList.toggle("ok", !!ok);
  }

  function post(url, data) {
    var ctrl = window.AbortController ? new AbortController() : null;
    if (ctrl) setTimeout(function () { ctrl.abort(); }, 20000);
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j.httpOk = r.ok; j.status = r.status; return j; }); });
  }

  function showCodeStep(form, email) {
    if (form.querySelector(".tcg-code")) return;
    var box = document.createElement("div");
    box.className = "tcg-code";
    box.style.cssText = "display:flex;flex-direction:column;gap:10px;background:#F5F5F7;border-radius:14px;padding:16px";
    box.innerHTML =
      '<label style="display:flex;flex-direction:column;gap:6px;font-size:14px;font-weight:500">Enter the 6-digit code we sent to your WhatsApp' +
      '<input type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="8" style="min-height:52px;border:1px solid #D2D2D7;border-radius:12px;padding:0 16px;font-family:inherit;font-size:20px;letter-spacing:0.2em;background:#fff"></label>' +
      '<div style="display:flex;flex-wrap:wrap;gap:16px;align-items:center">' +
      '<button type="button" class="tcg-code-ok" style="min-height:48px;border:none;border-radius:999px;background:#A8522F;color:#fff;font-family:inherit;font-size:16px;font-weight:600;padding:0 24px;cursor:pointer">Verify WhatsApp</button>' +
      '<button type="button" class="tcg-code-again" style="min-height:44px;border:none;background:none;color:#A8522F;font-family:inherit;font-size:15px;cursor:pointer;padding:0 4px">Send a new code</button></div>';
    var msg = form.querySelector(".tcg-msg");
    form.insertBefore(box, msg);
    var input = box.querySelector("input");
    input.focus();
    box.querySelector(".tcg-code-ok").addEventListener("click", function () {
      var code = input.value.replace(/\D/g, "");
      if (code.length < 4) { message(form, "Please enter the code from WhatsApp."); return; }
      post("/api/verify-whatsapp", { email: email, code: code }).then(function (j) {
        if (j.ok) { box.remove(); showWelcome(form, form.getAttribute("data-area") || "home", "", false); }
        else message(form, j.error || "That code did not work. Please try again.");
      }).catch(function () { message(form, "Connection problem. Please try again."); });
    });
    box.querySelector(".tcg-code-again").addEventListener("click", function () {
      post("/api/resend-whatsapp", { email: email }).then(function () { message(form, "A new code is on its way to your WhatsApp.", true); });
    });
  }

  document.querySelectorAll("form").forEach(function (form) {
    var button = form.querySelector("button");
    if (!button) return;

    // Hidden field that only bots fill in
    var trap = document.createElement("input");
    trap.type = "text"; trap.name = "website"; trap.tabIndex = -1; trap.autocomplete = "off";
    trap.setAttribute("aria-hidden", "true");
    trap.style.cssText = "position:absolute;left:-9999px;width:1px;height:1px;opacity:0";
    form.appendChild(trap);

    function submit(e) {
      if (e) e.preventDefault();
      var data = { area: form.getAttribute("data-area") || "home", page: location.pathname, ref: REF };
      form.querySelectorAll("input").forEach(function (i) {
        if (i.closest(".tcg-code")) return;
        data[fieldName(i)] = i.type === "checkbox" ? i.checked : i.value.trim();
      });
      if (!data.email || data.email.indexOf("@") < 1) { message(form, "Please enter a valid email address."); return; }
      if (data.consent_terms !== true) { message(form, "Please agree to the Terms of use and Privacy policy."); return; }
      button.disabled = true;
      message(form, "Sending…", true);
      post("/api/join", data)
        .then(function (j) {
          if (j.status === 404 || j.status === 502 || j.status === 503) { message(form, "Registration opens very soon. Please check back in a few days."); return; }
          if (!j.ok) { message(form, j.error || "Something went wrong. Please try again."); return; }
          var first = (data.full_name || "").split(" ")[0];
          if (j.whatsapp === "sent") {
            message(form, "You're in! One optional extra: enter the code we sent to your WhatsApp.", true);
            showCodeStep(form, data.email);
          } else {
            showWelcome(form, data.area, first, j.isNew === false);
          }
        })
        .catch(function () { message(form, "Connection problem. Please try again."); })
        .finally(function () { button.disabled = false; });
    }
    button.addEventListener("click", submit);
    form.addEventListener("submit", submit);
  });
})();
