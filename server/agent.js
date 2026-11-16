'use strict';
/*
 * The apartment chat agent ("Ask us about Apartment 65").
 *
 * What it knows, read straight from the website folder (SITE_DIR) and re-read every 10 minutes,
 * so whatever the team adds to the website or the Q&A is known to the agent without a restart:
 *   - assets/qa-data.js and assets/qa-data-fr.js  (the public Questions & Answers)
 *   - assets/halperin-data.js                    (the facts about each Halperin apartment)
 *   - the text of the main website pages          (what we do, how it works, the Kahilot)
 * Questions it could not answer are stored (table agent_gaps, /api/admin/agent-gaps.csv) so the team can
 * add the answers to the Q&A, and from then on the agent knows them.
 *
 * The AI part needs ANTHROPIC_API_KEY in /etc/closinggroup/closinggroup.env. Without it the endpoint
 * answers 503 and the page falls back to its own answers from the same Q&A and facts.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GLAD = {
  en: "I'm glad to assist you. Let me collect all your questions and I'll get back to you. We will organise the answers.",
  fr: 'Je suis ravi de vous aider. Je rassemble toutes vos questions et je reviens vers vous. Nous organiserons les réponses.',
};
const PAGES = ['index.html', 'how-it-works/index.html', 'why-now/index.html', 'netanya/index.html', 'netanya/halperin/index.html',
  'center/index.html', 'jerusalem/index.html', 'terms/index.html'];

function createAgent(cfg) {
  const siteDir = cfg.siteDir;
  let cache = null;

  function readJs(rel) {
    const file = path.join(siteDir, rel);
    const ctx = { window: {} };
    ctx.globalThis = ctx.window;
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), ctx, { timeout: 500 });
    return ctx.window;
  }
  function pageText(rel) {
    try {
      return fs.readFileSync(path.join(siteDir, rel), 'utf8')
        .replace(/<(script|style|svg|noscript)[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|h\d|div|section)>/gi, '\n')
        .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'")
        .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
    } catch { return ''; }
  }
  function knowledge() {
    if (cache && Date.now() - cache.at < 10 * 60e3) return cache;
    const k = { at: Date.now(), qa: [], qaFr: [], hp: null, site: '' };
    try { k.qa = readJs('assets/qa-data.js').CG_QA || []; } catch (e) { console.error('agent: qa-data.js', e.message); }
    try { k.qaFr = readJs('assets/qa-data-fr.js').CG_QA || []; } catch { /* optional */ }
    try { k.hp = readJs('assets/halperin-data.js').CG_HALPERIN || null; } catch (e) { console.error('agent: halperin-data.js', e.message); }
    k.site = PAGES.map((p) => `--- Page /${p.replace(/index\.html$/, '')} ---\n${pageText(p)}`).join('\n\n').slice(0, 60000);
    cache = k;
    return k;
  }

  function aptFacts(hp, id, lang) {
    const L = hp[lang] || hp.en;
    const a = L.apts.find((x) => x.id === id);
    if (!a) return '';
    const stage = (L.stageExtra[id] ? [L.stageExtra[id]] : []).concat(L.stage.map((s) => s[1]));
    return [`Apartment ${a.id} (${a.tag}) — ${a.short}`, a.text,
      ...a.facts.map((f) => `${f[0]}: ${f[1]}`),
      ...L.shared.map((f) => `${f[0]}: ${f[1]}`),
      `Where it stands: ${stage.join(' ')}`,
      `Walk-through film: ${a.len}, filmed 12 November 2026, no sound.`,
      `Staged picture: the first picture of each apartment is a furnished visualisation (not a photo, furniture not included).`].join('\n');
  }

  function system(id, lang) {
    const k = knowledge();
    const hp = k.hp;
    const L = hp ? (hp[lang] || hp.en) : null;
    const others = hp ? hp.en.apts.filter((a) => a.id !== id).map((a) => `- Apartment ${a.id}: ${a.short}. ` + a.facts.map((f) => `${f[0]} ${f[1]}`).join('; ')).join('\n') : '';
    const qa = (lang === 'fr' && k.qaFr.length ? k.qaFr.concat(k.qa) : k.qa).map((x) => `Q: ${x.q}\nA: ${x.a}`).join('\n\n');
    const liaison = lang === 'fr' ? 'Levy Levin (our French-speaking liaison)' : 'Michal (or Levy Levin for French speakers)';
    return `You are the chat agent of The Closing Group (closinggroupisrael.com), on the page of Apartment ${id}, Halperin Street, Netanya.
The visitor tapped "Ask us about Apartment ${id}". Your job: answer their questions warmly and briefly, collect their questions and concerns, and lead them towards a call with a liaison: ${liaison}.

Rules:
- Answer ONLY from the knowledge below. Never invent numbers, dates, prices, promises or facts.
- NEVER say "I don't know", "I'm not sure", "it's not in my list" or anything like that. When the knowledge does not answer the question, reply with exactly this sentence and nothing else: "${GLAD[lang] || GLAD.en}"
- Keep answers short: 1 to 4 sentences, plain words, no lists unless needed, no markdown.
- Be honest: the saving is a goal, not a guarantee; the final price is fixed only in the signed contract; the visualisation picture is not a photo.
- Not legal, tax or financial advice: give the facts from the knowledge and say the partner law firm confirms the details.
- Do not ask for their phone number, email or best time to call: the page asks for those after your answer.
- Gently lead towards the call with the liaison when it fits (e.g. "the liaison can go through this with you on the call").
- Reply in the visitor's language (${lang === 'fr' ? 'French by default' : 'English by default'}; if they write in French, answer in French).

=== This apartment ===
${hp ? aptFacts(hp, id, lang) : ''}

=== The area ===
${L ? L.area : ''}

=== The other apartments in the building ===
${others}

=== Questions & Answers (official) ===
${qa}

=== Website pages ===
${k.site}`;
  }

  async function callClaude(sys, messages, maxTokens) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'content-type': 'application/json', 'x-api-key': cfg.anthropicKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: cfg.model, max_tokens: maxTokens, system: sys, messages }),
      });
      if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
      const j = await res.json();
      return (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('').trim();
    } finally { clearTimeout(timer); }
  }

  async function ask({ apt, lang, question, history }) {
    lang = lang === 'fr' ? 'fr' : 'en';
    const context = (history || []).slice(-12).join('\n');
    const content = (context ? `Conversation so far:\n${context}\n\n` : '') + `Visitor's new message: ${question}`;
    let answer = await callClaude(system(apt, lang), [{ role: 'user', content }], 400);
    const glad = GLAD[lang];
    if (!answer || /\b(i don'?t know|i do not know|i'?m not sure|not in my (list|knowledge|data)|je ne sais pas|pas dans ma liste)\b/i.test(answer)) answer = glad;
    const answered = !(answer.includes(GLAD.en.slice(0, 40)) || answer.includes(GLAD.fr.slice(0, 40)));
    return { answer, answered };
  }

  // A short plan for the liaison: how to move this lead towards a signed deal.
  function rulePlan(lead) {
    const all = (lead.questions || []).join(' ').toLowerCase();
    const a = lead.analytics || {};
    const plan = [];
    const first = `their first question${lead.questions && lead.questions[0] ? `: "${lead.questions[0]}"` : ''}`;
    if (lead.whatsapp && lead.best_time) plan.push(`Call at the time they chose (${lead.best_time}); check their time zone first. Open with ${first}, and answer it fully.`);
    else if (lead.whatsapp) plan.push(`They left a WhatsApp number but no time: message first to agree a time (check their time zone). Open with ${first}.`);
    else if (lead.member_email) plan.push(`No number yet: email them at ${lead.member_email} (they are a member). Answer ${first} in the email and offer a short call at a time that suits them.`);
    else plan.push(`No contact yet: they asked a question but left no number or email. Nothing to do until details arrive; an update follows if they leave a number. Meanwhile prepare an answer to ${first}.`);
    if ((lead.open_questions || []).length) plan.push(`Prepare answers before calling to what the chat couldn't answer: ${lead.open_questions.map((q) => `"${q}"`).join(', ')}. Then add them to the Q&A so the agent knows them next time.`);
    if (/price|cost|how much|saving|cheap|discount|prix|combien/.test(all)) plan.push('Price is on their mind: walk them through the group price goal (12–15% under list), why the builder agrees (9 units at once), and that the final price is fixed only in the signed contract.');
    if (/safe|scam|trust|risk|legal|law|guarantee|bankrupt|protect|sécur|arnaque|garantie/.test(all)) plan.push('Trust is the concern: lead with the law firm (Evyatar Himi), the deposit held in its trust account, and the Sale Law bank guarantees.');
    if (/abroad|transfer|wire|remote|power of attorney|embassy|étranger|virement|procuration/.test(all)) plan.push('They are abroad: explain the remote path (deposit wired to the law firm, signing by power of attorney at the Israeli embassy, Bank Hapoalim foreign residents department).');
    if (/mortgage|loan|financ|bank|prêt|banque|hypoth/.test(all)) plan.push('Financing came up: offer the introduction to Bank Hapoalim\'s foreign residents department.');
    if (/visit|see it|tour|viewing|visiter|visite/.test(all) || (a.films_watched_seconds && Object.keys(a.films_watched_seconds).length)) plan.push(`Offer a live video tour of Apartment ${lead.apt}${a.films_watched_seconds && a.films_watched_seconds[lead.apt] ? ' (they already watched its film)' : ''}, or a visit by someone they trust.`);
    if ((a.apartments_opened || []).length > 1) plan.push(`They compared apartments ${a.apartments_opened.join(', ')}: ask which one they lean towards and why.`);
    plan.push(`Next step to propose: reserve Apartment ${lead.apt} with the ₪50,000 deposit into the law firm's trust account (returned in full if the group doesn't close). Agree a date for the reservation before ending the call, and send the summary on WhatsApp.`);
    return plan;
  }
  async function closingPlan(lead) {
    if (!cfg.anthropicKey) return rulePlan(lead);
    try {
      const sys = `You coach a real estate liaison at The Closing Group (buyers' group, Halperin Street, Netanya). Given a warm lead (JSON), write 3 to 5 short, concrete steps for the call that move this buyer towards reserving the apartment (₪50,000 deposit into the partner law firm's trust account, returned in full if the group doesn't close). Use only facts from the lead and from this knowledge; never invent prices or promises. Plain text, one step per line, no numbering, no markdown.\n\nKnowledge:\n${aptFacts(knowledge().hp, lead.apt, 'en')}`;
      const out = await callClaude(sys, [{ role: 'user', content: JSON.stringify({ ...lead, transcript: (lead.transcript || []).slice(-30) }) }], 500);
      const lines = out.split('\n').map((l) => l.replace(/^[-•*\d.)\s]+/, '').trim()).filter(Boolean);
      return lines.length ? lines : rulePlan(lead);
    } catch (e) {
      console.error('agent plan error:', e.message);
      return rulePlan(lead);
    }
  }

  function aptShort(id) { try { const a = knowledge().hp.en.apts.find((x) => x.id === id); return a ? a.short : ''; } catch { return ''; } }
  function aptIds() { try { return knowledge().hp.order; } catch { return ['65', '63', '61', '60', '54', '53', '49', '45', '42']; } }

  return { enabled: !!cfg.anthropicKey, ask, closingPlan, aptShort, aptIds, GLAD, callClaude };
}

module.exports = { createAgent };
