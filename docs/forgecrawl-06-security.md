# ForgeCrawl — Security Document

**Version:** 1.0
**Date:** March 3, 2026
**Status:** Draft

---

## 1. Overview

This document identifies security risks for ForgeCrawl and specifies mitigations for each. ForgeCrawl is a self-hosted application that makes outbound HTTP requests to arbitrary URLs on behalf of authenticated users, which introduces a unique threat profile distinct from typical web applications.

---

## 2. Threat Model

### 2.1 Assets to Protect

| Asset | Sensitivity | Location |
|-------|------------|----------|
| NUXT_AUTH_SECRET | Critical | Server env vars |
| Encryption key (site credentials) | Critical | Server env vars |
| User credentials (hashed) | High | SQLite users table (bcrypt) |
| API keys (hashed) | High | SQLite api_keys table (bcrypt) |
| Site credentials (encrypted) | High | SQLite site_credentials table (AES-256-GCM) |
| Scraped content | Medium | SQLite + filesystem |
| User profiles and usage data | Medium | SQLite |
| Server access credentials | Critical | SSH keys, DO panel |

### 2.2 Threat Actors

- **External attacker:** Scanning for exposed endpoints, brute-forcing auth
- **Malicious target site:** Serving payloads designed to exploit the scraper
- **Compromised user:** Authenticated user attempting privilege escalation
- **Supply chain:** Compromised npm package in dependency tree

---

## 3. Risk Register

### RISK-01: Server-Side Request Forgery (SSRF)

**Severity:** Critical

Users submit URLs for scraping. A malicious user could submit internal network URLs (cloud metadata endpoints, localhost, private IPs) to probe the server's network.

