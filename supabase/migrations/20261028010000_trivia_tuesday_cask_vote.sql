alter table public.rickhouse_games
  add column if not exists cask_strength_difficulty text,
  add column if not exists cask_strength_vote_ends_at timestamptz;

create table if not exists public.rickhouse_cask_strength_votes (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.rickhouse_games(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  difficulty text not null check (difficulty in ('Easy', 'Medium', 'Hard', 'Extra Hard')),
  created_at timestamptz not null default now(),
  unique (game_id, player_id)
);

alter table public.rickhouse_cask_strength_votes enable row level security;
revoke all on public.rickhouse_cask_strength_votes from anon, authenticated;
grant select, insert, update, delete on public.rickhouse_cask_strength_votes to service_role;
create index if not exists rickhouse_cask_strength_votes_game_idx on public.rickhouse_cask_strength_votes(game_id);
