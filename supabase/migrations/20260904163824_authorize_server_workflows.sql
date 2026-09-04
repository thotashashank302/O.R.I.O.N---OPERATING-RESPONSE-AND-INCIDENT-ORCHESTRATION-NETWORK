-- Authenticated clients may read only through the tenant-aware policies created
-- by the initial schema. Mutations remain server-only through service_role.
grant select on
  public.institution_memberships,
  public.role_grants,
  public.staff_capabilities,
  public.category_routes,
  public.incident_votes,
  public.incident_plans,
  public.incident_tasks,
  public.task_dependencies,
  public.assignments,
  public.approvals,
  public.resolution_evidence,
  public.verification_records,
  public.incident_events
to authenticated;
