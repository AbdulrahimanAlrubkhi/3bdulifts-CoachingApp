-- Pilot hardening: invitation-only sign-up, stricter photo uploads, no duplicate workouts/sets,
-- client-given publication consent, estimate flags on foods, and a few missing indexes.

-- ───────── 1. Sign-up by invitation only ─────────
-- The anon key is public, so anyone could call Supabase's sign-up API directly and appear on
-- the coach dashboard. Once a coach exists, only emails the coach has invited can create an account.
create table if not exists client_invites (
  email       text primary key check (email = lower(email) and position('@' in email) > 1),
  invited_at  timestamptz not null default now(),
  note        text
);
alter table client_invites enable row level security;
create policy invites_coach on client_invites for all to authenticated using (is_coach()) with check (is_coach());
grant select, insert, update, delete on client_invites to authenticated;

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- before the first coach exists (initial setup) anyone may sign up; afterwards an invite is required
  if exists (select 1 from profiles where role = 'coach')
     and not exists (select 1 from client_invites where email = lower(new.email)) then
    raise exception 'sign-up is by invitation only' using errcode = 'P0001';
  end if;
  insert into profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  insert into clients (user_id, email) values (new.id, new.email);
  return new;
end $$;

-- ───────── 2. Progress photo uploads ─────────
-- The app always uploads one compressed JPEG per pose; the storage API now refuses anything else,
-- so a direct API call can't store huge files, other file types, or extra files.
update storage.buckets
   set file_size_limit = 5 * 1024 * 1024,
       allowed_mime_types = array['image/jpeg']
 where id = 'progress-photos';

drop policy if exists photos_insert on storage.objects;
drop policy if exists photos_update on storage.objects;
create policy photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'progress-photos'
              and (storage.foldername(name))[1] = auth.uid()::text
              and name ~ '^[0-9a-f-]{36}/[0-9]{4}-[0-9]{2}-[0-9]{2}/(front|side|back)\.jpg$');
create policy photos_update on storage.objects for update to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'progress-photos'
              and (storage.foldername(name))[1] = auth.uid()::text
              and name ~ '^[0-9a-f-]{36}/[0-9]{4}-[0-9]{2}-[0-9]{2}/(front|side|back)\.jpg$');

-- ───────── 3. No duplicates from repeated taps or retries ─────────
-- At most one unfinished workout per person: a second "Start" opens the running one.
create unique index if not exists workouts_one_live_per_user on workouts (user_id) where ended_at is null;
-- One exercise per slot in a workout, one set per slot in an exercise.
create unique index if not exists workout_exercises_position_unique on workout_exercises (workout_id, position);
create unique index if not exists workout_sets_position_unique on workout_sets (workout_exercise_id, position);

-- ───────── 4. Publication consent, given by the client ─────────
-- Separate from private progress tracking. Each row is one permission, with the exact wording the
-- client agreed to. Rows are never edited: withdrawing sets withdrawn_at, giving again adds a new row.
create table if not exists publication_consents (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references profiles on delete cascade,
  scope            text not null check (scope in ('results', 'photos', 'quote')),
  wording_version  text not null,
  wording          text not null,
  locale           text not null check (locale in ('ar', 'en')),
  granted_at       timestamptz not null default now(),
  withdrawn_at     timestamptz
);
create unique index if not exists publication_consents_active
  on publication_consents (client_id, scope) where withdrawn_at is null;
create index if not exists publication_consents_client on publication_consents (client_id, granted_at desc);
alter table publication_consents enable row level security;
grant select, insert, update on publication_consents to authenticated;

create policy consents_read on publication_consents for select to authenticated
  using (client_id = auth.uid() or is_coach());
-- only the client can give consent, and only for themselves
create policy consents_give on publication_consents for insert to authenticated
  with check (client_id = auth.uid() and withdrawn_at is null);
-- only the client can withdraw; the trigger below allows nothing else to change
create policy consents_withdraw on publication_consents for update to authenticated
  using (client_id = auth.uid()) with check (client_id = auth.uid());

create or replace function protect_consent() returns trigger
language plpgsql as $$
begin
  if old.withdrawn_at is not null then
    raise exception 'consent already withdrawn; give it again instead';
  end if;
  if new.withdrawn_at is null
     or (new.client_id, new.scope, new.wording_version, new.wording, new.locale, new.granted_at)
        is distinct from (old.client_id, old.scope, old.wording_version, old.wording, old.locale, old.granted_at) then
    raise exception 'consent records can only be withdrawn';
  end if;
  return new;
end $$;
drop trigger if exists publication_consents_protect on publication_consents;
create trigger publication_consents_protect before update on publication_consents
  for each row execute function protect_consent();

comment on column testimonials.consent_given is
  'Deprecated: consent now comes from publication_consents, given by the client. Not read by the app.';

-- ───────── 5. Food values that are estimates ─────────
alter table foods add column if not exists is_estimate boolean not null default false;
comment on column foods.is_estimate is
  'True for mixed dishes, regional products and branded-style items whose values vary by recipe or brand.';
update foods set is_estimate = true
 where is_global
   and (category in ('dishes', 'fast_food')
        or name_en in (
          'Rakhal bread (Omani)', 'Samoon bread', 'Paratha', 'Chapati', 'Vermicelli, cooked',
          'Chicken shawarma meat', 'Fried chicken, breaded', 'Lamb kofta kebab, grilled', 'Beef sausages',
          'Turkey breast slices', 'Camel meat, cooked', 'Whey protein powder',
          'Laban, full fat', 'Laban, low fat', 'Labneh', 'Labneh, low fat', 'Akkawi cheese', 'Cream cheese spread',
          'Foul medames with oil', 'Lentil soup', 'Dal (lentil curry)', 'Mutabbal',
          'Green salad, no dressing', 'Fattoush', 'Tabbouleh', 'Dates', 'Date paste', 'Mixed nuts',
          'Omani halwa', 'Luqaimat', 'Kunafa', 'Plain biscuits', 'Sponge cake', 'Protein bar',
          'Karak tea', 'Tea with sugar', 'Latte, whole milk', 'Mango juice'));

-- ───────── 6. Indexes for lookups by client ─────────
create index if not exists coach_notes_client on coach_notes (client_id, created_at desc);
create index if not exists routine_assignments_client on routine_assignments (client_id);
create index if not exists meal_plans_client on meal_plans (client_id);
create index if not exists testimonials_client on testimonials (client_id);
create index if not exists challenge_members_client on challenge_members (client_id);
create index if not exists food_logs_option on food_logs (user_id, log_date, meal_option_id);
