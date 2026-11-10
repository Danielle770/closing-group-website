// The Closing Group — small floating map of Israel. Hover (or tap) a city to see its Kahila; nothing locks or zooms.
(function () {
  var svg = document.getElementById("tcg-map");
  if (!svg) return;
  var wrap = svg.parentNode;
  var pop = document.getElementById("tcg-pop");
  var data = JSON.parse(document.getElementById("tcg-kahilot").textContent);
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var canHover = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var views = { home: { cx: 506.78, cy: 561.42, w: 640 }, israel: { cx: 507, cy: 556, w: 200, minH: 420 } };
  var current = null, raf = null, active = null, hideT = null;

  function aspect() { var r = wrap.getBoundingClientRect(); return r.height && r.width ? r.height / r.width : 1.5; }
  function boxFor(name) {
    var v = views[name], a = aspect(), w = v.w, h = w * a;
    if (v.minH && h < v.minH) { h = v.minH; w = h / a; }
    return [v.cx - w / 2, v.cy - h / 2, w, h];
  }
  function setBox(b) { current = b; svg.setAttribute("viewBox", b.map(function (n) { return n.toFixed(3); }).join(" ")); }
  function ease(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function animateTo(target, ms, done) {
    if (reduce || !current) { setBox(target); if (done) done(); return; }
    var from = current.slice(), t0 = performance.now();
    var fc = [from[0] + from[2] / 2, from[1] + from[3] / 2], tc = [target[0] + target[2] / 2, target[1] + target[3] / 2];
    (function step(now) {
      var t = Math.min(1, (now - t0) / ms), e = ease(t);
      var w = Math.exp(Math.log(from[2]) + (Math.log(target[2]) - Math.log(from[2])) * e), h = w * (target[3] / target[2]);
      var cx = fc[0] + (tc[0] - fc[0]) * e, cy = fc[1] + (tc[1] - fc[1]) * e;
      setBox([cx - w / 2, cy - h / 2, w, h]);
      if (t < 1) raf = requestAnimationFrame(step); else { raf = null; if (done) done(); }
    })(t0);
  }

  // One gentle glide in from the region to Israel, then the map stays put.
  setBox(boxFor(reduce ? "israel" : "home"));
  function approach() { animateTo(boxFor("israel"), 2200, function () { svg.classList.add("is-near"); }); }
  if (reduce) svg.classList.add("is-near");
  else if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); setTimeout(approach, 300); } }, { threshold: .3 });
    io.observe(wrap);
  } else approach();
  setTimeout(function () { svg.classList.add("is-near"); }, 3200);

  // Floating card beside the pin
  function place(pin) {
    var core = pin.querySelector(".tcg-core").getBoundingClientRect();
    var lab = pin.querySelector(".tcg-label").getBoundingClientRect();
    var wr = wrap.getBoundingClientRect();
    var px = core.left + core.width / 2, py = core.top + core.height / 2;
    var cw = pop.offsetWidth, ch = pop.offsetHeight, gap = 18, vw = document.documentElement.clientWidth;
    // Prefer the sea side (left of the coast); flip right if there's no room.
    var left = Math.min(lab.left, core.left) - gap - cw, side = "left";
    if (left < 8) { left = px + gap; side = "right"; }
    if (left + cw > vw - 8) { left = Math.max(8, vw - 8 - cw); side = "below"; }
    var top = side === "below" ? py + gap : py - ch / 2;
    pop.style.left = (left - wr.left) + "px";
    pop.style.top = (top - wr.top) + "px";
    pop.setAttribute("data-side", side);
  }
  function show(id, pin) {
    clearTimeout(hideT);
    var d = data[id]; if (!d) return;
    each(".tcg-pin", function (p) { p.classList.toggle("is-active", p === pin); });
    if (active !== id) {
      active = id;
      pop.querySelector(".tcg-pop-title").textContent = d.name.replace(/^The /, "");
      pop.querySelector(".tcg-pop-cities").textContent = d.cities;
      pop.querySelector(".tcg-pop-status").textContent = d.status;
      var go = pop.querySelector(".tcg-pop-go"); go.href = d.href;
      pop.hidden = false;
      pop.classList.remove("is-in"); void pop.offsetWidth; pop.classList.add("is-in");
    }
    place(pin);
    wrap.classList.add("is-open");
  }
  function hide(now) {
    clearTimeout(hideT);
    hideT = setTimeout(function () {
      active = null; pop.hidden = true; wrap.classList.remove("is-open");
      each(".tcg-pin", function (p) { p.classList.remove("is-active"); });
    }, now ? 0 : 220);
  }
  function each(sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); }

  each("#tcg-map .tcg-pin", function (pin) {
    var id = pin.getAttribute("data-region");
    if (canHover) {
      pin.addEventListener("mouseenter", function () { show(id, pin); });
      pin.addEventListener("mouseleave", function () { hide(); });
    }
    pin.addEventListener("click", function (e) { e.stopPropagation(); if (active === id && !canHover) hide(true); else show(id, pin); });
    pin.addEventListener("focus", function () { if (pin.matches(":focus-visible")) show(id, pin); });
    pin.addEventListener("blur", function () { hide(); });
    pin.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); location.href = data[id].href; } });
  });
  var hint = wrap.querySelector(".tcg-map-hint"); if (hint && !canHover) hint.textContent = "Tap a city";
  pop.addEventListener("mouseenter", function () { clearTimeout(hideT); });
  pop.addEventListener("mouseleave", function () { hide(); });
  pop.addEventListener("focusin", function () { clearTimeout(hideT); });
  pop.addEventListener("click", function (e) { e.stopPropagation(); });
  document.addEventListener("click", function () { if (active) hide(true); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") hide(true); });
  window.addEventListener("scroll", function () { if (active && !canHover) hide(true); }, { passive: true });
  window.addEventListener("resize", function () { if (!raf) setBox(boxFor("israel")); if (active) hide(true); });
})();
