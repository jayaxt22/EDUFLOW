"""
Management command to seed development databases:
1. Control DB (eduflow_control): Platform operator user, Demo institution, Tenant registry.
2. Tenant DB (eduflow_tenant_demo): Demo school data across all 4 roles, academics, and assignments.
"""

from datetime import date
from django.core.management.base import BaseCommand
from django.contrib.auth.hashers import make_password
from django.db import transaction

from apps.tenants.models import PlatformUser, Institution, TenantRegistry
from apps.tenants.context import tenant_context
from apps.identity.models import User, Membership, StudentProfile, TeacherProfile, StaffProfile
from apps.academics.models import AcademicYear, AcademicUnit, Subject, StudentEnrollment, TeachingAssignment
from apps.attendance.models import AttendanceRecord
from apps.examinations.models import Exam, ExamSubject, GradingScale
from apps.fees.models import FeeStructure, Invoice
from apps.announcements.models import Announcement
from decimal import Decimal
from django.conf import settings

class Command(BaseCommand):
    help = 'Seeds initial control database and demo tenant database with sample school data.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--tenant-db',
            default='tenant_demo',
            help='Database alias for the demo tenant (default: tenant_demo)'
        )

    def handle(self, *args, **options):
        tenant_db = options['tenant_db']
        self.stdout.write(self.style.MIGRATE_HEADING("=== Starting EduFlow Dev Database Seeding ==="))

        # -------------------------------------------------------------
        # 1. Seed Control DB (eduflow_control -> 'default')
        # -------------------------------------------------------------
        self.stdout.write("\n1. Seeding Control Plane (eduflow_control)...")

        platform_admin, created = PlatformUser.objects.using('default').update_or_create(
            email='admin@eduflow.local',
            defaults={
                'password_hash': make_password('AdminControlPass123!', hasher='argon2'),
                'is_active': True,
            }
        )
        self.stdout.write(f"   - Platform User: {platform_admin.email} ({'Created' if created else 'Updated'})")

        demo_inst, created = Institution.objects.using('default').update_or_create(
            slug='demo',
            defaults={
                'name': 'Greenwood High Demo School',
                'status': 'ACTIVE',
                'external_tenant_id': 'EXT-DEMO-001',
            }
        )
        self.stdout.write(f"   - Institution: {demo_inst.name} [{demo_inst.slug}] ({'Created' if created else 'Updated'})")

        tenant_sqlite_path = str(settings.BASE_DIR / 'eduflow_tenant_demo.sqlite3').replace('\\', '/')
        demo_reg, created = TenantRegistry.objects.using('default').update_or_create(
            institution=demo_inst,
            defaults={
                'db_url': f'sqlite:///{tenant_sqlite_path}',
                'provider': 'local',
                'status': 'ACTIVE',
            }
        )
        self.stdout.write(f"   - Tenant Registry: linked {demo_inst.slug} to {demo_reg.db_url}")

        # -------------------------------------------------------------
        # 2. Seed Tenant DB (eduflow_tenant_demo)
        # -------------------------------------------------------------
        self.stdout.write(f"\n2. Seeding Tenant Database ({tenant_db})...")

        with tenant_context(tenant_db, slug='demo'):
            # Academic Year
            acad_year, created = AcademicYear.objects.using(tenant_db).update_or_create(
                name='2026-2027',
                defaults={
                    'start_date': date(2026, 4, 1),
                    'end_date': date(2027, 3, 31),
                    'is_current': True,
                }
            )
            self.stdout.write(f"   - Academic Year: {acad_year.name} (Current)")

            # Academic Units: Class 10 -> Section A, Section B
            class_10, _ = AcademicUnit.objects.using(tenant_db).update_or_create(
                academic_year=acad_year,
                name='Class 10',
                defaults={'unit_type': 'CLASS', 'parent': None}
            )
            section_a, _ = AcademicUnit.objects.using(tenant_db).update_or_create(
                academic_year=acad_year,
                name='Section A',
                parent=class_10,
                defaults={'unit_type': 'SECTION'}
            )
            section_b, _ = AcademicUnit.objects.using(tenant_db).update_or_create(
                academic_year=acad_year,
                name='Section B',
                parent=class_10,
                defaults={'unit_type': 'SECTION'}
            )
            self.stdout.write(f"   - Academic Units: {class_10.name} (Section A, Section B)")

            # Subjects
            math_subj, _ = Subject.objects.using(tenant_db).update_or_create(
                code='MATH-10',
                defaults={'name': 'Mathematics'}
            )
            sci_subj, _ = Subject.objects.using(tenant_db).update_or_create(
                code='SCI-10',
                defaults={'name': 'Physical Science'}
            )
            eng_subj, _ = Subject.objects.using(tenant_db).update_or_create(
                code='ENG-10',
                defaults={'name': 'English Literature'}
            )
            self.stdout.write(f"   - Subjects: {math_subj.name}, {sci_subj.name}, {eng_subj.name}")

            # Default password for all demo accounts
            shared_password_hash = make_password('SchoolDemoPass123!', hasher='argon2')

            # Role 1: ADMIN (Principal)
            admin_user, _ = User.objects.using(tenant_db).update_or_create(
                username='admin_demo',
                defaults={
                    'email': 'admin@demo.edu',
                    'full_name': 'Dr. Alistair Vance',
                    'password_hash': shared_password_hash,
                    'phone': '+1-555-0101',
                    'is_active': True,
                }
            )
            admin_mem, _ = Membership.objects.using(tenant_db).update_or_create(
                user=admin_user,
                defaults={'role': 'ADMIN', 'status': 'ACTIVE'}
            )
            self.stdout.write(f"   - Role ADMIN: {admin_user.full_name} ({admin_user.email})")

            # Role 2: TEACHER (Class Teacher for Section A)
            teacher_user, _ = User.objects.using(tenant_db).update_or_create(
                username='teacher_demo',
                defaults={
                    'email': 'teacher@demo.edu',
                    'full_name': 'Sarah Jenkins',
                    'password_hash': shared_password_hash,
                    'phone': '+1-555-0102',
                    'is_active': True,
                }
            )
            teacher_mem, _ = Membership.objects.using(tenant_db).update_or_create(
                user=teacher_user,
                defaults={'role': 'TEACHER', 'status': 'ACTIVE'}
            )
            TeacherProfile.objects.using(tenant_db).update_or_create(
                membership=teacher_mem,
                defaults={
                    'employee_id': 'T-1001',
                    'qualification': 'M.Sc. Mathematics, B.Ed.',
                }
            )
            TeachingAssignment.objects.using(tenant_db).update_or_create(
                academic_unit=section_a,
                is_class_teacher=True,
                defaults={
                    'membership': teacher_mem,
                    'subject': math_subj,
                }
            )
            self.stdout.write(f"   - Role TEACHER: {teacher_user.full_name} (Class Teacher for Section A)")

            # Role 3: STUDENT (Enrolled in Section A)
            student_user, _ = User.objects.using(tenant_db).update_or_create(
                username='student_demo',
                defaults={
                    'email': 'student@demo.edu',
                    'full_name': 'Leo Miller',
                    'password_hash': shared_password_hash,
                    'phone': '+1-555-0103',
                    'is_active': True,
                }
            )
            student_mem, _ = Membership.objects.using(tenant_db).update_or_create(
                user=student_user,
                defaults={'role': 'STUDENT', 'status': 'ACTIVE'}
            )
            StudentProfile.objects.using(tenant_db).update_or_create(
                membership=student_mem,
                defaults={
                    'admission_number': 'STU-2026-001',
                    'dob': date(2010, 5, 15),
                    'guardian_name': 'Marcus Miller',
                    'guardian_phone': '+1-555-9999',
                }
            )
            StudentEnrollment.objects.using(tenant_db).update_or_create(
                academic_unit=section_a,
                roll_number='1',
                enrolled_from=date(2026, 4, 1),
                defaults={
                    'membership': student_mem,
                }
            )
            self.stdout.write(f"   - Role STUDENT: {student_user.full_name} (Roll #1 in Section A)")

            # Role 4: STAFF - FINANCE
            finance_user, _ = User.objects.using(tenant_db).update_or_create(
                username='finance_demo',
                defaults={
                    'email': 'finance@demo.edu',
                    'full_name': 'Eleanor Rigby',
                    'password_hash': shared_password_hash,
                    'phone': '+1-555-0104',
                    'is_active': True,
                }
            )
            finance_mem, _ = Membership.objects.using(tenant_db).update_or_create(
                user=finance_user,
                defaults={'role': 'STAFF', 'status': 'ACTIVE'}
            )
            StaffProfile.objects.using(tenant_db).update_or_create(
                membership=finance_mem,
                defaults={
                    'employee_id': 'STF-2001',
                    'staff_type': 'FINANCE',
                    'department': 'Accounts & Billing',
                    'designation': 'Bursar / Accounts Officer',
                }
            )
            self.stdout.write(f"   - Role STAFF (FINANCE): {finance_user.full_name} ({finance_user.email})")

            # Role 4: STAFF - RECEPTION
            reception_user, _ = User.objects.using(tenant_db).update_or_create(
                username='reception_demo',
                defaults={
                    'email': 'reception@demo.edu',
                    'full_name': 'David Copperfield',
                    'password_hash': shared_password_hash,
                    'phone': '+1-555-0105',
                    'is_active': True,
                }
            )
            reception_mem, _ = Membership.objects.using(tenant_db).update_or_create(
                user=reception_user,
                defaults={'role': 'STAFF', 'status': 'ACTIVE'}
            )
            StaffProfile.objects.using(tenant_db).update_or_create(
                membership=reception_mem,
                defaults={
                    'employee_id': 'STF-2002',
                    'staff_type': 'RECEPTION',
                    'department': 'Front Office',
                    'designation': 'Receptionist',
                }
            )
            self.stdout.write(f"   - Role STAFF (RECEPTION): {reception_user.full_name} ({reception_user.email})")

            # Phase 4 Seed: Attendance
            AttendanceRecord.objects.using(tenant_db).update_or_create(
                subject_user=student_mem,
                date=date.today(),
                context='CLASSROOM',
                defaults={
                    'academic_unit': section_a,
                    'status': 'PRESENT',
                    'marked_by': teacher_mem,
                    'remarks': 'Present on roll call'
                }
            )
            self.stdout.write("   - Attendance: Present roll call logged for Section A today.")

            # Phase 5 Seed: Examinations
            GradingScale.objects.using(tenant_db).update_or_create(
                name='Standard 10-Point Scale',
                defaults={'is_default': True, 'rules': []}
            )
            exam, _ = Exam.objects.using(tenant_db).update_or_create(
                academic_year=acad_year,
                name='Mid-Term Examination 2026',
                defaults={
                    'start_date': date(2026, 9, 15),
                    'end_date': date(2026, 9, 30),
                    'status': 'SCHEDULED',
                    'is_published': False
                }
            )
            ExamSubject.objects.using(tenant_db).update_or_create(
                exam=exam,
                academic_unit=section_a,
                subject=math_subj,
                defaults={'max_marks': Decimal('100.00'), 'passing_marks': Decimal('40.00'), 'exam_date': date(2026, 9, 16)}
            )
            self.stdout.write("   - Examinations: 'Mid-Term Examination 2026' with Mathematics paper seeded.")

            # Phase 6 Seed: Fees & Invoices
            tuition_struct, _ = FeeStructure.objects.using(tenant_db).update_or_create(
                academic_year=acad_year,
                name='Annual Tuition 2026-2027',
                defaults={
                    'academic_unit': class_10,
                    'amount': Decimal('1500.00'),
                    'due_date': date(2026, 10, 15)
                }
            )
            Invoice.objects.using(tenant_db).update_or_create(
                invoice_number='INV-2026-00001',
                defaults={
                    'student_membership': student_mem,
                    'fee_structure': tuition_struct,
                    'issue_date': date(2026, 9, 1),
                    'due_date': date(2026, 10, 15),
                    'total_amount': Decimal('1500.00'),
                    'paid_amount': Decimal('500.00'),
                    'status': 'PARTIAL'
                }
            )
            self.stdout.write("   - Fees: Tuition structure ($1,500.00) and sample student invoice seeded.")

            # Announcements & Communications Seed
            Announcement.objects.using(tenant_db).update_or_create(
                title='Welcome to Academic Year 2026-2027',
                defaults={
                    'content': 'We are thrilled to welcome all students, teachers, and staff to the new academic session. Orientation begins on Monday morning.',
                    'created_by': admin_mem,
                    'target_role': 'ALL',
                    'target_academic_unit': None
                }
            )
            Announcement.objects.using(tenant_db).update_or_create(
                title='Science Fair Lab Preparation — Section A',
                defaults={
                    'content': 'Section A students are reminded to bring their project outlines to the physics lab tomorrow during period 3.',
                    'created_by': teacher_mem,
                    'target_role': 'STUDENT',
                    'target_academic_unit': section_a
                }
            )
            self.stdout.write("   - Announcements: Global welcome notice and Section A class notice seeded.")

        self.stdout.write(self.style.SUCCESS("\n[SUCCESS] Dev seeding complete! All roles and institutions initialized."))
