-- A reviewed obsolete failure is cancelled, never reported as successful.
-- Apply this enum change before the separate recovery transaction uses it.
alter type public.job_status add value if not exists 'cancelled';
