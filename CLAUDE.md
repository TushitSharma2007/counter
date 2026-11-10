# CLAUDE.md — Multi-outlet Café POS + Loyalty Platform

> Working name: **Counter** (POS) and **Imprint** (Loyalty). Keep product names in one config file (`packages/config/brand.ts`) so they're easy to rename.

## 1. What we're building

A **Petpooja-style business management system** for food & beverage outlets. It starts with one client, a **coffee kiosk with multiple branches**, but it must be built as a **multi-tenant SaaS** from day one. Kiosk #1 is just tenant #1.

It has two products:

1. **POS / business management** (`apps/pos`): billing, menu, kitchen tickets, inventory, expenses, staff, shifts, day close and reports across branches. It updates **live** everywhere: an order billed at Branch A shows on the owner's phone dashboard within a second or two.
2. **Loyalty** (`apps/loyalty` + `packages/loyalty-core`): a digital stamp/points card. The customer **taps their phone on an NFC "stamp" kept in the café** (or scans a QR next to it), logs in once, and collects stamps with a signature stamp animation. Website/PWA first; a native app + App Clip come later. It **plugs into the POS**, but it is **also sold on its own** to cafés that use a different POS (or no POS).

It runs **on every device**: phones, tablets and PCs, as one responsive installable **PWA**. There are no app-store builds for now.

### Non-negotiables
- **Multi-tenant**: every row belongs to an `org_id`. No data leaks between tenants. This is enforced in the database (RLS), not just in the UI.
- **Multi-outlet**: one org has many outlets (branches). Menus, prices, stock, staff and reports can be per outlet or org-wide.
- **Offline-tolerant billing**: Indian kiosk internet drops. Billing must **never stop** because the network is down. Orders queue locally and sync when the network returns.
- **Live**: owner and manager dashboards, the kitchen display and the loyalty status update in realtime.
- **Free to run now, upgradeable later**: use only free tiers today. Every external service (DB, messaging, SMS, WhatsApp, payments, storage) sits behind an adapter, so it can be swapped for a paid provider without touching feature code.
- **Design quality**: it must look like a crafted product, not generic AI output. See §9.

---

## 2. Stack (all free tiers)

| Concern | Choice | Free tier notes | Upgrade path |
|---|---|---|---|
| Frontend | **React + TypeScript + Vite** (SPA, PWA) | n/a | n/a |
| Routing / data | TanStack Router + TanStack Query | n/a | n/a |
| Styling | Tailwind CSS v4 + our own component layer (Radix primitives underneath) | n/a | n/a |
| PWA / offline | `vite-plugin-pwa` (Workbox) + **Dexie** (IndexedDB) | n/a | n/a |
| Backend / DB | **Supabase** (Postgres, Auth, Realtime, Storage, Edge Functions) | 500 MB DB, 1 GB storage, 50k MAU, 200 concurrent realtime connections, 500k edge fn calls/mo. **Free projects pause after 7 days of no activity**, so the dev project needs a keep-alive. | Supabase Pro ($25/mo), or self-hosted Postgres. Data access goes through `packages/db` so it can be swapped. |
| Hosting | **Cloudflare Pages** (+ Pages Functions for the loyalty auth-cookie proxy) | Unlimited bandwidth. Commercial use allowed. | Same, or Workers Paid. (Do **not** use Vercel Hobby: its terms forbid commercial use.) |
| Validation | **Zod**, with schemas shared between client and edge functions | n/a | n/a |
| Owner alerts | **Telegram Bot API** (free) | n/a | WhatsApp Cloud API / MSG91 / Gupshup through `NotificationAdapter` |
| Customer messages | **Web Push (VAPID)**, free. On iOS this only works once the PWA is installed. | n/a | WhatsApp / SMS adapters |
| Payments | **UPI intent QR** (`upi://pay?pa=…&am=…&tn=…`) generated locally, free, with no gateway. Cashier confirms receipt manually. | n/a | Razorpay / Cashfree / PhonePe PG through `PaymentAdapter` for auto-confirmation |
| Customer login (loyalty) | Supabase Auth: **Google OAuth** (free) + **email OTP** through a free SMTP (Resend free tier or Brevo free tier) | n/a | **Phone OTP**: SMS via MSG91/Twilio (paid, and needs Indian DLT registration), behind `CustomerAuthAdapter` |
| Loyalty stamp (NFC) | **NFC tag inside a stamp-shaped object in the café.** The phone's OS reads the URL natively, so no app and no Web NFC are needed. Production: **NTAG 424 DNA with SUN** (unclonable, a new signed URL on every tap). Prototype: NTAG213/215. | n/a | n/a |
| Loyalty stamp (QR) | QR in the café that the customer scans with their phone camera: either a **rotating QR on a counter display** (recommended; tokens generated on the display, TOTP-style, no polling) or a printed static QR with stricter limits | n/a | n/a |
| Stamp link domain | A **short, dedicated domain** used only for tag/QR links (`https://<stamp-domain>/s/…` and `/q/…`). Set in `packages/config/brand.ts` (placeholder until bought). It is written into NFC tags, so it must never change; the main brand domain can. | n/a | n/a |
| QR scanning (in-app fallback) | Native `BarcodeDetector`, with `@zxing/browser` fallback (needed on iOS) | n/a | n/a |
| Stamp animation | Browser **Web Animations API** (`element.animate`) + SVG, plus `navigator.vibrate` haptics. No animation library: 0 KB, which keeps the loyalty card under its 120 KB budget. | n/a | n/a |
| Printing | Browser print with 58mm/80mm thermal CSS | n/a | ESC/POS through WebUSB/Web Bluetooth, or a small local print bridge |
| Charts | Recharts, or hand-built SVG for small sparklines | n/a | n/a |
| Monorepo | **pnpm workspaces + Turborepo** | n/a | n/a |
| Tests | Vitest (unit), Playwright (e2e) | n/a | n/a |
| Errors | Sentry free tier | n/a | n/a |

