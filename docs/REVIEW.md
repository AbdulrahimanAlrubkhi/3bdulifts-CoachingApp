# Pilot-readiness review — 3bdu.lifts

Branch `review/pilot-readiness` (from `main` at `e45943a`), November 2026. Local only; not pushed or deployed.

## Verdict

**Ready for a 3–5 client pilot once three things outside the code are done:** (1) deploy to Supabase + Vercel with migrations `0001`–`0007`, (2) configure a real email (SMTP) provider, (3) run the smoke test in `DEPLOY.md` §1.5 on a real iPhone and a real Android phone. Until those happen, nothing here has been verified in production or on real devices.

## Deployment status (verified)

- GitHub `main` = `e45943a` (the previous work). This branch adds 11 commits and is **not pushed**.
- Production: **not verified** — no Vercel address or hosted Supabase project was available to check. Treat the app as not live.

## Feature inventory

| Area | State |
|---|---|
| Workouts (library, routines, assign, share link, live logging, history, PRs, charts) | Implemented; live logging reworked for reliability |
| Nutrition (targets with phase history, food DB, food log, quick add, meal plans, weekly averages) | Implemented; adherence rules corrected |
| Check-ins (daily with auto training/nutrition, weekly measurements, reflections, photos) | Implemented; photo upload hardened |
| Coach (onboarding, dashboard flags, client detail, notes, weekly feedback) | Implemented; invitations + archiving added |
| Business (subscriptions, challenges, wins, CSV + printable report) | Implemented; consent and CSV safety added |
| Auth (sign-up, login, logout, password reset, email-link landing) | Implemented; sign-up now invitation-only |
| Missing by design | Automatic reminder delivery (WhatsApp/email), push notifications, in-app messaging, payments |

## Findings and fixes (severity before the fix)

| # | Severity | Finding | Fix | Verified by |
|---|---|---|---|---|
| 1 | Critical | **Anyone could create an account** with the public key, appear on the coach dashboard and upload files. | Invitation-only sign-up enforced in the database (`0007`); coach invite UI. | DB suite; browser (refused, then allowed after invite) |
| 2 | High | **Photo uploads unrestricted** by direct API: any size, any file type (e.g. HTML), any path. | Bucket: JPEG only, 5 MB max; storage policy allows only `<user>/<date>/<front|side|back>.jpg`; client-side type/size checks with clear messages. | DB suite (6 photo attacks) |
| 3 | High | **Typed workout numbers could be lost**: saved only when a field lost focus; refresh, locking the phone or a dropped connection lost them silently; no save indicator. | Autosave ~0.6 s after typing, retry with back-off, copy kept on the phone and restored after reopen, "Saving / Saved / Not saved yet" line, Finish refuses until everything is stored. | Browser: refresh, simulated offline, reconnect, reopen-while-offline |
| 4 | High | **Duplicates from repeated taps/retries**: two live workouts, two sets in one slot, a meal option logged twice. | Unique indexes (one unfinished workout per person, one set per slot); tap guards; meal option checks before logging; Start opens the running workout. | DB suite; browser (3 taps → 1 set) |
| 5 | High | **Marketing consent was a coach checkbox.** | Client-given, per scope (numbers/photos/quote), exact wording + version + language + timestamp stored, withdrawal, coach sees status and withdrawals; old column ignored. | DB suite (coach can't give/withdraw; wording can't be edited); browser |
| 6 | High | **Unlogged days counted as missed nutrition targets**, producing false "low adherence" flags. | Adherence = on-target share of *logged* days (needs ≥3); separate "rarely logs food" flag; screens show "x/7 days logged". | Unit tests |
| 7 | Medium | 2,201 kcal vs a 2,000 target counted as "on target" (rounding before comparing). | Compare exact ratios. | Unit test |
| 8 | Medium | CSV export open to **spreadsheet formula injection** from client-typed text. | Cells starting with `= + - @` tab/CR are prefixed with `'`; numbers and dates untouched. | Unit test |
| 9 | Medium | Private photo links valid for 1 hour. | 10 minutes. | Code |
| 10 | Medium | Challenge default ranked by weight change (unsuitable for mixed goals). | Consistency is the default; weight ranking optional with its calculation explained. | Browser (earlier), code |
| 11 | Medium | No error pages or diagnosable logging. | Friendly bilingual error/not-found pages with a reference code; `logError` logs codes only, never client data. | Code |
| 12 | Medium | A workout left open for hours recorded a 6-hour duration. | Ends 5 min after the last logged set when open > 3 h. | Found in browser; code |
| 13 | Medium | Seed food values have no per-item source; mixed dishes vary by recipe. | 58 foods flagged **≈ estimate** in the UI and the coach can toggle it. Values **not** individually verified against a source. | Fresh DB check |
| 14 | Medium | Deleting a client leaves their photo files in storage. | Documented manual step (`DEPLOY.md` §4.2). Not automated. | — |
| 15 | Low | Invite/feedback buttons squashed the input on phones. | Text-sized button style. | Browser 360 px |
| 16 | Low | New client's Today showed a wall of zeros. | Next-step message instead. | Browser |
| 17 | Low | Arabic search required exact spelling (أ/ا, ة/ه, ى/ي). | Forgiving search for foods and exercises. | Unit tests |
| — | OK | No privileged key in code, config or git history; only the public key reaches the browser. | — | git history search |
| — | OK | RLS on every table; role escalation blocked; coach-only notes/business records hidden; leaderboard exposes only name/%/consistency. | — | DB suite |

