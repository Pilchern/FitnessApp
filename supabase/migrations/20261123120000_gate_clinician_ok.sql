-- Gate clinician OK (owner request 2026-11-23).
--
-- A PT or ortho OK recorded on its own: one criterion on the jog, plyo and
-- return-to-sport boards, separate from clearing the gate (cleared_on),
-- which still unlocks sessions. Additive and idempotent. Older code ignores
-- the new columns (its row schema strips unknown keys), so this can be
-- applied before the code merges.

alter table public.program_gates
  add column if not exists clinician_ok_on date,
  add column if not exists clinician_ok_by text
    check (clinician_ok_by is null or clinician_ok_by in ('pt', 'ortho'));

comment on column public.program_gates.clinician_ok_on is
  'Date a PT or ortho OK''d this gate. One board criterion; does not clear the gate.';
