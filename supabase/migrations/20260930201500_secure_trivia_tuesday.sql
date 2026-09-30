-- Correct the initial rollout in environments where the first migration ran.
drop policy if exists "trivia Tuesday events public access" on public.trivia_tuesday_events;
drop policy if exists "trivia Tuesday results public access" on public.trivia_tuesday_results;
revoke all on public.trivia_tuesday_events from anon, authenticated;
revoke all on public.trivia_tuesday_results from anon, authenticated;
grant select, insert, update, delete on public.trivia_tuesday_events to service_role;
grant select, insert, update, delete on public.trivia_tuesday_results to service_role;

create or replace view public.trivia_tuesday_leaderboard
with (security_invoker = false) as
  select r.id, r.session_id, r.game_id, r.placements, r.completed_at,
         e.event_name, e.location, e.scheduled_start_at, e.board_theme
  from public.trivia_tuesday_results r
  join public.trivia_tuesday_events e on e.id = r.event_id
  where e.status = 'completed';
grant select on public.trivia_tuesday_leaderboard to anon, authenticated;
