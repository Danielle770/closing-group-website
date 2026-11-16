/* Halperin apartment picker (French page). Kept in an external file because the
   Content-Security-Policy is script-src 'self' (no inline scripts). */
const APTS = [
  { id: "65", tag: "Penthouse", title: "Appartement 65", short: "Penthouse · 18e étage",
    text: "Le sommet de l’immeuble. Quatre chambres : trois en suite, plus un mamad (pièce de sécurité). Un grand salon et une salle à manger, et un immense balcon qui donne sur la ville jusqu’à la mer.",
    facts: [["Étage", "18"], ["Chambres", "4 : 3 en suite + mamad"], ["Séjour", "Salon et salle à manger"], ["Superficie", "À confirmer"], ["Balcon", "Immense (superficie à confirmer)"], ["Plan", "Bientôt disponible"], ["Vue", "Mer et ville"], ["Livraison", "Prévue March 2027"]],
    view: "/netanya/halperin/img/view-65.jpg", room: "/netanya/halperin/img/room-65.jpg", roomcap: "Le séjour, avec le balcon et la mer au-delà des vitres.",
    video: "/netanya/halperin/media/apt-65.mp4", len: "1:28" },
  { id: "63", tag: "Penthouse", title: "Appartement 63", short: "Penthouse · 17e étage",
    text: "Le deuxième penthouse, au 17e étage. Quatre chambres : trois en suite, plus un mamad (pièce de sécurité). Un grand salon et une salle à manger, et un immense balcon avec la mer au-dessus des toits. Celui-ci est encore à un stade de travaux moins avancé que les autres : le film montre des matériaux de construction à l’intérieur et sur le balcon.",
    facts: [["Étage", "17"], ["Chambres", "4 : 3 en suite + mamad"], ["Séjour", "Salon et salle à manger"], ["Superficie", "À confirmer"], ["Balcon", "Immense (superficie à confirmer)"], ["Plan", "Bientôt disponible"], ["Vue", "Mer et ville"], ["Livraison", "Prévue March 2027"]],
    view: "/netanya/halperin/img/view-63.jpg", room: "/netanya/halperin/img/room-63.jpg", roomcap: "Le salon aujourd’hui, avec des matériaux de construction encore entreposés à l’intérieur.",
    video: "/netanya/halperin/media/apt-63.mp4", len: "1:23" },
  { id: "61", tag: "Appartement", title: "Appartement 61", short: "16e étage · 125 m²",
    text: "Tout en haut, au 16e étage, avec un grand balcon d’environ 16 m² donnant sur Netanya.",
    facts: [["Étage", "16"], ["Superficie", "125 m²"], ["Balcon", "Environ 16 m²"], ["Chambres", "4"], ["Salles de bains", "2.5"], ["Livraison", "Prévue March 2027"]],
    view: "/netanya/halperin/img/view-61.jpg", room: "/netanya/halperin/img/room-61.jpg", roomcap: "Le salon, qui s’ouvre sur le balcon.",
    video: "/netanya/halperin/media/apt-61.mp4", len: "1:30" },
  { id: "60", soon: true, tag: "Appartement", title: "Appartement 60", short: "16e étage · film bientôt disponible",
    text: "Quatre chambres, dans le même immeuble. Nous filmons chaque appartement avant de le présenter, et le film de celui-ci sera bientôt disponible.",
    facts: [["Étage", "16"], ["Superficie", "123.5 m²"], ["Balcon", "Environ 16 m²"], ["Chambres", "4"], ["Salles de bains", "2.5"], ["Film", "Bientôt disponible"], ["Livraison", "Prévue March 2027"]],
    view: "/netanya/halperin/img/building.jpg" },
  { id: "54", soon: true, tag: "Appartement", title: "Appartement 54", short: "Film bientôt disponible",
    text: "Quatre chambres, dans le même immeuble. Nous filmons chaque appartement avant de le présenter, et le film de celui-ci sera bientôt disponible.",
    facts: [["Superficie", "123.5 m² (à confirmer)"], ["Balcon", "Environ 16 m²"], ["Chambres", "4"], ["Salles de bains", "2.5"], ["Film", "Bientôt disponible"], ["Livraison", "Prévue March 2027"]],
    view: "/netanya/halperin/img/building.jpg" },
  { id: "53", tag: "Appartement", title: "Appartement 53", short: "14e étage · 4 chambres",
    text: "Quatre chambres au 14e étage, avec un balcon attenant au salon qui donne sur la ville jusqu’à la mer, entre les tours. Encore en phase finale de travaux : le film montre des cartons et des matériaux dans certaines pièces.",
    facts: [["Étage", "14"], ["Superficie", "125 m² (à confirmer)"], ["Balcon", "Environ 16 m²"], ["Chambres", "4"], ["Salles de bains", "2.5"], ["Vue", "Ville, mer entre les tours"], ["Livraison", "Prévue March 2027"]],
    view: "/netanya/halperin/img/view-53.jpg", room: "/netanya/halperin/img/room-53.jpg", roomcap: "Le salon aujourd’hui, en direction du balcon.",
    video: "/netanya/halperin/media/apt-53.mp4", len: "1:22" },
  { id: "49", tag: "Appartement", title: "Appartement 49", short: "13e étage · 125 m²",
    text: "125 m² avec un long salon qui se prolonge jusqu’à un balcon à garde-corps en verre.",
    facts: [["Étage", "13"], ["Superficie", "125 m²"], ["Balcon", "Environ 16 m²"], ["Chambres", "4"], ["Salles de bains", "2.5"], ["Livraison", "Prévue March 2027"]],
    view: "/netanya/halperin/img/view-49.jpg", room: "/netanya/halperin/img/room-49.jpg", roomcap: "Le salon, en direction des portes du balcon.",
    video: "/netanya/halperin/media/apt-49.mp4", len: "1:27" },
  { id: "45", tag: "Appartement", title: "Appartement 45", short: "12e étage · 4 chambres",
    text: "Quatre chambres, avec des portes vitrées toute hauteur du salon vers le balcon.",
    facts: [["Étage", "12"], ["Superficie", "125 m² (à confirmer)"], ["Balcon", "Environ 16 m²"], ["Chambres", "4"], ["Salles de bains", "2.5"], ["Livraison", "Prévue March 2027"]],
    view: "/netanya/halperin/img/view-45.jpg", room: "/netanya/halperin/img/room-45.jpg", roomcap: "Portes vitrées du salon vers le balcon.",
    video: "/netanya/halperin/media/apt-45.mp4", len: "1:30" },
  { id: "42", tag: "Appartement", title: "Appartement 42", short: "4 chambres · aperçu de la mer",
    text: "Quatre chambres, et un balcon avec la mer à l’horizon, entre les tours.",
    facts: [["Superficie", "123.5 m² (à confirmer)"], ["Balcon", "Environ 16 m²"], ["Chambres", "4"], ["Salles de bains", "2.5"], ["Vue", "Mer entre les tours"], ["Livraison", "Prévue March 2027"]],
    view: "/netanya/halperin/img/view-42.jpg", room: "/netanya/halperin/img/room-42.jpg", roomcap: "Le salon et son mur de portes vitrées.",
    video: "/netanya/halperin/media/apt-42.mp4", len: "1:29" },
];

