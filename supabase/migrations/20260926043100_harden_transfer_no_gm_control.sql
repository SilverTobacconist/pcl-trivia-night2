create or replace function public.transfer_no_gm_control(
  p_session_id uuid,
  p_target_player_id uuid,
  p_leave_current boolean default false
)
returns public.session_controls
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_current_player_id uuid;
  v_control public.session_controls;
begin
  select p.id into v_current_player_id
  from public.players p
  join lateral (
    select decision_player_id
    from public.session_controls
    where session_id = p_session_id
    order by updated_at desc
    limit 1
  ) c on true
  where p.session_id = p_session_id
    and p.auth_user_id = auth.uid()
    and p.left_at is null
    and c.decision_player_id = p.id;

  if v_current_player_id is null then
    raise exception 'Only the active Decision Player can pass control.';
  end if;

  if p_target_player_id = v_current_player_id then
    raise exception 'Choose another active player to take control.';
  end if;

  if not exists (
    select 1 from public.players
    where id = p_target_player_id
      and session_id = p_session_id
      and left_at is null
  ) then
    raise exception 'Choose a player who is still in this game.';
  end if;

  update public.session_controls
  set decision_player_id = p_target_player_id,
      updated_at = now(),
      last_activity_at = now()
  where ctid = (
    select ctid
    from public.session_controls
    where session_id = p_session_id
    order by updated_at desc
    limit 1
  )
  returning * into v_control;

  if not found then
    raise exception 'Game control was not found.';
  end if;

  if p_leave_current then
    update public.players
    set left_at = now()
    where id = v_current_player_id;
  end if;

  return v_control;
end;
$$;

revoke all on function public.transfer_no_gm_control(uuid, uuid, boolean) from public;
revoke all on function public.transfer_no_gm_control(uuid, uuid, boolean) from anon;
grant execute on function public.transfer_no_gm_control(uuid, uuid, boolean) to authenticated;
