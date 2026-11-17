-- 3bdu.lifts — full schema, row-level security, storage.
-- Run once in the Supabase SQL editor (or `supabase db push`).
-- All weights are stored in kg and all lengths in cm; the lb option is display-only.

create extension if not exists pgcrypto;

-- ───────────────────────────── enums ─────────────────────────────
create type user_role      as enum ('coach', 'client');
create type diet_phase     as enum ('cut', 'maintain', 'bulk');
create type meal_type      as enum ('breakfast', 'lunch', 'dinner', 'snacks');
create type payment_status as enum ('paid', 'pending');
create type set_type       as enum ('normal', 'warmup', 'drop', 'failure');

-- ─────────────────────── 1. accounts and roles ───────────────────────
create table profiles (
  id          uuid primary key references auth.users on delete cascade,
  role        user_role not null default 'client',
  full_name   text not null default '',
  locale      text not null default 'ar' check (locale in ('ar', 'en')),
  unit        text not null default 'kg' check (unit in ('kg', 'lb')),
  created_at  timestamptz not null default now()
);

-- security definer so policies can call it without recursing into profiles' own RLS
create function is_coach() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'coach');
$$;

-- Client profile (#13) + onboarding questionnaire answers (#14)
create table clients (
  user_id             uuid primary key references profiles on delete cascade,
  whatsapp            text,
  instagram           text,
  email               text,
  birth_date          date,
  height_cm           numeric(5,1),
  starting_weight_kg  numeric(5,1),
  goal                text,
  injuries            text,
  experience          text,           -- beginner / intermediate / advanced, free text allowed
  availability        text,           -- days and times the client can train
  start_date          date,
  onboarding          jsonb,          -- raw questionnaire answers
  onboarded_at        timestamptz,
  archived            boolean not null default false
);

-- every new auth user gets a profile + client row; role always starts as 'client'
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  insert into clients (user_id, email) values (new.id, new.email);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- a signed-in client can never change their own role
-- (auth.uid() is null in the SQL editor, which is how the coach is promoted — see README)
create function protect_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not is_coach() then
    raise exception 'role cannot be changed';
  end if;
  return new;
end $$;

create trigger profiles_protect_role
  before update on profiles
  for each row execute function protect_profile_role();

-- Coach-only private notes (#17) — clients never see these
create table coach_notes (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references profiles on delete cascade,
  body        text not null,
  created_at  timestamptz not null default now()
);

-- Weekly feedback the client reads in the app (#17)
create table weekly_feedback (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references profiles on delete cascade,
  week_start  date not null,
  body        text not null,
  created_at  timestamptz not null default now(),
  read_at     timestamptz,
  unique (client_id, week_start)
);

-- ───────────────────────── 2. workouts ─────────────────────────
-- Exercise library (#1). is_global = seeded or coach-made, visible to everyone.
create table exercises (
  id            uuid primary key default gen_random_uuid(),
  name_ar       text not null,
  name_en       text not null,
  muscle        text not null check (muscle in
                  ('chest','back','shoulders','biceps','triceps','forearms','core',
                   'quads','hamstrings','glutes','calves','full_body','cardio')),
  equipment     text not null check (equipment in
                  ('barbell','dumbbell','machine','cable','bodyweight','kettlebell','band','other')),
  instructions  text,
  is_global     boolean not null default false,
  created_by    uuid references profiles on delete set null,
  created_at    timestamptz not null default now()
);

-- Routines (#2)
create table routines (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references profiles on delete cascade,
  title        text not null,
  notes        text,
  share_token  uuid unique,              -- set when "share via link" is turned on
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table routine_exercises (
  id                uuid primary key default gen_random_uuid(),
  routine_id        uuid not null references routines on delete cascade,
  exercise_id       uuid not null references exercises on delete restrict,
  position          int  not null,
  target_sets       int  not null default 3,
  target_reps_min   int,
  target_reps_max   int,
  target_weight_kg  numeric(6,2),
  rest_seconds      int  not null default 120,
  notes             text
);

create table routine_assignments (
  routine_id   uuid not null references routines on delete cascade,
  client_id    uuid not null references profiles on delete cascade,
  assigned_at  timestamptz not null default now(),
  primary key (routine_id, client_id)
);

create function can_read_routine(rid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_coach()
      or exists (select 1 from routines where id = rid and owner_id = auth.uid())
      or exists (select 1 from routine_assignments where routine_id = rid and client_id = auth.uid());
$$;

create function can_write_routine(rid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_coach()
      or exists (select 1 from routines where id = rid and owner_id = auth.uid());
$$;

-- Public read of one routine by its share link — works without signing in
create function get_shared_routine(p_token uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'title', r.title,
    'notes', r.notes,
    'exercises', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name_ar', e.name_ar, 'name_en', e.name_en, 'muscle', e.muscle,
        'target_sets', re.target_sets, 'target_reps_min', re.target_reps_min,
        'target_reps_max', re.target_reps_max, 'target_weight_kg', re.target_weight_kg,
        'rest_seconds', re.rest_seconds, 'notes', re.notes) order by re.position)
      from routine_exercises re join exercises e on e.id = re.exercise_id
      where re.routine_id = r.id), '[]'::jsonb))
  from routines r where r.share_token = p_token;
$$;

-- Logged workouts (#3, #4). user_id is repeated on child rows and tied back with a
-- composite foreign key, so a row can never be attached to someone else's workout.
create table workouts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles on delete cascade,
  routine_id  uuid references routines on delete set null,
  title       text not null,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,               -- null while the workout is live
  notes       text,
  unique (id, user_id)
);

create table workout_exercises (
  id            uuid primary key default gen_random_uuid(),
  workout_id    uuid not null,
  user_id       uuid not null,
  exercise_id   uuid not null references exercises on delete restrict,
  position      int  not null,
  rest_seconds  int  not null default 120,
  notes         text,
  unique (id, user_id),
  foreign key (workout_id, user_id) references workouts (id, user_id) on delete cascade
);

create table workout_sets (
  id                   uuid primary key default gen_random_uuid(),
  workout_exercise_id  uuid not null,
  user_id              uuid not null,
  position             int  not null,
  set_type             set_type not null default 'normal',
  weight_kg            numeric(6,2),
  reps                 int,
  rpe                  numeric(3,1) check (rpe between 1 and 10),
  completed_at         timestamptz,
  foreign key (workout_exercise_id, user_id) references workout_exercises (id, user_id) on delete cascade
);

-- One row per completed working set, with volume and estimated 1RM (Epley).
-- Feeds history, per-exercise charts and the PR list.
create view v_set_stats with (security_invoker = true) as
select s.id as set_id, s.user_id, we.exercise_id, w.id as workout_id,
       w.started_at, s.weight_kg, s.reps, s.rpe,
       s.weight_kg * s.reps as volume_kg,
       round(s.weight_kg * (1 + s.reps / 30.0), 1) as est_1rm_kg
from workout_sets s
join workout_exercises we on we.id = s.workout_exercise_id
join workouts w on w.id = we.workout_id
where s.completed_at is not null and s.set_type <> 'warmup'
  and s.weight_kg is not null and s.reps > 0;

create view v_personal_records with (security_invoker = true) as
select user_id, exercise_id,
       max(weight_kg)  as best_weight_kg,
       max(est_1rm_kg) as best_est_1rm_kg,
       max(volume_kg)  as best_set_volume_kg
from v_set_stats group by user_id, exercise_id;

-- ───────────────────────── 3. nutrition ─────────────────────────
-- Targets per client (#6). A new row = a new phase; old rows are the history.
-- The target for a given day is the latest row with effective_from <= that day.
create table nutrition_targets (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references profiles on delete cascade,
  phase           diet_phase not null,
  calories        int not null,
  protein_g       int not null,
  carbs_g         int not null,
  fat_g           int not null,
  fiber_g         int,
  water_ml        int,
  effective_from  date not null default current_date,
  note            text,
  created_at      timestamptz not null default now(),
  unique (client_id, effective_from)
);

-- Food database (#10), values per 100 g
create table foods (
  id             uuid primary key default gen_random_uuid(),
  name_ar        text not null,
  name_en        text not null,
  category       text,
  kcal_100g      numeric(6,1) not null,
  protein_100g   numeric(5,1) not null default 0,
  carbs_100g     numeric(5,1) not null default 0,
  fat_100g       numeric(5,1) not null default 0,
  fiber_100g     numeric(5,1) not null default 0,
  serving_g      numeric(6,1),           -- optional common serving, e.g. 1 date = 8 g
  serving_ar     text,
  serving_en     text,
  is_global      boolean not null default false,
  created_by     uuid references profiles on delete set null,
  created_at     timestamptz not null default now()
);

-- Client's saved foods list (#7)
create table saved_foods (
  user_id  uuid not null references profiles on delete cascade,
  food_id  uuid not null references foods on delete cascade,
  primary key (user_id, food_id)
);

-- Meal plan builder (#8). client_id null = reusable template.
create table meal_plans (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references profiles on delete cascade,
  title       text not null,
  notes       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table meal_options (
  id            uuid primary key default gen_random_uuid(),
  meal_plan_id  uuid not null references meal_plans on delete cascade,
  meal          meal_type not null,
  name_ar       text not null,
  name_en       text,
  position      int not null default 0
);

create table meal_option_items (
  id              uuid primary key default gen_random_uuid(),
  meal_option_id  uuid not null references meal_options on delete cascade,
  food_id         uuid not null references foods on delete restrict,
  grams           numeric(6,1) not null
);

-- macros pre-calculated per option
create view v_meal_option_totals with (security_invoker = true) as
select i.meal_option_id,
       round(sum(f.kcal_100g    * i.grams / 100))    as calories,
       round(sum(f.protein_100g * i.grams / 100), 1) as protein_g,
       round(sum(f.carbs_100g   * i.grams / 100), 1) as carbs_g,
       round(sum(f.fat_100g     * i.grams / 100), 1) as fat_g,
       round(sum(f.fiber_100g   * i.grams / 100), 1) as fiber_g
from meal_option_items i join foods f on f.id = i.food_id
group by i.meal_option_id;

-- Daily food log (#7). Macros are copied onto the row at log time, so editing a
-- food later never rewrites history. food_id null + grams null = quick-add.
create table food_logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles on delete cascade,
  log_date        date not null default current_date,
  meal            meal_type not null,
  food_id         uuid references foods on delete set null,
  meal_option_id  uuid references meal_options on delete set null,
  name            text not null,
  grams           numeric(6,1),
  calories        numeric(6,1) not null default 0,
  protein_g       numeric(5,1) not null default 0,
  carbs_g         numeric(5,1) not null default 0,
  fat_g           numeric(5,1) not null default 0,
  fiber_g         numeric(5,1) not null default 0,
  created_at      timestamptz not null default now()
);

create table water_logs (
  user_id   uuid not null references profiles on delete cascade,
  log_date  date not null default current_date,
  ml        int  not null default 0,
  primary key (user_id, log_date)
);

-- daily totals (#9) — also the source for nutrition adherence
create view v_daily_nutrition with (security_invoker = true) as
select user_id, log_date,
       sum(calories) as calories, sum(protein_g) as protein_g, sum(carbs_g) as carbs_g,
       sum(fat_g) as fat_g, sum(fiber_g) as fiber_g
from food_logs group by user_id, log_date;

-- ───────────────────────── 4. check-ins ─────────────────────────
-- Daily (#11). "Training done" and "nutrition adherence" are not stored here:
-- they are read from workouts and v_daily_nutrition for the same date.
create table daily_checkins (
  user_id      uuid not null references profiles on delete cascade,
  check_date   date not null default current_date,
  weight_kg    numeric(5,2),
  steps        int,
  sleep_hours  numeric(3,1),
  energy       smallint check (energy between 1 and 5),
  hunger       smallint check (hunger between 1 and 5),
  stress       smallint check (stress between 1 and 5),
  notes        text,
  created_at   timestamptz not null default now(),
  primary key (user_id, check_date)
);

-- Weekly (#12). Photo columns hold storage paths in the private progress-photos bucket.
create table weekly_checkins (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles on delete cascade,
  week_start   date not null,
  waist_cm     numeric(5,1),
  chest_cm     numeric(5,1),
  hip_cm       numeric(5,1),
  arm_cm       numeric(5,1),
  photo_front  text,
  photo_side   text,
  photo_back   text,
  reflections  jsonb,                    -- { question_key: answer }
  created_at   timestamptz not null default now(),
  unique (user_id, week_start)
);

-- ───────────────────────── 5. coach business ─────────────────────────
-- Subscriptions (#18)
create table subscriptions (
  id                    uuid primary key default gen_random_uuid(),
  client_id             uuid not null references profiles on delete cascade,
  plan_months           smallint not null check (plan_months in (1, 3, 6)),
  price_omr             numeric(8,3) not null,      -- OMR has 3 decimal places
  start_date            date not null,
  end_date              date not null,
  payment_status        payment_status not null default 'pending',
  reminder_days_before  smallint not null default 7,
  reminded_at           timestamptz,
  notes                 text,
  created_at            timestamptz not null default now()
);

-- Group challenges (#19)
create table challenges (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  start_date   date not null,
  end_date     date not null,
  created_at   timestamptz not null default now()
);

create table challenge_members (
  challenge_id  uuid not null references challenges on delete cascade,
  client_id     uuid not null references profiles on delete cascade,
  primary key (challenge_id, client_id)
);

create function is_challenge_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from challenge_members where challenge_id = cid and client_id = auth.uid());
$$;

-- Leaderboard: members see each other's name, % weight change and consistency only —
-- never raw weights, logs or photos.
create function challenge_leaderboard(p_challenge uuid)
returns table (client_id uuid, display_name text, weight_change_pct numeric, consistency_pct numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (is_coach() or is_challenge_member(p_challenge)) then
    raise exception 'not a member of this challenge';
  end if;
  return query
  select m.client_id, p.full_name,
         round(100 * (l.weight_kg - f.weight_kg) / nullif(f.weight_kg, 0), 2),
         round(100.0 * coalesce(d.days, 0)
               / greatest(1, least(current_date, c.end_date) - c.start_date + 1), 0)
  from challenge_members m
  join challenges c on c.id = m.challenge_id
  join profiles   p on p.id = m.client_id
  left join lateral (select dc.weight_kg from daily_checkins dc
                     where dc.user_id = m.client_id and dc.weight_kg is not null
                       and dc.check_date between c.start_date and c.end_date
                     order by dc.check_date asc limit 1) f on true
  left join lateral (select dc.weight_kg from daily_checkins dc
                     where dc.user_id = m.client_id and dc.weight_kg is not null
                       and dc.check_date between c.start_date and c.end_date
                     order by dc.check_date desc limit 1) l on true
  left join lateral (select count(*)::numeric as days from daily_checkins dc
                     where dc.user_id = m.client_id
                       and dc.check_date between c.start_date and c.end_date) d on true
  where m.challenge_id = p_challenge;
end $$;

-- Testimonials / results tracker (#20) — coach only
create table testimonials (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid references profiles on delete set null,
  title             text not null,
  quote             text,
  weeks             int,
  before_weight_kg  numeric(5,1),
  after_weight_kg   numeric(5,1),
  before_waist_cm   numeric(5,1),
  after_waist_cm    numeric(5,1),
  before_photo      text,
  after_photo       text,
  consent_given     boolean not null default false,   -- client agreed to public use
  created_at        timestamptz not null default now()
);

-- ───────────────────────── indexes ─────────────────────────
create index on workouts (user_id, started_at desc);
create index on workout_exercises (workout_id);
create index on workout_exercises (user_id, exercise_id);
create index on workout_sets (workout_exercise_id);
create index on routine_exercises (routine_id, position);
create index on food_logs (user_id, log_date);
create index on nutrition_targets (client_id, effective_from desc);
create index on weekly_checkins (user_id, week_start desc);
create index on subscriptions (client_id, end_date desc);
create index on meal_options (meal_plan_id);
create index on meal_option_items (meal_option_id);

-- ───────────────────── row-level security ─────────────────────
-- Rule of thumb: a client touches only rows carrying their own id; the coach touches everything.
alter table profiles            enable row level security;
alter table clients             enable row level security;
alter table coach_notes         enable row level security;
alter table weekly_feedback     enable row level security;
alter table exercises           enable row level security;
alter table routines            enable row level security;
alter table routine_exercises   enable row level security;
alter table routine_assignments enable row level security;
alter table workouts            enable row level security;
alter table workout_exercises   enable row level security;
alter table workout_sets        enable row level security;
alter table nutrition_targets   enable row level security;
alter table foods               enable row level security;
alter table saved_foods         enable row level security;
alter table meal_plans          enable row level security;
alter table meal_options        enable row level security;
alter table meal_option_items   enable row level security;
alter table food_logs           enable row level security;
alter table water_logs          enable row level security;
alter table daily_checkins      enable row level security;
alter table weekly_checkins     enable row level security;
alter table subscriptions       enable row level security;
alter table challenges          enable row level security;
alter table challenge_members   enable row level security;
alter table testimonials        enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;
grant execute on function get_shared_routine(uuid) to anon, authenticated;

-- profiles: read/update your own row; coach reads and updates all. Rows are created by trigger only.
create policy profiles_select on profiles for select to authenticated
  using (id = auth.uid() or is_coach());
create policy profiles_update on profiles for update to authenticated
  using (id = auth.uid() or is_coach()) with check (id = auth.uid() or is_coach());

create policy clients_select on clients for select to authenticated
  using (user_id = auth.uid() or is_coach());
create policy clients_update on clients for update to authenticated
  using (user_id = auth.uid() or is_coach()) with check (user_id = auth.uid() or is_coach());

-- coach-only tables
create policy coach_notes_all  on coach_notes  for all to authenticated using (is_coach()) with check (is_coach());
create policy testimonials_all on testimonials for all to authenticated using (is_coach()) with check (is_coach());

-- coach writes, client reads their own
create policy feedback_coach on weekly_feedback for all to authenticated using (is_coach()) with check (is_coach());
create policy feedback_read  on weekly_feedback for select to authenticated using (client_id = auth.uid());
-- lets the client mark feedback as read; the trigger below stops them changing anything else
create policy feedback_mark_read on weekly_feedback for update to authenticated
  using (client_id = auth.uid()) with check (client_id = auth.uid());

create function protect_feedback_body() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_coach()
     and (new.body is distinct from old.body or new.week_start is distinct from old.week_start
          or new.client_id is distinct from old.client_id) then
    raise exception 'feedback can only be edited by the coach';
  end if;
  return new;
end $$;
create trigger weekly_feedback_protect before update on weekly_feedback
  for each row execute function protect_feedback_body();

create policy targets_coach on nutrition_targets for all to authenticated using (is_coach()) with check (is_coach());
create policy targets_read  on nutrition_targets for select to authenticated using (client_id = auth.uid());

create policy subs_coach on subscriptions for all to authenticated using (is_coach()) with check (is_coach());
create policy subs_read  on subscriptions for select to authenticated using (client_id = auth.uid());

create policy plans_coach on meal_plans for all to authenticated using (is_coach()) with check (is_coach());
create policy plans_read  on meal_plans for select to authenticated using (client_id = auth.uid());

create policy options_coach on meal_options for all to authenticated using (is_coach()) with check (is_coach());
create policy options_read  on meal_options for select to authenticated
  using (exists (select 1 from meal_plans p where p.id = meal_plan_id and p.client_id = auth.uid()));

create policy option_items_coach on meal_option_items for all to authenticated using (is_coach()) with check (is_coach());
create policy option_items_read  on meal_option_items for select to authenticated
  using (exists (select 1 from meal_options o join meal_plans p on p.id = o.meal_plan_id
                 where o.id = meal_option_id and p.client_id = auth.uid()));

create policy challenges_coach on challenges for all to authenticated using (is_coach()) with check (is_coach());
create policy challenges_read  on challenges for select to authenticated using (is_challenge_member(id));

create policy members_coach on challenge_members for all to authenticated using (is_coach()) with check (is_coach());
create policy members_read  on challenge_members for select to authenticated using (client_id = auth.uid());

-- shared libraries: global rows are readable by everyone, private rows by their creator
create policy exercises_select on exercises for select to authenticated
  using (is_global or created_by = auth.uid() or is_coach());
create policy exercises_insert on exercises for insert to authenticated
  with check (is_coach() or (created_by = auth.uid() and not is_global));
create policy exercises_update on exercises for update to authenticated
  using (is_coach() or (created_by = auth.uid() and not is_global))
  with check (is_coach() or (created_by = auth.uid() and not is_global));
create policy exercises_delete on exercises for delete to authenticated
  using (is_coach() or (created_by = auth.uid() and not is_global));

create policy foods_select on foods for select to authenticated
  using (is_global or created_by = auth.uid() or is_coach());
create policy foods_insert on foods for insert to authenticated
  with check (is_coach() or (created_by = auth.uid() and not is_global));
create policy foods_update on foods for update to authenticated
  using (is_coach() or (created_by = auth.uid() and not is_global))
  with check (is_coach() or (created_by = auth.uid() and not is_global));
create policy foods_delete on foods for delete to authenticated
  using (is_coach() or (created_by = auth.uid() and not is_global));

-- routines: owner and coach write; assigned clients read
-- (checked on the row itself, not via can_read_routine, so INSERT ... RETURNING can see the new row)
create policy routines_select on routines for select to authenticated
  using (owner_id = auth.uid() or is_coach()
         or exists (select 1 from routine_assignments a where a.routine_id = id and a.client_id = auth.uid()));
create policy routines_insert on routines for insert to authenticated with check (owner_id = auth.uid() or is_coach());
create policy routines_update on routines for update to authenticated
  using (owner_id = auth.uid() or is_coach()) with check (owner_id = auth.uid() or is_coach());
create policy routines_delete on routines for delete to authenticated using (owner_id = auth.uid() or is_coach());

create policy routine_ex_select on routine_exercises for select to authenticated using (can_read_routine(routine_id));
create policy routine_ex_write  on routine_exercises for all to authenticated
  using (can_write_routine(routine_id)) with check (can_write_routine(routine_id));

create policy assignments_coach on routine_assignments for all to authenticated using (is_coach()) with check (is_coach());
create policy assignments_read  on routine_assignments for select to authenticated using (client_id = auth.uid());

-- client-owned logs: own rows, full access; coach reads and can correct
create policy workouts_own          on workouts          for all to authenticated using (user_id = auth.uid() or is_coach()) with check (user_id = auth.uid() or is_coach());
create policy workout_exercises_own on workout_exercises for all to authenticated using (user_id = auth.uid() or is_coach()) with check (user_id = auth.uid() or is_coach());
create policy workout_sets_own      on workout_sets      for all to authenticated using (user_id = auth.uid() or is_coach()) with check (user_id = auth.uid() or is_coach());
create policy saved_foods_own       on saved_foods       for all to authenticated using (user_id = auth.uid() or is_coach()) with check (user_id = auth.uid() or is_coach());
create policy food_logs_own         on food_logs         for all to authenticated using (user_id = auth.uid() or is_coach()) with check (user_id = auth.uid() or is_coach());
create policy water_logs_own        on water_logs        for all to authenticated using (user_id = auth.uid() or is_coach()) with check (user_id = auth.uid() or is_coach());
create policy daily_checkins_own    on daily_checkins    for all to authenticated using (user_id = auth.uid() or is_coach()) with check (user_id = auth.uid() or is_coach());
create policy weekly_checkins_own   on weekly_checkins   for all to authenticated using (user_id = auth.uid() or is_coach()) with check (user_id = auth.uid() or is_coach());

-- ───────────────────── storage: progress photos ─────────────────────
-- Private bucket. Files live at "<user id>/<week>/<front|side|back>.jpg";
-- the first folder must be the uploader's own id.
insert into storage.buckets (id, name, public) values ('progress-photos', 'progress-photos', false)
on conflict (id) do nothing;

create policy photos_select on storage.objects for select to authenticated
  using (bucket_id = 'progress-photos' and ((storage.foldername(name))[1] = auth.uid()::text or is_coach()));
create policy photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'progress-photos' and ((storage.foldername(name))[1] = auth.uid()::text or is_coach()));
create policy photos_update on storage.objects for update to authenticated
  using (bucket_id = 'progress-photos' and ((storage.foldername(name))[1] = auth.uid()::text or is_coach()));
create policy photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'progress-photos' and ((storage.foldername(name))[1] = auth.uid()::text or is_coach()));