const picker = document.getElementById("picker");
const $ = (id) => document.getElementById(id);
let current = null;

APTS.forEach((a, i) => {
  const b = document.createElement("button");
  b.className = "pick";
  b.id = "tab-" + a.id;
  b.setAttribute("role", "tab");
  b.setAttribute("aria-controls", "apt-panel");
  b.innerHTML = `<img src="${a.view}" alt="" loading="lazy"><span><b>${a.label || "Appt " + a.id}</b><small>${a.short}</small></span>`;
  b.addEventListener("click", () => show(a.id, true));
  b.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = (i + (e.key === "ArrowRight" ? 1 : APTS.length - 1)) % APTS.length;
    show(APTS[next].id, true);
    $("tab-" + APTS[next].id).focus();
  });
  picker.appendChild(b);
});

function show(id, user) {
  const a = APTS.find((x) => x.id === id) || APTS[0];
  if (current === a.id) return;
  current = a.id;
  APTS.forEach((x) => {
    const t = $("tab-" + x.id);
    t.setAttribute("aria-selected", x.id === a.id ? "true" : "false");
    t.tabIndex = x.id === a.id ? 0 : -1;
  });
  $("apt-panel").setAttribute("aria-labelledby", "tab-" + a.id);
  $("p-view").src = a.view;
  $("p-view").alt = a.soon ? "L’immeuble de la rue Halperin, où se trouve l’appartement " + a.id : "Vue depuis le balcon de " + (a.name || "l’appartement " + a.id);
  $("p-viewlabel").textContent = a.soon ? "L’IMMEUBLE · FILM DE L’APPARTEMENT " + a.id + " BIENTÔT DISPONIBLE" : "VUE DEPUIS LE BALCON · " + (a.label || "APPARTEMENT " + a.id).toUpperCase();
  document.querySelector(".tour").style.display = a.soon ? "none" : "";
  $("p-viewline").textContent = a.soon ? "L’immeuble de la rue Halperin." : "Vos matins, vus d’ici.";
  $("p-tag").textContent = a.tag;
  $("p-title").textContent = a.title;
  $("p-text").textContent = a.text;
  $("p-dl").innerHTML = a.facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
  const v = $("p-video");
  v.pause();
  if (a.soon) { v.removeAttribute("src"); v.load(); if (user) { try { history.replaceState(null, "", "#apt-" + a.id); } catch (e) {} } return; }
  v.poster = a.view;
  v.src = a.video;
  v.setAttribute("aria-label", "Visite de " + (a.name || "l’appartement " + a.id));
  $("p-tourtext").textContent = `Visite de ${a.name || "l’appartement " + a.id}, ${a.len}. Sans son : juste l’appartement tel qu’il est aujourd’hui.`;
  $("p-room").src = a.room;
  $("p-room").alt = a.roomcap;
  $("p-roomcap").textContent = a.roomcap;
  if (user) { try { history.replaceState(null, "", "#apt-" + a.id); } catch (e) {} }
}

const fromHash = (location.hash.match(/^#apt-(\w+)$/) || [])[1];
show(fromHash || "65", false);
if (fromHash) document.getElementById("apartments").scrollIntoView();

// Only one film plays at a time.
document.addEventListener("play", (e) => {
  document.querySelectorAll("video").forEach((v) => {
    if (v !== e.target && v.id !== "heroVideo") v.pause();
  });
}, true);

// Respect reduced motion: keep the hero still.
const hero = $("heroVideo");
if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  hero.removeAttribute("autoplay");
  hero.pause();
} else {
  hero.play().catch(() => {});
}
