'use strict';
/*
 * The leads portal for the liaisons (Michal = English zone, Levy Levin = French zone) and the Boss.
 *
 *   GET  /api/portal/                 the list (login page when signed out)
 *   POST /api/portal/login, /logout
 *   GET  /api/portal/lead/:id         one lead: card, grade, status, notes, history
 *   POST /api/portal/lead/:id/status  change the status (zone owner or Boss)
 *   POST /api/portal/lead/:id/comment write a note (zone owner or Boss)
 *   GET  /api/portal/team             Boss only: counts per liaison + the daily summary
 *   POST /api/portal/watchdog         Boss only: run the daily check now
 *
 * Rules (decided by Boss):
 *   - Every enrolled member is a lead (Cool until they do more); every chat lead is a lead.
 *   - Same email = one row ("prospect"). Anonymous visitors: one row per conversation (as PR #8).
 *   - Leads are kept forever: nothing here deletes a lead.
 *   - A liaison sees ONLY their zone; Boss sees everything. Zone = the language of the latest chat,
 *     or, for members who never chatted, the language of the page they joined on.
 *   - The watchdog (once a day) only flags and suggests. It never changes a status or writes a note.
 *
 * Pages are plain server-rendered HTML with forms: no scripts, so the site's Content-Security-Policy
 * stays as it is and the portal is fast on a phone.
 */
const crypto = require('crypto');
const express = require('express');

