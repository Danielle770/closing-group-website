'use strict';
/*
 * The Closing Group — fair price engine.
 * Compares each apartment in a deal with nearby reported sales and explains why it is (or isn't) a good deal.
 * Pure functions, no dependencies. All assumptions live in config and are printed in the report.
 */

const DEFAULTS = {
  maxMonths: 24,                 // only use sales from the last N months
  radii: [300, 500, 800, 1200, 2000], // expand the search radius (metres) until we have enough sales
  minComps: 8,                   // minimum number of comparable sales we want
  annualTrendPct: 0,             // market change per year, used to bring older sales to today's prices
  floorPremiumPerFloorPct: 1.0,  // each floor above the 1st adds this % to value
  floorPremiumCapPct: 12,        // ...up to this cap
  groundFloorDiscountPct: 3,     // ground floor (0) is worth this % less (garden flats: set gardenM2)
  balconyWeight: 0.5,            // 1 m² of balcony counts as this much indoor area
  gardenWeight: 0.3,             // 1 m² of private garden counts as this much indoor area
  newBuildPremiumPct: 10,        // a new apartment is worth this % more than a second-hand one
  parkingValue: 150000,          // value of one parking space (₪)
  storageValue: 50000,           // value of a storage unit / machsan (₪)
  assumeCompParking: 1,          // when a reported sale doesn't say, assume this many parking spaces
  assumeCompStorage: 0,          // ...and this many storage units
  goodDealPct: 8,                // a "good deal" is at least this % below fair value (negotiation target)
  walkMetresPerMinute: 80,
  sameBuildingRadiusM: 30,       // sales this close (or marked sameBuilding) count as the same building
  sameBuildingMaxWeight: 0.6,    // same-building sales can make up at most this share of the benchmark
  sameBuildingWeightEach: 0.2,   // ...each one adds this much weight
  trendMinSales: 10,             // estimate the local price trend from the data when we have this many sales
  trendMinSpanMonths: 9,         // ...spread over at least this many months
  trendMaxAbsPct: 15,            // never let the estimated trend go beyond ±15% a year
};

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const n = s.length; if (!n) return NaN; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const quantile = (xs, q) => { const s = [...xs].sort((a, b) => a - b); if (!s.length) return NaN; const p = (s.length - 1) * q; const lo = Math.floor(p), hi = Math.ceil(p); return s[lo] + (s[hi] - s[lo]) * (p - lo); };
const num = (v, d = 0) => { if (v === undefined || v === null || v === '') return d; const n = Number(String(v).replace(/[^\d.\-]/g, '')); return Number.isFinite(n) ? n : d; };
const bool = (v) => v === true || /^(1|true|yes|y|כן)$/i.test(String(v || '').trim());