**Mitigations:**
- Validate and sanitize all submitted URLs before fetching
- Block private/reserved IP ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, 169.254.0.0/16
- Block localhost, 0.0.0.0, and any hostname resolving to blocked ranges
- Resolve DNS before fetching and check resolved IP against blocklists
- Block non-HTTP(S) protocols (file://, ftp://, gopher://, data:)
- Block cloud metadata URLs explicitly (169.254.169.254, metadata.google.internal)

### RISK-02: Malicious Content from Target Sites

**Severity:** High

Target sites could serve malicious HTML/JavaScript designed to exploit Puppeteer, exfiltrate data, or compromise the scraping process.

**Mitigations:**
- Users can disable JavaScript rendering per-scrape (`render_js: false`) for pages that don't need it
- `render_js` defaults to `true` for full JS rendering; the tradeoff is functionality over reduced attack surface
- Set page navigation timeouts (30s default)
- Use page.setRequestInterception to block non-essential resources (fonts, analytics, tracking)
- Never execute scraped content as code on the server
- CSP headers on the ForgeCrawl UI to prevent XSS from scraped content previews
- Puppeteer launched with `--disable-extensions`, `--disable-background-networking`

### RISK-03: Stored XSS via Scraped Content

**Severity:** High

Scraped HTML stored in the database could contain malicious scripts. If rendered in the admin UI, it could execute in the admin's browser.

**Mitigations:**
- Never render raw HTML from scrapes without sanitization
- Use v-html only on Markdown-rendered content (sanitized by Turndown)
- Raw HTML preview uses sandboxed iframe with sandbox="" attribute
- Set Content-Security-Policy headers: script-src 'self'

### RISK-04: Authentication Bypass

**Severity:** Critical

Attacker could bypass authentication to access API endpoints or admin functions.

**Mitigations:**
- Server middleware validates auth on ALL /api/* routes
- JWT validation done server-side (jose HS256)
- API key validation uses constant-time comparison (bcrypt)
- Rate limit login attempts (application-level: 5 failures per email per 15min)
- First-run setup endpoint rejects if already complete
- No default credentials
- Session tokens use HTTP-only cookies

### RISK-05: API Key Exposure

**Severity:** High

API keys could be leaked through logs, error messages, or insecure transmission.

**Mitigations:**
- Keys shown exactly once at generation time
- Only bcrypt hashes stored in database
- Key prefix used for display/identification
- Never log full API keys
- Enforce HTTPS via Nginx SSL + HSTS
- Keys transmitted only in Authorization header, never URL params
- Key expiration support

### RISK-06: Site Credential Exposure

**Severity:** High

Stored credentials for login-gated sites could be compromised if database or server is breached.

**Mitigations:**
- All credentials encrypted with AES-256-GCM before storage
- Encryption key in environment variable, not in code or database
- Decryption only at fetch time, in memory, never logged
- RLS ensures users access only own credentials
- Admin cannot view other users' credentials

### RISK-07: Denial of Service via Resource Exhaustion

**Severity:** Medium

Users could overwhelm the server with many scrape requests, huge crawls, or slow-responding targets.

**Mitigations:**
- Per-user rate limiting
- Max pages per crawl capped at 500
- Puppeteer concurrency limit (default 3)
- Page load timeout (30s)
- PM2 max_memory_restart at 3GB
- Queue prevents request pile-up
- Admin can cancel runaway crawls

### RISK-08: Supply Chain Attack

**Severity:** Medium

Compromised npm packages could introduce vulnerabilities.

**Mitigations:**
- Pin dependency versions (exact, not ranges)
- Regular pnpm audit
- Review dependency changes before updating
- Lockfile committed to version control
- Minimize dependency count

### RISK-09: Data at Rest

**Severity:** Medium

Scraped content on filesystem or in SQLite could be accessed if server is compromised.

**Mitigations:**
- Filesystem permissions: 750 (owner rwx, group rx)
- Run Node process as dedicated non-root user
- SQLite file permissions 600 (owner read/write only)
- Consider DO volume encryption
- Regular encrypted backups

### RISK-10: Nginx / TLS Misconfiguration

**Severity:** Medium

Weak TLS or misconfigured Nginx could expose traffic.

**Mitigations:**
- TLS 1.2+ only
- Strong cipher suites (Mozilla Modern)
- HSTS with max-age=31536000
- Certbot auto-renewal
- X-Frame-Options: SAMEORIGIN
- X-Content-Type-Options: nosniff
- server_tokens off

### RISK-11: Docker-Specific Risks

**Severity:** Medium

Running ForgeCrawl in Docker introduces container-specific attack vectors.

**Mitigations:**
- Run Node process as non-root user (`forgecrawl` user created in Dockerfile)
- Memory limits enforced via Docker Compose `deploy.resources.limits.memory: 4G`
- Never mount Docker socket into the container
- Use multi-stage builds to minimize image size and attack surface
- No secrets baked into image layers — pass via environment variables or `.env` file
- Docker volume permissions match application user
- Puppeteer `--no-sandbox` flag is required when running as non-root in Docker (Chromium sandboxing requires root). This is an accepted tradeoff: the Docker container provides isolation, but a Chromium exploit could escape the browser process within the container. Mitigated by page timeouts, request interception, and the container's own isolation boundary.

### RISK-12: SSRF Implementation Requirements

**Severity:** Critical

SSRF protection (RISK-01) requires concrete implementation, not just validation rules. The URL validator (`server/utils/url.ts`) must:

1. Parse and validate URL format
2. Block non-HTTP(S) protocols (`file://`, `ftp://`, `gopher://`, `data:`)
3. Block known dangerous hostnames (`localhost`, `0.0.0.0`, `metadata.google.internal`)
4. Block cloud metadata IP (`169.254.169.254`) by hostname
5. **Resolve DNS** before fetching and check resolved IPs against private range blocklists
6. Handle IPv6 private ranges (`::1`, `fc00::/7`, `fe80::/10`)
7. Validate redirect chains — a public URL that redirects to an internal IP must be caught

See Document 01, Section 8 for the complete implementation.

### RISK-13: Login Brute Force

**Severity:** Medium

Without rate limiting, attackers can brute-force admin credentials.

**Mitigations:**
- In-memory rate limiter: max 5 failed login attempts per email per 15-minute window
- Returns HTTP 429 when limit exceeded
- Counter resets on successful login
- See Document 01, Section 10 for implementation

---

## 4. Security Configuration Checklist

### Server Setup

- [ ] Run Node process as non-root user
- [ ] SSH key-only auth (disable password)
- [ ] UFW: allow only 22, 80, 443
- [ ] Fail2ban for SSH
- [ ] Unattended security updates
- [ ] Nginx server_tokens off
- [ ] TLS with Mozilla Modern profile

### Application

- [ ] All env vars set, .env permissions 600
- [ ] Service role key never exposed to client
- [ ] Encryption key generated with openssl rand -hex 32
- [ ] URL validation blocks private IPs and metadata endpoints
- [ ] Auth middleware covers all /api/* routes
- [ ] CSP headers on all responses
- [ ] Raw HTML never rendered unsanitized
- [ ] API keys logged by prefix only

### Database (SQLite)

- [ ] SQLite file permissions set to 600 (owner read/write only)
- [ ] WAL mode enabled (`journal_mode = WAL`)
- [ ] Foreign keys enforced (`foreign_keys = ON`)
- [ ] Application-level auth middleware covers all `/api/*` routes
- [ ] No direct SQLite file exposure via web server
- [ ] Login rate limiting: max 5 failed attempts per email per 15 minutes

### Monitoring

- [ ] PM2 monitoring active
- [ ] Log rotation configured
- [ ] Health check monitored externally
- [ ] Alert webhook configured
- [ ] Regular pnpm audit scheduled

---

## 5. Incident Response

### Credential Compromise

1. Rotate affected credential immediately
2. Re-encrypt site credentials if encryption key rotated
3. Revoke all API keys, require regeneration
4. Review access logs
5. Notify affected users

### Server Compromise

1. Take server offline
2. Rotate ALL credentials
3. Provision new droplet from clean image
4. Restore from verified backup
5. Audit and patch vulnerability

### Dependency Compromise

1. Pin to last known good version
2. Remove compromised package
3. Audit for effects
4. Report to npm security team

---

## 6. Compliance Notes

- ForgeCrawl respects robots.txt by default
- Per-domain rate limiting prevents aggressive crawling
- User-Agent clearly identifies the scraper
- No personal data collected from scraped sites beyond page content
- Login-gated scraping requires explicit user-provided credentials
- Users responsible for compliance with target sites' terms of service