**Golden rule:** feature code never imports `@supabase/supabase-js`, a Telegram client or any vendor SDK directly. It calls our adapters in `packages/db`, `packages/notify` and `packages/payments`.

---

## 3. Repo layout

```
/
├─ apps/
│  ├─ pos/                 # Staff POS + owner/manager back office (one PWA, role-based UI)
│  └─ loyalty/             # Customer card PWA (no login wall) + standalone merchant console
├─ packages/
│  ├─ ui/                  # Design system: tokens, components, icons. The only place styles are defined.
│  ├─ db/                  # Supabase client, typed queries, repositories, offline outbox
│  ├─ pos-core/            # Pure TS bill totals, GST, cart (no React, no Supabase)
│  ├─ loyalty-core/        # Pure TS rules engine + stamp/QR/NFC verification (no React, no Supabase)
│  ├─ notify/              # NotificationAdapter: telegram | webpush | (later) whatsapp | sms
│  ├─ payments/            # PaymentAdapter: upi-intent | (later) razorpay | cashfree
│  ├─ config/              # Brand names, feature flags, plan limits, shared tsconfig/eslint
│  └─ types/               # Generated DB types (supabase gen types) + shared domain types
├─ supabase/
│  ├─ migrations/          # SQL migrations. The ONLY way schema changes.
│  ├─ functions/           # Edge functions (loyalty API, webhooks, scheduled jobs)
│  └─ seed.sql             # Demo tenant: "Demo Coffee Co." with 3 outlets, menu, staff
├─ docs/
│  ├─ LOYALTY_SPEC.md      # Full loyalty flow, screens, API, tables, security, pilot modes
│  ├─ NFC_STAMP_HARDWARE.md# Tags, the stamp object, programming (ESP32), placement
│  └─ PROMPTS.md           # The order of work, as prompts (for the human)
├─ tools/
│  └─ nfc-provisioner/     # ESP32 sketch (PlatformIO) + Node host script to write/provision tags
└─ CLAUDE.md
```

The loyalty product must be deployable **without** `apps/pos`. `packages/loyalty-core` must not import anything from POS code.

---

## 4. Tenancy, roles and auth

```
org (tenant / business)
 └─ outlet (branch / kiosk)         many per org
     └─ device (registered tablet/PC/phone at the counter)
user ── membership(org_id, role, outlet_ids[])
```

