import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UploadRequestSchema } from '@/contracts/reporting';

const state = vi.hoisted(() => ({
  rpc: vi.fn(), from: vi.fn(), triage: vi.fn(), execute: vi.fn(),
  handlers: {} as Record<string, (job: unknown) => Promise<void>>,
}));
vi.mock('@/server/db/supabase-admin', () => ({ createSupabaseAdmin: () => ({ rpc: state.rpc, from: state.from }) }));
vi.mock('@/server/auth/supabase-session', () => ({ createSupabaseSessionClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'user' } }, error: null }) } }) }));
vi.mock('@/server/agents/triage', () => ({ runTriageAgent: state.triage }));
vi.mock('@/server/agents/runner', () => ({ executeRecorded: state.execute }));
vi.mock('@/server/env', () => ({ getServerEnv: () => ({ AUTOMATION_SECRET: 'test-automation-secret' }), getEmailDeliveryEnv: () => ({}) }));
vi.mock('@/server/orchestration/jobs', () => ({
  DurableJobWorker: class {
    constructor(_store: unknown, handlers: typeof state.handlers) { state.handlers = handlers; }
    async tick() { throw new Error('secret.internal_table private provider error'); }
  }, JOB_TYPES: [],
}));
import { authorizePrivateUpload } from '@/server/reporting/upload-service';
import { requireRequestContext, AuthorizationUnavailableError, authorizationFailure } from '@/server/auth/request-context';
import { createPersistentIncident, confirmPersistentIncident, getPersistentIncident, listPersistentIncidents } from '@/server/reporting/persistent-service';
import { createProductionWorker } from '@/server/orchestration/production-worker';
import { POST as tick } from '@/app/api/automation/tick/route';

const tenant='11111111-1111-4111-a111-111111111111';
const member='22222222-2222-4222-a222-222222222222';
const incident='33333333-3333-4333-a333-333333333333';
const task='44444444-4444-4444-a444-444444444444';
const context = { institutionId:tenant,membershipId:member,userId:member,requestId:'test',roles:['student' as const],departmentIds:[],sectionIds:[] };
function queryResult(result: unknown) {
  const chain = { select: vi.fn(),eq:vi.fn(),gte:vi.fn(),limit:vi.fn(),order:vi.fn(),single:vi.fn(),maybeSingle:vi.fn(),then:vi.fn() };
  for (const method of [chain.select,chain.eq,chain.gte,chain.limit,chain.order,chain.single,chain.maybeSingle]) method.mockReturnValue(chain);
  chain.then.mockImplementation((resolve: (value:unknown)=>unknown) => Promise.resolve(result).then(resolve));
  return chain;
}
beforeEach(()=>{vi.clearAllMocks();});

describe('Upload boundaries',()=>{
  it.each([NaN,Infinity,-Infinity,-1,0,0.5,'123','abc',null])('rejects invalid numeric size %s before quota or signing', async fileSize=>{
    const consumeAttempt=vi.fn(),signUpload=vi.fn();
    const input={institutionId:tenant,memberId:member,fileName:'photo.png',fileSize:fileSize as number,mimeType:'image/png'};
    expect(UploadRequestSchema.safeParse(input).success).toBe(false);
    await expect(authorizePrivateUpload(input,{consumeAttempt,signUpload})).rejects.toThrow('Invalid file size');
    expect(consumeAttempt).not.toHaveBeenCalled();expect(signUpload).not.toHaveBeenCalled();
  });
  it('fails closed if the shared limiter fails',async()=>{
    const signUpload=vi.fn();state.rpc.mockResolvedValue({data:null,error:new Error('Database unavailable')});
    await expect(authorizePrivateUpload({institutionId:tenant,memberId:member,fileName:'x.png',fileSize:5,mimeType:'image/png'},{signUpload})).rejects.toThrow('Database unavailable');
    expect(signUpload).not.toHaveBeenCalled();
  });
  it('refuses signing when the shared quota is exhausted',async()=>{
    const signUpload=vi.fn();state.rpc.mockResolvedValue({data:false,error:null});
    await expect(authorizePrivateUpload({institutionId:tenant,memberId:member,fileName:'x.png',fileSize:5,mimeType:'image/png'},{signUpload})).rejects.toThrow('rate limit exceeded');
    expect(signUpload).not.toHaveBeenCalled();
  });
});

