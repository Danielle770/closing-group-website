// The Closing Group — hero: real photos of Netanya, slowly crossfading. If photos can't load, the animated sea shows instead.
(function () {
  var s = document.querySelectorAll(".tcg-slide");
  Array.prototype.forEach.call(s, function (f) {
    var img = f.querySelector("img");
    img.addEventListener("error", function () { f.classList.add("is-broken"); });
  });
  if (s.length < 2) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var i = 0;
  setInterval(function () {
    s[i].classList.remove("is-on");
    i = (i + 1) % s.length;
    s[i].classList.add("is-on");
  }, 6500);
})();
