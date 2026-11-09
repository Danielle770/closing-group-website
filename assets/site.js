// The Closing Group — sign-up forms.
// 1) POST /api/join  2) if a WhatsApp code was sent, show a code box  3) POST /api/verify-whatsapp
(function () {
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
        if (j.ok) { box.remove(); message(form, "WhatsApp verified. Last step: click the link we emailed you, and you're in the kahila.", true); }
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
      var data = { area: form.getAttribute("data-area") || "home", page: location.pathname };
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
          if (j.whatsapp === "sent") {
            message(form, "Almost there. We sent a code to your WhatsApp and a link to your email.", true);
            showCodeStep(form, data.email);
          } else if (j.emailVerified) {
            message(form, "You're already in the kahila. We've updated your details.", true);
          } else {
            message(form, "Almost there. Click the link we sent to your email, and you're in the kahila.", true);
          }
        })
        .catch(function () { message(form, "Connection problem. Please try again."); })
        .finally(function () { button.disabled = false; });
    }
    button.addEventListener("click", submit);
    form.addEventListener("submit", submit);
  });
})();
