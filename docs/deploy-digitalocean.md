# ForgeCrawl — Digital Ocean Deployment Guide

> Bare-metal deployment on a Digital Ocean Droplet with PM2, Nginx, and Let's Encrypt.
> Assumes: Ubuntu 22.04+, Node 22+, pnpm, PM2, and Nginx already installed.

---

## First-Time-Only Checklist

These steps are done **once** during initial setup. After they're complete, you only
need `./rebuild.sh` for subsequent deploys.

| # | Task | Where | Done? |
|---|------|-------|-------|
| 1 | Add `A` record for `api.forgecrawl.com` → Droplet IP | DNSimple | [ ] |
| 2 | Install Chromium + fonts on Droplet | SSH | [ ] |
| 3 | Install pnpm globally (`npm i -g pnpm`) | SSH | [ ] |
| 4 | Create log directory `/var/log/forgecrawl` | SSH | [ ] |
| 5 | Clone the repo to `/home/forge/forgecrawl` | SSH | [ ] |
| 6 | Create `.env` from `.env.example`, generate and set `NUXT_AUTH_SECRET` | SSH | [ ] |
| 7 | (Optional) Adjust `puppeteer.concurrency` in `forgecrawl.config.ts` for your RAM | SSH | [ ] |
| 8 | Run first build: `pnpm install && pnpm --filter @forgecrawl/app build` | SSH | [ ] |
| 9 | Start PM2: `pm2 start ecosystem.config.cjs` | SSH | [ ] |
| 10 | Enable auto-start: `pm2 save && pm2 startup` (run the printed sudo command) | SSH | [ ] |
| 11 | Copy Nginx config, symlink to sites-enabled, `nginx -t && systemctl reload nginx` | SSH | [ ] |
| 12 | Provision SSL: `sudo certbot --nginx -d api.forgecrawl.com` | SSH | [ ] |
| 13 | Create admin account via `POST /api/auth/setup` (one-time endpoint) | curl/browser | [ ] |
| 14 | Make rebuild script executable: `chmod +x rebuild.sh` | SSH | [ ] |
| 15 | (Optional) Set up pm2-logrotate and daily DB backup cron | SSH | [ ] |

Once all boxes are checked, future deploys are just:
```bash
cd /home/forge/forgecrawl && ./rebuild.sh
```

---

## 1. DNS Records (DNSimple)

