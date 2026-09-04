-- Initial ORION tenant, workflow, agent, and durable-job schema.
create extension if not exists pgcrypto;
create schema if not exists private;

create type public.membership_status as enum ('active', 'inactive');
create type public.availability_status as enum ('available', 'busy', 'off_duty');
create type public.incident_status as enum ('reported', 'triaging', 'needs_clarification', 'planned', 'awaiting_approval', 'assigned', 'acknowledged', 'in_progress', 'submitted_for_verification', 'resolved', 'reopened', 'escalated', 'cancelled');
create type public.task_status as enum ('pending', 'ready', 'assigned', 'acknowledged', 'in_progress', 'blocked', 'submitted', 'verified', 'failed', 'cancelled');
create type public.assignment_status as enum ('offered', 'acknowledged', 'active', 'handover_requested', 'released', 'completed', 'cancelled');
create type public.job_status as enum ('queued', 'running', 'succeeded', 'retry_wait', 'dead');
create type public.email_status as enum ('queued', 'sending', 'sent', 'delivered', 'failed', 'bounced', 'suppressed');
create type public.incident_visibility as enum ('routine', 'restricted', 'confidential');
create type public.incident_severity as enum ('low', 'normal', 'high', 'critical');
create type public.role_name as enum ('principal', 'admin', 'hod', 'supervisor', 'cr', 'student', 'staff', 'transport_admin', 'president', 'coordinator', 'safeguarding_officer');

create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  approval_state text not null default 'pending' check (approval_state in ('pending', 'approved', 'rejected')),
  is_demo boolean not null default false,
  approved_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table public.institution_memberships (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.membership_status not null default 'active',
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, institution_id),
  unique (id, institution_id)
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('academic', 'service')),
  unique (institution_id, name),
  unique (id, institution_id)
);

create table public.sections (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  department_id uuid not null,
  name text not null,
  academic_term text not null,
  unique (institution_id, department_id, name, academic_term),
  unique (id, institution_id),
  foreign key (department_id, institution_id) references public.departments(id, institution_id)
);

create table public.campus_locations (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  parent_id uuid,
  kind text not null check (kind in ('campus', 'block', 'floor', 'room', 'lab', 'route', 'other')),
  label text not null,
  asset_counts jsonb not null default '{}'::jsonb,
  unique (id, institution_id),
  foreign key (parent_id, institution_id) references public.campus_locations(id, institution_id)
);

create table public.role_grants (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  membership_id uuid not null,
  role public.role_name not null,
  department_id uuid,
  section_id uuid,
  club_id uuid,
  cr_seat smallint check (cr_seat in (1, 2)),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  granted_by uuid not null,
  revoked_at timestamptz,
  revoked_by uuid,
  revocation_reason text,
  created_at timestamptz not null default now(),
  unique (id, institution_id),
  foreign key (membership_id, institution_id) references public.institution_memberships(id, institution_id),
  foreign key (department_id, institution_id) references public.departments(id, institution_id),
  foreign key (section_id, institution_id) references public.sections(id, institution_id),
  foreign key (granted_by, institution_id) references public.institution_memberships(id, institution_id),
  foreign key (revoked_by, institution_id) references public.institution_memberships(id, institution_id),
  check ((role = 'cr' and section_id is not null and cr_seat is not null) or (role <> 'cr' and cr_seat is null)),
  check (ends_at is null or ends_at > starts_at)
);

create unique index role_grants_active_cr_seat_idx on public.role_grants(institution_id, section_id, cr_seat)
where role = 'cr' and revoked_at is null;

create table public.student_roster (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  roll_number text not null,
  roster_email text,
  department_id uuid not null,
  section_id uuid,
  academic_year smallint,
  residence_kind text check (residence_kind in ('hostel', 'day_scholar')),
  claimed_user_id uuid references auth.users(id),
  unique (institution_id, roll_number),
  foreign key (department_id, institution_id) references public.departments(id, institution_id),
  foreign key (section_id, institution_id) references public.sections(id, institution_id)
);

create table public.staff_capabilities (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  membership_id uuid not null,
  skills text[] not null default '{}',
  zones uuid[] not null default '{}',
  availability public.availability_status not null default 'off_duty',
  workload_limit integer not null default 1 check (workload_limit > 0),
  version integer not null default 1,
  updated_by uuid not null,
  updated_at timestamptz not null default now(),
  unique (membership_id),
  foreign key (membership_id, institution_id) references public.institution_memberships(id, institution_id),
  foreign key (updated_by, institution_id) references public.institution_memberships(id, institution_id)
);

create table public.transport_enrollments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  membership_id uuid not null,
  route_code text not null,
  bus_code text,
  verified_by uuid,
  active boolean not null default false,
  unique (institution_id, membership_id, route_code),
  foreign key (membership_id, institution_id) references public.institution_memberships(id, institution_id),
  foreign key (verified_by, institution_id) references public.institution_memberships(id, institution_id)
);

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name text not null,
  unique (institution_id, name),
  unique (id, institution_id)
);

