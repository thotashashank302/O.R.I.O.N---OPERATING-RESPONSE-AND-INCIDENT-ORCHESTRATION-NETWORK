/** Isolated PostgreSQL regression suite. Creates and drops ONLY its own test database.
 * ORION_TEST_PG_MODULE points to a separately installed pg module, keeping binaries out of this project.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
const { default: pg } = await import(process.env.ORION_TEST_PG_MODULE ?? 'pg');
const config = { host: '127.0.0.1', port: 55439, user: 'postgres', password: 'local-test-only' };
const database = `orion_security_${Date.now()}`;
const admin = new pg.Client({ ...config, database: 'postgres' }); await admin.connect();
await admin.query(`create database ${database}`);
const pool = new pg.Pool({ ...config, database, max: 24 });
const q = (sql, args=[]) => pool.query(sql,args);
let checks=0;
const check = (condition,message) => { assert.ok(condition,message); checks++; };
const rejects = async (operation,pattern) => { await assert.rejects(operation,pattern); checks++; };
try {
  // Minimal Supabase platform schemas; no external auth, storage or email requests.
  await q(`create schema auth; create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql as $$select null::uuid$$;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
  for (const role of ['anon','authenticated','service_role']) {
    const exists = await q('select 1 from pg_roles where rolname=$1',[role]);
    if (!exists.rowCount) await admin.query(`create role ${role}${role==='service_role'?' bypassrls':''}`);
  }
  for (const migration of (await readdir('supabase/migrations')).filter(x=>x.endsWith('.sql')).sort()) {
    await q(await readFile(`supabase/migrations/${migration}`,'utf8'));
    console.log('Applied',migration);
  }
  const campus=randomUUID(),otherCampus=randomUUID(),reporter=randomUUID(),staff=randomUUID(),hod=randomUUID();
  await q(`insert into institutions(id,name,code,approval_state,is_demo) values($1,'Security Test','TEST','approved',true),($2,'Other Test','OTHER','approved',true)`,[campus,otherCampus]);
  for(const id of [reporter,staff,hod]){
    await q('insert into auth.users(id,email) values($1,$2)',[id,`${id}@example.invalid`]);
    await q('insert into institution_memberships(id,institution_id,user_id) values($1,$2,$1)',[id,campus]);
  }
  await q(`insert into role_grants(institution_id,membership_id,role,granted_by) values($1,$2,'student',$2),($1,$3,'staff',$2),($1,$4,'hod',$2)`,[campus,reporter,staff,hod]);
  async function fixture({review=true,visibility='routine',accused=null}={}) {
    const incident=randomUUID(),plan=randomUUID(),task=randomUUID(),assignment=randomUUID();
    await q(`insert into incidents(id,institution_id,reporter_membership_id,category,description,state,visibility,accused_membership_id) values($1,$2,$3,'facilities','Synthetic security regression','submitted_for_verification',$4,$5)`,[incident,campus,reporter,visibility,accused]);
    await q(`insert into incident_plans(id,institution_id,incident_id,version,priority,explanation,acknowledgement_minutes,status) values($1,$2,$3,1,'normal','Synthetic regression',10,'active')`,[plan,campus,incident]);
    await q(`insert into incident_tasks(id,institution_id,plan_id,local_id,logical_task_key,specialist_profile,goal,evidence_requirements,state,designated_verifier_membership_id) values($1,$2,$3,'fix','fix','facilities','Fix handle','["note","test_result"]','submitted',$4)`,[task,campus,plan,reporter]);
    await q(`insert into assignments(id,institution_id,task_id,assignee_membership_id,state,acknowledgement_deadline) values($1,$2,$3,$4,'completed',now())`,[assignment,campus,task,staff]);
    await q(`insert into resolution_evidence(institution_id,task_id,uploader_membership_id,kind,structured_result,evidence_version) values($1,$2,$3,'note','{"content":"Fixed handle"}',1),($1,$2,$3,'test_result','{"content":"Test passed"}',1)`,[campus,task,staff]);
    if(review)await q(`insert into verification_records(institution_id,task_id,evidence_version,human_result,agent_verdict,reasons) values($1,$2,1,'pending','needs_human_review','{}')`,[campus,task]);
    return {incident,plan,task,assignment};
  }
  const verify = (f,actor=reporter,version=1,decision='accepted',tenant=campus)=>q('select orion_verify_task($1,$2,$3,$4,$5,$6)',[f.task,actor,tenant,version,decision,'Synthetic human inspection']);
  const confirm = (f,decision='accepted')=>q('select orion_confirm_incident($1,$2,1,$3,$4)',[f.incident,reporter,decision,'Synthetic reporter inspection']);
  let f=await fixture();
  await rejects(()=>verify(f,hod),/Designated active verifier/);
  await rejects(()=>verify(f,reporter,1,'accepted',otherCampus),/not authorized/);
  for(const version of [0,2,999]) await rejects(()=>verify(f,reporter,version),/Stale evidence/);
  const results=await Promise.allSettled([verify(f),verify(f)]);
  check(results.filter(x=>x.status==='fulfilled').length===1,'Only one concurrent verification succeeds');
  const records=await q(`select * from verification_records where task_id=$1 and human_result='pass'`,[f.task]);
  check(records.rowCount===1 && records.rows[0].verifier_membership_id===reporter,'Exactly one human record identifies its actor');
  check((await q(`select count(*)::int n from incident_events where incident_id=$1 and action='task_verification_accepted'`,[f.incident])).rows[0].n===1,'Single task audit event');
  f=await fixture();
  const confirmations=await Promise.allSettled([confirm(f),confirm(f,'rejected')]);
  check(confirmations.filter(x=>x.status==='fulfilled').length===1,'Only one concurrent reporter decision succeeds');
  check((await q('select version from incidents where id=$1',[f.incident])).rows[0].version===2,'Reporter version increments once');
  f=await fixture();
  const rejected=await Promise.allSettled([verify(f,reporter,1,'rejected'),verify(f,reporter,1,'rejected')]);
  check(rejected.filter(x=>x.status==='fulfilled').length===1,'Duplicate rejection conflicts');
  check((await q(`select count(*)::int n from jobs where incident_id=$1 and type='commander_enqueue'`,[f.incident])).rows[0].n===1,'Rejection queues exactly one durable replan');
  f=await fixture({review:false}); await rejects(()=>verify(f),/review pending/);
  f=await fixture({visibility:'confidential',accused:reporter}); await rejects(()=>verify(f),/Designated active verifier/);
  f=await fixture();await q(`delete from resolution_evidence where task_id=$1 and kind='test_result'`,[f.task]);await rejects(()=>verify(f),/incomplete/);
  f=await fixture();await q('update resolution_evidence set uploader_membership_id=$1 where task_id=$2',[hod,f.task]);await rejects(()=>verify(f),/incomplete/);
  f=await fixture();await q('update incident_tasks set designated_verifier_membership_id=$1 where id=$2',[staff,f.task]);await rejects(()=>verify(f,staff),/Independent verifier/);
  f=await fixture();await q(`update incident_tasks set evidence_requirements='["note","test_result","photo"]' where id=$1`,[f.task]);await rejects(()=>verify(f),/incomplete/);
  await rejects(()=>q(`insert into verification_records(institution_id,task_id,evidence_version,human_result,agent_verdict,reasons) values($1,$2,1,'pass','pass','{}')`,[campus,f.task]),/human_verifier_required/);
  // Simulate separate app instances through independent DB connections.
  const attempts=await Promise.all(Array.from({length:24},()=>q('select orion_consume_upload_attempt($1,$2) allowed',[campus,staff])));
  check(attempts.filter(r=>r.rows[0].allowed).length===10,'Shared limiter permits exactly ten concurrent tickets');
  const fresh = new pg.Client({...config,database});await fresh.connect();
  check(!(await fresh.query('select orion_consume_upload_attempt($1,$2) allowed',[campus,staff])).rows[0].allowed,'Limiter survives a new connection');await fresh.end();
  await q(`update private.upload_attempts set attempted_at=now()-interval '2 hours' where membership_id=$1`,[staff]);
  check((await q('select orion_consume_upload_attempt($1,$2) allowed',[campus,staff])).rows[0].allowed,'Expired attempts free capacity');
  await rejects(()=>q('select orion_consume_upload_attempt($1,$2)',[otherCampus,staff]),/Active membership/);
  // Remove fixtures from the normal-report quota without deleting their audit history.
  await q(`update incidents set created_at=now()-interval '2 hours'`);
  function intake(operation=randomUUID(),attachments=[]) {
    return [campus,reporter,operation,{description:'Synthetic new report',isConfidential:false,attachments},
      {id:randomUUID(),institution_id:campus,reporter_membership_id:reporter,category:'facilities',description:'Synthetic new report',reporting_scope:{kind:'student'},visibility:'routine',severity:'normal',state:'triaging'},
      {id:randomUUID(),provider:'test',model:'test',prompt_version:'test',latency_ms:1,status:'succeeded',validated_outcome:{}}];
  }
  const create = args=>q('select orion_create_incident($1,$2,$3,$4,$5,$6) result',args);
  const args=intake();const created=await Promise.all([create(args),create(args)]);
  check(created[0].rows[0].result.incident.id===created[1].rows[0].result.incident.id,'Concurrent intake retry returns same incident');
  check((await q('select count(*)::int n from incident_events where incident_id=$1',[args[4].id])).rows[0].n===1,'Intake has one audit event');
  const changed=[...args];changed[3]={...args[3],description:'Changed request'};await rejects(()=>create(changed),/Idempotency key reused/);
  const invalid=intake(randomUUID(),[{storageKey:'synthetic-invalid',fileName:'x.png',fileSize:-1,mimeType:'image/png'}]);await rejects(()=>create(invalid),/check constraint/);
  check(!(await q('select 1 from incidents where id=$1',[invalid[4].id])).rowCount,'Attachment failure rolls back incident');
  for(const table of ['agent_runs','incident_events']){
    await q(`create function private.test_failure() returns trigger language plpgsql as $$begin raise exception 'Injected write failure';end$$;
      create trigger inject_failure before insert on ${table} for each row execute function private.test_failure()`);
    const broken=intake();await rejects(()=>create(broken),/Injected write failure/);
    check(!(await q('select 1 from incidents where id=$1',[broken[4].id])).rowCount,`${table} failure rolls back incident`);
    await q(`drop trigger inject_failure on ${table};drop function private.test_failure()`);
  }
  const quota=await Promise.allSettled(Array.from({length:10},()=>create(intake())));
  check(quota.filter(x=>x.status==='fulfilled').length===4,'Concurrent intake enforces five reports per hour');
  f=await fixture({review:false});
  const agentArgs=[f.task,campus,1,{id:randomUUID(),provider:'test',model:'test',prompt_version:'test',latency_ms:1,status:'succeeded'},{verdict:'needs_human_review',reasons:['Inspect physically']}];
  const agent=()=>q('select orion_record_agent_verification($1,$2,$3,$4,$5) result',agentArgs);
  const agentResults=await Promise.all([agent(),agent()]);check(agentResults.filter(x=>x.rows[0].result).length===1,'Agent retry writes one review');
  await verify(f);check(!(await agent()).rows[0].result,'Late agent result cannot overwrite human decision');
  const privileges=await q(`select p.oid::regprocedure::text name from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('orion_verify_task','orion_confirm_incident','orion_create_incident','orion_consume_upload_attempt','orion_record_agent_verification') and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute'))`);
  check(!privileges.rowCount,'Browsers cannot call service mutation RPCs');
  const service = await pool.connect();try{await service.query('set role service_role');await service.query('select orion_consume_upload_attempt($1,$2)',[campus,hod]);checks++;}finally{await service.query('reset role');service.release();}
  // Full local persistence journey; model outputs are synthetic and no email is sent.
  const journeyId=args[4].id;
  await q(`insert into staff_capabilities(institution_id,membership_id,skills,availability,workload_limit,updated_by) values($1,$2,'{facilities}','available',1,$3)`,[campus,staff,reporter]);
  async function planJourney(goal,version) {
    const job=randomUUID(),run=randomUUID();
    await q(`insert into agent_runs(id,institution_id,incident_id,agent_name,provider,model,prompt_version,latency_ms,status) values($1,$2,$3,'commander','test','test','test',1,'succeeded')`,[run,campus,journeyId]);
    await q(`insert into jobs(id,institution_id,incident_id,type,status,dedupe_key,payload) values($1,$2,$3,'commander','running',$4,'{}')`,[job,campus,journeyId,`synthetic:${job}`]);
    const plan={priority:'normal',explanation:goal,specialists:['facilities'],tasks:[{localId:'handle',logicalTaskKey:'handle',profile:'facilities',goal,dependsOn:[],evidencePolicy:['note','test_result'],requiresApproval:false}],acknowledgementMinutes:10};
    const newPlan=(await q('select persist_commander_plan($1,$2,$3,$4) id',[job,version,plan,run])).rows[0].id;
    // Simulate a committed response being lost and the worker retrying that RPC.
    await rejects(()=>q('select persist_commander_plan($1,$2,$3,$4)',[job,version,plan,run]),/stale incident version/);
    const currentTask=(await q('select id from incident_tasks where plan_id=$1',[newPlan])).rows[0].id;
    const specialistJob=(await q(`update jobs set status='running' where incident_id=$1 and type='specialist' and payload->>'taskId'=$2 returning id`,[journeyId,currentTask])).rows[0].id;
    const sc=(await q('select get_specialist_context($1) context',[specialistJob])).rows[0].context;
    check(sc.eligibleStaff.some(x=>x.membershipId===staff),'Specialist sees eligible synthetic staff');
    const action={taskId:currentTask,candidateStaffId:staff,checklist:[goal],evidenceRequired:['note','test_result'],communicationType:'assignment'};
    const assignment=(await q('select persist_specialist_action($1,$2,1,$3,$4) id',[specialistJob,sc.incidentVersion,action,run])).rows[0].id;
    await rejects(()=>q('select persist_specialist_action($1,$2,1,$3,$4)',[specialistJob,sc.incidentVersion,action,run]),/task is not ready/);
    await q(`select orion_assignment_action($1,$2,1,'acknowledge')`,[assignment,staff]);
    await q(`select orion_assignment_action($1,$2,2,'start')`,[assignment,staff]);
    await rejects(()=>q(`select orion_assignment_action($1,$2,3,'submit')`,[assignment,staff]),/notes are required/);
    await q(`insert into resolution_evidence(institution_id,task_id,uploader_membership_id,kind,structured_result,evidence_version) values($1,$2,$3,'note','{"content":"Synthetic repaired handle"}',1),($1,$2,$3,'test_result','{"content":"Repeated test passed"}',1)`,[campus,currentTask,staff]);
    await q(`select orion_assignment_action($1,$2,3,'submit')`,[assignment,staff]);
    const review={id:randomUUID(),provider:'test',model:'test',prompt_version:'test',latency_ms:1,status:'succeeded'};
    await q('select orion_record_agent_verification($1,$2,1,$3,$4)',[currentTask,campus,review,{verdict:'needs_human_review',reasons:['Requires physical inspection']}]);
    return {task:currentTask,incident:journeyId,plan:newPlan};
  }
  let journey=await planJourney('Tighten loose handle',1);
  const firstDecision=await Promise.allSettled([verify(journey,reporter,1,'rejected'),verify(journey,reporter,1,'rejected')]);
  check(firstDecision.filter(x=>x.status==='fulfilled').length===1,'Journey duplicate rejection conflicts');
  check((await q(`select count(*)::int n from jobs where incident_id=$1 and type='commander_enqueue' and dedupe_key like 'replan:%'`,[journeyId])).rows[0].n===1,'Journey has one replan request');
  const replanVersion=(await q('select version from incidents where id=$1',[journeyId])).rows[0].version;
  journey=await planJourney('Replace damaged handle assembly and retest mounting',replanVersion);
  await verify(journey);
  check((await q('select state from incidents where id=$1',[journeyId])).rows[0].state==='resolved','Replanned journey resolves after human inspection');
  check((await q('select count(*)::int n from incident_plans where incident_id=$1',[journeyId])).rows[0].n===2,'Exactly two materially different plans');
  check(!(await q(`select 1 from incident_events where incident_id=$1 and actor_type='human' and actor_membership_id is null`,[journeyId])).rowCount,'Every human timeline event identifies its actor');

  console.log(`PASS: ${checks} PostgreSQL security, concurrency, rollback and permission assertions`);
} finally {
  await pool.end();await admin.query(`drop database ${database} with (force)`);await admin.end();
}
