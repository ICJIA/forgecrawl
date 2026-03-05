# ForgeCrawl Document Suite — Audit (Revised)

**Date:** March 5, 2026
**Scope:** All 14 documents (00–12 + audit), comprehensive review and fixes applied
**Documents reviewed:** 00 (Master), 01 (Phase 1), 02 (Phase 2), 03 (Phase 3), 04 (Phase 4), 05 (Phase 5), 06 (Security), 07 (LLM Build Prompt), 08 (Differentiation), 09 (Monorepo), 10 (Revision/Docker), 11 (SQLite Auth), 12 (Use Cases)

---

## VERDICT: All issues resolved. Ready for Phase 1 development.

A comprehensive audit identified issues across all documents — inconsistencies from the Supabase-to-SQLite migration, Postgres-only SQL in Phases 3-5, broken code samples, missing security implementations, and naming conflicts. All issues have been fixed. This document records what was found and what was changed.

---

## FIXES APPLIED

### Doc 00 (Master Design)
- **Added** missing engine files to project structure (pdf-extractor.ts, docx-extractor.ts, sitemap.ts)
- Project structure, storage mode naming, and design decisions were already correct

### Doc 01 (Phase 1)
- **Added** result caching to Phase 1 scope with full implementation (`server/engine/cache.ts`)
- **Added** SSRF URL validation to Phase 1 scope with full implementation (`server/utils/url.ts`), including DNS resolution checks against private IP blocklists
- **Added** login rate limiting implementation (`server/utils/login-limiter.ts`) — max 5 failed attempts per email per 15 minutes
- **Added** testing checklist items for SSRF, caching, and rate limiting
- Auth middleware was already correct (includes `/api/auth/login` in skip list)
- No duplicate code block found (previously reported issue was already fixed)

### Doc 02 (Phase 2)
- **Renamed** `PostgresStorage` → `DatabaseStorage` throughout
- **Renamed** `postgres.ts` → `database.ts`
- **Changed** all "Postgres" storage references to "database" (header, goal, scope, interface comments, factory, testing checklist)
- **Changed** storage factory default from `'postgres'` to `'database'`

### Doc 03 (Phase 3)
- **Replaced** Postgres `SELECT FOR UPDATE SKIP LOCKED` queue with SQLite-compatible implementation using `BEGIN IMMEDIATE` transactions via Drizzle ORM
- **Replaced** raw Postgres SQL migration with reference to master Drizzle schema (Doc 11) + explanation of SQLite limitations
- **Updated** header and scope to say "SQLite-backed" instead of "Postgres-backed"

### Doc 04 (Phase 4)
- **Rewrote** API key generation endpoint from Supabase client to Drizzle ORM
- **Rewrote** auth middleware — replaced broken version (undefined `error`/`user` variables, `client.from('api_keys').select('*, profiles(*)')`) with correct Drizzle ORM version matching Doc 11
- **Added** `/api/auth/login` to auth middleware skip list
- **Changed** `profiles` table references to `users` throughout
- **Rewrote** usage tracking SQL migration (removed `UUID`, `TIMESTAMPTZ`, `BIGINT`, `MATERIALIZED VIEW`, `FILTER (WHERE ...)`) with Drizzle ORM schema reference + application-level stats query
- **Rewrote** usage logging utility from Supabase client to Drizzle ORM
- **Fixed** admin guard — was a comment stub, now has complete implementation
- **Fixed** create user flow — removed references to "password reset link" and "email" (no email system exists)
- **Fixed** testing checklist — "password reset email" → "admin shares temp password"

### Doc 05 (Phase 5)
- **Replaced** site credentials SQL migration (removed `gen_random_uuid()`, `REFERENCES profiles(id)`, `ENABLE ROW LEVEL SECURITY`, `auth.uid()`) with Drizzle ORM schema reference
- **Added** note about application-level access control replacing SQLite's lack of RLS
- **Replaced** chunk storage SQL query with Drizzle ORM TypeScript
- **Fixed** health check — removed Supabase-style `event` parameter from `checkDatabase()`