Log in to [dnsimple.com](https://dnsimple.com) → select `forgecrawl.com` → **DNS** tab → **Manage Records**.

### Required: API subdomain

Add one record:

| Type | Name | Content            | TTL  |
|------|------|--------------------|------|
| A    | api  | `YOUR_DROPLET_IP`  | 3600 |

This creates `api.forgecrawl.com` pointing to your Droplet.

### Existing: Marketing site (Netlify)

Your marketing site DNS should already have:

| Type  | Name | Content                          | TTL  |
|-------|------|----------------------------------|------|
| ALIAS | *(empty)* | `your-site.netlify.app`     | 3600 |
| CNAME | www  | `your-site.netlify.app`          | 3600 |

> **DNSimple gotcha:** DNSimple uses **ALIAS** records (not A records) for apex
> domains pointing to services like Netlify. ALIAS records resolve at the DNS
> level, so they work at the zone apex where CNAME records are not allowed.
> If you previously set an A record for the apex pointing to a Netlify IP,
> switch it to ALIAS — Netlify IPs can change without notice.

### Verify propagation

```bash
dig api.forgecrawl.com +short
# Should return your Droplet IP

dig forgecrawl.com +short
# Should return Netlify's IP (resolved from ALIAS)
```

DNSimple propagation is typically fast (1-5 minutes). If using their nameservers
(`ns1.dnsimple.com` etc.), updates are near-instant.

---

## 2. Server Prerequisites

SSH into your Droplet:

```bash
ssh root@YOUR_DROPLET_IP
# or
ssh forge@YOUR_DROPLET_IP  # if using Laravel Forge
```

### Install Chromium (required for Puppeteer scraping)

```bash
sudo apt-get update
sudo apt-get install -y chromium-browser fonts-liberation fonts-noto-cjk
which chromium-browser
# Should output: /usr/bin/chromium-browser
```

### Install pnpm (if not already installed)

```bash
npm install -g pnpm
```

### Create log directory

```bash
sudo mkdir -p /var/log/forgecrawl
sudo chown $USER:$USER /var/log/forgecrawl
```

---

## 3. Clone & Configure

```bash
cd /home/forge  # or wherever your apps live
git clone https://github.com/cschweda/forgecrawl.git
cd forgecrawl
```

### Create .env with secrets

```bash
cp .env.example .env
```

Generate and set the auth secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Edit `.env`:
```bash
nano .env
```

Set:
```
NUXT_AUTH_SECRET=<paste the 64-char hex string>
```

### (Optional) Adjust config

If your Droplet has limited RAM, edit `forgecrawl.config.ts`:

| Droplet RAM | `puppeteer.concurrency` |
|-------------|------------------------|
| 1 GB        | 1                      |
| 2 GB        | 1–2                    |
| 4 GB        | 2–3                    |
| 8 GB        | 4–6                    |

If you changed `forgecrawl.config.ts`, you must rebuild (step 4).

---

## 4. Build

```bash
pnpm install
pnpm --filter @forgecrawl/app build
```

This creates `packages/app/.output/` with the production server bundle.

Verify the build:
```bash
ls packages/app/.output/server/index.mjs
# Should exist
```

---

## 5. Start with PM2

From the monorepo root (`/home/forge/forgecrawl`):

```bash
pm2 start ecosystem.config.cjs
```

Verify it's running:
```bash
pm2 status
# Should show "forgecrawl" with status "online"

pm2 logs forgecrawl --lines 20
# Should show startup messages, no errors

curl http://127.0.0.1:5150/api/health
# Should return: {"status":"ok","version":"0.1.0","database":"ok","setup_complete":false}
```

### Enable auto-start on reboot

```bash
pm2 save
pm2 startup
# Follow the printed command (sudo env PATH=... pm2 startup ...)
```

---

## 6. Nginx Reverse Proxy

### Copy the config

```bash
sudo cp deploy/nginx-forgecrawl.conf /etc/nginx/sites-available/forgecrawl
sudo ln -s /etc/nginx/sites-available/forgecrawl /etc/nginx/sites-enabled/
```

### Edit the server_name if needed

```bash
sudo nano /etc/nginx/sites-available/forgecrawl
# Verify server_name matches your DNS (api.forgecrawl.com)
```

### Test and reload

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### SSL with Let's Encrypt

```bash
sudo certbot --nginx -d api.forgecrawl.com
# Follow prompts, select "redirect HTTP to HTTPS"
```

Verify:
```bash
curl https://api.forgecrawl.com/api/health
```

---

## 7. First-Time Setup

Open a browser or use curl to create your admin account:

```bash
curl -X POST https://api.forgecrawl.com/api/auth/setup \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"your-strong-password","confirmPassword":"your-strong-password"}'
```

This endpoint is one-time only — it disables itself after the first user is created.

---

## 8. Redeployment (After Code Changes)

Use the included rebuild script:

```bash
cd /home/forge/forgecrawl
./rebuild.sh
```

This script:
1. Pulls latest from `main`
2. Installs dependencies (`pnpm install --frozen-lockfile`)
3. Builds the app (`pnpm --filter @forgecrawl/app build`)
4. Restarts PM2 (or starts it if first run)
5. Runs a health check to verify the deploy

Make sure it's executable after first clone:
```bash
chmod +x rebuild.sh
```

---

## 9. Common PM2 Commands

| Command                          | Description                    |
|----------------------------------|--------------------------------|
| `pm2 status`                     | Show all processes             |
| `pm2 logs forgecrawl`            | Tail logs                      |
| `pm2 logs forgecrawl --lines 50` | Last 50 lines                  |
| `pm2 restart forgecrawl`         | Graceful restart               |
| `pm2 stop forgecrawl`            | Stop the app                   |
| `pm2 delete forgecrawl`          | Remove from PM2                |
| `pm2 monit`                      | Real-time CPU/memory dashboard |
| `pm2 save`                       | Save current process list      |
| `pm2 flush forgecrawl`           | Clear log files                |

---

## 10. Monitoring & Backups

### Health check

```bash
curl -s https://api.forgecrawl.com/api/health | jq
```

A 503 response means the database is down.

### Database location

```
/home/forge/forgecrawl/packages/app/data/forgecrawl.sqlite
```

### Backup the database

```bash
# Simple copy (safe with WAL mode if app is running)
cp packages/app/data/forgecrawl.sqlite /backups/forgecrawl-$(date +%Y%m%d).sqlite
```

Or set up a cron:
```bash
crontab -e
# Add:
0 3 * * * cp /home/forge/forgecrawl/packages/app/data/forgecrawl.sqlite /backups/forgecrawl-$(date +\%Y\%m\%d).sqlite
```

### Log rotation

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 7
```

---

## 11. Troubleshooting

| Problem | Fix |
|---------|-----|
| `pm2 status` shows "errored" | Check `pm2 logs forgecrawl --err --lines 50` |
| Port 5150 in use | `lsof -i :5150` to find the process, `kill` it |
| Puppeteer crashes | Reduce `puppeteer.concurrency` in config, rebuild |
| "NUXT_AUTH_SECRET must be at least 32 characters" | `.env` is missing or secret is too short |
| 502 Bad Gateway from Nginx | App isn't running — `pm2 restart forgecrawl` |
| SSL cert expired | `sudo certbot renew` |
| Database locked errors | Check `pm2 status` — should be only 1 instance |
| Scrapes timing out | Check Chromium: `chromium-browser --version` |

---

## 12. Laravel Forge Notes

If using Laravel Forge to manage the Droplet, you have two deployment options:
**manual** (SSH in and run `./rebuild.sh`) or **automatic** (Forge runs a deploy
script on every push to `main`).

### First-Time Forge Setup

These are done once through the Forge UI:

| # | Task | Where in Forge |
|---|------|----------------|
| 1 | Create site for `api.forgecrawl.com` | Sites → New Site |
| 2 | Connect GitHub repo `cschweda/forgecrawl`, branch `main` | Site → Git Repository |
| 3 | Set environment variables | Site → Environment |
| 4 | Edit Nginx config (see below) | Site → Nginx → Edit |
| 5 | Provision SSL cert | Site → SSL → Let's Encrypt |
| 6 | Create PM2 daemon | Server → Daemons |
| 7 | (Optional) Enable auto-deploy on push | Site → Deployments → Enable |

**Step 3 — Environment variables:**

In the Forge environment editor, add:
```
NUXT_AUTH_SECRET=<your-64-char-hex-string>
NODE_ENV=production
```

Generate the secret locally:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> **Forge gotcha:** Forge writes env vars to `/home/forge/api.forgecrawl.com/.env`.
> But ForgeCrawl expects `.env` at the repo root (`/home/forge/forgecrawl/.env`).
> Since Forge clones into the site directory, the paths should match — but verify
> after first deploy that `.env` is in the same directory as `forgecrawl.config.ts`.

**Step 4 — Nginx config:**

Replace Forge's default Nginx config with this. Go to Site → Nginx → Edit:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name api.forgecrawl.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.forgecrawl.com;

    # Forge manages these SSL lines automatically
    ssl_certificate /etc/nginx/ssl/api.forgecrawl.com/server.crt;
    ssl_certificate_key /etc/nginx/ssl/api.forgecrawl.com/server.key;

    # TLS hardening
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5:!3DES:!RC4;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_session_tickets off;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'" always;

    client_max_body_size 1m;

    # Health check (no auth, no logging)
    location = /api/health {
        proxy_pass http://127.0.0.1:5150;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        access_log off;
    }

    # Everything → Nuxt (API + admin UI)
    location / {
        proxy_pass http://127.0.0.1:5150;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }
}
```

> **Forge gotcha:** Forge overwrites Nginx config on certain actions (like adding
> SSL). After provisioning SSL in step 5, re-check the Nginx config to make sure
> your `proxy_pass` and `location` blocks are still intact.

**Step 6 — PM2 daemon:**

Go to Server → Daemons → New Daemon:

| Field     | Value |
|-----------|-------|
| Command   | `pm2 start ecosystem.config.cjs --no-daemon` |
| Directory | `/home/forge/api.forgecrawl.com` |
| User      | `forge` |

> **Forge gotcha:** Forge daemons expect the process to stay in the foreground.
> The `--no-daemon` flag makes PM2 itself stay in foreground so Forge can monitor it.
> Alternatively, skip the Forge daemon entirely and just use PM2 directly:
> ```bash
> ssh forge@YOUR_IP
> cd /home/forge/api.forgecrawl.com
> pm2 start ecosystem.config.cjs
> pm2 save && pm2 startup
> ```
> This way PM2 manages itself via systemd and survives reboots independently of Forge.

### Forge Deploy Script

Paste this into **Site → Deployments → Deploy Script**:

```bash
cd /home/forge/api.forgecrawl.com

# Pull latest
git pull origin $FORGE_SITE_BRANCH

# Install dependencies
pnpm install --frozen-lockfile

# Build the app
pnpm --filter @forgecrawl/app build

# Verify build
if [ ! -f "packages/app/.output/server/index.mjs" ]; then
  echo "BUILD FAILED: .output/server/index.mjs not found"
  exit 1
fi

# Restart PM2
if pm2 describe forgecrawl > /dev/null 2>&1; then
  pm2 restart forgecrawl
else
  pm2 start ecosystem.config.cjs
  pm2 save
fi

# Health check
sleep 3
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5150/api/health 2>/dev/null || echo "000")
if [ "$HTTP_STATUS" = "200" ]; then
  echo "Deploy OK — health check passed (HTTP $HTTP_STATUS)"
else
  echo "WARNING: Health check returned HTTP $HTTP_STATUS"
  echo "Check: pm2 logs forgecrawl --lines 30"
  exit 1
fi
```

> **`$FORGE_SITE_BRANCH`** is automatically set by Forge to whatever branch you
> configured (e.g. `main`). Don't hardcode the branch name.

### Deployment Options

| Method | When to use | How |
|--------|-------------|-----|
| **Auto-deploy** | Push to `main` triggers deploy automatically | Site → Deployments → Enable Quick Deploy |
| **Manual via Forge UI** | Click a button in the browser | Site → Deployments → Deploy Now |
| **Manual via SSH** | Full control, can inspect before restarting | `ssh forge@IP`, then `cd api.forgecrawl.com && ./rebuild.sh` |
| **Forge CLI** | Deploy from your local terminal | `forge deploy api.forgecrawl.com` |

> **Quick Deploy** uses a GitHub webhook. Forge sets this up automatically when you
> enable it. Every push to the configured branch triggers the deploy script above.
> If you want to review changes before deploying, leave Quick Deploy off and use
> "Deploy Now" manually.

---

## Architecture Summary

```
Internet
  │
  ├── forgecrawl.com ──────► Netlify (marketing site)
  │
  └── api.forgecrawl.com ──► Nginx (SSL termination + reverse proxy)
                                │
                                └──► 127.0.0.1:5150 (PM2 → Nuxt SSR)
                                       │
                                       ├── /api/* endpoints
                                       ├── SQLite (./data/forgecrawl.sqlite)
                                       └── Puppeteer → Chromium
```
