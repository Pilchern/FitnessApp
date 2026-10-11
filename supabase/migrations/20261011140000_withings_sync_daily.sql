-- Withings sync: weekly -> daily.
--
-- The dashboard's 7-day average weight and the surplus-throttle flag lag up
-- to six days when Withings only syncs on Mondays. Run it every day at 13:30
-- UTC (8:30 AM Central in summer, 7:30 AM in winter), after the usual
-- morning weigh-in. Alters the existing job in place, keeping its name so
-- nothing else that refers to it changes. Idempotent: re-running sets the
-- same schedule; a no-op if the job does not exist.

select cron.alter_job(job_id := jobid, schedule := '30 13 * * *')
from cron.job
where jobname = 'withings-weekly-sync';
