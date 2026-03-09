#!/bin/bash
# ForgeCrawl — Laravel Forge Deploy Script
#
# Paste this into: Site → Deployments → Deploy Script
# Or run manually: ssh forge@YOUR_IP "cd /home/forge/api.forgecrawl.com && bash deploy/forge-deploy.sh"
#
# This script is identical to what Forge runs on auto-deploy.
# Kept here in version control so changes are tracked.

set -e

cd /home/forge/api.forgecrawl.com

echo "========================================="
echo " ForgeCrawl Deploy (Forge)"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================="

# Pull latest (use Forge's branch var if available, fallback to main)
BRANCH="${FORGE_SITE_BRANCH:-main}"
if ! [[ "$BRANCH" =~ ^[a-zA-Z0-9._/-]+$ ]]; then
  echo "Invalid branch name: $BRANCH"
  exit 1
fi
echo ""
echo "Pulling $BRANCH..."
git pull origin "$BRANCH"

# Install dependencies
echo ""
echo "Installing dependencies..."
pnpm install --frozen-lockfile

# Build the app
echo ""
echo "Building @forgecrawl/app..."
pnpm --filter @forgecrawl/app build

# Verify build
if [ ! -f "packages/app/.output/server/index.mjs" ]; then
  echo "BUILD FAILED: .output/server/index.mjs not found"
  exit 1
fi

# Restart PM2
echo ""
if pm2 describe forgecrawl > /dev/null 2>&1; then
  echo "Restarting PM2..."
  pm2 restart forgecrawl
else
  echo "Starting PM2 for the first time..."
  pm2 start ecosystem.config.cjs
  pm2 save
fi

# Health check
echo ""
echo "Waiting for startup..."
sleep 3

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5150/api/health 2>/dev/null || echo "000")
if [ "$HTTP_STATUS" = "200" ]; then
  echo "Deploy OK — health check passed (HTTP $HTTP_STATUS)"
else
  echo "WARNING: Health check returned HTTP $HTTP_STATUS"
  echo "Check: pm2 logs forgecrawl --lines 30"
  exit 1
fi

echo ""
echo "Done."
