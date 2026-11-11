# RBAC

Legend: ✓ allow · ✗ deny · R restricted

## Permission strings
users.create, users.read_all, users.read_own, users.update_own, users.update_others, users.deactivate
students.read_directory
academic_units.crud, subjects.crud, allocations.crud, enrollments.crud
attendance.mark_class, attendance.mark_self, attendance.read_class, attendance.read_own, attendance.correct
announcements.create_global, announcements.create_class, announcements.forward, announcements.read
fees.structures_crud, fees.invoices_crud, fees.payments_crud, fees.refunds_crud, fees.read_all, fees.read_own
teacher.my_class.view

## Role → permission mapping (seed)
ADMIN: everything.
TEACHER: users.read_own, users.update_own, students.read_directory, allocations.list_own,
         enrollments.list_own, teacher.my_class.view (conditional), attendance.mark_class,
         attendance.mark_self, attendance.read_class, attendance.read_own, attendance.correct (same-day),
         announcements.create_class, announcements.forward, announcements.read.
STUDENT: users.read_own, users.update_own, attendance.read_own, fees.read_own, announcements.read.
STAFF (FINANCE): users.read_own, users.update_own, students.read_directory, attendance.mark_self, attendance.read_own, fees.*, announcements.read.
STAFF (GENERAL): users.read_own, users.update_own, students.read_directory, attendance.mark_self, attendance.read_own, announcements.read.

## Field-level restrictions (students.read_directory)
Directory responses contain ONLY: full_name, photo_url (null for now),
admission_number, class_name, section_name, roll_number.
Excluded: guardian_name, guardian_phone, date_of_birth, address, fee_balance.

## Conditional permissions
- `teacher.my_class.view` requires `teaching_assignments.is_class_teacher = TRUE`.
- `attendance.correct` requires the record was marked by this teacher today.

## Cross-tenant
Every request resolves to exactly one tenant database.
A request for another tenant's resource returns 404.