# Testing Strategy

## Test Categories (mandatory per module)
1. `test_<model>_constraints.py`: Prove DB constraints fire (duplicates, invalid money).
2. `test_<service>.py`: Business rules, transaction rollbacks.
3. `test_permissions_<module>.py`: 4 variants per endpoint (allow, deny 403, anonymous 401, cross-tenant 404).
4. `test_field_restrictions.py`: Assert excluded keys are ABSENT from JSON.
5. `test_conditional_permissions.py`: Test TRUE/FALSE for conditional logic (e.g., is_class_teacher).
6. `test_concurrency.py`: Simulate simultaneous writes (attendance, enrollments).
7. `test_migrations.py`: Run migrations from empty.

## Fixtures
- Two tenants created per session: `tenant_a`, `tenant_b`.
- Factories: `make_user(tenant, role)`, `make_student()`, `make_classroom()`.
- Never point tests at dev DB. Use `pytest-django`.

## Frontend (Playwright)
- Admin creates teacher -> appears in list.
- Teacher marks attendance -> count changes.
- Teacher without class teacher role -> sees NO "My Class".
- Teacher opens "All Students" -> sees only allowed fields.