---
name: Enterprise security and bug audit
overview: "Perform a repo-wide security/bug audit, then harden Next.js + Supabase (DB RLS + Storage) with breaking-change-friendly fixes: enforce type safety, close access-control gaps, lock down public APIs, and remove unused/duplicate code while improving performance."
todos:
  - id: inventory
    content: Inventory server actions, API routes, and Supabase client usage; rank risks (P0/P1/P2).
    status: in_progress
  - id: typesafety
    content: Remove `ignoreBuildErrors`; fix resulting TS issues so build is trustworthy.
    status: pending
  - id: admin-authz
    content: Make admin authz server-authoritative; standardize and enforce `verifyAdmin` across all admin actions and routes.
    status: pending
  - id: api-hardening
    content: Validate + rate-limit public API routes; require auth where needed; remove unauthenticated email triggers.
    status: pending
  - id: supabase-rls
    content: Align RLS/constraints/indexes with app behavior; lock down `transactions` and `admin_users` safely.
    status: pending
  - id: xss-hardening
    content: Harden sanitizer and audit `dangerouslySetInnerHTML` usage.
    status: pending
  - id: cleanup-perf
    content: Remove unused/duplicate code; refactor repeated UI; shift unnecessary client queries server-side.
    status: pending
  - id: verify
    content: Run lint/build and perform security regression checks.
    status: pending
isProject: false
---

## Audit snapshot (from initial inspection)
- **Type safety bypass**: `next.config.js` sets `typescript.ignoreBuildErrors = true` which can hide runtime-breaking and security-relevant bugs.
- **Admin route protection is partial**: `lib/supabase/middleware.ts` only enforces “logged in” for `/admin/dashboard/*`, not “is admin”.
- **Admin UI currently queries `admin_users` from the browser**: `app/admin/dashboard/layout.tsx` calls `supabase.from('admin_users')...` using the browser client; with strict RLS this should be blocked, so admin auth should be moved server-side.
- **Public email API routes are abusable**: e.g. `app/api/send-welcome/route.ts` is unauthenticated, allowing email spam and Resend bill abuse.
- **RLS draft exists but is incomplete/inconsistent with app behavior**: `supabase/rls-policies.sql` locks down `admin_users` with no select policy; the app expects to read it.
- **XSS surface exists**: rich text is rendered via `dangerouslySetInnerHTML` (e.g. product description). `lib/sanitize.ts` allows `a[href]` but doesn’t enforce safe URL schemes or `rel` defaults.

## Goals
- Make authz and data access **server-authoritative**, with RLS as the last line of defense.
- Make public endpoints **rate-limited + validated**.
- Remove unsafe defaults (**no build error ignore**, no client-side “security”).
- Reduce duplication, tighten types, and improve performance.

## Implementation plan
### 1) Repo-wide inventory and risk ranking
- Enumerate:
  - Server actions (`"use server"`) and API routes (`app/api/**/route.ts`)
  - Supabase client usage (browser vs server vs service-role)
  - Any `dangerouslySetInnerHTML`, file uploads, webhook calls, and third-party integrations
- Produce a prioritized list of fixes (P0 authz/data exfil, P1 abuse vectors, P2 hardening).

### 2) Make TypeScript + lint authoritative
- Update `next.config.js` to **remove `ignoreBuildErrors`**.
- Run a strict pass over the resulting TS issues and fix them (types, nullability, unsafe any).

### 3) Admin security model (end-to-end)
- **Move admin session/role checks server-side**:
  - Replace client-side `admin_users` reads with a server helper (server component or server action) that derives the admin role from Supabase auth and a trusted lookup.
- **Harden middleware**:
  - Keep edge middleware for “must be logged in” + basic routing.
  - Add a robust server-side authorization gate for all admin data mutations (server actions already call `verifyAdmin`, extend and standardize this pattern).
- **Standardize admin authorization**:
  - Enhance `app/actions/admin-utils.ts` `verifyAdmin()` to return role/status details (not just boolean) and use it everywhere admin-only.

### 4) Lock down email APIs and add abuse protection
- For each API route in `app/api/*/route.ts`:
  - Add strict request validation (schema-based) and consistent error handling.
  - Add rate limiting and replay protection where applicable.
  - Require authentication for admin-only operations (`send-order-status`, `send-code`).
  - Remove or gate unauthenticated routes (`send-welcome`) so they can only be triggered from trusted server actions.

### 5) Supabase RLS + constraints aligned with app behavior
- Replace the “single SQL script” approach with **migration-style, testable policies**.
- Key RLS changes (high level):
  - `admin_users`: avoid public reads; allow **self-read** only via a secure server path, or add a narrowly-scoped self-read policy if absolutely necessary.
  - `transactions`: tighten guest insert policy (must insert with safe defaults like `status='Processing'`, no privileged columns settable; add DB constraints/checks to enforce invariants).
  - Ensure all tables have `FORCE ROW LEVEL SECURITY` and policies match real app queries.
- Add DB constraints and indexes relevant to integrity and performance (transaction_id uniqueness, foreign keys, not-null constraints, check constraints on status values).

### 6) XSS + content sanitization hardening
- Update `lib/sanitize.ts` to:
  - Enforce safe `a[href]` protocols (`http`, `https`, `mailto`) and strip `javascript:`.
  - Default `rel="noopener noreferrer"` when `target="_blank"`.
- Audit all `dangerouslySetInnerHTML` callsites and ensure they run through the hardened sanitizer.

### 7) Remove unused/duplicate code and improve performance
- Identify duplicated UI chunks (e.g., repeated card layouts) and refactor into shared components.
- Remove unused imports/state and dead code paths.
- Reduce client-side Supabase calls where server rendering is more appropriate.

### 8) Verification
- Add a minimal security regression checklist:
  - Anonymous user cannot access any admin pages/data.
  - Authenticated non-admin cannot execute admin server actions.
  - Public endpoints cannot be used to spam emails.
  - RLS policies prevent cross-user reads/writes.
  - Build passes with TypeScript errors enabled.
