# The Closing Group — website

Static website for **closinggroupisrael.com**. Plain HTML, CSS and JavaScript, no build step.

## Pages

| URL | File |
|---|---|
| `/` | `index.html` (front page) |
| `/netanya/` | `netanya/index.html` |
| `/center/` | `center/index.html` |
| `/jerusalem/` | `jerusalem/index.html` |
| `/how-it-works/` | `how-it-works/index.html` |
| `/accessibility/`, `/privacy/`, `/terms/` | legal pages |
| `/verified/`, `/unsubscribed/` | confirmation pages |

Shared files: `assets/site.css`, `assets/site.js`.

## French version (`/fr/`)

The French pages live under `fr/` with the same folder layout (`/fr/`, `/fr/netanya/`, `/fr/netanya/halperin/`, `/fr/center/`, `/fr/jerusalem/`, `/fr/how-it-works/`, `/fr/why-now/`, `/fr/terms/`, `/fr/privacy/`, `/fr/accessibility/`, `/fr/verified/`, `/fr/unsubscribed/`). They use the same CSS and JavaScript as the English pages: every script checks `<html lang="fr">` and switches its messages (chat, sign-up, welcome, WhatsApp code, menus, countdowns, install button) to French, and its links to `/fr/…`. The Halperin page in French uses the photos and films in `netanya/halperin/img` and `media`.

- **Language bar:** every page (both languages) has an English 🇺🇸 / Français 🇫🇷 switch above the header, linking to the same page in the other language, plus `hreflang` links for search engines. New pages need it too: copy the `cg-langbar` block from any page.
- **Not translated yet:** the Q&A (`/questions/` and `assets/qa-data.js`). French pages link to the English Q&A for now, and the chat shows English answers with a note that French answers are coming.
- **Emails** sent by the server (welcome, confirmation) are still in English.

## Halperin page: apartment picker, apartment pages, apartment chat

`/netanya/halperin/` and `/fr/netanya/halperin/` share `assets/halperin.js`, `assets/halperin.css` and **`assets/halperin-data.js`, the one place for the apartment facts** (sizes, balconies, floors, rooms). The page and the chat agent both read it.

- **Picker:** every apartment card's picture is a carousel (furnished visualisation first, then the real rooms). The room names on top follow the picture. Double-tap a card, or its name, to open the apartment's page (`#apt-65`).
- **Staged pictures:** `netanya/halperin/img/staged-N.jpg`, always labelled as a visualisation.
- **Apartment chat** ("Ask us about Apartment 65"): answers, collects questions, the best time to call and the WhatsApp number, then sends a lead card (questions, open questions, visit summary, how to move it to a deal) to `ADMIN_EMAIL`, and to the company WhatsApp when set up. Liaison: Michal, or Levy Levin for French.
  - **AI answers:** set `ANTHROPIC_API_KEY` in `/etc/closinggroup/closinggroup.env`, then `sudo systemctl restart closinggroup`. The agent reads the Q&A, the apartment facts and the website pages from `SITE_DIR` every 10 minutes, so it learns whatever is added to the site. Without a key, the chat answers in the browser from the same Q&A and facts.
  - **Leads to the company WhatsApp:** set `TWILIO_WHATSAPP_FROM`, `COMPANY_WHATSAPP` and, for messages at any time, an approved template in `TWILIO_WHATSAPP_CONTENT_SID`.
  - **Downloads** (username `admin`): `/api/admin/leads.csv`, and `/api/admin/agent-gaps.csv`, the questions the agent couldn't answer. Add those answers to the Q&A and the agent knows them from then on.
  - Check: `curl https://closinggroupisrael.com/api/health` shows `"agent":true` and `"leadsToWhatsapp":true` when both are on.

## Leads portal (`/api/portal/`)

Where the liaisons work their leads, on a phone or a computer. Plain pages, no scripts.

