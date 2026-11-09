'use strict';
/*
 * Turns the analysis into plain-language selling points.
 * Every highlight is backed by a number from the data; nothing is claimed without it.
 */
const { median, quantile, num, bool } = require('./engine');

const ils = (n) => '₪' + Math.round(n).toLocaleString('en-US');
const ilsK = (n) => (Math.abs(n) >= 1e6 ? '₪' + (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M' : '₪' + Math.round(n / 1000) + 'K');
const pct = (n) => Math.round(n) + '%';

const DIRECTION_NAMES = { N: 'north', S: 'south', E: 'east', W: 'west', NE: 'north-east', NW: 'north-west', SE: 'south-east', SW: 'south-west' };
const FACILITY_LABELS = {
  pool: 'Swimming pool', gym: 'Gym', lobby: 'Designed lobby', concierge: 'Concierge', doorman: 'Doorman',
  elevators: 'Elevators', shabbatElevator: 'Shabbat elevator', mamad: 'Safe room (mamad) in every apartment',
  evCharging: 'EV charging', bikeRoom: 'Bike storage', clubRoom: 'Residents’ club room', roofGarden: 'Shared roof garden',
  playground: 'Playground', synagogue: 'Synagogue in the building', sukkahBalcony: 'Sukkah balconies', gatedParking: 'Gated underground parking',
};

function directionsOf(u) {
  return String(u.directions || u.direction || '').toUpperCase().split(/[\s,/+]+/).filter((d) => DIRECTION_NAMES[d]);
}

/** Highlights for the whole deal */
function dealHighlights(a) {
  const out = [];
  const { stats, totals, project, building, location, cfg, comps } = a;

  if (totals.price && totals.saving > 0) {
    out.push({ kind: 'price', title: `${ilsK(totals.saving)} below fair value`, text: `Across ${totals.units === 1 ? 'this apartment' : 'the ' + totals.units + ' apartments'}, the price is about ${pct(totals.savingPct)} below what comparable homes nearby actually sold for.` });
  } else if (!totals.price) {
    const t = a.units.reduce((s, u) => s + u.negotiationTarget, 0);
    out.push({ kind: 'price', title: `Target: ${ilsK(t)} or less`, text: `Fair value for the ${totals.units} apartments is about ${ilsK(totals.fairValue)}. Reaching ${ilsK(t)} or less in negotiation means at least ${cfg.goodDealPct}% below the market.` });
  }

  if (stats.count) {
    out.push({ kind: 'proof', title: `Checked against ${stats.count} real sales`, text: `Officially reported sales${stats.radius ? ` within ${stats.radius} m` : ''}${stats.from ? `, ${monthYear(stats.from)} to ${monthYear(stats.to)}` : ''}. Typical price: ${ils(stats.rawMedianPpm)} per m².` });
  }

  if (project.form4 === true || /received|yes|true/i.test(String(project.form4 || ''))) {
    out.push({ kind: 'ready', title: 'Ready to move in', text: 'Form 4 has been issued: the apartments are finished and legally approved for occupancy.' });
  } else if (project.form4Months) {
    out.push({ kind: 'ready', title: `Keys in about ${project.form4Months} months`, text: 'The building is nearly complete, so there is no long wait and no construction-stage risk.' });
  }
  if (project.newBuild !== false) {
    out.push({ kind: 'ready', title: 'Brand new, with the builder’s warranty', text: 'New apartments are covered by the builder’s legal warranty under the Sale of Apartments Law.' });
  }

  // Location
  const walk = (m) => Math.max(1, Math.round(num(m) / cfg.walkMetresPerMinute));
  const near = [];
  if (location.beachM) near.push(`${walk(location.beachM)} min walk to the beach`);
  if (location.trainM) near.push(`${walk(location.trainM)} min to the train`);
  if (location.schoolM) near.push(`${walk(location.schoolM)} min to school`);
  if (location.parkM) near.push(`${walk(location.parkM)} min to a park`);
  if (location.synagogueM) near.push(`${walk(location.synagogueM)} min to a synagogue`);
  if (location.shoppingM) near.push(`${walk(location.shoppingM)} min to shops`);
  if (near.length) out.push({ kind: 'location', title: 'Everything close by', text: near.join(' · ') + '.' });
  if (bool(location.quietStreet)) out.push({ kind: 'location', title: 'Quiet residential street', text: location.streetNote || 'Away from main traffic, while still close to everything.' });
  if (num(location.elevationM) && num(location.areaElevationM) && num(location.elevationM) - num(location.areaElevationM) >= 5) {
    out.push({ kind: 'location', title: 'Higher ground', text: `About ${Math.round(num(location.elevationM) - num(location.areaElevationM))} m higher than the surrounding area: more breeze and better views.` });
  }
  if (location.seaView) out.push({ kind: 'location', title: 'Sea view', text: typeof location.seaView === 'string' ? location.seaView : 'Open sea views from the upper floors.' });
  if (location.extra) [].concat(location.extra).forEach((t) => out.push({ kind: 'location', title: t.title || t, text: t.text || '' }));

  // Building
  const fac = Object.keys(FACILITY_LABELS).filter((k) => bool(building[k]) || num(building[k]) > 0)
    .map((k) => (k === 'elevators' && num(building[k]) > 1 ? `${num(building[k])} elevators` : FACILITY_LABELS[k]));
  if (Array.isArray(building.other)) fac.push(...building.other);
  if (fac.length) out.push({ kind: 'building', title: 'Building facilities', text: fac.join(' · ') + '.' });

  return out;
}

/** Highlights for one apartment */
function unitHighlights(u, a) {
  const out = [];
  const { comps, cfg } = a;

  if (u.price && u.saving > 0) {
    const perM2 = u.fairPerM2 - u.pricePerM2;
    out.push(`${ilsK(u.saving)} below fair value (${pct(u.savingPct)}), ${ils(perM2)} less per m².`);
  } else if (!u.price) {
    out.push(`Fair value ${ilsK(u.fairValue)}. Negotiation target: ${ilsK(u.negotiationTarget)} or less.`);
  }

  // Floor compared with nearby sales
  const floors = comps.map((c) => num(c.floor, NaN)).filter(Number.isFinite);
  if (floors.length >= 5 && num(u.floor) > 0) {
    const higherThan = (floors.filter((f) => f < num(u.floor)).length / floors.length) * 100;
    if (higherThan >= 99.5) out.push(`Floor ${num(u.floor)}: higher than every nearby sale we compared.`);
    else if (higherThan >= 60) out.push(`Floor ${num(u.floor)}: higher than ${pct(higherThan)} of the nearby sales.`);
  }

  // Rooms-for-price: compare with the next size down
  const rooms = num(u.rooms);
  const smaller = comps.filter((c) => num(c.rooms) === rooms - 1);
  if (u.price && rooms >= 3 && smaller.length >= 2) {
    const smallerPpm = median(smaller.map((c) => c.rawPpm));
    const smallerPrice = median(smaller.map((c) => num(c.price)));
    if (u.price <= smallerPrice * 1.05) {
      out.push(`A ${rooms}-room home for about the price of a ${rooms - 1}-room nearby (typical ${rooms - 1}-room: ${ilsK(smallerPrice)}).`);
    } else if (u.pricePerM2 <= smallerPpm) {
      out.push(`Per m², this ${rooms}-room costs ${u.pricePerM2 < smallerPpm * 0.98 ? 'less than' : 'the same as'} a typical ${rooms - 1}-room nearby (${ils(smallerPpm)}/m²).`);
    }
  }

  // Size compared with the same room count
  const same = comps.filter((c) => num(c.rooms) === rooms);
  if (same.length >= 3) {
    const typical = median(same.map((c) => num(c.sizeM2)));
    if (num(u.sizeM2) >= typical * 1.08) out.push(`${Math.round(num(u.sizeM2) - typical)} m² larger than a typical ${rooms}-room nearby (${Math.round(typical)} m²).`);
  }

  if (num(u.parking) >= 1) out.push(`${num(u.parking) > 1 ? num(u.parking) + ' parking spaces' : 'Parking space'} included (worth about ${ilsK(num(u.parking) * cfg.parkingValue)}).`);
  if (num(u.storage) >= 1) out.push(`Storage unit (machsan) included (worth about ${ilsK(cfg.storageValue)}).`);
  if (num(u.balconyM2) >= 10) out.push(`Large ${Math.round(num(u.balconyM2))} m² balcony${bool(u.sukkahBalcony) ? ', suitable for a sukkah' : ''}.`);
  if (num(u.gardenM2) > 0) out.push(`Private ${Math.round(num(u.gardenM2))} m² garden.`);

  const dirs = directionsOf(u);
  if (dirs.length >= 3) out.push(`Three-direction apartment (${dirs.map((d) => DIRECTION_NAMES[d]).join(', ')}): light all day.`);
  else if ((dirs.includes('N') && dirs.includes('S')) || (dirs.includes('E') && dirs.includes('W'))) out.push('Windows on opposite sides: natural cross-ventilation.');
  if (dirs.some((d) => d.includes('W')) && bool(a.location.coastal)) out.push('West-facing: sea breeze and sunsets.');
  else if (dirs.some((d) => d.includes('S'))) out.push('South-facing: bright and warm in winter.');
  if (u.view) out.push(String(u.view));

  return out;
}

function monthYear(d) { return d ? d.toLocaleString('en-GB', { month: 'short', year: 'numeric' }) : ''; }

module.exports = { dealHighlights, unitHighlights, ils, ilsK, pct, monthYear, directionsOf, DIRECTION_NAMES };
