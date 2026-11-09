#!/usr/bin/env node
'use strict';
/*
 * Fair price agent — command line.
 *   node run.js <deal.json> <sales.csv|sales.json> [report.html] [--public]
 * deal.json  : the project, building, location and apartments (see examples/deal.example.json)
 * sales      : nearby reported sales (see examples/sales.example.csv)
 * --public   : hide house numbers of the compared sales (for sharing with members)
 */
const fs = require('fs');
const path = require('path');
const { analyse } = require('./engine');
const { render } = require('./report');
const { ilsK, pct } = require('./highlights');

function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((c) => c.trim() !== ''));
  const keys = head.map((h) => h.replace(/^﻿/, '').trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

function loadSales(file) {
  const text = fs.readFileSync(file, 'utf8');
  return file.endsWith('.json') ? JSON.parse(text) : parseCSV(text);
}

if (require.main === module) {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const pub = process.argv.includes('--public');
  if (args.length < 2) { console.error('Usage: node run.js <deal.json> <sales.csv> [report.html] [--public]'); process.exit(1); }
  const deal = JSON.parse(fs.readFileSync(args[0], 'utf8'));
  const sales = loadSales(args[1]);
  const result = analyse(deal, sales);
  const out = args[2] || path.join(path.dirname(args[0]), 'fair-price-report.html');
  fs.writeFileSync(out, render(result, { internal: !pub }));

  const s = result.stats, t = result.totals;
  console.log(`Compared with ${s.count} sales${s.radius ? ' within ' + s.radius + ' m' : ''}; typical adjusted price ${Math.round(s.benchmark).toLocaleString()} ₪/m²`);
  for (const u of result.units) {
    console.log(`  ${u.id || '-'}: ${u.rooms} rooms, ${u.sizeM2} m², floor ${u.floor} → fair ${ilsK(u.fairValue)}` +
      (u.price ? `, price ${ilsK(u.price)}, saving ${ilsK(u.saving)} (${pct(u.savingPct)})` : `, target ≤ ${ilsK(u.negotiationTarget)}`));
  }
  if (t.price) console.log(`TOTAL saving ${ilsK(t.saving)} (${pct(t.savingPct)})`);
  console.log('Report: ' + out);
}

module.exports = { parseCSV, loadSales };
