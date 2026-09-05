do $migration$
declare
  original_definition text;
  corrected_definition text;
begin
  original_definition := pg_get_functiondef(
    'public.persist_commander_plan(uuid,integer,jsonb,uuid)'::regprocedure
  );
  corrected_definition := replace(
    original_definition,
    'prior_task.evidence_requirements @> task_payload->''evidencePolicy''',
    'prior_task.evidence_requirements @> (task_payload->''evidencePolicy'')'
  );
  corrected_definition := replace(
    corrected_definition,
    'task_payload->''evidencePolicy'' @> prior_task.evidence_requirements',
    '(task_payload->''evidencePolicy'') @> prior_task.evidence_requirements'
  );
  if corrected_definition <> original_definition then
    execute corrected_definition;
  end if;
end
$migration$;