- **Roles:** `owner`, `manager`, `cashier`, `kitchen`, `loyalty_staff` (loyalty-only tenants).
- Owners see all outlets. Managers and cashiers see only the outlets assigned to them.
- **Staff login:** email/phone + password for owners and managers. Cashiers use a **4–6 digit PIN on a registered device** for fast switching at the counter. A shared kiosk tablet must never stay logged in as the owner.
  - Supabase Auth has no PIN login, so an edge function (`auth-pin`) verifies *registered device token + PIN* and issues that cashier's session.
  - A registered device caches the bcrypt PIN hashes of the PIN staff at **its own outlet** (via `device_roster`), so cashiers can **switch while offline**, with a local 5-try lockout. Accepted trade-off: someone with the device and dev tools could brute-force a PIN offline; server logins still lock out after 5 tries, and revoking the device cuts it off. Bills queued offline are attributed to the cashier and sync once the session refreshes.
  - Owners never sign in with a PIN, so a shared counter device can never hold an owner session.
- **Owners and managers on their own phone:** after email sign-in they land on **My outlets** and can bill at any outlet they have access to. The first time at an outlet, the phone gets its own *personal* device row and code there (`devices.kind = personal`, no secret: their own session proves who is billing), so its bill series never clashes with that outlet's counter tablet. Personal devices can never be used for PIN sign-in. Shared counter tablets (`kind = counter`) stay fixed to one outlet.
- **Every merchant gets an org.** A loyalty-only (standalone) merchant is an `orgs` row with POS modules switched off in `feature_flags`. There is one tenancy and RLS model; `loyalty.merchants.org_id` is never NULL.
- **Customer identity (loyalty):** customers log in with **Google** or **email OTP** (both free), and we also collect their phone number on their profile. **Phone OTP login** is wired through `CustomerAuthAdapter` but switched off until we pay for SMS. Sessions are long-lived (≈1 year, refreshed silently), so a regular customer logs in once and only taps after that. Full flow: `docs/LOYALTY_SPEC.md`.
  - The session is kept in a **server-set httpOnly cookie on our own domain** (a Cloudflare Pages Function proxies Supabase auth), not in `localStorage`. Safari deletes script-written storage after 7 days without a visit, and NFC taps on iPhone open Safari rather than the installed PWA.
  - Web Push on iOS only works in the installed PWA; treat it as a bonus channel, never the only one.
- **Every table** has `org_id` plus an RLS policy based on the `memberships` table. Outlet-scoped tables also have `outlet_id` and check the outlet list. Write RLS policies in the same migration that creates the table. Add a test that tenant A cannot read tenant B.
- Use `plan` and `feature_flags` on `org` to gate modules (e.g. `inventory`, `kds`, `loyalty`, `multi_outlet`), so plans can be sold later.

---

## 5. POS modules (build in this order)

### Phase 1: sellable MVP for the kiosk
1. **Org/outlet setup + staff** (roles, PINs, device registration).
2. **Menu**: categories, items, **variants** (size: S/M/L), **add-ons/modifiers** (extra shot, oat milk), per-outlet price overrides and availability toggles, item images, tax (GST) slab per item, veg/non-veg/egg mark.
3. **Billing screen** (the most important screen in the product):
   - Category rail + item grid, built for **one-handed tablet use**.
   - Cart with modifiers, qty, notes, item- and bill-level discounts (role-limited).
   - Order types: counter / takeaway / dine-in (table optional) / delivery (manual).
   - Payments: cash (change calculation), UPI (dynamic QR shown **full-screen on the same tablet**, turned toward the customer; no separate customer-facing screen assumed), card (manual), **split payment**, due/credit (customer khata).
   - Attach a customer by phone, which auto-links their loyalty card (§6). The cashier sees the cardholder's **name** before confirming.
   - Print / share the bill: browser print with **58 mm and 80 mm** layouts (ESC/POS over Bluetooth/USB later), WhatsApp share link through `wa.me` (free).
   - Hold/park orders, reprint, void with a reason (manager PIN).
4. **KOT / kitchen display (KDS)**: realtime order queue per outlet with statuses `new → preparing → ready → served`, sound cue and bump-bar style big buttons.
5. **Shifts & day close**: opening cash, cash in/out, expected vs counted cash, payment-mode split. The day-close report goes to the owner on Telegram.
6. **Live owner dashboard**: today's sales across outlets, orders per hour, top items, payment mix, outlet comparison. Updates live.

