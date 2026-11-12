// The Closing Group — Kahila pages: hero photo crossfade, scroll reveals, animated bars, gentle parallax.
(function () {
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.body.classList.remove("no-js");

  // Photos that fail to load fall back to the warm gradient behind them
  Array.prototype.forEach.call(document.querySelectorAll(".k-page img"), function (img) {
    function broken() { img.classList.add("is-broken"); }
    img.addEventListener("error", broken);
    if (img.complete && img.naturalWidth === 0 && img.getAttribute("src")) broken();
  });

  // Hero: crossfade between photos
  var slides = document.querySelectorAll(".k-slide");
  if (slides.length > 1 && !reduce) {
    var i = 0;
    setInterval(function () {
      slides[i].classList.remove("is-on");
      i = (i + 1) % slides.length;
      slides[i].classList.add("is-on");
    }, 6500);
  }

  // Reveal on scroll: fade-ups, price bars, progress bars
  var targets = document.querySelectorAll(".k-up, .k-compare, .k-apt");
  if (!("IntersectionObserver" in window) || reduce) {
    Array.prototype.forEach.call(targets, function (el) { el.classList.add("is-in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.18, rootMargin: "0px 0px -6% 0px" });
    Array.prototype.forEach.call(targets, function (el) { io.observe(el); });
  }

  // Gentle parallax on the large photos
  var par = document.querySelectorAll("[data-parallax]");
  if (!par.length || reduce) return;
  var ticking = false;
  function move() {
    var vh = window.innerHeight;
    Array.prototype.forEach.call(par, function (img) {
      var box = img.parentNode.getBoundingClientRect();
      if (box.bottom < 0 || box.top > vh) return;
      var p = (box.top + box.height / 2 - vh / 2) / vh; // -1 … 1
      var k = parseFloat(img.getAttribute("data-parallax")) || 50; // max shift in px
      img.style.transform = "translate3d(0," + (Math.max(-1, Math.min(1, p)) * -k).toFixed(1) + "px,0)";
    });
    ticking = false;
  }
  window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(move); } }, { passive: true });
  window.addEventListener("resize", move);
  move();
  // Builder's estimate countdowns: days, hours, minutes until each estimated date (Israel time)
  var counts = document.querySelectorAll(".k-count-row[data-from]");
  function unit(n, one, many) { return "<span><b>" + n + "</b><small>" + (n === 1 ? one : many) + "</small></span>"; }
  function tick() {
    var now = Date.now();
    Array.prototype.forEach.call(counts, function (row) {
      var to = new Date(row.getAttribute("data-from") + "T00:00:00+02:00").getTime();
      var mins = Math.ceil((to - now) / 60000);
      var num = row.querySelector(".k-count-num");
      if (mins > 0) {
        var d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
        num.innerHTML = unit(d, "day", "days") + unit(h, "hour", "hours") + unit(m, "minute", "minutes");
        row.classList.remove("is-due");
      } else {
        num.innerHTML = "<span><b>Expected any day</b></span>";
        row.classList.add("is-due");
      }
    });
  }
  if (counts.length) { tick(); setInterval(tick, 15000); }
})();