describe('Authorization failures',()=>{
  it.each(['institution_memberships','role_grants'])('does not turn %s query failures into empty authorization',async table=>{
    state.from.mockImplementation((name:string)=>queryResult(name===table ? {data:null,error:{message:'db error'}} : {data:{id:member,user_id:member,institution_id:tenant,status:'active'},error:null}));
    const request=new Request('http://localhost/api/incidents',{headers:{'x-orion-institution-id':tenant,'x-orion-membership-id':member}});
    await expect(requireRequestContext(request)).rejects.toBeInstanceOf(AuthorizationUnavailableError);
    const response=authorizationFailure(new AuthorizationUnavailableError());expect(response?.status).toBe(503);
  });
});

describe('Atomic persistence failures',()=>{
  const timeout=new Error('Connection lost after commit');
  it('never replays reporter writes after an uncertain RPC result',async()=>{
    state.from.mockImplementation((table:string)=>queryResult(table==='incidents' ? {data:{id:incident,institution_id:tenant,reporter_membership_id:member,state:'submitted_for_verification',visibility:'routine',version:1},error:null} : {data:null,count:0,error:null}));
    state.rpc.mockResolvedValue({data:null,error:timeout});
    await expect(confirmPersistentIncident(context,incident,'rejected','Still broken',1)).rejects.toMatchObject({status:503});
    expect(state.rpc).toHaveBeenCalledTimes(1);
    expect(state.from.mock.calls.map(call=>call[0])).toEqual(['incidents','incident_votes','incident_votes']);
  });
  it('does not invoke triage if location lookup fails',async()=>{
    state.from.mockReturnValue(queryResult({data:null,error:timeout}));
    await expect(createPersistentIncident(context,{operationId:task,institutionId:tenant,description:'The classroom fan is broken',locationText:'Room 101'})).rejects.toBe(timeout);
    expect(state.triage).not.toHaveBeenCalled();expect(state.rpc).not.toHaveBeenCalled();
  });
  it('uses one transactional intake RPC and preserves the operation id',async()=>{
    state.from.mockReturnValue(queryResult({data:[],error:null}));
    state.triage.mockResolvedValue({result:{category:'facilities',secondaryRisks:[],locationId:null,impactSummary:'Broken fan',clarification:null},log:{provider:'test',model:'test',promptVersion:'test',latencyMs:1,status:'succeeded'}});
    state.rpc.mockResolvedValue({data:null,error:timeout});
    await expect(createPersistentIncident(context,{operationId:task,institutionId:tenant,description:'The classroom fan is broken',locationText:'Room 101'})).rejects.toMatchObject({status:503});
    expect(state.rpc).toHaveBeenCalledExactlyOnceWith('orion_create_incident',expect.objectContaining({operation_id:task}));
    expect(state.from).toHaveBeenCalledExactlyOnceWith('campus_locations');
  });
  it.each(['commander','specialist'])('does not replay %s writes after RPC timeout',async kind=>{
    createProductionWorker();
    const payload={incident:{id:incident,institutionId:tenant,version:1,planVersion:0,description:'Fan broken',category:'facilities',locationId:null,visibility:'routine',severityFloor:'normal',state:'triaging'},eligibleProfiles:['facilities'],priorPlan:null,failureReason:null};
    const specialistContext={incidentVersion:1,task:{id:task,profile:'facilities',goal:'Fix fan',evidencePolicy:['note'],requiresApproval:false},severity:'normal',eligibleStaff:[{membershipId:member,skills:['facilities'],availability:'available',activeAssignments:0,workloadLimit:1,capabilityVersion:1}]};
    const plan={priority:'normal',explanation:'Fix fan',specialists:['facilities'],tasks:[{localId:'fix',logicalTaskKey:'fix',profile:'facilities',goal:'Fix fan',dependsOn:[],evidencePolicy:['note'],requiresApproval:false}],acknowledgementMinutes:10};
    state.execute.mockResolvedValue({result:kind==='commander'?plan:{taskId:task,candidateStaffId:member,checklist:['Fix'],evidenceRequired:['note'],communicationType:'assignment'}});
    state.rpc.mockImplementation(async(name:string)=>name==='get_specialist_context'?{data:specialistContext,error:null}:{data:null,error:timeout});
    await expect(state.handlers[kind]({id:task,type:kind,incidentId:incident,institutionId:tenant,payload})).rejects.toBe(timeout);
    expect(state.from).not.toHaveBeenCalled();
    expect(state.rpc.mock.calls.filter(call=>String(call[0]).startsWith('persist_'))).toHaveLength(1);
  });
});

