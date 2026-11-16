/* Halperin apartment picker (English page). Kept in an external file because the
   Content-Security-Policy is script-src 'self' (no inline scripts). */
const APTS = [
  { id: "65", tag: "Penthouse", title: "Apartment 65", short: "Penthouse · 18th floor",
    text: "The top of the building. Four bedrooms: three en-suite, plus a mamad (safe room). A large lounge and dining room, and a huge balcony that looks out over the city to the sea.",
    facts: [["Floor", "18"], ["Bedrooms", "4: 3 en-suite + mamad"], ["Living", "Lounge and dining room"], ["Size", "To be confirmed"], ["Balcony", "Huge (size to be confirmed)"], ["Floor plan", "Coming soon"], ["View", "Sea and city"], ["Handover", "Estimated March 2027"]],
    view: "img/view-65.jpg", room: "img/room-65.jpg", roomcap: "The living space, with the balcony and the sea beyond the glass.",
    video: "media/apt-65.mp4", len: "1:28" },
  { id: "63", tag: "Penthouse", title: "Apartment 63", short: "Penthouse · 17th floor",
    text: "The second penthouse, on the 17th floor. Four bedrooms: three en-suite, plus a mamad (safe room). A large lounge and dining room, and a huge balcony with the sea across the rooftops. This one is still in an earlier stage of works than the others: the film shows building materials inside and on the balcony.",
    facts: [["Floor", "17"], ["Bedrooms", "4: 3 en-suite + mamad"], ["Living", "Lounge and dining room"], ["Size", "To be confirmed"], ["Balcony", "Huge (size to be confirmed)"], ["Floor plan", "Coming soon"], ["View", "Sea and city"], ["Handover", "Estimated March 2027"]],
    view: "img/view-63.jpg", room: "img/room-63.jpg", roomcap: "The living room today, with building materials still being stored inside.",
    video: "media/apt-63.mp4", len: "1:23" },
  { id: "61", tag: "Apartment", title: "Apartment 61", short: "16th floor · 125 m²",
    text: "High up on the 16th floor, with a large balcony of about 16 m² looking across Netanya.",
    facts: [["Floor", "16"], ["Size", "125 m²"], ["Balcony", "About 16 m²"], ["Bedrooms", "4"], ["Bathrooms", "2.5"], ["Handover", "Estimated March 2027"]],
    view: "img/view-61.jpg", room: "img/room-61.jpg", roomcap: "The living room, opening onto the balcony.",
    video: "media/apt-61.mp4", len: "1:30" },
  { id: "60", soon: true, tag: "Apartment", title: "Apartment 60", short: "16th floor · film coming soon",
    text: "Four bedrooms, in the same building. We film every apartment before we list it, and the film of this one is coming soon.",
    facts: [["Floor", "16"], ["Size", "123.5 m²"], ["Balcony", "About 16 m²"], ["Bedrooms", "4"], ["Bathrooms", "2.5"], ["Film", "Coming soon"], ["Handover", "Estimated March 2027"]],
    view: "img/building.jpg" },
  { id: "54", soon: true, tag: "Apartment", title: "Apartment 54", short: "Film coming soon",
    text: "Four bedrooms, in the same building. We film every apartment before we list it, and the film of this one is coming soon.",
    facts: [["Size", "123.5 m² (to be confirmed)"], ["Balcony", "About 16 m²"], ["Bedrooms", "4"], ["Bathrooms", "2.5"], ["Film", "Coming soon"], ["Handover", "Estimated March 2027"]],
    view: "img/building.jpg" },
  { id: "53", tag: "Apartment", title: "Apartment 53", short: "14th floor · 4 bedrooms",
    text: "Four bedrooms on the 14th floor, with a balcony off the living room that looks across the city to the sea between the towers. Still in its final stage of works: the film shows boxes and materials in some rooms.",
    facts: [["Floor", "14"], ["Size", "125 m² (to be confirmed)"], ["Balcony", "About 16 m²"], ["Bedrooms", "4"], ["Bathrooms", "2.5"], ["View", "City, sea between the towers"], ["Handover", "Estimated March 2027"]],
    view: "img/view-53.jpg", room: "img/room-53.jpg", roomcap: "The living room today, looking toward the balcony.",
    video: "media/apt-53.mp4", len: "1:22" },
  { id: "49", tag: "Apartment", title: "Apartment 49", short: "13th floor · 125 m²",
    text: "125 m² with a long living room that runs out to a glass-railed balcony.",
    facts: [["Floor", "13"], ["Size", "125 m²"], ["Balcony", "About 16 m²"], ["Bedrooms", "4"], ["Bathrooms", "2.5"], ["Handover", "Estimated March 2027"]],
    view: "img/view-49.jpg", room: "img/room-49.jpg", roomcap: "The living room, looking towards the balcony doors.",
    video: "media/apt-49.mp4", len: "1:27" },
  { id: "45", tag: "Apartment", title: "Apartment 45", short: "12th floor · 4 bedrooms",
    text: "Four bedrooms, with full-height glass doors from the living room onto the balcony.",
    facts: [["Floor", "12"], ["Size", "125 m² (to be confirmed)"], ["Balcony", "About 16 m²"], ["Bedrooms", "4"], ["Bathrooms", "2.5"], ["Handover", "Estimated March 2027"]],
    view: "img/view-45.jpg", room: "img/room-45.jpg", roomcap: "Glass doors from the living room to the balcony.",
    video: "media/apt-45.mp4", len: "1:30" },
  { id: "42", tag: "Apartment", title: "Apartment 42", short: "4 bedrooms · sea glimpse",
    text: "Four bedrooms, and a balcony with the sea on the horizon between the towers.",
    facts: [["Size", "123.5 m² (to be confirmed)"], ["Balcony", "About 16 m²"], ["Bedrooms", "4"], ["Bathrooms", "2.5"], ["View", "Sea between the towers"], ["Handover", "Estimated March 2027"]],
    view: "img/view-42.jpg", room: "img/room-42.jpg", roomcap: "The living room and its wall of glass doors.",
    video: "media/apt-42.mp4", len: "1:29" },
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
  b.innerHTML = `<img src="${a.view}" alt="" loading="lazy"><span><b>${a.label || "Apt " + a.id}</b><small>${a.short}</small></span>`;
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
  $("p-view").alt = a.soon ? "The building on Halperin Street, where apartment " + a.id + " is" : "View from the balcony of " + (a.name || "apartment " + a.id);
  $("p-viewlabel").textContent = a.soon ? "THE BUILDING · FILM OF APT " + a.id + " COMING SOON" : "VIEW FROM THE BALCONY · " + (a.label || "APT " + a.id).toUpperCase();
  document.querySelector(".tour").style.display = a.soon ? "none" : "";
  $("p-viewline").textContent = a.soon ? "The building on Halperin Street." : "Your morning, from here.";
  $("p-tag").textContent = a.tag;
  $("p-title").textContent = a.title;
  $("p-text").textContent = a.text;
  $("p-dl").innerHTML = a.facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
  const v = $("p-video");
  v.pause();
  if (a.soon) { v.removeAttribute("src"); v.load(); if (user) { try { history.replaceState(null, "", "#apt-" + a.id); } catch (e) {} } return; }
  v.poster = a.view;
  v.src = a.video;
  v.setAttribute("aria-label", "Walk-through of " + (a.name || "apartment " + a.id));
  $("p-tourtext").textContent = `Walk-through of ${a.name || "apartment " + a.id}, ${a.len}. No sound: just the apartment as it is today.`;
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
