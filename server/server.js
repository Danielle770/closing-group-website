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
 * Configuration comes from environment variables (see .env.example).
 */
const express = require('express');
const Database = require('better-sqlite3');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const env = process.env;
const cfg = {
  port: Number(env.PORT || 3100),
  siteUrl: (env.SITE_URL || 'https://closinggroupisrael.com').replace(/\/$/, ''),
  dbPath: env.DB_PATH || '/var/lib/closinggroup/members.db',
  smtp: { host: env.SMTP_HOST, port: Number(env.SMTP_PORT || 587), user: env.SMTP_USER, pass: env.SMTP_PASS },
  mailFrom: env.MAIL_FROM || 'The Closing Group <closinggroupisrael@gmail.com>',
  adminEmail: env.ADMIN_EMAIL || '',
  adminPassword: env.ADMIN_PASSWORD || '',
  twilio: { sid: env.TWILIO_ACCOUNT_SID, token: env.TWILIO_AUTH_TOKEN, verifySid: env.TWILIO_VERIFY_SERVICE_SID },
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
  ? nodemailer.createTransport({ host: cfg.smtp.host, port: cfg.smtp.port, secure: cfg.smtp.port === 465, auth: { user: cfg.smtp.user, pass: cfg.smtp.pass } })
  : null;

async function sendMail(to, subject, text, html) {
  if (!mailer) { console.log(`[mail disabled] to=${to} subject="${subject}"\n${text}\n`); return; }
  await mailer.sendMail({ from: cfg.mailFrom, to, subject, text, html });
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

async function notifyAdmin(m, isNew) {
  if (!cfg.adminEmail) return;
  const lines = [
    `${isNew ? 'New member' : 'Member updated'}: ${m.full_name || '-'}`,
    `Email: ${m.email}`, `WhatsApp: ${m.whatsapp || '-'}`, `Area: ${AREAS[m.area] || m.area}`,
    `From: ${m.country_city || '-'}`, `Community: ${m.community || '-'}`, `Alerts consent: ${m.consent_alerts ? 'yes' : 'no'}`,
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

app.get('/api/health', (req, res) => res.json({ ok: true, email: !!mailer, whatsapp: whatsappEnabled }));

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
        whatsapp_verified_at=CASE WHEN ? IS NOT NULL AND ? != IFNULL(whatsapp,'') THEN NULL ELSE whatsapp_verified_at END
        WHERE email=?`).run(t, area, clean(b.page, 100), clean(b.full_name, 120), whatsapp, clean(b.country_city, 120), clean(b.community, 120),
        t, alerts, alerts, t, req.ip, CONSENT_VERSION, token(), whatsapp, whatsapp, email);
    } else {
      db.prepare(`INSERT INTO members (created_at, updated_at, area, page, full_name, email, whatsapp, country_city, community,
        consent_terms_at, consent_alerts, consent_alerts_at, consent_ip, consent_version, email_token, unsubscribe_token)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(t, t, area, clean(b.page, 100), clean(b.full_name, 120), email, whatsapp,
        clean(b.country_city, 120), clean(b.community, 120), t, alerts, alerts ? t : null, req.ip, CONSENT_VERSION, token(), token());
    }
  } catch (e) {
    console.error('db error', e);
    return res.status(500).json({ ok: false, error: 'Something went wrong. Please try again.' });
  }

  const m = findByEmail.get(email);
  try { if (!m.email_verified_at) await sendVerifyEmail(m); } catch (e) { console.error('mail error', e.message); }
  notifyAdmin(m, !existing).catch((e) => console.error('admin mail error', e.message));

  let wa = 'skipped';
  if (whatsappEnabled && m.whatsapp && !m.whatsapp_verified_at) {
    try { await startWhatsapp(m.whatsapp); wa = 'sent'; } catch (e) { console.error('whatsapp error', e.message); wa = 'failed'; }
  } else if (m.whatsapp_verified_at) wa = 'verified';
  res.json({ ok: true, emailVerified: !!m.email_verified_at, whatsapp: wa });
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
  const cols = ['created_at', 'area', 'full_name', 'email', 'whatsapp', 'country_city', 'community', 'consent_alerts', 'email_verified_at', 'whatsapp_verified_at'];
  const q = (v) => { const s = v == null ? '' : String(v); return /^[=+\-@]/.test(s) && !/^\+\d+$/.test(s) ? `"'${s.replace(/"/g, '""')}"` : `"${s.replace(/"/g, '""')}"`; };
  const rows = db.prepare(`SELECT ${cols.join(',')} FROM members ORDER BY created_at DESC`).all();
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', 'attachment; filename="kahila-members.csv"');
  res.send('﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => q(r[c])).join(','))].join('\n'));
});

app.use('/api', (req, res) => res.status(404).json({ ok: false, error: 'Not found' }));

app.listen(cfg.port, '127.0.0.1', () => {
  console.log(`Closing Group API on 127.0.0.1:${cfg.port} · email ${mailer ? 'on' : 'OFF (logging only)'} · WhatsApp ${whatsappEnabled ? 'on' : 'OFF'}`);
});
