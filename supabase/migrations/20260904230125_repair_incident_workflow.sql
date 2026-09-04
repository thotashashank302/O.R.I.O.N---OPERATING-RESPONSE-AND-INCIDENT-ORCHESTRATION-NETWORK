-- Service-only transactional mutations. Authenticated HTTP handlers supply the
-- freshly authenticated membership; no browser role can execute these RPCs.
alter table public.approvals add column if not exists task_id uuid references public.incident_tasks(id);
alter table public.approvals add column if not exists action_payload jsonb;
create index if not exists approvals_task_idx on public.approvals(task_id);

create or replace function public.orion_assignment_action(target_id uuid, actor_id uuid, expected_version integer, requested_action text, reason text default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare a public.assignments;
declare t public.incident_tasks;
declare p public.incident_plans;
declare i public.incidents;
declare next_assignment public.assignment_status;
declare next_task public.task_status;
begin
  select * into a from public.assignments where id=target_id for update;
  if not found or a.assignee_membership_id<>actor_id or not exists (
    select 1 from public.institution_memberships where id=actor_id and status='active' and institution_id=a.institution_id
  ) then raise exception 'Assignment not found or not authorized'; end if;
  if not a.active_version or a.version<>expected_version then raise exception 'Stale assignment version'; end if;
  select * into t from public.incident_tasks where id=a.task_id for update;
  select * into p from public.incident_plans where id=t.plan_id;
  select * into i from public.incidents where id=p.incident_id for update;
  if p.status<>'active' or i.state in ('resolved','cancelled') then raise exception 'Assignment plan is no longer active'; end if;
  if requested_action='acknowledge' and a.state='offered' then
    next_assignment:='acknowledged'; next_task:='acknowledged';
  elsif requested_action='start' and a.state='acknowledged' then
    next_assignment:='active'; next_task:='in_progress';
  elsif requested_action='submit' and a.state='active' then
    if not exists (select 1 from public.resolution_evidence where task_id=t.id and evidence_version=t.evidence_version and kind='note')
      then raise exception 'Completion notes are required'; end if;
    if not exists (select 1 from public.resolution_evidence where task_id=t.id and evidence_version=t.evidence_version and kind='test_result')
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
  return to_jsonb(a);
end $$;
revoke all on function public.orion_assignment_action(uuid,uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.orion_assignment_action(uuid,uuid,integer,text,text) to service_role;

create or replace function public.orion_confirm_incident(target_id uuid,actor_id uuid,expected_version integer,decision text,reason text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare i public.incidents;
declare p public.incident_plans;
declare t public.incident_tasks;
declare next_state public.incident_status;
begin
  select * into i from public.incidents where id=target_id for update;
  if not found or i.reporter_membership_id<>actor_id or i.accused_membership_id=actor_id or not exists (
    select 1 from public.institution_memberships where id=actor_id and institution_id=i.institution_id and status='active'
  ) then raise exception 'Only the active reporter may confirm this incident'; end if;
  if i.version<>expected_version then raise exception 'Stale incident version'; end if;
  if i.state<>'submitted_for_verification' or decision not in ('accepted','rejected') then raise exception 'Invalid confirmation state'; end if;
  if decision='rejected' and length(trim(reason))<3 then raise exception 'A rejection reason is required'; end if;
  select * into p from public.incident_plans where incident_id=i.id and status='active' for update;
  if not found or not exists(select 1 from public.incident_tasks where plan_id=p.id and state='submitted') then raise exception 'No submitted tasks to verify'; end if;
  for t in select * from public.incident_tasks where plan_id=p.id and state='submitted' for update loop
    if t.designated_verifier_membership_id is distinct from actor_id then raise exception 'A different verifier is required'; end if;
    if decision='accepted' and not exists(
      select 1 from public.verification_records where task_id=t.id and evidence_version=t.evidence_version and agent_verdict in ('pass','needs_human_review')
    ) then raise exception 'Agent evidence review is still pending or failed'; end if;
    insert into public.verification_records(institution_id,task_id,evidence_version,human_result,agent_verdict,reasons)
    values(i.institution_id,t.id,t.evidence_version,case when decision='accepted' then 'pass' else 'fail' end,
      'needs_human_review',jsonb_build_object('humanReason',reason));
    update public.incident_tasks set state=case when decision='accepted' then 'verified'::public.task_status else 'failed'::public.task_status end,updated_at=now() where id=t.id;
    update public.assignments set active_version=false,updated_at=now() where task_id=t.id and state='completed';
  end loop;
  if decision='rejected' then next_state:='reopened';
  else
    update public.incident_tasks task set state='ready',updated_at=now()
    where plan_id=p.id and state='pending' and not exists(
      select 1 from public.task_dependencies d join public.incident_tasks prereq on prereq.id=d.prerequisite_task_id where d.task_id=task.id and prereq.state<>'verified'
    );
    insert into public.jobs(institution_id,incident_id,type,dedupe_key,payload)
    select i.institution_id,i.id,'specialist','specialist:'||id||':e'||evidence_version,jsonb_build_object('taskId',id)
    from public.incident_tasks where plan_id=p.id and state='ready' on conflict(dedupe_key) do nothing;
    if not exists(select 1 from public.incident_tasks where plan_id=p.id and state<>'verified') then next_state:='resolved';
    else next_state:='in_progress'; end if;
  end if;
  update public.incidents set state=next_state,version=version+1,updated_at=now(),
    resolved_at=case when next_state='resolved' then now() else null end,
    reopened_at=case when next_state='reopened' then now() else reopened_at end where id=i.id returning * into i;
  if next_state='resolved' then update public.incident_plans set status='completed' where id=p.id; end if;
  insert into public.incident_events(institution_id,incident_id,actor_membership_id,actor_type,action,safe_payload)
  values(i.institution_id,i.id,actor_id,'human','reporter_'||decision,jsonb_build_object('reason',reason,'state',next_state));
  return to_jsonb(i);
end $$;
revoke all on function public.orion_confirm_incident(uuid,uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.orion_confirm_incident(uuid,uuid,integer,text,text) to service_role;

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

  if not exists(select 1 from public.institution_memberships where id=target_capability.membership_id and status='active')
    then raise exception 'Staff membership is inactive'; end if;
  update public.incident_tasks set checklist = action_payload->'checklist', evidence_requirements = action_payload->'evidenceRequired' where id = target_task.id;
  if (target_task.requires_approval or action_payload->>'communicationType' = 'approval_request') and not exists (
    select 1 from public.approvals ap where ap.task_id=target_task.id and ap.plan_version=target_plan.version
    and ap.decision='approved' and ap.action_payload= persist_specialist_action.action_payload
  ) then
    insert into public.approvals(institution_id, incident_id, action_payload_hash, plan_version, task_id, action_payload)
    values (target_job.institution_id, target_incident.id, encode(extensions.digest(action_payload::text, 'sha256'), 'hex'), target_plan.version, target_task.id, action_payload);
    insert into public.jobs(institution_id,incident_id,type,dedupe_key,payload,due_at)
  values
    (target_job.institution_id,target_incident.id,'ack_reminder','ack-reminder:'||assignment_id,jsonb_build_object('assignmentId',assignment_id),now()+interval '10 minutes'),
    (target_job.institution_id,target_incident.id,'assignment_escalation','ack-escalation:'||assignment_id,jsonb_build_object('assignmentId',assignment_id),now()+interval '20 minutes')
  on conflict(dedupe_key) do nothing;
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
  values (target_job.institution_id, target_capability.membership_id, 'A new ORION task requires acknowledgement.', '/staff#evidence');
  insert into public.incident_events(institution_id, incident_id, actor_type, action, safe_payload)
  values (target_job.institution_id, target_incident.id, 'agent', 'specialist_assignment_created', jsonb_build_object('assignmentId', assignment_id, 'agentRunId', agent_run_id));
  update public.incidents set state = 'assigned', version = version + 1, updated_at = now() where id = target_incident.id;
  return assignment_id;
end;
$$;