### Phase 2
7. **Inventory**: raw materials, units (g/ml/pcs), **recipes** (1 latte = 18 g beans + 200 ml milk + 1 cup), auto stock deduction when an order is settled, purchases/GRN, vendor list, wastage, low-stock alerts, branch-to-branch transfers.
8. **Expenses** and a simple **P&L** per outlet and per org.
9. **Reports**: sales by item/category/outlet/staff/hour, discounts, voids, taxes (GST summary), CSV/PDF export.
10. **Customer CRM**: visit history, spend, last visit, segments (new / regular / lapsed).

### Phase 3 (paid integrations, once there's revenue)
11. Zomato/Swiggy order sync, payment-gateway auto-confirm, WhatsApp campaigns, e-invoicing, multi-brand (one org, several brands).

---

## 6. Loyalty system (integrated AND standalone)

> **The full loyalty spec is in `docs/LOYALTY_SPEC.md`. Read it before touching anything loyalty-related.** The hardware side is in `docs/NFC_STAMP_HARDWARE.md`. This section is the summary.

### 6.1 Concept
The customer has **one digital card per merchant**, a PWA page at `/c/:merchantSlug`. It shows stamps or points, progress to the next reward, unlocked rewards and outlet info. The customer **does not install an app**. They can "Add to Home Screen", and they get Web Push if they allow it.

### 6.2 How a customer gets stamped (customer-driven; the cashier does nothing)
1. **In the café there is a physical "stamp"**: a stamp-shaped object with an **NFC tag inside**. Next to it is a **QR code** for phones without NFC.
2. The customer **taps their phone on the stamp** (or scans the QR with the camera). The phone OS opens our link, e.g. `https://<domain>/s/<outletTagId>?picc=…&cmac=…` for NFC or `https://<domain>/q/<token>` for QR.
3. **First time:** a branded landing page → **log in with Google or email OTP** (phone OTP later) → short profile (name, phone, optional birthday) → the stamp is applied. The pending stamp token is held server-side for 5 minutes, so logging in doesn't lose the stamp.
   **Returning customer:** already logged in, so the stamp is applied instantly.
4. The server verifies the tap/scan, runs the rules engine and records the stamp. The customer sees the **stamp animation** (§6.5): the ink stamp presses down onto their card, with a haptic thump, then progress updates ("3 more for a free coffee").
5. If a reward unlocks, a reward-unlocked moment shows. They redeem it at the counter by showing a **redeem screen**: a one-time code + QR that the cashier confirms in the POS or merchant console.

### 6.3 Making a static stamp safe (this is critical)
Anyone can photograph a printed QR or copy a basic NFC tag's URL and stamp themselves from home. So:
- **NFC in production uses NTAG 424 DNA tags with SUN/SDM**. Each tap generates a fresh URL containing an encrypted tap counter + CMAC. The server verifies the CMAC with the tag's AES key and **rejects any counter it has already seen**. A copied URL is useless.
- **The QR, recommended mode: a rotating QR** shown on a counter display (a spare phone/tablet running `/display/:outletId`, or the POS tablet). It is an HMAC-signed token that changes every 20–30 s and works once per customer. The display generates tokens **locally, TOTP-style**, from a revocable per-display secret scoped to one stamp point; the server verifies them without any polling (polling an edge function would use ~50k calls per outlet per month).
- **The QR, fallback mode: a printed static QR.** This is allowed, but those stamps go into a **"pending" state that staff approve** on the POS/merchant console with one tap (realtime), **or** they only count if a POS bill exists for that customer within the last X minutes (integrated mode).
- **Always enforced (server-side):** login required; one stamp per customer per outlet per cooldown window (configurable, default 2 h); daily cap; stamp tokens are single-use; every stamp is logged with method, outlet, device fingerprint and IP for the owner's anomaly view.
- **Pilot mode (basic NTAG215 tags):** the tag's built-in UID + tap-counter mirror makes every tap URL different, and the server rejects reused counters. The tag writes UID and counter as **one combined block** (`?t=<token>&m=<14-hex UID>x<6-hex counter>`), not as separate params. Because that counter isn't signed, basic stamps also need **bill match** (café uses our POS) **or staff approval** (no POS). After the pilot, switch to NTAG 424 tags and **Automatic** mode. See `docs/LOYALTY_SPEC.md` §5.3.
- **Single-use links:** reopening a stamp link from history, refreshing, or pressing back never gives another stamp (`docs/LOYALTY_SPEC.md` §5.1a).

