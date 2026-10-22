import { randomUUID } from 'node:crypto';

/** Runs against the same disposable migrated database as the original regression journey. */
export async function readinessChecks({ q, pool, check, rejects, fixture, campus, otherCampus, reporter, staff, hod }) {
  const principal = randomUUID(), ordinary = randomUUID(), replacement = randomUUID();
  for (const [id, role] of [[principal, 'principal'], [ordinary, 'student'], [replacement, 'staff']]) {
    await q('insert into auth.users(id,email) values($1,$2)', [id, `${id}@example.invalid`]);
    await q('insert into institution_memberships(id,institution_id,user_id) values($1,$2,$1)', [id, campus]);
    await q('insert into role_grants(institution_id,membership_id,role,granted_by) values($1,$2,$3,$2)', [campus,id,role]);
  }
  const confidential = await fixture({ visibility: 'confidential', accused: staff });
  await q(`insert into approvals(institution_id,incident_id,task_id,action_payload_hash,plan_version,action_payload) values($1,$2,$3,'synthetic',1,'{"checklist":["Private detail"]}')`, [campus,confidential.incident,confidential.task]);
  const asUser = async (id, sql, values=[]) => {
    const connection = await pool.connect();
    try {
      await connection.query('begin'); await connection.query('set local role authenticated');
      await connection.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
      return await connection.query(sql,values);
    } finally { await connection.query('rollback'); connection.release(); }
  };
  for (const [table,column,id] of [
    ['incidents','id',confidential.incident],['incident_plans','id',confidential.plan],['incident_tasks','id',confidential.task],
    ['assignments','task_id',confidential.task],['approvals','task_id',confidential.task],['resolution_evidence','task_id',confidential.task],['verification_records','task_id',confidential.task],
  ]) {
    for (const actor of [ordinary,staff]) check(!(await asUser(actor,`select * from public.${table} where ${column}=$1`,[id])).rowCount,`${table} hides confidential child rows from ordinary/accused member`);
  }
  check((await asUser(reporter,'select * from incident_tasks where id=$1',[confidential.task])).rowCount===1,'Reporter can read own confidential task');
  check((await q('select orion_get_incident($1,$2,$3) data',[ordinary,campus,confidential.incident])).rows[0].data===null,'Service reads use same case policy');
  check((await q('select orion_get_incident($1,$2,$3) data',[principal,otherCampus,confidential.incident])).rows[0].data===null,'Read endpoint binds selected tenant');

  // Real SQL approval path, including policy floor, rollback, authority and concurrent decisions.
  const dept=randomUUID(),wrongDept=randomUUID();
  await q(`insert into departments(id,institution_id,name,kind) values($1,$3,'Readiness','academic'),($2,$3,'Other readiness','academic')`,[dept,wrongDept,campus]);
  await q(`update role_grants set department_id=$1 where membership_id=$2 and role='hod'`,[wrongDept,hod]);
  const f=await fixture();
  await q('update assignments set active_version=false,state=\'cancelled\' where task_id=$1',[f.task]);
  await q(`update incidents set category='electrical_safety',state='planned',reporting_scope=jsonb_build_object('kind','student','departmentId',$1::text) where id=$2`,[dept,f.incident]);
  await q(`update incident_tasks set state='ready',requires_approval=false where id=$1`,[f.task]);
  check((await q('select requires_approval from incident_tasks where id=$1',[f.task])).rows[0].requires_approval,'Database enforces electrical approval even when model flag is false');
  const job=randomUUID();
  await q(`insert into jobs(id,institution_id,incident_id,type,status,dedupe_key,lease_until,worker_id,attempt,payload) values($1::uuid,$2,$3,'specialist','running',$1::text,now()+interval '5 minutes','sql-test',1,jsonb_build_object('taskId',$4::text))`,[job,campus,f.incident,f.task]);
  const action={taskId:f.task,candidateStaffId:staff,checklist:['Safely inspect equipment'],evidenceRequired:['note','test_result'],communicationType:'approval_request'};
  const version=(await q('select version from incidents where id=$1',[f.incident])).rows[0].version;
  const capability=(await q('select version from staff_capabilities where membership_id=$1',[staff])).rows[0].version;
  await q('select persist_specialist_action($1,$2,$3,$4,null,\'sql-test\',1)',[job,version,capability,action]);
  const ap=(await q('select * from approvals where task_id=$1',[f.task])).rows[0];
  check(!!ap,'Approval-required specialist action persists without null reminder key');
  check(!(await q('select 1 from assignments where task_id=$1 and active_version',[f.task])).rowCount,'Approval request does not assign work early');
  const decide = (actor=principal,hash=ap.action_payload_hash) => q("select orion_decide_approval($1,$2,$3,1,$4,'approve','Reviewed exact checklist')",[ap.id,actor,campus,hash]);
  await rejects(()=>decide(hod),/scoped operator/);
  await q(`update role_grants set department_id=$1,starts_at=now()-interval '2 days',ends_at=now()-interval '1 day' where membership_id=$2 and role='hod'`,[dept,hod]);
  await rejects(()=>decide(hod),/scoped operator/);
  await q(`insert into role_grants(institution_id,membership_id,role,department_id,granted_by) values($1,$2,'hod',$3,$4)`,[campus,staff,dept,principal]);
  await rejects(()=>decide(staff),/Self approval/);
  await rejects(()=>decide(principal,'altered'),/Stale/);
  await q("update incident_plans set status='superseded' where id=$1",[f.plan]);
  await rejects(()=>decide(),/Stale/);
  await q("update incident_plans set status='active' where id=$1",[f.plan]);
  await q(`update staff_capabilities set availability='off_duty' where membership_id=$1`,[staff]);
  await rejects(()=>decide(),/staff eligibility/);
  check((await q('select decision from approvals where id=$1',[ap.id])).rows[0].decision===null,'Assignment failure rolls back approval decision');
  await q(`update staff_capabilities set availability='available' where membership_id=$1`,[staff]);
  const race=await Promise.allSettled([decide(),decide()]);
  check(race.filter(r=>r.status==='fulfilled').length===1,'One concurrent approval wins');
  const assigned=(await q('select * from assignments where task_id=$1 and active_version',[f.task])).rows[0];
  check(!!assigned,'Exact approved action creates an assignment');
  check((await q(`select count(*)::int n from jobs where payload->>'assignmentId'=$1 and type in ('ack_reminder','assignment_escalation')`,[assigned.id])).rows[0].n===2,'Assignment transaction schedules both deadlines');
  check((await q('select count(*)::int n from email_outbox where assignment_id=$1',[assigned.id])).rows[0].n===1,'One assignment email outbox row');

  // A failed replacement cannot release the existing owner.
  let incidentVersion=(await q('select version from incidents where id=$1',[f.incident])).rows[0].version;
  const transfer=()=>q('select orion_override_incident($1,$2,$3,$4,\'Transfer after staff absence\',null,$5,$6)',[f.incident,principal,campus,incidentVersion,f.task,replacement]);
  await rejects(transfer,/staff eligibility/);
  check((await q('select active_version from assignments where id=$1',[assigned.id])).rows[0].active_version,'Failed replacement keeps old assignment active');
  await q(`insert into staff_capabilities(institution_id,membership_id,skills,availability,workload_limit,updated_by) values($1,$2,'{facilities}','available',2,$3)`,[campus,replacement,principal]);
  await transfer();
  const current=(await q('select * from assignments where task_id=$1 and active_version',[f.task])).rows[0];
  check(current.assignee_membership_id===replacement,'Authorized transfer creates one current replacement');
  check((await q('select state from assignments where id=$1',[assigned.id])).rows[0].state==='released','Old owner explicitly released');
  await q("select orion_assignment_action($1,$2,1,'acknowledge')",[current.id,replacement]);
  await q("select orion_assignment_action($1,$2,2,'start')",[current.id,replacement]);
  const append=(kind,content='Synthetic physical inspection',key=null,actor=replacement)=>q('select orion_append_evidence($1,$2,$3,3,$4,$5,$6)',[f.task,actor,campus,kind,content,key]);
  await rejects(()=>append('photo','Synthetic photograph','missing-object'),/Owned uploaded object/);
  const key=`institutions/${campus}/members/${replacement}/incidents/pre-intake/${randomUUID()}.png`;
  await q('select orion_register_upload($1,$2,$3,32,\'image/png\')',[replacement,campus,key]);
  await q(`insert into storage.objects(bucket_id,name,metadata) values('evidence-vault',$1,'{"size":32,"mimetype":"image/png"}')`,[key]);
  await append('photo','Synthetic owned photograph',key);
  check((await q('select count(*)::int n from resolution_evidence where task_id=$1 and evidence_version=2 and kind=\'photo\'',[f.task])).rows[0].n===1,'Owned uploaded photograph accepted for current evidence version');
  const photograph=(await q("select id from resolution_evidence where task_id=$1 and kind='photo'",[f.task])).rows[0].id;
  check((await q('select orion_can_preview_evidence($1,$2,$3) allowed',[principal,campus,photograph])).rows[0].allowed,'Private preview checks owned object binding');
  const forged=(await q("insert into resolution_evidence(institution_id,task_id,uploader_membership_id,kind,storage_key,structured_result,evidence_version) values($1,$2,$3,'photo','legacy-forged-key','{}',2) returning id",[campus,f.task,replacement])).rows[0].id;
  check(!(await q('select orion_can_preview_evidence($1,$2,$3) allowed',[principal,campus,forged])).rows[0].allowed,'Legacy arbitrary keys cannot become signed previews');
  await q('delete from resolution_evidence where id=$1',[forged]);
  await append('note'); await append('test_result');
  await q("select orion_assignment_action($1,$2,3,'submit')",[current.id,replacement]);
  await rejects(()=>append('note'),/Stale assignment/);
  const reviewQueue=(await q('select orion_verification_queue($1,$2) data',[reporter,campus])).rows[0].data;
  check(reviewQueue.some(task=>task.id===f.task && task.evidenceVersion===2),'Designated verifier queue includes current transferred-task evidence');
  check(!(await q('select orion_verification_queue($1,$2) data',[ordinary,campus])).rows[0].data.length,'Other members do not receive designated review tasks');
  const unsafePhoto=(await q("insert into resolution_evidence(institution_id,task_id,uploader_membership_id,kind,storage_key,structured_result,evidence_version) values($1,$2,$3,'photo','legacy-unowned','{}',2) returning id",[campus,f.task,replacement])).rows[0].id;
  await q('select private.orion_record_agent_verification($1,$2,2,$3,$4)',[f.task,campus,{id:randomUUID(),provider:'test',model:'test',prompt_version:'test',latency_ms:1,status:'succeeded'},{verdict:'needs_human_review',reasons:['Inspect current repair']}]);
  await rejects(()=>q("select orion_verify_task($1,$2,$3,2,'accepted','Physically inspected')",[f.task,reporter,campus]),/photo ownership/);
  await q('delete from resolution_evidence where id=$1',[unsafePhoto]);
  await q("select orion_verify_task($1,$2,$3,2,'accepted','Physically inspected')",[f.task,reporter,campus]);
  check((await q('select state from incidents where id=$1',[f.incident])).rows[0].state==='resolved','Transferred task closes only after valid evidence and independent human review');

  // Clarification failure leaves neither a partial incident transition nor an orphan job.
  const clarify=await fixture();
  await q(`update incidents set state='needs_clarification',clarification_request='{"question":"Which room?"}' where id=$1`,[clarify.incident]);
  await q(`create function private.reject_clarify_job() returns trigger language plpgsql as $$begin if new.dedupe_key like 'clarify:%' then raise exception 'Injected queue failure';end if;return new;end$$;
    create trigger reject_clarify before insert on jobs for each row execute function private.reject_clarify_job()`);
  await rejects(()=>q("select orion_clarify_incident($1,$2,1,'Room 104')",[clarify.incident,reporter]),/Injected queue/);
  check((await q('select state from incidents where id=$1',[clarify.incident])).rows[0].state==='needs_clarification','Queue failure rolls clarification back');
  await q('drop trigger reject_clarify on jobs;drop function private.reject_clarify_job()');
  await q("select orion_clarify_incident($1,$2,1,'Room 104')",[clarify.incident,reporter]);
  check((await q(`select count(*)::int n from jobs where incident_id=$1 and dedupe_key like 'clarify:%'`,[clarify.incident])).rows[0].n===1,'Clarification records durable planning intent');

  for (const kind of ['cr','transport','club']) {
    await rejects(()=>q(`insert into incidents(institution_id,reporter_membership_id,category,description,reporting_scope) values($1,$2,'other','Synthetic unauthorized scope',jsonb_build_object('kind',$3::text))`,[campus,ordinary,kind]),/scope required|enrollment required|term required/);
  }
  // Exercise real claim/reclaim with a stale worker, not a permissive mock.
  const leaseJob=randomUUID();
  await q(`insert into jobs(id,institution_id,type,dedupe_key,due_at) values($1::uuid,$2,'outbox_delivery',$1::text,'1970-01-01')`,[leaseJob,campus]);
  const first=(await q("select * from claim_jobs('worker-a',20,30)")).rows.find(row=>row.id===leaseJob);
  check(!!first,'First worker claims due job');
  await q("update jobs set lease_until=now()-interval '1 second' where id=$1",[leaseJob]);
  const second=(await q("select * from claim_jobs('worker-b',20,30)")).rows.find(row=>row.id===leaseJob);
  check(second.attempt===first.attempt+1,'Expired lease can be reclaimed');
  await rejects(()=>q("select orion_job_control($1,'worker-a',$2,'succeed')",[leaseJob,first.attempt]),/Worker lease lost/);
  await q("select orion_job_control($1,'worker-b',$2,'renew')",[leaseJob,second.attempt]);
  await q("select orion_job_control($1,'worker-b',$2,'succeed')",[leaseJob,second.attempt]);
  check((await q('select status from jobs where id=$1',[leaseJob])).rows[0].status==='succeeded','Only current claim can complete job');

  const cancelledJob=randomUUID();
  const deadBefore=(await q('select orion_automation_health() data')).rows[0].data.dead_jobs;
  await q(`insert into jobs(id,institution_id,type,status,dedupe_key,due_at,last_error,attempt) values($1::uuid,$2,'commander','dead',$1::text,'1970-01-01','Original timeout',3)`,[cancelledJob,campus]);
  check((await q('select orion_automation_health() data')).rows[0].data.dead_jobs===deadBefore+1,'Unresolved failure remains in health');
  await q("update jobs set status='cancelled' where id=$1",[cancelledJob]);
  check(!(await q("select * from claim_jobs('cancellation-test',20,30)")).rows.some(row=>row.id===cancelledJob),'Cancelled historical job is never claimed');
  const cancelled=(await q('select status,last_error,attempt from jobs where id=$1',[cancelledJob])).rows[0];
  check(cancelled.status==='cancelled' && cancelled.last_error==='Original timeout' && cancelled.attempt===3,'Cancellation preserves failure and attempt history');
  check((await q('select orion_automation_health() data')).rows[0].data.dead_jobs===deadBefore,'Reviewed cancellation clears only that unresolved failure');

  await q(`insert into incidents(institution_id,reporter_membership_id,category,description,created_at) select $1,$2,'other','Pagination report '||n,now()-n*interval '1 second' from generate_series(1,105) n`,[campus,ordinary]);
  const page1=(await q('select orion_incident_feed($1,$2) page',[ordinary,campus])).rows[0].page;
  const last=page1.at(-1);
  const page2=(await q('select orion_incident_feed($1,$2,$3,$4) page',[ordinary,campus,last.created_at,last.id])).rows[0].page;
  check(page1.length===50 && page2.length===50,'Feed exposes older work through stable pages');
  check(!page2.some(row=>page1.some(first=>first.id===row.id)),'Feed pages do not overlap');
  check(!page1.concat(page2).some(row=>row.id===confidential.incident),'Hidden confidential rows never enter paginated service feed');
  await q('select orion_record_tick(false)');
  check((await q('select orion_automation_health() data')).rows[0].data.last_tick_failed===false,'Health records a successful tick');
  await q('select orion_record_tick(true)');
  check((await q('select orion_automation_health() data')).rows[0].data.last_tick_failed===true,'Health records a failed tick');
  const exposed=await q(`select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'orion_%' and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute'))`);
  check(exposed.rowCount===0,'All ORION service RPCs deny browser execution');
}
