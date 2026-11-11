# Requirements

## Product context
EduFlow is an independent SaaS school ERP. One deployment serves many
institutions; each institution has its OWN PostgreSQL database (project-per-tenant).
Initial scope is schools only. College features are deferred.

## Roles (v1) — EXACTLY FOUR
- ADMIN       — Principal / Head of Institution
- TEACHER
- STUDENT
- STAFF       — Finance + other staff (Reception, Library). Split by `staff_type`.

There is NO separate Parent role. Parent access uses the student's credentials.

## Admin dashboard
Three management sections plus setup:
- Student Management: Create/edit, profile, enrollment, fee status.
- Teacher Management: Create/edit, assign to classes/subjects.
- Staff Management: Create/edit, set staff_type (Finance, Reception).
- Institution Setup: Years, Classes/Sections, Subjects, Announcements.

## Teacher dashboard
- **My Class:** Visible ONLY if assigned as class teacher. Shows roster, attendance overview.
- **All Students:** Always visible. Browse all students read-only. Restricted fields (no guardian info).

## Staff (Finance) dashboard
- Manage fee structures, invoices, payments, receipts, refunds.
- View student billing info (guardian contact allowed for billing only).

## Staff (General) dashboard
- View student directory (restricted fields).

## Non-functional
- Pagination on all lists (default 25).
- Audit logging on all writes.
- Cross-tenant access returns 404.
- Passwords hashed (argon2). JWT in HttpOnly cookie.