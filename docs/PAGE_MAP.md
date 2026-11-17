# 3bdu.lifts — page map

Status: **built** = working now · **step N** = arrives with that feature group.

## Public

| Route | Page | Status |
|---|---|---|
| `/login` | Sign in | built |
| `/signup` | Create client account | built |
| `/r/[token]` | Shared routine (read-only, no account needed) | built |

## Client

Bottom tab bar: Today · Workouts · Nutrition · Check-in · More

| Route | Page | Spec # | Status |
|---|---|---|---|
| `/onboarding` | Onboarding questionnaire (shown once after sign-up) | 14 | step 4 |
| `/today` | Today: assigned workout, macros left, check-in status, latest coach feedback, renewal reminder | 9, 17, 18 | workouts, macros, check-in status built; feedback + renewal in steps 4–5 |
| `/workouts` | Routines (mine + assigned by coach), start workout | 2 | built |
| `/workouts/routines/new`, `/workouts/routines/[id]` | Routine editor: add, reorder, targets, share link | 2 | built |
| `/workouts/live/[id]` | Live logging: weight/reps/RPE per set, rest timer, previous numbers | 3 | built |
| `/workouts/history`, `/workouts/history/[id]` | Past workouts with volume, duration, PRs | 4 | built |
| `/workouts/exercises`, `/workouts/exercises/[id]` | Exercise library; per-exercise charts (est. 1RM, volume) | 1, 4 | built |
| `/workouts/records` | PR list | 4 | built |
| `/nutrition` | Daily food log by meal, rings vs target, remaining, water | 7, 9 | built |
| `/nutrition/add` | Add food: search database, saved foods, quick-add | 7, 10 | built |
| `/nutrition/plan` | Pick meal-plan options; they log automatically | 8 | built |
| `/nutrition/week` | Weekly averages | 9 | built |
| `/checkin` | Daily check-in | 11 | built |
| `/checkin/weekly` | Weekly check-in: measurements, photos, reflection | 12 | built |
| `/more` | Feedback from coach, challenges, subscription, settings | 17, 18, 19 | built (settings); rest per step |
| `/more/feedback` | Weekly feedback history | 17 | step 4 |
| `/more/challenges/[id]` | Challenge leaderboard | 19 | step 5 |

## Coach

Same shell, coach tab bar: Clients · Library · Business · More

| Route | Page | Spec # | Status |
|---|---|---|---|
| `/coach` | Dashboard: every client with last check-in, 7-day avg weight + trend, workout %, nutrition %, flags | 15 | shell built; data in step 4 |
| `/coach/clients/[id]` | Client detail, tabs: Overview · Training · Nutrition · Check-ins · Photos · Notes | 13, 16, 17 | links to targets + meal plans built; rest step 4 |
| `/coach/clients/[id]/targets` | Nutrition targets + phase history | 6 | built |
| `/coach/clients/[id]/export` | CSV / PDF export | 21 | step 5 |
| `/coach/library` → `/workouts` | Routine templates, assign to clients (same routine pages as clients) | 2 | built |
| `/coach/library` → `/workouts/exercises` | Manage exercise library (coach additions are shared with all clients) | 1 | built |
| `/coach/library/foods` | Manage food database | 10 | built |
| `/coach/library/meal-plans`, `/[id]` | Meal plan builder (duplicate a plan to reuse it for another client) | 8 | built |
| `/coach/business/subscriptions` | Plans, OMR price, dates, paid/pending, renewals due | 18 | step 5 |
| `/coach/business/challenges`, `/[id]` | Group challenges + leaderboard | 19 | step 5 |
| `/coach/business/wins` | Testimonials / results tracker | 20 | step 5 |

## Build order

0. **Foundation** — schema, auth, roles, Arabic/English, dark/light, app shell *(done)*
1. **Workouts** — spec 1–5, plus 50-exercise seed *(done)*
2. **Nutrition** — spec 6–10, plus 166-food seed *(done)*
3. **Check-ins** — spec 11–12 *(done)*
4. **Coach core** — spec 13–17
5. **Business** — spec 18–21
6. **Deploy** — final README pass, Vercel
