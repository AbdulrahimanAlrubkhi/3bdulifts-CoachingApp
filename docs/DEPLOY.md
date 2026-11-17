# Deploying and running 3bdu.lifts

Three services: **Supabase** (database, sign-in, photos), **GitHub** (code), **Vercel** (website).
Keep two separate environments: your **local** copy (Docker, synthetic test data) and **production** (real clients). Never point local tests at production, and never copy real client data into local.

## 1. First deployment

### 1.1 Supabase project
1. Create a project on supabase.com in the region closest to Oman that's offered (usually Mumbai). Save the database password in your password manager.
2. Create the database: run every file in `supabase/migrations/` **once, in number order** (`0001` … `0007`). Either paste each into *SQL Editor*, or from the project folder:

   ```bash
   npx supabase login
   ```

   ```bash
   npx supabase link --project-ref YOUR-PROJECT-REF
   ```

   ```bash
   npx supabase db push
   ```
3. *Project Settings → API*: copy the **Project URL** and the **anon / publishable key**. Never put the `service_role` / secret key in Vercel, the code, or a file in this folder.

### 1.2 Vercel
1. *Add New → Project*, import the GitHub repository, keep the defaults.
2. Environment variables (Production): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. *Settings → Functions → Function Region*: the region nearest the database (Mumbai `bom1` for a Mumbai project). Redeploy after changing it.
4. Vercel's free Hobby plan is for non-commercial use; a paid coaching business belongs on Pro. Check their current terms.

### 1.3 Sign-in settings (Supabase → Authentication)
- *URL Configuration*: Site URL `https://YOUR-APP.vercel.app`; Redirect URLs: `https://YOUR-APP.vercel.app/auth/callback` (and `http://localhost:3000/**` only if you test locally against production — better not to).
- *Emails → SMTP Settings*: add a real email provider (Resend, Postmark, Brevo, SES). The built-in sender allows only a few emails per hour and is for testing; password resets will silently stall without this.
- *Providers → Email*: keep **Confirm email** on once SMTP works.
- Optional: translate the email templates to Arabic (keep `{{ .ConfirmationURL }}`).

### 1.4 Make yourself the coach
Sign-up is **by invitation only** once a coach exists, so do this first, before anyone else signs up:
1. Open the live site and sign up with your own email.
2. In *SQL Editor*:

   ```sql
   update profiles set role = 'coach'
   where id = (select id from auth.users where email = 'YOUR-EMAIL');
   ```
3. Sign out and back in. From now on, clients can only sign up after you add their email under **Clients → Invite a client**.

### 1.5 Smoke test on the live site (10 minutes)
Use a second email you own as a test client (invite it first), in a private window on your phone:
- [ ] Sign-up with the invited email works; an uninvited email is refused
- [ ] Questionnaire saves, Today opens
- [ ] Log 2 sets, lock the phone for a minute, reopen: values are still there and say "All changes saved"
- [ ] Add a food; submit a daily check-in; upload a progress photo from the camera roll
- [ ] *Forgot your password?* → email arrives → new password works
- [ ] As coach: the client is on the dashboard; photo visible in the Photos tab; CSV and report download
- [ ] Delete the test client afterwards (see 4.2)

## 2. Releasing changes safely

1. Work on a branch; run locally:

   ```bash
   npm run lint
   ```

   ```bash
   npm test
   ```

   ```bash
   npm run test:db
   ```

   (`test:db` needs the local Supabase running: `npx supabase start`.)
2. **If the change includes a new migration**: take a backup first (3.1), then apply the migration to production **before** merging the code that needs it. Migrations here only add things, so the old code keeps working with the new database.
3. Merge to `main`; Vercel deploys automatically. Open the site and repeat the relevant smoke-test lines.
4. **If the new version misbehaves**: in Vercel → *Deployments*, open the previous good deployment → *Promote to Production* (instant rollback of the website). Database changes are not undone by this — fix forward with a new migration, or restore (3.2) only if data was damaged.

## 3. Backups and restore

Supabase's free plan keeps no point-in-time backups and pauses inactive projects. During the pilot, back up **weekly** and before every migration. A backup has two parts — the database and the photo files — and both contain private client data: store them encrypted (e.g. a password-protected archive) outside OneDrive's shared folders.

### 3.1 Back up
Database (all client data and accounts):

```bash
npx supabase db dump --linked --data-only --schema public,auth -f backup-YYYY-MM-DD.sql
```

Photos (the database backup does not contain the image files). Get the service key from *Project Settings → API* and paste it only into this one command:

```bash
SUPABASE_URL=https://YOUR-PROJECT.supabase.co SUPABASE_SERVICE_KEY=PASTE-HERE node scripts/photos-backup.mjs backup ./photos-YYYY-MM-DD
```

### 3.2 Restore (into a new, empty Supabase project)
Tested end to end on the local copy (see `docs/REVIEW.md`, restore drill); not yet rehearsed against a hosted project.
1. Create a new project and run all migrations (1.1 step 2). This recreates tables, security rules, the photo bucket and the seed foods/exercises.
2. Remove the freshly seeded foods and exercises (the backup contains its own copies, which past logs point to). In *SQL Editor*:

   ```sql
   truncate public.foods, public.exercises cascade;
   ```
3. Load the database backup with `psql` and the connection string from *Connect* (session pooler):

   ```bash
   psql "CONNECTION-STRING" -v ON_ERROR_STOP=0 -f backup-YYYY-MM-DD.sql
   ```
4. Restore the photos:

   ```bash
   SUPABASE_URL=https://NEW-PROJECT.supabase.co SUPABASE_SERVICE_KEY=PASTE-HERE node scripts/photos-backup.mjs restore ./photos-YYYY-MM-DD
   ```
5. Point Vercel's two environment variables at the new project, redeploy, redo 1.3, and spot-check: a client signs in and sees their history and photos; row counts match the backup.

## 4. Client lifecycle

### 4.1 Ending coaching (keep the data)
Client page → *Overview* → **Archive client**. They disappear from the dashboard; everything is kept; **Restore to list** undoes it. They can still sign in unless you delete the account. Remove their email from the invite list if you don't want them to re-register later.

### 4.2 Deleting a client for good (e.g. on request)
1. Export first if they want a copy: client page → *Overview* → CSV files and the report.
2. Delete their **photos**: *Storage → progress-photos*, open the folder named with their user id, select all, delete. (Deleting the account does not remove stored files.)
3. Delete the **account**: *Authentication → Users* → the user → *Delete user*. This removes all their records (workouts, food logs, check-ins, consents, notes, subscriptions). Results/wins you recorded stay but lose the link to the client — delete those under *Business → Results & wins* if they asked for full removal.
4. Remove their invite.
Deletions also remain in old backups until those are rotated out; say so if a client asks.

## 5. Monitoring

- **Website errors**: Vercel → *Logs*. Failures are logged as `[3bdu] <where> failed` with an error code only — no names, notes or numbers. Error pages show the client a short reference code that matches the log entry.
- **Database / auth**: Supabase → *Logs* (Auth logs show sign-in and email problems).
- **Optional error alerts**: add Sentry for Next.js (free tier) following its official Next.js guide; set it to scrub request bodies and not to send IP addresses. Not installed by default.
- **Costs to watch**: photo storage (≈0.3–1 MB per photo after compression, 3 per client per week) and Vercel function time. Both are small for 3–5 clients.
