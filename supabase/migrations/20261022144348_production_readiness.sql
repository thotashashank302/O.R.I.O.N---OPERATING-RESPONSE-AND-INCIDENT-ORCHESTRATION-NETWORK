-- Forward-only hardening. Apply with the matching application and worker stopped.
-- Service-only mutations receive the freshly authenticated membership from HTTP.
create function private.has_current_role(actor uuid, roles public.role_name[], department uuid default null)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.role_grants g join public.institution_memberships m on m.id=g.membership_id
    where m.id=actor and m.status='active' and g.role=any(roles) and g.revoked_at is null
    and g.starts_at<=now() and (g.ends_at is null or g.ends_at>now())
    and (department is null or g.department_id=department));
$$;
create function private.member_can_read_incident(actor uuid,target uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.incidents i join public.institution_memberships m on m.institution_id=i.institution_id
    where i.id=target and m.id=actor and m.status='active' and m.id is distinct from i.accused_membership_id
    and (i.visibility<>'confidential' or i.reporter_membership_id=actor
      or private.has_current_role(actor,array['principal','admin','safeguarding_officer']::public.role_name[])
      or exists(select 1 from public.incident_case_access a where a.incident_id=i.id and a.membership_id=actor))
    and (coalesce(i.reporting_scope->>'kind','student') not in ('transport','club') or i.reporter_membership_id=actor
      or private.has_current_role(actor,array['principal','admin']::public.role_name[])
      or exists(select 1 from public.incident_case_access ca where ca.incident_id=i.id and ca.membership_id=actor)
      or (i.reporting_scope->>'kind'='transport' and (private.has_current_role(actor,array['transport_admin']::public.role_name[]) or exists(select 1 from public.transport_enrollments e
        where e.membership_id=actor and e.active and e.route_code=i.reporting_scope->>'routeId')))
      or (i.reporting_scope->>'kind'='club' and exists(select 1 from public.role_grants g where g.membership_id=actor
        and exists(select 1 from public.club_terms ct where ct.club_id=g.club_id and ct.starts_at<=now() and ct.ends_at>now())
        and g.club_id::text=i.reporting_scope->>'clubId' and g.role in ('president','coordinator') and g.revoked_at is null
        and g.starts_at<=now() and (g.ends_at is null or g.ends_at>now())))));
$$;
create or replace function private.can_read_incident(target_incident uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.institution_memberships m where m.user_id=(select auth.uid()) and m.status='active'
    and private.member_can_read_incident(m.id,target_incident));
$$;
create function private.can_read_plan(target uuid) returns boolean language sql stable security definer set search_path='' as $$
  select private.can_read_incident(p.incident_id) from public.incident_plans p where p.id=target;
$$;
create function private.can_read_task(target uuid) returns boolean language sql stable security definer set search_path='' as $$
  select private.can_read_plan(t.plan_id) from public.incident_tasks t where t.id=target;
$$;
-- RLS must protect every child even when the parent is not selected in a query.
drop policy incident_plans_tenant_select on public.incident_plans;
create policy incident_plans_case_select on public.incident_plans for select to authenticated using(private.can_read_incident(incident_id));
drop policy incident_tasks_tenant_select on public.incident_tasks;
create policy incident_tasks_case_select on public.incident_tasks for select to authenticated using(private.can_read_plan(plan_id));
drop policy incident_votes_tenant_select on public.incident_votes;
create policy incident_votes_case_select on public.incident_votes for select to authenticated using(private.can_read_incident(incident_id));
do $$declare n text;begin
  foreach n in array array['assignments','resolution_evidence','verification_records','task_dependencies'] loop
    execute format('drop policy %I on public.%I',n||'_tenant_select',n);
    execute format('create policy %I on public.%I for select to authenticated using(private.can_read_task(task_id))',n||'_case_select',n);
  end loop;
end $$;
drop policy approvals_tenant_select on public.approvals;
create policy approvals_case_select on public.approvals for select to authenticated using(private.can_read_incident(incident_id));
revoke all on function private.has_current_role(uuid,public.role_name[],uuid), private.member_can_read_incident(uuid,uuid),private.can_read_plan(uuid),private.can_read_task(uuid) from public,anon,authenticated;
grant execute on function private.has_current_role(uuid,public.role_name[],uuid),private.member_can_read_incident(uuid,uuid) to service_role;
grant execute on function private.can_read_plan(uuid),private.can_read_task(uuid) to authenticated,service_role;

create function public.orion_can_read_incident(actor_id uuid,tenant_id uuid,target_id uuid)
returns boolean language sql stable security invoker set search_path='' as $$
  select exists(select 1 from public.institution_memberships m where m.id=actor_id and m.institution_id=tenant_id
    and private.member_can_read_incident(actor_id,target_id));
$$;
create function public.orion_incident_feed(actor_id uuid,tenant_id uuid,before_time timestamptz default null,before_id uuid default null,page_size integer default 50)
returns jsonb language sql stable security invoker set search_path='' as $$
  select coalesce(jsonb_agg(result order by created_at desc,id desc),'[]'::jsonb) from (
    select i.id,i.created_at,to_jsonb(i)||jsonb_build_object('vote_count',(select count(*) from public.incident_votes v where v.incident_id=i.id),
      'has_voted',exists(select 1 from public.incident_votes v where v.incident_id=i.id and v.membership_id=actor_id)) result
    from public.incidents i where i.institution_id=tenant_id and private.member_can_read_incident(actor_id,i.id)
      and (before_time is null or (i.created_at,i.id)<(before_time,before_id))
    order by i.created_at desc,i.id desc limit greatest(1,least(page_size,100))
  ) page;
$$;

-- Dispatch policy is trusted server/database code, never an LLM permission flag.
create function private.enforce_task_safety() returns trigger language plpgsql set search_path='' as $$
declare i public.incidents;begin
  select incident.* into i from public.incidents incident join public.incident_plans p on p.incident_id=incident.id where p.id=new.plan_id;
  if i.category<>'other' or i.visibility<>'routine' or i.severity in ('high','critical') then new.requires_approval:=true; end if;
  return new;
