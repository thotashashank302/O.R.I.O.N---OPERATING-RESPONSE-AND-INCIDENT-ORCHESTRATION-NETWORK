-- ==============================================================================
-- ORION Identity & Institution Schema Draft
-- Developer 2 (Shivani) -> For Developer 1 (Lead) Review
-- Do NOT apply independently without Lead authorization.
-- ==============================================================================

-- 1. Institutions
CREATE TABLE IF NOT EXISTS institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  approval_state TEXT NOT NULL DEFAULT 'pending' CHECK (approval_state IN ('pending', 'approved', 'rejected')),
  approved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Departments
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'academic' CHECK (kind IN ('academic', 'service')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(institution_id, code)
);

-- 3. Campus Locations (Hierarchy: Block -> Floor -> Room / Lab)
CREATE TABLE IF NOT EXISTS campus_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES campus_locations(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('block', 'floor', 'room', 'lab', 'facility', 'outdoor')),
  label TEXT NOT NULL,
  asset_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Institution Memberships (Scoped user membership)
CREATE TABLE IF NOT EXISTS institution_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, institution_id)
);

-- 5. Student Roster (Pre-verified identity store)
CREATE TABLE IF NOT EXISTS student_roster (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  roll_number TEXT NOT NULL,
  roster_email TEXT NOT NULL,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  year INT NOT NULL CHECK (year >= 1 AND year <= 6),
  section TEXT NOT NULL,
  claimed_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(institution_id, roll_number)
);

-- 6. Role Grants (Enforces 2-seat CR constraints)
CREATE TABLE IF NOT EXISTS role_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id UUID NOT NULL REFERENCES institution_memberships(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('principal', 'admin', 'hod', 'cr', 'staff', 'student', 'transport_admin', 'club_president')),
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  section TEXT,
  seat_number INT CHECK (seat_number IN (1, 2)),
  club_id UUID,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  granted_by_membership_id UUID REFERENCES institution_memberships(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT
);

-- Unique index to prevent 2 active CRs occupying the same seat in the same section
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_cr_seat
ON role_grants (department_id, section, seat_number)
WHERE role = 'cr' AND revoked_at IS NULL AND seat_number IS NOT NULL;

-- 7. Staff Capabilities
CREATE TABLE IF NOT EXISTS staff_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id UUID NOT NULL UNIQUE REFERENCES institution_memberships(id) ON DELETE CASCADE,
  skills TEXT[] NOT NULL DEFAULT '{}',
  zones TEXT[] NOT NULL DEFAULT '{}',
  availability TEXT NOT NULL DEFAULT 'off_duty' CHECK (availability IN ('available', 'busy', 'off_duty')),
  workload_limit INT NOT NULL DEFAULT 5 CHECK (workload_limit > 0),
  updated_by UUID REFERENCES institution_memberships(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Transport Enrollments
CREATE TABLE IF NOT EXISTS transport_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id UUID NOT NULL REFERENCES institution_memberships(id) ON DELETE CASCADE,
  route_id TEXT NOT NULL,
  bus_number TEXT NOT NULL,
  verified_by_membership_id UUID REFERENCES institution_memberships(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Clubs & Club Terms
CREATE TABLE IF NOT EXISTS club_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  club_name TEXT NOT NULL,
  president_membership_id UUID NOT NULL REFERENCES institution_memberships(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE institution_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_terms ENABLE ROW LEVEL SECURITY;
