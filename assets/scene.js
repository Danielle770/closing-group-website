// The Closing Group — hero backdrop: the Mediterranean at sunset off Israel's coast, drawn live.
(function () {
  var c = document.getElementById("tcg-scene");
  if (!c || !c.getContext) return;
  var ctx = c.getContext("2d");
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var W = 0, H = 0, dpr = 1, glints = [], running = true, last = 0;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function size() {
    var r = c.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    glints = [];
    var n = Math.round(W * H / 2600);
    for (var i = 0; i < n; i++) glints.push({ x: Math.random(), y: Math.random(), l: rand(6, 26), p: rand(0, 6.28), s: rand(.6, 1.6) });
  }

  function draw(t) {
    var hz = H * (W < 734 ? .5 : .58);            // horizon
    var shore = H * .9;                            // where the sand starts
    var sunX = W * (W < 734 ? .7 : .58), sunR = Math.max(28, Math.min(W, H) * .07);

    // Sky
    var g = ctx.createLinearGradient(0, 0, 0, hz);
    g.addColorStop(0, "#03050A"); g.addColorStop(.55, "#120F18"); g.addColorStop(.85, "#3E2414"); g.addColorStop(1, "#8A4E1E");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, hz + 1);

    // Sun glow + half-set sun
    var glow = ctx.createRadialGradient(sunX, hz, 0, sunX, hz, sunR * 9);
    glow.addColorStop(0, "rgba(255,190,110,.55)"); glow.addColorStop(.25, "rgba(220,130,60,.22)"); glow.addColorStop(1, "rgba(220,130,60,0)");
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, hz);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, hz); ctx.clip();
    var bob = reduce ? 0 : Math.sin(t / 9000) * sunR * .08;
    ctx.fillStyle = "#FFD9A0"; ctx.beginPath(); ctx.arc(sunX, hz + sunR * .35 + bob, sunR, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // A low coastal skyline far off on the right
    ctx.fillStyle = "rgba(8,6,8,.85)";
    var bx = W * .8, bw = W * .2;
    ctx.beginPath(); ctx.moveTo(bx, hz);
    var heights = [.010, .022, .016, .03, .02, .036, .024, .014, .028, .018, .012];
    for (var i = 0; i < heights.length; i++) { var x0 = bx + bw * i / heights.length, x1 = bx + bw * (i + 1) / heights.length; ctx.lineTo(x0, hz - H * heights[i]); ctx.lineTo(x1 - 2, hz - H * heights[i]); }
    ctx.lineTo(W, hz); ctx.closePath(); ctx.fill();

    // Sea
    var s = ctx.createLinearGradient(0, hz, 0, shore);
    s.addColorStop(0, "#2A1C14"); s.addColorStop(.25, "#0E1219"); s.addColorStop(1, "#05070B");
    ctx.fillStyle = s; ctx.fillRect(0, hz, W, shore - hz);

    // Golden road of light on the water
    for (var k = 0; k < glints.length; k++) {
      var p = glints[k], y = hz + 2 + Math.pow(p.y, 1.6) * (shore - hz - 4);
      var depth = (y - hz) / (shore - hz);
      var spread = sunR * (1.2 + depth * 5);
      var x = sunX + (p.x - .5) * 2 * spread + (reduce ? 0 : Math.sin(t / 1400 * p.s + p.p) * 6 * depth);
      var a = (1 - Math.abs(p.x - .5) * 2) * (reduce ? .5 : (.35 + .65 * Math.max(0, Math.sin(t / 700 * p.s + p.p))));
      ctx.strokeStyle = "rgba(255,206,140," + (a * (1 - depth * .55)).toFixed(3) + ")";
      ctx.lineWidth = 1 + depth * 1.4;
      ctx.beginPath(); ctx.moveTo(x - p.l * (.4 + depth) / 2, y); ctx.lineTo(x + p.l * (.4 + depth) / 2, y); ctx.stroke();
    }

    // Swell lines
    ctx.lineWidth = 1;
    for (var r = 0; r < 7; r++) {
      var yy = hz + (shore - hz) * (.18 + r * .12) + (reduce ? 0 : Math.sin(t / 2200 + r) * 3);
      ctx.strokeStyle = "rgba(200,170,130," + (.04 + r * .012) + ")";
      ctx.beginPath();
      for (var xx = 0; xx <= W; xx += 24) ctx.lineTo(xx, yy + Math.sin(xx / (90 + r * 20) + t / 1800 + r) * (1 + r * .6));
      ctx.stroke();
    }

    // Sand + rolling foam
    var wash = reduce ? 0 : (Math.sin(t / 2600) * .5 + .5);
    var edge = shore - 6 + wash * 10;
    var sand = ctx.createLinearGradient(0, edge, 0, H);
    sand.addColorStop(0, "#2B2118"); sand.addColorStop(1, "#120D09");
    ctx.fillStyle = sand; ctx.beginPath(); ctx.moveTo(0, H);
    for (var fx = 0; fx <= W; fx += 16) ctx.lineTo(fx, edge + Math.sin(fx / 70 + t / 1500) * 3);
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(255,240,215," + (.18 + (1 - wash) * .25).toFixed(3) + ")"; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (var fx2 = 0; fx2 <= W; fx2 += 16) ctx.lineTo(fx2, edge + Math.sin(fx2 / 70 + t / 1500) * 3);
    ctx.stroke();
  }

  function frame(now) {
    if (!running) return;
    if (now - last > 33) { last = now; draw(now); }
    requestAnimationFrame(frame);
  }
  size();
  window.addEventListener("resize", function () { size(); draw(performance.now()); });
  if (reduce) { draw(0); return; }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      var vis = es[0].isIntersecting;
      if (vis && !running) { running = true; requestAnimationFrame(frame); }
      running = vis;
    }).observe(c);
  }
  requestAnimationFrame(frame);
})();
