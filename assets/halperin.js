/* Halperin Street page (/netanya/halperin/ and /fr/netanya/halperin/).
   The apartment picker, the walk-through film, the room photos in "Reading an Israeli listing", and the hero film.
   This lives in its own file because the site's Content-Security-Policy (script-src 'self') blocks inline scripts.
   The page language comes from <html lang="fr">; everything else is shared. */
(function () {
  "use strict";
  var FR = (document.documentElement.lang || "").toLowerCase().indexOf("fr") === 0;
  var BASE = "/netanya/halperin/";
  var IMG = BASE + "img/";
  var MEDIA = BASE + "media/";
  var LOGO = "/assets/closing-group-logo.png";   // stands in for a room the film doesn't show
  var $ = function (id) { return document.getElementById(id); };

  // Apartments. Each one with a film also has stills of its rooms, taken from that film:
  // img/room-N.jpg (living & dining), img/room-N-bed1.jpg … room-N-bed4.jpg,
  // img/room-N-bath-parents.jpg, room-N-bath-family.jpg and room-N-guest-wc.jpg.
  // The same pattern in every apartment: bedroom 1 is the suite (the parents' bedroom), the bathroom
  // inside it is the parents' bathroom, the guest toilet is the one by the entrance, and the family
  // bathroom (with the bath) is the one between the bedrooms.
  var EN = [
    { id: "65", tag: "Penthouse", title: "Apartment 65", short: "Penthouse · 18th floor",
      text: "The top of the building. Four bedrooms: three en-suite, plus a mamad (safe room). A large lounge and dining room, and a huge balcony that looks out over the city to the sea.",
      facts: [["Floor", "18"], ["Bedrooms", "4: 3 en-suite + mamad"], ["Living", "Lounge and dining room"], ["Size", "To be confirmed"], ["Balcony", "Huge (size to be confirmed)"], ["Floor plan", "Coming soon"], ["View", "Sea and city"], ["Handover", "Estimated March 2027"]],
      roomcap: "The living space, with the balcony and the sea beyond the glass.", len: "1:28" },
    { id: "63", tag: "Penthouse", title: "Apartment 63", short: "Penthouse · 17th floor",
      text: "The second penthouse, on the 17th floor. Four bedrooms: three en-suite, plus a mamad (safe room). A large lounge and dining room, and a huge balcony with the sea across the rooftops. This one is still in an earlier stage of works than the others: the film shows building materials inside and on the balcony.",
      facts: [["Floor", "17"], ["Bedrooms", "4: 3 en-suite + mamad"], ["Living", "Lounge and dining room"], ["Size", "To be confirmed"], ["Balcony", "Huge (size to be confirmed)"], ["Floor plan", "Coming soon"], ["View", "Sea and city"], ["Handover", "Estimated March 2027"]],
      roomcap: "The living room today, with building materials still being stored inside.", len: "1:23" },
    { id: "61", tag: "Apartment", title: "Apartment 61", short: "16th floor · 125 m²",
      text: "High up on the 16th floor, with a large balcony of about 16 m² looking across Netanya.",
      facts: [["Floor", "16"], ["Size", "125 m²"], ["Balcony", "About 16 m²"], ["Bedrooms", "4"], ["Bathrooms", "2.5"], ["Handover", "Estimated March 2027"]],
      roomcap: "The living room, opening onto the balcony.", len: "1:30" },
    { id: "60", tag: "Apartment", title: "Apartment 60", short: "16th floor · 123.5 m²",
      text: "Four bedrooms on the 16th floor, and a glass-railed balcony that looks across the city. Apartments 54 and 60 are the same type, so they share one walk-through film.",
      facts: [["Floor", "16"], ["Size", "123.5 m²"], ["Balcony", "About 16 m²"], ["Bedrooms", "4"], ["Bathrooms", "2.5"], ["Handover", "Estimated March 2027"]],
      roomcap: "The living room, with glass doors onto the balcony.", len: "1:31" },
    { id: "54", tag: "Apartment", title: "Apartment 54", short: "4 bedrooms · 123.5 m²",
      text: "Four bedrooms, and a glass-railed balcony that looks across the city. Apartments 54 and 60 are the same type, so they share one walk-through film.",
      facts: [["Size", "123.5 m² (to be confirmed)"], ["Balcony", "About 16 m²"], ["Bedrooms", "4"], ["Bathrooms", "2.5"], ["Handover", "Estimated March 2027"]],
      roomcap: "The living room, with glass doors onto the balcony.", len: "1:31" },
    { id: "53", tag: "Apartment", title: "Apartment 53", short: "14th floor · 4 bedrooms",
      text: "Four bedrooms on the 14th floor, with a balcony off the living room that looks across the city to the sea between the towers. Still in its final stage of works: the film shows boxes and materials in some rooms.",
      facts: [["Floor", "14"], ["Size", "125 m² (to be confirmed)"], ["Balcony", "About 16 m²"], ["Bedrooms", "4"], ["Bathrooms", "2.5"], ["View", "City, sea between the towers"], ["Handover", "Estimated March 2027"]],
      roomcap: "The living room today, looking toward the balcony.", len: "1:22" },
    { id: "49", tag: "Apartment", title: "Apartment 49", short: "13th floor · 125 m²",
      text: "125 m² with a long living room that runs out to a glass-railed balcony.",
      facts: [["Floor", "13"], ["Size", "125 m²"], ["Balcony", "About 16 m²"], ["Bedrooms", "4"], ["Bathrooms", "2.5"], ["Handover", "Estimated March 2027"]],
      roomcap: "The living room, looking towards the balcony doors.", len: "1:27" },
    { id: "45", tag: "Apartment", title: "Apartment 45", short: "12th floor · 4 bedrooms",
      text: "Four bedrooms, with full-height glass doors from the living room onto the balcony.",
      facts: [["Floor", "12"], ["Size", "125 m² (to be confirmed)"], ["Balcony", "About 16 m²"], ["Bedrooms", "4"], ["Bathrooms", "2.5"], ["Handover", "Estimated March 2027"]],
      roomcap: "Glass doors from the living room to the balcony.", len: "1:30" },
    { id: "42", tag: "Apartment", title: "Apartment 42", short: "4 bedrooms · sea glimpse",
      text: "Four bedrooms, and a balcony with the sea on the horizon between the towers.",
      facts: [["Size", "123.5 m² (to be confirmed)"], ["Balcony", "About 16 m²"], ["Bedrooms", "4"], ["Bathrooms", "2.5"], ["View", "Sea between the towers"], ["Handover", "Estimated March 2027"]],
      roomcap: "The living room and its wall of glass doors.", len: "1:29" }
  ];

  var FRA = [
    { id: "65", tag: "Penthouse", title: "Appartement 65", short: "Penthouse · 18e étage",
      text: "Le sommet de l’immeuble. Quatre chambres : trois en suite, plus un mamad (pièce de sécurité). Un grand salon et une salle à manger, et un immense balcon qui donne sur la ville jusqu’à la mer.",
      facts: [["Étage", "18"], ["Chambres", "4 : 3 en suite + mamad"], ["Séjour", "Salon et salle à manger"], ["Superficie", "À confirmer"], ["Balcon", "Immense (superficie à confirmer)"], ["Plan", "Bientôt disponible"], ["Vue", "Mer et ville"], ["Livraison", "Prévue mars 2027"]],
      roomcap: "Le séjour, avec le balcon et la mer au-delà des vitres.", len: "1:28" },
    { id: "63", tag: "Penthouse", title: "Appartement 63", short: "Penthouse · 17e étage",
      text: "Le deuxième penthouse, au 17e étage. Quatre chambres : trois en suite, plus un mamad (pièce de sécurité). Un grand salon et une salle à manger, et un immense balcon avec la mer au-dessus des toits. Celui-ci est encore à un stade de travaux moins avancé que les autres : le film montre des matériaux de construction à l’intérieur et sur le balcon.",
      facts: [["Étage", "17"], ["Chambres", "4 : 3 en suite + mamad"], ["Séjour", "Salon et salle à manger"], ["Superficie", "À confirmer"], ["Balcon", "Immense (superficie à confirmer)"], ["Plan", "Bientôt disponible"], ["Vue", "Mer et ville"], ["Livraison", "Prévue mars 2027"]],
      roomcap: "Le salon aujourd’hui, avec des matériaux de construction encore entreposés à l’intérieur.", len: "1:23" },
    { id: "61", tag: "Appartement", title: "Appartement 61", short: "16e étage · 125 m²",
      text: "Tout en haut, au 16e étage, avec un grand balcon d’environ 16 m² donnant sur Netanya.",
      facts: [["Étage", "16"], ["Superficie", "125 m²"], ["Balcon", "Environ 16 m²"], ["Chambres", "4"], ["Salles de bains", "2.5"], ["Livraison", "Prévue mars 2027"]],
      roomcap: "Le salon, qui s’ouvre sur le balcon.", len: "1:30" },
    { id: "60", tag: "Appartement", title: "Appartement 60", short: "16e étage · 123.5 m²",
      text: "Quatre chambres au 16e étage, et un balcon à garde-corps en verre qui donne sur la ville. Les appartements 54 et 60 sont du même type : ils partagent donc un seul film de visite.",
      facts: [["Étage", "16"], ["Superficie", "123.5 m²"], ["Balcon", "Environ 16 m²"], ["Chambres", "4"], ["Salles de bains", "2.5"], ["Livraison", "Prévue mars 2027"]],
      roomcap: "Le salon, avec ses portes vitrées vers le balcon.", len: "1:31" },
    { id: "54", tag: "Appartement", title: "Appartement 54", short: "4 chambres · 123.5 m²",
      text: "Quatre chambres, et un balcon à garde-corps en verre qui donne sur la ville. Les appartements 54 et 60 sont du même type : ils partagent donc un seul film de visite.",
      facts: [["Superficie", "123.5 m² (à confirmer)"], ["Balcon", "Environ 16 m²"], ["Chambres", "4"], ["Salles de bains", "2.5"], ["Livraison", "Prévue mars 2027"]],
      roomcap: "Le salon, avec ses portes vitrées vers le balcon.", len: "1:31" },
    { id: "53", tag: "Appartement", title: "Appartement 53", short: "14e étage · 4 chambres",
      text: "Quatre chambres au 14e étage, avec un balcon attenant au salon qui donne sur la ville jusqu’à la mer, entre les tours. Encore en phase finale de travaux : le film montre des cartons et des matériaux dans certaines pièces.",
      facts: [["Étage", "14"], ["Superficie", "125 m² (à confirmer)"], ["Balcon", "Environ 16 m²"], ["Chambres", "4"], ["Salles de bains", "2.5"], ["Vue", "Ville, mer entre les tours"], ["Livraison", "Prévue mars 2027"]],
      roomcap: "Le salon aujourd’hui, en direction du balcon.", len: "1:22" },
    { id: "49", tag: "Appartement", title: "Appartement 49", short: "13e étage · 125 m²",
      text: "125 m² avec un long salon qui se prolonge jusqu’à un balcon à garde-corps en verre.",
      facts: [["Étage", "13"], ["Superficie", "125 m²"], ["Balcon", "Environ 16 m²"], ["Chambres", "4"], ["Salles de bains", "2.5"], ["Livraison", "Prévue mars 2027"]],
      roomcap: "Le salon, en direction des portes du balcon.", len: "1:27" },
    { id: "45", tag: "Appartement", title: "Appartement 45", short: "12e étage · 4 chambres",
      text: "Quatre chambres, avec des portes vitrées toute hauteur du salon vers le balcon.",
      facts: [["Étage", "12"], ["Superficie", "125 m² (à confirmer)"], ["Balcon", "Environ 16 m²"], ["Chambres", "4"], ["Salles de bains", "2.5"], ["Livraison", "Prévue mars 2027"]],
      roomcap: "Portes vitrées du salon vers le balcon.", len: "1:30" },
    { id: "42", tag: "Appartement", title: "Appartement 42", short: "4 chambres · aperçu de la mer",
      text: "Quatre chambres, et un balcon avec la mer à l’horizon, entre les tours.",
      facts: [["Superficie", "123.5 m² (à confirmer)"], ["Balcon", "Environ 16 m²"], ["Chambres", "4"], ["Salles de bains", "2.5"], ["Vue", "Mer entre les tours"], ["Livraison", "Prévue mars 2027"]],
      roomcap: "Le salon et son mur de portes vitrées.", len: "1:29" }
  ];

  // Which rooms each film shows. A room that isn't in an apartment's film says so instead of a photo.
  var SHOWN = {
    "65": ["live", "bed1", "bed2", "bed3", "bed4", "bathp"],
    "63": ["live", "bed1", "bed2", "bed3", "bathp"],
    "61": ["live", "bed1", "bed2", "bed3", "bathf", "wc"],
    "53": ["live", "bed1", "bed2", "bed3", "bed4", "bathf"],
    "49": ["live", "bed1", "bed2", "bed3", "bed4", "bathp", "bathf"],
    "45": ["live", "bed1", "bed2", "bed3", "bathp", "bathf"],
    "42": ["live", "bed1", "bed2", "bed3", "bathf", "wc"]
  };

  var APTS = FR ? FRA : EN;
  APTS.forEach(function (a) {
    if (a.soon) { a.view = IMG + "building.jpg"; return; }
    a.view = IMG + "view-" + a.id + ".jpg";
    a.room = IMG + "room-" + a.id + ".jpg";
    a.video = MEDIA + "apt-" + a.id + ".mp4";
  });

  var T = FR ? {
    apt: function (id) { return "l’appartement " + id; },
    tabShort: function (id) { return "Appt " + id; },
    soonAlt: function (id) { return "L’immeuble de la rue Halperin, où se trouve l’appartement " + id; },
    viewAlt: function (id) { return "Vue depuis le balcon de l’appartement " + id; },
    soonLabel: function (id) { return "L’IMMEUBLE · FILM DE L’APPARTEMENT " + id + " BIENTÔT DISPONIBLE"; },
    viewLabel: function (id) { return "VUE DEPUIS LE BALCON · APPARTEMENT " + id; },
    soonLine: "L’immeuble de la rue Halperin.", viewLine: "Vos matins, vus d’ici.",
    tour: function (id) { return "Visite de l’appartement " + id; },
    tourText: function (id, len) { return "Visite de l’appartement " + id + ", " + len + ". Sans son : juste l’appartement tel qu’il est aujourd’hui."; },
    rooms: { live: "Salon et salle à manger", bed1: "Chambre 1 (suite parentale)", bed2: "Chambre 2", bed3: "Chambre 3", bed4: "Chambre 4",
             bathp: "Salle de bains parentale", bathf: "Salle de bains familiale", wc: "WC invités" },
    notShown: function (room, id) { return "Le film de l’appartement " + id + " ne montre pas cette pièce (" + (/^WC/.test(room) ? room : room.toLowerCase()) + "). Choisissez une autre pièce, ou un autre appartement plus bas."; },
    roomCap: function (room, id) { return room + " · Appartement " + id; },
    roomAlt: function (room, id) { return room + " de l’appartement " + id + ", tel qu’il est aujourd’hui"; },
    logoAlt: "Logo de The Closing Group : pas encore de photo de cette pièce",
    roomSoon: function (id) { return "Les photos des pièces de l’appartement " + id + " arrivent avec son film. Choisissez un autre appartement plus bas."; },
    change: "Changer d’appartement ↓"
  } : {
    apt: function (id) { return "apartment " + id; },
    tabShort: function (id) { return "Apt " + id; },
    soonAlt: function (id) { return "The building on Halperin Street, where apartment " + id + " is"; },
    viewAlt: function (id) { return "View from the balcony of apartment " + id; },
    soonLabel: function (id) { return "THE BUILDING · FILM OF APT " + id + " COMING SOON"; },
    viewLabel: function (id) { return "VIEW FROM THE BALCONY · APT " + id; },
    soonLine: "The building on Halperin Street.", viewLine: "Your morning, from here.",
    tour: function (id) { return "Walk-through of apartment " + id; },
    tourText: function (id, len) { return "Walk-through of apartment " + id + ", " + len + ". No sound: just the apartment as it is today."; },
    rooms: { live: "Living & dining", bed1: "Bedroom 1 (parents' suite)", bed2: "Bedroom 2", bed3: "Bedroom 3", bed4: "Bedroom 4",
             bathp: "Parents' bathroom", bathf: "Family bathroom", wc: "Guest toilet" },
    notShown: function (room, id) { return "The film of apartment " + id + " doesn't show this room (" + room.toLowerCase() + "). Pick another room, or another apartment below."; },
    roomCap: function (room, id) { return room + " · Apartment " + id; },
    roomAlt: function (room, id) { return room + " in apartment " + id + ", as it is today"; },
    logoAlt: "The Closing Group logo: no photo of this room yet",
    roomSoon: function (id) { return "Room photos of apartment " + id + " come with its film. Pick another apartment below."; },
    change: "Change apartment ↓"
  };

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function setHash(id) { try { history.replaceState(null, "", "#apt-" + id); } catch (e) {} }

  /* ---------- Room photos ("Reading an Israeli listing") ---------- */
  var ROOMS = ["live", "bed1", "bed2", "bed3", "bed4", "bathp", "bathf", "wc"];
  var FILE = { bathp: "bath-parents", bathf: "bath-family", wc: "guest-wc" };
  var roomBtns = Array.prototype.slice.call(document.querySelectorAll(".roomcount [data-room]"));
  var roomSel = "live";

  function roomSrc(a, r) { return r === "live" ? IMG + "room-" + a.id + ".jpg" : IMG + "room-" + a.id + "-" + (FILE[r] || r) + ".jpg"; }
  function shows(a, r) { return (SHOWN[a.id] || ["live", "bed1", "bed2", "bed3", "bed4", "bathp", "bathf", "wc"]).indexOf(r) >= 0; }

  function showRoom(r) {
    if (ROOMS.indexOf(r) < 0) r = "live";
    roomSel = r;
    roomBtns.forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-room") === r ? "true" : "false"); });
    var a = APTS.filter(function (x) { return x.id === current; })[0];
    var fig = $("room-photo"), img = $("room-img"), cap = $("room-cap"), soon = $("room-soon");
    if (!fig || !a) return;
    var name = T.rooms[r];
    if (a.soon) {
      img.classList.remove("is-logo");
      soon.classList.remove("under");
      img.hidden = true;
      img.removeAttribute("src");
      soon.hidden = false;
      soon.textContent = T.roomSoon(a.id);
      cap.textContent = T.roomCap(name, a.id);
      return;
    }
    if (!shows(a, r)) {
      // No photo of this room: show the Closing Group logo in its place, with the honest note underneath.
      img.hidden = false;
      img.classList.add("is-logo");
      img.src = LOGO;
      img.alt = T.logoAlt;
      soon.hidden = false;
      soon.classList.add("under");
      soon.textContent = T.notShown(name, a.id);
      cap.textContent = T.roomCap(name, a.id);
      return;
    }
    soon.hidden = true;
    soon.classList.remove("under");
    img.classList.remove("is-logo");
    img.hidden = false;
    img.src = roomSrc(a, r);
    img.alt = T.roomAlt(name, a.id);
    cap.textContent = T.roomCap(name, a.id);
  }

  roomBtns.forEach(function (b, i) {
    b.addEventListener("click", function () { showRoom(b.getAttribute("data-room")); });
    b.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      var next = roomBtns[(i + (e.key === "ArrowRight" ? 1 : roomBtns.length - 1)) % roomBtns.length];
      next.focus();
      showRoom(next.getAttribute("data-room"));
    });
  });
  var change = $("room-change");
  if (change) change.textContent = T.change;

  /* ---------- Apartment picker ---------- */
  var picker = $("picker");
  var current = null;

  APTS.forEach(function (a, i) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "pick";
    b.id = "tab-" + a.id;
    b.setAttribute("role", "tab");
    b.setAttribute("aria-controls", "apt-panel");
    b.innerHTML = '<img src="' + a.view + '" alt="" loading="lazy"><span><b>' + esc(T.tabShort(a.id)) + "</b><small>" + esc(a.short) + "</small></span>";
    b.addEventListener("click", function () { show(a.id, true); });
    b.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      var next = APTS[(i + (e.key === "ArrowRight" ? 1 : APTS.length - 1)) % APTS.length];
      show(next.id, true);
      $("tab-" + next.id).focus();
    });
    picker.appendChild(b);
  });

  function show(id, user) {
    var a = APTS.filter(function (x) { return x.id === id; })[0] || APTS[0];
    if (current === a.id) return;
    current = a.id;
    APTS.forEach(function (x) {
      var t = $("tab-" + x.id);
      t.setAttribute("aria-selected", x.id === a.id ? "true" : "false");
      t.tabIndex = x.id === a.id ? 0 : -1;
    });
    $("apt-panel").setAttribute("aria-labelledby", "tab-" + a.id);
    $("p-view").src = a.view;
    $("p-view").alt = a.soon ? T.soonAlt(a.id) : T.viewAlt(a.id);
    $("p-viewlabel").textContent = a.soon ? T.soonLabel(a.id) : T.viewLabel(a.id);
    $("p-viewline").textContent = a.soon ? T.soonLine : T.viewLine;
    document.querySelector(".tour").hidden = !!a.soon;
    $("p-tag").textContent = a.tag;
    $("p-title").textContent = a.title;
    $("p-text").textContent = a.text;
    $("p-dl").innerHTML = a.facts.map(function (f) { return "<dt>" + esc(f[0]) + "</dt><dd>" + esc(f[1]) + "</dd>"; }).join("");
    var v = $("p-video");
    v.pause();
    if (a.soon) {
      v.removeAttribute("src");
      v.load();
    } else {
      v.poster = a.view;               // the balcony picture, not the room still
      v.src = a.video;
      v.setAttribute("aria-label", T.tour(a.id));
      $("p-tourtext").textContent = T.tourText(a.id, a.len);
      $("p-room").src = a.room;
      $("p-room").alt = a.roomcap;
      $("p-roomcap").textContent = a.roomcap;
    }
    showRoom(roomSel);                 // the room photo follows the apartment
    if (user) setHash(a.id);
  }

  var fromHash = (location.hash.match(/^#apt-(\w+)$/) || [])[1];
  show(fromHash || "65", false);
  if (fromHash) $("apartments").scrollIntoView();

  // Only one film plays at a time.
  document.addEventListener("play", function (e) {
    document.querySelectorAll("video").forEach(function (v) {
      if (v !== e.target && v.id !== "heroVideo") v.pause();
    });
  }, true);

  // Respect reduced motion: keep the hero still.
  var hero = $("heroVideo");
  if (hero) {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      hero.removeAttribute("autoplay");
      hero.pause();
    } else {
      var p = hero.play();
      if (p && p.catch) p.catch(function () {});
    }
  }
})();
