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

Shared files: `assets/site.css`, `assets/site.js`.

## Deploy (Nginx)

Copy the repository contents into `/var/www/closinggroupisrael.com/`. The default Nginx config works because every page is a folder with an `index.html`:

```nginx
location / {
    try_files $uri $uri/ =404;
}
```

## Sign-up forms

`assets/site.js` posts each form as JSON to **`POST /api/join`**:

```json
{ "area": "netanya", "page": "/netanya/", "full_name": "...", "email": "...", "whatsapp": "...",
  "country_city": "...", "community": "...", "consent_alerts": true, "consent_terms": true }
```

Until `/api/join` exists, visitors see "Registration opens very soon". Nothing is stored yet.

## Backend still to build (not in this repo yet)

1. **Sign-up API** (`/api/join`): store members, send email verification link, send WhatsApp 6-digit code, record consent with timestamp.
2. **Fair price agent**: daily pull of reported deals near each project, price per m², fair value.

Runtime, services and keys for these will be specified separately before setup.

## Before public launch

- Replace every `[#]`, `[X]`, `[date]`, `[12]`, `[500]` placeholder with real numbers, or hide those blocks.
- Add the real Accessibility statement, Privacy policy and Terms pages (footer links are placeholders).
- Add the broker license number and partner law firm / bank names.
