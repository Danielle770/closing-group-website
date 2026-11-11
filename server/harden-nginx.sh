#!/usr/bin/env bash
# One-time security hardening for closinggroupisrael.com (safe to run again).
#  1. TLS 1.2 and 1.3 only
#  2. HSTS + Content-Security-Policy + Permissions-Policy headers (server/nginx-security.conf)
# Every change is backed up; if "nginx -t" fails, everything is put back and nginx is not reloaded.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Please run with sudo"; exit 1; }
HERE="$(cd "$(dirname "$0")" && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BK="/root/closinggroup-nginx-backup-$STAMP"   # outside /etc/nginx, so nginx never loads a backup
SNIP=/etc/nginx/snippets/closinggroup-security.conf

SITE="$(grep -rlE 'server_name[^;]*closinggroupisrael\.com' /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null | head -n1 || true)"
[ -n "$SITE" ] || { echo "Could not find the nginx file for closinggroupisrael.com"; exit 1; }
SITE="$(readlink -f "$SITE")"
echo "==> Site config: $SITE"

mkdir -p "$BK"
cp -a "$SITE" "$BK/site.conf"
cp -a /etc/nginx/nginx.conf "$BK/nginx.conf"
[ -f "$SNIP" ] && cp -a "$SNIP" "$BK/snippet.conf" || true
[ -f /etc/letsencrypt/options-ssl-nginx.conf ] && cp -a /etc/letsencrypt/options-ssl-nginx.conf "$BK/options-ssl-nginx.conf" || true
echo "==> Backup saved in $BK"
restore() {
  echo "!! nginx test failed. Putting everything back."
  cp -a "$BK/site.conf" "$SITE"
  cp -a "$BK/nginx.conf" /etc/nginx/nginx.conf
  if [ -f "$BK/snippet.conf" ]; then cp -a "$BK/snippet.conf" "$SNIP"; else rm -f "$SNIP"; fi
  [ -f "$BK/options-ssl-nginx.conf" ] && cp -a "$BK/options-ssl-nginx.conf" /etc/letsencrypt/options-ssl-nginx.conf || true
  nginx -t && echo "   Restored. Nothing changed on the live site."
  exit 1
}

# 1. Headers snippet
mkdir -p /etc/nginx/snippets
cp "$HERE/nginx-security.conf" "$SNIP"
if ! grep -q 'snippets/closinggroup-security.conf' "$SITE"; then
  # add the include right after the first "listen ... 443" line (the HTTPS server block)
  awk 'BEGIN{d=0} {print} (!d && $0 ~ /listen[^;]*443/){print "    include snippets/closinggroup-security.conf;"; d=1}' "$SITE" > "$BK/site.new" && cat "$BK/site.new" > "$SITE"
  grep -q 'snippets/closinggroup-security.conf' "$SITE" || { echo "Could not find the HTTPS (443) server block"; restore; }
fi

# 2. TLS 1.2 and 1.3 only, wherever ssl_protocols is set
for f in /etc/nginx/nginx.conf /etc/letsencrypt/options-ssl-nginx.conf; do
  [ -f "$f" ] || continue
  if grep -qE '^\s*ssl_protocols' "$f"; then
    sed -i -E 's/^(\s*ssl_protocols).*/\1 TLSv1.2 TLSv1.3;/' "$f"
  fi
done

nginx -t || restore
systemctl reload nginx
echo "==> Done. Check: curl -sI https://closinggroupisrael.com | grep -iE 'strict-transport|content-security'"
