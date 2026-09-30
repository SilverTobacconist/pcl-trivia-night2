create table if not exists public.trivia_tuesday_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  location text not null check (location in ('Hastings','Norfolk')),
  scheduled_start_at timestamptz not null,
  question_sheet_name text not null unique,
  board_theme text not null default 'pauls',
  status text not null default 'scheduled' check (status in ('scheduled','lobby','live','completed','cancelled')),
  started_session_id uuid references public.sessions(id),
  completed_game_id uuid references public.rickhouse_games(id),
  created_at timestamptz not null default now()
);

alter table public.sessions add column if not exists trivia_tuesday_event_id uuid references public.trivia_tuesday_events(id);
alter table public.sessions add column if not exists is_test boolean not null default false;
alter table public.sessions add column if not exists trivia_tuesday_theme text;
alter table public.rickhouse_games add column if not exists trivia_tuesday_event_id uuid references public.trivia_tuesday_events(id);
alter table public.rickhouse_games add column if not exists is_test boolean not null default false;

create table if not exists public.trivia_tuesday_results (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.trivia_tuesday_events(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  game_id uuid not null references public.rickhouse_games(id) on delete cascade,
  placements jsonb not null,
  completed_at timestamptz not null default now(),
  unique(event_id, game_id)
);

alter table public.trivia_tuesday_events enable row level security;
alter table public.trivia_tuesday_results enable row level security;
-- These tables are only accessed by trusted server routes.  Do not expose
-- event creation, scheduled boards, or historical results to browser clients.
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