function haversine(a, b) {
  const R = 6371000, toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function monthsBetween(dateStr, today) {
  const d = new Date(dateStr);
  if (isNaN(d)) return NaN;
  return (today - d) / (1000 * 60 * 60 * 24 * 30.4375);
}

function floorFactor(floor, cfg) {
  const f = num(floor, 1);
  if (f <= 0) return 1 - cfg.groundFloorDiscountPct / 100;
  return 1 + Math.min(cfg.floorPremiumCapPct, Math.max(0, f - 1) * cfg.floorPremiumPerFloorPct) / 100;
}

function effectiveArea(x, cfg) {
  return num(x.sizeM2) + cfg.balconyWeight * num(x.balconyM2) + cfg.gardenWeight * num(x.gardenM2);
}

/** Bring a sale to a common basis: today's money, new build, no parking/storage, per effective m², 1st floor. */
function normaliseComp(c, subject, cfg, today) {
  const months = monthsBetween(c.date, today);
  const timeFactor = Math.pow(1 + cfg.annualTrendPct / 100, (months || 0) / 12);
  const parking = c.parking === undefined || c.parking === '' ? cfg.assumeCompParking : num(c.parking);
  const storage = c.storage === undefined || c.storage === '' ? cfg.assumeCompStorage : num(c.storage);
  const isNew = bool(c.newBuild);
  const newFactor = subject.newBuild && !isNew ? 1 + cfg.newBuildPremiumPct / 100 : 1;
  const price = num(c.price) * timeFactor * newFactor;
  const bare = price - parking * cfg.parkingValue - storage * cfg.storageValue;
  const area = effectiveArea(c, cfg);
  const basePpm = bare / area / floorFactor(c.floor, cfg);
  const sameBuilding = bool(c.sameBuilding) || (c.distanceM !== null && c.distanceM !== undefined && num(c.distanceM, 1e9) <= cfg.sameBuildingRadiusM);
  return { ...c, months, sameBuilding, parkingUsed: parking, storageUsed: storage, rawPpm: num(c.price) / num(c.sizeM2), basePpm, area };
}

/** Pick comparable sales: recent, closest first, expanding the radius until there are enough. */
function selectComps(comps, project, cfg, today) {
  const withDist = comps.map((c) => {
    let d = num(c.distanceM, NaN);
    if (!Number.isFinite(d) && project.lat && c.lat) d = haversine({ lat: num(project.lat), lng: num(project.lng) }, { lat: num(c.lat), lng: num(c.lng) });
    return { ...c, distanceM: Number.isFinite(d) ? Math.round(d) : null };
  }).filter((c) => num(c.price) > 0 && num(c.sizeM2) > 15);

  const recent = withDist.filter((c) => { const m = monthsBetween(c.date, today); return Number.isFinite(m) && m >= 0 && m <= cfg.maxMonths; });
  let radius = null, chosen = [];
  for (const r of cfg.radii) {
    chosen = recent.filter((c) => c.distanceM !== null && c.distanceM <= r);
    radius = r;
    if (chosen.length >= cfg.minComps) break;
  }
  if (!chosen.length) { chosen = recent.filter((c) => c.distanceM === null); radius = null; } // no locations given: use all recent sales
  return { chosen, radius, recentCount: recent.length, totalCount: withDist.length };
}

function trimOutliers(list) {
  if (list.length < 6) return list;
  const vals = list.map((c) => c.basePpm);
  const q1 = quantile(vals, 0.25), q3 = quantile(vals, 0.75), iqr = q3 - q1;
  return list.filter((c) => c.basePpm >= q1 - 1.5 * iqr && c.basePpm <= q3 + 1.5 * iqr);
}

/** Least-squares slope of adjusted price per m² against age of sale, as % per year (null if not enough data). */
function estimateTrend(list, cfg) {
  const pts = list.filter((c) => Number.isFinite(c.months) && Number.isFinite(c.basePpm));
  if (pts.length < cfg.trendMinSales) return null;
  const ms = pts.map((c) => c.months);
  if (Math.max(...ms) - Math.min(...ms) < cfg.trendMinSpanMonths) return null;
  const mx = ms.reduce((a, b) => a + b, 0) / pts.length;
  const my = pts.reduce((a, c) => a + c.basePpm, 0) / pts.length;
  let sxy = 0, sxx = 0;
  for (const c of pts) { sxy += (c.months - mx) * (c.basePpm - my); sxx += (c.months - mx) ** 2; }
  if (!sxx) return null;
  const perMonthOlder = sxy / sxx;               // change in ₪/m² for each month further in the past
  const pctPerYear = (-perMonthOlder * 12 / my) * 100; // recent sales higher => positive trend
  return Math.max(-cfg.trendMaxAbsPct, Math.min(cfg.trendMaxAbsPct, pctPerYear));
}

function analyse(deal, compsInput, userCfg = {}, today = new Date()) {
  const cfg = { ...DEFAULTS, ...(deal.assumptions || {}), ...userCfg };
  const project = deal.project || {};
  const subject = { newBuild: project.newBuild !== false };

  const sel = selectComps(compsInput, project, cfg, today);

  // Local price trend: measured from the sales themselves when there is enough data, otherwise the assumption
  const userSetTrend = 'annualTrendPct' in (deal.assumptions || {}) || 'annualTrendPct' in userCfg;
  let trendSource = userSetTrend ? 'set manually' : 'default assumption';
  if (!userSetTrend) {
    const flat = trimOutliers(sel.chosen.map((c) => normaliseComp(c, subject, { ...cfg, annualTrendPct: 0 }, today)));
    const est = estimateTrend(flat, cfg);
    if (est !== null) { cfg.annualTrendPct = Math.round(est * 10) / 10; trendSource = `measured from ${flat.length} sales`; }
  }

  const normalised = sel.chosen.map((c) => normaliseComp(c, subject, cfg, today));
  const kept = trimOutliers(normalised);
  const removed = normalised.length - kept.length;

  // Sales in the same building are the strongest evidence: give them extra weight
  const same = kept.filter((c) => c.sameBuilding);
  const areaMedian = median(kept.filter((c) => !c.sameBuilding).map((c) => c.basePpm));
  const sameMedian = same.length ? median(same.map((c) => c.basePpm)) : NaN;
  const sameWeight = same.length >= 2 ? Math.min(cfg.sameBuildingMaxWeight, same.length * cfg.sameBuildingWeightEach) : 0;
  const benchmark = sameWeight && Number.isFinite(areaMedian)
    ? sameWeight * sameMedian + (1 - sameWeight) * areaMedian
    : median(kept.map((c) => c.basePpm));
  const benchLow = quantile(kept.map((c) => c.basePpm), 0.25);
  const benchHigh = quantile(kept.map((c) => c.basePpm), 0.75);
  const rawMedianPpm = median(kept.map((c) => c.rawPpm));
  const dates = kept.map((c) => new Date(c.date)).filter((d) => !isNaN(d)).sort((a, b) => a - b);

  const units = (deal.units || []).map((u) => {
    const area = effectiveArea(u, cfg);
    const ff = floorFactor(u.floor, cfg);
    const parking = num(u.parking), storage = num(u.storage);
    const fairValue = benchmark * area * ff + parking * cfg.parkingValue + storage * cfg.storageValue;
    const listPrice = num(u.listPrice) || null;
    const dealPrice = num(u.dealPrice) || null; // the negotiated kahila price, once known
    const price = dealPrice || listPrice;
    const saving = price ? fairValue - price : null;
    return {
      ...u, area: Math.round(area * 10) / 10, floorFactor: ff, fairValue, listPrice, dealPrice, price,
      saving, savingPct: price ? (saving / fairValue) * 100 : null,
      pricePerM2: price ? price / num(u.sizeM2) : null,
      fairPerM2: fairValue / num(u.sizeM2),
      negotiationTarget: fairValue * (1 - cfg.goodDealPct / 100),
    };
  });

  const priced = units.filter((u) => u.price);
  const totals = {
    units: units.length,
    fairValue: units.reduce((s, u) => s + u.fairValue, 0),
    price: priced.reduce((s, u) => s + u.price, 0),
    saving: priced.reduce((s, u) => s + u.saving, 0),
    fairOfPriced: priced.reduce((s, u) => s + u.fairValue, 0),
  };
  totals.savingPct = totals.fairOfPriced ? (totals.saving / totals.fairOfPriced) * 100 : null;

  return {
    cfg, project, building: deal.building || {}, location: deal.location || {}, units, totals,
    comps: kept.sort((a, b) => (a.distanceM ?? 1e9) - (b.distanceM ?? 1e9)),
    stats: {
      count: kept.length, removedOutliers: removed, radius: sel.radius, recentCount: sel.recentCount, totalCount: sel.totalCount,
      benchmark, benchLow, benchHigh, rawMedianPpm, areaMedian, trendSource,
      sameBuilding: { count: same.length, weight: sameWeight, medianBasePpm: sameMedian, medianRawPpm: same.length ? median(same.map((c) => c.rawPpm)) : NaN },
      from: dates[0] || null, to: dates[dates.length - 1] || null,
    },
    generatedAt: today,
  };
}

module.exports = { analyse, DEFAULTS, median, quantile, num, bool, floorFactor, effectiveArea };
