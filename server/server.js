'use strict';
/*
 * The Closing Group — sign-up API
 *   POST /api/join               join a kahila (sends email link + WhatsApp code)
 *   GET  /api/verify-email       email link target
 *   POST /api/verify-whatsapp    check the 6-digit WhatsApp code
 *   POST /api/resend-whatsapp    send a new WhatsApp code
 *   GET  /api/unsubscribe        stop alerts (link in every email)
 *   GET  /api/admin/members.csv  member list for the team (password protected)
 *   GET  /api/health             health check
 *   POST /api/agent              apartment chat: one answer from the AI agent (needs ANTHROPIC_API_KEY)
 *   POST /api/lead               apartment chat: the lead, from the first question on (saved, card emailed to liaison + admin, sent to WhatsApp)
 *   GET  /api/admin/leads.csv, /api/admin/agent-gaps.csv  (password protected)
 * Configuration comes from environment variables (see .env.example).
 */
const express = require('express');
const Database = require('better-sqlite3');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createAgent } = require('./agent');

const env = process.env;
const cfg = {
  port: Number(env.PORT || 3100),
  siteUrl: (env.SITE_URL || 'https://closinggroupisrael.com').replace(/\/$/, ''),
  dbPath: env.DB_PATH || '/var/lib/closinggroup/members.db',
  smtp: { host: env.SMTP_HOST, port: Number(env.SMTP_PORT || 587), user: env.SMTP_USER, pass: env.SMTP_PASS },
  mailFrom: env.MAIL_FROM || 'The Closing Group <closinggroupisrael@gmail.com>',
  replyTo: env.REPLY_TO || 'closinggroupisrael@gmail.com',
  resendKey: env.RESEND_API_KEY || '',
  brevoKey: env.BREVO_API_KEY || '',
  adminEmail: env.ADMIN_EMAIL || '',
  adminPassword: env.ADMIN_PASSWORD || '',
  twilio: { sid: env.TWILIO_ACCOUNT_SID, token: env.TWILIO_AUTH_TOKEN, verifySid: env.TWILIO_VERIFY_SERVICE_SID },
  // Apartment chat agent + leads
  siteDir: env.SITE_DIR || '/var/www/closinggroupisrael.com',
  anthropicKey: env.ANTHROPIC_API_KEY || '',
  model: env.AGENT_MODEL || 'claude-sonnet-5-5',
  waFrom: env.TWILIO_WHATSAPP_FROM || '',          // our WhatsApp sender on Twilio, e.g. +14155238886
  waTo: env.COMPANY_WHATSAPP || '',                // the company WhatsApp that receives every lead, e.g. +972542222504
  waContentSid: env.TWILIO_WHATSAPP_CONTENT_SID || '', // approved WhatsApp template (needed outside the 24-hour window)
  // Lead cards go to the liaison for the chat's language AND to the admin. Until a liaison address is set, admin only.
  liaisonEnEmail: (env.LIAISON_EN_EMAIL || '').trim(),   // Michal
  liaisonFrEmail: (env.LIAISON_FR_EMAIL || '').trim(),   // Levy Levin
  leadAdminEmail: (env.ADMIN_EMAIL || 'closinggroupisrael@gmail.com').trim(),
};
const CONSENT_VERSION = '2026-11-09';
const AREAS = { netanya: 'Netanya', center: 'the Center', jerusalem: 'Jerusalem', home: 'any area' };

// ---------- database ----------
fs.mkdirSync(path.dirname(cfg.dbPath), { recursive: true });
const db = new Database(cfg.dbPath);
db.pragma('journal_mode = WAL');
db.exec(`CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  area TEXT, page TEXT,
  full_name TEXT, email TEXT NOT NULL UNIQUE, whatsapp TEXT,
  country_city TEXT, community TEXT,
  consent_terms_at TEXT, consent_alerts INTEGER NOT NULL DEFAULT 0, consent_alerts_at TEXT,
  consent_ip TEXT, consent_version TEXT,
  email_verified_at TEXT, whatsapp_verified_at TEXT,
  email_token TEXT, unsubscribe_token TEXT NOT NULL
)`);

for (const col of ['ref', 'referred_by']) {
  if (!db.prepare("SELECT 1 FROM pragma_table_info('members') WHERE name=?").get(col)) db.exec(`ALTER TABLE members ADD COLUMN ${col} TEXT`);
}
db.exec(`CREATE TABLE IF NOT EXISTS inquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  full_name TEXT, whatsapp TEXT, question TEXT NOT NULL,
  page TEXT, ref TEXT, ip TEXT, status TEXT NOT NULL DEFAULT 'new'
)`);
// Older installs required a WhatsApp number on inquiries; it is optional now.
if (db.prepare("SELECT 1 FROM pragma_table_info('inquiries') WHERE name='whatsapp' AND \"notnull\"=1").get()) {
  db.exec(`BEGIN;
    ALTER TABLE inquiries RENAME TO inquiries_old;
    CREATE TABLE inquiries (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, full_name TEXT, whatsapp TEXT,
      question TEXT NOT NULL, page TEXT, ref TEXT, ip TEXT, status TEXT NOT NULL DEFAULT 'new');
    INSERT INTO inquiries SELECT id, created_at, full_name, whatsapp, question, page, ref, ip, status FROM inquiries_old;
    DROP TABLE inquiries_old;
    COMMIT;`);
}
// Leads from the apartment chat. A lead starts at the visitor's FIRST question (no number needed);
// later questions, the "set up a call" button, the best time and a WhatsApp number update the same row.
const LEAD_COLS = `id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  apt TEXT NOT NULL, lang TEXT, liaison TEXT,
  whatsapp TEXT, whatsapp_ok INTEGER, best_time TEXT,
  questions TEXT, open_questions TEXT, transcript TEXT, analytics TEXT, plan TEXT,
  page TEXT, ref TEXT, ip TEXT, status TEXT NOT NULL DEFAULT 'new'`;