### 6.4 Configurable rules engine (`packages/loyalty-core`)
Rules are **data, not code**. They are stored as JSON on `loyalty_programs` and validated with Zod. A pure function `evaluate(program, cardState, event) → { stampsAdded, pointsAdded, rewardsUnlocked, reasons[] }` handles everything and is unit-tested heavily.

The merchant must be able to configure, from a friendly UI (not a JSON editor):
- **Program type:** stamp card (visits) | points (₹ spend → points) | hybrid.
- **Stamps needed for a reward** (e.g. 9), with **multiple reward tiers** (5 stamps → free cookie, 10 → free coffee).
- **What earns a stamp:** any purchase | minimum bill ₹X | specific items/categories (e.g. only coffees) | 1 stamp per qualifying item vs per visit.
- **Limits:** max stamps per day (caps **stamps**, not visits), cooldown minutes, which outlets participate.
- **Card reset:** when the final tier resets the card, extra stamps **carry over** to the new card.
- **Rewards:** free item (pick from menu), % off, ₹ off, BOGO. Each has a validity (days) and is single-use.
- **Expiry:** stamps expire after N days of inactivity (optional).
- **Bonus rules:** double stamps on certain days/hours, birthday reward, welcome stamp on sign-up, referral stamp.
- **Card design:** logo, colours, stamp icon and card name, applied to the customer card page (per-merchant theming via CSS variables).

Show a **live preview** of the customer card while the merchant edits the rules.

### 6.5 The stamp animation (signature moment; polish this)
It should feel like a real rubber stamp hitting paper: the stamp drops in with a slight overshoot, the card squashes ~2%, an **ink impression spreads** (SVG mask with a slightly uneven, textured edge, not a perfect circle), and the stamp lifts away leaving the mark in the next empty slot. Add a short haptic (`navigator.vibrate([12, 40, 18])`) and an optional soft "thunk" sound (off by default). Total ≈ 900 ms, then the progress counter ticks. (This is the **one exception** to the 200 ms motion rule in §9.) Under `prefers-reduced-motion`, use a simple fade-in of the mark. Each merchant's stamp icon and ink colour come from their card design. **No confetti.** A reward unlock gets its own, slightly bigger moment.

### 6.6 Integration vs standalone
- **Standalone merchants** use the loyalty merchant console (`apps/loyalty/merchant`): live stamp feed, approve pending stamps, confirm redemptions, manage stamps/tags and QR displays, customer list, and campaigns (Web Push now, WhatsApp later).
- **POS merchants** get the same features inside the POS. The POS talks to loyalty **only through the loyalty API** (edge functions under `supabase/functions/loyalty-*`) with typed calls in `packages/loyalty-core/client.ts`. It never writes loyalty tables directly. That keeps the loyalty product separable later (its own project/DB if needed).
- Loyalty emits events (`stamp.added`, `reward.unlocked`, `reward.redeemed`) to the `loyalty.events` table. Outbound webhooks are a Phase 2 feature so third-party POS systems can integrate.
- Redeeming a reward in the POS applies it as a discount line on the bill and marks it used, atomically.

---

## 7. Data and sync rules

- **Money is integer paise** (`bigint`), never floats. Format with `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`.
- **IDs are UUIDv7 generated on the client**, so offline-created orders keep stable IDs.
- **Bill numbers:** per **registered device**, per financial year, gapless and human-readable (`BR1-T2/2526/000123` = outlet BR1, tablet T2). They are assigned **locally at billing time**, even offline, so the printed number is final (GST requires the serial number at issue). The server enforces uniqueness and flags gaps; a device's series is never reused if the device is re-registered.
- **Timestamps:** `timestamptz` in UTC. Display in `Asia/Kolkata`. A "business day" can end after midnight (configurable day-close hour).
- **Offline outbox (`packages/db/outbox`):** writes go to Dexie first → background sync pushes them through an idempotent RPC (`upsert_order(payload, client_id)`). Orders, payments and stock movements are **append-only events**, so conflicts are rare. Menu and prices are server-authoritative and cached for offline use.
- **Realtime:** Supabase Realtime `postgres_changes` filtered by `outlet_id` (KDS, pending loyalty approvals) or `org_id` (owner dashboard). Unsubscribe on unmount. Keep channel counts low (free tier limit: 200 concurrent connections).
- **Sync status is always visible:** a small indicator showing "Live" / "Offline – 3 bills queued" / "Syncing…".
- **Migrations only:** never change the schema in the dashboard. Run `supabase gen types` after every migration.
- **Audit log** for voids, discounts above a threshold, price changes, stock adjustments and loyalty manual adjustments.

