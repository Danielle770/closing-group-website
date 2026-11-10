'use strict';
/* Builds the fair price report as one self-contained HTML page in The Closing Group's design. */
const { num } = require('./engine');
const { dealHighlights, unitHighlights, ils, ilsK, pct, monthYear, directionsOf, DIRECTION_NAMES } = require('./highlights');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dateStr = (d) => { const x = new Date(d); return isNaN(x) ? esc(d) : x.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); };

function render(a, { internal = true } = {}) {
  const { project, units, totals, stats, cfg, comps } = a;
  const deal = dealHighlights(a);
  const title = project.name || project.area || 'Fair price report';
  const hasPrice = !!totals.price;

  const heroNumber = hasPrice && totals.saving > 0 ? ilsK(totals.saving) : ilsK(totals.fairValue);
  const heroLabel = hasPrice && totals.saving > 0 ? `below fair value · ${pct(totals.savingPct)} under the market` : 'fair market value of the apartments';

  const unitRows = units.map((u) => `
<tr>
<td><strong>${esc(u.id || '')}</strong></td>
<td>${num(u.rooms)}</td><td>${num(u.sizeM2)}${num(u.balconyM2) ? ` + ${num(u.balconyM2)}` : ''}</td>
<td>${num(u.floor)}</td><td>${esc(directionsOf(u).join(' ') || '–')}</td>
<td>${num(u.parking)} / ${num(u.storage)}</td>
<td>${u.price ? ils(u.price) : '–'}</td>
<td>${ils(u.fairValue)}</td>
<td class="${u.saving > 0 ? 'good' : ''}">${u.price ? `<span style="font-size:16px">${ils(u.saving)}</span><br><span class="muted">${pct(u.savingPct)}</span>` : `<span class="muted">target ≤</span><br>${ils(u.negotiationTarget)}`}</td>
</tr>`).join('');

  const unitCards = units.map((u) => {
    const hs = unitHighlights(u, a);
    return `<article class="card"><div class="card-head"><h3>${esc(u.id ? 'Apartment ' + u.id : num(u.rooms) + '-room apartment')}</h3><span class="tag">${num(u.rooms)} rooms · ${num(u.sizeM2)} m² · floor ${num(u.floor)}</span></div>
${u.price && u.saving > 0 ? `<div class="save">You save ${ils(u.saving)}<span>${ils(u.fairPerM2 - u.pricePerM2)} less per m² · ${pct(u.savingPct)} below fair value</span></div>` : `<div class="save target">Target: ${ils(u.negotiationTarget)} or less<span>fair value ${ils(u.fairValue)}</span></div>`}
<ul>${hs.slice(1).map((h) => `<li>${esc(h)}</li>`).join('')}</ul></article>`;
  }).join('');

  const compRows = comps.map((c) => `
<tr><td>${dateStr(c.date)}</td><td>${esc(internal ? (c.street || c.address || '') : (c.street || '').replace(/\s*\d+.*$/, ''))}</td><td>${c.distanceM !== null ? c.distanceM + ' m' : '–'}</td>
<td>${num(c.rooms) || '–'}</td><td>${num(c.sizeM2)}</td><td>${c.floor !== undefined && c.floor !== '' ? num(c.floor) : '–'}</td>
<td>${ils(num(c.price))}</td><td>${ils(c.rawPpm)}</td><td>${ils(c.basePpm)}${c.sameBuilding ? ' <span class="muted">same building</span>' : ''}</td></tr>`).join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · Fair price report · The Closing Group</title>
<meta name="robots" content="noindex">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap" rel="stylesheet">
<style>
:root{--ink:#1D1D1F;--muted:#6E6E73;--soft:#F5F5F7;--line:rgba(0,0,0,.08);--accent:#A8522F;--good:#1E7A4C}
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,Inter,'Helvetica Neue',Arial,sans-serif;color:var(--ink);background:#fff;-webkit-font-smoothing:antialiased}
h1,h2,h3{font-family:Newsreader,Georgia,serif;font-weight:500;letter-spacing:-.02em;margin:0}
.wrap{max-width:1080px;margin:0 auto;padding:0 22px}
header.top{background:#000;color:#F5F5F7;padding:18px 0;font-size:14px}
header.top .wrap{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}
.hero{background:#000;color:#F5F5F7;padding:72px 0 88px;text-align:center}
.eyebrow{color:#F0A47A;font-weight:600;font-size:15px}
.hero h1{font-size:56px;line-height:1.05;margin:12px 0 8px}
.hero .big{font-family:Newsreader,Georgia,serif;font-size:96px;line-height:1;margin-top:36px}
.hero .lbl{color:#A1A1A6;font-size:19px;margin-top:10px}
section{padding:72px 0}section.soft{background:var(--soft)}
h2{font-size:40px;margin-bottom:24px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}
.hl{background:#fff;border-radius:20px;padding:24px;border:1px solid var(--line)}
.hl b{display:block;font-family:Newsreader,Georgia,serif;font-weight:500;font-size:24px;margin-bottom:6px}
.hl p{margin:0;color:#424245;line-height:1.5;font-size:16px}
.hl.price{background:#1D1D1F;color:#F5F5F7;border:0}.hl.price p{color:#D2D2D7}
.card{background:#fff;border-radius:20px;padding:24px;border:1px solid var(--line)}
.card-head{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px;margin-bottom:10px}
.card h3{font-size:26px}.tag{color:var(--muted);font-size:14px}
.save{font-family:Newsreader,Georgia,serif;font-size:34px;color:var(--good);margin:6px 0 14px;line-height:1.1}.save span{display:block;font-family:-apple-system,BlinkMacSystemFont,Inter,Arial,sans-serif;font-size:14px;color:var(--muted);margin-top:6px}.save.target{color:var(--ink);font-size:26px}
.card ul{margin:0;padding-left:20px;line-height:1.6}.card li{margin:4px 0}
.tbl{overflow-x:auto;border:1px solid var(--line);border-radius:18px;background:#fff}
table{width:100%;border-collapse:collapse;font-size:14px;font-variant-numeric:tabular-nums;min-width:760px}
th{text-align:left;font-weight:500;color:var(--muted);font-size:12px;padding:12px 10px;border-bottom:1px solid var(--line)}
td{padding:12px 10px;border-bottom:1px solid rgba(0,0,0,.05);vertical-align:top}
td.good{color:var(--good);font-weight:600}.muted{color:var(--muted);font-weight:400;font-size:12px}
.method{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:24px}
.m{background:#fff;border-radius:16px;padding:18px;border:1px solid var(--line)}.m span{color:var(--muted);font-size:13px}.m div{font-size:22px;font-weight:600;margin-top:4px}
ul.assume{columns:2;column-gap:32px;color:#424245;line-height:1.7;font-size:15px;padding-left:18px}
.note{color:var(--muted);font-size:13px;line-height:1.6;max-width:820px}
@media(max-width:734px){.hero h1{font-size:38px}.hero .big{font-size:60px}h2{font-size:30px}ul.assume{columns:1}}
@media print{.hero,header.top{-webkit-print-color-adjust:exact;print-color-adjust:exact}section{padding:36px 0}}
</style></head><body>
<header class="top"><div class="wrap"><span><strong>The Closing Group</strong> <span style="color:#A1A1A6">Israel</span></span><span style="color:#A1A1A6">Fair price report · ${dateStr(a.generatedAt)}${internal ? ' · internal' : ''}</span></div></header>

<div class="hero"><div class="wrap">
<div class="eyebrow">${esc(project.area || '')}${project.street && internal ? ' · ' + esc(project.street) : ''}</div>
<h1>${esc(title)}</h1>
<div style="color:#A1A1A6;font-size:18px">${totals.units} apartment${totals.units === 1 ? '' : 's'}${project.form4Months ? ` · Form 4 in about ${num(project.form4Months)} months` : project.form4 ? ' · Form 4 received' : ''}</div>
<div class="big">${heroNumber}</div><div class="lbl">${esc(heroLabel)}</div>
${hasPrice && totals.saving > 0 && totals.units > 1 ? `<div class="lbl" style="color:#F5F5F7;margin-top:18px;font-size:22px">That's about <strong>${ils(totals.saving / units.filter((u) => u.price).length)}</strong> saved per apartment</div>` : ''}
</div></div>

<section class="soft"><div class="wrap">
<h2>Why this is a great deal</h2>
<div class="grid">${deal.map((h) => `<div class="hl ${h.kind === 'price' ? 'price' : ''}"><b>${esc(h.title)}</b><p>${esc(h.text)}</p></div>`).join('')}</div>
</div></section>

<section><div class="wrap">
<h2>Apartment by apartment</h2>
<div class="grid" style="margin-bottom:28px">${unitCards}</div>
<div class="tbl"><table><thead><tr><th>Apt</th><th>Rooms</th><th>m² (+ balcony)</th><th>Floor</th><th>Faces</th><th>Parking / storage</th><th>${hasPrice ? 'Price' : 'Price'}</th><th>Fair value</th><th>${hasPrice ? 'Saving' : 'Negotiation target'}</th></tr></thead><tbody>${unitRows}</tbody></table></div>
</div></section>

<section class="soft"><div class="wrap">
<h2>How we calculated it</h2>
<div class="method">
<div class="m"><span>Sales compared</span><div>${stats.count}</div></div>
<div class="m"><span>Search radius</span><div>${stats.radius ? stats.radius + ' m' : 'Same area'}</div></div>
<div class="m"><span>Period</span><div>${stats.from ? monthYear(stats.from) + ' – ' + monthYear(stats.to) : '–'}</div></div>
<div class="m"><span>Adjusted price per m² (typical)</span><div>${ils(stats.benchmark)}</div><span>middle half: ${ils(stats.benchLow)} – ${ils(stats.benchHigh)}</span></div>
</div>
<p class="note" style="margin-bottom:18px">We start from sales officially reported to the Israel Tax Authority near the building, from the last ${cfg.maxMonths} months, closest first, widening the radius only until we have at least ${cfg.minComps} sales. Each sale is brought to the same basis: today's market, a new apartment, no parking or storage, per effective m², on the first floor. The typical (median) value is then applied to each apartment's own size, floor, balcony, parking and storage.${stats.removedOutliers ? ` ${stats.removedOutliers} unusual sale${stats.removedOutliers > 1 ? 's were' : ' was'} left out as outliers.` : ''}</p>
<ul class="assume">
<li>Floor: +${cfg.floorPremiumPerFloorPct}% per floor above the 1st (max +${cfg.floorPremiumCapPct}%), ground floor −${cfg.groundFloorDiscountPct}%</li>
<li>Balcony counted at ${Math.round(cfg.balconyWeight * 100)}% of indoor m²; garden at ${Math.round(cfg.gardenWeight * 100)}%</li>
<li>New apartment vs second-hand: +${cfg.newBuildPremiumPct}%</li>
<li>Parking space: ${ilsK(cfg.parkingValue)} · storage unit: ${ilsK(cfg.storageValue)}</li>
<li>Reported sales without details assumed to include ${cfg.assumeCompParking} parking and ${cfg.assumeCompStorage} storage</li>
<li>Market change: ${cfg.annualTrendPct}% per year (${esc(stats.trendSource || '')})</li>
${stats.sameBuilding && stats.sameBuilding.weight ? `<li>Sales in this same building: ${stats.sameBuilding.count}, given ${Math.round(stats.sameBuilding.weight * 100)}% of the weight</li>` : ''}<li>Builder's cost (doch efes): ${a.project.builder && a.project.builder.costTotal ? 'used as a floor' : 'not used; prices rely on our own market evidence'}</li>
<li>"Good deal" target: at least ${cfg.goodDealPct}% below fair value</li>
</ul>
</div></section>

<section><div class="wrap">
<h2>The sales we compared</h2>
<div class="tbl"><table><thead><tr><th>Date</th><th>Street</th><th>Distance</th><th>Rooms</th><th>m²</th><th>Floor</th><th>Price</th><th>₪ per m²</th><th>Adjusted ₪/m²</th></tr></thead><tbody>${compRows}</tbody></table></div>
<p class="note" style="margin-top:22px">Source: real estate sales reported to the Israel Tax Authority${a.project.compsSource ? ' (' + esc(a.project.compsSource) + ')' : ''}. This report is an estimate to support a buying decision. It is not a formal appraisal (shuma) and not financial advice. Final prices are set only in the signed contract.</p>
</div></section>
</body></html>`;
}

module.exports = { render };
