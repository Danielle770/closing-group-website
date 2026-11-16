/* Halperin Street, Netanya — the facts about the nine apartments, in one place.
   Read by the page (assets/halperin.js) AND by the chat agent on the server (server/agent.js),
   so a change here changes what the page shows and what the agent says.
   Sizes, balconies and terraces follow the builder's price list. Floors keep the site's existing numbering
   (no floor is shown for 42 and 54 until it is confirmed). */
(function (root) {
  "use strict";

  // Rooms each apartment's film actually shows. Any other room shows the Closing Group logo with an honest note.
  var SHOWN = {
    "65": ["live", "bed1", "bed2", "bed3", "bed4", "bathp", "bathf"],
    "63": ["live", "bed1", "bed2", "bed3", "bathp", "bathf"],
    "61": ["live", "bed1", "bed2", "bed3", "bathf", "wc"],
    "60": ["live", "bed1", "bed2", "bed3", "bathp", "bathf", "wc"],
    "54": ["live", "bed1", "bed2", "bed3", "bed4", "bathp", "bathf", "wc"],
    "53": ["live", "bed1", "bed2", "bed3", "bed4", "bathf"],
    "49": ["live", "bed1", "bed2", "bed3", "bed4", "bathp", "bathf"],
    "45": ["live", "bed1", "bed2", "bed3", "bathp", "bathf"],
    "42": ["live", "bed1", "bed2", "bed3", "bathf", "wc"]
  };
  // Apartment 60 has 3 bedrooms (4 rooms), so it has no "Bedroom 4".
  var NO_ROOM = { "60": ["bed4"] };

  var EN = {
    rooms: { staged: "Visualisation", live: "Living & dining", bed1: "Bedroom 1 (parents' suite)", bed2: "Bedroom 2", bed3: "Bedroom 3", bed4: "Bedroom 4",
             bathp: "Parents' bathroom", bathf: "Family bathroom", wc: "Guest toilet" },
    rename: { "65": { bathf: "Second bathroom (en-suite)" }, "63": { bathf: "Second bathroom (en-suite)" } },
    area: "The building is on Halperin Street in Netanya, about 250 metres from the beach: a short walk to the sand and the seafront promenade. The upper floors look out over the city to the sea.",
    stage: [
      ["done", "Floors, tiles, windows and balcony glass are in."],
      ["done", "Kitchens are going in."],
      ["done", "Air-conditioning units are in place on the service balconies."],
      ["open", "Final works continue in some bathrooms and on some balconies."],
      ["open", "The lobby is still under construction."],
      ["open", "Estimated handover: March 2027."]
    ],
    stageExtra: {
      "63": "This penthouse is at an earlier stage of works than the others: the film shows building materials inside and on the terrace.",
      "53": "Still in its final stage of works: the film shows boxes and materials in some rooms."
    },
    shared: [
      ["Kitchen", "Dekel master kitchen, fitted by the builder"],
      ["Air conditioning", "Central AC, plus a separate unit in the parents' bedroom"],
      ["Gas", "Gas hot water, a gas point on the balcony, and a gas heater"],
      ["Floors", "Large-format tiles, already laid"],
      ["Balcony tap", "Water tap on the balcony"],
      ["Parking & storage", "One parking space and a storage room"],
      ["Handover", "Estimated March 2027"]
    ],
    apts: [
      { id: "65", tag: "Penthouse", short: "Penthouse · 18th floor · 170 m²", len: "1:28",
        text: "The top of the building. Four bedrooms: three en-suite, plus a mamad (safe room). A large lounge and dining room, and a 40 m² terrace that looks out over the city to the sea.",
        facts: [["Floor", "18"], ["Rooms", "5: living room + 4 bedrooms"], ["Bedrooms", "4: 3 en-suite + mamad"], ["Bathrooms", "3 en-suite + guest toilet"], ["Living", "Lounge and dining room"], ["Interior", "170 m²"], ["Terrace", "40 m²"], ["View", "Sea and city"], ["List price", "₪5,750,000"]] },
      { id: "63", tag: "Penthouse", short: "Penthouse · 17th floor · 182 m²", len: "1:23",
        text: "The second penthouse, on the 17th floor. Four bedrooms: three en-suite, plus a mamad (safe room). A large lounge and dining room, and a 76 m² terrace with the sea across the rooftops.",
        facts: [["Floor", "17"], ["Rooms", "5: living room + 4 bedrooms"], ["Bedrooms", "4: 3 en-suite + mamad"], ["Bathrooms", "3 en-suite + guest toilet"], ["Living", "Lounge and dining room"], ["Interior", "182 m²"], ["Terrace", "76 m²"], ["View", "Sea and city"], ["List price", "₪5,750,000"]] },
      { id: "61", tag: "Apartment", short: "16th floor · 125 m²", len: "1:30",
        text: "High up on the 16th floor, with a 14 m² balcony looking across Netanya.",
        facts: [["Floor", "16"], ["Rooms", "5: living room + 4 bedrooms"], ["Bedrooms", "4"], ["Bathrooms", "2.5"], ["Interior", "125 m²"], ["Balcony", "14 m²"]] },
      { id: "60", tag: "Apartment", short: "16th floor · 114 m² · 3 bedrooms", len: "1:31",
        text: "Three bedrooms (a 4-room apartment, in Israeli terms) on the 16th floor, with a 13.5 m² glass-railed balcony that looks across the city. For now, Apartments 54 and 60 share one walk-through film, and that film shows the 4-bedroom layout of Apartment 54.",
        facts: [["Floor", "16"], ["Rooms", "4: living room + 3 bedrooms"], ["Bedrooms", "3"], ["Bathrooms", "2.5"], ["Interior", "114 m²"], ["Balcony", "13.5 m²"]] },
      { id: "54", tag: "Apartment", short: "4 bedrooms · 123 m²", len: "1:31",
        text: "Four bedrooms, and a 14 m² glass-railed balcony that looks across the city. Apartments 54 and 60 share one walk-through film.",
        facts: [["Rooms", "5: living room + 4 bedrooms"], ["Bedrooms", "4"], ["Bathrooms", "2.5"], ["Interior", "123 m²"], ["Balcony", "14 m²"]] },
      { id: "53", tag: "Apartment", short: "14th floor · 125 m²", len: "1:22",
        text: "Four bedrooms on the 14th floor, with a 14 m² balcony off the living room that looks across the city to the sea between the towers.",
        facts: [["Floor", "14"], ["Rooms", "5: living room + 4 bedrooms"], ["Bedrooms", "4"], ["Bathrooms", "2.5"], ["Interior", "125 m²"], ["Balcony", "14 m²"], ["View", "City, sea between the towers"]] },
      { id: "49", tag: "Apartment", short: "13th floor · 125 m²", len: "1:27",
        text: "125 m² with a long living room that runs out to a 14 m² glass-railed balcony.",
        facts: [["Floor", "13"], ["Rooms", "5: living room + 4 bedrooms"], ["Bedrooms", "4"], ["Bathrooms", "2.5"], ["Interior", "125 m²"], ["Balcony", "14 m²"]] },
      { id: "45", tag: "Apartment", short: "12th floor · 125 m²", len: "1:30",
        text: "Four bedrooms, with full-height glass doors from the living room onto a 14 m² balcony.",
        facts: [["Floor", "12"], ["Rooms", "5: living room + 4 bedrooms"], ["Bedrooms", "4"], ["Bathrooms", "2.5"], ["Interior", "125 m²"], ["Balcony", "14 m²"]] },
      { id: "42", tag: "Apartment", short: "123 m² · sea glimpse", len: "1:29",
        text: "Four bedrooms, and a 14 m² balcony with the sea on the horizon between the towers.",
        facts: [["Rooms", "5: living room + 4 bedrooms"], ["Bedrooms", "4"], ["Bathrooms", "2.5"], ["Interior", "123 m²"], ["Balcony", "14 m²"], ["View", "Sea between the towers"]] }
    ]
  };

  var FR = {
    rooms: { staged: "Visualisation", live: "Salon et salle à manger", bed1: "Chambre 1 (suite parentale)", bed2: "Chambre 2", bed3: "Chambre 3", bed4: "Chambre 4",
             bathp: "Salle de bains parentale", bathf: "Salle de bains familiale", wc: "WC invités" },
    rename: { "65": { bathf: "Deuxième salle de bains (en suite)" }, "63": { bathf: "Deuxième salle de bains (en suite)" } },
    area: "L’immeuble est rue Halperin à Netanya, à environ 250 mètres de la plage : quelques minutes à pied jusqu’au sable et à la promenade du bord de mer. Les étages supérieurs donnent sur la ville jusqu’à la mer.",
    stage: [
      ["done", "Sols, carrelage, fenêtres et garde-corps vitrés sont posés."],
      ["done", "Les cuisines sont en cours d’installation."],
      ["done", "Les climatiseurs sont en place sur les balcons techniques."],
      ["open", "Les finitions se poursuivent dans certaines salles de bains et sur certains balcons."],
      ["open", "Le hall d’entrée est encore en travaux."],
      ["open", "Livraison prévue : mars 2027."]
    ],
    stageExtra: {
      "63": "Ce penthouse est à un stade de travaux moins avancé que les autres : le film montre des matériaux de construction à l’intérieur et sur la terrasse.",
      "53": "Encore en phase finale de travaux : le film montre des cartons et des matériaux dans certaines pièces."
    },
    shared: [
      ["Cuisine", "Cuisine Dekel master, posée par le promoteur"],
      ["Climatisation", "Climatisation centrale, plus une unité séparée dans la chambre parentale"],
      ["Gaz", "Eau chaude au gaz, un point gaz sur le balcon et un chauffage au gaz"],
      ["Sols", "Grands carreaux, déjà posés"],
      ["Robinet", "Robinet d’eau sur le balcon"],
      ["Parking et cave", "Une place de parking et une cave"],
      ["Livraison", "Prévue mars 2027"]
    ],
    apts: [
      { id: "65", tag: "Penthouse", short: "Penthouse · 18e étage · 170 m²", len: "1:28",
        text: "Le sommet de l’immeuble. Quatre chambres : trois en suite, plus un mamad (pièce de sécurité). Un grand salon et une salle à manger, et une terrasse de 40 m² qui donne sur la ville jusqu’à la mer.",
        facts: [["Étage", "18"], ["Pièces", "5 : salon + 4 chambres"], ["Chambres", "4 : 3 en suite + mamad"], ["Salles de bains", "3 en suite + WC invités"], ["Séjour", "Salon et salle à manger"], ["Intérieur", "170 m²"], ["Terrasse", "40 m²"], ["Vue", "Mer et ville"], ["Prix catalogue", "5 750 000 ₪"]] },
      { id: "63", tag: "Penthouse", short: "Penthouse · 17e étage · 182 m²", len: "1:23",
        text: "Le deuxième penthouse, au 17e étage. Quatre chambres : trois en suite, plus un mamad (pièce de sécurité). Un grand salon et une salle à manger, et une terrasse de 76 m² avec la mer au-dessus des toits.",
        facts: [["Étage", "17"], ["Pièces", "5 : salon + 4 chambres"], ["Chambres", "4 : 3 en suite + mamad"], ["Salles de bains", "3 en suite + WC invités"], ["Séjour", "Salon et salle à manger"], ["Intérieur", "182 m²"], ["Terrasse", "76 m²"], ["Vue", "Mer et ville"], ["Prix catalogue", "5 750 000 ₪"]] },
      { id: "61", tag: "Appartement", short: "16e étage · 125 m²", len: "1:30",
        text: "Tout en haut, au 16e étage, avec un balcon de 14 m² donnant sur Netanya.",
        facts: [["Étage", "16"], ["Pièces", "5 : salon + 4 chambres"], ["Chambres", "4"], ["Salles de bains", "2,5"], ["Intérieur", "125 m²"], ["Balcon", "14 m²"]] },
      { id: "60", tag: "Appartement", short: "16e étage · 114 m² · 3 chambres", len: "1:31",
        text: "Trois chambres (un 4 pièces, au sens israélien) au 16e étage, avec un balcon de 13,5 m² à garde-corps en verre qui donne sur la ville. Pour l’instant, les appartements 54 et 60 partagent un seul film de visite, et ce film montre le plan à 4 chambres de l’appartement 54.",
        facts: [["Étage", "16"], ["Pièces", "4 : salon + 3 chambres"], ["Chambres", "3"], ["Salles de bains", "2,5"], ["Intérieur", "114 m²"], ["Balcon", "13,5 m²"]] },
      { id: "54", tag: "Appartement", short: "4 chambres · 123 m²", len: "1:31",
        text: "Quatre chambres, et un balcon de 14 m² à garde-corps en verre qui donne sur la ville. Les appartements 54 et 60 partagent un seul film de visite.",
        facts: [["Pièces", "5 : salon + 4 chambres"], ["Chambres", "4"], ["Salles de bains", "2,5"], ["Intérieur", "123 m²"], ["Balcon", "14 m²"]] },
      { id: "53", tag: "Appartement", short: "14e étage · 125 m²", len: "1:22",
        text: "Quatre chambres au 14e étage, avec un balcon de 14 m² attenant au salon qui donne sur la ville jusqu’à la mer, entre les tours.",
        facts: [["Étage", "14"], ["Pièces", "5 : salon + 4 chambres"], ["Chambres", "4"], ["Salles de bains", "2,5"], ["Intérieur", "125 m²"], ["Balcon", "14 m²"], ["Vue", "Ville, mer entre les tours"]] },
      { id: "49", tag: "Appartement", short: "13e étage · 125 m²", len: "1:27",
        text: "125 m² avec un long salon qui se prolonge jusqu’à un balcon de 14 m² à garde-corps en verre.",
        facts: [["Étage", "13"], ["Pièces", "5 : salon + 4 chambres"], ["Chambres", "4"], ["Salles de bains", "2,5"], ["Intérieur", "125 m²"], ["Balcon", "14 m²"]] },
      { id: "45", tag: "Appartement", short: "12e étage · 125 m²", len: "1:30",
        text: "Quatre chambres, avec des portes vitrées toute hauteur du salon vers un balcon de 14 m².",
        facts: [["Étage", "12"], ["Pièces", "5 : salon + 4 chambres"], ["Chambres", "4"], ["Salles de bains", "2,5"], ["Intérieur", "125 m²"], ["Balcon", "14 m²"]] },
      { id: "42", tag: "Appartement", short: "123 m² · aperçu de la mer", len: "1:29",
        text: "Quatre chambres, et un balcon de 14 m² avec la mer à l’horizon, entre les tours.",
        facts: [["Pièces", "5 : salon + 4 chambres"], ["Chambres", "4"], ["Salles de bains", "2,5"], ["Intérieur", "123 m²"], ["Balcon", "14 m²"], ["Vue", "Mer entre les tours"]] }
    ]
  };

  root.CG_HALPERIN = {
    order: ["65", "63", "61", "60", "54", "53", "49", "45", "42"],
    shown: SHOWN,
    noRoom: NO_ROOM,
    roomKeys: ["live", "bed1", "bed2", "bed3", "bed4", "bathp", "bathf", "wc"],
    en: EN,
    fr: FR,
    // Who calls the visitor back
    liaisons: { en: "Michal", fr: "Levy Levin" }
  };
})(typeof window !== "undefined" ? window : globalThis);
