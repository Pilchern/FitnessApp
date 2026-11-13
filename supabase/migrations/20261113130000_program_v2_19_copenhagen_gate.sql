-- Program v2.19 follow-up (2026-11-13): the short-lever Copenhagen plank in
-- the Core (after ride) sessions joins only once the PT clears adductor_ok.
-- 20261113120000 took its template from the live week-9 On-ramp row of the
-- same name, which has no gate, so the new rows went in ungated. Idempotent.

update public.program_exercises e
set gate_key = 'adductor_ok',
    cue = 'Knee on the bench (short lever), hips stacked, body straight.',
    updated_at = now()
from public.program_sessions s
join public.program_blocks b on b.id = s.block_id and b.deleted_at is null
join public.training_programs p on p.id = b.program_id and p.is_active and p.deleted_at is null
where e.program_session_id = s.id and s.deleted_at is null
  and s.name = 'Core (after ride)'
  and e.deleted_at is null
  and e.exercise_name = 'Copenhagen Side Plank (short lever)'
  and e.gate_key is distinct from 'adductor_ok';
