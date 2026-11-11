# AGENTS.md — Rules for the AI Coding Agent

## Project
EduFlow — multi-institution school ERP, SaaS, project-per-tenant database model.
Stack: Next.js (JSX) frontend, Django + DRF backend, PostgreSQL.

## Read in this order before any task
1. docs/requirements.md   — what to build
2. docs/rbac.md           — permissions (NEVER guess)
3. docs/dbplanning.md     — schema, tenant model (NEVER invent tables)
4. docs/design_system.md  — UI rules (NEVER invent new layouts)
5. docs/testing.md        — test requirements per module
6. docs/planning.md       — current phase + Definition of Done

If a task is not in the current phase, STOP and ask.

## Roles (exactly four)
ADMIN · TEACHER · STUDENT · STAFF.
STAFF has staff_type ∈ {FINANCE, RECEPTION, LIBRARY, OTHER}.
There is no PARENT role. Parent access uses the student's credentials.

## Non-negotiable rules
- Tenant isolation is at the DATABASE boundary. No shared DB for tenant data.
- Every tenant request is routed to its own database via the router/middleware.
- Roles live on `membership`, not `user`.
- Business code NEVER checks `role == 'TEACHER'` or `staff_type == 'FINANCE'`.
  It checks `has_perm('<perm>')`. staff_type only seeds the permission set.
- Conditional permissions (e.g. teacher.my_class.view) are resolved at
  request time by inspecting state (is_class_teacher, ownership, same-day).
- Cross-tenant requests return 404, never 403.
- Field-restricted endpoints (students.read_directory) exclude
  guardian_name, guardian_phone, dob, address, fee data — by serializer,
  not by frontend filtering.
- Views are thin. Business logic lives in services.py.
- Frontend: no fetch in components. All HTTP goes through src/services/*.
- Frontend: JWT in HttpOnly cookie. No localStorage.
- Frontend: Use the existing UI layout. Follow docs/design_system.md.
- One unified UserForm for all roles. No per-role creation forms.
- Money: NUMERIC(14,2) in DB, Python Decimal in code, no floats.

## Testing rules (apply to every module, every phase)
- Every model's constraints are proven by test_<model>_constraints.py.
- Every service has ≥ 3 tests: happy path, guard failure, rollback.
- Every permission string has 4 mandatory tests: allow, deny (403),
  anonymous (401), cross-tenant (404).
- Every directory-style endpoint has an exclusion assertion
  (guardian_phone not in response keys).
- Conditional permissions have both TRUE and FALSE cases tested.
- No new endpoint merges without a cross-tenant 404 test.

## Workflow per task
1. Cite the doc section justifying the task.
2. List files to create/modify (including test files).
3. Wait for approval.
4. Implement backend + frontend + tests in small chunks.
5. Update docs if a decision changed.
6. Run full test suite; report pass/fail counts.

## When in doubt
Ask. Do not invent endpoints, tables, roles, permissions, or field rules.