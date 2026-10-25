-- Thigh circumference, left and right, 6 inches above the kneecap (tape,
-- inches, manual entry), for the left-leg rebuild. Same shape as the other
-- tape columns (waist_hip_in, waist_gut_in). Additive; safe to rerun.

alter table public.body_metrics
  add column if not exists thigh_l_in numeric(5, 2),
  add column if not exists thigh_r_in numeric(5, 2);
