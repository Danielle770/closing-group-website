// The Closing Group — sign-up forms.
// 1) POST /api/join  2) show the welcome at once (no email link to click)  3) WhatsApp code box only if a code was sent
(function () {
  // Referral: ?ref=<leader> on any page is remembered and sent with the sign-up
  var REF = (function () {
    try { var r = new URLSearchParams(location.search).get("ref"); if (r) localStorage.setItem("cg_ref", r.slice(0, 80)); return r || localStorage.getItem("cg_ref") || ""; }
    catch (e) { return ""; }
  })();
  var FR = /^fr/i.test(document.documentElement.lang || "");
  var KAHILA = { netanya: "Netanya", center: "Center", jerusalem: "Jerusalem" };
  var KAHILA_FR = { netanya: "de Netanya", center: "du Centre", jerusalem: "de J\u00e9rusalem" };
  // French wording for the sign-up messages (English stays as it was)
  var M = FR ? {
    email: "Veuillez saisir une adresse e-mail valide.",
    terms: "Veuillez accepter les Conditions d\u2019utilisation et la Politique de confidentialit\u00e9.",
    sending: "Envoi\u2026",
    soon: "Les inscriptions ouvrent tr\u00e8s bient\u00f4t. Revenez dans quelques jours.",
    oops: "Un probl\u00e8me est survenu. Veuillez r\u00e9essayer.",
    waSent: "Vous y \u00eates\u00a0! Une \u00e9tape facultative en plus\u00a0: saisissez le code que nous avons envoy\u00e9 sur votre WhatsApp.",
    conn: "Probl\u00e8me de connexion. Veuillez r\u00e9essayer.",
    needCode: "Veuillez saisir le code re\u00e7u sur WhatsApp.",
    badCode: "Ce code n\u2019a pas fonctionn\u00e9. Veuillez r\u00e9essayer.",
    newCode: "Un nouveau code est en route vers votre WhatsApp.",
    codeLabel: "Saisissez le code \u00e0 6 chiffres envoy\u00e9 sur votre WhatsApp",
    verify: "V\u00e9rifier WhatsApp", again: "Envoyer un nouveau code"
  } : {
    email: "Please enter a valid email address.",
    terms: "Please agree to the Terms of use and Privacy policy.",
    sending: "Sending\u2026",
    soon: "Registration opens very soon. Please check back in a few days.",
    oops: "Something went wrong. Please try again.",
    waSent: "You're in! One optional extra: enter the code we sent to your WhatsApp.",
    conn: "Connection problem. Please try again.",
    needCode: "Please enter the code from WhatsApp.",
    badCode: "That code did not work. Please try again.",
    newCode: "A new code is on its way to your WhatsApp.",
    codeLabel: "Enter the 6-digit code we sent to your WhatsApp",
    verify: "Verify WhatsApp", again: "Send a new code"
  };
  // Messages that come back from our server in English
  var SERVER_FR = {
    "Too many attempts. Please try again in a few minutes.": "Trop de tentatives. Veuillez r\u00e9essayer dans quelques minutes.",
    "Please enter a valid email address.": "Veuillez saisir une adresse e-mail valide.",
    "Please agree to the Terms of use and Privacy policy.": "Veuillez accepter les Conditions d\u2019utilisation et la Politique de confidentialit\u00e9.",
    "Please enter your WhatsApp number with the country code, for example +1 212 555 0100.": "Veuillez saisir votre num\u00e9ro WhatsApp avec l\u2019indicatif du pays, par exemple +33 6 12 34 56 78.",
    "Something went wrong. Please try again.": "Un probl\u00e8me est survenu. Veuillez r\u00e9essayer.",
    "Too many attempts. Please wait a few minutes.": "Trop de tentatives. Veuillez patienter quelques minutes.",
    "That code did not work. Please check it and try again.": "Ce code n\u2019a pas fonctionn\u00e9. Veuillez le v\u00e9rifier et r\u00e9essayer.",
    "That code did not work, or it expired. Please request a new one.": "Ce code n\u2019a pas fonctionn\u00e9, ou il a expir\u00e9. Veuillez en demander un nouveau.",
    "Please wait a few minutes before asking for another code.": "Veuillez patienter quelques minutes avant de demander un autre code."
  };
  function srv(m) { return FR && m && SERVER_FR[m] ? SERVER_FR[m] : m; }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
  function welcomeHTML_FR(area, firstName) {
    var k = KAHILA_FR[area];
    var head = "Vous y \u00eates\u00a0! Bienvenue dans The Closing Group Isra\u00ebl" + (k ? " \u2014 et dans votre Kahila " + k + "\u00a0!" : "\u00a0!");
    var deal = area === "netanya"
      ? "<p><b>Nous constituons un groupe pour acheter 9 appartements \u00e0 Netanya \u2014 au prix co\u00fbtant du promoteur, en dessous du prix catalogue.</b> Notre objectif\u00a0: \u00e9conomiser environ \u20aa390,000\u2013\u20aa488,000 sur un appartement standard. Le parking et le d\u00e9barras sont inclus.</p>"
      : "<p><b>Nous r\u00e9unissons des familles pour un groupe dans la r\u00e9gion " + (k || "qui vous int\u00e9resse") + ".</b> Lorsqu\u2019un promoteur acceptera de vendre ses derniers appartements termin\u00e9s \u00e0 son prix co\u00fbtant, vous serez parmi les premiers inform\u00e9s.</p>";
    return '<div class="tcg-welcome" role="status" tabindex="-1">' +
      '<p class="tcg-welcome-head"><span aria-hidden="true">\ud83c\udf89 </span>' + esc(head) + "</p>" +
      (firstName ? "<p>Ravis de vous compter parmi nous, " + esc(firstName) + ". Vous faites partie des tout premiers inscrits \u2014 et c\u2019est une bonne place. Voici la suite\u00a0:</p>" : "<p>Vous faites partie des tout premiers inscrits \u2014 et c\u2019est une bonne place. Voici la suite\u00a0:</p>") +
      deal +
      "<p><b>Vous ne payez rien maintenant et vous ne vous engagez \u00e0 rien.</b> \u00c0 l\u2019ouverture du groupe, nous vous montrerons les vrais appartements, les vrais prix et la v\u00e9rification du juste prix. Si vous en choisissez un, votre acompte de \u20aa50,000 est vers\u00e9 directement sur le compte s\u00e9questre de notre cabinet d\u2019avocats partenaire \u2014 jamais \u00e0 nous. Les acheteurs ne paient ni frais d\u2019agence ni frais juridiques\u00a0; c\u2019est le promoteur qui paie.</p>" +
      "<p><b>Ce que vous avez \u00e0 faire maintenant\u00a0: rien.</b> Nous vous \u00e9crirons d\u00e8s qu\u2019il y aura du nouveau \u2014 quand le promoteur donnera son accord, quand le groupe ouvrira, quand il ne restera que les derniers appartements. Un message \u00e0 la fois, seulement quand c\u2019est important.</p>" +
      '<p>Des questions\u00a0? Touchez les jumelles <span aria-hidden="true">\ud83d\udd2d</span> en bas de la page et demandez-nous ce que vous voulez.</p>' +
      '<p class="tcg-welcome-sign">Bienvenue \u00e0 bord,<br>Ram &amp; The Closing Group</p></div>';
  }
  function welcomeHTML(area, firstName) {
    if (FR) return welcomeHTML_FR(area, firstName);
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
    box.innerHTML = returning && FR
      ? '<div class="tcg-welcome" role="status" tabindex="-1"><p class="tcg-welcome-head">Bon retour' + (firstName ? ", " + esc(firstName) : "") + "\u00a0! Vous faites d\u00e9j\u00e0 partie" + (KAHILA_FR[area] ? " de la Kahila " + KAHILA_FR[area] : " du groupe") + ".</p><p>Nous avons mis \u00e0 jour vos informations. Nous vous \u00e9crirons d\u00e8s qu\u2019il y aura une vraie nouvelle.</p></div>"
      : returning
      ? '<div class="tcg-welcome" role="status" tabindex="-1"><p class="tcg-welcome-head">Welcome back' + (firstName ? ", " + esc(firstName) : "") + "! You're already in" + (KAHILA[area] ? " the " + KAHILA[area] + " Kahila" : "") + ".</p><p>We've updated your details. We'll message you the moment there's real news.</p></div>"
      : welcomeHTML(area, firstName);
    var el = box.firstChild;
    // The films come first, right under the welcome line — one tap away
    try {
      if (window.cgMember && window.cgMember.filmsHTML) {
        var head = el.querySelector(".tcg-welcome-head");
        if (head) head.insertAdjacentHTML("afterend", window.cgMember.filmsHTML(area));
      }
    } catch (e) {}
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
    if (!ok) { try { window.cgAnalytics && window.cgAnalytics.track("signup_problem", { message: text, form_area: form.getAttribute("data-area") || "home" }); } catch (e) {} }
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
      '<label style="display:flex;flex-direction:column;gap:6px;font-size:14px;font-weight:500">' + M.codeLabel +
      '<input type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="8" style="min-height:52px;border:1px solid #D2D2D7;border-radius:12px;padding:0 16px;font-family:inherit;font-size:20px;letter-spacing:0.2em;background:#fff"></label>' +
      '<div style="display:flex;flex-wrap:wrap;gap:16px;align-items:center">' +
      '<button type="button" class="tcg-code-ok" style="min-height:48px;border:none;border-radius:999px;background:#A8522F;color:#fff;font-family:inherit;font-size:16px;font-weight:600;padding:0 24px;cursor:pointer">' + M.verify + '</button>' +
      '<button type="button" class="tcg-code-again" style="min-height:44px;border:none;background:none;color:#A8522F;font-family:inherit;font-size:15px;cursor:pointer;padding:0 4px">' + M.again + '</button></div>';
    var msg = form.querySelector(".tcg-msg");
    form.insertBefore(box, msg);
    var input = box.querySelector("input");
    input.focus();
    box.querySelector(".tcg-code-ok").addEventListener("click", function () {
      var code = input.value.replace(/\D/g, "");
      if (code.length < 4) { message(form, M.needCode); return; }
      post("/api/verify-whatsapp", { email: email, code: code }).then(function (j) {
        if (j.ok) { box.remove(); showWelcome(form, form.getAttribute("data-area") || "home", "", false); }
        else message(form, srv(j.error) || M.badCode);
      }).catch(function () { message(form, M.conn); });
    });
    box.querySelector(".tcg-code-again").addEventListener("click", function () {
      post("/api/resend-whatsapp", { email: email }).then(function () { message(form, M.newCode, true); });
    });
  }

  // A member on this device never sees a join form: member.js shows "Welcome back" in its place.
  var MEMBER = null;
  try { MEMBER = window.cgMember && window.cgMember.get(); } catch (e) {}

  document.querySelectorAll("form").forEach(function (form) {
    var button = form.querySelector("button");
    if (!button) return;
    if (MEMBER && form.hasAttribute("data-area")) return;

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
      if (!data.email || data.email.indexOf("@") < 1) { message(form, M.email); return; }
      if (data.consent_terms !== true) { message(form, M.terms); return; }
      button.disabled = true;
      message(form, M.sending, true);
      post("/api/join", data)
        .then(function (j) {
          if (j.status === 404 || j.status === 502 || j.status === 503) { message(form, M.soon); return; }
          if (!j.ok) { message(form, srv(j.error) || M.oops); return; }
          try { window.cgAnalytics && window.cgAnalytics.member(data); } catch (e) {}
          var first = (data.full_name || "").split(" ")[0];
          try { window.cgMember && window.cgMember.remember(data.area, first, data.email); } catch (e) {}
          if (j.whatsapp === "sent") {
            message(form, M.waSent, true);
            showCodeStep(form, data.email);
          } else {
            showWelcome(form, data.area, first, j.isNew === false);
          }
        })
        .catch(function () { message(form, M.conn); })
        .finally(function () { button.disabled = false; });
    }
    button.addEventListener("click", submit);
    form.addEventListener("submit", submit);
  });
})();
