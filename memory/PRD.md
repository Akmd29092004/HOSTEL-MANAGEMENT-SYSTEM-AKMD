# Hostel Management System — PRD

## Original Problem Statement
> "make a hostel management system website with 3 login access to admin,staff,and student. Also give section student,room,fees,staff,attendance,complaint,hostel food. Also give me project file for this to submit in college"

## User Choices (gathered Feb 2026)
- Auth: JWT-based custom auth (email + password)
- Seed data: none (only the admin user is seeded)
- Project file: PDF report with abstract, modules, ER diagram, etc.
- UI theme: Professional dashboard — dark sidebar + light content
- Hostel food: editable by warden (staff role)

## Architecture
- **Backend**: FastAPI (Python) + Motor async MongoDB + PyJWT + bcrypt + reportlab (PDF). Single `server.py` with `/api` router and role-based dependencies.
- **Frontend**: React 19 + React Router 7 + TailwindCSS + shadcn/ui + axios + sonner.
- **DB**: MongoDB collections — users, students, staff, rooms, fees, attendance, complaints, food_menu.

## User Personas
- **Administrator** — full system control: students, rooms, staff, fees, attendance, complaints, food.
- **Staff (Warden)** — daily operations: students view, rooms view, attendance, complaints, food editor.
- **Student** — self-service portal: profile, room, fees, attendance, complaints, food.

## Implemented (2026-02-29)
- JWT auth with httpOnly cookie + Bearer header, idempotent admin seeding.
- Full CRUD for Students (admin), Rooms (admin), Staff (admin), Fees (admin), Attendance (admin/staff bulk-mark), Complaints (student create, staff/admin manage), Food menu (staff/admin edit, all view).
- Role-based dashboards with stat cards.
- Student-only "me" endpoints (profile, room, fees, attendance).
- Project Report PDF generated on-the-fly at `/api/project-report.pdf`.
- 34/34 backend tests passing; frontend E2E flows verified.

## Implemented (2026-04-29)
- **Online fee payments via Razorpay** (test mode). Student clicks *Pay now* on a pending fee → backend creates a Razorpay order → hosted Razorpay Checkout opens → on success, backend verifies the HMAC-SHA256 signature, marks the fee as paid, stores a `payments` record.
- **PDF receipts** at `/api/payments/receipt/{fee_id}.pdf` (student can download own; admin can download any). Receipt includes student details, payment ID, order ID, amount and date.
- Smoke-tested live with Razorpay test API: order creation, valid-signature verify (200), invalid-signature verify (400), receipt generation (`%PDF-` confirmed).

## Backlog (P1/P2)
- P1: File uploads for student ID-card photos.
- P1: Receipts (PDF) for paid fees.
- P2: Online fee payment integration (Razorpay/Stripe).
- P2: SMS/email notifications for fee due and complaint updates.
- P2: Visitor / gate-pass module.
- P2: Mobile app (React Native).

## Default Credentials
- Admin: `admin@hostel.edu` / `admin123` (seeded on startup)
- Staff and student accounts are created by the admin from the dashboard.