alter table public.role_grants add foreign key (club_id, institution_id) references public.clubs(id, institution_id);

create table public.club_terms (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  club_id uuid not null,
  president_membership_id uuid,
  coordinator_membership_id uuid,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  foreign key (club_id, institution_id) references public.clubs(id, institution_id),
  foreign key (president_membership_id, institution_id) references public.institution_memberships(id, institution_id),
  foreign key (coordinator_membership_id, institution_id) references public.institution_memberships(id, institution_id),
  check (ends_at > starts_at)
);

create table public.category_routes (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  category text not null,
  responsible_department_id uuid,
  verifier_role public.role_name not null,
  emergency_contact_membership_id uuid,
  safety_floor public.incident_severity not null default 'normal',
  unique (institution_id, category),
  foreign key (responsible_department_id, institution_id) references public.departments(id, institution_id),
  foreign key (emergency_contact_membership_id, institution_id) references public.institution_memberships(id, institution_id)
);

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  reporter_membership_id uuid not null,
  accused_membership_id uuid,
  reporting_scope jsonb not null default '{}'::jsonb,
  category text not null,
  visibility public.incident_visibility not null default 'routine',
  location_id uuid,
  description text not null check (char_length(description) between 1 and 5000),
  severity public.incident_severity not null default 'normal',
  state public.incident_status not null default 'reported',
  version integer not null default 1 check (version > 0),
  plan_version integer not null default 0 check (plan_version >= 0),
  resolution_version integer not null default 0 check (resolution_version >= 0),
  parent_duplicate_id uuid,
  resolved_at timestamptz,
  cancelled_at timestamptz,
  reopened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, institution_id),
  foreign key (reporter_membership_id, institution_id) references public.institution_memberships(id, institution_id),
  foreign key (accused_membership_id, institution_id) references public.institution_memberships(id, institution_id),
  foreign key (location_id, institution_id) references public.campus_locations(id, institution_id),
  foreign key (parent_duplicate_id, institution_id) references public.incidents(id, institution_id),
  check (parent_duplicate_id is null or parent_duplicate_id <> id)
);

create table public.incident_votes (
  incident_id uuid not null,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  membership_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (incident_id, membership_id),
  foreign key (incident_id, institution_id) references public.incidents(id, institution_id),
  foreign key (membership_id, institution_id) references public.institution_memberships(id, institution_id)
);

create table public.incident_case_access (
  incident_id uuid not null,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  membership_id uuid not null,
  granted_by uuid not null,
  created_at timestamptz not null default now(),
  primary key (incident_id, membership_id),
  foreign key (incident_id, institution_id) references public.incidents(id, institution_id),
  foreign key (membership_id, institution_id) references public.institution_memberships(id, institution_id),
  foreign key (granted_by, institution_id) references public.institution_memberships(id, institution_id)
);

create table public.agent_runs (
  id uuid primary key,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  incident_id uuid not null,
  agent_name text not null check (agent_name in ('triage', 'commander', 'specialist', 'verification')),
  provider text not null,
  model text not null,
  prompt_version text not null,
  latency_ms integer not null check (latency_ms >= 0),
  status text not null check (status in ('succeeded', 'failed')),
  validated_outcome jsonb,
  safe_error text,
  created_at timestamptz not null default now(),
  unique (id, institution_id),
  foreign key (incident_id, institution_id) references public.incidents(id, institution_id)
);

create table public.incident_plans (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  incident_id uuid not null,
  version integer not null check (version > 0),
  priority public.incident_severity not null,
  explanation text not null,
  acknowledgement_minutes integer not null check (acknowledgement_minutes between 1 and 240),
  status text not null default 'active' check (status in ('draft', 'active', 'superseded', 'completed', 'cancelled')),
  agent_run_id uuid,
  created_at timestamptz not null default now(),
  unique (incident_id, version),
  unique (id, institution_id),
  foreign key (incident_id, institution_id) references public.incidents(id, institution_id),
  foreign key (agent_run_id, institution_id) references public.agent_runs(id, institution_id)
);

create table public.incident_tasks (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  plan_id uuid not null,
  local_id text not null,
  logical_task_key text not null,
  specialist_profile text not null,
  goal text not null,
  checklist jsonb not null default '[]'::jsonb,
  state public.task_status not null default 'pending',
  evidence_requirements jsonb not null,
  evidence_version integer not null default 1,
  requires_approval boolean not null default false,
  designated_verifier_membership_id uuid,
  verifier_due_at timestamptz,
  carried_from_task_id uuid,
  created_at timestamptz not null default now(),
  unique (plan_id, local_id),
  unique (id, institution_id),
  foreign key (plan_id, institution_id) references public.incident_plans(id, institution_id),
  foreign key (designated_verifier_membership_id, institution_id) references public.institution_memberships(id, institution_id),
  foreign key (carried_from_task_id, institution_id) references public.incident_tasks(id, institution_id)
);

