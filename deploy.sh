#!/bin/bash
# Build script for judo-cattenom.fr
# 1. Build Hugo
# 2. Inject Supabase key into agenda page
# 3. Fix permissions
# 4. Deploy

set -e

SITE_DIR="$HOME/projects/jccr-site"
DEPLOY_DIR="/var/www/jccattenom"

# 1. Get Supabase key from gestion app (optional, non-blocking)
# The calendar now uses a static JSON (static/calendar/events.json) and no
# longer requires the Supabase key. We still try to fetch it for backward
# compatibility, but a failure is a warning, not a fatal error.
SUPABASE_KEY=$(curl -s --max-time 15 "https://gestion.judo-cattenom.fr/modules/env.js?v=2026-06-20-r13" | grep -oP "PROD_SUPABASE_KEY\s*=\s*'\K[^']+" || true)

if [ -z "$SUPABASE_KEY" ]; then
  echo "WARNING: Could not fetch Supabase key — continuing without injection (no longer required)"
else
  echo "Supabase key fetched (${#SUPABASE_KEY} chars)"
fi

# 2. Build Hugo
cd "$SITE_DIR"
hugo --minify

# 3. Inject key into pages (only if a key was fetched — kept for compatibility)
if [ -n "$SUPABASE_KEY" ]; then
  for AGENDA_FILE in "$SITE_DIR/public/agenda/index.html" "$SITE_DIR/public/calendrier/index.html"; do
    if [ -f "$AGENDA_FILE" ]; then
      sed -i "s|PLACEHOLDER|$SUPABASE_KEY|g" "$AGENDA_FILE"
      echo "Key injected into $AGENDA_FILE"
    fi
  done
else
  echo "Skipping Supabase key injection (no key available)"
fi

# 4. Fix permissions
chmod -R o+rX "$SITE_DIR/public/"

# 5. Deploy
rsync -avz --delete "$SITE_DIR/public/" "$DEPLOY_DIR/"

echo "✅ Deployed to $DEPLOY_DIR"