db.exec(`CREATE TABLE IF NOT EXISTS leads (${LEAD_COLS})`);
// Older installs required a WhatsApp number on every lead; it is optional now.
if (db.prepare("SELECT 1 FROM pragma_table_info('leads') WHERE name='whatsapp' AND \"notnull\"=1").get()) {
  const old = db.prepare("SELECT name FROM pragma_table_info('leads')").all().map((r) => r.name).join(', ');
  db.exec(`BEGIN;
    ALTER TABLE leads RENAME TO leads_old;
    CREATE TABLE leads (${LEAD_COLS});
    INSERT INTO leads (${old}) SELECT ${old} FROM leads_old;
    DROP TABLE leads_old;
    COMMIT;`);
}
for (const [col, type] of [['lead_key', 'TEXT'], ['member_name', 'TEXT'], ['member_email', 'TEXT'], ['member_found', 'INTEGER'],
  ['setup_pressed', 'INTEGER'], ['completed_at', 'TEXT'], ['emailed_at', 'TEXT'], ['emails_sent', 'INTEGER']]) {
  if (!db.prepare("SELECT 1 FROM pragma_table_info('leads') WHERE name=?").get(col)) db.exec(`ALTER TABLE leads ADD COLUMN ${col} ${type}`);
}
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS leads_key ON leads(lead_key)');
// Leads from before this change always had a number: they count as complete.
db.exec('UPDATE leads SET completed_at=updated_at WHERE completed_at IS NULL AND lead_key IS NULL AND whatsapp IS NOT NULL');
db.exec(`CREATE TABLE IF NOT EXISTS agent_gaps (
  id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, apt TEXT, lang TEXT, question TEXT NOT NULL
)`);
db.exec(`CREATE TABLE IF NOT EXISTS qa_opens (question TEXT PRIMARY KEY, opens INTEGER NOT NULL DEFAULT 0, updated_at TEXT)`);

const now = () => new Date().toISOString();
const token = () => crypto.randomBytes(24).toString('hex');
const clean = (v, max = 200) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, '').trim().slice(0, max) : '');

function normalisePhone(raw) {
  let p = clean(raw, 40).replace(/[^\d+]/g, '');
  if (p.startsWith('00')) p = '+' + p.slice(2);
  if (p.startsWith('0')) p = '+972' + p.slice(1); // local Israeli number
  return /^\+\d{8,15}$/.test(p) ? p : null;
}

// ---------- email ----------
const mailer = cfg.smtp.host
  ? nodemailer.createTransport({ host: cfg.smtp.host, port: cfg.smtp.port, secure: cfg.smtp.port === 465, auth: { user: cfg.smtp.user, pass: cfg.smtp.pass },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000 })
  : null;

// Email goes out through an HTTPS email API when a key is set (works even when the
// server's mail ports are blocked), otherwise through SMTP, otherwise it is only logged.
const mailProvider = cfg.resendKey ? 'resend' : cfg.brevoKey ? 'brevo' : mailer ? 'smtp' : 'off';

function parseFrom(from) {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from);
  return m ? { name: m[1].replace(/^"|"$/g, ''), email: m[2] } : { name: '', email: from.trim() };
}

async function httpsMail(url, headers, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: ctrl.signal });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
  } finally { clearTimeout(timer); }
}

async function sendMail(to, subject, text, html) {
  if (mailProvider === 'resend') {
    return httpsMail('https://api.resend.com/emails', { Authorization: `Bearer ${cfg.resendKey}` },
      { from: cfg.mailFrom, to: [to], subject, text, html, reply_to: cfg.replyTo });
  }
  if (mailProvider === 'brevo') {
    const f = parseFrom(cfg.mailFrom);
    return httpsMail('https://api.brevo.com/v3/smtp/email', { 'api-key': cfg.brevoKey, accept: 'application/json' },
      { sender: { name: f.name || 'The Closing Group', email: f.email }, to: [{ email: to }], subject, textContent: text, htmlContent: html, replyTo: { email: cfg.replyTo } });
  }
  if (mailProvider === 'smtp') return mailer.sendMail({ from: cfg.mailFrom, to, subject, text, html, replyTo: cfg.replyTo });
  console.log(`[mail disabled] to=${to} subject="${subject}"\n${text}\n`);
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function emailLayout(bodyHtml, unsubscribeUrl) {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1D1D1F">
<p style="font-size:15px;font-weight:600;margin:0 0 28px">The Closing Group <span style="color:#6E6E73">Israel</span></p>
${bodyHtml}
<p style="font-size:12px;color:#6E6E73;margin-top:40px;line-height:1.5">The Closing Group · Licensed real estate broker (Israel Ministry of Justice), license no. 30928389.<br>
${unsubscribeUrl ? `<a href="${unsubscribeUrl}" style="color:#6E6E73">Stop alerts</a> · ` : ''}<a href="${cfg.siteUrl}/privacy/" style="color:#6E6E73">Privacy policy</a></p></div>`;
}

async function sendVerifyEmail(m) {
  const link = `${cfg.siteUrl}/api/verify-email?token=${m.email_token}`;
  const unsub = `${cfg.siteUrl}/api/unsubscribe?token=${m.unsubscribe_token}`;
  const area = AREAS[m.area] || 'Israel';
  const first = m.full_name ? esc(m.full_name.split(' ')[0]) : 'there';
  await sendMail(m.email, 'Confirm your email · The Closing Group',
    `Hi ${m.full_name || 'there'},\n\nPlease confirm your email to join the kahila for ${area}:\n${link}\n\nIf you didn't sign up, you can ignore this email.\n\nThe Closing Group`,
    emailLayout(`<h1 style="font-family:Georgia,serif;font-weight:500;font-size:30px;margin:0 0 16px">Welcome, ${first}.</h1>
<p style="font-size:17px;line-height:1.5;margin:0 0 24px">Please confirm your email to join the kahila for ${esc(area)}.</p>
<p style="margin:0 0 24px"><a href="${link}" style="display:inline-block;background:#A8522F;color:#fff;text-decoration:none;padding:14px 26px;border-radius:999px;font-weight:600">Confirm my email</a></p>
<p style="font-size:14px;color:#6E6E73;line-height:1.5">If you didn't sign up, you can ignore this email.</p>`, m.consent_alerts ? unsub : null));
}