create table public.task_dependencies (
  institution_id uuid not null references public.institutions(id) on delete cascade,
  task_id uuid not null,
  prerequisite_task_id uuid not null,
  primary key (task_id, prerequisite_task_id),
  foreign key (task_id, institution_id) references public.incident_tasks(id, institution_id),
  foreign key (prerequisite_task_id, institution_id) references public.incident_tasks(id, institution_id),
  check (task_id <> prerequisite_task_id)
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  task_id uuid not null,
  assignee_membership_id uuid not null,
  state public.assignment_status not null default 'offered',
  acknowledgement_deadline timestamptz not null,
  version integer not null default 1 check (version > 0),
  active_version boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, institution_id),
  foreign key (task_id, institution_id) references public.incident_tasks(id, institution_id),
  foreign key (assignee_membership_id, institution_id) references public.institution_memberships(id, institution_id)
);

create unique index assignments_one_active_per_task_idx on public.assignments(task_id) where active_version;

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  incident_id uuid not null,
  action_payload_hash text not null,
  plan_version integer not null,
  approver_membership_id uuid,
  decision text check (decision in ('approved', 'rejected')),
  reason text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (incident_id, institution_id) references public.incidents(id, institution_id),
  foreign key (approver_membership_id, institution_id) references public.institution_memberships(id, institution_id)
);

create table public.resolution_evidence (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  task_id uuid not null,
  uploader_membership_id uuid not null,
  kind text not null check (kind in ('note', 'test_result', 'photo')),
  storage_key text,
  structured_result jsonb,
  evidence_version integer not null,
  created_at timestamptz not null default now(),
  foreign key (task_id, institution_id) references public.incident_tasks(id, institution_id),
  foreign key (uploader_membership_id, institution_id) references public.institution_memberships(id, institution_id)
);

create table public.verification_records (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  task_id uuid not null,
  evidence_version integer not null,
  human_result text check (human_result in ('pass', 'fail', 'pending')),
  agent_verdict text not null check (agent_verdict in ('pass', 'fail', 'needs_human_review')),
  reasons jsonb not null,
  verifier_membership_id uuid,
  created_at timestamptz not null default now(),
  foreign key (task_id, institution_id) references public.incident_tasks(id, institution_id),
  foreign key (verifier_membership_id, institution_id) references public.institution_memberships(id, institution_id)
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  type text not null,
  incident_id uuid,
  due_at timestamptz not null default now(),
  status public.job_status not null default 'queued',
  attempt integer not null default 0 check (attempt >= 0),
  lease_until timestamptz,
  worker_id text,
  dedupe_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (incident_id, institution_id) references public.incidents(id, institution_id)
);

create index jobs_due_idx on public.jobs(status, due_at);
create index jobs_lease_idx on public.jobs(lease_until) where status = 'running';

create table public.incident_events (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  incident_id uuid not null,
  actor_membership_id uuid,
  actor_type text not null,
  action text not null,
  safe_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (incident_id, institution_id) references public.incidents(id, institution_id),
  foreign key (actor_membership_id, institution_id) references public.institution_memberships(id, institution_id)
);

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  assignment_id uuid,
  assignment_version integer,
  recipient text not null,
  message_type text not null,
  idempotency_key text not null unique,
  provider_id text,
  transport_state public.email_status not null default 'queued',
  action_token_ciphertext text,
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, institution_id),
  foreign key (assignment_id, institution_id) references public.assignments(id, institution_id)
);

create table public.email_events (
  provider_event_id text primary key,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  outbox_id uuid not null,
  type text not null,
  happened_at timestamptz not null,
  processed_at timestamptz not null default now(),
  foreign key (outbox_id, institution_id) references public.email_outbox(id, institution_id) on delete cascade
);

