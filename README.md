# 3bdu.lifts

Workout and nutrition coaching app for Arabic-speaking online clients.
Next.js 16 · TypeScript · Tailwind 4 · Supabase (Postgres, auth, storage) · Recharts.

- Database schema and security rules: [supabase/migrations/0001_schema.sql](supabase/migrations/0001_schema.sql)
- Page map and build order: [docs/PAGE_MAP.md](docs/PAGE_MAP.md)

## Setup (cloud Supabase)

1. **Create a Supabase project** at supabase.com (the free tier is enough to start). Pick a region close to Oman, such as Mumbai or Frankfurt.
2. **Create the database.** In Supabase open *SQL Editor* and run each file in `supabase/migrations/` once, in number order (`0001_schema.sql` first, then the seed files).
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

## Deploy to Vercel

1. Put the project on GitHub (`git init`, commit, push to a private repository).
2. On vercel.com choose *Add New → Project* and import the repository. The defaults are correct.
3. Add the two environment variables (with the **cloud** project's values) under *Environment Variables*, then deploy.
4. In Supabase under *Authentication → URL Configuration*, set *Site URL* to your Vercel address so confirmation emails link back to the live app.

## How access is protected

- Every table has row-level security. A client can only read and write rows that carry their own user id; the coach can read everything. This is enforced by Postgres, not by the pages.
- Coach-only tables (private notes, testimonials) are invisible to clients.
- Progress photos sit in a private storage bucket, in a folder named after the client's user id.
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
