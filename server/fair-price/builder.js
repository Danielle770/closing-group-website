'use strict';
/*
 * Negotiation brief (for us) and builder pitch (for the developer).
 * Uses the fair value analysis plus the builder's carrying costs to answer:
 *   - What should we offer, aim for, and never go above?
 *   - What does holding the unsold apartments cost the builder per month, and over 3/6/9/12 months?
 */
const { num } = require('./engine');
const { ils, ilsK, pct } = require('./highlights');

const BUILDER_DEFAULTS = {
  primePct: 4.75,                // Bank of Israel 3.25% + 1.5% (rate decision 21 Oct 2026)
  rateScenarios: [
    { label: 'Bank construction loan (prime + 1.5%)', addPct: 1.5 },
    { label: 'Credit line (prime + 3%)', addPct: 3 },
    { label: 'Non-bank financing', ratePct: 10 },
  ],
  mainScenario: 1,               // which rate scenario drives the timeline table
  ltvPct: 65,                    // share of the apartments' value financed by debt
  monthlyHoldingPerUnit: 700,    // arnona, building maintenance, insurance for an empty apartment (₪/month)
  brokerFeePct: 2,               // brokers' fees developers now pay to sell one by one
  marketingPct: 1,               // advertising, sales office, staff
  incentivesPct: 3,              // discounts / 20-80 financing perks needed to sell to individuals
  horizons: [3, 6, 9, 12],       // months it might take to sell the units one by one
  kahilaCloseMonths: 1,          // our group signs within about a month
  ourFee: 0,                     // our deal-making fee, paid by the builder (₪)
  realisticMonths: 9,            // how long selling one by one realistically takes in this market
  openingGapPct: 4,              // opening offer sits this % under the target
  costTotal: null,               // builder's cost for these units, if known (e.g. from the bank's doch efes)
  costMarginPct: 3,              // never offer below cost + this margin (keeps the builder whole)
};

const round5k = (n) => Math.round(n / 5000) * 5000;

function negotiate(a, userCfg = {}) {
  const b = { ...BUILDER_DEFAULTS, ...(a.project.builder || {}), ...userCfg };
  const units = a.units;
  const listTotal = units.reduce((s, u) => s + (u.listPrice || 0), 0);
  const fairTotal = units.reduce((s, u) => s + u.fairValue, 0);
  const n = units.length;

  const rates = b.rateScenarios.map((r) => ({ label: r.label, ratePct: r.ratePct ?? b.primePct + r.addPct }));
  const loan = (b.ltvPct / 100) * listTotal;
  const holdingMonthly = n * b.monthlyHoldingPerUnit;
  const monthly = rates.map((r) => ({ ...r, interest: (loan * r.ratePct) / 100 / 12, total: (loan * r.ratePct) / 100 / 12 + holdingMonthly }));
  const main = monthly[Math.min(b.mainScenario, monthly.length - 1)];
  const trend = num(a.cfg.annualTrendPct) / 100;

  const sellingCosts = listTotal * (b.brokerFeePct + b.marketingPct + b.incentivesPct) / 100;
  const scenarios = b.horizons.map((H) => {
    const avg = H / 2; // units sell gradually: on average each waits half the period
    const interest = main.interest * avg;
    const holding = holdingMonthly * avg;
    const drift = listTotal * trend * (avg / 12);
    const net = listTotal - sellingCosts - interest - holding + drift;
    return { months: H, interest, holding, selling: sellingCosts, drift, net };
  });

  const costFloor = b.costTotal ? b.costTotal * (1 + b.costMarginPct / 100) : 0;
  // The price at which the builder ends up exactly as well off as selling alone over H months
  const breakeven = scenarios.map((s) => ({ months: s.months, price: round5k(s.net + b.ourFee + main.total * b.kahilaCloseMonths) }));
  const realistic = breakeven.find((x) => x.months === b.realisticMonths) || breakeven[Math.floor(breakeven.length / 2)];

  // Walk-away: never above the builder's list, and never less than goodDealPct under fair value
  const walkAway = round5k(Math.min(fairTotal * (1 - a.cfg.goodDealPct / 100), listTotal || Infinity));
  // Target: what makes selling to us as good for him as selling alone in a realistic time
  let target = round5k(Math.max(realistic.price, costFloor));
  const tight = target > walkAway;          // his alternative is worth more than we can pay
  target = Math.min(target, walkAway);
  // Opening: a few percent under the target (never below his cost floor)
  const opening = round5k(Math.max(target * (1 - b.openingGapPct / 100), costFloor));

  const kahilaNet = (price) => price - b.ourFee - main.total * b.kahilaCloseMonths;
  const withUs = { opening: kahilaNet(opening), target: kahilaNet(target) };

  const share = (u) => u.fairValue / fairTotal;
  const perUnit = units.map((u) => ({
    id: u.id, rooms: u.rooms, sizeM2: u.sizeM2, floor: u.floor, listPrice: u.listPrice, fairValue: u.fairValue,
    opening: round5k(opening * share(u)), target: round5k(target * share(u)), walkAway: round5k(walkAway * share(u)),
  }));

  return { b, rates: monthly, main, loan, listTotal, fairTotal, n, holdingMonthly, sellingCosts, scenarios, breakeven, realistic, tight, opening, target, walkAway, costFloor, withUs, perUnit };
}

