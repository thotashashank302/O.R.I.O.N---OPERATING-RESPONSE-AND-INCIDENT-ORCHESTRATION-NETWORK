import { CommanderAgent } from "../src/server/agents/commander";
import { FeatherlessProvider } from "../src/server/agents/provider";
const agent=new CommanderAgent(new FeatherlessProvider({
 apiKey:process.env.FEATHERLESS_API_KEY!,baseUrl:process.env.FEATHERLESS_BASE_URL!,model:process.env.FEATHERLESS_MODEL!,
}));
const output=await agent.execute({
 runId:crypto.randomUUID(),institutionId:"11111111-1111-4111-8111-111111111111",
 incidentId:"22222222-2222-4222-8222-222222222222",incidentVersion:1,promptVersion:"commander-v2",
 context:{incident:{id:"22222222-2222-4222-8222-222222222222",institutionId:"11111111-1111-4111-8111-111111111111",version:1,planVersion:0,description:"SYNTHETIC SOFTWARE TEST: A classroom desk has a loose handle. Inspect and tighten the handle using normal facilities procedures. No safety hazard or electrical work.",category:"facilities",locationId:null,visibility:"routine",severityFloor:"normal",state:"triaging",failedReason:null},eligibleProfiles:["facilities"],priorPlan:null,failureReason:null}
});
console.log(JSON.stringify({status:"schema_valid",latencyMs:output.latencyMs,profiles:output.result.specialists,tasks:output.result.tasks.length,repaired:output.repaired}));
