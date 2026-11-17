-- Challenge leaderboard: count "days so far" in Oman time (the database clock runs in UTC),
-- and never report more than 100% consistency.
create or replace function challenge_leaderboard(p_challenge uuid)
returns table (client_id uuid, display_name text, weight_change_pct numeric, consistency_pct numeric)
language plpgsql stable security definer set search_path = public as $$
declare today date := (now() at time zone 'Asia/Muscat')::date;
begin
  if not (is_coach() or is_challenge_member(p_challenge)) then
    raise exception 'not a member of this challenge';
  end if;
  return query
  select m.client_id, p.full_name,
         round(100 * (l.weight_kg - f.weight_kg) / nullif(f.weight_kg, 0), 2),
         least(100, round(100.0 * coalesce(d.days, 0)
               / greatest(1, least(today, c.end_date) - c.start_date + 1), 0))
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
                       and dc.check_date between c.start_date and least(today, c.end_date)) d on true
  where m.challenge_id = p_challenge;
end $$;
