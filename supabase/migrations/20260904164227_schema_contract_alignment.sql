alter table public.campus_locations
  add column if not exists created_at timestamptz not null default now();

-- Student identity claims require an exact verified roster email.
alter table public.student_roster
  alter column roster_email set not null;
