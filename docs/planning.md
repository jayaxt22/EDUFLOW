# Planning

Every phase = full vertical slice (backend + API + frontend + tests + docs).
Every phase DoD includes testing requirements from docs/testing.md.

## Phase 0 — Discovery & Architecture (No Code)
- Docs signed off. ERD created. API inventory drafted.

## Phase 1 — Foundation
- Django scaffold + 2-DB router.
- Logging, error envelope, permission registry.
- seed_dev management command.
- DoD: Migrations succeed. Seed creates demo school data.

## Phase 2 — Identity & Auth (Vertical Slice)
- Backend: JWT login, POST /users/ (creates user+membership+profile), permissions.
- Frontend: Login page integration, Admin dashboard layout, Unified UserForm.
- DoD: User creation works, field restrictions tested, NO localStorage.

## Phase 3 — Students & Academics
- Backend: Years, units, subjects, enrollments, allocations. Promotion transaction.
- Frontend: Class setup, "My Class", "All Students" directory.
- DoD: Teacher "All Students" hides guardian fields. Promotion atomic.

## Phase 4 — Attendance
- Backend: Mark-all API, corrections, self check-in.
- Frontend: Mark Attendance modal, weekly/donut charts.
- DoD: Concurrency safe, same-day correction rule enforced.

## Phase 5 — Examinations
- Backend: Marks, grading snapshots, publication.
- Frontend: Marks entry grid.
- DoD: Published results immutable; grading policy snapshotted.

## Phase 6 — Fees
- Backend: Invoices, payments (idempotency), refunds.
- Frontend: Finance dashboard.
- DoD: No floats, duplicate payment blocked.


## Phase 7 — Announcements & Communications
- Backend: Global, role-based, and class-targeted announcements; forward tracking.
- Frontend: Announcements bulletin board, post modal, class forwarding.
- DoD: Multi-tenant database boundary, strict visibility filtering, 4 mandatory endpoint tests.