### Core tables (starting point; refine as you build)
`orgs, outlets, devices, profiles, memberships, categories, items, item_variants, modifier_groups, modifiers, item_outlet_overrides, tax_rates, customers, orders, order_items, order_item_modifiers, payments, shifts, cash_movements, kots, raw_materials, recipes, stock_movements, purchases, vendors, expenses, audit_log`

Loyalty (own `loyalty` schema): `loyalty.merchants, loyalty.outlets, loyalty.customers, loyalty.programs, loyalty.cards, loyalty.stamp_points (NFC stamps + QR codes/displays per outlet), loyalty.tag_keys (encrypted AES keys + display secrets, server-only), loyalty.stamp_intents (single-use, short-lived), loyalty.stamps, loyalty.rewards, loyalty.events, loyalty.push_subscriptions`. **`docs/LOYALTY_SPEC.md` §8 is the source of truth** for loyalty table names and columns.

`loyalty.merchants.org_id` is always set: standalone merchants get an org with POS modules switched off (§4).

**Phone numbers:** one phone number can belong to only one cardholder per merchant (enforced when a card is created or a phone is changed). Phone changes are logged and shown in the suspicious-activity view.

**Backups:** the free tier has no usable backups, so a nightly GitHub Action runs `pg_dump` of production to private storage.

---

## 8. Devices and responsiveness

Design each screen for its **primary device first**, then adapt:

| Screen | Primary device | Notes |
|---|---|---|
| Billing | 10" tablet, landscape | Also works on a phone (bottom-sheet cart) and on a PC with keyboard shortcuts (`/` search, `Enter` pay, number keys for qty) |
| KDS | Tablet / TV | Huge type, high contrast, readable at 2 m |
| Owner dashboard | Phone | The owner checks it on the go; thumb-friendly |
| Back office (menu, inventory, reports) | PC/laptop | Dense tables, bulk edit, keyboard navigation |
| Customer loyalty card | Phone | Loads in under 1.5 s on a 4G budget Android phone; **first-route JS under 120 KB gzipped** (checked in CI). The QR scanner, redeem screen and merchant console are lazy-loaded. |

- Touch targets ≥ 48px on POS screens. No hover-only interactions.
- Test on low-end Android (4 GB RAM, Chrome) as the baseline, not on a MacBook.
- Use `navigator.wakeLock` on POS/KDS so screens don't sleep.

---

## 9. Design direction — must NOT look like AI slop

The product should feel like a **well-made tool for a busy counter**: calm, warm, fast and confident. Think of a good ledger book crossed with a specialty coffee bar, not a SaaS landing-page template.

**Do:**
- Define design tokens in `packages/ui/tokens.css` (colour, type scale, spacing, radius, shadow, motion) and use **only tokens** everywhere.
- **Type:** a characterful but legible pairing, e.g. a grotesk for the UI (*Geist*, *Inter Tight* or *Manrope*) plus a distinctive display face for numbers and headings (*Fraunces*, *Instrument Serif* or *Space Grotesk*). Use `font-variant-numeric: tabular-nums` for every price, quantity and total.
- **Colour:** a warm neutral base (paper/off-white and deep espresso brown-black) with **one** confident accent per tenant. Use semantic colours only for state (paid, pending, void, low stock). The dark mode for KDS/night shifts is designed deliberately, not inverted.
- **Hierarchy through layout and type weight**, not boxes. Use fewer cards, more alignment, real whitespace and hairline dividers.
- **Micro-interactions with purpose:** an item-added tick, a satisfying "stamp" press animation on the loyalty card (an ink-stamp feel), and number tickers on the dashboard. Keep motion under 200 ms and respect `prefers-reduced-motion`.
- Use a **real icon set** (Lucide or Phosphor) consistently at one stroke weight.
- Empty states should say something useful and give a next action ("No items yet. Add your first drink").
- Copy is short, human and Indian-English friendly ("Bill paid", "Day closed"). Use ₹ and lakh/crore formatting. Hindi labels can be added later through i18n keys from day one.