end $$;
create trigger enforce_task_safety before insert or update of requires_approval on public.incident_tasks for each row execute function private.enforce_task_safety();

create function private.assert_operator(actor uuid,incident_id uuid) returns void language plpgsql security invoker set search_path='' as $$
declare i public.incidents; dept uuid;begin
  select * into i from public.incidents where id=incident_id;
  if not private.member_can_read_incident(actor,i.id) then raise exception 'Case access required' using errcode='42501'; end if;
  if private.has_current_role(actor,array['principal','admin']::public.role_name[]) then return; end if;
  -- Unscoped work is institution-level: only principal/admin may authorize it.
  dept:=nullif(i.reporting_scope->>'departmentId','')::uuid;
  if dept is null or not private.has_current_role(actor,array['hod']::public.role_name[],dept) then
    raise exception 'Current scoped operator required' using errcode='42501'; end if;
end $$;

-- Service-only ticket registry binds evidence to real private storage objects.
create table private.upload_tickets (
  storage_key text primary key, institution_id uuid not null references public.institutions(id),
  membership_id uuid not null, file_size integer not null check(file_size between 1 and 5242880),
  mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp')),
  incident_id uuid references public.incidents(id), bound_incident_id uuid references public.incidents(id),
  expires_at timestamptz not null default now()+interval '2 hours',
  foreign key(membership_id,institution_id) references public.institution_memberships(id,institution_id)
);
alter table private.upload_tickets enable row level security;
revoke all on private.upload_tickets from public,anon,authenticated;
grant all on private.upload_tickets to service_role;
create function public.orion_register_upload(actor_id uuid,tenant_id uuid,object_key text,object_size integer,object_mime text,incident_id uuid default null)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if not exists(select 1 from public.institution_memberships where id=actor_id and institution_id=tenant_id and status='active')
    or (incident_id is not null and not private.member_can_read_incident(actor_id,incident_id))
    or object_key not like 'institutions/'||tenant_id||'/members/'||actor_id||'/%'
    then raise exception 'Upload not authorized' using errcode='42501'; end if;
  insert into private.upload_tickets(storage_key,institution_id,membership_id,file_size,mime_type,incident_id)
    values(object_key,tenant_id,actor_id,object_size,object_mime,incident_id);
end $$;
create function private.bind_upload(key text,actor uuid,tenant uuid,target_incident uuid) returns void language plpgsql security invoker set search_path='' as $$
declare ticket private.upload_tickets;begin
  select * into ticket from private.upload_tickets where storage_key=key for update;
  if not found or ticket.membership_id<>actor or ticket.institution_id<>tenant
    or (ticket.bound_incident_id is not null and ticket.bound_incident_id<>target_incident)
    or (ticket.bound_incident_id is null and ticket.expires_at<now())
    or (ticket.incident_id is not null and ticket.incident_id<>target_incident)
    or not exists(select 1 from storage.objects o where o.bucket_id='evidence-vault' and o.name=key
      and (o.metadata->>'size')::bigint=ticket.file_size and o.metadata->>'mimetype'=ticket.mime_type)
    then raise exception 'Owned uploaded object required' using errcode='42501'; end if;
  update private.upload_tickets set bound_incident_id=target_incident where storage_key=key;