## Tests run (all local)

| Command | Result |
|---|---|
| `npm run lint` | 0 problems |
| `npx tsc --noEmit` | 0 errors |
| `npm test` (metrics + calculations: dates/Oman midnight/week & month & year boundaries, units, portions, adherence, 1RM/PRs, subscriptions month-ends, CSV, search) | 20/20 + 55/55 pass |
| `npm run test:db` (coach, Client A, Client B, signed-out visitor against real local Postgres + Storage: reads, inserts, updates, deletes, role escalation, invites, photos, duplicates, history preservation, consent) | 94/94 pass |
| Production build (`NEXT_DIST_DIR=.next-check npm run build`) | pass |
| Fresh database from migrations `0001`–`0007` (`supabase db reset`) | pass: 166 foods, 50 exercises, 55 policies |
| Restore drill: back up data + photos → wipe → rebuild → restore | all 13 row counts identical; restored client signs in and opens own photo; DB suite 94/94 on the rebuilt DB |

### Browser journeys (simulated phone viewports in the in-app Chromium; **no real devices**)

| Journey | Result |
|---|---|
| Coach invites a client; uninvited sign-up refused; invited sign-up → questionnaire → Today (360 px, 390 px; Arabic + English) | Pass |
| Client logs sets, refreshes midway, values persist; simulated offline → honest "not saved yet"; reconnect → saved; reopen while offline → restored and saved; finish → history | Pass |
| Repeated taps on Add set | Pass (one set) |
| Client gives and withdraws photo-publishing consent | Pass |
| Photo another client cannot access; exports only for coach; password reset | Pass at API/DB level this round; browser-verified in the previous round, code unchanged since |

## Not tested / remaining

- **Real iPhone (Safari) and Android (Chrome)**: HEIC photos, camera roll upload, keyboard covering fields, autosave when the OS kills the tab.
- **Email confirmation with confirmations ON** and **session expiry** (local setup has confirmations off; sessions refresh via the proxy but expiry wasn't forced).
- **Two tabs editing the same set**: last save wins per set; not tested.
- **Automated browser tests (Playwright)**: not added — the journeys above were driven manually. Recommended next step once CI exists.
- Restore into a **hosted** project; Sentry not installed; seed foods not source-verified.

## UX recommendations (from walking through as a client and as the coach)

Done in this branch: save-status line, empty-state guidance, forgiving Arabic search, clearer photo errors, consent page in plain words.

Next, in order of impact for a pilot:
1. **Today as a 3-item checklist** (train · log food · check in) with ticks — clients should know in one glance what's left today.
2. **Recent and frequent foods first** in Add food, plus "copy yesterday's breakfast" — logging speed decides whether people keep logging.
3. **Keep sign-up fields after an error** (currently the form empties).
4. **Coach inbox**: new check-ins, unread reflections, questions for the coach, renewals — one list instead of opening each client.
5. **Add to Home Screen** (web app manifest + icon) so it opens like an app, full-screen.
6. Bigger tap target for deleting a set (the set number is small), and an "unfinished workout from yesterday — finish or discard?" prompt.
7. Reminders: start with your manual WhatsApp messages; automate only after the pilot shows when people forget.
