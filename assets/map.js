// The Closing Group — home map: gold Israel, approach on load, pulsing pins, zoom into a Kahila.
(function () {
  var svg = document.getElementById("tcg-map");
  if (!svg) return;
  var wrap = svg.parentNode;
  var panel = document.getElementById("tcg-panel");
  var data = JSON.parse(document.getElementById("tcg-kahilot").textContent);
  var views = JSON.parse(svg.getAttribute("data-views"));
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var active = null, raf = null, lastFocus = null, current = null, rest = "israel";

  function aspect() { var r = wrap.getBoundingClientRect(); return r.height && r.width ? r.height / r.width : 1.4; }
  function boxFor(name) {
    var v = views[name], a = aspect(), w = v.w, h = w * a;
    if (v.minH && h < v.minH) { h = v.minH; w = h / a; }
    var up = (name !== "home" && name !== "israel") ? h * 0.2 : 0; // keep pins clear of the panel
    return [v.cx - w / 2, v.cy - h / 2 + up, w, h];
  }
  function setBox(b) { current = b; svg.setAttribute("viewBox", b.map(function (n) { return n.toFixed(3); }).join(" ")); }
  function ease(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function animateTo(target, ms, done) {
    if (raf) cancelAnimationFrame(raf);
    if (reduce || !current) { setBox(target); raf = null; if (done) done(); return; }
    // zoom in log space so big zooms feel smooth
    var from = current.slice(), t0 = performance.now();
    var fc = [from[0] + from[2] / 2, from[1] + from[3] / 2], tc = [target[0] + target[2] / 2, target[1] + target[3] / 2];
    (function step(now) {
      var t = Math.min(1, (now - t0) / ms), e = ease(t);
      var w = Math.exp(Math.log(from[2]) + (Math.log(target[2]) - Math.log(from[2])) * e);
      var h = w * (target[3] / target[2]);
      var cx = fc[0] + (tc[0] - fc[0]) * e, cy = fc[1] + (tc[1] - fc[1]) * e;
      setBox([cx - w / 2, cy - h / 2, w, h]);
      if (t < 1) raf = requestAnimationFrame(step); else { raf = null; if (done) done(); }
    })(t0);
  }
  function each(sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); }

  // Start wide on the region, then glide in to Israel
  setBox(boxFor(reduce ? "israel" : "home"));
  function approach() { animateTo(boxFor("israel"), 2600, function () { svg.classList.add("is-near"); }); }
  if (reduce) svg.classList.add("is-near");
  else if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); setTimeout(approach, 500); } }, { threshold: .35 });
    io.observe(wrap);
  } else approach();
  setTimeout(function () { svg.classList.add("is-near"); }, 3800);

  function open(id, fromEl) {
    var d = data[id]; if (!d) return;
    active = id; lastFocus = fromEl || null;
    svg.classList.add("is-zoomed", "is-near"); wrap.classList.add("is-zoomed");
    each("#tcg-map .tcg-sub", function (el) { el.classList.toggle("is-on", el.getAttribute("data-region") === id); });
    each(".tcg-chip", function (c) { c.setAttribute("aria-pressed", c.getAttribute("data-region") === id ? "true" : "false"); });
    animateTo(boxFor(id), 1500);
    var img = panel.querySelector("img");
    img.src = d.img; img.alt = d.alt;
    panel.querySelector(".tcg-panel-kicker").textContent = "Kahila (community)";
    panel.querySelector(".tcg-panel-title").textContent = d.name;
    panel.querySelector(".tcg-panel-cities").textContent = d.cities;
    panel.querySelector(".tcg-panel-status").textContent = d.status;
    var go = panel.querySelector(".tcg-panel-go");
    go.href = d.href; go.textContent = "Enter " + d.name.replace(/^The /, "the ") + " ›";
    panel.hidden = false;
    panel.style.animation = "none"; img.style.animation = "none"; void panel.offsetWidth; panel.style.animation = ""; img.style.animation = "";
    if (fromEl && fromEl.closest && fromEl.closest("#tcg-map")) go.focus({ preventScroll: true });
  }
  function close() {
    if (!active) return;
    active = null;
    svg.classList.remove("is-zoomed"); wrap.classList.remove("is-zoomed");
    each("#tcg-map .tcg-sub", function (el) { el.classList.remove("is-on"); });
    each(".tcg-chip", function (c) { c.setAttribute("aria-pressed", "false"); });
    panel.hidden = true;
    animateTo(boxFor(rest), 1300);
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }

  each("#tcg-map .tcg-pin", function (pin) {
    var id = pin.getAttribute("data-region");
    pin.addEventListener("click", function () { open(id, pin); });
    pin.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(id, pin); } });
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
  window.addEventListener("resize", function () { if (!raf) setBox(boxFor(active || rest)); });
})();
