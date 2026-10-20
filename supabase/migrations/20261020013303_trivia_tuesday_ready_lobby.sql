-- Standalone pre-game lobby for existing and future Trivia Tuesday sessions.
alter table public.sessions drop constraint if exists sessions_trivia_tuesday_phase_check;
alter table public.sessions
  add column if not exists trivia_tuesday_ready_last_at timestamptz,
  add column if not exists trivia_tuesday_ready_countdown_at timestamptz,
  add constraint sessions_trivia_tuesday_phase_check check (trivia_tuesday_phase in ('ordinary','countdown','seasonal','final_leaderboard','session_points','complete','waiting_for_start','ready_check','ready_countdown'));

alter table public.players
  add column if not exists trivia_tuesday_ready_at timestamptz;

alter table public.rickhouse_games
  add column if not exists previous_picker_player_id uuid references public.players(id),
  add column if not exists controller_idle_started_at timestamptz,
  add column if not exists controller_idle_countdown_at timestamptz;
