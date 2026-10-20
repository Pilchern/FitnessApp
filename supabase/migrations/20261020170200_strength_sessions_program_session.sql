-- B-10: a logged lift remembers the program session it fulfils, so the
-- program's Done state survives a late log or two lifts on one day. Nullable:
-- manual logging and every older row stay unlinked and keep the date match.
--
-- The foreign key pairs the id with user_id, like every other reference to
-- program_sessions, so a lift can only point at its owner's program. Deleting
-- a program session clears just the link (PostgreSQL 15+ column list); the
-- lift and its user_id stay. Program sessions are normally soft-deleted, so
-- this only matters for a hard delete.
--
-- RLS: strength_sessions already has select/insert/update policies on
-- owns_row(user_id); a new column needs no policy change.

alter table public.strength_sessions
  add column if not exists program_session_id uuid;

alter table public.strength_sessions
  drop constraint if exists strength_sessions_program_session_fk,
  add constraint strength_sessions_program_session_fk
    foreign key (program_session_id, user_id)
    references public.program_sessions (id, user_id)
    on delete set null (program_session_id);

create index if not exists strength_sessions_program_session_idx
  on public.strength_sessions (program_session_id, user_id)
  where program_session_id is not null;

-- Conservative backfill. A lift is linked only when all of these hold:
--   * it is live, unlinked and has at least one live set;
--   * it is the only such lift its owner logged that day;
--   * the owner's active program has no manual block activated by that day,
--     and the block whose week range holds that day is a plain week block
--     (not a gate block, whose schedule depends on clearance dates);
--   * that block (or the block it borrows sessions from) schedules exactly
--     one live, ungated lift session on that weekday.
-- Anything else stays null and keeps the date match. Re-running finds nothing
-- new: linked rows are skipped.
with lifts as (
  select ss.id, ss.user_id, ss.session_date
  from public.strength_sessions ss
  where ss.deleted_at is null
    and ss.program_session_id is null
    and exists (
      select 1 from public.strength_exercise_sets st
      where st.strength_session_id = ss.id and st.deleted_at is null
    )
),
single_lift_days as (
  select user_id, session_date
  from lifts
  group by user_id, session_date
  having count(*) = 1
),
candidates as (
  select l.id as strength_session_id, ps.id as program_session_id
  from lifts l
  join single_lift_days d
    on d.user_id = l.user_id and d.session_date = l.session_date
  join public.training_programs p
    on p.user_id = l.user_id and p.is_active and p.deleted_at is null
  join public.program_blocks b
    on b.program_id = p.id
   and b.deleted_at is null
   and b.activation = 'week'
   and floor((l.session_date - p.week_anchor_date) / 7.0)
       between b.start_week and b.end_week
  join public.program_sessions ps
    on ps.user_id = l.user_id
   and ps.deleted_at is null
   and ps.session_type = 'lift'
   and ps.gate_key is null
   and ps.day_of_week = extract(dow from l.session_date)
   and ps.block_id = case
         when exists (
           select 1 from public.program_sessions own
           where own.block_id = b.id and own.deleted_at is null
         ) then b.id
         else coalesce(b.sessions_from_block_id, b.id)
       end
  where not exists (
    -- No overlapping week or gate block that could run instead.
    select 1 from public.program_blocks o
    where o.program_id = p.id
      and o.deleted_at is null
      and o.activation <> 'manual'
      and o.id <> b.id
      and floor((l.session_date - p.week_anchor_date) / 7.0)
          between o.start_week and o.end_week
  )
  and not exists (
    select 1 from public.program_blocks m
    where m.program_id = p.id
      and m.deleted_at is null
      and m.activation = 'manual'
      and m.activated_on is not null
      and m.activated_on <= l.session_date
  )
),
unique_candidates as (
  select strength_session_id, min(program_session_id::text)::uuid as program_session_id
  from candidates
  group by strength_session_id
  having count(*) = 1
)
update public.strength_sessions ss
set program_session_id = u.program_session_id
from unique_candidates u
where ss.id = u.strength_session_id
  and ss.program_session_id is null;
