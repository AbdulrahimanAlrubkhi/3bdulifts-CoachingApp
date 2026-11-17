# Deploying 3bdu.lifts

Three accounts, about 30–45 minutes the first time: **Supabase** (database, sign-in, photos), **GitHub** (holds the code), **Vercel** (runs the website). Do the steps in order; each one needs something from the one before.

## 1. Supabase project

1. On supabase.com create a new project. Pick the region closest to Oman that's offered (Mumbai is usually closest). Save the database password in your password manager — you won't see it again.
2. **Create the database.** Either:
   - **SQL Editor:** open *SQL Editor*, paste each file from `supabase/migrations/` and run it, one at a time, in number order (`0001` … `0006`). Each should finish with "Success. No rows returned".
   - **or the command line**, from the project folder:

     ```bash
     npx supabase login
     ```

     ```bash
     npx supabase link --project-ref YOUR-PROJECT-REF
     ```

     ```bash
     npx supabase db push
     ```

     (`link` asks for the database password from step 1.)
3. **Keys.** *Project Settings → API*: copy the **Project URL** and the **anon / publishable key**. These two go into Vercel in step 3. Never use the `service_role` / secret key anywhere in this app.

## 2. GitHub repository

1. On github.com create a new **private** repository named `3bdu-lifts-app`. Leave it empty (no README, no .gitignore).
2. Push the code (Windows asks you to sign in to GitHub in the browser the first time):

   ```bash
   git remote add origin https://github.com/YOUR-USERNAME/3bdu-lifts-app.git
   ```

   ```bash
   git push -u origin main
   ```

`.env.local` and the local test-account passwords are git-ignored and are not pushed.

## 3. Vercel project

1. On vercel.com: *Add New → Project*, import the GitHub repository. Framework is detected as Next.js; leave the build settings as they are.
2. Under *Environment Variables* add, for all environments:
   - `NEXT_PUBLIC_SUPABASE_URL` = the Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the anon / publishable key
3. Deploy. Vercel gives you an address like `3bdu-lifts-app.vercel.app`.
4. *Settings → Functions → Function Region*: choose the region nearest your Supabase project (Mumbai `bom1` if the database is in Mumbai). Every page reads the database, so keeping them close makes the app noticeably faster. Redeploy after changing it.

**Plan note:** Vercel's free Hobby plan is for personal, non-commercial use. A paid coaching business falls under their Pro plan — check their current terms before inviting paying clients.

## 4. Connect sign-in emails to the live site

In Supabase, *Authentication → URL Configuration*:

- **Site URL:** `https://YOUR-APP.vercel.app` (or your own domain later)
- **Redirect URLs:** add `https://YOUR-APP.vercel.app/auth/callback` and `http://localhost:3000/**` (the second keeps local testing working).

Without this, confirmation and password-reset emails link to the wrong place.

**Email delivery.** Supabase's built-in email sender only allows a handful of emails per hour and is meant for testing. Before real clients sign up, add your own SMTP provider under *Authentication → Emails → SMTP Settings* (Resend, Postmark, Brevo, Amazon SES… most have a free tier). Until then:

- either keep *Confirm email* **on** and expect delays once several people sign up the same hour,
- or turn it **off** while you onboard your first few clients yourself.

You can also translate the email templates to Arabic under *Authentication → Emails → Templates* (keep the `{{ .ConfirmationURL }}` placeholder).

## 5. Make yourself the coach

1. Open the live site and sign up with your own email.
2. In Supabase *SQL Editor* run once:

   ```sql
   update profiles set role = 'coach'
   where id = (select id from auth.users where email = 'YOUR-EMAIL');
   ```

3. Sign out and back in. You land on the client dashboard.

## 6. Check it works (10 minutes)

In a private/incognito window, sign up as a test client and walk through:

- [ ] Onboarding questionnaire saves and opens Today
- [ ] Log a workout from a routine you assigned; finish it; it shows in history
- [ ] Add food, see the totals; log a meal-plan option
- [ ] Daily check-in; weekly check-in with a photo from your phone
- [ ] Sign out → *Forgot your password?* → email arrives → new password works
- [ ] As coach: the test client appears on the dashboard; their photo shows in the Photos tab; CSV and report download

Then delete the test client in Supabase *Authentication → Users* (their data is removed with them).

## Later changes

- **Code changes** deploy automatically: every push to `main` on GitHub redeploys on Vercel.
- **Database changes** come as new numbered files in `supabase/migrations/`. Run only the new ones (SQL Editor, or `npx supabase db push`).
- **Backups:** the free Supabase plan keeps no point-in-time backups, and free projects pause after a period without activity. Use *Settings → Database → Backups* on a paid plan, or export important data now and then (the client CSV export covers each client).