### Doc 06 (Security)
- **Fixed** asset table — "Postgres + filesystem" → "SQLite + filesystem" for scraped content
- **Fixed** RISK-02 — removed "render_js: false default" claim, clarified the tradeoff of `render_js: true` default
- **Replaced** database security checklist — removed Supabase RLS items ("RLS enabled on all tables", "Service role key", "Anon key"), added SQLite-specific checks (file permissions 600, WAL mode, foreign keys, middleware coverage, login rate limiting)
- **Added** RISK-11: Docker-specific risks (non-root user, memory limits, --no-sandbox accepted tradeoff, no Docker socket mount, secrets via env not image layers)
- **Added** RISK-12: SSRF implementation requirements (DNS resolution, redirect chain validation, complete IP range blocking)
- **Added** RISK-13: Login brute force with implementation reference
- **Fixed** RISK-09 data-at-rest — "Postgres" → "SQLite"

### Doc 07 (LLM Build Prompt)
- **Added** SSRF URL validation as Phase 1 deliverable (#10) with implementation description
- **Added** result caching as Phase 1 deliverable (#11)
- **Added** login rate limiting as Phase 1 deliverable (#12)
- **Added** DNS resolution and login rate limiting to critical security requirements
- **Fixed** storage mode env var comment — "postgres | filesystem | both" → "database | filesystem | both"
- **Updated** file structure to include `cache` in engine and `login-limiter` in utils
- **Added** SSRF, caching, and rate limiting test cases to testing checklist

### Doc 08 (Differentiation)
- **Fixed** comparison table — "Postgres-backed" queue → "SQLite-backed"
- **Fixed** "Configurable Postgres + filesystem" → "Configurable database (SQLite default) + filesystem"
- **Fixed** zero-dependency queue description — "Postgres with SELECT FOR UPDATE SKIP LOCKED" → "SQLite with BEGIN IMMEDIATE transactions"

### Doc 09 (Monorepo) — No changes needed

### Doc 10 (Revision/Docker)
- **Fixed** screenshot storage description — "JSONB field in Postgres mode" → "JSON field in database mode"
- **Fixed** exclusions table — "Postgres queue" → "SQLite queue"
- Cache function was already using Drizzle ORM (previously reported Supabase client issue was already fixed)
- No duplicate storage block found (previously reported issue was already fixed)

### Doc 11 (SQLite Auth)
- **Expanded** CSRF protection note in security comparison table — clarified that SameSite=Lax blocks cross-origin POST but not GET or same-site subdomain requests

### Doc 12 (Use Cases) — No changes needed (correctly uses API key auth patterns)

---

## STRUCTURAL DECISIONS MADE

1. **Result caching is Phase 1.** Added to Doc 01 scope, Doc 07 deliverables, and testing checklists. Implementation provided in Doc 01 Section 9.

2. **`render_js` defaults to `true`.** This is the tool's primary value proposition. Doc 06 updated to acknowledge the security tradeoff rather than claiming a false default.

3. **Login rate limiting is Phase 1.** In-memory implementation added to Doc 01 Section 10. Referenced from Doc 06 RISK-13.

4. **SSRF URL validation with DNS resolution is Phase 1.** Full implementation added to Doc 01 Section 8. Referenced from Doc 06 RISK-12.

---

## REMAINING NOTES (not bugs)

1. **Doc 12 references Phase 3-5 features as if live.** This is intentional — it's a forward-looking integration guide. No fix needed.

2. **Setup endpoint code appears in 3 docs (01, 07, 11).** All three copies are consistent. Doc 11 is the authoritative source.

3. **Auth middleware has 2 versions** (Phase 1 in Doc 01 session-only, full dual-auth in Doc 11). Both are now correct and serve different phases.

4. **Docker Compose appears in 2 versions** (Doc 10 full, Doc 11 minimal). Doc 10 is forward-looking (includes Phase 5 env vars), Doc 11 is Phase 1 minimal. Both are valid.

5. **Supabase upgrade path** is mentioned but not fully implemented. The Drizzle ORM abstraction makes it possible in theory, but no `pgTable` schema or Supabase auth adapter code exists. This is acceptable — it's documented as an optional future path, not a current feature.
