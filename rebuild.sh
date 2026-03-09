#!/bin/bash
set -e

cd "$(dirname "$0")"

APP_NAME="forgecrawl"

echo "========================================="
echo " ForgeCrawl Rebuild"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================="

# Pull latest
echo ""
echo "Pulling latest changes..."
git pull origin main

# Install deps
echo ""
echo "Installing dependencies..."
pnpm install --frozen-lockfile

# Build the app package
echo ""
echo "Building @forgecrawl/app..."
pnpm --filter @forgecrawl/app build

# Verify build output exists
if [ ! -f "packages/app/.output/server/index.mjs" ]; then
  echo "ERROR: Build output not found at packages/app/.output/server/index.mjs"
  exit 1
fi

# Start or restart PM2
echo ""
if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
  echo "Restarting PM2 process..."
  pm2 restart "$APP_NAME"
else
  echo "Starting PM2 process for the first time..."
  pm2 start ecosystem.config.cjs
  pm2 save
fi

# Health check
echo ""
echo "Waiting for startup..."
sleep 3

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5150/api/health 2>/dev/null || echo "000")
if [ "$HTTP_STATUS" = "200" ]; then
  echo "Health check passed (HTTP $HTTP_STATUS)"
else
  echo "WARNING: Health check returned HTTP $HTTP_STATUS"
  echo "Check logs: pm2 logs $APP_NAME --lines 30"
fi

echo ""
pm2 status
echo ""
echo "Done."
