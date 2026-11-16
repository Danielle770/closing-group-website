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
 *   POST /api/lead               apartment chat: the warm lead card for the liaison (saved, emailed, sent to WhatsApp)
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
db.exec(`CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  apt TEXT NOT NULL, lang TEXT, liaison TEXT,
  whatsapp TEXT NOT NULL, whatsapp_ok INTEGER, best_time TEXT,
  questions TEXT, open_questions TEXT, transcript TEXT, analytics TEXT, plan TEXT,
  page TEXT, ref TEXT, ip TEXT, status TEXT NOT NULL DEFAULT 'new'
)`);
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

// ---------- apartment chat: the warm lead for the liaison ----------
function secs(n) { n = Math.max(0, Math.round(Number(n) || 0)); const m = Math.floor(n / 60); return m ? `${m} min ${n % 60} s` : `${n} s`; }
function leadCard(l, plan) {
  const a = l.analytics || {};
  const wa = l.whatsapp.replace(/[^\d]/g, '');
  const lines = [
    `WARM LEAD · Apartment ${l.apt}${l.short ? ` (${l.short})` : ''} · Halperin Street, Netanya`,
    `Liaison: ${l.liaison}${l.lang === 'fr' ? ' (French)' : ''}`,
    `WhatsApp: ${l.whatsapp} · https://wa.me/${wa}${l.whatsapp_ok ? ' (happy to talk on WhatsApp)' : ' (prefers a phone call)'}`,
    `Best time to call: ${l.best_time}`,
    '',
    'What they asked / their concerns:',
    ...(l.questions.length ? l.questions.map((q) => `- ${q}`) : ['- No specific question: general interest']),
  ];
  if (l.open_questions.length) lines.push('', 'Still to answer on the call:', ...l.open_questions.map((q) => `- ${q}`));
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
    if (a.replay_url) lines.push(`- Session replay: ${a.replay_url}`);
    else if (a.posthog_id) lines.push(`- PostHog person: https://us.posthog.com/person/${encodeURIComponent(a.posthog_id)}`);
  }
  if (l.ref) lines.push(`- Referred by: ${l.ref}`);
  lines.push('', 'How to move it towards a deal:', ...plan.map((p) => `- ${p}`));
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

app.post('/api/lead', async (req, res) => {
  const b = req.body || {};
  if (limited('lead:' + req.ip, 10, 10 * 60e3)) return res.status(429).json({ ok: false, error: 'Too many messages. Please try again in a few minutes.' });
  const apt = clean(b.apt, 4);
  if (!agent.aptIds().includes(apt)) return res.status(400).json({ ok: false, error: 'Bad request' });
  const whatsapp = normalisePhone(b.whatsapp);
  if (!whatsapp) return res.status(400).json({ ok: false, error: 'Please enter your WhatsApp number with the country code, for example +1 212 555 0100.' });
  const list = (v, n, max) => (Array.isArray(v) ? v.slice(0, n).map((x) => clean(String(x), max)).filter(Boolean) : []);
  let analytics = {};
  try { analytics = JSON.parse(JSON.stringify(b.analytics || {}).slice(0, 8000)); } catch { analytics = {}; }
  const l = {
    apt, short: agent.aptShort(apt), lang: b.lang === 'fr' ? 'fr' : 'en',
    liaison: clean(b.liaison, 40) === 'Levy Levin' ? 'Levy Levin' : 'Michal',
    whatsapp, whatsapp_ok: !!b.whatsapp_ok, best_time: clean(b.best_time, 200) || 'not given',
    questions: list(b.questions, 40, 600), open_questions: list(b.open_questions, 40, 600), transcript: list(b.transcript, 80, 1200),
    analytics, ref: clean(b.ref, 80), page: clean(b.page, 200),
  };
  const t = now();
  // A follow-up from the same chat (questions asked after the summary) updates the lead instead of making a new one.
  const prev = b.update ? db.prepare("SELECT id FROM leads WHERE apt=? AND whatsapp=? AND created_at > ? ORDER BY id DESC LIMIT 1")
    .get(apt, whatsapp, new Date(Date.now() - 6 * 3600e3).toISOString()) : null;
  const plan = await agent.closingPlan(l);
  const row = [t, l.lang, l.liaison, whatsapp, l.whatsapp_ok ? 1 : 0, l.best_time, JSON.stringify(l.questions), JSON.stringify(l.open_questions),
    JSON.stringify(l.transcript), JSON.stringify(analytics), JSON.stringify(plan), l.page, l.ref, req.ip];
  if (prev) {
    db.prepare(`UPDATE leads SET updated_at=?, lang=?, liaison=?, whatsapp=?, whatsapp_ok=?, best_time=?, questions=?, open_questions=?, transcript=?,
      analytics=?, plan=?, page=?, ref=?, ip=? WHERE id=?`).run(...row, prev.id);
  } else {
    db.prepare(`INSERT INTO leads (created_at, updated_at, apt, lang, liaison, whatsapp, whatsapp_ok, best_time, questions, open_questions, transcript, analytics, plan, page, ref, ip)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(t, t, apt, ...row.slice(1));
  }
  for (const q of l.open_questions) {
    if (!db.prepare('SELECT 1 FROM agent_gaps WHERE question=? AND apt=?').get(q, apt)) db.prepare('INSERT INTO agent_gaps (created_at, apt, lang, question) VALUES (?,?,?,?)').run(t, apt, l.lang, q);
  }
  const card = leadCard(l, plan);
  const subject = `${prev ? 'Lead update' : 'Warm lead'}: Apartment ${apt} · call ${l.best_time} · ${l.liaison}`;
  const transcript = l.transcript.length ? ['', 'The conversation:', ...l.transcript] : [];
  if (cfg.adminEmail) {
    sendMail(cfg.adminEmail, subject, card.concat(transcript).join('\n'),
      emailLayout(`<pre style="font-family:inherit;font-size:15px;line-height:1.6;white-space:pre-wrap">${esc(card.concat(transcript).join('\n'))}</pre>`))
      .catch((e) => console.error('lead mail error:', e.message));
  }
  sendLeadWhatsapp((prev ? '(Update) ' : '') + card.join('\n')).catch((e) => console.error('lead WhatsApp error:', e.message));
  res.json({ ok: true });
});

app.get('/api/admin/leads.csv', (req, res) => {
  if (!isAdmin(req)) { res.set('WWW-Authenticate', 'Basic realm="The Closing Group"'); return res.status(401).send('Login required'); }
  const cols = ['created_at', 'updated_at', 'apt', 'liaison', 'whatsapp', 'whatsapp_ok', 'best_time', 'questions', 'open_questions', 'plan', 'analytics', 'transcript', 'lang', 'ref', 'status'];
  sendCsv(res, 'leads.csv', cols, db.prepare(`SELECT ${cols.join(',')} FROM leads ORDER BY updated_at DESC`).all());
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
