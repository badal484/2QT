# 2QT / VELTO Food Palace — Pre-Deployment Audit

**Scope:** `backend/` (Node/Express/TypeScript API), `web/` (Next.js), `mobile/` (React Native — customer/rider/kitchen/admin build flavors).
**Method:** Full static review of source, migrations, config, deployment files, and `git log` history. No dynamic/penetration testing was performed — findings are based on code reading, not live exploitation.
**Severity key:** 🔴 **CRITICAL** — exploitable now, real financial/data/privacy impact, should block launch. 🟡 **MODERATE** — real risk or gap, fix before or shortly after launch. 🔵 **MINOR** — hygiene/best-practice, low urgency.

---

## Executive summary — fix before launch

| # | Finding | Section |
|---|---|---|
| 1 | 🔴 `POST /auth/verify-otp` accepts OTP `123456`/`000000` for **any** phone number, unconditionally in production (no `NODE_ENV` gate) | §3 |
| 2 | 🔴 `PATCH /riders/orders/:id/status` has no ownership check — any rider can set any order's status | §3 |
| 3 | 🔴 `GET /kitchen/debug-dispatch` — fully unauthenticated, leaks customer/rider names + phone numbers | §3 |
| 4 | 🔴 `GET /notifications/tokens-debug` — fully unauthenticated, leaks live push tokens + PII, and mutates data on every GET | §3 |
| 5 | 🔴 `getKitchenId()` cross-tenant IDOR — 19 kitchen endpoints trust a client-supplied `kitchen_id` over the authenticated user's own | §3 |
| 6 | 🔴 `GET /orders/:id/tracking` — any rider can pull any order's tracking data, including the delivery OTP | §3 |
| 7 | 🔴 CORS accepts **every** origin unconditionally, combined with `credentials: true` | §8 |
| 8 | 🔴 A real Firebase Admin private key was committed to `main` and remains in git history even though later removed | §2 |
| 9 | 🔴 Subscription purchase: client-supplied `planId` isn't verified against the paid Razorpay order, and the grant has zero idempotency — repeatable plan/price swap | §4 |
| 10 | 🔴 No backup strategy found anywhere in the repo for a database holding orders/wallet/refund/payout ledgers — unverified, must confirm with hosting provider | §5 |

Full detail, plus all 🟡/🔵 findings, below.

---

## 1. Stack Overview

### Frameworks & versions
- **Backend**: Node.js + Express `4.18` + TypeScript `5.3.3` (`backend/package.json`). TS version is noticeably behind `web`/`mobile` (both on TS `^5.8+`) — not urgent, but worth aligning. `@types/node ^25.6` vs. the Dockerfile's actual `node:22-alpine` runtime is a types/runtime major-version mismatch (cosmetic — doesn't affect the compiled output — but can mask real Node-22 incompatibilities during development).
- **Web**: Next.js `16.2.4`, React `19.2.4` — current.
- **Mobile**: React Native `0.85.2`, React `19.2.3` — current/cutting-edge. `mobile/package.json` is the only one of the three with an `engines.node` constraint (`>=22.11.0`).
- No root `package.json` — `backend/`, `web/`, `mobile/` are three fully independent, unlinked npm projects (no workspace tooling).
- Repo root also contains a large amount of developer scratch material not part of the deployable app (`fix_*.py`, `test_*.js`, `patch.js`, an 8.4MB `dropbox.log`, `venv/`, `venv_rembg/`) — 🔵 worth `.gitignore`-ing or removing before a clean production tag.

### Database(s)
- **PostgreSQL** — no ORM, raw SQL via `pg 8.11` (`backend/src/db/index.ts`), 136 hand-written migration files run automatically on boot (`node dist/db/migrate.js && node dist/index.js`).
- **Redis** — `redis 4.6` (node-redis v4), used for caching, rate-limit backing, BullMQ job queues, Socket.IO horizontal scaling (`@socket.io/redis-adapter`), and idempotency locks. TLS auto-detected for `rediss://` / Upstash hostnames — production target is almost certainly **Upstash Redis** (code explicitly wraps calls with a 200ms timeout + in-memory fallback specifically to survive "Upstash rate limit crashes").
- Postgres connection uses TLS in production but with `rejectUnauthorized: false` (see §5).