end $$;
create function private.guard_incident_attachment() returns trigger language plpgsql set search_path='' as $$
begin perform private.bind_upload(new.storage_key,new.uploader_membership_id,new.institution_id,new.incident_id);return new;end $$;
create trigger guard_incident_attachment before insert on public.incident_attachments for each row execute function private.guard_incident_attachment();
create function public.orion_append_evidence(target_id uuid,actor_id uuid,tenant_id uuid,expected_version integer,evidence_kind text,content text,object_key text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare i public.incidents;t public.incident_tasks;a public.assignments;e public.resolution_evidence;begin
  select incident.* into i from public.incidents incident join public.incident_plans p on p.incident_id=incident.id
    join public.incident_tasks task on task.plan_id=p.id where task.id=target_id and p.status='active' for update of incident;
  if i.id is null or i.institution_id<>tenant_id or not private.member_can_read_incident(actor_id,i.id) then raise exception 'Evidence not authorized' using errcode='42501';end if;
  select * into t from public.incident_tasks where id=target_id for update;
  select * into a from public.assignments where task_id=t.id and active_version and assignee_membership_id=actor_id for update;
  if a.id is null or a.state<>'active' or a.version<>expected_version or t.state<>'in_progress' then raise exception 'Stale assignment or task';end if;
  if evidence_kind not in ('photo','note','test_result') or length(trim(content)) not between 10 and 2000 then raise exception 'Invalid evidence';end if;
  if evidence_kind='photo' then perform private.bind_upload(object_key,actor_id,tenant_id,i.id);end if;
  insert into public.resolution_evidence(institution_id,task_id,uploader_membership_id,kind,storage_key,structured_result,evidence_version)
    values(tenant_id,t.id,actor_id,evidence_kind,case when evidence_kind='photo' then object_key end,jsonb_build_object('content',content),t.evidence_version) returning * into e;
  insert into public.incident_events(institution_id,incident_id,actor_membership_id,actor_type,action,safe_payload)
    values(tenant_id,i.id,actor_id,'human','evidence_submitted',jsonb_build_object('taskId',t.id,'evidenceVersion',t.evidence_version,'kind',evidence_kind));
  return to_jsonb(e);
end $$;

create function public.orion_clarify_incident(target_id uuid,actor_id uuid,expected_version integer,answer text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare i public.incidents;job_id uuid;begin
  select * into i from public.incidents where id=target_id for update;
  if not found or i.reporter_membership_id<>actor_id or not private.member_can_read_incident(actor_id,i.id) then raise exception 'Reporter required' using errcode='42501';end if;
  if i.state<>'needs_clarification' or i.version<>expected_version or length(trim(answer)) not between 2 and 1000 then raise exception 'Stale clarification or invalid answer';end if;
  if length(i.description||answer)>5000 then raise exception 'Clarification exceeds report limit';end if;
  update public.incidents set description=description||E'\nReporter clarification: '||answer,location_text=coalesce(location_text,'')||' — '||answer,
    clarification_request=null,state='triaging',version=version+1,updated_at=now() where id=i.id returning * into i;
  insert into public.jobs(institution_id,incident_id,type,dedupe_key,payload) values(i.institution_id,i.id,'commander_enqueue','clarify:'||i.id||':v'||i.version,'{}') returning id into job_id;
  insert into public.incident_events(institution_id,incident_id,actor_membership_id,actor_type,action,safe_payload)
    values(i.institution_id,i.id,actor_id,'human','reporter_clarification',jsonb_build_object('version',i.version));
  return jsonb_build_object('incident',to_jsonb(i),'job',jsonb_build_object('id',job_id));
end $$;

create or replace function private.persist_specialist_action(job_id uuid, expected_incident_version integer, expected_staff_version integer, action_payload jsonb, agent_run_id uuid)
returns uuid
language plpgsql
security invoker
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
  select * into target_job from public.jobs where id = job_id and status = 'running' and lease_until>now() for update;
  if not found or target_job.type <> 'specialist' then raise exception 'invalid specialist job'; end if;
  select * into target_incident from public.incidents where id=target_job.incident_id for update;
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

  if target_capability.membership_id=target_incident.accused_membership_id or not private.has_current_role(target_capability.membership_id,array['staff','supervisor']::public.role_name[])
    then raise exception 'Staff membership is inactive'; end if;
  if not coalesce(action_payload->'evidenceRequired','[]'::jsonb) @> target_task.evidence_requirements then raise exception 'Evidence policy cannot be weakened';end if;
  update public.incident_tasks set checklist = action_payload->'checklist', evidence_requirements = action_payload->'evidenceRequired' where id = target_task.id;
  if (target_task.requires_approval or action_payload->>'communicationType' = 'approval_request') and not exists (
    select 1 from public.approvals ap where ap.task_id=target_task.id and ap.plan_version=target_plan.version
    and ap.decision='approved' and ap.action_payload= persist_specialist_action.action_payload
  ) then
    if exists(select 1 from public.approvals ap where ap.task_id=target_task.id and ap.plan_version=target_plan.version and ap.action_payload=persist_specialist_action.action_payload) then return null;end if;
    insert into public.approvals(institution_id, incident_id, action_payload_hash, plan_version, task_id, action_payload)
    values (target_job.institution_id, target_incident.id, encode(pg_catalog.sha256(pg_catalog.convert_to(action_payload::text,'UTF8')), 'hex'), target_plan.version, target_task.id, action_payload);
  insert into public.notifications(institution_id, recipient_membership_id, safe_text, link)
    select target_job.institution_id, grant_row.membership_id, 'An ORION action requires approval.', '/incidents/' || target_incident.id::text
    from public.role_grants grant_row
    join public.institution_memberships membership on membership.id = grant_row.membership_id and membership.status = 'active'
    where grant_row.institution_id = target_job.institution_id and grant_row.role in ('principal', 'admin', 'hod')
      and private.member_can_read_incident(grant_row.membership_id,target_incident.id)
      and grant_row.revoked_at is null and grant_row.starts_at <= now() and (grant_row.ends_at is null or grant_row.ends_at > now());
    update public.incidents set state='awaiting_approval' where id=target_incident.id;
    return null;
  end if;

  acknowledgement_deadline := now() + make_interval(mins => target_plan.acknowledgement_minutes);
  insert into public.assignments(institution_id, task_id, assignee_membership_id, acknowledgement_deadline)
  values (target_job.institution_id, target_task.id, target_capability.membership_id, acknowledgement_deadline)
  returning id into assignment_id;
  insert into public.jobs(institution_id,incident_id,type,dedupe_key,payload,due_at) values
    (target_job.institution_id,target_incident.id,'ack_reminder','ack-reminder:'||assignment_id,jsonb_build_object('assignmentId',assignment_id),acknowledgement_deadline),
    (target_job.institution_id,target_incident.id,'assignment_escalation','ack-escalation:'||assignment_id,jsonb_build_object('assignmentId',assignment_id),acknowledgement_deadline+interval '10 minutes');
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
  values (target_job.institution_id, target_capability.membership_id, 'A new ORION task requires acknowledgement.', '/staff#evidence');
  insert into public.incident_events(institution_id, incident_id, actor_type, action, safe_payload)
  values (target_job.institution_id, target_incident.id, 'agent', 'specialist_assignment_created', jsonb_build_object('assignmentId', assignment_id, 'agentRunId', agent_run_id));
  update public.incidents set state = 'assigned', version = version + 1, updated_at = now() where id = target_incident.id;
  return assignment_id;
end;
$$;


create function public.orion_decide_approval(target_id uuid,actor_id uuid,tenant_id uuid,expected_plan integer,expected_hash text,requested_decision text,reason text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare ap public.approvals;i public.incidents;t public.incident_tasks;p public.incident_plans;cap public.staff_capabilities;j uuid;assignment_id uuid;begin
  select incident.* into i from public.incidents incident join public.approvals a on a.incident_id=incident.id where a.id=target_id for update of incident;
  if i.id is null or i.institution_id<>tenant_id then raise exception 'Approval not authorized' using errcode='42501';end if;
  perform private.assert_operator(actor_id,i.id);
  select task.* into t from public.incident_tasks task join public.approvals a on a.task_id=task.id where a.id=target_id for update of task;
  select * into ap from public.approvals where id=target_id for update;
  select * into p from public.incident_plans where id=t.plan_id and status='active';
  if p.id is null or i.state in ('cancelled','resolved') or p.version<>expected_plan or ap.plan_version<>p.version
    or ap.action_payload_hash<>expected_hash or ap.action_payload_hash<>encode(pg_catalog.sha256(pg_catalog.convert_to(ap.action_payload::text,'UTF8')),'hex')
    or ap.decision is not null then raise exception 'Stale or decided approval';end if;
  if i.reporter_membership_id=actor_id or ap.action_payload->>'candidateStaffId'=actor_id::text then raise exception 'Self approval forbidden' using errcode='42501';end if;
  if requested_decision not in ('approve','reject') or (requested_decision='reject' and length(trim(coalesce(reason,'')))<3) then raise exception 'Invalid approval decision';end if;
  update public.approvals set decision=case when requested_decision='approve' then 'approved' else 'rejected' end,
    approver_membership_id=actor_id,reason=orion_decide_approval.reason,decided_at=now() where id=ap.id returning * into ap;
  if requested_decision='approve' then
    -- Execute the exact authorized payload; never ask an LLM to recreate it.
    select * into cap from public.staff_capabilities where membership_id=(ap.action_payload->>'candidateStaffId')::uuid;
    insert into public.jobs(institution_id,incident_id,type,status,dedupe_key,payload,lease_until,worker_id,attempt)
      values(tenant_id,i.id,'specialist','running','approval:'||ap.id,jsonb_build_object('taskId',t.id),now()+interval '1 minute','approval-transaction',1) returning id into j;
    assignment_id:=private.persist_specialist_action(j,i.version,cap.version,ap.action_payload,null);
    if assignment_id is null then raise exception 'Approved assignment could not be created';end if;
    insert into public.incident_case_access(institution_id,incident_id,membership_id,granted_by)
      values(tenant_id,i.id,cap.membership_id,actor_id) on conflict do nothing;
    update public.jobs set status='succeeded',lease_until=null where id=j;
  else
    update public.incidents set state='triaging',version=version+1,updated_at=now() where id=i.id returning * into i;
    insert into public.jobs(institution_id,incident_id,type,dedupe_key,payload)
      values(tenant_id,i.id,'commander_enqueue','approval-rejected:'||ap.id,jsonb_build_object('reason',reason));
  end if;
  insert into public.incident_events(institution_id,incident_id,actor_membership_id,actor_type,action,safe_payload)
    values(tenant_id,i.id,actor_id,'human','approval_'||requested_decision,jsonb_build_object('approvalId',ap.id,'planVersion',p.version));
  return to_jsonb(ap);
end $$;

-- Assignment action and its recovery intent commit together; no second implementation.
create or replace function public.orion_assignment_action(target_id uuid, actor_id uuid, expected_version integer, requested_action text, reason text default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare a public.assignments;
declare t public.incident_tasks;
declare p public.incident_plans;
declare i public.incidents;
declare next_assignment public.assignment_status;
declare next_task public.task_status;
begin
  select incident.* into i from public.incidents incident join public.incident_plans plan on plan.incident_id=incident.id
    join public.incident_tasks task on task.plan_id=plan.id join public.assignments assignment_row on assignment_row.task_id=task.id where assignment_row.id=target_id for update of incident;
  select task.* into t from public.incident_tasks task join public.assignments assignment_row on assignment_row.task_id=task.id where assignment_row.id=target_id for update of task;
  select * into a from public.assignments where id=target_id for update;
  if not found or a.assignee_membership_id<>actor_id or not exists (
    select 1 from public.institution_memberships where id=actor_id and status='active' and institution_id=a.institution_id
  ) then raise exception 'Assignment not found or not authorized'; end if;
  if not a.active_version or a.version<>expected_version then raise exception 'Stale assignment version'; end if;
  select * into t from public.incident_tasks where id=a.task_id for update;
  select * into p from public.incident_plans where id=t.plan_id;
  select * into i from public.incidents where id=p.incident_id for update;
  if not private.member_can_read_incident(actor_id,i.id) then raise exception 'Case access required' using errcode='42501';end if;
  if p.status<>'active' or i.state in ('resolved','cancelled') then raise exception 'Assignment plan is no longer active'; end if;
  if requested_action='acknowledge' and a.state='offered' then
    next_assignment:='acknowledged'; next_task:='acknowledged';
  elsif requested_action='start' and a.state='acknowledged' then
    next_assignment:='active'; next_task:='in_progress';
  elsif requested_action='submit' and a.state='active' then
    if not exists (select 1 from public.resolution_evidence where task_id=t.id and evidence_version=t.evidence_version and kind='note' and uploader_membership_id=actor_id)
      then raise exception 'Completion notes are required'; end if;
    if not exists (select 1 from public.resolution_evidence where task_id=t.id and evidence_version=t.evidence_version and kind='test_result' and uploader_membership_id=actor_id)
      then raise exception 'Functional test results are required'; end if;
    next_assignment:='completed'; next_task:='submitted';
  elsif requested_action in ('handover','block') and a.state='active' then
    if length(trim(coalesce(reason,'')))<3 then raise exception 'A reason is required'; end if;
    next_assignment:='handover_requested'; next_task:='blocked';
  else raise exception 'Invalid assignment transition'; end if;
  update public.assignments set state=next_assignment,version=version+1,updated_at=now() where id=a.id returning * into a;
  update public.incident_tasks set state=next_task,updated_at=now(),
    designated_verifier_membership_id=case when requested_action='submit' then coalesce(designated_verifier_membership_id,i.reporter_membership_id) else designated_verifier_membership_id end,
    verifier_due_at=case when requested_action='submit' then now()+interval '20 minutes' else verifier_due_at end where id=t.id;
  update public.incidents set state=case when requested_action='submit' then 'submitted_for_verification'::public.incident_status
    when requested_action='start' then 'in_progress'::public.incident_status else state end,
    version=version+1,updated_at=now() where id=i.id;
  if requested_action='submit' then
    insert into public.jobs(institution_id,incident_id,type,dedupe_key,payload,due_at)
    values
      (i.institution_id,i.id,'verification','verification:'||t.id||':e'||t.evidence_version,jsonb_build_object('taskId',t.id,'evidenceVersion',t.evidence_version),now()),
      (i.institution_id,i.id,'verifier_reminder','verifier-reminder:'||t.id||':e'||t.evidence_version,jsonb_build_object('taskId',t.id),now()+interval '10 minutes'),
      (i.institution_id,i.id,'verifier_escalation','verifier-escalation:'||t.id||':e'||t.evidence_version,jsonb_build_object('taskId',t.id),now()+interval '20 minutes')
    on conflict(dedupe_key) do nothing;
    insert into public.notifications(institution_id,recipient_membership_id,safe_text,link)
    values(i.institution_id,coalesce(t.designated_verifier_membership_id,i.reporter_membership_id),'Work is awaiting your verification.','/incidents/'||i.id);
  end if;
  insert into public.incident_events(institution_id,incident_id,actor_membership_id,actor_type,action,safe_payload)
  values(i.institution_id,i.id,actor_id,'human','assignment_'||requested_action,jsonb_build_object('assignmentId',a.id,'reason',reason));
  if requested_action in ('handover','block') then
    insert into public.notifications(institution_id,recipient_membership_id,safe_text,link)
      select i.institution_id,g.membership_id,'Work needs an explicit ownership transfer.','/incidents/'||i.id from public.role_grants g
      where g.institution_id=i.institution_id and g.role in ('principal','admin','hod') and private.has_current_role(g.membership_id,array[g.role])
        and private.member_can_read_incident(g.membership_id,i.id);
  end if;
  return to_jsonb(a);
end $$;

create function public.orion_override_incident(target_id uuid,actor_id uuid,tenant_id uuid,expected_version integer,reason text,new_priority public.incident_severity default null,task_id uuid default null,new_assignee uuid default null,new_verifier uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare i public.incidents;t public.incident_tasks;p public.incident_plans;a public.assignments;cap public.staff_capabilities;
declare action jsonb;j uuid;created uuid;begin
  select * into i from public.incidents where id=target_id and institution_id=tenant_id for update;
  if not found then raise exception 'Incident not authorized' using errcode='42501';end if;
  perform private.assert_operator(actor_id,i.id);
  if i.version<>expected_version or i.state in ('resolved','cancelled') or length(trim(reason)) not between 10 and 1000 then raise exception 'Stale incident or invalid reason';end if;
  if new_priority is null and new_assignee is null and new_verifier is null then raise exception 'Override action required';end if;
  if new_priority is not null then update public.incidents set severity=new_priority where id=i.id;end if;
  if new_assignee is not null or new_verifier is not null then
    select task.* into t from public.incident_tasks task join public.incident_plans plan on plan.id=task.plan_id
      where task.id=orion_override_incident.task_id and plan.incident_id=i.id and plan.status='active' for update of task;
    if t.id is null then raise exception 'Current task required';end if;
    select * into p from public.incident_plans where id=t.plan_id;
    select * into a from public.assignments where assignments.task_id=t.id and active_version for update;
    if new_assignee is not null then
      if a.id is null or a.state not in ('offered','acknowledged','active','handover_requested') or new_assignee in (actor_id,i.reporter_membership_id)
        then raise exception 'Assignment transfer not permitted';end if;
      select * into cap from public.staff_capabilities where membership_id=new_assignee for update;
      update public.assignments set state='released',active_version=false,version=version+1,updated_at=now() where id=a.id;
      update public.incident_tasks set state='ready',evidence_version=evidence_version+1 where id=t.id;
      action:=jsonb_build_object('taskId',t.id,'candidateStaffId',new_assignee,'checklist',coalesce(t.checklist,'[]'),
        'evidenceRequired',t.evidence_requirements,'communicationType','assignment');
      insert into public.approvals(institution_id,incident_id,task_id,plan_version,action_payload,action_payload_hash,approver_membership_id,decision,reason,decided_at)
        values(tenant_id,i.id,t.id,p.version,action,encode(pg_catalog.sha256(pg_catalog.convert_to(action::text,'UTF8')),'hex'),actor_id,'approved',reason,now());
      insert into public.jobs(institution_id,incident_id,type,status,dedupe_key,payload,lease_until,worker_id,attempt)
        values(tenant_id,i.id,'specialist','running','override:'||a.id||':v'||a.version,jsonb_build_object('taskId',t.id),now()+interval '1 minute','override-transaction',1) returning id into j;
      created:=private.persist_specialist_action(j,i.version,cap.version,action,null);
      if created is null then raise exception 'Replacement could not be assigned';end if;
      insert into public.incident_case_access(institution_id,incident_id,membership_id,granted_by) values(tenant_id,i.id,new_assignee,actor_id) on conflict do nothing;
      update public.jobs set status='succeeded',lease_until=null where id=j;
    end if;
    if new_verifier is not null then
      if t.state<>'submitted' or new_verifier=i.accused_membership_id or new_verifier=a.assignee_membership_id
        or not exists(select 1 from public.institution_memberships where id=new_verifier and institution_id=tenant_id and status='active') then raise exception 'Independent active verifier required';end if;
      insert into public.incident_case_access(institution_id,incident_id,membership_id,granted_by) values(tenant_id,i.id,new_verifier,actor_id) on conflict do nothing;
      update public.incident_tasks set designated_verifier_membership_id=new_verifier,verifier_due_at=now()+interval '20 minutes',updated_at=now() where id=t.id;
      insert into public.notifications(institution_id,recipient_membership_id,safe_text,link) values(tenant_id,new_verifier,'You have been designated to review current task evidence.','/verification');
      insert into public.jobs(institution_id,incident_id,type,dedupe_key,payload,due_at) values
        (tenant_id,i.id,'verifier_reminder','verifier-reminder:'||t.id||':override:'||i.version,jsonb_build_object('taskId',t.id),now()+interval '10 minutes'),
        (tenant_id,i.id,'verifier_escalation','verifier-escalation:'||t.id||':override:'||i.version,jsonb_build_object('taskId',t.id),now()+interval '20 minutes');
    end if;
  end if;
  update public.incidents set version=version+1,updated_at=now() where id=i.id returning * into i;
  insert into public.audit_events(institution_id,actor_membership_id,action,target_type,target_id,safe_payload)
    values(tenant_id,actor_id,'incident_override','incident',i.id,jsonb_build_object('reason',reason,'version',i.version,'taskId',task_id,'newAssignee',new_assignee,'newVerifier',new_verifier));
  insert into public.incident_events(institution_id,incident_id,actor_membership_id,actor_type,action,safe_payload)
    values(tenant_id,i.id,actor_id,'human','incident_override',jsonb_build_object('reason',reason,'version',i.version,'taskId',task_id));
  return to_jsonb(i);
end $$;

create function private.guard_reporting_scope() returns trigger language plpgsql set search_path='' as $$
declare actor uuid:=new.reporter_membership_id;kind text:=coalesce(new.reporting_scope->>'kind','student');scope_id text;dept uuid;begin
  if new.category='confidential_complaint' then new.visibility:='confidential';end if;
  if kind='cr' then
    select g.department_id into dept from public.role_grants g where g.membership_id=actor and g.role='cr'
      and g.revoked_at is null and g.starts_at<=now() and (g.ends_at is null or g.ends_at>now())
      and (new.reporting_scope->>'departmentId' is null or g.department_id::text=new.reporting_scope->>'departmentId') order by g.id limit 1;
    if dept is null then raise exception 'Current CR scope required' using errcode='42501';end if;
    new.reporting_scope:=new.reporting_scope||jsonb_build_object('departmentId',dept);
  elsif kind='transport' then
    select e.route_code into scope_id from public.transport_enrollments e where e.membership_id=actor and e.active
      and (new.reporting_scope->>'routeId' is null or e.route_code=new.reporting_scope->>'routeId') order by e.route_code limit 1;
    if scope_id is null then raise exception 'Verified transport enrollment required' using errcode='42501';end if;
    new.reporting_scope:=new.reporting_scope||jsonb_build_object('routeId',scope_id);
    if new.visibility<>'confidential' then new.visibility:='restricted';end if;
  elsif kind='club' then
    select g.club_id::text into scope_id from public.role_grants g join public.club_terms ct on ct.club_id=g.club_id
      where g.membership_id=actor and g.role in ('president','coordinator') and g.club_id is not null and g.revoked_at is null
        and g.starts_at<=now() and (g.ends_at is null or g.ends_at>now()) and ct.starts_at<=now() and ct.ends_at>now()
        and (new.reporting_scope->>'clubId' is null or g.club_id::text=new.reporting_scope->>'clubId') order by g.id limit 1;
    if scope_id is null then raise exception 'Current club term required' using errcode='42501';end if;
    new.reporting_scope:=new.reporting_scope||jsonb_build_object('clubId',scope_id);
    if new.visibility<>'confidential' then new.visibility:='restricted';end if;
  elsif kind<>'student' then raise exception 'Unknown reporting scope' using errcode='42501';
  else
    select r.department_id into dept from public.student_roster r join public.institution_memberships m on m.user_id=r.claimed_user_id
      where m.id=actor and r.institution_id=new.institution_id limit 1;
    new.reporting_scope:=jsonb_build_object('kind','student','departmentId',dept);
  end if;
  return new;
end $$;
create trigger guard_reporting_scope before insert on public.incidents for each row execute function private.guard_reporting_scope();

create function public.orion_set_availability(actor_id uuid,tenant_id uuid,expected_version integer,new_state public.availability_status,choice text default null,reason text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare cap public.staff_capabilities;a public.assignments;i public.incidents;open_tasks jsonb;begin
  if not private.has_current_role(actor_id,array['staff','supervisor']::public.role_name[]) then raise exception 'Active staff required' using errcode='42501';end if;
  select * into cap from public.staff_capabilities where membership_id=actor_id and institution_id=tenant_id for update;
  if not found or cap.version<>expected_version then raise exception 'Stale availability';end if;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into open_tasks from public.assignments x where x.assignee_membership_id=actor_id and active_version and state in ('offered','acknowledged','active','handover_requested');
  if new_state='off_duty' and jsonb_array_length(open_tasks)>0 and coalesce(choice,'') not in ('keep','handover') then raise exception 'Choose keep or handover for open tasks';end if;
  update public.staff_capabilities set availability=new_state,version=version+1,updated_by=actor_id,updated_at=now() where id=cap.id;
  if new_state='off_duty' and choice='handover' then
    for a in select * from public.assignments where assignee_membership_id=actor_id and active_version and state in ('offered','acknowledged','active') loop
      -- Keep the existing owner until an operator explicitly transfers ownership.
      update public.assignments set state='handover_requested',version=version+1,updated_at=now() where id=a.id;
      select incident.* into i from public.incidents incident join public.incident_plans p on p.incident_id=incident.id
        join public.incident_tasks t on t.plan_id=p.id where t.id=a.task_id;
      insert into public.notifications(institution_id,recipient_membership_id,safe_text,link)
        select tenant_id,g.membership_id,'Staff requested an ownership transfer.','/incidents/'||i.id from public.role_grants g
          where g.institution_id=tenant_id and g.role in ('principal','admin','hod') and private.has_current_role(g.membership_id,array[g.role])
          and private.member_can_read_incident(g.membership_id,i.id);
    end loop;
  end if;
  insert into public.audit_events(institution_id,actor_membership_id,action,target_type,target_id,safe_payload)
    values(tenant_id,actor_id,'staff_availability_changed','staff_capability',cap.id,jsonb_build_object('state',new_state,'reason',reason,'choice',choice));
  return jsonb_build_object('new_state',new_state,'capability_version',cap.version+1,'open_tasks',open_tasks,'handover_created',new_state='off_duty' and choice='handover' and jsonb_array_length(open_tasks)>0);
end $$;

create function private.assert_job_claim(target uuid,worker text,claim_attempt integer) returns void language plpgsql security invoker set search_path='' as $$
begin
  perform 1 from public.jobs where id=target and status='running' and worker_id=worker and attempt=claim_attempt and lease_until>clock_timestamp() for update;
  if not found then raise exception 'Worker lease lost' using errcode='40001';end if;
end $$;
-- Move implementations behind fenced entrypoints. Legacy HTTP workers must be stopped before migration.
alter function public.persist_commander_plan(uuid,integer,jsonb,uuid) set schema private;
create function public.persist_commander_plan(job_id uuid,expected_incident_version integer,plan_payload jsonb,agent_run_id uuid,claim_worker text,claim_attempt integer)
returns uuid language plpgsql security invoker set search_path='' as $$
begin perform private.assert_job_claim(job_id,claim_worker,claim_attempt);return private.persist_commander_plan(job_id,expected_incident_version,plan_payload,agent_run_id);end $$;
drop function public.persist_specialist_action(uuid,integer,integer,jsonb,uuid);
create function public.persist_specialist_action(job_id uuid,expected_incident_version integer,expected_staff_version integer,action_payload jsonb,agent_run_id uuid,claim_worker text,claim_attempt integer)
returns uuid language plpgsql security invoker set search_path='' as $$
begin perform private.assert_job_claim(job_id,claim_worker,claim_attempt);return private.persist_specialist_action(job_id,expected_incident_version,expected_staff_version,action_payload,agent_run_id);end $$;
alter function public.orion_record_agent_verification(uuid,uuid,integer,jsonb,jsonb) set schema private;
create function public.orion_record_agent_verification(target_id uuid,tenant_id uuid,expected_evidence_version integer,agent_payload jsonb,decision jsonb,job_id uuid,claim_worker text,claim_attempt integer)
returns boolean language plpgsql security invoker set search_path='' as $$
begin perform private.assert_job_claim(job_id,claim_worker,claim_attempt);return private.orion_record_agent_verification(target_id,tenant_id,expected_evidence_version,agent_payload,decision);end $$;
create function public.orion_job_control(target_id uuid,claim_worker text,claim_attempt integer,operation text,lease_seconds integer default 290,next_due timestamptz default null,reason text default null)
returns void language plpgsql security invoker set search_path='' as $$
begin
  perform private.assert_job_claim(target_id,claim_worker,claim_attempt);
  if operation='renew' then
    update public.jobs set lease_until=clock_timestamp()+make_interval(secs=>greatest(30,least(lease_seconds,300))),updated_at=now() where id=target_id;
  elsif operation in ('succeed','retry','dead') then
    update public.jobs set status=case operation when 'succeed' then 'succeeded'::public.job_status when 'retry' then 'retry_wait'::public.job_status else 'dead'::public.job_status end,
      due_at=coalesce(next_due,due_at),lease_until=null,last_error=left(reason,300),updated_at=now() where id=target_id;
    if operation='dead' then perform public.record_dead_job_escalation(target_id,left(reason,300));end if;
  else raise exception 'Unknown job operation';end if;
end $$;

-- Restrict every new mutation, including helper functions, after creation.
do $$declare f record;begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where (n.nspname='public' and (p.proname like 'orion_%' or p.proname in ('persist_commander_plan','persist_specialist_action')))
      or (n.nspname='private' and p.proname in ('assert_operator','bind_upload','assert_job_claim','persist_commander_plan','orion_record_agent_verification','enforce_task_safety','guard_reporting_scope','guard_incident_attachment')) loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;

create or replace function private.persist_commander_plan(job_id uuid, expected_incident_version integer, plan_payload jsonb, agent_run_id uuid)
returns uuid
language plpgsql
security invoker
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
  if exists(select 1 from public.assignments a join public.incident_tasks t on t.id=a.task_id where t.plan_id=prior_plan_id and a.active_version) then
    raise exception 'Supervisor assignment reconciliation required before replan';end if;
  update public.jobs set status='dead',lease_until=null,last_error='Superseded plan' where incident_id=target_incident.id and id<>job_id and type='specialist' and status in ('queued','retry_wait');
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
      and prior_task.specialist_profile=task_payload->>'profile'
      and prior_task.requires_approval=(task_payload->>'requiresApproval')::boolean
      and prior_task.evidence_requirements @> (task_payload->'evidencePolicy')
      and (task_payload->'evidencePolicy') @> prior_task.evidence_requirements;
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

create function public.orion_get_incident(actor_id uuid,tenant_id uuid,target_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$
  select to_jsonb(i)||jsonb_build_object('vote_count',(select count(*) from public.incident_votes v where v.incident_id=i.id),
    'has_voted',exists(select 1 from public.incident_votes v where v.incident_id=i.id and v.membership_id=actor_id))
    from public.incidents i where i.id=target_id and i.institution_id=tenant_id and private.member_can_read_incident(actor_id,i.id);
$$;
revoke all on function public.orion_get_incident(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.orion_get_incident(uuid,uuid,uuid) to service_role;

create table private.automation_heartbeat(singleton boolean primary key default true check(singleton),finished_at timestamptz not null,failed boolean not null);
alter table private.automation_heartbeat enable row level security;
revoke all on private.automation_heartbeat from public,anon,authenticated;
grant all on private.automation_heartbeat to service_role;
create function public.orion_record_tick(failed boolean) returns void language sql security invoker set search_path='' as $$
  insert into private.automation_heartbeat(singleton,finished_at,failed) values(true,clock_timestamp(),failed)
    on conflict(singleton) do update set finished_at=excluded.finished_at,failed=excluded.failed;
$$;
create function public.orion_automation_health() returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('overdue_seconds',coalesce((select greatest(0,extract(epoch from now()-min(due_at))) from public.jobs where status in ('queued','retry_wait')),0),
    'dead_jobs',(select count(*) from public.jobs where status='dead' and last_error is distinct from 'Superseded plan'),
    'expired_leases',(select count(*) from public.jobs where status='running' and lease_until<now()),
    'seconds_since_tick',(select extract(epoch from now()-finished_at) from private.automation_heartbeat),
    'last_tick_failed',coalesce((select failed from private.automation_heartbeat),true));
$$;
revoke all on function public.orion_record_tick(boolean),public.orion_automation_health() from public,anon,authenticated;
grant execute on function public.orion_record_tick(boolean),public.orion_automation_health() to service_role;

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
      select jsonb_agg(candidate) from (select jsonb_build_object(
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
      ) as candidate
      from public.staff_capabilities capability
      join public.institution_memberships membership on membership.id = capability.membership_id
      where capability.institution_id = target_job.institution_id
        and membership.status = 'active'
        and capability.membership_id is distinct from target_incident.accused_membership_id
        and private.has_current_role(capability.membership_id,array['staff','supervisor']::public.role_name[])
        and capability.availability = 'available'
        and target_task.specialist_profile = any(capability.skills)
        and (select count(*) from public.assignments assignment
          where assignment.assignee_membership_id = capability.membership_id
            and assignment.active_version
            and assignment.state in ('offered', 'acknowledged', 'active', 'handover_requested')) < capability.workload_limit
      order by capability.membership_id limit 50) candidates
    ), '[]'::jsonb)
  );
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
    and (target_job.incident_id is null or private.member_can_read_incident(grant_row.membership_id,target_job.incident_id))
    and grant_row.revoked_at is null
    and grant_row.starts_at <= now()
    and (grant_row.ends_at is null or grant_row.ends_at > now());
end;
$$;

create function public.orion_verification_queue(actor_id uuid,tenant_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$
  select coalesce(jsonb_agg(item order by due_at nulls last,id),'[]') from (
    select t.id,t.verifier_due_at due_at,jsonb_build_object('id',t.id,'goal',t.goal,'incidentId',p.incident_id,
      'evidenceVersion',t.evidence_version,'dueAt',t.verifier_due_at) item
    from public.incident_tasks t join public.incident_plans p on p.id=t.plan_id and p.status='active'
    where t.institution_id=tenant_id and t.designated_verifier_membership_id=actor_id and t.state='submitted'
      and private.member_can_read_incident(actor_id,p.incident_id) order by t.verifier_due_at nulls last,t.id limit 100
  ) tasks;
$$;
revoke all on function public.orion_verification_queue(uuid,uuid) from public,anon,authenticated;
grant execute on function public.orion_verification_queue(uuid,uuid) to service_role;

-- Legacy photo references are not trusted merely because a row contains a key.
create function private.valid_photo(evidence_id uuid) returns boolean language sql stable security invoker set search_path='' as $$
  select exists(select 1 from public.resolution_evidence e join public.incident_tasks t on t.id=e.task_id
    join public.incident_plans p on p.id=t.plan_id join private.upload_tickets ticket on ticket.storage_key=e.storage_key
    join storage.objects o on o.bucket_id='evidence-vault' and o.name=ticket.storage_key
    where e.id=evidence_id and ticket.membership_id=e.uploader_membership_id and ticket.institution_id=e.institution_id
      and ticket.bound_incident_id=p.incident_id and (o.metadata->>'size')::bigint=ticket.file_size and o.metadata->>'mimetype'=ticket.mime_type);
$$;
create function public.orion_can_preview_evidence(actor_id uuid,tenant_id uuid,evidence_id uuid) returns boolean language sql stable security invoker set search_path='' as $$
  select exists(select 1 from public.resolution_evidence e join public.incident_tasks t on t.id=e.task_id
    join public.incident_plans p on p.id=t.plan_id where e.id=evidence_id and e.institution_id=tenant_id
      and private.member_can_read_incident(actor_id,p.incident_id) and private.valid_photo(e.id));
$$;
revoke all on function private.valid_photo(uuid),public.orion_can_preview_evidence(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.valid_photo(uuid),public.orion_can_preview_evidence(uuid,uuid,uuid) to service_role;

create or replace function private.record_human_review(target_id uuid,actor_id uuid,expected_evidence_version integer,decision text,reason text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare t public.incident_tasks; i public.incidents; a public.assignments;
declare review public.verification_records; record_id uuid; required_kind text;
begin
  select * into t from public.incident_tasks where id=target_id for update;
  select incident.* into i from public.incidents incident join public.incident_plans p on p.incident_id=incident.id where p.id=t.plan_id and p.status='active';
  if i.id is null or t.designated_verifier_membership_id is distinct from actor_id or i.accused_membership_id=actor_id
    or not exists(select 1 from public.institution_memberships where id=actor_id and institution_id=t.institution_id and status='active')
    then raise exception 'Designated active verifier required' using errcode='42501'; end if;
  if decision is null or decision not in ('accepted','rejected') then raise exception 'Invalid decision'; end if;
  if t.state<>'submitted' or expected_evidence_version is distinct from t.evidence_version
    or i.state in ('resolved','cancelled') then raise exception 'Stale evidence or task state'; end if;
  if decision='rejected' and length(trim(coalesce(reason,'')))<3 then raise exception 'Rejection reason required'; end if;
  select * into a from public.assignments where task_id=t.id and active_version and state='completed';
  if a.id is null or a.assignee_membership_id=actor_id then raise exception 'Independent verifier and completed current assignment required'; end if;
  -- The policy is prose for the evidence agent. Machine-readable kinds additionally
  -- enforce presence here; note and functional test are mandatory for every task.
  for required_kind in select 'note' union select 'test_result' union
    select value from jsonb_array_elements_text(t.evidence_requirements) where value in ('photo','note','test_result') loop
    if not exists(select 1 from public.resolution_evidence where task_id=t.id and evidence_version=t.evidence_version
      and uploader_membership_id=a.assignee_membership_id and kind=required_kind) then raise exception 'Current assignment evidence is incomplete'; end if;
  end loop;
  if decision='accepted' and exists(select 1 from public.resolution_evidence e where e.task_id=t.id and e.evidence_version=t.evidence_version
    and e.kind='photo' and e.uploader_membership_id=a.assignee_membership_id and not private.valid_photo(e.id)) then
    raise exception 'Current photo ownership could not be verified';end if;
  select * into review from public.verification_records where task_id=t.id and evidence_version=t.evidence_version
    and (human_result is null or human_result='pending') order by created_at desc,id desc limit 1;
  if decision='accepted' and (review.id is null or review.agent_verdict='fail') then raise exception 'Agent evidence review pending or failed'; end if;
  insert into public.verification_records(institution_id,task_id,evidence_version,human_result,agent_verdict,reasons,verifier_membership_id)
    values(t.institution_id,t.id,t.evidence_version,case when decision='accepted' then 'pass' else 'fail' end,
      coalesce(review.agent_verdict,'needs_human_review'),jsonb_build_object('humanReason',reason),actor_id) returning id into record_id;
  insert into private.human_verification_decisions values(t.id,t.evidence_version,record_id);
  update public.incident_tasks set state=case when decision='accepted' then 'verified'::public.task_status else 'failed'::public.task_status end,updated_at=now() where id=t.id;
  update public.assignments set active_version=false,updated_at=now() where id=a.id;
  insert into public.incident_events(institution_id,incident_id,actor_membership_id,actor_type,action,safe_payload)
    values(i.institution_id,i.id,actor_id,'human','task_verification_'||decision,
      jsonb_build_object('taskId',t.id,'evidenceVersion',t.evidence_version,'verificationId',record_id,'reason',reason));
  return record_id;
end $$;
