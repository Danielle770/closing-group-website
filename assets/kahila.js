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
})();