**Don't:**
- Purple/blue gradients, glassmorphism, glowing blobs, or gradient text.
- Emoji **anywhere** (icons, copy, error messages, notifications), or confetti.
- Default shadcn look, stock-template look or identical rounded-2xl cards with drop shadows everywhere.
- Generic hero-style headers inside an app, or "Welcome back! 👋" banners.
- Centred everything, giant padding on data screens, or tiny grey text on grey.
- Lorem ipsum. Use realistic Indian café data in seeds (Cold Coffee, Hazelnut Latte, Masala Chai, Veg Puff, ₹149, Bhopal outlets).

Before calling any UI done, screenshot it at phone, tablet and desktop sizes (Playwright) and review it against this section.

---

## 10. Free-tier guardrails

- Keep realtime subscriptions minimal and scoped. Aggregate dashboard numbers through Postgres views/RPCs, not by streaming every row.
- Paginate everything. No unbounded `select *`.
- Compress images on upload (client-side, WebP, max 800px) before they reach Storage.
- Archive or roll up old order data into daily summary tables (`daily_outlet_sales`) so reports stay fast and the DB stays under 500 MB longer.
- Add a cheap scheduled keep-alive (GitHub Actions cron hitting a health RPC) for **non-production** Supabase projects that would otherwise pause.
- Track usage per org (`orgs.usage`) so we know when a tenant needs a paid plan.

---

## 11. How to work in this repo (instructions for Claude Code)

- **Plan before building** each module: list the tables, RLS, API/RPCs, screens and edge cases, then implement.
- **Make targeted edits.** Don't rewrite whole files I've touched; preserve my manual changes. When unsure whether I edited something, ask.
- **TypeScript strict.** No `any`. Zod at every boundary (forms, RPC inputs, edge functions, loyalty rules).
- **Business logic lives in pure functions** (`packages/*/src/logic`) with Vitest tests: bill totals, tax, discounts, rounding, split payments, loyalty `evaluate()`, NFC counter/SUN verification, QR token signing, stock deduction.
- **GST math:** support tax-inclusive and tax-exclusive pricing per org (**inclusive by default**). Round per line or per bill (configurable). Org setting `gst_scheme`: `regular` (tax invoice with CGST/SGST lines) or `composition` (bill of supply, no tax lines). GSTIN is an org setting.
- **Shared packages run on Deno too:** `loyalty-core`, `config` and the Zod schemas are pure ESM with no Node-only imports, so edge functions import them through the functions' import map.
- **Every migration** includes RLS policies, indexes on `org_id`/`outlet_id`/`created_at`, and a test.
- **No vendor SDK in feature code**; go through adapters (§2).
- **No secrets in the client.** HMAC keys for QR/NFC tokens, the Telegram bot token and VAPID private keys live in Supabase secrets / edge functions only.
- Commit in small, working steps with clear messages. Run `pnpm lint && pnpm typecheck && pnpm test` before saying something is done.
- If a requirement here conflicts with reality (an API limit, a browser support gap), **tell me and propose an alternative** instead of quietly working around it.

### Commands (set these up first)
```
pnpm i
pnpm dev              # all apps
pnpm dev --filter pos
pnpm dev --filter loyalty
pnpm db:start         # supabase start (local)
pnpm db:migrate       # supabase migration up
pnpm db:types         # supabase gen types typescript --local > packages/types/db.ts
pnpm test / pnpm e2e / pnpm lint / pnpm typecheck
pnpm nfc:provision --mode basic|424 --stamp-point <id>
```

Development happens on **Windows** (PowerShell / Git Bash). Scripts must be cross-platform: no bash-only npm scripts.

---

## 12. First milestone (start here)

