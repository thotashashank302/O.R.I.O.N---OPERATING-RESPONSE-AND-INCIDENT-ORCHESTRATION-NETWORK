-- Cross-team integration additions reviewed by Developer 1.
-- Keep the original normalized identity and workflow model; add only timestamps
-- needed by optimistic UI updates from the operations slice.

alter table public.incident_tasks
  add column if not exists updated_at timestamptz not null default now();

alter table public.incidents
  add column if not exists location_text text,
  add column if not exists triage_summary text,
  add column if not exists clarification_request jsonb;

create table if not exists public.incident_attachments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  incident_id uuid not null,
  uploader_membership_id uuid not null,
  storage_key text not null unique,
  file_name text not null,
  file_size integer not null check (file_size > 0 and file_size <= 5242880),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  created_at timestamptz not null default now(),
  foreign key (incident_id, institution_id) references public.incidents(id, institution_id) on delete cascade,
  foreign key (uploader_membership_id, institution_id) references public.institution_memberships(id, institution_id)
);

alter table public.incident_attachments enable row level security;
create policy incident_attachments_authorized_select on public.incident_attachments
  for select to authenticated using (private.can_read_incident(incident_id));

grant select on public.incident_tasks to authenticated;
grant all on public.incident_tasks to service_role;
grant select on public.incident_attachments to authenticated;
grant all on public.incident_attachments to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidence-vault', 'evidence-vault', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
