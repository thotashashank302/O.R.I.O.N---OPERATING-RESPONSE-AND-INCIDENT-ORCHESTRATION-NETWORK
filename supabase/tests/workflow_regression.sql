-- Run in a transaction with the repair migration, then ROLLBACK.
do $$
declare campus uuid; cr uuid; staff uuid; incident uuid; plan uuid; task uuid; assignment uuid; result jsonb; rejected boolean;
begin
select id into campus from public.institutions where code='ORION-DEMO' and is_demo;
select membership_id into cr from public.role_grants where institution_id=campus and role='cr' and revoked_at is null limit 1;
select membership_id into staff from public.role_grants where institution_id=campus and role='staff' and revoked_at is null limit 1;
if cr is null or staff is null then raise exception 'Controlled demo identities required'; end if;
insert into public.incidents(institution_id,reporter_membership_id,category,description,state,plan_version)
values(campus,cr,'facilities','SYNTHETIC ROLLBACK TEST: desk handle','assigned',1) returning id into incident;
insert into public.incident_plans(institution_id,incident_id,version,priority,explanation,acknowledgement_minutes)
values(campus,incident,1,'normal','Synthetic test',10) returning id into plan;
insert into public.incident_tasks(institution_id,plan_id,local_id,logical_task_key,specialist_profile,goal,evidence_requirements,state)
values(campus,plan,'handle','handle','facilities','Inspect handle','["note","test_result"]','assigned') returning id into task;
insert into public.assignments(institution_id,task_id,assignee_membership_id,acknowledgement_deadline)
values(campus,task,staff,now()+interval '10 minutes') returning id into assignment;
rejected:=false;
begin perform public.orion_assignment_action(assignment,cr,1,'acknowledge'); exception when others then rejected:=true; end;
if not rejected then raise exception 'Wrong staff accepted assignment'; end if;
perform public.orion_assignment_action(assignment,staff,1,'acknowledge');
rejected:=false;
begin perform public.orion_assignment_action(assignment,staff,1,'start'); exception when others then rejected:=true; end;
if not rejected then raise exception 'Stale assignment accepted'; end if;
perform public.orion_assignment_action(assignment,staff,2,'start');
rejected:=false;
begin perform public.orion_assignment_action(assignment,staff,3,'submit'); exception when others then rejected:=true; end;
if not rejected then raise exception 'Evidence-free submission accepted'; end if;
insert into public.resolution_evidence(institution_id,task_id,uploader_membership_id,kind,structured_result,evidence_version)
values(campus,task,staff,'note','{"content":"Synthetic handle tightened"}',1),(campus,task,staff,'test_result','{"content":"Synthetic repeated function test passed"}',1);
perform public.orion_assignment_action(assignment,staff,3,'submit');
if (select state from public.incidents where id=incident)<>'submitted_for_verification' then raise exception 'CR verification queue was not updated'; end if;
if not exists(select 1 from public.jobs where incident_id=incident and type='verification') then raise exception 'Verification was not scheduled'; end if;
rejected:=false;
begin perform public.orion_confirm_incident(incident,cr,4,'accepted','Synthetic test'); exception when others then rejected:=true; end;
if not rejected then raise exception 'Accepted without agent review'; end if;
insert into public.verification_records(institution_id,task_id,evidence_version,human_result,agent_verdict,reasons)
values(campus,task,1,'pending','needs_human_review','{}');
result:=public.orion_confirm_incident(incident,cr,4,'accepted','Synthetic human confirmation');
if result->>'state'<>'resolved' then raise exception 'Verified incident did not resolve'; end if;
if has_function_privilege('authenticated','public.orion_assignment_action(uuid,uuid,integer,text,text)','EXECUTE') then raise exception 'Browser may call service RPC'; end if;
end $$;
select 'PASS: wrong staff, stale version, missing evidence, pending agent review, CR queue, durable verification, human closure, RPC permissions' as regression;
