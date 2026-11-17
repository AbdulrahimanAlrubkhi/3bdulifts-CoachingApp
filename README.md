# 3bdu.lifts

Workout and nutrition coaching app for Arabic-speaking online clients.
Next.js 16 · TypeScript · Tailwind 4 · Supabase (Postgres, auth, storage) · Recharts.

- Database schema and security rules: [supabase/migrations/0001_schema.sql](supabase/migrations/0001_schema.sql)
- Page map and build order: [docs/PAGE_MAP.md](docs/PAGE_MAP.md)
- **Going live (Supabase + GitHub + Vercel): [docs/DEPLOY.md](docs/DEPLOY.md)**

## Setup (cloud Supabase)

1. **Create a Supabase project** at supabase.com (the free tier is enough to start). Pick a region close to Oman, such as Mumbai or Frankfurt.
2. **Create the database.** In Supabase open *SQL Editor* and run each file in `supabase/migrations/` once, in number order: `0001_schema.sql`, then `0002_seed_exercises.sql` (50 exercises) `0003_seed_foods.sql` (166 foods, values per 100 g) `0004_photos_owner_writes.sql` (progress photos: only the client can change them, the coach can view) `0005_training_days.sql` and `0006_leaderboard_oman_day.sql`.
3. **Add the keys.** Copy `.env.example` to `.env.local` and fill in the project URL and the anon (publishable) key from *Project Settings → API*.
4. **Run it.**

   ```bash
   npm install
   npm run dev
   ```

   Open http://localhost:3000.
5. **Make yourself the coach.** Sign up in the app with your own email, then run this once in the Supabase SQL editor:

   ```sql
   update profiles set role = 'coach'
   where id = (select id from auth.users where email = 'YOUR-EMAIL');
   ```

   Everyone else who signs up is a client. A client cannot change their own role; the database rejects it.

Optional: under *Authentication → Sign In / Providers → Email*, turn off "Confirm email" while testing so new accounts can sign in straight away. Turn it back on before real clients join.

## Local testing (Supabase in Docker)

For trying things without touching the cloud project. Needs Docker Desktop running.

```bash
npx supabase start -x studio,imgproxy,edge-runtime,logflare,vector,realtime,postgres-meta,supavisor
```

This starts a local database, applies everything in `supabase/migrations/`, and prints a local API URL and anon key for `.env.local`. `npx supabase db reset` wipes it and re-applies the migrations; `npx supabase stop` shuts it down.

## Deploy

Follow [docs/DEPLOY.md](docs/DEPLOY.md). It covers the Supabase project, pushing to GitHub, Vercel, sign-in email settings and making yourself the coach.

## How access is protected

- Every table has row-level security. A client can only read and write rows that carry their own user id; the coach can read everything. This is enforced by Postgres, not by the pages.
- Coach-only tables (private notes, testimonials) are invisible to clients.
- Progress photos sit in a private storage bucket, in a folder named after the client's user id. Only that client can add, replace or delete them; the coach can view them. They are shown through links that expire after an hour.
- Challenge leaderboards expose only a name, % weight change and consistency — never raw weights or photos.

## Project layout

```
supabase/migrations/   database schema, policies, seed data
src/proxy.ts           refreshes the session, sends signed-out visitors to /login
src/lib/auth.ts        requireProfile() / requireCoach() used by every page
src/lib/i18n/          Arabic and English text
src/app/(auth)/        sign in, sign up
src/app/(app)/         signed-in pages for client and coach
```

## Notes on the data

- Food values are typical averages. Home-cooked Gulf dishes (machboos, harees, saloona…) vary a lot by recipe; edit them in *Library → Foods* to match what your clients actually eat.
- Dashboard flags and their thresholds are in `FLAG_RULES` in `src/lib/coach-metrics.ts`: missed check-in (2+ days), weight stalled (cut/bulk clients whose 7-day average moved under 0.3 kg in two weeks), few workouts (under 60% of the days per week the client planned), low nutrition adherence (under 50% of the last 7 full days on target). Run `npm test` after changing them.
- Renewal reminders are in-app: the client sees a notice on Today inside the reminder window (7 days by default), and Business lists plans ending soon with a one-tap WhatsApp message for you to send. Nothing is sent automatically; that would need a WhatsApp Business or email provider.
- The PDF export is the printable report at `/report/<client id>`: use the Print button and choose "Save as PDF". Browsers shape Arabic text correctly; server-side PDF libraries mostly don't.
- Weeks start on Sunday (`WEEK_START_DAY` in `src/lib/dates.ts`).
- A day counts as "on target" for nutrition when calories are within 10% of target and protein reaches 90% of it (`nutritionStatus` in `src/lib/checkins.ts`).
- Days are counted in Oman time (Asia/Muscat), for every user, wherever the server runs. Change `APP_TZ` in `src/lib/dates.ts` if that ever needs to differ.
