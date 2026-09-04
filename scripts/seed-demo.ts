import { createClient } from "@supabase/supabase-js";

const required = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY"] as const;
for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} is required`);
}
if (process.env.DEMO_MODE !== "true") throw new Error("Set DEMO_MODE=true only for an approved isolated demo environment");

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: institution, error: institutionError } = await supabase
  .from("institutions")
  .upsert({ name: "ORION Controlled Demo College", code: "ORION-DEMO", approval_state: "pending", is_demo: true }, { onConflict: "code" })
  .select("id")
  .single();
if (institutionError) throw institutionError;

const { data: departments, error: departmentError } = await supabase
  .from("departments")
  .upsert([
    { institution_id: institution.id, name: "Computer Science", kind: "academic" },
    { institution_id: institution.id, name: "Facilities", kind: "service" },
    { institution_id: institution.id, name: "IT Support", kind: "service" },
    { institution_id: institution.id, name: "Security", kind: "service" },
  ], { onConflict: "institution_id,name" })
  .select("id,name");
if (departmentError) throw departmentError;

const facilitiesId = departments.find((department) => department.name === "Facilities")?.id;
const itId = departments.find((department) => department.name === "IT Support")?.id;
if (!facilitiesId || !itId) throw new Error("Required demo departments were not returned");

const { data: existingLocation, error: locationReadError } = await supabase
  .from("campus_locations")
  .select("id")
  .eq("institution_id", institution.id)
  .eq("label", "Demo Room A-101")
  .maybeSingle();
if (locationReadError) throw locationReadError;
if (!existingLocation) {
  const { error: locationError } = await supabase.from("campus_locations").insert({
    institution_id: institution.id,
    kind: "room",
    label: "Demo Room A-101",
    asset_counts: { fans: 4, switchboards: 1 },
  });
  if (locationError) throw locationError;
}

const { error: categoryError } = await supabase.from("category_routes").upsert([
  { institution_id: institution.id, category: "electrical", responsible_department_id: facilitiesId, verifier_role: "cr", safety_floor: "high" },
  { institution_id: institution.id, category: "it_network", responsible_department_id: itId, verifier_role: "cr", safety_floor: "normal" },
], { onConflict: "institution_id,category" });
if (categoryError) throw categoryError;

console.log(`Seeded non-personal fixtures for demo institution ${institution.id}. Approval, users, memberships, roles, and inboxes must be created through authorized flows.`);