// Welcome: the same words the member sees on screen. Goes out once email sending works.
async function sendWelcomeEmail(m) {
  const k = { netanya: 'Netanya', center: 'Center', jerusalem: 'Jerusalem' }[m.area];
  const unsub = m.consent_alerts ? `${cfg.siteUrl}/api/unsubscribe?token=${m.unsubscribe_token}` : null;
  const first = m.full_name ? m.full_name.split(' ')[0] : '';
  const deal = m.area === 'netanya'
    ? "We're putting together a group to buy 9 apartments in Netanya — at the builder's cost, below the list price. Our goal is to save roughly ₪390,000–₪488,000 on a regular apartment. Parking and storage are included."
    : `We're gathering families for a group in ${k ? 'the ' + k + ' area' : 'your area'}. When a builder agrees to sell his last finished apartments at his cost, you'll be among the first to know.`;
  const paras = [
    `You're one of the first people in — and that's a good place to be. Here's what happens next:`,
    deal,
    "You don't pay anything now, and you don't commit to anything. When the group opens, we'll show you the real apartments, the real prices and the fair-price check. If you choose one, your ₪50,000 deposit goes straight into our partner law firm's trust account — never to us. Buyers pay no broker fee and no legal fee; the builder pays.",
    "What you need to do now: nothing. We'll message you the moment there's news — when the builder agrees, when the group opens, when the last apartments are left. One message at a time, only when it matters.",
    'Questions? Just reply to this email, or tap the binoculars on the website and ask anything.',
  ];
  const head = `You're in! Welcome to The Closing Group Israel${k ? ` — and to your ${k} Kahila!` : '!'}`;
  const text = `${first ? `Hi ${first},\n\n` : ''}${head}\n\n${paras.join('\n\n')}\n\nWelcome aboard,\nRam & The Closing Group\n${cfg.siteUrl}${unsub ? `\n\nStop alerts: ${unsub}` : ''}`;
  const html = emailLayout(`<h1 style="font-family:Georgia,serif;font-weight:500;font-size:28px;line-height:1.2;margin:0 0 18px">${esc(head)}</h1>
${paras.map((p, i) => `<p style="font-size:16px;line-height:1.6;margin:0 0 14px">${i === 1 || i === 2 || i === 3 ? '<b>' + esc(p.split('. ')[0]) + '.</b> ' + esc(p.split('. ').slice(1).join('. ')) : esc(p)}</p>`).join('\n')}
<p style="margin:22px 0 0"><a href="${cfg.siteUrl}/${k ? m.area + '/' : ''}" style="display:inline-block;background:#D4AF37;color:#0A0A0A;text-decoration:none;padding:13px 24px;border-radius:999px;font-weight:700">See your Kahila</a></p>
<p style="font-size:16px;line-height:1.6;margin:22px 0 0">Welcome aboard,<br>Ram &amp; The Closing Group</p>`, unsub);
  await sendMail(m.email, k ? `Welcome to your ${k} Kahila · The Closing Group` : 'Welcome to The Closing Group', text, html);
}

async function notifyAdmin(m, isNew) {
  if (!cfg.adminEmail) return;
  const lines = [
    `${isNew ? 'New member' : 'Member updated'}: ${m.full_name || '-'}`,
    `Email: ${m.email}`, `WhatsApp: ${m.whatsapp || '-'}`, `Area: ${AREAS[m.area] || m.area}`,
    `From: ${m.country_city || '-'}`, `Community: ${m.community || '-'}`, `Who sent them: ${m.referred_by || '-'}`, `Referral link: ${m.ref || '-'}`, `Alerts consent: ${m.consent_alerts ? 'yes' : 'no'}`,
  ];
  await sendMail(cfg.adminEmail, `${isNew ? 'New kahila member' : 'Kahila member updated'}: ${m.full_name || m.email}`, lines.join('\n'),
    emailLayout(`<pre style="font-family:inherit;font-size:15px;line-height:1.6;white-space:pre-wrap">${esc(lines.join('\n'))}</pre>`));
}

// ---------- WhatsApp (Twilio Verify) ----------
const whatsappEnabled = !!(cfg.twilio.sid && cfg.twilio.token && cfg.twilio.verifySid);

async function twilio(pathPart, params) {
  const res = await fetch(`https://verify.twilio.com/v2/Services/${cfg.twilio.verifySid}/${pathPart}`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${cfg.twilio.sid}:${cfg.twilio.token}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${body.message || 'error'}`);
  return body;
}
const startWhatsapp = (phone) => twilio('Verifications', { To: phone, Channel: 'whatsapp' });
const checkWhatsapp = (phone, code) => twilio('VerificationCheck', { To: phone, Code: code });

// ---------- rate limiting ----------
const hits = new Map();
function limited(key, max, windowMs) {
  const t = Date.now();
  const arr = (hits.get(key) || []).filter((x) => t - x < windowMs);
  arr.push(t); hits.set(key, arr);
  return arr.length > max;
}
setInterval(() => { const t = Date.now(); for (const [k, v] of hits) if (v.every((x) => t - x > 3600e3)) hits.delete(k); }, 600e3).unref();

// ---------- app ----------
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');
app.use(express.json({ limit: '10kb' }));

const findByEmail = db.prepare('SELECT * FROM members WHERE email = ?');

app.get('/api/health', async (req, res) => {
  let emailStatus = mailProvider === 'off' ? 'off' : `configured (${mailProvider})`;
  if (mailProvider === 'smtp' && req.query.check === 'email') {
    try { await mailer.verify(); emailStatus = 'working'; } catch (e) { emailStatus = 'error: ' + e.message; }
  }
  res.json({ ok: true, email: emailStatus, whatsapp: whatsappEnabled, agent: agent.enabled, leadsToWhatsapp: leadWhatsappEnabled });
});

app.post('/api/join', async (req, res) => {
  const b = req.body || {};
  if (limited('join:' + req.ip, 8, 10 * 60e3)) return res.status(429).json({ ok: false, error: 'Too many attempts. Please try again in a few minutes.' });
  if (clean(b.website)) return res.json({ ok: true, whatsapp: 'skipped' }); // honeypot: silently ignore bots

  const email = clean(b.email, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
  if (b.consent_terms !== true) return res.status(400).json({ ok: false, error: 'Please agree to the Terms of use and Privacy policy.' });
  const whatsapp = b.whatsapp ? normalisePhone(b.whatsapp) : null;
  if (b.whatsapp && !whatsapp) return res.status(400).json({ ok: false, error: 'Please enter your WhatsApp number with the country code, for example +1 212 555 0100.' });

  const area = Object.prototype.hasOwnProperty.call(AREAS, b.area) ? b.area : 'home';
  const t = now();
  const alerts = b.consent_alerts === true ? 1 : 0;
  const existing = findByEmail.get(email);
  try {
    if (existing) {
      db.prepare(`UPDATE members SET updated_at=?, area=?, page=?, full_name=COALESCE(NULLIF(?, ''), full_name), whatsapp=COALESCE(?, whatsapp),
        country_city=COALESCE(NULLIF(?, ''), country_city), community=COALESCE(NULLIF(?, ''), community),
        consent_terms_at=?, consent_alerts=?, consent_alerts_at=CASE WHEN ?=1 THEN ? ELSE consent_alerts_at END, consent_ip=?, consent_version=?,
        email_token=CASE WHEN email_verified_at IS NULL THEN ? ELSE email_token END,
        email_verified_at=COALESCE(email_verified_at, ?), ref=COALESCE(NULLIF(?, ''), ref), referred_by=COALESCE(NULLIF(?, ''), referred_by),
        whatsapp_verified_at=CASE WHEN ? IS NOT NULL AND ? != IFNULL(whatsapp,'') THEN NULL ELSE whatsapp_verified_at END
        WHERE email=?`).run(t, area, clean(b.page, 100), clean(b.full_name, 120), whatsapp, clean(b.country_city, 120), clean(b.community, 120),
        t, alerts, alerts, t, req.ip, CONSENT_VERSION, token(), t, clean(b.ref, 80), clean(b.referred_by, 80), whatsapp, whatsapp, email);
    } else {
      db.prepare(`INSERT INTO members (created_at, updated_at, area, page, full_name, email, whatsapp, country_city, community,
        consent_terms_at, consent_alerts, consent_alerts_at, consent_ip, consent_version, email_token, unsubscribe_token, email_verified_at, ref, referred_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(t, t, area, clean(b.page, 100), clean(b.full_name, 120), email, whatsapp,
        clean(b.country_city, 120), clean(b.community, 120), t, alerts, alerts ? t : null, req.ip, CONSENT_VERSION, token(), token(), t,
        clean(b.ref, 80) || null, clean(b.referred_by, 80) || null);
    }
  } catch (e) {
    console.error('db error', e);
    return res.status(500).json({ ok: false, error: 'Something went wrong. Please try again.' });
  }

  const m = findByEmail.get(email);
  // No verification email: joining = enrolled at once. The welcome email goes in the background,
  // so joining never waits on (or depends on) the mail server.
  if (!existing) sendWelcomeEmail(m).catch((e) => console.error('welcome mail error:', e.message));
  notifyAdmin(m, !existing).catch((e) => console.error('admin mail error:', e.message));

  let wa = 'skipped';
  if (whatsappEnabled && m.whatsapp && !m.whatsapp_verified_at) {
    try { await Promise.race([startWhatsapp(m.whatsapp), new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 10000))]); wa = 'sent'; } catch (e) { console.error('whatsapp error', e.message); wa = 'failed'; }
  } else if (m.whatsapp_verified_at) wa = 'verified';
  res.json({ ok: true, emailVerified: true, isNew: !existing, whatsapp: wa });
});

