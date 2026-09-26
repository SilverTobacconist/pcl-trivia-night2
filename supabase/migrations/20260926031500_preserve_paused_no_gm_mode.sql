create or replace function public.resume_no_gm_session(p_session_id uuid)
returns public.session_controls
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_player_id uuid;
  v_control public.session_controls;
  v_question_status text;
  v_duration_seconds integer;
begin
  select id into v_player_id
  from public.players
  where session_id = p_session_id
    and auth_user_id = auth.uid()
    and left_at is null;

  if v_player_id is null then
    raise exception 'You must be an active player in this game to resume it.';
  end if;

  select question_status, coalesce(question_duration_seconds, 60)
  into v_question_status, v_duration_seconds
  from public.sessions
  where id = p_session_id;

  if not found then
    raise exception 'Game session not found.';
  end if;

  update public.session_controls
  set state = 'main_active',
      decision_player_id = v_player_id,
      timeout_at = null,
      last_activity_at = now(),
      updated_at = now()
  where session_id = p_session_id
    and state = 'timeout'
  returning * into v_control;

  if not found then
    raise exception 'This game is not waiting to be resumed.';
  end if;

  update public.sessions
  set question_status = case when v_question_status = 'timeout' then 'ready' else v_question_status end,
      question_started_at = case when v_question_status = 'active' then now() else question_started_at end,
      question_ends_at = case
        when v_question_status = 'active' then now() + make_interval(secs => v_duration_seconds)
        when v_question_status = 'revealed' then now()
        else question_ends_at
      end,
      show_answer = (v_question_status = 'revealed')
  where id = p_session_id;

  return v_control;
end;
$$;

revoke all on function public.resume_no_gm_session(uuid) from public;
grant execute on function public.resume_no_gm_session(uuid) to authenticated;
