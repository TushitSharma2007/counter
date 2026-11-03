# Prompts for Claude Code, in order

Paste these one at a time. Don't move to the next until the current one works and you've reviewed it.
Start every new chat session with: *"Read CLAUDE.md and the docs/ folder before doing anything."*

---

## Stage 0: Setup
**0.1**
> Read CLAUDE.md and everything in docs/. Then give me a short summary of what we're building and list anything that's unclear or contradictory, before writing any code.

**0.2**
> Scaffold the monorepo exactly as in CLAUDE.md §3 (pnpm + Turborepo, apps/pos, apps/loyalty, packages/*, supabase/, tools/nfc-provisioner placeholder). Set up TypeScript strict, ESLint, Prettier, Vitest, and the pnpm scripts from §11. Connect to my Supabase project (I'll give you the URL and anon key in .env.local; never commit secrets). Show me the plan first.

---

## Stage 1: Foundation
**1.1 Design system**
> Build packages/ui per CLAUDE.md §9: tokens.css (light + designed dark), fonts, and the base components from §12 step 1. Make a /playground page in apps/pos showing every component. Take Playwright screenshots at phone/tablet/desktop and show me. I'll review the look before we continue.

**1.1b Loyalty rules engine (moved early: pure logic, no dependencies)**
> Build packages/loyalty-core: the rules engine + Zod schemas + all the test cases in LOYALTY_SPEC §7. No UI yet.

**1.2 Tenancy + auth**
> Milestone §12 steps 2–3: orgs, outlets, profiles, memberships with RLS + the tenant-isolation test, the seed (Demo Coffee Co., 3 Bhopal outlets), owner email login, cashier PIN on a registered device.

---

## Stage 2: POS MVP
**2.1** > Menu CRUD with variants, add-ons, per-outlet price overrides, GST per item (§5 item 2).
**2.2** > Billing screen (§5 item 3) with the offline outbox (§7). Include the "Loyalty number" field on the bill. Show me screenshots on a 10" tablet and on a phone early.
**2.3** > KDS (§5 item 4) with realtime.
**2.4** > Shifts + day close + Telegram day-close report (§5 item 5).
**2.5** > Live owner dashboard across outlets (§5 item 6).

---

## Stage 3: Loyalty (follow docs/LOYALTY_SPEC.md §10)
**3.1** > (Done in 1.1b.) Review packages/loyalty-core against any spec changes since then.
**3.2** > Loyalty schema + RLS + seed per LOYALTY_SPEC §8. Customer auth with Google + email OTP (custom SMTP via Resend free tier), /welcome, and the card page /c/:merchantSlug. Phone OTP stays behind a disabled flag.
**3.3** > Rotating QR: /display/:outletId, the stamp-intent + claim edge functions, the **stamp animation** (CLAUDE.md §6.5), and single-use links (LOYALTY_SPEC §5.1a) with the Playwright test. Show me a screen recording of the stamp animation on a phone viewport.
**3.4** > NFC pilot: stamp points (NFC basic), the counter-mirror verification, and stamp modes `staff_approval` + `bill_match` (LOYALTY_SPEC §5.3), including the live approval list on the POS and /display, and the customer's pending → stamped transition.
**3.5** > tools/nfc-provisioner, basic mode only: an ESP32 PlatformIO sketch for my **[RC522 / PN532 — fill in]** reader + the Node host script (`pnpm nfc:provision --mode basic --stamp-point <id>`, Windows COM ports), per NFC_STAMP_HARDWARE.md §3.1 and §3.3. Include the wiring diagram in a README.
**3.6** > Rewards + redeem screen + cashier confirm in the POS (the reward becomes a discount line).
**3.7** > Merchant console: live feed, approvals, customers, program editor with live card preview, stamp points, suspicious activity.

---

## Stage 4: Pilot
**4.1** > Deploy apps/pos and apps/loyalty to Cloudflare Pages (production + preview). Create a production Supabase project, run migrations, and set secrets. Give me a checklist of everything I need to click.
**4.2** > Create the real tenant for my client from this data: [paste menu/outlets/staff]. Set the loyalty program to: [their offer].

---

## Stage 5: After the pilot
**5.1** > NTAG 424 DNA: SUN verification in loyalty-core with the AN12196 test vectors, the provision-tag edge function, and the 424 mode in tools/nfc-provisioner (needs PN532 + ESP32). Follow every safety rule in NFC_STAMP_HARDWARE.md §3.3. Add --dry-run.
**5.2** > Switch outlets with 424 stamps to `automatic` mode.
**5.3 (later, once paying):** native app (Expo) + App Clip that reuse packages/loyalty-core.