### Hosting / deployment / CI — 🟡 **MODERATE: genuinely inconsistent across the repo**
This is the messiest area of the audit. Evidence points to **three or more different backend deployment targets**, not clearly reconciled:
1. **A real, working GitHub Actions pipeline** (`.github/workflows/deploy-backend.yml`) SSHes into an **AWS EC2** host on push to `main` and runs `docker compose -f docker-compose.aws.yml up -d`. This is legitimate, working CI/CD, paired with `nginx/api.go2qt.com.conf` (Let's Encrypt TLS for `api.go2qt.com`).
2. **A separately-pinged Render instance** — `.github/workflows/keep-backend-warm.yml` cron-pings `https://twoqt-1.onrender.com` every 10 minutes to prevent free-tier spin-down, confirming a live, independent Render deployment exists.
3. **Cloudflare Workers config for the web app** (`web/wrangler.jsonc`, `web/open-next.config.ts`, `@opennextjs/cloudflare`/`wrangler` deps) sits alongside a confirmed, actively-linked **Vercel** project (`.vercel/repo.json`, pulled production env vars present) — unclear whether Workers is a live third target or an abandoned experiment.
4. The backend **Dockerfile documents a fourth target** (Google Cloud Run, two services — an autoscaling API and a single-instance worker) in comments, with no corresponding CI/config found anywhere else in the repo.
5. **The shipped mobile app is hardcoded to a Render URL** (`mobile/src/config/env.ts:1`, `PROD_API_URL` — a plain string constant, no env-var override), while **web falls back to a different Render URL** (`twoqt-3kjw.onrender.com` in several `web/` files) than the one the keep-warm job pings. **None of these match the EC2 target the GitHub Actions workflow actually deploys to.**

**Recommendation:** before launch, determine and document the single source of truth for "what backend is actually live," and make sure the shipped mobile app and web app are both pointed at it. Right now it's unclear from the repo alone which backend real users are hitting.

- No CI/build gating exists for `web/` or `mobile/` (only two workflows exist, both backend-only) — 🟡 mobile in particular has zero automated build verification before a release is cut.
- Local build commands work: backend `tsc` (dist/ present and current), web `next build` (wrapped with Sentry), mobile has full native tooling (Gradle, CocoaPods) for local builds.

### Third-party services

| Service | Purpose | Notes |
|---|---|---|
| **Razorpay** | Payments (orders, wallet top-up, subscriptions), refunds, RazorpayX payouts to riders/kitchens | Primary payment rail — see §4 |
| **Cashfree** (`cashfree-pg` dep) | Legacy — **dead**, webhook returns HTTP 501 | 🔵 remove the unused dependency |
| **MSG91** | SMS OTP delivery + client-side OTP widget | |
| **Interakt** | WhatsApp Business API for order/OTP/payout notifications, falls back to SMS on failure | |
| **Google Maps Platform** | Distance/ETA, reverse geocoding, address autocomplete | API key is hardcoded client-side — see §2 |
| **Firebase** | FCM push notifications + Admin SDK (backend), client auth SDK (web) | Admin key was committed to git history — see §2 |
| **Sentry** | Error/perf tracking, all three apps | Genuinely production-configured (see §6), not just an unused dependency |
| **ImageKit** | Image/video CDN + upload storage | `cloudinary 2.0` also present as a dependency but **unused anywhere in `backend/src`** — 🔵 leftover from a past migration |
| **Exotel** | Env vars present (`EXOTEL_*`) suggesting a voice-call integration, but no usage found in `backend/src` and absent from `.env.prod.example` | 🔵 confirm whether this is dead config or a not-yet-wired feature |

No email provider is integrated — all transactional messaging is push (FCM) + WhatsApp (Interakt) + SMS (MSG91).

---

## 2. Secrets & Config

### 🔴 CRITICAL — Firebase Admin private key committed to git history
A complete Firebase Admin SDK service-account JSON, **including the full RSA private key**, was hardcoded directly into `backend/src/services/fcm.service.ts` in commit `370debd` ("fix(fcm): add production Firebase service account fallback…", 2026-08-16). It was removed ~9 hours later in commit `8ff3df0` ("close token-hijack security hole…"), which made the env var mandatory instead. **Both commits are reachable from `origin/main`** — the key is gone from the working tree but permanently recoverable from history via `git log -p` / `git show 370debd` by anyone with read access to the remote.

**Action required regardless of the remote's visibility:** rotate/revoke this service-account key in the Firebase/GCP console immediately, and if the remote is or was ever public, scrub history (BFG/`git filter-repo`) as a secondary measure — rotation is the real fix, history-scrubbing alone is not sufficient since the key may already be cached/cloned elsewhere.

### 🟡 MODERATE — Hardcoded Google Maps API key
The same real-looking Google Maps/Geocoding key is hardcoded in two places: `mobile/src/config/env.ts` (`GOOGLE_GEOCODING_KEY`) and as a fallback in `web/app/components/DispatchMap.tsx`. This is common for client-embedded map keys, but it's only safe if the key is restricted in the Google Cloud Console (HTTP referrer for web, package name + SHA-1 for Android, bundle ID for iOS). **Action:** confirm those restrictions are actually configured — an unrestricted key is abusable for billing/quota exhaustion by anyone who extracts it from the app bundle.

### 🟡 MODERATE — Real (expired) admin JWT committed to a debug script
`backend/scripts/test_upload.js` has a hardcoded, real, signed `super_admin`-role JWT (committed 2026-08-10). It's already expired, so not an active credential, but the habit of pasting live tokens into checked-in scripts will produce a real leak the next time someone does it with a token that hasn't expired yet. Recommend a `.gitignore`'d `scripts/local/` convention for anything with real credentials.

### 🔵 MINOR — Client-embedded keys that are fine as-is
- `web/app/lib/firebase.ts` — Firebase **web** client `apiKey`. Standard practice; gated by Firebase Auth/Security Rules + authorized-domain list, not a true secret.
- `mobile/src/config/env.ts` — ImageKit **public** key and MSG91 widget ID/token-auth. Explicitly the public counterparts of the real secrets (private key / auth key stay server-side).
- `mobile/src/config/env.ts` — `BUSINESS_UPI_ID` shown to customers at the door. Not a secret by function, but worth remembering it's a real financial identifier if this repo is ever made public.

### What's clean
- `git ls-files | grep -E '\.env'` shows **no real `.env` file is currently tracked** — only `.env.example`/`.env.prod.example` templates and RN's boilerplate `.xcode.env`. `.gitignore` coverage for `backend/.env`, `web/.env*` was verified correct via `git check-ignore -v`.
- A full history scan for `.env`-pattern commits found only placeholder values (`your_key_here`, `<generate: openssl rand -hex 32>`) — no real secrets were ever committed via `.env` files specifically (the Firebase key above was hardcoded in a `.ts` source file, a separate incident).
- 🔵 `mobile/.gitignore` has no `.env` pattern at all (unlike root and `web/.gitignore`). No `mobile/.env` exists today, so this is a latent gap, not an active leak — add the pattern defensively before one is ever created.

### Dev/staging/prod separation
Real, and platform-level rather than file-swapping: different env var sets live on each hosting target (Render/EC2 for backend, Vercel for web), with `.env.example`/`.env.prod.example` serving only as onboarding documentation. `NODE_ENV`-gated behavior found in the backend is generally sound — SSL mode, Postgres pool size, rate-limiter bypass, and stack-trace exposure in error responses are all correctly conditioned on it. **The one place this pattern breaks is the OTP bypass in §3, which is *not* gated by `NODE_ENV` despite every other dev-shortcut in the codebase correctly being gated by it.**

---

## 3. Auth & Access Control

### How authentication works
Pure bearer JWT, no sessions/cookies. Access tokens (2h lifetime) carry `userId`/`role`/`kitchenId`/`zoneId`/`jti`, but **`authenticate` middleware re-reads role/kitchen/zone/active-status from the `users` table** (Redis-cached 60s) rather than trusting the JWT's claims — a stale or tampered claim for role/kitchen doesn't matter beyond `userId`. This is good design. Refresh tokens (7d, 30d for kitchen-PIN login) are stored bcrypt-hashed and not rotated on use (same refresh token can be reused until expiry/explicit revocation — no reuse-detection scheme, 🔵 minor). Logout revokes the current access-token `jti` (Redis, TTL-matched) and all refresh tokens; the revocation check fails open if Redis times out (100ms) — an acceptable availability/security tradeoff, but worth knowing.

### 🔴 CRITICAL — Universal OTP bypass, unconditional in production
`backend/src/routes/auth.ts:449-452`, inside `POST /auth/verify-otp`:
```
const TEST_ACCOUNTS = ["919999999999", "917892493486", "912222222222", "913333333333", "917896495426"];
if ((String(otp) === '123456' || String(otp) === '000000') || TEST_ACCOUNTS.includes(normalizedPhone)) {
    storedOtp = String(otp);
}
```
Unlike every other dev-only shortcut in this codebase (all correctly gated by `NODE_ENV === 'development'`), **this one has no environment guard at all**. Anyone who knows or guesses a target phone number can log into that account in production using OTP `123456` or `000000` — full account takeover for any existing customer, rider, kitchen staff, or admin phone number. There is also no dedicated rate limiter on `/auth/verify-otp` (see §8), so this isn't even throttled. **This is the single highest-priority fix in the whole audit — gate it behind `NODE_ENV === 'development'` before anything else ships.**

### 🔴 CRITICAL — Any rider can mutate any order's status
`backend/src/routes/rider.ts:391-414`, `PATCH /riders/orders/:id/status`:
```
UPDATE orders SET status = $1, rider_id = COALESCE(rider_id, $4)
 WHERE id::text = $2 OR display_id = $2 OR display_id = $3 OR display_id = $5
```
Every sibling route in this file (`/mark-unavailable`, `/claim`, `/unclaim`, `/customer-unreachable`, `/verify-otp`, etc.) correctly filters by `rider_id = <this rider>`. This one doesn't — it matches purely on order ID, so any authenticated rider can set any order's `status` to any string taken verbatim from `req.body.status`. A rider could mark someone else's order `delivered` (triggering payout/closure without actual delivery) or flip an unrelated order to `cancelled`. Fix: add `AND rider_id = $riderId` to the `WHERE` clause, matching the pattern already used correctly everywhere else in this file.

### 🔴 CRITICAL — Two fully unauthenticated debug endpoints leaking PII
- `GET /kitchen/debug-dispatch` (`kitchen.ts:54-74`) — no `authenticate` middleware. Returns the 10 most recent orders (customer names, statuses) plus every rider/admin's name, phone number, and online status.
- `GET /notifications/tokens-debug` (`notifications.ts:229+`) — no `authenticate` middleware. Returns a hardcoded-phone-substring user lookup, the 20 most recently active FCM push tokens joined to user phone/name, and recent broadcast data — **and mutates data on every GET** (runs an `UPDATE device_tokens SET is_active = FALSE` cleanup as a side effect of an unauthenticated read).

Both are unambiguous leftover debug code. Delete them or gate behind `authenticate + requireRole('super_admin')` before launch.

### 🔴 CRITICAL — Cross-kitchen IDOR via `getKitchenId()`, affecting 19 endpoints
`backend/src/routes/kitchen.ts:13-21`:
```js
async function getKitchenId(req, res) {
    const override = (req.query.kitchen_id || req.headers['x-kitchen-id']) as string;
    if (override) return override;
    if (req.user!.kitchenId) return req.user!.kitchenId;
    ...
}
```
Every kitchen-scoped route (menu view/edit, kitchen pause/resume, order listing/claim/status, inventory, prep-list, batches, analytics, rider assignment, dine-in tickets/bills — 19 call sites total) uses this helper, and it **prefers a client-supplied `?kitchen_id=` query param or `x-kitchen-id` header over the authenticated user's own assignment, with no check that the requester actually belongs to the target kitchen**. Any chef/kitchen_manager can read or write another kitchen's entire operational surface just by supplying a different kitchen ID. Fix: only allow the override for `super_admin`, and validate it against a real kitchen-staff assignment for every other role.

### 🔴 CRITICAL — Delivery OTP exposed to any rider for any order
`backend/src/routes/order.ts:352-368`, `GET /orders/:id/tracking` — the code comment literally says "kitchen/rider/admin are unrestricted." Any authenticated rider (a high-turnover, low-vetting role) can pull tracking data — including the delivery OTP once an order is `out_for_delivery` — for orders they have no assignment to, by ID enumeration. This enables delivery fraud (using someone else's OTP) and address/PII harvesting. Recommend scoping non-admin roles to orders they're actually assigned to, the same way the `customer` branch is already scoped.

### 🟡 MODERATE — Table-booking staff actions not scoped to their own restaurant
Same shape of bug as the kitchen IDOR above, smaller blast radius: `POST /table-bookings/:id/checkin`, `/mark-paid`, `/item-status`, `/no-show` check the caller's **role** against an allow-list but only the `dine_in_staff` branch additionally checks `restaurantId`. A `partner`/`chef`/`kitchen_manager` from Restaurant A can check in guests, mark bills paid, or mark no-shows for Restaurant B just by knowing a booking ID. `GET /:id/bill` is weaker still — it only blocks `role==='customer'` from viewing someone else's bill, so any non-customer role (including `rider`) can read any booking's itemized bill.

### 🟡 MODERATE — Kitchen-PIN login has no rate limiting
`POST /auth/kitchen-pin` — a 4-digit PIN (10,000 combinations) with no dedicated throttling, only the global 1000 req/min limiter. Brute-forceable. Also has a `NODE_ENV === 'development'` PIN-`0000` bypass — correctly gated, but worth double-checking the prod env var is reliably set given how easy it was for the OTP bypass above to ship ungated.

### 🟡 MODERATE — Subscription plan/price swap (cross-referenced from §4)
`POST /payments/verify-payment`'s subscription branch trusts a client-supplied `planId` without fetching the Razorpay order to confirm what was actually paid for — full detail in §4.

### What's solid
- `admin.ts` (98 routes), `finance.ts`, `support.ts`, `customer.ts` (18 routes), `partner.ts`, and every `rider.ts` route *except* the one flagged above consistently derive identity from `req.user`, never from client-supplied body/query fields, and are correctly role-gated. `customer.ts` in particular is a clean example of deriving ownership from the token everywhere.
- Privilege escalation to any staff role is never driven by client input at login — roles are always pre-provisioned by an admin and re-read from the DB at auth time. The one way around this is the OTP bypass above, which doesn't grant new privileges but does let an attacker assume an *existing* staff account's identity.
- 🔵 A `'manager'` role appears in two `requireRole` allow-lists but is never actually assigned to any user anywhere — dead, harmless, but worth removing for clarity.

---

## 4. Payments

**Provider:** Razorpay (`razorpay` SDK `^2.9.6`) for order payments, wallet top-ups, and subscriptions; RazorpayX (raw `fetch` + Basic auth) for rider/kitchen payouts. Cashfree is present as a dependency but dead (webhook stub returns 501).

### Raw card data — clean
Checkout is fully delegated to Razorpay's hosted Checkout SDK. The backend only ever receives `razorpay_order_id` / `razorpay_payment_id` / `razorpay_signature` — three opaque identifiers. No card number, CVV, or expiry appears anywhere in `backend/src`, and no request-body logging middleware exists that could inadvertently capture it. PCI scope is minimized correctly.

### Webhook signature verification — implemented correctly, and blocking
`backend/src/routes/webhooks.ts:13-36` verifies HMAC-SHA256 over the **raw** request body (captured via an `express.json({ verify })` callback so signed bytes exactly match) against `RAZORPAY_WEBHOOK_SECRET`. If the secret is unset or the signature mismatches, it returns a non-2xx status *before* any DB mutation — no dev bypass exists. Client-facing confirmation endpoints (`/verify-payment`, table-booking payment confirmation, rider cash-confirmation) independently re-verify the same HMAC scheme.

### 🔴 CRITICAL — Subscription purchase: plan swap + no idempotency
Two compounding issues in the same code path (`backend/src/routes/payment.ts:346-349`, feeding into `backend/src/services/subscription.service.ts:21-67`):

1. **No order/plan verification.** The sibling `wallet` branch just above it fetches the Razorpay order and checks `notes.customerId` matches before crediting. The `subscription` branch does not fetch the order at all — it just calls `handleSubscriptionRenewal(customerId, planId)` using a **client-supplied `planId`**, trusting only that the signature is valid for *some* genuine payment. A customer can pay for the cheapest plan and then call `/verify-payment` with the same valid `order_id`/`payment_id`/`signature` but a more expensive `planId`, and receive it.
2. **No idempotency guard.** `handleSubscriptionRenewal` has no Redis dedup and no unique constraint tying a subscription row to a specific gateway payment — it just deactivates the current subscription and inserts a new one, every time it's called. It's reachable from **two independent paths for the same payment** (the webhook, and the client's own `/verify-payment` call), so a webhook retry (a documented, expected Razorpay behavior) or a simple repeated client call **grants a brand-new subscription each time**, for one payment.

Fix both together: fetch the Razorpay order server-side, read `notes.planId`/`notes.customerId` from it (ignore the client-supplied value or validate against it), and add the same Redis-dedup-plus-DB-guard pattern already used correctly for order and wallet finalization.

### 🟡 MODERATE — Order line-item price trusts client input for the stored/displayed value
`backend/src/services/order.service.ts:78-84` — `order_items.price_paise` is stored as `COALESCE(client-supplied item.pricePaise, db price)`, acknowledged in an inline comment. **The amount actually charged is safe** — `calculatePricing()` (`payment.service.ts`) recomputes everything server-side from DB state before creating the Razorpay order — but the stored per-item price shown in receipts/order history/invoices could be spoofed by a malicious client, which is a data-integrity/audit-trail concern even though it can't cause underpayment.

### 🟡 MODERATE — No webhook-side amount reconciliation
The `order.paid` webhook branch finalizes the order without comparing `payload.payment.entity.amount` against the order's own `gateway_amount_paise`. Low practical risk since Razorpay enforces exact-amount payment against a server-created order, but there's no defense-in-depth check catching a corrupted order row or partial-payment edge case.

### 🔵 MINOR
- `processBankRefund` calls the live Razorpay refund API *before* opening its local DB transaction — if the DB write fails after Razorpay has already refunded, local state can drift out of sync (the `refund.processed` webhook reconciles by `razorpay_refund_id`, which may never have been persisted if the DB write itself is what failed).
- `paymentLimiter` (50 req/min) is applied only to `/create-order`, not to `/wallet/recharge`, `/subscription/purchase`, or `/verify-payment`.
- `/payments/mock-success` is correctly gated behind `NODE_ENV !== 'development' → 403` — confirm this resolves correctly in the actual prod deployment given the OTP-bypass precedent.
- Refund authorization is properly gated across all three paths (self-service/finance/admin) — no gap found.

### Idempotency summary (order + wallet — these are solid)
- **Order finalize**: Redis dedup flag + `SELECT ... FOR UPDATE` row lock + status check, all inside one DB transaction. A crash mid-way rolls back atomically. Correctly handles both the webhook and client `/verify-payment` racing for the same payment.
- **Wallet recharge**: Redis dedup keyed on `gatewayPaymentId` + atomic `INSERT ... ON CONFLICT DO UPDATE` balance credit inside one transaction.
- **Subscription**: no equivalent protection at all — see the CRITICAL finding above.

---

## 5. Database

### Schema summary
136 incrementally-applied migrations define a broad domain: `users` (phone-normalized via trigger, role-enum extended over time), `kitchens`/`zones`, `menu_items`/`ingredients`/`recipes`/`recipe_ingredients`, `orders`/`order_items` (order status enforced by a `BEFORE UPDATE` state-machine trigger — a nice piece of defense-in-depth against invalid transitions), `customer_wallet`/`wallet_transactions`/`loyalty_transactions`, `promo_codes`, rider tables (`rider_daily_earnings`, `weekly_payouts`, `rider_applications`, `sos_alerts`, `cash_submissions`), `refunds`, `support_tickets`/`ticket_messages`, the full dine-in/table-booking subsystem (`table_bookings`, `restaurant_*`, `table_booking_payments`), `notifications`/`device_tokens`, and audit-log tables. This is a mature, evolved schema shaped by many incremental `ALTER TABLE`s rather than clean table redesigns — normal for a production system at this stage.

🟡 **`promo_codes` is defined by two separate `CREATE TABLE` statements** across migrations `010.sql` and `041.sql`. Worth confirming which definition actually won in the deployed database and whether `041` is safely idempotent against `010` having already run.

### 🟡 MODERATE — Missing indexes on real hot paths
Cross-checked every `WHERE`-clause column against `CREATE INDEX` statements across all 136 migrations (not assumed — actually grepped for each candidate):
- **`recipes.menu_item_id` / `recipe_ingredients.recipe_id` / `.ingredient_id`** — joined on **every single order placed** for stock deduction (`stock.service.ts`, `order.service.ts`). No index exists for any of these columns. This is the most consequential gap since it's on the checkout hot path, not an admin screen.
- **`ingredients.kitchen_id`** — queried on every kitchen stock-screen load and every stock update. No index.
- **`production_batches.kitchen_id`**, **`prep_tasks.kitchen_id`** — queried on kitchen ops screens. No index.

Everything else checked (orders by customer/kitchen/rider/status, notifications by user, refresh tokens, support tickets, wallet transactions, table bookings, device tokens) already has appropriate indexes — several were added specifically for performance in later migrations (`070_critical_perf_indexes.sql`, `117_performance_indexes.sql`, `123_composite_performance_indexes.sql`), so the team clearly has done indexing passes before — these four columns appear to have simply been missed.

### SQL injection — clean, one low-risk deviation
The codebase consistently uses parameterized `query(sql, [params])` calls, including in every dynamic `WHERE`-builder checked (`admin.ts`, `finance.ts`, `notifications.ts`, `support.ts`, `prelaunch.ts`, `trigger.service.ts`) — only column names/operators from a fixed code-controlled set are ever concatenated, values always go through `$n` placeholders.

🔵 One deviation: `backend/src/routes/auth.ts:220-227` interpolates `detectedZoneId`/`detectedKitchenId` directly into an `INSERT` string rather than via `$n`. These values are DB-sourced UUIDs (from `SELECT id FROM zones/kitchens ...`), not raw user input, so they can't realistically carry an injection payload — but it's a deviation from the codebase's own safe pattern and cheap to fix for consistency.

### 🔴 CRITICAL (unverified) — Backup strategy
No backup automation exists anywhere in the repo: no `pg_dump`/`pg_restore` calls, no backup-related cron jobs, no CI step, and the production `docker-compose.aws.yml` doesn't even run Postgres itself (it's an external/managed database, connection string supplied via env). This means backups may well be configured at the hosting provider's dashboard level, outside source control — **that's unverifiable from the code alone**. Given this database holds every financial ledger in the system (orders, wallet transactions, refunds, payouts, cash submissions), this needs an explicit, positive confirmation from whoever manages the production Postgres instance — "automated backups are enabled and a restore has been test-run" — before launch. Treat "no evidence found" as "assume no backups exist" until proven otherwise.

### TLS
Postgres connections use SSL in production but with `rejectUnauthorized: false` (`backend/src/db/index.ts`) — encrypts in transit but doesn't verify the server certificate, leaving it open to a MITM if the network path to the DB host isn't otherwise trusted. 🟡 Worth tightening if the DB provider supports proper CA verification.

---

## 6. Error Handling & Resilience

### Third-party failure handling — broadly good
Razorpay, MSG91, WhatsApp (Interakt), Google Maps, and Firebase calls are consistently wrapped in try/catch with sensible fallbacks: WhatsApp failures fall back to SMS; Maps failures return `null` rather than throwing (though order creation then deliberately hard-fails on a missing distance rather than risk under-charging — an intentional fail-safe, not a bug); Firebase init falls back to default credentials. One inconsistency worth normalizing: the main `order.paid` webhook branch calls `finalizeOrder` without a local try/catch (safety-netted by `express-async-errors` + the global error handler, so it won't crash the process, but it means this branch returns 5xx and gets retried by Razorpay while every *other* webhook branch swallows its own errors and always returns 200 — masking failures from Razorpay's retry mechanism in those other branches).

### Retry/idempotency on order placement — partial gap
`POST /create-order` uses a Redis `SET NX EX 10` lock keyed on `customerId + md5(request body)` (`payment.ts:30-37`). This catches byte-identical resubmissions within 10 seconds, but:
- It's a **server-derived** key, not a client-supplied idempotency token — a retry with even a trivially different payload won't match.
- **10 seconds is short** relative to real request latency — this handler makes two external calls (Google Maps distance lookup with no explicit timeout, then Razorpay order creation) that can each take several seconds. A client that times out and retries *after* the lock expires sails past the check and creates a genuine second order.
- If Redis itself is unavailable, the lock acquisition is treated as **successful** (`.catch(() => true)`) — idempotency protection silently disables itself rather than blocking, and there's no DB-side backstop (no unique constraint) to catch what gets through.

This is a real, if narrow, "client retries after a slow request" gap — not a five-nines problem, but worth a client-supplied idempotency key and/or a longer lock window before high-volume launch.

### Logging / monitoring — solid
Sentry is genuinely production-configured in all three apps (DSN present, environment tagging, sensible sampling rates — 20% traces in prod, session replay on web with PII masking enabled). Backend additionally writes 500-level errors to a DB audit log and emits a real-time `critical_alert` over the socket to the admin dashboard — a reasonable in-house alerting layer beyond Sentry alone. No dedicated APM (Datadog/Winston/Pino) exists, but between Sentry + the custom audit log this is an adequate minimum, not a gap.

### TODO/FIXME/placeholder code — clean
No `TODO`/`FIXME`/`XXX`/`HACK` markers were found anywhere in `backend/src`, `web/app`/`web/components`, or `mobile/src`. The codebase doesn't have a "known-incomplete work" debt problem in the traditional sense — the real leftover-debug-code issues are the two unauthenticated endpoints already covered in §3, not comment-marked TODOs.

---

## 7. Race Conditions / Concurrency

### Order placement
- **Daily-limit stock decrement is correctly atomic.** `finalizeOrder`'s `UPDATE menu_items SET today_sold_count = today_sold_count + qty, available = CASE WHEN ... THEN false ...` runs inside a transaction with a row lock, and a `rowCount`/overshoot check rejects the second of two concurrent finalizations for the last unit of a daily-limited item (`ITEM_SOLD_OUT_DURING_CHECKOUT`). This part is well implemented.
- 🟡 **But the plain `available` boolean is never re-checked at finalize time** — only the daily-limit counter is. It's read once at `/create-order` time. If kitchen staff flip an item to unavailable *after* a customer's order is created but *before* their (online) payment completes — a gap that can be minutes long — the order still finalizes and decrements stock for an item the kitchen has since marked unavailable. This doesn't apply to COD/wallet orders, which finalize immediately.
- 🔵 Two concurrent `/create-order` calls for the last unit of a daily-limited item can both pass the initial unlocked availability check and each create a `pending_payment` order row; only one can successfully finalize, and the loser's transaction rolls back cleanly — so this isn't an oversell, but it does leave an orphaned `pending_payment` row rather than a clean rejection at creation time.
- 🔵 No unique DB constraint (e.g. on `gateway_order_id`) backstops the Redis idempotency lock described in §6 — Redis is the only line of defense against duplicate order rows.

### Rider/kitchen assignment — solid, no issues found
All three claim/assignment paths use the correct atomic pattern (conditional `UPDATE ... WHERE <guard is null/matches>` + `rowCount` check, inside a transaction where relevant):
- **Kitchen order claim** (`kitchen.ts:216-221`) — `WHERE status='confirmed' AND claimed_by_chef_id IS NULL`.
- **Rider order claim** (`rider.ts:981-985`) — `WHERE rider_id IS NULL AND status IN (...)`, plus a `FOR UPDATE` lock on the rider's own row to safely enforce a max-active-orders cap.
- **Auto-assignment** (`autoAssign.ts:276-280`, `:288-300`) — same guarded-update pattern, with an inline comment explicitly acknowledging the race it's guarding against.

No two riders or two kitchen staff can be told they both got the same order — this part of the system is well engineered.

---

## 8. Deployment Readiness

### CI/CD
A real GitHub Actions pipeline exists and works for the backend (SSH to EC2, `docker compose up`), described in §1. There is **no CI at all for `web/` or `mobile/`** — web deploys presumably happen via Vercel's own git integration (inferred from the linked `.vercel/` project, not confirmed by any in-repo workflow), and mobile has zero automated build verification before a release. 🟡 Combined with the multiple-deployment-target confusion in §1, this is worth resolving before a confident launch.

### 🔴 CRITICAL — CORS accepts every origin unconditionally
`backend/src/index.ts`, the CORS `origin` callback:
```js
origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return callback(null, true);
    if (origin.endsWith('.workers.dev') || origin.endsWith('.vercel.app') || /* ... */) return callback(null, true);
    callback(null, true); // Ensure production API continuity across all frontend domains
}
```
The final line is reached for **any** origin that fails every earlier check — there is no code path anywhere in this function that ever rejects an origin. Combined with `credentials: true`, this means **any website on the internet can make authenticated, credentialed cross-origin requests against this API** on behalf of a logged-in user's browser session — the `ALLOWED_ORIGINS` env var and the hardcoded allowlist are both dead code in practice. Fix: make the final fallback actually reject (`callback(new Error('Not allowed by CORS'))` or `callback(null, false)`), and require `ALLOWED_ORIGINS` to be explicitly set in every environment.

### Rate limiting — present but thin
Five limiters are defined (`generalLimiter`, `otpLimiter`, `paymentLimiter`, `gpsLimiter`, `broadcastLimiter`), but **only two are ever actually applied anywhere**: `generalLimiter` globally (1000 req/min per process) and `paymentLimiter` on `/create-order` alone. `otpLimiter`, `gpsLimiter`, and `broadcastLimiter` are dead code — never imported outside their own definitions. `/auth/send-otp` has its own separate, correctly-applied local limiter (10/hr per IP), but `/auth/verify-otp`, `/auth/kitchen-pin`, `/payments/verify-payment`, and `/webhooks/razorpay` all rely solely on the global limiter, i.e. **no endpoint-specific throttling on any of the most sensitive routes in the system.** This compounds the OTP-bypass finding in §3 — there's nothing meaningfully slowing down an attacker hammering `/verify-otp`.

### HTTPS enforcement
No explicit HTTPS-redirect middleware and no `app.set('trust proxy', ...)` call — given the app runs behind a reverse proxy in every deployment scenario described in §1, `req.ip`/`req.secure` won't reflect the real client without this, which also affects how `express-rate-limit` keys requests by IP. 🔵 HSTS is present via `helmet()`'s defaults (180-day max-age, subdomains included) — not tuned explicitly, but not absent either. No cookie-based session state exists (pure bearer-token auth), so secure-cookie flags are moot.

### TODO/FIXME/placeholder/test code
Covered fully in §6 — no comment-marker debt found; the real "leftover debug code" is the two unauthenticated endpoints in §3, which is the appropriate place they're flagged. Two properly-`NODE_ENV`-gated dev shortcuts exist elsewhere (`rider.ts` mock order IDs, `/payments/mock-success`) as a useful contrast to how the ungated OTP bypass *should* have been written.

---

## Appendix — full severity tally

**🔴 Critical (10):** universal OTP bypass · unscoped rider order-status update · unauthenticated `kitchen/debug-dispatch` · unauthenticated `notifications/tokens-debug` (+ write side-effect) · cross-kitchen IDOR (19 endpoints) · unrestricted order-tracking/delivery-OTP access · CORS allow-all + credentials · Firebase Admin key in git history · subscription plan-swap + no idempotency · unverified backup strategy for financial data.

**🟡 Moderate (12):** hardcoded Google Maps key (verify restrictions) · admin JWT committed to a script · table-booking staff tenant-isolation gaps · kitchen-PIN brute-forceable (no rate limit) · order line-item price trusts client input (display only) · no webhook amount reconciliation · missing indexes on order hot path + kitchen ops · `promo_codes` double-defined across migrations · Postgres TLS without cert verification · multiple conflicting deployment targets / mobile pointed at a different backend than CI deploys · no CI for web/mobile · thin/inconsistent rate limiting on sensitive routes.

**🔵 Minor (11):** outdated backend TypeScript version · repo-root dev scratch files · `mobile/.gitignore` missing `.env` pattern · dead `cashfree-pg`/`cloudinary` dependencies · unused `Exotel` config · refund-then-DB-write ordering gap · inconsistent webhook error-handling (retry vs. swallow) · `paymentLimiter` not applied to all payment routes · orphaned `pending_payment` rows under a rare stock race · one low-risk SQL string-interpolation deviation (non-user-controllable UUIDs) · refresh tokens not rotated on use · dead `'manager'` role.

**What's genuinely solid:** payment card-data handling (fully delegated to Razorpay, backend never touches it), webhook signature verification, order/wallet finalization idempotency and transaction safety, rider/kitchen order-claim atomicity, role-derivation-from-token discipline across the vast majority of routes (`admin.ts`, `customer.ts`, `finance.ts`, `support.ts`), and genuinely production-configured error tracking across all three apps.