app.post('/api/verify-whatsapp', async (req, res) => {
  const b = req.body || {};
  const email = clean(b.email, 254).toLowerCase();
  const code = clean(b.code, 10).replace(/\D/g, '');
  if (limited('code:' + req.ip, 10, 10 * 60e3) || limited('code:' + email, 6, 10 * 60e3)) return res.status(429).json({ ok: false, error: 'Too many attempts. Please wait a few minutes.' });
  const m = findByEmail.get(email);
  if (!m || !m.whatsapp || code.length < 4 || !whatsappEnabled) return res.status(400).json({ ok: false, error: 'That code did not work. Please check it and try again.' });
  try {
    const r = await checkWhatsapp(m.whatsapp, code);
    if (r.status !== 'approved') return res.status(400).json({ ok: false, error: 'That code did not work. Please check it and try again.' });
    db.prepare('UPDATE members SET whatsapp_verified_at=?, updated_at=? WHERE id=?').run(now(), now(), m.id);
    res.json({ ok: true });
  } catch (e) {
    console.error('whatsapp check error', e.message);
    res.status(400).json({ ok: false, error: 'That code did not work, or it expired. Please request a new one.' });
  }
});

app.post('/api/resend-whatsapp', async (req, res) => {
  const email = clean((req.body || {}).email, 254).toLowerCase();
  if (limited('resend:' + req.ip, 4, 10 * 60e3)) return res.status(429).json({ ok: false, error: 'Please wait a few minutes before asking for another code.' });
  const m = findByEmail.get(email);
  if (!m || !m.whatsapp || !whatsappEnabled || m.whatsapp_verified_at) return res.json({ ok: true });
  try { await startWhatsapp(m.whatsapp); } catch (e) { console.error('whatsapp resend error', e.message); }
  res.json({ ok: true });
});

app.get('/api/verify-email', (req, res) => {
  const t = clean(req.query.token, 64);
  const m = t && db.prepare('SELECT * FROM members WHERE email_token = ?').get(t);
  if (!m) return res.redirect(302, '/verified/?status=invalid');
  if (!m.email_verified_at) db.prepare('UPDATE members SET email_verified_at=?, updated_at=? WHERE id=?').run(now(), now(), m.id);
  res.redirect(302, `/verified/?area=${encodeURIComponent(m.area || 'home')}`);
});

app.get('/api/unsubscribe', (req, res) => {
  const t = clean(req.query.token, 64);
  const m = t && db.prepare('SELECT * FROM members WHERE unsubscribe_token = ?').get(t);
  if (m) db.prepare('UPDATE members SET consent_alerts=0, updated_at=? WHERE id=?').run(now(), m.id);
  res.redirect(302, '/unsubscribed/');
});

