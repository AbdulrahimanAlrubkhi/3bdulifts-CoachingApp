-- How many days a week the client plans to train (from onboarding; the coach can change it).
-- Workout adherence on the coach dashboard is measured against this.
alter table clients
  add column if not exists training_days_per_week smallint check (training_days_per_week between 1 and 7);
