-- Persistent state for a scheduled Trivia Tuesday.  The saved JSON is
-- server-managed and lets the ordinary mode resume exactly where it paused.
alter table public.sessions
  add column if not exists trivia_tuesday_phase text not null default 'ordinary'
    check (trivia_tuesday_phase in ('ordinary','countdown','seasonal','final_leaderboard','session_points','complete')),
  add column if not exists trivia_tuesday_pause_state jsonb;

create index if not exists sessions_trivia_tuesday_phase_idx
  on public.sessions (trivia_tuesday_event_id, trivia_tuesday_phase);
