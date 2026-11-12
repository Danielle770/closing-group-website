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