/* ---------- shared look ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const head = (title) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · The Closing Group</title><meta name="robots" content="noindex">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap" rel="stylesheet">
<style>
:root{--ink:#1D1D1F;--muted:#6E6E73;--soft:#F5F5F7;--line:rgba(0,0,0,.08);--accent:#A8522F;--good:#1E7A4C;--bad:#B3261E}
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,Inter,'Helvetica Neue',Arial,sans-serif;color:var(--ink);-webkit-font-smoothing:antialiased}
h1,h2,h3{font-family:Newsreader,Georgia,serif;font-weight:500;letter-spacing:-.02em;margin:0}
.wrap{max-width:1080px;margin:0 auto;padding:0 22px}
header.top{background:#000;color:#F5F5F7;padding:18px 0;font-size:14px}header.top .wrap{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}
.hero{background:#000;color:#F5F5F7;padding:64px 0 80px;text-align:center}.eyebrow{color:#F0A47A;font-weight:600;font-size:15px}
.hero h1{font-size:52px;line-height:1.05;margin:12px 0 10px}.hero p{color:#A1A1A6;font-size:19px;max-width:720px;margin:0 auto}
.three{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-top:40px;text-align:left}
.k{background:#1D1D1F;border-radius:20px;padding:22px}.k span{color:#A1A1A6;font-size:13px}.k div{font-family:Newsreader,Georgia,serif;font-size:38px;margin-top:6px}.k small{display:block;color:#A1A1A6;font-size:13px;margin-top:6px;line-height:1.4}
.k.go div{color:#7FD9A8}.k.stop div{color:#F0A47A}
section{padding:64px 0}section.soft{background:var(--soft)}h2{font-size:38px;margin-bottom:20px}
.tbl{overflow-x:auto;border:1px solid var(--line);border-radius:18px;background:#fff}
table{width:100%;border-collapse:collapse;font-size:14px;font-variant-numeric:tabular-nums;min-width:680px}
th{text-align:left;font-weight:500;color:var(--muted);font-size:12px;padding:12px 10px;border-bottom:1px solid var(--line)}
td{padding:12px 10px;border-bottom:1px solid rgba(0,0,0,.05)}td.good{color:var(--good);font-weight:600}td.bad{color:var(--bad);font-weight:600}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}
.c{background:#fff;border:1px solid var(--line);border-radius:18px;padding:22px}.c b{display:block;font-family:Newsreader,Georgia,serif;font-weight:500;font-size:22px;margin-bottom:6px}.c p{margin:0;color:#424245;line-height:1.5}
.big{font-family:Newsreader,Georgia,serif;font-size:84px;line-height:1;margin-top:30px}
ul.pts{line-height:1.7;font-size:16px;padding-left:20px}.note{color:var(--muted);font-size:13px;line-height:1.6;max-width:840px}
@media(max-width:734px){.hero h1{font-size:36px}.big{font-size:56px}h2{font-size:28px}}
</style></head><body>`;

/* ---------- internal negotiation brief ---------- */
function renderBrief(a, ng) {
  const { b, main } = ng;
  const today = new Date(a.generatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const scen = ng.scenarios.map((s, i) => {
    const diff = ng.withUs.target - s.net;
    return `<tr><td>${s.months} months</td><td>${ils(s.net)}</td><td>${ils(ng.breakeven[i].price)}</td><td class="${diff >= 0 ? 'good' : 'bad'}">${diff >= 0 ? '+' : ''}${ils(diff)}</td></tr>`;
  }).join('');
  const rows = ng.perUnit.map((u) => `<tr><td><strong>${esc(u.id)}</strong></td><td>${u.rooms} · ${u.sizeM2} m² · fl ${u.floor}</td><td>${u.listPrice ? ils(u.listPrice) : '–'}</td><td>${ils(u.fairValue)}</td><td>${ils(u.opening)}</td><td class="good">${ils(u.target)}</td><td>${ils(u.walkAway)}</td></tr>`).join('');
  const listDisc = ng.listTotal ? ` (${pct((1 - ng.target / ng.listTotal) * 100)} below the builder's list)` : '';

  return head('Negotiation brief') + `
<header class="top"><div class="wrap"><span><strong>The Closing Group</strong> <span style="color:#A1A1A6">Israel</span></span><span style="color:#A1A1A6">Negotiation brief · ${today} · INTERNAL, do not share</span></div></header>
<div class="hero"><div class="wrap">
<div class="eyebrow">${esc(a.project.area || '')}</div><h1>What to offer for ${esc(a.project.name || 'this project')}</h1>
<p>${ng.n} apartments · builder's list ${ilsK(ng.listTotal)} · fair market value ${ilsK(ng.fairTotal)}</p>
<div class="three">
<div class="k"><span>Opening offer</span><div>${ilsK(ng.opening)}</div><small>Start here. ${pct((1 - ng.opening / ng.fairTotal) * 100)} below fair value.</small></div>
<div class="k go"><span>Target price</span><div>${ilsK(ng.target)}</div><small>Close here${esc(listDisc)}. It leaves him as well off as selling alone over ${ng.realistic.months} months. You save ${ilsK(ng.fairTotal - ng.target)} vs fair value.</small></div>
<div class="k stop"><span>Walk-away price</span><div>${ilsK(ng.walkAway)}</div><small>Never pay above this: ${ng.listTotal && ng.walkAway >= ng.listTotal ? 'it is his full list price' : `the deal stops being at least ${a.cfg.goodDealPct}% under market`}.</small></div>
</div>${ng.tight ? `<p style="margin-top:22px;color:#F0A47A">Tight deal: selling alone is worth more to him than our walk-away price. Push on certainty and speed, or look for his real costs.</p>` : ''}<div>
</div></div></div>

<section><div class="wrap">
<h2>Per apartment</h2>
<div class="tbl"><table><thead><tr><th>Apt</th><th>Unit</th><th>Builder's list</th><th>Fair value</th><th>Opening</th><th>Target</th><th>Walk-away</th></tr></thead><tbody>${rows}</tbody></table></div>
<p class="note" style="margin-top:14px">Group prices are split between apartments in proportion to each one's fair value, rounded to ₪5,000.${ng.costFloor ? ` No price goes below the builder's cost (${ilsK(b.costTotal)}) plus ${b.costMarginPct}%.` : ' Add the builder\'s cost (e.g. from the bank\'s doch efes) to set a floor under every offer.'}</p>
</div></section>

<section class="soft"><div class="wrap">
<h2>Why the builder should say yes</h2>
<div class="grid">
<div class="c"><b>${ilsK(main.total)} every month</b><p>Our estimate of what these ${ng.n} unsold apartments cost him each month: interest on about ${ilsK(ng.loan)} of debt (${main.label}, ${main.ratePct.toFixed(2)}%) plus upkeep of empty units.</p></div>
<div class="c"><b>${ilsK(ng.sellingCosts)} to sell one by one</b><p>Brokers (${b.brokerFeePct}%), marketing (${b.marketingPct}%) and buyer incentives (${b.incentivesPct}%) he avoids completely with one group signing.</p></div>
<div class="c"><b>Cash in about ${b.kahilaCloseMonths} month${b.kahilaCloseMonths > 1 ? 's' : ''}</b><p>He closes the project, repays the bank, frees his credit line and moves his team to the next project.</p></div>
</div>
<h3 style="margin:34px 0 14px;font-size:26px">If he sells alone, what does he really keep?</h3>
<div class="tbl"><table><thead><tr><th>Time to sell all units</th><th>His net, selling alone</th><th>Our price that matches it</th><th>Our target vs selling alone</th></tr></thead><tbody>${scen}</tbody></table></div>
<p class="note" style="margin-top:14px">"His net" = list price minus selling costs, interest and upkeep while units wait (on average half the period)${num(a.cfg.annualTrendPct) ? `, and market change of ${a.cfg.annualTrendPct}% a year` : ''}. A green number means our target leaves him better off than selling alone in that time. Where it's red, lean on certainty, speed and the freed credit line, or adjust the target.${b.ourFee ? ` Our fee (${ilsK(b.ourFee)}) is already deducted from what he receives with us.` : ''}</p>
</div></section>

<section><div class="wrap">
<h2>Talking points</h2>
<ul class="pts">
<li>One signing for all ${ng.n} apartments, with buyers already verified and funds held in a lawyer's trust account.</li>
<li>Every month of waiting costs him about ${ilsK(main.total)}; over 9 months that's about ${ilsK(main.total * 9)} before any discounts.</li>
<li>No broker fees, no marketing, no 20/80 financing perks to give away: about ${ilsK(ng.sellingCosts)} saved.</li>
<li>He can show his bank a sold-out project and release his guarantees and credit line.</li>
<li>Our prices are anchored to officially reported sales nearby, not a guess. Show him the fair price report.</li>
</ul>
<p class="note">Builder costs are estimates from typical market assumptions (prime ${b.primePct}%, ${b.ltvPct}% of value financed, ₪${b.monthlyHoldingPerUnit} upkeep per empty unit per month). Replace them with his real figures when he shares them. Not financial or legal advice.</p>
</div></section></body></html>`;
}

/* ---------- builder-facing pitch (no fair values, no walk-away) ---------- */
function renderPitch(a, ng, offer) {
  const { b, main } = ng;
  const price = offer || ng.target;
  const net = price - b.ourFee - main.total * b.kahilaCloseMonths;
  const today = new Date(a.generatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const rateRows = ng.rates.map((r) => `<tr><td>${esc(r.label)}</td><td>${r.ratePct.toFixed(2)}%</td><td>${ils(r.interest)}</td><td>${ils(r.total)}</td><td>${ils(r.total * 6)}</td><td>${ils(r.total * 12)}</td></tr>`).join('');
  const scen = ng.scenarios.map((s) => `<tr><td>${s.months} months</td><td>${ils(s.selling)}</td><td>${ils(s.interest + s.holding)}</td>${num(a.cfg.annualTrendPct) ? `<td>${ils(s.drift)}</td>` : ''}<td><strong>${ils(s.net)}</strong></td></tr>`).join('');

  return head('A proposal for your remaining apartments') + `
<header class="top"><div class="wrap"><span><strong>The Closing Group</strong> <span style="color:#A1A1A6">Israel</span></span><span style="color:#A1A1A6">Proposal · ${today}</span></div></header>
<div class="hero"><div class="wrap">
<div class="eyebrow">${esc(a.project.name || a.project.area || '')}</div>
<h1>Close the project this month.</h1>
<p>One verified group of buyers for all ${ng.n} remaining apartments. One signing. No brokers, no marketing, no waiting.</p>
<div class="big">${ilsK(main.total)}</div><p style="margin-top:10px">what these ${ng.n} unsold apartments cost you each month, by our estimate</p>
</div></div>

<section><div class="wrap">
<h2>What waiting costs</h2>
<div class="tbl"><table><thead><tr><th>Financing</th><th>Rate</th><th>Interest / month</th><th>Total / month (incl. upkeep)</th><th>6 months</th><th>12 months</th></tr></thead><tbody>${rateRows}</tbody></table></div>
<p class="note" style="margin-top:14px">Assumes about ${b.ltvPct}% of the apartments' value (${ilsK(ng.loan)}) is financed, prime at ${b.primePct}% (Bank of Israel rate 3.25%, October 2026), and ₪${b.monthlyHoldingPerUnit} per empty apartment per month for arnona, maintenance and insurance. Your real figures will make this more precise.</p>
</div></section>

<section class="soft"><div class="wrap">
<h2>Selling one by one vs. selling to our group</h2>
<div class="tbl"><table><thead><tr><th>If selling all units takes</th><th>Brokers, marketing, incentives</th><th>Interest and upkeep</th>${num(a.cfg.annualTrendPct) ? '<th>Market change</th>' : ''}<th>What you keep</th></tr></thead><tbody>${scen}
<tr style="background:#EAF7EF"><td><strong>Our group, this month</strong></td><td>₪0</td><td>${ils(main.total * b.kahilaCloseMonths)}</td>${num(a.cfg.annualTrendPct) ? '<td>₪0</td>' : ''}<td><strong>${ils(net)}</strong></td></tr>
</tbody></table></div>
<p class="note" style="margin-top:14px">"Selling one by one" starts from your list prices (${ilsK(ng.listTotal)}) and subtracts brokers (${b.brokerFeePct}%), marketing (${b.marketingPct}%), buyer incentives such as 20/80 terms (${b.incentivesPct}%), and the interest and upkeep while units wait to sell.${b.ourFee ? ' Our group figure is after our fee.' : ''}</p>
</div></section>

<section><div class="wrap">
<h2>What else you gain</h2>
<div class="grid">
<div class="c"><b>Certainty</b><p>Verified buyers, funds held in a lawyer's trust account, one coordinated signing.</p></div>
<div class="c"><b>A sold-out project</b><p>Repay the bank, release guarantees and your credit line, and start the next project sooner.</p></div>
<div class="c"><b>Discretion</b><p>No public price cuts. Your list prices stay intact in the market.</p></div>
</div>
<p class="note" style="margin-top:22px">The Closing Group · Licensed real estate broker (Israel Ministry of Justice), license no. 30928389 · closinggroupisrael.com</p>
</div></section></body></html>`;
}

module.exports = { negotiate, renderBrief, renderPitch, BUILDER_DEFAULTS };
