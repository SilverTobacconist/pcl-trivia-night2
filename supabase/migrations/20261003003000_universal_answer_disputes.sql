-- A dispute can now reference any answer-bearing mode, not only main-trivia
-- rows.  The display fields keep voting independent of the source table.
alter table public.answer_disputes
  alter column answer_id drop not null,
  add column if not exists source_type text not null default 'main'
    check (source_type in ('main','rickhouse','aging_room','cask_strength')),
  add column if not exists source_id uuid,
  add column if not exists question_text text,
  add column if not exists correct_answer text,
  add column if not exists submitted_answer text;

update public.answer_disputes
set source_id = answer_id,
    question_text = coalesce(question_text, ''),
    correct_answer = coalesce(correct_answer, ''),
    submitted_answer = coalesce(submitted_answer, '')
where source_id is null;

create index if not exists answer_disputes_source_idx
  on public.answer_disputes (session_id, status, source_type, source_id);
