// The Closing Group — sign-up forms.
// Sends the form to /api/join (to be added on the server). Until that exists,
// visitors see a friendly message instead of an error.
(function () {
  function fieldName(input) {
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
    if (!el) { el = document.createElement("p"); el.className = "tcg-msg"; el.setAttribute("role", "status"); form.appendChild(el); }
    el.textContent = text;
    el.classList.toggle("ok", !!ok);
  }

  document.querySelectorAll("form").forEach(function (form) {
    var button = form.querySelector("button");
    if (!button) return;
    function submit(e) {
      if (e) e.preventDefault();
      var data = { area: form.getAttribute("data-area") || "home", page: location.pathname };
      form.querySelectorAll("input").forEach(function (i) { data[fieldName(i)] = i.type === "checkbox" ? i.checked : i.value.trim(); });
      if (!data.email || data.email.indexOf("@") < 1) { message(form, "Please enter a valid email address."); return; }
      if (data.consent_terms === false) { message(form, "Please agree to the Terms of use and Privacy policy."); return; }
      button.disabled = true;
      fetch("/api/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
        .then(function (r) {
          if (!r.ok) throw new Error("not ready");
          message(form, "Thank you. Check your email and WhatsApp to verify, and you're in the kahila.", true);
        })
        .catch(function () {
          message(form, "Registration opens very soon. Please check back in a few days.");
        })
        .finally(function () { button.disabled = false; });
    }
    button.addEventListener("click", submit);
    form.addEventListener("submit", submit);
  });
})();
