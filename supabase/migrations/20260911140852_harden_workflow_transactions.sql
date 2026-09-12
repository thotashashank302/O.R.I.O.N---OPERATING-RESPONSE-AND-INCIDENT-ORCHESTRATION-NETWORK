-- Service-only transactions. Existing historical records are retained, including
-- legacy human records without identity; the NOT VALID check governs new writes.
alter table public.verification_records add constraint human_verifier_required
  check (human_result not in ('pass','fail') or verifier_membership_id is not null) not valid;
create table private.human_verification_decisions (
  task_id uuid not null references public.incident_tasks(id) on delete cascade,
  evidence_version integer not null,
  verification_id uuid not null references public.verification_records(id),
  primary key(task_id,evidence_version)
);
alter table private.human_verification_decisions enable row level security;
-- Preserve legacy audit rows without guessing their actor or deleting duplicates.
insert into private.human_verification_decisions
select distinct on (task_id,evidence_version) task_id,evidence_version,id
from public.verification_records where human_result in ('pass','fail')
order by task_id,evidence_version,created_at,id;

create table private.upload_attempts (
  institution_id uuid not null references public.institutions(id) on delete cascade,
  membership_id uuid not null,
  attempted_at timestamptz not null default clock_timestamp(),
  foreign key(membership_id,institution_id) references public.institution_memberships(id,institution_id)
);
create index upload_attempts_member_time on private.upload_attempts(institution_id,membership_id,attempted_at);
alter table private.upload_attempts enable row level security;
create function public.orion_consume_upload_attempt(tenant_id uuid,actor_id uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
declare attempts integer;
begin
  -- All instances contend on the same membership row; time is database-owned.
  perform 1 from public.institution_memberships where id=actor_id and institution_id=tenant_id and status='active' for update;
  if not found then raise exception 'Active membership required' using errcode='42501'; end if;
  delete from private.upload_attempts where membership_id=actor_id and institution_id=tenant_id and attempted_at<=clock_timestamp()-interval '1 hour';
  select count(*) into attempts from private.upload_attempts where membership_id=actor_id and institution_id=tenant_id;
  if attempts>=10 then return false; end if;
  insert into private.upload_attempts(institution_id,membership_id) values(tenant_id,actor_id);
  return true;
end $$;

-- Called only while the incident and task are locked by an authoritative RPC.
create function private.record_human_review(target_id uuid,actor_id uuid,expected_evidence_version integer,decision text,reason text)
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

create function private.finish_human_review(incident_id uuid,plan_id uuid,decision text,reason text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare i public.incidents; next_state public.incident_status; job_id uuid;
begin
  select * into i from public.incidents where id=incident_id for update;
  if decision='rejected' then next_state:='reopened';
  else
    update public.incident_tasks task set state='ready',updated_at=now()
      where task.plan_id=finish_human_review.plan_id and state='pending' and not exists(
        select 1 from public.task_dependencies d join public.incident_tasks prereq on prereq.id=d.prerequisite_task_id where d.task_id=task.id and prereq.state<>'verified');
    insert into public.jobs(institution_id,incident_id,type,dedupe_key,payload)
      select i.institution_id,i.id,'specialist','specialist:'||id||':e'||evidence_version,jsonb_build_object('taskId',id)
      from public.incident_tasks task where task.plan_id=finish_human_review.plan_id and state='ready' on conflict(dedupe_key) do nothing;
    if not exists(select 1 from public.incident_tasks task where task.plan_id=finish_human_review.plan_id and state<>'verified') then next_state:='resolved';
    elsif exists(select 1 from public.incident_tasks task where task.plan_id=finish_human_review.plan_id and state='submitted') then next_state:='submitted_for_verification';
    else next_state:='in_progress'; end if;
  end if;
  update public.incidents set state=next_state,version=version+1,updated_at=now(),
    resolved_at=case when next_state='resolved' then now() else null end,
    reopened_at=case when next_state='reopened' then now() else reopened_at end where id=i.id returning * into i;
  if next_state='resolved' then update public.incident_plans set status='completed' where id=finish_human_review.plan_id; end if;
  if decision='rejected' then
    insert into public.jobs(institution_id,incident_id,type,dedupe_key,payload)
      values(i.institution_id,i.id,'commander_enqueue','replan:'||i.id||':v'||i.version,jsonb_build_object('reason',reason)) returning id into job_id;
  end if;
  return to_jsonb(i)||jsonb_build_object('replan_job',case when job_id is not null then jsonb_build_object('id',job_id) end);
end $$;

create or replace function public.orion_confirm_incident(target_id uuid,actor_id uuid,expected_version integer,decision text,reason text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare i public.incidents; p public.incident_plans; t public.incident_tasks; result jsonb;
begin
  select * into i from public.incidents where id=target_id for update;
  if not found or i.reporter_membership_id<>actor_id or i.accused_membership_id=actor_id or not exists(
    select 1 from public.institution_memberships where id=actor_id and institution_id=i.institution_id and status='active') then raise exception 'Active reporter required' using errcode='42501'; end if;
  if i.version is distinct from expected_version or i.state<>'submitted_for_verification' then raise exception 'Stale incident version or state'; end if;
  select * into p from public.incident_plans where incident_id=i.id and status='active' for update;
  if p.id is null or not exists(select 1 from public.incident_tasks where plan_id=p.id and state='submitted') then raise exception 'No submitted tasks'; end if;
  for t in select * from public.incident_tasks where plan_id=p.id and state='submitted' order by id for update loop
    perform private.record_human_review(t.id,actor_id,t.evidence_version,decision,reason);
  end loop;
  result:=private.finish_human_review(i.id,p.id,decision,reason);
  insert into public.incident_events(institution_id,incident_id,actor_membership_id,actor_type,action,safe_payload)
    values(i.institution_id,i.id,actor_id,'human','reporter_'||decision,jsonb_build_object('reason',reason,'state',result->>'state'));
  return result;
end $$;

create function public.orion_verify_task(target_id uuid,actor_id uuid,tenant_id uuid,expected_evidence_version integer,decision text,reason text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare i public.incidents; t public.incident_tasks; record_id uuid;
begin
  select incident.* into i from public.incidents incident join public.incident_plans p on p.incident_id=incident.id
    join public.incident_tasks task on task.plan_id=p.id where task.id=target_id and incident.institution_id=tenant_id for update of incident;
  if i.id is null then raise exception 'Task not authorized' using errcode='42501'; end if;
  select * into t from public.incident_tasks where id=target_id for update;
  record_id:=private.record_human_review(t.id,actor_id,expected_evidence_version,decision,reason);
  return jsonb_build_object('verificationId',record_id,'incident',private.finish_human_review(i.id,t.plan_id,decision,reason));
end $$;

create table private.incident_create_operations (
  institution_id uuid not null,
  membership_id uuid not null,
  operation_id uuid not null,
  request_payload jsonb not null,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  response jsonb not null,
  primary key(institution_id,membership_id,operation_id),
  foreign key(membership_id,institution_id) references public.institution_memberships(id,institution_id)
);
alter table private.incident_create_operations enable row level security;
create function public.orion_create_incident(tenant_id uuid,actor_id uuid,operation_id uuid,request_payload jsonb,incident_payload jsonb,agent_payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare existing private.incident_create_operations; i public.incidents; item jsonb; run public.agent_runs;
declare report_count integer; job_id uuid; result jsonb;
begin
  perform 1 from public.institution_memberships where id=actor_id and institution_id=tenant_id and status='active' for update;
  if not found or not exists(select 1 from public.role_grants where membership_id=actor_id and institution_id=tenant_id
    and role in ('student','cr','president','coordinator') and revoked_at is null and starts_at<=now() and (ends_at is null or ends_at>now()))
    then raise exception 'Active reporting membership required' using errcode='42501'; end if;
  if operation_id is null then raise exception 'Operation id required'; end if;
  select * into existing from private.incident_create_operations op where op.institution_id=tenant_id and op.membership_id=actor_id and op.operation_id=orion_create_incident.operation_id;
  if found then
    if existing.request_payload<>request_payload then raise exception 'Idempotency key reused with different report'; end if;
    return existing.response;
  end if;
  select count(*) into report_count from public.incidents where institution_id=tenant_id and reporter_membership_id=actor_id and visibility<>'confidential' and created_at>now()-interval '1 hour';
  if not coalesce((request_payload->>'isConfidential')::boolean,false) and report_count>=5 then raise exception 'Rate limit exceeded'; end if;
  i:=jsonb_populate_record(null::public.incidents,incident_payload);
  if i.institution_id is distinct from tenant_id or i.reporter_membership_id is distinct from actor_id or i.state not in ('triaging','needs_clarification') then raise exception 'Invalid intake payload'; end if;
  insert into public.incidents(id,institution_id,reporter_membership_id,accused_membership_id,reporting_scope,category,visibility,location_id,location_text,description,severity,state,version,triage_summary,clarification_request)
    values(i.id,tenant_id,actor_id,i.accused_membership_id,i.reporting_scope,i.category,i.visibility,i.location_id,i.location_text,i.description,i.severity,i.state,1,i.triage_summary,i.clarification_request) returning * into i;
  for item in select * from jsonb_array_elements(coalesce(request_payload->'attachments','[]')) loop
    insert into public.incident_attachments(institution_id,incident_id,uploader_membership_id,storage_key,file_name,file_size,mime_type)
      values(tenant_id,i.id,actor_id,item->>'storageKey',item->>'fileName',(item->>'fileSize')::integer,item->>'mimeType');
  end loop;
  run:=jsonb_populate_record(null::public.agent_runs,agent_payload);
  insert into public.agent_runs(id,institution_id,incident_id,agent_name,provider,model,prompt_version,latency_ms,status,validated_outcome,safe_error)
    values(run.id,tenant_id,i.id,'triage',run.provider,run.model,run.prompt_version,run.latency_ms,run.status,run.validated_outcome,run.safe_error);
  insert into public.incident_events(institution_id,incident_id,actor_membership_id,actor_type,action,safe_payload)
    values(tenant_id,i.id,actor_id,'human','incident_reported',jsonb_build_object('category',i.category,'state',i.state));
  if i.state='triaging' then
    insert into public.jobs(institution_id,incident_id,type,dedupe_key,payload)
      values(tenant_id,i.id,'commander_enqueue','intake:'||i.id,'{}') returning id into job_id;
  end if;
  result:=jsonb_build_object('incident',to_jsonb(i),'job',case when job_id is not null then jsonb_build_object('id',job_id) end,
    'rateLimitRemaining',greatest(0,5-report_count-case when i.visibility='confidential' then 0 else 1 end));
  insert into private.incident_create_operations values(tenant_id,actor_id,operation_id,request_payload,i.id,result);
  return result;
end $$;

revoke all on table private.upload_attempts,private.incident_create_operations,private.human_verification_decisions from public,anon,authenticated;
grant all on table private.upload_attempts,private.incident_create_operations,private.human_verification_decisions to service_role;
revoke all on function public.orion_consume_upload_attempt(uuid,uuid),public.orion_create_incident(uuid,uuid,uuid,jsonb,jsonb,jsonb),public.orion_verify_task(uuid,uuid,uuid,integer,text,text),public.orion_confirm_incident(uuid,uuid,integer,text,text),private.record_human_review(uuid,uuid,integer,text,text),private.finish_human_review(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.orion_consume_upload_attempt(uuid,uuid),public.orion_create_incident(uuid,uuid,uuid,jsonb,jsonb,jsonb),public.orion_verify_task(uuid,uuid,uuid,integer,text,text),public.orion_confirm_incident(uuid,uuid,integer,text,text),private.record_human_review(uuid,uuid,integer,text,text),private.finish_human_review(uuid,uuid,text,text) to service_role;

create table private.agent_verification_decisions (
  task_id uuid not null references public.incident_tasks(id) on delete cascade,
  evidence_version integer not null,
  primary key(task_id,evidence_version)
);
alter table private.agent_verification_decisions enable row level security;
revoke all on private.agent_verification_decisions from public,anon,authenticated;
grant all on private.agent_verification_decisions to service_role;
create function public.orion_record_agent_verification(target_id uuid,tenant_id uuid,expected_evidence_version integer,agent_payload jsonb,decision jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare i public.incidents; t public.incident_tasks; run public.agent_runs;
begin
  select incident.* into i from public.incidents incident join public.incident_plans p on p.incident_id=incident.id
    join public.incident_tasks task on task.plan_id=p.id where task.id=target_id and incident.institution_id=tenant_id and p.status='active' for update of incident;
  if i.id is null then return false; end if;
  select * into t from public.incident_tasks where id=target_id for update;
  if t.state<>'submitted' or t.evidence_version is distinct from expected_evidence_version then return false; end if;
  insert into private.agent_verification_decisions values(t.id,t.evidence_version) on conflict do nothing;
  if not found then return false; end if;
  run:=jsonb_populate_record(null::public.agent_runs,agent_payload);
  insert into public.agent_runs(id,institution_id,incident_id,agent_name,provider,model,prompt_version,latency_ms,status,validated_outcome,safe_error)
    values(run.id,tenant_id,i.id,'verification',run.provider,run.model,run.prompt_version,run.latency_ms,run.status,decision,run.safe_error);
  insert into public.verification_records(institution_id,task_id,evidence_version,human_result,agent_verdict,reasons)
    values(tenant_id,t.id,t.evidence_version,'pending',case when decision->>'verdict'='failed' then 'fail' else 'needs_human_review' end,decision);
  insert into public.incident_events(institution_id,incident_id,actor_type,action,safe_payload)
    values(tenant_id,i.id,'agent','verification_reviewed',jsonb_build_object('taskId',t.id,'evidenceVersion',t.evidence_version,'verdict',decision->>'verdict'));
  if decision->>'verdict'='failed' then
    update public.incident_tasks set state='failed',updated_at=now() where id=t.id;
    update public.assignments set active_version=false,updated_at=now() where task_id=t.id and state='completed';
    perform private.finish_human_review(i.id,t.plan_id,'rejected',coalesce(decision->>'suggested_replan_reason','Evidence review failed'));
  end if;
  return true;
end $$;
revoke all on function public.orion_record_agent_verification(uuid,uuid,integer,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.orion_record_agent_verification(uuid,uuid,integer,jsonb,jsonb) to service_role;