const STATUSES = [['new', 'New'], ['called', 'Called'], ['spoke', 'Spoke'], ['appointment', 'Appointment booked'], ['sale', 'Sale'], ['lost', 'Lost']];
const STATUS_LABEL = Object.fromEntries(STATUSES);
const RANK = { new: 0, called: 1, spoke: 2, appointment: 3, sale: 4, lost: 0 };
const OPEN = (s) => s !== 'sale' && s !== 'lost';
const GRADE = { best: 'Best', warmer: 'Warmer', cool: 'Cool' };
const ZONE = { en: 'English', fr: 'French' };
const SESSION_DAYS = 14;
const TZ = 'Asia/Jerusalem';

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  return `scrypt:${salt.toString('hex')}:${crypto.scryptSync(String(pw), salt, 32).toString('hex')}`;
}
function verifyHash(pw, stored) {
  const m = /^scrypt:([0-9a-f]{32}):([0-9a-f]{64})$/.exec(String(stored || '').trim());
  if (!m || !pw) return false;
  const got = crypto.scryptSync(String(pw), Buffer.from(m[1], 'hex'), 32);
  return crypto.timingSafeEqual(got, Buffer.from(m[2], 'hex'));
}
function safeEq(a, b) {
  if (!a || !b) return false;
  const x = crypto.createHash('sha256').update(String(a)).digest(), y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

function createPortal({ db, cfg, now, esc, sendMail, emailLayout, limited, agent }) {
  const env = process.env;
  const P = {
    bossName: (env.BOSS_NAME || 'Boss').trim(),
    en: { name: (env.LIAISON_EN_NAME || 'Michal').trim(), user: (env.LIAISON_EN_USER || '').trim().toLowerCase(), hash: (env.LIAISON_EN_PASSWORD_HASH || '').trim() },
    fr: { name: (env.LIAISON_FR_NAME || 'Levy Levin').trim(), user: (env.LIAISON_FR_USER || '').trim().toLowerCase(), hash: (env.LIAISON_FR_PASSWORD_HASH || '').trim() },
    missedHours: Math.max(1, Number(env.MISSED_AFTER_HOURS) || 24),
    watchdogHour: Math.min(23, Math.max(0, Number(env.WATCHDOG_HOUR ?? 8) || 0)), // Israel time
  };
  const liaisonName = (zone) => (P[zone] || P.en).name;

  // ---------- tables ----------
  db.exec(`CREATE TABLE IF NOT EXISTS prospects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    zone TEXT NOT NULL DEFAULT 'en',
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL,
    last_activity_at TEXT NOT NULL,
    touched_at TEXT, touched_by TEXT,
    missed_at TEXT,
    merged_into INTEGER
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS prospect_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT, prospect_id INTEGER NOT NULL, at TEXT NOT NULL, who TEXT NOT NULL,
    kind TEXT NOT NULL, from_status TEXT, to_status TEXT, text TEXT
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS prospect_events_p ON prospect_events(prospect_id)');
  db.exec('CREATE TABLE IF NOT EXISTS portal_sessions (token_hash TEXT PRIMARY KEY, user TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL)');
  db.exec('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)');
  db.exec(`CREATE TABLE IF NOT EXISTS daily_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT NOT NULL, created_at TEXT NOT NULL, counts TEXT, missed TEXT, suggestions TEXT
  )`);
  if (!db.prepare("SELECT 1 FROM pragma_table_info('leads') WHERE name='prospect_id'").get()) db.exec('ALTER TABLE leads ADD COLUMN prospect_id INTEGER');

  const parse = (s, d) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };
  const day = (t) => (t ? new Date(t).toLocaleDateString('en-CA', { timeZone: TZ }) : '');
  const event = db.prepare('INSERT INTO prospect_events (prospect_id, at, who, kind, from_status, to_status, text) VALUES (?,?,?,?,?,?,?)');
  const byEmail = db.prepare('SELECT * FROM prospects WHERE email=? AND merged_into IS NULL');
  const newProspect = db.prepare('INSERT INTO prospects (email, zone, created_at, last_activity_at) VALUES (?,?,?,?)');

  // ---------- keep the prospects in step with members + chat leads ----------
  const sync = db.transaction(() => {
    // 1. Every member is a lead.
    for (const m of db.prepare(`SELECT m.email, m.created_at, m.page FROM members m
        WHERE NOT EXISTS (SELECT 1 FROM prospects p WHERE p.email = m.email)`).all()) {
      newProspect.run(m.email, /^\/fr(\/|$)/.test(m.page || '') ? 'fr' : 'en', m.created_at, m.created_at);
    }
    // 2. Every chat lead belongs to one prospect: by email when known, else its own row.
    for (const l of db.prepare('SELECT id, member_email, lang, created_at FROM leads WHERE prospect_id IS NULL ORDER BY id').all()) {
      const email = (l.member_email || '').toLowerCase() || null;
      let p = email ? byEmail.get(email) : null;
      const pid = p ? p.id : newProspect.run(email, l.lang === 'fr' ? 'fr' : 'en', l.created_at, l.created_at).lastInsertRowid;
      db.prepare('UPDATE leads SET prospect_id=? WHERE id=?').run(pid, l.id);
    }
    // 3. A conversation that got its email later (or a different one): move it to the right row.
    for (const l of db.prepare(`SELECT l.id, l.member_email, l.prospect_id, p.email AS p_email FROM leads l JOIN prospects p ON p.id = l.prospect_id
        WHERE l.member_email IS NOT NULL AND l.member_email != '' AND (p.email IS NULL OR p.email != lower(l.member_email))`).all()) {
      const email = l.member_email.toLowerCase();
      const target = byEmail.get(email);
      const others = db.prepare('SELECT COUNT(*) c FROM leads WHERE prospect_id=? AND id!=?').get(l.prospect_id, l.id).c;
      if (!target && l.p_email == null && !others) { db.prepare('UPDATE prospects SET email=? WHERE id=?').run(email, l.prospect_id); continue; }
      const to = target ? target.id : newProspect.run(email, 'en', now(), now()).lastInsertRowid;
      db.prepare('UPDATE leads SET prospect_id=? WHERE id=?').run(to, l.id);
      if (!others && l.p_email == null) mergeInto(l.prospect_id, to);
    }
    // 4. Zone follows the latest chat's language; last activity = newest of joining, chats.
    for (const p of db.prepare(`SELECT p.id, p.zone, p.created_at,
        (SELECT lang FROM leads WHERE prospect_id=p.id ORDER BY updated_at DESC, id DESC LIMIT 1) AS lang,
        (SELECT MAX(updated_at) FROM leads WHERE prospect_id=p.id) AS chat_at,
        (SELECT updated_at FROM members WHERE email=p.email) AS member_at, p.last_activity_at
        FROM prospects p WHERE p.merged_into IS NULL`).all()) {
      const zone = p.lang ? (p.lang === 'fr' ? 'fr' : 'en') : p.zone;
      const last = [p.created_at, p.chat_at, p.member_at].filter(Boolean).sort().pop();
      if (zone !== p.zone) event.run(p.id, now(), 'System', 'zone', null, null, `Moved to the ${ZONE[zone]} zone (${liaisonName(zone)}): the latest chat was in ${ZONE[zone]}.`);
      if (zone !== p.zone || last !== p.last_activity_at) db.prepare('UPDATE prospects SET zone=?, last_activity_at=? WHERE id=?').run(zone, last, p.id);
    }
  });
  function mergeInto(fromId, toId) {
    const a = db.prepare('SELECT * FROM prospects WHERE id=?').get(fromId), b = db.prepare('SELECT * FROM prospects WHERE id=?').get(toId);
    db.prepare('UPDATE prospect_events SET prospect_id=? WHERE prospect_id=?').run(toId, fromId);
    db.prepare('UPDATE leads SET prospect_id=? WHERE prospect_id=?').run(toId, fromId);
    if (RANK[a.status] > RANK[b.status] || (a.status === 'lost' && b.status === 'new')) db.prepare('UPDATE prospects SET status=? WHERE id=?').run(a.status, toId);
    if (a.touched_at && (!b.touched_at || a.touched_at > b.touched_at)) db.prepare('UPDATE prospects SET touched_at=?, touched_by=? WHERE id=?').run(a.touched_at, a.touched_by, toId);
    db.prepare('UPDATE prospects SET merged_into=? WHERE id=?').run(toId, fromId);   // kept, never deleted
    event.run(toId, now(), 'System', 'merge', null, null, `Merged an earlier conversation into this lead (same email: ${b.email}).`);
  }

  // ---------- one person, everything we know, and the grade ----------
  function person(p, leads, m) {
    leads = leads.slice().sort((x, y) => (x.created_at < y.created_at ? 1 : -1));   // newest chat first
    const questions = [], open = [], pages = new Set(), days = new Set();
    let whatsapp = '', whatsappOk = false, bestTime = '', setup = false, name = (m && m.full_name) || '', returningBrowser = false;
    if (m) days.add(day(m.created_at));
    for (const l of leads) {
      const qs = parse(l.questions, []), os = parse(l.open_questions, []), a = parse(l.analytics, {});
      qs.forEach((q) => questions.push({ q, apt: l.apt, at: l.created_at, open: os.includes(q) }));
      os.forEach((q) => { if (!qs.includes(q)) open.push({ q, apt: l.apt, at: l.created_at }); });
      (a.pages_this_visit || []).forEach((x) => pages.add(String(x)));
      days.add(day(l.created_at));
      if (Date.parse(l.updated_at) - Date.parse(l.created_at) > 3 * 3600e3) days.add(day(l.updated_at));
      if (a.first_visit && day(a.first_visit) < day(l.created_at)) { days.add(day(a.first_visit)); returningBrowser = true; }
      if (!whatsapp && l.whatsapp) { whatsapp = l.whatsapp; whatsappOk = !!l.whatsapp_ok; }
      if (!bestTime && l.best_time) bestTime = l.best_time;
      if (l.setup_pressed) setup = true;
      if (!name && l.member_name) name = l.member_name;
    }
    const x = {
      id: p.id, email: p.email || '', zone: p.zone, status: p.status, created_at: p.created_at, last_activity_at: p.last_activity_at,
      touched_at: p.touched_at, touched_by: p.touched_by, missed_at: p.missed_at,
      name, member: m || null, leads, chats: leads.length, questions, open,
      visits: days.size, returningBrowser, pages: [...pages],
      sawQA: [...pages].some((u) => /^\/(fr\/)?questions\//.test(u)),
      whatsapp, whatsappOk, joinWhatsapp: (m && m.whatsapp) || '', bestTime, setup,
      apts: [...new Set(leads.map((l) => l.apt))],
    };
    const r = [];
    if (x.questions.length >= 2) r.push(`asked ${x.questions.length} questions`);
    if (x.visits >= 3) r.push(`keeps coming back (${x.visits} visits)`);
    if (x.whatsapp) r.push('left a WhatsApp number');
    if (x.bestTime) r.push('left a best time to call');
    if (r.length) x.grade = 'best';
    else {
      if (x.chats) r.push(x.questions.length ? 'asked a question in the chat' : 'went to the chat');
      if (x.sawQA) r.push('read the Q&A page');
      if (x.visits >= 2) r.push(`came back (${x.visits} visits)`);
      if (x.setup) r.push('pressed "Set up a call"');
      x.grade = r.length ? 'warmer' : 'cool';
      if (!r.length) r.push('joined and only looked around');
    }
    x.reasons = r;
    x.needsAttention = needsAttention(x);
    return x;
  }
  // Open, and nobody touched it within the window (since it became a lead, or since its newest activity after the last touch).
  function needsAttention(x, at = Date.now()) {
    if (!OPEN(x.status)) return false;
    const since = !x.touched_at ? x.created_at : x.last_activity_at > x.touched_at ? x.last_activity_at : null;
    return !!since && at - Date.parse(since) > P.missedHours * 3600e3;
  }
  function people({ zone, id } = {}) {
    sync();
    const where = ['merged_into IS NULL'], args = [];
    if (zone) { where.push('zone=?'); args.push(zone); }
    if (id) { where.push('id=?'); args.push(id); }
    const ps = db.prepare(`SELECT * FROM prospects WHERE ${where.join(' AND ')}`).all(...args);
    if (!ps.length) return [];
    const ids = new Set(ps.map((p) => p.id));
    const leadsBy = new Map();
    for (const l of db.prepare('SELECT * FROM leads WHERE prospect_id IS NOT NULL').all()) {
      if (!ids.has(l.prospect_id)) continue;
      if (!leadsBy.has(l.prospect_id)) leadsBy.set(l.prospect_id, []);
      leadsBy.get(l.prospect_id).push(l);
    }
    const memberStmt = db.prepare('SELECT * FROM members WHERE email=?');
    return ps.map((p) => person(p, leadsBy.get(p.id) || [], p.email ? memberStmt.get(p.email) : null))
      .sort((a, b) => (a.last_activity_at < b.last_activity_at ? 1 : a.last_activity_at > b.last_activity_at ? -1 : b.id - a.id));
  }

  // ---------- sign-in ----------
  function users() {
    const u = [];
    if (cfg.adminPassword) u.push({ user: 'admin', name: P.bossName, role: 'boss', zone: null, check: (pw) => safeEq(pw, cfg.adminPassword) });
    for (const z of ['en', 'fr']) if (P[z].user && P[z].hash) u.push({ user: P[z].user, name: P[z].name, role: 'liaison', zone: z, check: (pw) => verifyHash(pw, P[z].hash) });
    return u;
  }
  const cookieName = 'cg_portal';
  const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
  function readCookie(req) {
    const m = new RegExp(`(?:^|;\\s*)${cookieName}=([a-f0-9]{64})`).exec(req.get('cookie') || '');
    return m ? m[1] : null;
  }
  function currentUser(req) {
    const tok = readCookie(req);
    if (!tok) return null;
    const s = db.prepare('SELECT * FROM portal_sessions WHERE token_hash=?').get(sha(tok));
    if (!s || s.expires_at < now()) return null;
    return users().find((u) => u.user === s.user) || null;   // a removed or renamed login stops working at once
  }
  const canSee = (u, x) => u.role === 'boss' || u.zone === x.zone;

  // ---------- HTML ----------
  const when = (t) => (t ? new Date(t).toLocaleString('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
  function ago(t) {
    if (!t) return '';
    const s = Math.max(0, (Date.now() - Date.parse(t)) / 1000);
    if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
    if (s < 86400 * 2) return `${Math.round(s / 3600)} h ago`;
    return `${Math.round(s / 86400)} days ago`;
  }
  const waLink = (num) => `https://wa.me/${String(num).replace(/[^\d]/g, '')}`;
  const gradeChip = (g) => `<span class="chip g-${g}">${GRADE[g]}</span>`;
  const statusChip = (s) => `<span class="chip s-${s}">${esc(STATUS_LABEL[s] || s)}</span>`;
  const CSS = `*{box-sizing:border-box}body{margin:0;font:15px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;color:#1D1D1F;background:#F5F5F7}
a{color:#A8522F}header{background:#0A0A0A;color:#fff;padding:10px 14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
header b{font-weight:600}header a{color:#D4AF37;text-decoration:none}header form{margin-left:auto}header button{background:none;border:1px solid #555;color:#ccc;border-radius:8px;padding:4px 10px;font-size:13px}
main{max-width:860px;margin:0 auto;padding:12px}h1{font-size:20px;margin:6px 0 10px}h2{font-size:16px;margin:18px 0 8px}
.chip{display:inline-block;border-radius:999px;padding:1px 9px;font-size:12px;font-weight:600;white-space:nowrap;border:1px solid transparent}
.g-best{background:#E3F4E8;color:#1F7A44;border-color:#D4AF37}.g-warmer{background:#FDEBD7;color:#A35208}.g-cool{background:#E8EEF5;color:#4A5D78}
.s-new{background:#E6EEFC;color:#2350A8}.s-called{background:#EFEAFE;color:#5B3FD1}.s-spoke{background:#DDF3F4;color:#0B6F78}
.s-appointment{background:#FFF1C9;color:#8A6200}.s-sale{background:#1F7A44;color:#fff}.s-lost{background:#E5E5E5;color:#555}
.attn{background:#C62828;color:#fff}
.row{display:block;background:#fff;border-radius:12px;padding:10px 12px;margin:0 0 8px;text-decoration:none;color:inherit;border-left:6px solid #ccc}
.row.b-best{border-left-color:#1F7A44;box-shadow:inset 0 0 0 1px #D4AF37}.row.b-warmer{border-left-color:#E08A2E}.row.b-cool{border-left-color:#8FA3BF}
.row .top{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.row .name{font-weight:600;margin-right:auto}
.facts{font-size:13px;color:#3A3A3C;margin-top:4px}.meta{font-size:12px;color:#6E6E73;margin-top:2px}
.filters{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 10px}.filters a{padding:4px 10px;border-radius:999px;background:#fff;text-decoration:none;color:#1D1D1F;font-size:13px;border:1px solid #ddd}
.filters a.on{background:#1D1D1F;color:#fff;border-color:#1D1D1F}
.card{background:#fff;border-radius:12px;padding:12px 14px;margin:0 0 10px}.card p{margin:4px 0}
.k{color:#6E6E73;font-size:13px}ul{padding-left:18px;margin:6px 0}li{margin:3px 0}
select,textarea,input,button{font:inherit}textarea{width:100%;min-height:70px;border:1px solid #ccc;border-radius:8px;padding:8px}
select,input[type=text],input[type=password]{border:1px solid #ccc;border-radius:8px;padding:8px;width:100%;max-width:340px;background:#fff}
.btn{background:#A8522F;color:#fff;border:0;border-radius:999px;padding:9px 18px;font-weight:600;margin-top:6px}
.ev{border-top:1px solid #eee;padding:7px 0}.ev:first-child{border-top:0}.ev .who{font-size:12px;color:#6E6E73}
table{border-collapse:collapse;width:100%;background:#fff;border-radius:12px;overflow:hidden;font-size:14px}th,td{padding:7px 8px;text-align:left;border-bottom:1px solid #eee}th{font-size:12px;color:#6E6E73}
.ok{background:#E3F4E8;padding:8px 12px;border-radius:10px;margin:0 0 10px}.err{background:#FDE7E7;padding:8px 12px;border-radius:10px;margin:0 0 10px}
details summary{cursor:pointer;color:#A8522F}pre{white-space:pre-wrap;font:inherit;font-size:13px;margin:6px 0}`;
  function page(title, u, body) {
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>${esc(title)} · The Closing Group leads</title><style>${CSS}</style></head><body>
<header><b>The Closing Group · Leads</b>${u ? `<span>${esc(u.name)}${u.zone ? ` · ${ZONE[u.zone]}` : ' · all zones'}</span>
<a href="/api/portal/">List</a>${u.role === 'boss' ? '<a href="/api/portal/team">Team</a>' : ''}
<form method="post" action="/api/portal/logout"><button>Sign out</button></form>` : ''}</header><main>${body}</main></body></html>`;
  }
  function send(res, html, code = 200) {
    res.status(code).set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' }).send(html);
  }
  function factsLine(x) {
    const f = [];
    f.push(x.questions.length ? `${x.questions.length} question${x.questions.length === 1 ? '' : 's'}` : 'no questions');
    f.push(`${x.visits} visit${x.visits === 1 ? '' : 's'}${x.visits >= 2 ? ' (repeat)' : ''}`);
    if (x.chats > 1) f.push(`${x.chats} chats`);
    if (x.whatsapp) f.push('WhatsApp ✓');
    if (x.bestTime) f.push('best time ✓');
    if (x.setup) f.push('pressed "Set up a call"');
    if (x.sawQA) f.push('read Q&A');
    if (x.apts.length) f.push(`Apt ${x.apts.join(', ')}`);
    return f.join(' · ');
  }
  const label = (x) => x.name || x.email || `Visitor #${x.id}`;

  // ---------- routes ----------
  const r = express.Router();
  r.use(express.urlencoded({ extended: false, limit: '8kb' }));
  // Forms only post from our own pages (the cookie is SameSite=Strict as well).
  r.use((req, res, next) => {
    if (req.method !== 'POST') return next();
    const origin = req.get('origin');
    if (origin && origin.replace(/^https?:\/\//, '') !== req.get('host')) return res.status(403).send('Forbidden');
    next();
  });

  function loginPage(res, msg, code = 200) {
    const configured = users().length;
    send(res, page('Sign in', null, `<h1>Sign in</h1>${msg ? `<p class="err">${esc(msg)}</p>` : ''}
${configured ? '' : '<p class="err">No logins are set up yet on this server (ADMIN_PASSWORD / LIAISON_* in the settings).</p>'}
<form method="post" action="/api/portal/login" class="card"><p><label>Username<br><input type="text" name="username" autocomplete="username" autocapitalize="none" required></label></p>
<p><label>Password<br><input type="password" name="password" autocomplete="current-password" required></label></p><button class="btn">Sign in</button></form>`), code);
  }
  r.post('/login', (req, res) => {
    if (limited('portal-login:' + req.ip, 10, 15 * 60e3)) return loginPage(res, 'Too many attempts. Please wait 15 minutes.', 429);
    const name = String(req.body.username || '').trim().toLowerCase(), pw = String(req.body.password || '');
    const u = users().find((x) => x.user === name);
    if (!u || !u.check(pw)) return loginPage(res, 'Wrong username or password.', 401);
    const tok = crypto.randomBytes(32).toString('hex');
    db.prepare('DELETE FROM portal_sessions WHERE expires_at < ?').run(now());
    db.prepare('INSERT INTO portal_sessions (token_hash, user, created_at, expires_at) VALUES (?,?,?,?)')
      .run(sha(tok), u.user, now(), new Date(Date.now() + SESSION_DAYS * 86400e3).toISOString());
    res.set('Set-Cookie', `${cookieName}=${tok}; Path=/api/portal; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}${req.secure ? '; Secure' : ''}`);
    res.redirect(303, '/api/portal/');
  });
  r.post('/logout', (req, res) => {
    const tok = readCookie(req);
    if (tok) db.prepare('DELETE FROM portal_sessions WHERE token_hash=?').run(sha(tok));
    res.set('Set-Cookie', `${cookieName}=; Path=/api/portal; HttpOnly; SameSite=Strict; Max-Age=0`);
    res.redirect(303, '/api/portal/');
  });
  // Everything below needs a signed-in user.
  r.use((req, res, next) => {
    const u = currentUser(req);
    if (!u) return req.method === 'GET' ? loginPage(res, null, 401) : res.status(401).send('Please sign in.');
    req.user = u; next();
  });

  r.get('/', (req, res) => {
    const u = req.user, q = req.query;
    const zone = u.role === 'boss' ? (ZONE[q.zone] ? q.zone : null) : u.zone;
    const all = people({ zone });
    let list = all;
    if (GRADE[q.grade]) list = list.filter((x) => x.grade === q.grade);
    if (STATUS_LABEL[q.status]) list = list.filter((x) => x.status === q.status);
    if (q.attention === '1') list = list.filter((x) => x.needsAttention);
    const count = (f) => all.filter(f).length;
    const link = (patch) => {
      const p = new URLSearchParams(Object.entries({ zone: zone || '', grade: q.grade || '', status: q.status || '', attention: q.attention || '', ...patch }).filter(([, v]) => v));
      return '/api/portal/' + (p.toString() ? `?${p}` : '');
    };
    const chip = (text, patch, on) => `<a href="${esc(link(patch))}" class="${on ? 'on' : ''}">${esc(text)}</a>`;
    const limit = q.all === '1' ? Infinity : 200;
    const rows = list.slice(0, limit).map((x) => `<a class="row b-${x.grade}" href="/api/portal/lead/${x.id}">
<div class="top"><span class="name">${esc(label(x))}</span>${gradeChip(x.grade)}${statusChip(x.status)}${x.needsAttention ? '<span class="chip attn">Needs attention</span>' : ''}</div>
<div class="facts">${esc(factsLine(x))}</div>
<div class="meta">${u.role === 'boss' ? `${ZONE[x.zone]} · ${esc(liaisonName(x.zone))} · ` : ''}${x.member ? 'member' : x.email ? 'email known' : 'visitor'} · last activity ${esc(ago(x.last_activity_at))}</div></a>`).join('');
    send(res, page('Leads', u, `<h1>${u.role === 'boss' ? (zone ? `${ZONE[zone]} leads` : 'All leads') : `Your leads (${ZONE[u.zone]})`} · ${all.length}</h1>
${u.role === 'boss' ? `<div class="filters">${chip('All zones', { zone: '' }, !zone)}${chip(`English · ${P.en.name}`, { zone: 'en' }, zone === 'en')}${chip(`French · ${P.fr.name}`, { zone: 'fr' }, zone === 'fr')}</div>` : ''}
<div class="filters">${chip(`All ${all.length}`, { grade: '', attention: '' }, !q.grade && q.attention !== '1')}${['best', 'warmer', 'cool'].map((g) => chip(`${GRADE[g]} ${count((x) => x.grade === g)}`, { grade: g }, q.grade === g)).join('')}
${chip(`Needs attention ${count((x) => x.needsAttention)}`, { attention: q.attention === '1' ? '' : '1' }, q.attention === '1')}</div>
<div class="filters">${chip('Any status', { status: '' }, !q.status)}${STATUSES.map(([k, v]) => chip(`${v} ${count((x) => x.status === k)}`, { status: k }, q.status === k)).join('')}</div>
${rows || '<p class="card">No leads here yet.</p>'}${list.length > limit ? `<p><a href="${esc(link({ all: '1' }))}">Show all ${list.length}</a></p>` : ''}`));
  });

  function loadFor(req, res) {
    const id = Number(req.params.id);
    const x = Number.isInteger(id) && id > 0 ? people({ id })[0] : null;
    if (!x) { send(res, page('Not found', req.user, '<p class="card">No such lead.</p>'), 404); return null; }
    if (!canSee(req.user, x)) { send(res, page('Not your zone', req.user, '<p class="err">This lead is not in your zone.</p>'), 403); return null; }
    return x;
  }

  r.get('/lead/:id', (req, res) => {
    const x = loadFor(req, res); if (!x) return;
    const u = req.user, m = x.member;
    const evs = db.prepare('SELECT * FROM prospect_events WHERE prospect_id=? ORDER BY at DESC, id DESC').all(x.id);
    const notes = evs.filter((e) => e.kind === 'comment');
    const evText = (e) => e.kind === 'status' ? `Status: ${STATUS_LABEL[e.from_status] || e.from_status} → <b>${esc(STATUS_LABEL[e.to_status] || e.to_status)}</b>`
      : e.kind === 'comment' ? `Note: ${esc(e.text)}` : esc(e.text || e.kind);
    const contact = [];
    if (x.whatsapp) contact.push(`<p>WhatsApp: <a href="${esc(waLink(x.whatsapp))}">${esc(x.whatsapp)}</a> · <a href="tel:${esc(x.whatsapp)}">call</a>${x.whatsappOk ? ' · happy to talk on WhatsApp' : ' · prefers a phone call'}</p>`);
    else if (x.joinWhatsapp) contact.push(`<p>WhatsApp (given when they joined): <a href="${esc(waLink(x.joinWhatsapp))}">${esc(x.joinWhatsapp)}</a> · <a href="tel:${esc(x.joinWhatsapp)}">call</a></p>`);
    if (x.email) contact.push(`<p>Email: <a href="mailto:${esc(x.email)}">${esc(x.email)}</a></p>`);
    if (x.bestTime) contact.push(`<p>Best time to call: <b>${esc(x.bestTime)}</b> (check their time zone)</p>`);
    if (!contact.length) contact.push('<p>No contact yet: they asked in the chat but left no number or email.</p>');
    const chats = x.leads.map((l) => {
      const a = parse(l.analytics, {}), films = a.films_watched_seconds || {}, rooms = a.rooms_looked_at || {};
      const tr = parse(l.transcript, []), plan = parse(l.plan, []);
      const facts = a.opted_out ? ['Analytics switched off by the visitor: no visit data.'] : [
        `Time on the site: ${Math.round((Number(a.seconds_on_site_this_visit) || 0) / 60)} min (chat ${Math.round((Number(a.seconds_in_chat) || 0) / 60)} min)`,
        (a.pages_this_visit || []).length ? `Pages: ${a.pages_this_visit.join(' > ')}` : '',
        (a.apartments_opened || []).length ? `Apartments opened: ${a.apartments_opened.join(', ')}` : '',
        Object.keys(rooms).length ? `Rooms: ${Object.keys(rooms).map((k) => `Apt ${k}: ${(rooms[k] || []).join(', ')}`).join(' | ')}` : '',
        Object.keys(films).length ? `Films watched: ${Object.keys(films).map((k) => `Apt ${k} (${Math.round(films[k])} s)`).join(', ')}` : '',
        a.first_visit ? `First visit to the site: ${day(a.first_visit)}` : '', a.referrer ? `Came from: ${a.referrer}` : '', a.device ? `Device: ${a.device}` : '',
      ].filter(Boolean);
      const ph = a.replay_url || (a.posthog_id ? `https://us.posthog.com/person/${encodeURIComponent(a.posthog_id)}` : '');
      return `<div class="card"><p><b>Chat · Apartment ${esc(l.apt)}</b> · ${esc(when(l.created_at))}${l.lang === 'fr' ? ' · French' : ''}</p>
<ul>${facts.map((f) => `<li>${esc(f)}</li>`).join('')}${ph ? `<li><a href="${esc(ph)}" rel="noopener">PostHog</a></li>` : ''}</ul>
${plan.length ? `<details><summary>How to move it towards a deal</summary><ul>${plan.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></details>` : ''}
${tr.length ? `<details><summary>The conversation</summary><pre>${esc(tr.join('\n'))}</pre></details>` : ''}</div>`;
    }).join('');
    send(res, page(label(x), u, `<p><a href="/api/portal/">← All leads</a></p>
<h1>${esc(label(x))}</h1>
<p>${gradeChip(x.grade)} ${statusChip(x.status)} ${x.needsAttention ? '<span class="chip attn">Needs attention</span>' : ''}</p>
<p class="k">Why ${GRADE[x.grade]}: ${esc(x.reasons.join(', '))}.</p>
${req.query.saved ? '<p class="ok">Saved.</p>' : ''}
<div class="card"><p><b>Who</b></p>
<p>${m ? `Enrolled member${m.area && m.area !== 'home' ? ` · ${esc({ netanya: 'Netanya', center: 'Center', jerusalem: 'Jerusalem' }[m.area] || m.area)} Kahila` : ''} · joined ${esc(day(m.created_at))}${m.country_city ? ` · ${esc(m.country_city)}` : ''}${m.community ? ` · ${esc(m.community)}` : ''}` : x.email ? 'Not in the member list (email from their browser)' : 'A visitor (not a member on that device)'}</p>
<p class="k">${ZONE[x.zone]} zone · ${esc(liaisonName(x.zone))} · lead since ${esc(when(x.created_at))} · last activity ${esc(ago(x.last_activity_at))}</p>
<p class="k">${esc(factsLine(x))}</p></div>
<div class="card"><p><b>Contact</b></p>${contact.join('')}</div>
<div class="card"><form method="post" action="/api/portal/lead/${x.id}/status"><p><b>Status</b></p>
<select name="status">${STATUSES.map(([k, v]) => `<option value="${k}"${k === x.status ? ' selected' : ''}>${v}</option>`).join('')}</select><br><button class="btn">Save status</button></form></div>
<div class="card"><form method="post" action="/api/portal/lead/${x.id}/comment"><p><b>Add a note</b> <span class="k">what you did, what they said, next step</span></p>
<textarea name="text" maxlength="1000" required></textarea><br><button class="btn">Save note</button></form>
${notes.length ? notes.map((e) => `<div class="ev">${esc(e.text)}<div class="who">${esc(e.who)} · ${esc(when(e.at))}</div></div>`).join('') : '<p class="k">No notes yet.</p>'}</div>
<h2>Questions (${x.questions.length})</h2><div class="card">${x.questions.length ? `<ul>${x.questions.map((q) => `<li>${esc(q.q)} <span class="k">· Apt ${esc(q.apt)} · ${esc(when(q.at))}${q.open ? ' · <b>still to answer</b>' : ''}</span></li>`).join('')}</ul>` : '<p class="k">No questions yet.</p>'}
${x.open.length ? `<p><b>Still to answer</b></p><ul>${x.open.map((q) => `<li>${esc(q.q)}</li>`).join('')}</ul>` : ''}</div>
${chats ? `<h2>Chats and visits</h2>${chats}` : ''}
<h2>History</h2><div class="card">${evs.length ? evs.map((e) => `<div class="ev">${evText(e)}<div class="who">${esc(e.who)} · ${esc(when(e.at))}</div></div>`).join('') : '<p class="k">Nothing yet.</p>'}</div>`));
  });

  function touch(x, who) { db.prepare('UPDATE prospects SET touched_at=?, touched_by=?, missed_at=NULL WHERE id=?').run(now(), who, x.id); }
  r.post('/lead/:id/status', (req, res) => {
    const x = loadFor(req, res); if (!x) return;
    const s = String(req.body.status || '');
    if (!STATUS_LABEL[s]) return res.status(400).send('Unknown status');
    if (s !== x.status) {
      db.prepare('UPDATE prospects SET status=? WHERE id=?').run(s, x.id);
      event.run(x.id, now(), req.user.name, 'status', x.status, s, null);
    }
    touch(x, req.user.name);
    res.redirect(303, `/api/portal/lead/${x.id}?saved=1`);
  });
  r.post('/lead/:id/comment', (req, res) => {
    const x = loadFor(req, res); if (!x) return;
    const text = String(req.body.text || '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, 1000);
    if (!text) return res.redirect(303, `/api/portal/lead/${x.id}`);
    event.run(x.id, now(), req.user.name, 'comment', null, null, text);
    touch(x, req.user.name);
    res.redirect(303, `/api/portal/lead/${x.id}?saved=1`);
  });

  // ---------- Boss: counts per liaison + daily summary ----------
  function teamCounts() {
    const all = people();
    const reached = new Map();   // the highest status each lead ever reached
    for (const e of db.prepare("SELECT prospect_id, to_status FROM prospect_events WHERE kind='status'").all()) reached.set(e.prospect_id, Math.max(reached.get(e.prospect_id) || 0, RANK[e.to_status] || 0));
    const zones = {};
    for (const z of ['en', 'fr']) {
      const L = all.filter((x) => x.zone === z);
      const top = (x) => Math.max(RANK[x.status] || 0, reached.get(x.id) || 0);
      zones[z] = {
        liaison: P[z].name, given: L.length, touched: L.filter((x) => x.touched_at).length,
        needsAttention: L.filter((x) => x.needsAttention).length,
        called: L.filter((x) => top(x) >= 1).length, spoke: L.filter((x) => top(x) >= 2).length,
        appointments: L.filter((x) => top(x) >= 3).length, sales: L.filter((x) => x.status === 'sale').length, lost: L.filter((x) => x.status === 'lost').length,
        best: L.filter((x) => x.grade === 'best').length, warmer: L.filter((x) => x.grade === 'warmer').length, cool: L.filter((x) => x.grade === 'cool').length,
      };
    }
    const sum = (k) => zones.en[k] + zones.fr[k];
    const total = { given: sum('given'), touched: sum('touched'), needsAttention: sum('needsAttention'), spoke: sum('spoke'), appointments: sum('appointments'), sales: sum('sales'), lost: sum('lost') };
    return { all, zones, total };
  }
  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '–');

  r.get('/team', (req, res) => {
    if (req.user.role !== 'boss') return send(res, page('Not allowed', req.user, '<p class="err">Only the Boss sees the team view.</p>'), 403);
    const { zones, total } = teamCounts();
    const s = db.prepare('SELECT * FROM daily_summaries ORDER BY id DESC LIMIT 1').get();
    const rowsHtml = ['en', 'fr'].map((z) => { const c = zones[z]; return `<tr><td><b>${esc(c.liaison)}</b><br><span class="k">${ZONE[z]}</span></td><td>${c.given}</td><td>${c.touched}</td><td>${c.spoke}</td><td>${c.appointments}</td><td>${c.sales}</td><td>${c.needsAttention ? `<span class="chip attn">${c.needsAttention}</span>` : 0}</td></tr>`; }).join('');
    const missed = s ? parse(s.missed, []) : [];
    send(res, page('Team', req.user, `<h1>Team</h1>
${req.query.ran ? '<p class="ok">Check done. The missed list went to the admin email.</p>' : ''}
<table><tr><th>Liaison</th><th>Leads given</th><th>Touched</th><th>Spoken to</th><th>Appointments</th><th>Sales</th><th>Needs attention</th></tr>${rowsHtml}
<tr><td><b>All</b></td><td>${total.given}</td><td>${total.touched}</td><td>${total.spoke}</td><td>${total.appointments}</td><td>${total.sales}</td><td>${total.needsAttention}</td></tr></table>
<p class="k">Conversion so far: leads ${total.given} → spoke ${total.spoke} (${pct(total.spoke, total.given)}) → appointment ${total.appointments} (${pct(total.appointments, total.spoke)}) → sale ${total.sales} (${pct(total.sales, total.appointments)}). "Spoken to" and "Appointments" count every lead that ever reached that step.</p>
<h2>Daily summary${s ? ` · ${esc(s.day)}` : ''}</h2>
${s ? `<div class="card"><pre>${esc(summaryText(parse(s.counts, {})))}</pre>
${s.suggestions ? `<p><b>Suggestions</b> <span class="k">(AI, advice only: it never changes a status or writes a note)</span></p><pre>${esc(s.suggestions)}</pre>` : '<p class="k">No AI suggestions (no Anthropic key on the server).</p>'}
<p><b>Missed (${missed.length})</b></p>${missed.length ? `<ul>${missed.slice(0, 100).map((m) => `<li><a href="/api/portal/lead/${m.id}">${esc(m.name)}</a> · ${GRADE[m.grade]} · ${esc(m.liaison)} · waiting ${esc(m.waiting)}</li>`).join('')}</ul>` : '<p class="k">None.</p>'}</div>` : '<p class="card">No summary yet. It is written once a day, or press the button below.</p>'}
<form method="post" action="/api/portal/watchdog"><button class="btn">Run the check now</button></form>
<p class="k">The check runs every day at ${String(P.watchdogHour).padStart(2, '0')}:00 Israel time. A lead needs attention when nobody touched it (status or note) within ${P.missedHours} hours.</p>`));
  });

  // ---------- the watchdog ----------
  function summaryText(c) {
    if (!c || !c.total) return '';
    const t = c.total;
    return [
      `Leads: ${t.given} (open ${t.open}) · touched: ${t.touched} · missed (needs attention): ${t.needsAttention}`,
      `New in the last 24 hours: ${t.new24}`,
      `Conversion: leads ${t.given} → spoke ${t.spoke} → appointment ${t.appointments} → sale ${t.sales} · lost ${t.lost}`,
      ...['en', 'fr'].map((z) => { const s = c.zones[z]; return `${s.liaison} (${ZONE[z]}): ${s.given} leads · ${s.touched} touched · ${s.needsAttention} missed · ${s.spoke} spoke · ${s.appointments} appointments · ${s.sales} sales`; }),
      `Grades: Best ${c.grades.best} · Warmer ${c.grades.warmer} · Cool ${c.grades.cool}`,
    ].join('\n');
  }
  async function runWatchdog() {
    const t = now();
    const { all, zones, total } = teamCounts();
    const missed = all.filter((x) => x.needsAttention)
      .sort((a, b) => ({ best: 0, warmer: 1, cool: 2 }[a.grade] - { best: 0, warmer: 1, cool: 2 }[b.grade]) || (a.created_at < b.created_at ? -1 : 1));
    for (const x of missed) {
      if (x.missed_at) continue;   // already flagged in this run of silence
      db.prepare('UPDATE prospects SET missed_at=? WHERE id=?').run(t, x.id);
      event.run(x.id, t, 'Watchdog', 'flag', null, null, `Needs attention: nobody touched this lead within ${P.missedHours} hours.`);
    }
    const waiting = (x) => ago(!x.touched_at ? x.created_at : x.last_activity_at).replace(' ago', '');
    const missedList = missed.map((x) => ({ id: x.id, name: label(x), grade: x.grade, zone: x.zone, liaison: liaisonName(x.zone), waiting: waiting(x),
      contact: x.whatsapp || x.joinWhatsapp || x.email || 'no contact', status: x.status }));
    const counts = {
      zones, grades: { best: all.filter((x) => x.grade === 'best').length, warmer: all.filter((x) => x.grade === 'warmer').length, cool: all.filter((x) => x.grade === 'cool').length },
      total: { ...total, open: all.filter((x) => OPEN(x.status)).length, new24: all.filter((x) => Date.now() - Date.parse(x.created_at) < 86400e3).length },
      missedByGrade: { best: missed.filter((x) => x.grade === 'best').length, warmer: missed.filter((x) => x.grade === 'warmer').length, cool: missed.filter((x) => x.grade === 'cool').length },
    };
    let suggestions = '';
    if (cfg.anthropicKey && agent.callClaude) {
      try {
        // Numbers only: no names, emails or phone numbers leave the server for this.
        suggestions = await agent.callClaude(`You advise the Boss of The Closing Group, a group-buying platform for new apartments in Israel. Liaisons call leads that come from the website (members who joined, and visitors who asked in the apartment chat). Grades: Best (several questions, came back, or left a number/best time), Warmer (chatted, read the Q&A, or came back once), Cool (joined, only looked). Statuses: New, Called, Spoke, Appointment booked, Sale, Lost. A lead "needs attention" when nobody touched it within ${P.missedHours} hours.
From today's numbers, write 3 to 5 short, plain, practical suggestions for what the team should do better today (who to call first, which liaison needs help, where leads drop off). Be specific to the numbers. Plain text, one per line, no numbering, no markdown. Never invent numbers.`,
        [{ role: 'user', content: JSON.stringify(counts) }], 500);
      } catch (e) { console.error('watchdog AI error:', e.message); suggestions = ''; }
    }
    const today = day(t);
    db.prepare('INSERT INTO daily_summaries (day, created_at, counts, missed, suggestions) VALUES (?,?,?,?,?)').run(today, t, JSON.stringify(counts), JSON.stringify(missedList), suggestions || null);
    db.prepare("INSERT INTO kv (k, v) VALUES ('watchdog_day', ?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").run(today);

    const to = (cfg.leadAdminEmail || cfg.adminEmail || '').trim();
    if (to) {
      const lines = [`Daily leads check · ${today}`, '', summaryText(counts), ''];
      if (missedList.length) {
        lines.push(`MISSED: ${missedList.length} open lead${missedList.length === 1 ? '' : 's'} nobody touched within ${P.missedHours} hours:`);
        for (const z of ['en', 'fr']) {
          const L = missedList.filter((m) => m.zone === z);
          if (!L.length) continue;
          lines.push('', `${liaisonName(z)} (${ZONE[z]}): ${L.length}`);
          L.slice(0, 200).forEach((m) => lines.push(`- [${GRADE[m.grade]}] ${m.name} · ${m.contact} · waiting ${m.waiting} · ${cfg.siteUrl}/api/portal/lead/${m.id}`));
          if (L.length > 200) lines.push(`- … and ${L.length - 200} more in the portal`);
        }
      } else lines.push('No missed leads. Every open lead was touched in time.');
      if (suggestions) lines.push('', 'Suggestions (AI, advice only):', ...suggestions.split('\n').map((s) => `- ${s.replace(/^[-•*\s]+/, '')}`));
      lines.push('', `Portal: ${cfg.siteUrl}/api/portal/team`);
      const text = lines.join('\n');
      sendMail(to, `Leads check ${today}: ${missedList.length} missed · ${total.given} leads`, text,
        emailLayout(`<pre style="font-family:inherit;font-size:15px;line-height:1.6;white-space:pre-wrap">${esc(text)}</pre>`))
        .catch((e) => console.error('watchdog mail error:', e.message));
    }
    return { missed: missedList.length, counts };
  }
  r.post('/watchdog', async (req, res) => {
    if (req.user.role !== 'boss') return res.status(403).send('Only the Boss can run the check.');
    try { await runWatchdog(); } catch (e) { console.error('watchdog error:', e); }
    res.redirect(303, '/api/portal/team?ran=1');
  });

  // Once a day, at WATCHDOG_HOUR Israel time (checked every 10 minutes; a missed hour runs at the next check).
  function tick() {
    try {
      const hour = Number(new Date().toLocaleString('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }));
      const last = (db.prepare("SELECT v FROM kv WHERE k='watchdog_day'").get() || {}).v;
      if (hour >= P.watchdogHour && last !== day(now())) runWatchdog().catch((e) => console.error('watchdog error:', e));
    } catch (e) { console.error('watchdog tick error:', e); }
  }
  setInterval(tick, 10 * 60e3).unref();
  setTimeout(tick, 30e3).unref();

  // For the lead emails: the portal link and whether this person chatted before.
  function forLead(leadRowId) {
    try {
      sync();
      const l = db.prepare('SELECT prospect_id FROM leads WHERE id=?').get(leadRowId);
      if (!l || !l.prospect_id) return null;
      const chats = db.prepare('SELECT COUNT(*) c FROM leads WHERE prospect_id=?').get(l.prospect_id).c;
      return { id: l.prospect_id, url: `${cfg.siteUrl}/api/portal/lead/${l.prospect_id}`, chats };
    } catch (e) { console.error('portal link error:', e.message); return null; }
  }

  return { router: r, sync, people, runWatchdog, forLead, hashPassword };
}

module.exports = { createPortal, hashPassword, verifyHash };