create table public.email_action_tokens (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  assignment_id uuid not null,
  assignment_version integer not null,
  intended_membership_id uuid not null,
  nonce_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  foreign key (assignment_id, institution_id) references public.assignments(id, institution_id),
  foreign key (intended_membership_id, institution_id) references public.institution_memberships(id, institution_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  recipient_membership_id uuid not null,
  safe_text text not null,
  link text,
  read_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  foreign key (recipient_membership_id, institution_id) references public.institution_memberships(id, institution_id)
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  actor_membership_id uuid,
  action text not null,
  target_type text not null,
  target_id uuid,
  safe_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (actor_membership_id, institution_id) references public.institution_memberships(id, institution_id)
);

create table public.rate_limit_counters (
  institution_id uuid not null references public.institutions(id) on delete cascade,
  membership_id uuid not null,
  action_key text not null,
  window_started_at timestamptz not null,
  count integer not null default 0 check (count >= 0),
  primary key (membership_id, action_key, window_started_at),
  foreign key (membership_id, institution_id) references public.institution_memberships(id, institution_id)
);

create table public.incident_feedback (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  incident_id uuid not null,
  resolution_version integer not null,
  reporter_membership_id uuid not null,
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (incident_id, resolution_version, reporter_membership_id),
  foreign key (incident_id, institution_id) references public.incidents(id, institution_id),
  foreign key (reporter_membership_id, institution_id) references public.institution_memberships(id, institution_id)
);

create index memberships_user_idx on public.institution_memberships(user_id);
create index role_grants_membership_idx on public.role_grants(membership_id);
create index incidents_institution_state_idx on public.incidents(institution_id, state);
create index incident_case_access_member_idx on public.incident_case_access(membership_id);
create index assignments_assignee_idx on public.assignments(assignee_membership_id);
create index notifications_recipient_idx on public.notifications(recipient_membership_id, read_at);

create or replace function private.is_active_member(target_institution uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.institution_memberships membership
    where membership.institution_id = target_institution
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
  );
$$;

create or replace function private.current_membership_id(target_institution uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select membership.id from public.institution_memberships membership
  where membership.institution_id = target_institution
    and membership.user_id = (select auth.uid())
    and membership.status = 'active'
  limit 1;
$$;

create or replace function private.can_read_incident(target_incident uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.incidents incident
    join public.institution_memberships membership
      on membership.institution_id = incident.institution_id
     and membership.user_id = (select auth.uid())
     and membership.status = 'active'
    where incident.id = target_incident
      and membership.id is distinct from incident.accused_membership_id
      and (
        incident.visibility <> 'confidential'
        or incident.reporter_membership_id = membership.id
        or exists (
          select 1 from public.incident_case_access access
          where access.incident_id = incident.id and access.membership_id = membership.id
        )
      )
  );
$$;

revoke all on function private.is_active_member(uuid) from public, anon;
revoke all on function private.current_membership_id(uuid) from public, anon;
revoke all on function private.can_read_incident(uuid) from public, anon;
grant execute on function private.is_active_member(uuid), private.current_membership_id(uuid), private.can_read_incident(uuid) to authenticated;

create or replace function public.claim_jobs(worker_id text, batch_size integer, lease_seconds integer)
returns table (id uuid, type text, incident_id uuid, institution_id uuid, attempt integer, payload jsonb, due_at timestamptz, lease_until timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if batch_size < 1 or batch_size > 20 or lease_seconds < 5 or lease_seconds > 300 then
    raise exception 'invalid worker bounds';
  end if;
  return query
  with candidates as (
    select job.id from public.jobs job
    where ((job.status in ('queued', 'retry_wait') and job.due_at <= now())
      or (job.status = 'running' and job.lease_until < now()))
    order by case when job.type in ('ack_reminder', 'assignment_escalation', 'verifier_escalation', 'outbox_delivery') then 0 else 1 end,
      job.due_at
    for update skip locked
    limit batch_size
  ), claimed as (
    update public.jobs job
    set status = 'running', attempt = job.attempt + 1,
      lease_until = now() + make_interval(secs => lease_seconds),
      worker_id = claim_jobs.worker_id, updated_at = now()
    from candidates where job.id = candidates.id
    returning job.*
  )
  select claimed.id, claimed.type, claimed.incident_id, claimed.institution_id,
    claimed.attempt, claimed.payload, claimed.due_at, claimed.lease_until
  from claimed;
end;
$$;

create or replace function public.record_dead_job_escalation(job_id uuid, safe_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare target_job public.jobs;
begin
  select * into target_job from public.jobs where id = job_id and status = 'dead';
  if not found then raise exception 'dead job not found'; end if;
  if target_job.incident_id is not null then
    insert into public.incident_events(institution_id, incident_id, actor_type, action, safe_payload)
    values (target_job.institution_id, target_job.incident_id, 'system', 'job_dead_escalated', jsonb_build_object('jobId', job_id, 'reason', left(safe_reason, 300)));
  end if;
  insert into public.notifications(institution_id, recipient_membership_id, safe_text, link)
  select target_job.institution_id, grant_row.membership_id, 'ORION requires human attention for a failed automation job.',
    case when target_job.incident_id is null then null else '/incidents/' || target_job.incident_id::text end
  from public.role_grants grant_row
  join public.institution_memberships membership on membership.id = grant_row.membership_id and membership.status = 'active'
  where grant_row.institution_id = target_job.institution_id
    and grant_row.role in ('principal', 'hod', 'supervisor')
    and grant_row.revoked_at is null
    and grant_row.starts_at <= now()
    and (grant_row.ends_at is null or grant_row.ends_at > now());
end;
$$;

create or replace function public.persist_commander_plan(job_id uuid, expected_incident_version integer, plan_payload jsonb, agent_run_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare target_job public.jobs;
declare target_incident public.incidents;
declare new_plan_id uuid := gen_random_uuid();
declare prior_plan_id uuid;
declare prior_task public.incident_tasks;
declare task_payload jsonb;
declare dependency text;
declare created_task_id uuid;
declare task_unchanged boolean;
begin
  select * into target_job from public.jobs where id = job_id and status = 'running' for update;
  if not found or target_job.type <> 'commander' or target_job.incident_id is null then raise exception 'invalid commander job'; end if;
  select * into target_incident from public.incidents where id = target_job.incident_id for update;
  if target_incident.version <> expected_incident_version then raise exception 'stale incident version'; end if;
  if not (jsonb_array_length(plan_payload->'tasks') between 1 and 5) then raise exception 'invalid task count'; end if;

  select id into prior_plan_id from public.incident_plans where incident_id = target_incident.id and status = 'active' for update;
  update public.incident_plans set status = 'superseded' where id = prior_plan_id;
  insert into public.incident_plans(id, institution_id, incident_id, version, priority, explanation, acknowledgement_minutes, status, agent_run_id)
  values (new_plan_id, target_incident.institution_id, target_incident.id, target_incident.plan_version + 1,
    (plan_payload->>'priority')::public.incident_severity, plan_payload->>'explanation',
    (plan_payload->>'acknowledgementMinutes')::integer, 'active', agent_run_id);

  for task_payload in select value from jsonb_array_elements(plan_payload->'tasks') loop
    prior_task := null;
    if prior_plan_id is not null then
      select * into prior_task from public.incident_tasks
      where plan_id = prior_plan_id and logical_task_key = task_payload->>'logicalTaskKey'
      limit 1;
    end if;
    task_unchanged := prior_task.id is not null
      and prior_task.goal = task_payload->>'goal'
      and prior_task.evidence_requirements @> task_payload->'evidencePolicy'
      and task_payload->'evidencePolicy' @> prior_task.evidence_requirements;
    if prior_task.id is not null and not task_unchanged and exists (
      select 1 from public.assignments assignment where assignment.task_id = prior_task.id and assignment.active_version
    ) then
      raise exception 'active assignment reconciliation required for task %', prior_task.logical_task_key;
    end if;
    insert into public.incident_tasks(institution_id, plan_id, local_id, logical_task_key, specialist_profile, goal, evidence_requirements, requires_approval, state, evidence_version, carried_from_task_id)
    values (target_incident.institution_id, new_plan_id, task_payload->>'localId', task_payload->>'logicalTaskKey',
      task_payload->>'profile', task_payload->>'goal', task_payload->'evidencePolicy', (task_payload->>'requiresApproval')::boolean,
      case
        when task_unchanged and prior_task.state = 'verified' then 'verified'::public.task_status
        when jsonb_array_length(task_payload->'dependsOn') = 0 then 'ready'::public.task_status
        else 'pending'::public.task_status
      end,
      case when task_unchanged then prior_task.evidence_version else 1 end,
      case when task_unchanged then prior_task.id else null end);
  end loop;

  for task_payload in select value from jsonb_array_elements(plan_payload->'tasks') loop
    select id into created_task_id from public.incident_tasks where plan_id = new_plan_id and local_id = task_payload->>'localId';
    for dependency in select jsonb_array_elements_text(task_payload->'dependsOn') loop
      insert into public.task_dependencies(institution_id, task_id, prerequisite_task_id)
      select target_incident.institution_id, created_task_id, prerequisite.id
      from public.incident_tasks prerequisite where prerequisite.plan_id = new_plan_id and prerequisite.local_id = dependency;
      if not found then raise exception 'unknown task dependency'; end if;
    end loop;
  end loop;

  update public.incidents set plan_version = plan_version + 1, version = version + 1,
    state = case when exists (select 1 from public.incident_tasks where plan_id = new_plan_id and requires_approval) then 'awaiting_approval'::public.incident_status else 'planned'::public.incident_status end,
    updated_at = now()
  where id = target_incident.id;
  insert into public.incident_events(institution_id, incident_id, actor_type, action, safe_payload)
  values (target_incident.institution_id, target_incident.id, 'agent', 'commander_plan_created', jsonb_build_object('planId', new_plan_id, 'version', target_incident.plan_version + 1));
  insert into public.jobs(institution_id, type, incident_id, dedupe_key, payload)
  select task.institution_id, 'specialist', target_incident.id,
    'specialist:' || task.id::text || ':e' || task.evidence_version::text,
    jsonb_build_object('taskId', task.id)
  from public.incident_tasks task
  where task.plan_id = new_plan_id and task.state = 'ready';
  return new_plan_id;
end;
$$;

create or replace function private.get_specialist_context(job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare target_job public.jobs;
declare target_task public.incident_tasks;
declare target_plan public.incident_plans;
declare target_incident public.incidents;
begin
  select * into target_job from public.jobs where id = job_id and status = 'running';
  if not found or target_job.type <> 'specialist' or target_job.incident_id is null then raise exception 'invalid specialist job'; end if;
  select * into target_task from public.incident_tasks where id = (target_job.payload->>'taskId')::uuid;
  if not found or target_task.institution_id <> target_job.institution_id or target_task.state <> 'ready' then raise exception 'task is not ready'; end if;
  select * into target_plan from public.incident_plans where id = target_task.plan_id and status = 'active';
  if not found then raise exception 'active plan not found'; end if;
  select * into target_incident from public.incidents where id = target_plan.incident_id and id = target_job.incident_id;
  if not found then raise exception 'incident not found'; end if;
  if exists (
    select 1 from public.task_dependencies dependency
    join public.incident_tasks prerequisite on prerequisite.id = dependency.prerequisite_task_id
    where dependency.task_id = target_task.id and prerequisite.state <> 'verified'
  ) then raise exception 'task dependencies are incomplete'; end if;

  return jsonb_build_object(
    'incidentVersion', target_incident.version,
    'task', jsonb_build_object(
      'id', target_task.id,
      'profile', target_task.specialist_profile,
      'goal', target_task.goal,
      'evidencePolicy', target_task.evidence_requirements,
      'requiresApproval', target_task.requires_approval
    ),
    'severity', target_incident.severity,
    'eligibleStaff', coalesce((
      select jsonb_agg(jsonb_build_object(
        'membershipId', capability.membership_id,
        'skills', capability.skills,
        'availability', capability.availability,
        'activeAssignments', (
          select count(*) from public.assignments assignment
          where assignment.assignee_membership_id = capability.membership_id
            and assignment.active_version
            and assignment.state in ('offered', 'acknowledged', 'active', 'handover_requested')
        ),
        'workloadLimit', capability.workload_limit,
        'capabilityVersion', capability.version
      ))
      from public.staff_capabilities capability
      join public.institution_memberships membership on membership.id = capability.membership_id
      where capability.institution_id = target_job.institution_id
        and membership.status = 'active'
        and capability.availability = 'available'
        and target_task.specialist_profile = any(capability.skills)
        and (select count(*) from public.assignments assignment
          where assignment.assignee_membership_id = capability.membership_id
            and assignment.active_version
            and assignment.state in ('offered', 'acknowledged', 'active', 'handover_requested')) < capability.workload_limit
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function private.persist_specialist_action(job_id uuid, expected_incident_version integer, expected_staff_version integer, action_payload jsonb, agent_run_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare target_job public.jobs;
declare target_task public.incident_tasks;
declare target_plan public.incident_plans;
declare target_incident public.incidents;
declare target_capability public.staff_capabilities;
declare assignment_id uuid;
declare outbox_id uuid;
declare recipient text;
declare acknowledgement_deadline timestamptz;
begin
  select * into target_job from public.jobs where id = job_id and status = 'running' for update;
  if not found or target_job.type <> 'specialist' then raise exception 'invalid specialist job'; end if;
  select * into target_task from public.incident_tasks where id = (action_payload->>'taskId')::uuid for update;
  if not found or target_task.institution_id <> target_job.institution_id or target_task.state <> 'ready' then raise exception 'task is not ready'; end if;
  select * into target_plan from public.incident_plans where id = target_task.plan_id and status = 'active';
  if not found then raise exception 'active plan not found'; end if;
  select * into target_incident from public.incidents where id = target_plan.incident_id for update;
  if target_incident.id <> target_job.incident_id or target_incident.version <> expected_incident_version then raise exception 'stale incident version'; end if;
  if exists (
    select 1 from public.task_dependencies dependency join public.incident_tasks prerequisite on prerequisite.id = dependency.prerequisite_task_id
    where dependency.task_id = target_task.id and prerequisite.state <> 'verified'
  ) then raise exception 'task dependencies are incomplete'; end if;

  select * into target_capability from public.staff_capabilities
  where membership_id = (action_payload->>'candidateStaffId')::uuid for update;
  if not found or target_capability.institution_id <> target_job.institution_id
    or target_capability.version <> expected_staff_version
    or target_capability.availability <> 'available'
    or not (target_task.specialist_profile = any(target_capability.skills)) then raise exception 'staff eligibility changed'; end if;
  if (select count(*) from public.assignments assignment where assignment.assignee_membership_id = target_capability.membership_id
      and assignment.active_version and assignment.state in ('offered', 'acknowledged', 'active', 'handover_requested')) >= target_capability.workload_limit then
    raise exception 'staff capacity changed';
  end if;

  update public.incident_tasks set checklist = action_payload->'checklist', evidence_requirements = action_payload->'evidenceRequired' where id = target_task.id;
  if target_task.requires_approval or action_payload->>'communicationType' = 'approval_request' then
    insert into public.approvals(institution_id, incident_id, action_payload_hash, plan_version)
    values (target_job.institution_id, target_incident.id, encode(digest(action_payload::text, 'sha256'), 'hex'), target_plan.version);
    insert into public.notifications(institution_id, recipient_membership_id, safe_text, link)
    select target_job.institution_id, grant_row.membership_id, 'An ORION action requires approval.', '/incidents/' || target_incident.id::text
    from public.role_grants grant_row
    join public.institution_memberships membership on membership.id = grant_row.membership_id and membership.status = 'active'
    where grant_row.institution_id = target_job.institution_id and grant_row.role in ('principal', 'hod', 'supervisor')
      and grant_row.revoked_at is null and grant_row.starts_at <= now() and (grant_row.ends_at is null or grant_row.ends_at > now());
    return null;
  end if;

  acknowledgement_deadline := now() + make_interval(mins => target_plan.acknowledgement_minutes);
  insert into public.assignments(institution_id, task_id, assignee_membership_id, acknowledgement_deadline)
  values (target_job.institution_id, target_task.id, target_capability.membership_id, acknowledgement_deadline)
  returning id into assignment_id;
  update public.incident_tasks set state = 'assigned' where id = target_task.id;
  select auth_user.email into recipient
  from public.institution_memberships membership join auth.users auth_user on auth_user.id = membership.user_id
  where membership.id = target_capability.membership_id and membership.status = 'active';
  if recipient is null then raise exception 'assignee email unavailable'; end if;
  insert into public.email_outbox(institution_id, assignment_id, assignment_version, recipient, message_type, idempotency_key)
  values (target_job.institution_id, assignment_id, 1, recipient, action_payload->>'communicationType', 'assignment:' || assignment_id::text || ':v1')
  returning id into outbox_id;
  insert into public.jobs(institution_id, type, incident_id, dedupe_key, payload)
  values (target_job.institution_id, 'outbox_delivery', target_incident.id, 'outbox:assignment:' || assignment_id::text || ':v1',
    jsonb_build_object('outboxId', outbox_id));
  insert into public.notifications(institution_id, recipient_membership_id, safe_text, link)
  values (target_job.institution_id, target_capability.membership_id, 'A new ORION task requires acknowledgement.', '/assignments/' || assignment_id::text);
  insert into public.incident_events(institution_id, incident_id, actor_type, action, safe_payload)
  values (target_job.institution_id, target_incident.id, 'agent', 'specialist_assignment_created', jsonb_build_object('assignmentId', assignment_id, 'agentRunId', agent_run_id));
  update public.incidents set state = 'assigned', version = version + 1, updated_at = now() where id = target_incident.id;
  return assignment_id;
end;
$$;

create or replace function private.record_email_event(provider_event_id text, provider_email_id text, event_type text, happened_at timestamptz, next_state public.email_status)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare target_outbox public.email_outbox;
begin
  select * into target_outbox from public.email_outbox where provider_id = provider_email_id for update;
  if not found then raise exception 'email outbox not found'; end if;
  insert into public.email_events(provider_event_id, institution_id, outbox_id, type, happened_at)
  values (provider_event_id, target_outbox.institution_id, target_outbox.id, event_type, happened_at)
  on conflict do nothing;
  if not found then return false; end if;
  if target_outbox.last_event_at is null or happened_at >= target_outbox.last_event_at then
    update public.email_outbox set transport_state = next_state, last_event_at = happened_at, updated_at = now() where id = target_outbox.id;
  end if;
  return true;
end;
$$;

create or replace function private.acknowledge_email_assignment(token_id uuid, token_nonce_hash text, expected_assignment_version integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare target_token public.email_action_tokens;
declare target_assignment public.assignments;
declare current_membership uuid;
declare incident_id uuid;
begin
  select * into target_token from public.email_action_tokens where id = token_id for update;
  if not found or target_token.consumed_at is not null or target_token.expires_at <= now() or target_token.nonce_hash <> token_nonce_hash then
    raise exception 'invalid or consumed action token';
  end if;
  current_membership := private.current_membership_id(target_token.institution_id);
  if current_membership is null or current_membership <> target_token.intended_membership_id then raise exception 'action token belongs to another member'; end if;
  select * into target_assignment from public.assignments where id = target_token.assignment_id for update;
  if not found or not target_assignment.active_version or target_assignment.state <> 'offered'
    or target_assignment.version <> expected_assignment_version or target_assignment.version <> target_token.assignment_version
    or target_assignment.assignee_membership_id <> current_membership then raise exception 'assignment is stale or unavailable'; end if;
  update public.email_action_tokens set consumed_at = now() where id = target_token.id;
  update public.assignments set state = 'acknowledged', updated_at = now() where id = target_assignment.id;
  update public.incident_tasks set state = 'acknowledged' where id = target_assignment.task_id;
  select plan.incident_id into incident_id from public.incident_tasks task join public.incident_plans plan on plan.id = task.plan_id where task.id = target_assignment.task_id;
  insert into public.incident_events(institution_id, incident_id, actor_membership_id, actor_type, action, safe_payload)
  values (target_token.institution_id, incident_id, current_membership, 'human', 'assignment_acknowledged', jsonb_build_object('assignmentId', target_assignment.id, 'source', 'signed_email_action'));
  return target_assignment.id;
end;
$$;

create or replace function public.get_specialist_context(job_id uuid)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.get_specialist_context($1) $$;

create or replace function public.persist_specialist_action(job_id uuid, expected_incident_version integer, expected_staff_version integer, action_payload jsonb, agent_run_id uuid)
returns uuid language sql security invoker set search_path = ''
as $$ select private.persist_specialist_action($1, $2, $3, $4, $5) $$;

create or replace function public.record_email_event(provider_event_id text, provider_email_id text, event_type text, happened_at timestamptz, next_state public.email_status)
returns boolean language sql security invoker set search_path = ''
as $$ select private.record_email_event($1, $2, $3, $4, $5) $$;

create or replace function public.acknowledge_email_assignment(token_id uuid, token_nonce_hash text, expected_assignment_version integer)
returns uuid language sql security invoker set search_path = ''
as $$ select private.acknowledge_email_assignment($1, $2, $3) $$;

revoke all on function public.claim_jobs(text, integer, integer) from public, anon, authenticated;
revoke all on function public.record_dead_job_escalation(uuid, text) from public, anon, authenticated;
revoke all on function public.persist_commander_plan(uuid, integer, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.get_specialist_context(uuid) from public, anon, authenticated;
revoke all on function public.persist_specialist_action(uuid, integer, integer, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.record_email_event(text, text, text, timestamptz, public.email_status) from public, anon, authenticated;
revoke all on function public.acknowledge_email_assignment(uuid, text, integer) from public, anon;
revoke all on function private.get_specialist_context(uuid) from public, anon, authenticated;
revoke all on function private.persist_specialist_action(uuid, integer, integer, jsonb, uuid) from public, anon, authenticated;
revoke all on function private.record_email_event(text, text, text, timestamptz, public.email_status) from public, anon, authenticated;
revoke all on function private.acknowledge_email_assignment(uuid, text, integer) from public, anon;
grant execute on function public.claim_jobs(text, integer, integer), public.record_dead_job_escalation(uuid, text), public.persist_commander_plan(uuid, integer, jsonb, uuid), public.get_specialist_context(uuid), public.persist_specialist_action(uuid, integer, integer, jsonb, uuid), public.record_email_event(text, text, text, timestamptz, public.email_status) to service_role;
grant execute on function public.acknowledge_email_assignment(uuid, text, integer) to authenticated;
grant execute on function private.get_specialist_context(uuid), private.persist_specialist_action(uuid, integer, integer, jsonb, uuid), private.record_email_event(text, text, text, timestamptz, public.email_status) to service_role;
grant execute on function private.acknowledge_email_assignment(uuid, text, integer) to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'institutions','profiles','institution_memberships','departments','sections','campus_locations','role_grants',
    'student_roster','staff_capabilities','transport_enrollments','clubs','club_terms','category_routes','incidents',
    'incident_votes','incident_case_access','agent_runs','incident_plans','incident_tasks','task_dependencies',
    'assignments','approvals','resolution_evidence','verification_records','jobs','incident_events','email_outbox',
    'email_events','email_action_tokens','notifications','audit_events','rate_limit_counters','incident_feedback'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
  end loop;
end $$;

grant all on all tables in schema public to service_role;
grant select on public.institutions, public.profiles, public.departments, public.sections,
  public.campus_locations, public.incidents, public.notifications to authenticated;

create policy institutions_member_select on public.institutions for select to authenticated using (private.is_active_member(id));
create policy profiles_self_select on public.profiles for select to authenticated using (id = (select auth.uid()));

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'institution_memberships','departments','sections','campus_locations','role_grants','staff_capabilities','category_routes',
    'incident_votes','incident_plans','incident_tasks','task_dependencies','assignments','approvals','resolution_evidence',
    'verification_records','incident_events'
  ] loop
    execute format('create policy %I on public.%I for select to authenticated using (private.is_active_member(institution_id))', table_name || '_tenant_select', table_name);
  end loop;
end $$;

create policy incidents_authorized_select on public.incidents for select to authenticated using (private.can_read_incident(id));
create policy notifications_own_select on public.notifications for select to authenticated using (recipient_membership_id = private.current_membership_id(institution_id));
drop policy incident_events_tenant_select on public.incident_events;
create policy incident_events_authorized_select on public.incident_events for select to authenticated using (private.can_read_incident(incident_id));

grant usage on schema private to authenticated, service_role;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('incident-evidence', 'incident-evidence', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
