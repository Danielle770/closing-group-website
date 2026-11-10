// The Closing Group — home map: pulse, hover, zoom into a Kahila, show its panel.
(function () {
  var svg = document.getElementById("tcg-map");
  if (!svg) return;
  var wrap = svg.parentNode;
  var panel = document.getElementById("tcg-panel");
  var data = JSON.parse(document.getElementById("tcg-kahilot").textContent);
  var regions = JSON.parse(svg.getAttribute("data-regions"));
  var home = svg.getAttribute("viewBox").split(" ").map(Number);
  var current = home.slice();
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var active = null, raf = null, lastFocus = null;

  function setBox(b) { current = b; svg.setAttribute("viewBox", b.map(function (n) { return n.toFixed(2); }).join(" ")); }
  function ease(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function animateTo(target, ms) {
    if (raf) cancelAnimationFrame(raf);
    if (reduce) { setBox(target); raf = null; return; }
    var from = current.slice(), t0 = performance.now();
    (function step(now) {
      var t = Math.min(1, (now - t0) / ms), e = ease(t);
      setBox(from.map(function (v, i) { return v + (target[i] - v) * e; }));
      raf = t < 1 ? requestAnimationFrame(step) : null;
    })(t0);
  }
  function boxFor(id) {
    var r = regions[id], w = home[2] / r.k, h = home[3] / r.k;
    // nudge the view up a little so the panel at the bottom does not cover the pins
    return [r.cx - w / 2, r.cy - h / 2 + h * 0.12, w, h];
  }
  function each(sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); }

  function open(id, fromEl) {
    var d = data[id]; if (!d) return;
    active = id; lastFocus = fromEl || null;
    svg.classList.add("is-zoomed"); wrap.classList.add("is-zoomed");
    each("#tcg-map .tcg-sub, #tcg-map .tcg-glow", function (el) { el.classList.toggle("is-on", el.getAttribute("data-region") === id); });
    each(".tcg-chip", function (c) { c.setAttribute("aria-pressed", c.getAttribute("data-region") === id ? "true" : "false"); });
    animateTo(boxFor(id), 1300);
    var img = panel.querySelector("img");
    img.src = d.img; img.alt = d.alt;
    panel.querySelector(".tcg-panel-kicker").textContent = "Kahila (community)";
    panel.querySelector(".tcg-panel-title").textContent = d.name;
    panel.querySelector(".tcg-panel-cities").textContent = d.cities;
    panel.querySelector(".tcg-panel-status").textContent = d.status;
    var go = panel.querySelector(".tcg-panel-go");
    go.href = d.href; go.textContent = "Enter " + d.name.replace(/^The /, "the ") + " ›";
    panel.hidden = false;
    // restart the entrance animations
    panel.style.animation = "none"; img.style.animation = "none"; void panel.offsetWidth; panel.style.animation = ""; img.style.animation = "";
    if (fromEl && fromEl.closest && fromEl.closest("#tcg-map")) go.focus({ preventScroll: true });
  }
  function close() {
    if (!active) return;
    active = null;
    svg.classList.remove("is-zoomed"); wrap.classList.remove("is-zoomed");
    each("#tcg-map .tcg-sub, #tcg-map .tcg-glow", function (el) { el.classList.remove("is-on"); });
    each(".tcg-chip", function (c) { c.setAttribute("aria-pressed", "false"); });
    panel.hidden = true;
    animateTo(home, 1100);
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }

  each("#tcg-map .tcg-pin", function (pin) {
    var id = pin.getAttribute("data-region");
    pin.addEventListener("click", function () { open(id, pin); });
    pin.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(id, pin); } });
    pin.addEventListener("mouseenter", function () { if (!active) each('#tcg-map .tcg-glow[data-region="' + id + '"]', function (g) { g.style.opacity = "1"; }); });
    pin.addEventListener("mouseleave", function () { each("#tcg-map .tcg-glow", function (g) { g.style.opacity = ""; }); });
  });
  each(".tcg-chip", function (chip) {
    chip.setAttribute("aria-pressed", "false");
    chip.addEventListener("click", function () {
      var id = chip.getAttribute("data-region");
      if (active === id) { close(); return; }
      open(id, chip);
      if (wrap.getBoundingClientRect().top > window.innerHeight * 0.5) wrap.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    });
  });
  panel.querySelector(".tcg-back").addEventListener("click", close);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });

  // Gentle drift so the map never feels frozen (stops while zoomed, or if motion is reduced)
  if (!reduce) {
    var t0 = performance.now();
    (function drift(now) {
      if (!active && !raf) {
        var s = (now - t0) / 1000;
        svg.setAttribute("viewBox", [home[0] + Math.sin(s / 7) * 8, home[1] + Math.cos(s / 9) * 10, home[2], home[3]].map(function (n) { return n.toFixed(2); }).join(" "));
      }
      requestAnimationFrame(drift);
    })(t0);
  }
})();