- **Who is a lead:** every member who joined (email required, phone optional) and every visitor who asked in the apartment chat. Same email = one row; a member who chats again on another day lands on the same row. Anonymous visitors: one row per conversation. Leads are never deleted.
- **Grades** (colour-coded in the list and on the lead page): **Best** (green/gold) asked 2+ questions, came back on 3+ days, or left a WhatsApp number or best time; **Warmer** (amber) went to the chat, read the Q&A, came back once, or pressed "Set up a call"; **Cool** (grey-blue) joined and only looked around.
- **Zones:** Michal sees English leads only, Levy Levin French only (the language of the latest chat, or of the page they joined on). Boss (`admin` + `ADMIN_PASSWORD`) sees all zones and the **Team** view (per liaison: leads given, touched, spoken to, appointments, sales, needs attention).
- **Status** (New, Called, Spoke, Appointment booked, Sale, Lost) and **notes**: only the zone's liaison or Boss; every change is logged with who and when.
- **Liaison logins:** set `LIAISON_EN_USER` / `LIAISON_FR_USER` and their hashed passwords in `/etc/closinggroup/closinggroup.env`. Make a hash with `node /opt/closinggroup/hash-password.js`, paste the `scrypt:...` line, then `sudo systemctl restart closinggroup`.
- **Daily check (watchdog):** every day at `WATCHDOG_HOUR` (Israel time) it flags open leads nobody touched within `MISSED_AFTER_HOURS` (default 24) as "Needs attention", emails the missed list to `ADMIN_EMAIL` and writes the day's summary on the Team view. With `ANTHROPIC_API_KEY` it adds suggestions (it sends numbers only, no names or contacts). It never changes a status or writes a note.

## Deploy (Nginx)

Copy the repository contents into `/var/www/closinggroupisrael.com/`. The default Nginx config works because every page is a folder with an `index.html`:

```nginx
location / {
    try_files $uri $uri/ =404;
}
```

## Updating the live site (every time)

```bash
cd /var/www/closinggroupisrael.com && git pull && sudo bash server/setup.sh
```

`setup.sh` is safe to run on every update. It never overwrites settings or member data.

## Sign-up system (first-time setup)

The `server/` folder is a small Node.js API (Node 18+) for the join forms:
join a kahila, email confirmation link, WhatsApp 6-digit code, unsubscribe, and a password-protected member list.

1. Run `sudo bash server/setup.sh` from the website folder. It:
   - installs the API in `/opt/closinggroup` (outside the public website folder)
   - creates the settings file `/etc/closinggroup/closinggroup.env` and prints the member-list password
   - stores members in `/var/lib/closinggroup/members.db` (SQLite)
   - runs it as the `closinggroup` systemd service on 127.0.0.1:3100
2. Add the blocks in `server/nginx-closinggroup.conf` to the closinggroupisrael.com HTTPS server block, then `nginx -t && systemctl reload nginx`.
   These also block public access to `/server/`, `.git` and hidden files.
3. Fill in `/etc/closinggroup/closinggroup.env`, then `sudo systemctl restart closinggroup`:
   - **Email:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` (any SMTP provider).
   - **WhatsApp codes:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` (Twilio Verify with the WhatsApp channel). Optional: if empty, members verify by email only.
4. Check: `curl https://closinggroupisrael.com/api/health` should show `{"ok":true,"email":true,"whatsapp":true}`.

Until email is configured, the API logs emails to `journalctl -u closinggroup` instead of sending them.

**Member list:** https://closinggroupisrael.com/api/admin/members.csv (username `admin`, password from the settings file). New-member alerts go to `ADMIN_EMAIL`.

## Analytics (PostHog)

Every page loads `assets/analytics.js` (PostHog US cloud, project "The Closing Group"). It records page views and page leaves with scroll depth, all clicks and form interactions, session replays (form inputs masked), heatmaps, dead and rage clicks, web vitals, JavaScript errors, traffic source / UTM / referrer, device, country and city, sections viewed, contact clicks (`contact_clicked`), sign-up funnel (`signup_form_started`, `signup_problem`, `kahila_joined`) and chat (`chat_opened`, `chat_question`, `chat_inquiry_sent`). Members are identified by email when they join. Visitors can switch it off on `/privacy/`.

Data goes through our own domain at `/cgx/` (not blocked by privacy blockers, and keeps the security policy strict). **To switch it on, on the server, once:**

1. Pull the latest code into `/var/www/closinggroupisrael.com/` as usual.
2. Add the three `location ^~ /cgx/...` blocks from `server/nginx-closinggroup.conf` to the closinggroupisrael.com HTTPS server block.
3. Run `sudo bash server/harden-nginx.sh` again, so the updated security policy (`server/nginx-security.conf`) is installed. It tests nginx and reloads.
4. Check: `curl -sI https://closinggroupisrael.com/cgx/static/array.js` returns `200`, then open the site and see live events in PostHog → Activity.

## Still to come

- **Fair price agent**: daily pull of reported deals near each project, price per m², fair value.

## Before public launch

- Replace every `[#]`, `[X]`, `[date]`, `[12]`, `[500]` placeholder with real numbers, or hide those blocks.
- Add the partner law firm and bank names once signed, and have a lawyer review Privacy and Terms.
