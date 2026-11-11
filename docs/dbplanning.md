# Database Planning

## Tenancy model
- Project-per-tenant. Each institution has its own PostgreSQL database.
- Local dev: `eduflow_control` + `eduflow_tenant_demo`.
- No RLS. Isolation = database boundary.

## Control DB — `eduflow_control`
- `platform_users`: id, email, password_hash, is_active
- `institutions`: id, slug, name, status, external_tenant_id
- `tenant_registry`: institution_id, db_url, provider, provider_project_id, status

## Tenant DB — `eduflow_<slug>`

### Identity
- `users`: id, email, username, password_hash, full_name, avatar, dob, nationality, date_of_joining, phone, gender, marital_status, emergency_contact_name, emergency_contact_phone, emergency_contact_relation, current_address, is_active
- `memberships`: id, user_id (UNIQUE), role (ADMIN/TEACHER/STUDENT/STAFF), status
- `student_profiles`: id, membership_id (UNIQUE), admission_number (UNIQUE), dob, guardian_name, guardian_phone
- `teacher_profiles`: id, membership_id (UNIQUE), employee_id (UNIQUE), qualification
- `staff_profiles`: id, membership_id (UNIQUE), employee_id (UNIQUE), staff_type (FINANCE/RECEPTION/LIBRARY/OTHER), department, designation

### Academics
- `academic_years`: id, name, start_date, end_date, is_current (Partial UNIQUE on is_current=TRUE)
- `academic_units`: id, academic_year_id, name, unit_type, parent_id (Self-FK, Partial UNIQUE on (academic_year_id, name) where unit_type='CLASS', Partial UNIQUE on (parent_id, name) where unit_type='SECTION')
- `subjects`: id, name, code (UNIQUE)
- `student_enrollments`: id, membership_id, academic_unit_id, roll_number, enrolled_from, enrolled_to (UNIQUE academic_unit_id, roll_number, enrolled_from)
- `teaching_assignments`: id, membership_id, subject_id, academic_unit_id, is_class_teacher (Partial UNIQUE on academic_unit_id where is_class_teacher=TRUE)

### Attendance
- `attendance_records`: id, subject_user_id, context (CLASSROOM/SELF), academic_unit_id, date, status, marked_by_id
  - UNIQUE (subject_user_id, date, context)
  - CHECK (context = 'CLASSROOM' -> academic_unit_id IS NOT NULL)

### Announcements
- `announcements`: id, title, content, created_by_id, target_role, target_academic_unit_id, forwarded_from_id (Self-FK), published_at

## Constraints
- All money: NUMERIC(14,2).
- All PKs: UUIDv7.
- All timestamps: TIMESTAMPTZ (UTC).
