create or replace function public.advance_no_gm_question_count(p_session_id uuid, p_next_count integer)
returns public.session_controls
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_control public.session_controls;
begin
  if p_next_count < 1 or not exists (
    select 1 from public.players
    where session_id = p_session_id and auth_user_id = auth.uid() and left_at is null
  ) then
    raise exception 'You must be an active player to advance this game.';
  end if;

  update public.session_controls
  set main_question_count = p_next_count,
      updated_at = now(),
      last_activity_at = now()
  where ctid = (
    select ctid from public.session_controls
    where session_id = p_session_id
    order by updated_at desc
    limit 1
  )
    and coalesce(main_question_count, 0) = p_next_count - 1
  returning * into v_control;

  if not found then
    raise exception 'Question count could not be advanced.';
  end if;
  return v_control;
end;
$$;

revoke all on function public.advance_no_gm_question_count(uuid, integer) from public;
revoke all on function public.advance_no_gm_question_count(uuid, integer) from anon;
grant execute on function public.advance_no_gm_question_count(uuid, integer) to authenticated;