1. Scaffold the monorepo, tokens and a base component set in `packages/ui` (Button, Input, Sheet, Dialog, Tabs, Table, Toast, NumberPad, PriceTag, StatusPill, SyncIndicator).
1b. `packages/loyalty-core` rules engine + tests (pure logic, no dependencies, so it is built early).
2. Supabase: `orgs`, `outlets`, `profiles`, `memberships` + RLS + seed of "Demo Coffee Co." with 3 Bhopal outlets.
3. Auth (owner email login + cashier PIN on a registered device).
4. Menu CRUD with variants and add-ons.
5. Billing screen with cash/UPI QR/split payment, offline outbox and print.
6. Realtime owner dashboard across outlets.
7. Loyalty, following the build order in `docs/LOYALTY_SPEC.md` §10: rules engine → customer login + card page → rotating-QR stamping + stamp animation → NFC stamp (NTAG213 prototype, then NTAG 424 DNA SUN) → redemption → merchant console.

Show me the billing screen and the customer loyalty card **early** (after the first rough version) so I can review the design before building further.

---

## 13. Decisions log

Decided 2026-11-04, after the first doc review. The sections above already reflect these; this is the "why" in one place.

| Decision | Why |
|---|---|
| Customer session in an httpOnly cookie via a Pages Function | Safari deletes `localStorage` after 7 days without a visit; NFC taps on iPhone open Safari, not the PWA |
| Bill numbers per device, assigned locally (`BR1-T2/2526/000123`) | GST needs the final serial number on the printed bill, even offline |
| One phone per cardholder per merchant; cashier sees the name | Phone isn't verified (no SMS OTP yet), so bill match could be abused |
| NTAG21x mirror as one `m=<UID>x<counter>` param | That's the only layout the tag can produce with both mirrors on |
| Rotating QR generated on the display (TOTP-style) | Polling an edge function costs ~50k calls/outlet/month on a 500k free tier |
| Cashier PIN through an edge function + offline PIN hashes | Supabase Auth has no PIN login; switching must work offline |
| Every merchant gets an org | One tenancy + RLS model for POS and standalone loyalty |
| Nightly `pg_dump` via GitHub Actions | Free tier has no usable backups |
| Loyalty first route ≤ 120 KB gzipped, CI-checked | Budget Android on 4G |
| Shared packages are pure ESM | Edge functions run on Deno |
| `maxPerDay` caps stamps; stamps carry over on card reset | Product decision |
| GST: `regular` or `composition` per org; prices inclusive by default | Client's registration not confirmed yet |
| UPI QR full-screen on the counter tablet; 58/80 mm browser print | Assumed hardware until the client confirms |
| `loyalty-core` built right after the design system | Pure logic, no dependencies |
| Stamp animation uses the Web Animations API, not `motion` | React + router already use ~100 KB of the 120 KB card budget |
| POS screens follow a Petpooja-like working layout (not copied): dark top bar, category rail, item grid, bill panel | Owner feedback: the first UI was too calm and editorial for a busy counter |
| Staff PINs are exactly 4 digits; the pad signs in on the 4th digit | One tap less on every staff switch |
| Bill maths and the cart live in `packages/pos-core` (pure, tested, Deno-safe) | Totals must be exactly right and shared with edge functions |
| An owner's own phone is also a counter at whichever outlet they are at (personal devices) | Owner request: walk into any outlet, sign in once, bill from the phone |
| Menu: everyone reads, only owners change items and prices, managers set sold out / outlet prices at their outlets; items and categories are switched off, never deleted | Cashiers bill from it; past bills keep their history |
| Menu tables use composite foreign keys `(id, org_id)` | The database itself stops a row pointing at another tenant's data |
| Counter tablets are added with a one-time 8-character pairing code (10 minutes, single use); the owner's password never goes on a tablet | Owner signs in on their own phone, types nothing secret on shared hardware |
| Only owners add, edit or switch off staff; managers reset PINs of cashiers and kitchen staff at their own outlets and pair/revoke tablets there | Least privilege; managers run the floor, owners run the business |
| New staff logins come from the `staff-create` edge function, which then calls `add_staff` as the owner; PIN-only staff get an unmailable `@staff.invalid` address | Only the server can create logins, but the database still decides who may add staff |
| Short dedicated stamp-link domain for `/s/` and `/q/` only | It's baked into tags; the brand domain can change |

**Still open:** kiosk GSTIN, stamp-link domain (placeholder in config), NFC reader model (RC522 or PN532).
