"""End-to-end backend tests for Hostel Management System."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE_URL:
    # fallback: read from frontend/.env
    from pathlib import Path
    p = Path("/app/frontend/.env")
    if p.exists():
        for line in p.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")

API = f"{BASE_URL}/api"
ADMIN_EMAIL = "admin@hostel.edu"
ADMIN_PASSWORD = "admin123"


def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data
    assert data["user"]["role"] == "admin"
    # Verify cookie set
    assert "access_token" in r.cookies or any("access_token" in (h or "") for h in r.headers.get("set-cookie", "").split(",") if h)
    return data["access_token"]


@pytest.fixture(scope="module")
def state():
    return {}


# ---------------- Auth ----------------
class TestAuth:
    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": "no@x.com", "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_me_no_token(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401

    def test_me_with_token(self, admin_token):
        r = requests.get(f"{API}/auth/me", headers=auth_headers(admin_token), timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "admin"


# ---------------- Rooms ----------------
class TestRooms:
    def test_create_room(self, admin_token, state):
        suffix = uuid.uuid4().hex[:6]
        room_no = f"T{suffix}"
        r = requests.post(f"{API}/rooms", json={"room_no": room_no, "block": "A", "floor": 1, "capacity": 2, "type": "Double", "rent": 5000}, headers=auth_headers(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["room_no"] == room_no
        assert data["occupants"] == []
        state["room_id"] = data["id"]
        state["room_no"] = room_no

    def test_list_rooms(self, admin_token, state):
        r = requests.get(f"{API}/rooms", headers=auth_headers(admin_token), timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert any(x["id"] == state["room_id"] for x in data)


# ---------------- Students (admin creates, also creates user) ----------------
class TestStudents:
    def test_create_student(self, admin_token, state):
        suffix = uuid.uuid4().hex[:6]
        email = f"TEST_stud_{suffix}@hostel.edu"
        r = requests.post(f"{API}/students", json={
            "email": email, "password": "student123", "name": "Test Student",
            "roll_no": f"R{suffix}", "course": "CS", "year": 2,
            "phone": "9999", "parent_name": "P", "parent_phone": "8888",
            "address": "addr", "room_no": state["room_no"],
        }, headers=auth_headers(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"] == email.lower()
        assert data["room_no"] == state["room_no"]
        state["student_id"] = data["id"]
        state["student_email"] = email.lower()

    def test_list_students(self, admin_token, state):
        r = requests.get(f"{API}/students", headers=auth_headers(admin_token), timeout=15)
        assert r.status_code == 200
        assert any(x["id"] == state["student_id"] for x in r.json())

    def test_room_now_has_occupant(self, admin_token, state):
        r = requests.get(f"{API}/rooms", headers=auth_headers(admin_token), timeout=15)
        assert r.status_code == 200
        room = next(x for x in r.json() if x["id"] == state["room_id"])
        assert state["student_id"] in room["occupants"]

    def test_delete_occupied_room_blocked(self, admin_token, state):
        r = requests.delete(f"{API}/rooms/{state['room_id']}", headers=auth_headers(admin_token), timeout=15)
        assert r.status_code == 400

    def test_update_student(self, admin_token, state):
        r = requests.put(f"{API}/students/{state['student_id']}", json={"phone": "1234567890"}, headers=auth_headers(admin_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["phone"] == "1234567890"


# ---------------- Student login + me routes ----------------
class TestStudentSelf:
    def test_student_login(self, state):
        r = requests.post(f"{API}/auth/login", json={"email": state["student_email"], "password": "student123"}, timeout=15)
        assert r.status_code == 200, r.text
        state["student_token"] = r.json()["access_token"]

    def test_student_forbidden_on_students_list(self, state):
        r = requests.get(f"{API}/students", headers=auth_headers(state["student_token"]), timeout=15)
        assert r.status_code == 403

    def test_my_profile(self, state):
        r = requests.get(f"{API}/me/profile", headers=auth_headers(state["student_token"]), timeout=15)
        assert r.status_code == 200
        assert r.json()["id"] == state["student_id"]

    def test_my_room(self, state):
        r = requests.get(f"{API}/me/room", headers=auth_headers(state["student_token"]), timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data is not None
        assert data["room_no"] == state["room_no"]

    def test_my_fees_empty(self, state):
        r = requests.get(f"{API}/me/fees", headers=auth_headers(state["student_token"]), timeout=15)
        assert r.status_code == 200
        assert r.json() == []


# ---------------- Staff ----------------
class TestStaff:
    def test_create_staff(self, admin_token, state):
        suffix = uuid.uuid4().hex[:6]
        email = f"TEST_warden_{suffix}@hostel.edu"
        r = requests.post(f"{API}/staff", json={"email": email, "password": "warden123", "name": "Warden", "designation": "Warden", "phone": "555"}, headers=auth_headers(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        state["staff_id"] = data["id"]
        state["staff_email"] = email

    def test_staff_login_and_list_perms(self, state):
        r = requests.post(f"{API}/auth/login", json={"email": state["staff_email"], "password": "warden123"}, timeout=15)
        assert r.status_code == 200
        token = r.json()["access_token"]
        # staff can list students
        r2 = requests.get(f"{API}/students", headers=auth_headers(token), timeout=15)
        assert r2.status_code == 200
        # staff cannot list staff (admin-only)
        r3 = requests.get(f"{API}/staff", headers=auth_headers(token), timeout=15)
        assert r3.status_code == 403
        state["staff_token"] = token


# ---------------- Fees ----------------
class TestFees:
    def test_create_fee(self, admin_token, state):
        r = requests.post(f"{API}/fees", json={"student_id": state["student_id"], "month": "2026-02", "amount": 5000, "due_date": "2026-02-10"}, headers=auth_headers(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "pending"
        state["fee_id"] = data["id"]

    def test_pay_fee(self, admin_token, state):
        r = requests.put(f"{API}/fees/{state['fee_id']}/pay", headers=auth_headers(admin_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["status"] == "paid"

    def test_list_fees(self, admin_token, state):
        r = requests.get(f"{API}/fees", headers=auth_headers(admin_token), timeout=15)
        assert r.status_code == 200
        assert any(f["id"] == state["fee_id"] for f in r.json())


# ---------------- Attendance ----------------
class TestAttendance:
    def test_mark_attendance_idempotent(self, admin_token, state):
        payload = {"date": "2026-01-15", "entries": [{"student_id": state["student_id"], "status": "present"}]}
        r1 = requests.post(f"{API}/attendance", json=payload, headers=auth_headers(admin_token), timeout=15)
        assert r1.status_code == 200
        r2 = requests.post(f"{API}/attendance", json=payload, headers=auth_headers(admin_token), timeout=15)
        assert r2.status_code == 200
        # GET attendance
        r3 = requests.get(f"{API}/attendance?date=2026-01-15", headers=auth_headers(admin_token), timeout=15)
        assert r3.status_code == 200
        items = [x for x in r3.json() if x["student_id"] == state["student_id"]]
        assert len(items) == 1


# ---------------- Complaints ----------------
class TestComplaints:
    def test_student_creates_complaint(self, state):
        r = requests.post(f"{API}/complaints", json={"title": "Fan broken", "description": "no fan", "category": "Maintenance"}, headers=auth_headers(state["student_token"]), timeout=15)
        assert r.status_code == 200, r.text
        state["complaint_id"] = r.json()["id"]

    def test_admin_cannot_create_complaint(self, admin_token):
        r = requests.post(f"{API}/complaints", json={"title": "x", "description": "y"}, headers=auth_headers(admin_token), timeout=15)
        assert r.status_code == 403

    def test_admin_updates_status(self, admin_token, state):
        r = requests.put(f"{API}/complaints/{state['complaint_id']}/status", json={"status": "resolved", "response": "fixed"}, headers=auth_headers(admin_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["status"] == "resolved"


# ---------------- Food Menu ----------------
class TestFood:
    def test_get_food_seven_days(self, admin_token):
        r = requests.get(f"{API}/food", headers=auth_headers(admin_token), timeout=15)
        assert r.status_code == 200
        assert len(r.json()) == 7

    def test_update_food_day(self, admin_token):
        r = requests.put(f"{API}/food/Monday", json={"breakfast": "Idli", "lunch": "Rice", "dinner": "Roti"}, headers=auth_headers(admin_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["breakfast"] == "Idli"

    def test_invalid_day(self, admin_token):
        r = requests.put(f"{API}/food/Funday", json={"breakfast": "x", "lunch": "y", "dinner": "z"}, headers=auth_headers(admin_token), timeout=15)
        assert r.status_code == 400


# ---------------- Dashboard & PDF ----------------
class TestMisc:
    def test_dashboard_admin(self, admin_token):
        r = requests.get(f"{API}/dashboard/stats", headers=auth_headers(admin_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ["students", "rooms", "pending_fees", "open_complaints", "staff"]:
            assert k in d

    def test_dashboard_student(self, state):
        r = requests.get(f"{API}/dashboard/stats", headers=auth_headers(state["student_token"]), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "attendance_pct" in d

    def test_project_pdf(self, admin_token):
        r = requests.get(f"{API}/project-report.pdf", timeout=30)
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("application/pdf")
        assert r.content[:4] == b"%PDF"

    def test_role_admin_only_user_create(self, state):
        r = requests.post(f"{API}/users", json={"email": "x@x.com", "password": "p", "name": "x", "role": "staff"}, headers=auth_headers(state["student_token"]), timeout=15)
        assert r.status_code == 403


# ---------------- Cleanup ----------------
class TestZCleanup:
    def test_delete_student(self, admin_token, state):
        r = requests.delete(f"{API}/students/{state['student_id']}", headers=auth_headers(admin_token), timeout=15)
        assert r.status_code == 200

    def test_delete_room(self, admin_token, state):
        r = requests.delete(f"{API}/rooms/{state['room_id']}", headers=auth_headers(admin_token), timeout=15)
        assert r.status_code == 200

    def test_delete_staff(self, admin_token, state):
        r = requests.delete(f"{API}/staff/{state['staff_id']}", headers=auth_headers(admin_token), timeout=15)
        assert r.status_code == 200