it('automation returns a generic error and logs server details',async()=>{
  const log=vi.spyOn(console,'error').mockImplementation(()=>{});
  try{
    const response=await tick(new Request('http://localhost/api/automation/tick',{method:'POST',headers:{authorization:'Bearer test-automation-secret'}}));
    expect(response.status).toBe(500);const body=await response.json();
    expect(body.error).toEqual({code:'AUTOMATION_FAILED',message:'Automation tick failed'});
    expect(JSON.stringify(body)).not.toContain('internal_table');expect(log).toHaveBeenCalled();
  }finally{log.mockRestore();}
});

// A database outage is not a missing incident or a successful zero-vote response.
describe('Reporting read failures', () => {
  it('returns a retryable error when the incident lookup fails', async () => {
    state.from.mockReturnValue(queryResult({ data: null, error: { message: 'private database detail' } }));
    await expect(getPersistentIncident(context, incident)).rejects.toMatchObject({ code: 'READ_UNAVAILABLE', status: 503 });
  });
  it('returns a retryable error when the feed lookup fails', async () => {
    state.from.mockReturnValue(queryResult({ data: null, error: { message: 'database offline' } }));
    await expect(listPersistentIncidents(context)).rejects.toMatchObject({ status: 503 });
  });
  it('keeps a genuinely missing incident distinct from an outage', async () => {
    state.from.mockReturnValue(queryResult({ data: null, error: null }));
    await expect(getPersistentIncident(context, incident)).resolves.toBeNull();
    expect(state.from).toHaveBeenCalledTimes(1);
  });
  it.each([0, 1])('does not invent vote facts when vote query %s fails', async failingQuery => {
    let voteQuery = 0;
    state.from.mockImplementation((table: string) => {
      if (table === 'incidents') return queryResult({ data: { id: incident, institution_id: tenant, reporter_membership_id: member, visibility: 'routine' }, error: null });
      return queryResult({ data: null, count: null, error: voteQuery++ === failingQuery ? { message: 'vote store unavailable' } : null });
    });
    await expect(getPersistentIncident(context, incident)).rejects.toMatchObject({ status: 503 });
  });
});

describe('HTTP authorization errors', () => {
  it('rejects missing context headers without a server error or database query', async () => {
    let caught: unknown;
    try { await requireRequestContext(new Request('http://localhost/api/incidents')); }
    catch (error) { caught = error; }
    expect(authorizationFailure(caught)?.status).toBe(403);
    expect(state.from).not.toHaveBeenCalled();
  });
  it('maps missing membership to an authentication error', async () => {
    state.from.mockReturnValue(queryResult({ data: null, error: null }));
    let caught: unknown;
    try { await requireRequestContext(new Request('http://localhost/api/incidents', { headers: { 'x-orion-institution-id': tenant, 'x-orion-membership-id': member } })); }
    catch (error) { caught = error; }
    expect(authorizationFailure(caught)?.status).toBe(401);
  });
});