app.get('/api/admin/members.csv', (req, res) => {
  const auth = req.get('authorization') || '';
  const [user, pass] = Buffer.from(auth.replace(/^Basic /, ''), 'base64').toString().split(':');
  const ok = cfg.adminPassword && user === 'admin' && pass && pass.length === cfg.adminPassword.length &&
    crypto.timingSafeEqual(Buffer.from(pass), Buffer.from(cfg.adminPassword));
  if (!ok) { res.set('WWW-Authenticate', 'Basic realm="The Closing Group members"'); return res.status(401).send('Login required'); }
  const cols = ['created_at', 'area', 'full_name', 'email', 'whatsapp', 'country_city', 'community', 'referred_by', 'ref', 'consent_alerts', 'email_verified_at', 'whatsapp_verified_at'];
  const q = (v) => { const s = v == null ? '' : String(v); return /^[=+\-@]/.test(s) && !/^\+\d+$/.test(s) ? `"'${s.replace(/"/g, '""')}"` : `"${s.replace(/"/g, '""')}"`; };
  const rows = db.prepare(`SELECT ${cols.join(',')} FROM members ORDER BY created_at DESC`).all();
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', 'attachment; filename="kahila-members.csv"');
  res.send('﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => q(r[c])).join(','))].join('\n'));
});


function isAdmin(req) {
  const auth = req.get('authorization') || '';
  const [user, pass] = Buffer.from(auth.replace(/^Basic /, ''), 'base64').toString().split(':');
  return !!(cfg.adminPassword && user === 'admin' && pass && pass.length === cfg.adminPassword.length &&
    crypto.timingSafeEqual(Buffer.from(pass), Buffer.from(cfg.adminPassword)));
}
function sendCsv(res, name, cols, rows) {
  const q = (v) => { const s = v == null ? '' : String(v); return /^[=+\-@]/.test(s) && !/^\+\d+$/.test(s) ? `"'${s.replace(/"/g, '""')}"` : `"${s.replace(/"/g, '""')}"`; };
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="${name}"`);
  res.send('\ufeff' + [cols.join(','), ...rows.map((r) => cols.map((c) => q(r[c])).join(','))].join('\n'));
}

// ---------- chat inquiries: name + WhatsApp + question; we call back at a time that suits them ----------
app.post('/api/inquiry', (req, res) => {
  const b = req.body || {};
  if (limited('inq:' + req.ip, 6, 10 * 60e3)) return res.status(429).json({ ok: false, error: 'Too many messages. Please try again in a few minutes.' });
  if (clean(b.website)) return res.json({ ok: true });
  const question = clean(String(b.question || '').replace(/\r?\n/g, ' / '), 1500);
  const name = clean(b.full_name, 120);
  const whatsapp = b.whatsapp ? normalisePhone(b.whatsapp) : null; // optional: visitors leave a number only if they want a call back
  if (!question) return res.status(400).json({ ok: false, error: 'Please write your question.' });
  if (b.whatsapp && !whatsapp) return res.status(400).json({ ok: false, error: 'Please enter your WhatsApp number with the country code, for example +1 212 555 0100.' });
  const t = now();
  db.prepare('INSERT INTO inquiries (created_at, full_name, whatsapp, question, page, ref, ip) VALUES (?,?,?,?,?,?,?)')
    .run(t, name, whatsapp, question, clean(b.page, 200), clean(b.ref, 80), req.ip);
  if (cfg.adminEmail) {
    const lines = [`New inquiry from ${name || 'a visitor'}`, `WhatsApp: ${whatsapp || 'not given (no call back possible)'}`, `Question: ${question}`, `Page: ${clean(b.page, 200) || '-'}`,
      `Referred by: ${clean(b.ref, 80) || '-'}`, '', whatsapp ? 'They asked to be called back at a time that suits them. Check their time zone before calling.' : 'No number left: this is a question our answers did not cover.'];
    sendMail(cfg.adminEmail, `New inquiry: ${name || whatsapp || 'question only'}`, lines.join('\n'),
      emailLayout(`<pre style="font-family:inherit;font-size:15px;line-height:1.6;white-space:pre-wrap">${esc(lines.join('\n'))}</pre>`))
      .catch((e) => console.error('inquiry mail error:', e.message));
  }
  res.json({ ok: true });
});

// ---------- Q&A: count which answers people open, to show a real "Most asked" list ----------
app.post('/api/qa-event', express.text({ type: '*/*', limit: '2kb' }), (req, res) => {
  if (limited('qa:' + req.ip, 40, 10 * 60e3)) return res.status(204).end();
  let b = req.body; try { if (typeof b === 'string') b = JSON.parse(b); } catch { b = {}; }
  const q = clean((b || {}).question, 200);
  if (q.length > 5) db.prepare(`INSERT INTO qa_opens (question, opens, updated_at) VALUES (?, 1, ?)
    ON CONFLICT(question) DO UPDATE SET opens = opens + 1, updated_at = excluded.updated_at`).run(q, now());
  res.status(204).end();
});
app.get('/api/qa-top', (req, res) => {
  const rows = db.prepare('SELECT question FROM qa_opens WHERE opens >= 3 ORDER BY opens DESC LIMIT 6').all();
  res.set('Cache-Control', 'public, max-age=600');
  res.json({ top: rows.map((r) => r.question) });
});

app.get('/api/admin/inquiries.csv', (req, res) => {
  if (!isAdmin(req)) { res.set('WWW-Authenticate', 'Basic realm="The Closing Group"'); return res.status(401).send('Login required'); }
  const cols = ['created_at', 'full_name', 'whatsapp', 'question', 'page', 'ref', 'status'];
  sendCsv(res, 'inquiries.csv', cols, db.prepare(`SELECT ${cols.join(',')} FROM inquiries ORDER BY created_at DESC`).all());
});

// ---------- apartment chat: the AI agent ----------
const agent = createAgent(cfg);
const leadWhatsappEnabled = !!(cfg.twilio.sid && cfg.twilio.token && cfg.waFrom && cfg.waTo);

app.post('/api/agent', async (req, res) => {
  if (!agent.enabled) return res.status(503).json({ ok: false, error: 'agent off' });
  const b = req.body || {};
  if (limited('agent:' + req.ip, 40, 10 * 60e3)) return res.status(429).json({ ok: false, error: 'Too many messages. Please try again in a few minutes.' });
  const apt = clean(b.apt, 4);
  const question = clean(String(b.question || '').replace(/\r?\n/g, ' '), 600);
  if (!agent.aptIds().includes(apt) || !question) return res.status(400).json({ ok: false, error: 'Bad request' });
  const lang = b.lang === 'fr' ? 'fr' : 'en';
  const history = Array.isArray(b.history) ? b.history.slice(-12).map((h) => clean(String(h), 800)) : [];
  try {
    const out = await agent.ask({ apt, lang, question, history });
    if (!out.answered) db.prepare('INSERT INTO agent_gaps (created_at, apt, lang, question) VALUES (?,?,?,?)').run(now(), apt, lang, question);
    res.json({ ok: true, answer: out.answer, answered: out.answered });
  } catch (e) {
    console.error('agent error:', e.message);
    res.status(502).json({ ok: false, error: 'agent unavailable' });
  }
});

// ---------- apartment chat: the lead for the liaison ----------
// A lead is born the moment a visitor asks their FIRST question in the apartment chat. WhatsApp is one way to
// reach them, never the gate. The browser keeps a lead id for the conversation and sends it back, so later
// questions, the "set up a call" button, the best time and the number all update the SAME lead.
// Emails: one when the lead is born, one when it is completed with a number, and (at most every
// LEAD_UPDATE_EVERY) one when new questions come in after that. Other updates only refresh the row.
const LEAD_KEY_RE = /^[A-Za-z0-9_-]{16,64}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const LEAD_UPDATE_EVERY = 15 * 60e3;
function secs(n) { n = Math.max(0, Math.round(Number(n) || 0)); const m = Math.floor(n / 60); return m ? `${m} min ${n % 60} s` : `${n} s`; }
const parseJson = (s, d) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };
const n = (x, w) => `${x} ${w}${x === 1 ? '' : 's'}`;
const waLink = (num) => `https://wa.me/${String(num).replace(/[^\d]/g, '')}`;

// Everything about how involved this visitor is, in a few numbers (for the card and the list).
function involvement(l) {
  const a = l.analytics || {};
  const films = a.films_watched_seconds || {};
  const rooms = a.rooms_looked_at || {};
  return {
    questions: (l.questions || []).length,
    seconds: a.opted_out ? null : Math.round(Number(a.seconds_on_site_this_visit) || 0),
    pages: a.opted_out ? null : (a.pages_this_visit || []).length,
    apartments: a.opted_out ? null : (a.apartments_opened || []).length,
    rooms: a.opted_out ? null : Object.keys(rooms).reduce((n, k) => n + (rooms[k] || []).length, 0),
    films: a.opted_out ? null : Object.keys(films).length,
    filmSeconds: a.opted_out ? null : Object.keys(films).reduce((n, k) => n + (Number(films[k]) || 0), 0),
    visualisations: a.opted_out ? null : (a.visualisations_seen || []).length,
  };
}
// How the liaison can reach them, in plain words. WhatsApp first if we have it, otherwise the member's email.
function contactLines(l) {
  const out = [];
  if (l.whatsapp) out.push(`WhatsApp: ${l.whatsapp} · ${waLink(l.whatsapp)}${l.whatsapp_ok ? ' (happy to talk on WhatsApp)' : ' (prefers a phone call)'}`);
  else if (l.member_whatsapp) out.push(`WhatsApp (given when they joined, not in this chat): ${l.member_whatsapp} · ${waLink(l.member_whatsapp)}`);
  if (l.member_email) out.push(`Email (member${l.whatsapp || l.member_whatsapp ? '' : ', no number given'}): ${l.member_email}`);
  if (!out.length) out.push('Contact: none yet. They asked a question but left no number and no email (not a member on this device). The card is here so you can see them; details may follow in an update.');
  return out;
}
function leadCard(l, plan, kind) {
  const a = l.analytics || {};
  const inv = involvement(l);
  const head = { new: l.whatsapp || l.member_email ? 'NEW LEAD' : 'NEW LEAD · no contact yet', complete: 'LEAD COMPLETE · number given', update: 'LEAD UPDATE · new questions' }[kind] || 'LEAD';
  const who = l.member_email
    ? `Who: ${l.member_name || '(name not given)'} · enrolled member · ${l.member_email}${l.member_found ? `${l.member_kahila ? ` · ${l.member_kahila} Kahila` : ''}${l.member_since ? ` · joined ${l.member_since}` : ''}` : ' (email from their browser; not found in our member list)'}`
    : 'Who: a visitor (not a member on this device, no name given)';
  const lines = [
    `${head} · Apartment ${l.apt}${l.short ? ` (${l.short})` : ''} · Halperin Street, Netanya`,
    `Liaison: ${l.liaison}${l.lang === 'fr' ? ' (French)' : ''}`,
    who,
    ...contactLines(l),
    `Best time to call: ${l.best_time || 'not given yet'}`,
    `Left details: ${[l.whatsapp ? 'WhatsApp number' : '', l.member_email ? 'member email' : '', l.best_time ? 'best time' : ''].filter(Boolean).join(', ') || 'none yet'} · Pressed "Set up a call": ${l.setup_pressed ? 'yes' : 'no'}`,
    `How involved: ${n(inv.questions, 'question')}${a.opted_out ? ' (analytics off: no visit data)' : ` · ${secs(inv.seconds)} on the site this visit · ${n(inv.pages, 'page')} · ${n(inv.apartments, 'apartment')} opened · ${n(inv.rooms, 'room')} looked at · ${n(inv.films, 'film')} watched · ${n(inv.visualisations, 'visualisation')} seen`}`,
    '',
    'What they asked / their concerns:',
    ...(l.questions.length ? l.questions.map((q) => `- ${q}`) : ['- No specific question: general interest']),
  ];
  if (l.open_questions.length) lines.push('', 'Still to answer:', ...l.open_questions.map((q) => `- ${q}`));
  lines.push('', 'On the website:');
  if (a.opted_out) lines.push('- The visitor switched analytics off, so we have no browsing data.');
  else {
    lines.push(`- Time on the website this visit: ${secs(a.seconds_on_site_this_visit)} (this page: ${secs(a.seconds_on_this_page)}, chat: ${secs(a.seconds_in_chat)})`);
    if (a.first_visit) lines.push(`- First visit: ${String(a.first_visit).slice(0, 10)}`);
    if ((a.pages_this_visit || []).length) lines.push(`- Pages this visit: ${a.pages_this_visit.join(' > ')}`);
    if ((a.apartments_opened || []).length) lines.push(`- Apartments opened: ${a.apartments_opened.join(', ')}`);
    const rooms = a.rooms_looked_at || {};
    Object.keys(rooms).forEach((id) => lines.push(`- Rooms looked at in Apt ${id}: ${(rooms[id] || []).join(', ')}`));
    if ((a.visualisations_seen || []).length) lines.push(`- Furnished visualisations seen: ${a.visualisations_seen.join(', ')}`);
    const films = a.films_watched_seconds || {};
    if (Object.keys(films).length) lines.push(`- Films watched: ${Object.keys(films).map((id) => `Apt ${id} (${secs(films[id])})`).join(', ')}`);
    if (a.referrer) lines.push(`- Came from: ${a.referrer}`);
    if (a.device) lines.push(`- Device: ${a.device}`);
  }
  // Always keep a way to find who this is in PostHog.
  if (a.replay_url) lines.push(`- Session replay: ${a.replay_url}`);
  if (a.posthog_id) lines.push(`- PostHog person: https://us.posthog.com/person/${encodeURIComponent(a.posthog_id)}`);
  if (l.ref) lines.push(`- Referred by: ${l.ref}`);
  if (plan && plan.length) lines.push('', 'How to move it towards a deal:', ...plan.map((p) => `- ${p}`));
  return lines;
}
async function sendLeadWhatsapp(text) {
  if (!leadWhatsappEnabled) return;
  const params = { From: 'whatsapp:' + cfg.waFrom, To: 'whatsapp:' + cfg.waTo };
  if (cfg.waContentSid) { params.ContentSid = cfg.waContentSid; params.ContentVariables = JSON.stringify({ 1: text.slice(0, 1500) }); }
  else params.Body = text.slice(0, 1550);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${cfg.twilio.sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`${cfg.twilio.sid}:${cfg.twilio.token}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
}
// Who gets the card: the company inbox ONLY. Nobody mails the liaisons: they work the lead in the
// system (the portal). LIAISON_EN_EMAIL / LIAISON_FR_EMAIL stay in the settings but are not used for the card.
function leadRecipients() {
  return [cfg.leadAdminEmail].filter((e) => e && EMAIL_RE.test(e)).map((e) => e.toLowerCase());
}
async function sendLeadCard(l, kind, rowId) {
  const plan = await agent.closingPlan(l);
  db.prepare('UPDATE leads SET plan=?, emailed_at=?, emails_sent=IFNULL(emails_sent,0)+1 WHERE id=?').run(JSON.stringify(plan), now(), rowId);
  const card = leadCard(l, plan, kind);
  const reach = l.whatsapp ? `WhatsApp ${l.whatsapp}` : l.member_email ? `email ${l.member_email}` : 'no contact yet';
  const subject = `${{ new: 'New lead', complete: 'Lead complete', update: 'Lead update' }[kind]}: Apartment ${l.apt} · ${l.member_name || 'visitor'} · ${reach} · ${l.liaison}`;
  const transcript = l.transcript.length ? ['', 'The conversation:', ...l.transcript] : [];
  const text = card.concat(transcript).join('\n');
  const html = emailLayout(`<pre style="font-family:inherit;font-size:15px;line-height:1.6;white-space:pre-wrap">${esc(text)}</pre>`);
  for (const to of leadRecipients()) sendMail(to, subject, text, html).catch((e) => console.error(`lead mail error (${to}):`, e.message));
  sendLeadWhatsapp(({ complete: '(Complete) ', update: '(Update) ' }[kind] || '') + card.join('\n')).catch((e) => console.error('lead WhatsApp error:', e.message));
}

app.post('/api/lead', (req, res) => {
  const b = req.body || {};
  const apt = clean(b.apt, 4);
  if (!agent.aptIds().includes(apt)) return res.status(400).json({ ok: false, error: 'Bad request' });
  let key = LEAD_KEY_RE.test(String(b.lead_id || '')) ? String(b.lead_id) : null;
  let prev = key ? db.prepare('SELECT * FROM leads WHERE lead_key=?').get(key) : null;
  if (prev && prev.apt !== apt) { prev = null; key = null; }    // an id belongs to one apartment chat
  // New leads: 10 per IP per 10 minutes. Updates to a lead this browser already has: more room.
  if (prev ? limited('leadupd:' + req.ip, 60, 10 * 60e3) : limited('lead:' + req.ip, 10, 10 * 60e3)) return res.status(429).json({ ok: false, error: 'Too many messages. Please try again in a few minutes.' });
  // A WhatsApp number is optional. If one is typed it must be a real number.
  const whatsapp = b.whatsapp ? normalisePhone(b.whatsapp) : null;
  if (b.whatsapp && !whatsapp) return res.status(400).json({ ok: false, error: 'Please enter your WhatsApp number with the country code, for example +1 212 555 0100.' });
  const list = (v, n, max) => (Array.isArray(v) ? v.slice(0, n).map((x) => clean(String(x), max)).filter(Boolean) : []);
  let analytics = {};
  try { analytics = JSON.parse(JSON.stringify(b.analytics || {}).slice(0, 8000)); } catch { analytics = {}; }
  // Members: the browser sends the email they enrolled with (cg_member); older members only have it as the
  // PostHog distinct id (set by posthog.identify at join). We confirm it against the member list.
  const posthogId = clean(String(analytics.posthog_id || ''), 254).toLowerCase();
  const sentEmail = clean(b.member_email, 254).toLowerCase();
  const memberEmail = EMAIL_RE.test(sentEmail) ? sentEmail : EMAIL_RE.test(posthogId) ? posthogId : (prev && prev.member_email) || '';
  const m = memberEmail ? findByEmail.get(memberEmail) : null;
  const l = {
    apt, short: agent.aptShort(apt), lang: b.lang === 'fr' ? 'fr' : 'en',
    liaison: clean(b.liaison, 40) === 'Levy Levin' ? 'Levy Levin' : 'Michal',
    whatsapp: whatsapp || (prev && prev.whatsapp) || null,
    whatsapp_ok: whatsapp ? !!b.whatsapp_ok : !!(prev && prev.whatsapp_ok),
    best_time: clean(b.best_time, 200) || (prev && prev.best_time) || '',
    setup_pressed: !!b.setup_pressed || !!(prev && prev.setup_pressed),
    questions: list(b.questions, 40, 600), open_questions: list(b.open_questions, 40, 600), transcript: list(b.transcript, 80, 1200),
    analytics, ref: clean(b.ref, 80), page: clean(b.page, 200),
    member_email: memberEmail, member_found: !!m,
    member_name: (m && m.full_name) || clean(b.member_name, 120) || (prev && prev.member_name) || '',
    member_whatsapp: (m && m.whatsapp) || '', member_kahila: m ? (AREAS[m.area] && m.area !== 'home' ? AREAS[m.area] : '') : '',
    member_since: m ? String(m.created_at || '').slice(0, 10) : '',
  };
  // A conversation's question list only grows; never let a stale update shrink it.
  if (prev) {
    const pq = parseJson(prev.questions, []);
    if (pq.length > l.questions.length) l.questions = pq;
  }
  const t = now();
  const completing = !!whatsapp && !(prev && prev.completed_at);
  let kind = null;
  if (!prev) kind = 'new';
  else if (completing) kind = 'complete';
  else if (prev.completed_at && l.questions.length > parseJson(prev.questions, []).length &&
    (!prev.emailed_at || Date.now() - Date.parse(prev.emailed_at) > LEAD_UPDATE_EVERY)) kind = 'update';
  const vals = [t, l.lang, l.liaison, l.whatsapp, l.whatsapp_ok ? 1 : 0, l.best_time, JSON.stringify(l.questions), JSON.stringify(l.open_questions),
    JSON.stringify(l.transcript), JSON.stringify(analytics), l.page, l.ref, req.ip, l.member_name || null, l.member_email || null, l.member_found ? 1 : 0, l.setup_pressed ? 1 : 0];
  let rowId;
  if (prev) {
    db.prepare(`UPDATE leads SET updated_at=?, lang=?, liaison=?, whatsapp=?, whatsapp_ok=?, best_time=?, questions=?, open_questions=?, transcript=?,
      analytics=?, page=?, ref=?, ip=?, member_name=?, member_email=?, member_found=?, setup_pressed=?, completed_at=COALESCE(completed_at, ?) WHERE id=?`)
      .run(...vals, completing ? t : null, prev.id);
    rowId = prev.id;
  } else {
    key = key || crypto.randomBytes(12).toString('hex');
    rowId = db.prepare(`INSERT INTO leads (created_at, updated_at, lang, liaison, whatsapp, whatsapp_ok, best_time, questions, open_questions, transcript,
      analytics, page, ref, ip, member_name, member_email, member_found, setup_pressed, completed_at, apt, lead_key)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(t, ...vals, completing ? t : null, apt, key).lastInsertRowid;
  }
  for (const q of l.open_questions) {
    if (!db.prepare('SELECT 1 FROM agent_gaps WHERE question=? AND apt=?').get(q, apt)) db.prepare('INSERT INTO agent_gaps (created_at, apt, lang, question) VALUES (?,?,?,?)').run(t, apt, l.lang, q);
  }
  // Answer the browser at once; the plan (may ask the AI) and the emails happen in the background.
  res.json({ ok: true, lead_id: key, emailed: kind });
  if (kind) sendLeadCard(l, kind, rowId).catch((e) => console.error('lead card error:', e.message));
});

// The list the liaison works: every lead, partial ones included, newest first, one row each.
app.get('/api/admin/leads.csv', (req, res) => {
  if (!isAdmin(req)) { res.set('WWW-Authenticate', 'Basic realm="The Closing Group"'); return res.status(401).send('Login required'); }
  const rows = db.prepare('SELECT * FROM leads ORDER BY updated_at DESC, id DESC').all().map((r) => {
    const questions = parseJson(r.questions, []), open = parseJson(r.open_questions, []), a = parseJson(r.analytics, {});
    const m = r.member_email ? findByEmail.get(r.member_email) : null;
    const inv = involvement({ questions, analytics: a });
    const films = a.films_watched_seconds || {}, rooms = a.rooms_looked_at || {};
    const left = [r.whatsapp ? 'WhatsApp' : '', r.member_email ? 'member email' : '', r.best_time ? 'best time' : ''].filter(Boolean);
    return {
      updated_at: r.updated_at, created_at: r.created_at,
      stage: r.completed_at ? 'complete' : 'partial',
      apartment: r.apt, liaison: r.liaison, lang: r.lang,
      name: r.member_name || '', member_email: r.member_email || '', member: r.member_email ? (r.member_found ? 'yes' : 'email not in member list') : 'no',
      whatsapp: r.whatsapp || '',
      how_to_reach: r.whatsapp ? `WhatsApp ${r.whatsapp} ${waLink(r.whatsapp)}` : m && m.whatsapp ? `WhatsApp (from joining) ${m.whatsapp}` : r.member_email ? `Email (member, no number given) ${r.member_email}` : 'no contact yet',
      left_details: left.length ? left.join(' + ') : 'none',
      best_time: r.best_time || '', pressed_set_up_call: r.setup_pressed ? 'yes' : 'no',
      questions_asked: inv.questions,
      minutes_on_site: inv.seconds == null ? 'analytics off' : Math.round(inv.seconds / 6) / 10,
      pages_visited: inv.pages == null ? '' : inv.pages,
      apartments_opened_count: inv.apartments == null ? '' : inv.apartments,
      rooms_looked_at_count: inv.rooms == null ? '' : inv.rooms,
      films_watched_count: inv.films == null ? '' : inv.films,
      film_minutes: inv.filmSeconds == null ? '' : Math.round(inv.filmSeconds / 6) / 10,
      visualisations_seen_count: inv.visualisations == null ? '' : inv.visualisations,
      questions: questions.join(' | '), still_to_answer: open.join(' | '),
      pages: (a.pages_this_visit || []).join(' > '),
      apartments_opened: (a.apartments_opened || []).join(', '),
      rooms_looked_at: Object.keys(rooms).map((k) => `Apt ${k}: ${(rooms[k] || []).join(', ')}`).join(' | '),
      films_watched: Object.keys(films).map((k) => `Apt ${k} (${secs(films[k])})`).join(', '),
      visualisations_seen: (a.visualisations_seen || []).join(', '),
      first_visit: a.first_visit ? String(a.first_visit).slice(0, 10) : '', came_from: a.referrer || '', device: a.device || '',
      posthog: a.replay_url || (a.posthog_id ? `https://us.posthog.com/person/${encodeURIComponent(a.posthog_id)}` : ''),
      ref: r.ref || '', emails_sent: r.emails_sent || 0, status: r.status,
      plan: parseJson(r.plan, []).join(' | '), transcript: parseJson(r.transcript, []).join('\n'),
    };
  });
  const cols = ['updated_at', 'created_at', 'stage', 'apartment', 'liaison', 'name', 'member_email', 'member', 'whatsapp', 'how_to_reach', 'left_details',
    'best_time', 'pressed_set_up_call', 'questions_asked', 'minutes_on_site', 'pages_visited', 'apartments_opened_count', 'rooms_looked_at_count',
    'films_watched_count', 'film_minutes', 'visualisations_seen_count', 'questions', 'still_to_answer', 'pages', 'apartments_opened', 'rooms_looked_at',
    'films_watched', 'visualisations_seen', 'first_visit', 'came_from', 'device', 'posthog', 'ref', 'lang', 'emails_sent', 'status', 'plan', 'transcript'];
  sendCsv(res, 'leads.csv', cols, rows);
});
app.get('/api/admin/agent-gaps.csv', (req, res) => {
  if (!isAdmin(req)) { res.set('WWW-Authenticate', 'Basic realm="The Closing Group"'); return res.status(401).send('Login required'); }
  const cols = ['created_at', 'apt', 'lang', 'question'];
  sendCsv(res, 'agent-gaps.csv', cols, db.prepare(`SELECT ${cols.join(',')} FROM agent_gaps ORDER BY created_at DESC`).all());
});

app.use('/api', (req, res) => res.status(404).json({ ok: false, error: 'Not found' }));

app.listen(cfg.port, '127.0.0.1', () => {
  console.log(`Closing Group API on 127.0.0.1:${cfg.port} · email ${mailProvider === 'off' ? 'OFF (logging only)' : mailProvider} · WhatsApp ${whatsappEnabled ? 'on' : 'OFF'} · agent ${agent.enabled ? 'on' : 'OFF'} · leads to WhatsApp ${leadWhatsappEnabled ? 'on' : 'OFF'}`);
});
