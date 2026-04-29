from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import io
import uuid
import hmac
import hashlib
import logging
import bcrypt
import jwt
import razorpay
from datetime import datetime, timezone, timedelta, date as date_cls
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, status
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# ---------------- Logging ----------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("hostel")

# ---------------- DB ----------------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# ---------------- Razorpay ----------------
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")
razorpay_client = (
    razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
    if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET
    else None
)


# ---------------- Auth utils ----------------
JWT_ALGO = "HS256"
JWT_SECRET = os.environ["JWT_SECRET"]
ACCESS_TTL_MIN = 60 * 24  # 24h for project simplicity


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(pw: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), h.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TTL_MIN),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def public_user(u: dict) -> dict:
    return {
        "id": u["id"],
        "email": u["email"],
        "name": u.get("name", ""),
        "role": u["role"],
    }


# ---------------- Auth dependency ----------------
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def require_roles(*roles: str):
    async def dep(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Forbidden")
        return user

    return dep


# ---------------- Pydantic Models ----------------
class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: Literal["admin", "staff", "student"]


class StudentCreate(BaseModel):
    email: EmailStr
    password: str = "student123"
    name: str
    roll_no: str
    course: str
    year: int
    phone: str = ""
    parent_name: str = ""
    parent_phone: str = ""
    address: str = ""
    room_no: Optional[str] = None


class StudentUpdate(BaseModel):
    name: Optional[str] = None
    roll_no: Optional[str] = None
    course: Optional[str] = None
    year: Optional[int] = None
    phone: Optional[str] = None
    parent_name: Optional[str] = None
    parent_phone: Optional[str] = None
    address: Optional[str] = None
    room_no: Optional[str] = None


class StaffCreate(BaseModel):
    email: EmailStr
    password: str = "staff123"
    name: str
    designation: str = "Warden"
    phone: str = ""
    joining_date: Optional[str] = None


class StaffUpdate(BaseModel):
    name: Optional[str] = None
    designation: Optional[str] = None
    phone: Optional[str] = None


class RoomCreate(BaseModel):
    room_no: str
    block: str = "A"
    floor: int = 1
    capacity: int = 2
    type: str = "Double"
    rent: float = 0.0


class RoomUpdate(BaseModel):
    block: Optional[str] = None
    floor: Optional[int] = None
    capacity: Optional[int] = None
    type: Optional[str] = None
    rent: Optional[float] = None


class FeeCreate(BaseModel):
    student_id: str
    month: str  # e.g. "2026-02"
    amount: float
    due_date: str  # YYYY-MM-DD


class AttendanceMark(BaseModel):
    date: str  # YYYY-MM-DD
    entries: List[dict]  # [{student_id, status: present|absent|leave}]


class ComplaintCreate(BaseModel):
    title: str
    description: str
    category: str = "General"


class ComplaintStatus(BaseModel):
    status: Literal["open", "in_progress", "resolved"]
    response: Optional[str] = None


class FoodDayUpdate(BaseModel):
    breakfast: str = ""
    lunch: str = ""
    dinner: str = ""


# ---------------- App ----------------
app = FastAPI(title="Hostel Management System")
api = APIRouter(prefix="/api")


# ---------------- Auth Routes ----------------
@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], user["email"], user["role"])
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=ACCESS_TTL_MIN * 60,
        path="/",
    )
    return {"user": public_user(user), "access_token": token}


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def auth_me(user: dict = Depends(get_current_user)):
    return public_user(user)


# ---------------- Helpers ----------------
async def _create_user(email: str, password: str, name: str, role: str) -> dict:
    email = email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already in use")
    user = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password_hash": hash_password(password),
        "name": name,
        "role": role,
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    return user


# ---------------- Users (admin) ----------------
@api.get("/users")
async def list_users(role: Optional[str] = None, _: dict = Depends(require_roles("admin"))):
    q: dict = {}
    if role:
        q["role"] = role
    items = await db.users.find(q, {"_id": 0, "password_hash": 0}).to_list(1000)
    return items


@api.post("/users")
async def create_user(body: UserCreate, _: dict = Depends(require_roles("admin"))):
    u = await _create_user(body.email, body.password, body.name, body.role)
    return public_user(u)


# ---------------- Students ----------------
@api.get("/students")
async def list_students(user: dict = Depends(require_roles("admin", "staff"))):
    items = await db.students.find({}, {"_id": 0}).to_list(2000)
    return items


@api.post("/students")
async def create_student(body: StudentCreate, _: dict = Depends(require_roles("admin"))):
    u = await _create_user(body.email, body.password, body.name, "student")
    student = {
        "id": str(uuid.uuid4()),
        "user_id": u["id"],
        "email": u["email"],
        "name": body.name,
        "roll_no": body.roll_no,
        "course": body.course,
        "year": body.year,
        "phone": body.phone,
        "parent_name": body.parent_name,
        "parent_phone": body.parent_phone,
        "address": body.address,
        "room_no": body.room_no,
        "admission_date": now_iso(),
    }
    await db.students.insert_one(student)
    if body.room_no:
        await db.rooms.update_one(
            {"room_no": body.room_no}, {"$addToSet": {"occupants": student["id"]}}
        )
    student.pop("_id", None)
    return student


@api.put("/students/{student_id}")
async def update_student(student_id: str, body: StudentUpdate, _: dict = Depends(require_roles("admin"))):
    existing = await db.students.find_one({"id": student_id})
    if not existing:
        raise HTTPException(404, "Student not found")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    new_room = updates.get("room_no")
    old_room = existing.get("room_no")
    if updates:
        await db.students.update_one({"id": student_id}, {"$set": updates})
    if "room_no" in updates and new_room != old_room:
        if old_room:
            await db.rooms.update_one({"room_no": old_room}, {"$pull": {"occupants": student_id}})
        if new_room:
            await db.rooms.update_one({"room_no": new_room}, {"$addToSet": {"occupants": student_id}})
    s = await db.students.find_one({"id": student_id}, {"_id": 0})
    return s


@api.delete("/students/{student_id}")
async def delete_student(student_id: str, _: dict = Depends(require_roles("admin"))):
    s = await db.students.find_one({"id": student_id})
    if not s:
        raise HTTPException(404, "Not found")
    await db.students.delete_one({"id": student_id})
    await db.users.delete_one({"id": s["user_id"]})
    if s.get("room_no"):
        await db.rooms.update_one({"room_no": s["room_no"]}, {"$pull": {"occupants": student_id}})
    await db.fees.delete_many({"student_id": student_id})
    await db.attendance.delete_many({"student_id": student_id})
    await db.complaints.delete_many({"student_id": student_id})
    return {"ok": True}


# ---------------- Staff ----------------
@api.get("/staff")
async def list_staff(_: dict = Depends(require_roles("admin"))):
    items = await db.staff.find({}, {"_id": 0}).to_list(1000)
    return items


@api.post("/staff")
async def create_staff(body: StaffCreate, _: dict = Depends(require_roles("admin"))):
    u = await _create_user(body.email, body.password, body.name, "staff")
    rec = {
        "id": str(uuid.uuid4()),
        "user_id": u["id"],
        "email": u["email"],
        "name": body.name,
        "designation": body.designation,
        "phone": body.phone,
        "joining_date": body.joining_date or now_iso(),
    }
    await db.staff.insert_one(rec)
    rec.pop("_id", None)
    return rec


@api.put("/staff/{staff_id}")
async def update_staff(staff_id: str, body: StaffUpdate, _: dict = Depends(require_roles("admin"))):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    res = await db.staff.update_one({"id": staff_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    return await db.staff.find_one({"id": staff_id}, {"_id": 0})


@api.delete("/staff/{staff_id}")
async def delete_staff(staff_id: str, _: dict = Depends(require_roles("admin"))):
    s = await db.staff.find_one({"id": staff_id})
    if not s:
        raise HTTPException(404, "Not found")
    await db.staff.delete_one({"id": staff_id})
    await db.users.delete_one({"id": s["user_id"]})
    return {"ok": True}


# ---------------- Rooms ----------------
@api.get("/rooms")
async def list_rooms(user: dict = Depends(get_current_user)):
    items = await db.rooms.find({}, {"_id": 0}).to_list(1000)
    return items


@api.post("/rooms")
async def create_room(body: RoomCreate, _: dict = Depends(require_roles("admin"))):
    if await db.rooms.find_one({"room_no": body.room_no}):
        raise HTTPException(400, "Room number already exists")
    room = {
        "id": str(uuid.uuid4()),
        "room_no": body.room_no,
        "block": body.block,
        "floor": body.floor,
        "capacity": body.capacity,
        "type": body.type,
        "rent": body.rent,
        "occupants": [],
    }
    await db.rooms.insert_one(room)
    room.pop("_id", None)
    return room


@api.put("/rooms/{room_id}")
async def update_room(room_id: str, body: RoomUpdate, _: dict = Depends(require_roles("admin"))):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    res = await db.rooms.update_one({"id": room_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    return await db.rooms.find_one({"id": room_id}, {"_id": 0})


@api.delete("/rooms/{room_id}")
async def delete_room(room_id: str, _: dict = Depends(require_roles("admin"))):
    r = await db.rooms.find_one({"id": room_id})
    if not r:
        raise HTTPException(404, "Not found")
    if r.get("occupants"):
        raise HTTPException(400, "Cannot delete an occupied room")
    await db.rooms.delete_one({"id": room_id})
    return {"ok": True}


# ---------------- Fees ----------------
@api.get("/fees")
async def list_fees(
    student_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    _: dict = Depends(require_roles("admin", "staff")),
):
    q: dict = {}
    if student_id:
        q["student_id"] = student_id
    if status_filter:
        q["status"] = status_filter
    items = await db.fees.find(q, {"_id": 0}).sort("month", -1).to_list(2000)
    return items


@api.post("/fees")
async def create_fee(body: FeeCreate, _: dict = Depends(require_roles("admin"))):
    s = await db.students.find_one({"id": body.student_id})
    if not s:
        raise HTTPException(404, "Student not found")
    fee = {
        "id": str(uuid.uuid4()),
        "student_id": body.student_id,
        "student_name": s["name"],
        "roll_no": s.get("roll_no", ""),
        "month": body.month,
        "amount": body.amount,
        "due_date": body.due_date,
        "status": "pending",
        "created_at": now_iso(),
        "paid_date": None,
    }
    await db.fees.insert_one(fee)
    fee.pop("_id", None)
    return fee


@api.put("/fees/{fee_id}/pay")
async def mark_fee_paid(fee_id: str, _: dict = Depends(require_roles("admin"))):
    res = await db.fees.update_one(
        {"id": fee_id}, {"$set": {"status": "paid", "paid_date": now_iso()}}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    return await db.fees.find_one({"id": fee_id}, {"_id": 0})


@api.delete("/fees/{fee_id}")
async def delete_fee(fee_id: str, _: dict = Depends(require_roles("admin"))):
    await db.fees.delete_one({"id": fee_id})
    return {"ok": True}


# ---------------- Attendance ----------------
@api.post("/attendance")
async def mark_attendance(body: AttendanceMark, user: dict = Depends(require_roles("admin", "staff"))):
    for e in body.entries:
        sid = e.get("student_id")
        st = e.get("status", "present")
        if not sid:
            continue
        await db.attendance.update_one(
            {"student_id": sid, "date": body.date},
            {
                "$set": {
                    "id": str(uuid.uuid4()),
                    "student_id": sid,
                    "date": body.date,
                    "status": st,
                    "marked_by": user["id"],
                    "marked_at": now_iso(),
                }
            },
            upsert=True,
        )
    return {"ok": True, "count": len(body.entries)}


@api.get("/attendance")
async def list_attendance(
    date: Optional[str] = None,
    student_id: Optional[str] = None,
    user: dict = Depends(require_roles("admin", "staff")),
):
    q: dict = {}
    if date:
        q["date"] = date
    if student_id:
        q["student_id"] = student_id
    items = await db.attendance.find(q, {"_id": 0}).sort("date", -1).to_list(5000)
    return items


# ---------------- Complaints ----------------
@api.get("/complaints")
async def list_complaints(
    status_filter: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    q: dict = {}
    if status_filter:
        q["status"] = status_filter
    if user["role"] == "student":
        student = await db.students.find_one({"user_id": user["id"]}, {"_id": 0})
        if not student:
            return []
        q["student_id"] = student["id"]
    items = await db.complaints.find(q, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return items


@api.post("/complaints")
async def create_complaint(body: ComplaintCreate, user: dict = Depends(require_roles("student"))):
    student = await db.students.find_one({"user_id": user["id"]})
    if not student:
        raise HTTPException(400, "Student profile not found")
    c = {
        "id": str(uuid.uuid4()),
        "student_id": student["id"],
        "student_name": student["name"],
        "roll_no": student.get("roll_no", ""),
        "title": body.title,
        "description": body.description,
        "category": body.category,
        "status": "open",
        "response": "",
        "created_at": now_iso(),
        "resolved_at": None,
    }
    await db.complaints.insert_one(c)
    c.pop("_id", None)
    return c


@api.put("/complaints/{cid}/status")
async def update_complaint(cid: str, body: ComplaintStatus, _: dict = Depends(require_roles("admin", "staff"))):
    updates = {"status": body.status}
    if body.response is not None:
        updates["response"] = body.response
    if body.status == "resolved":
        updates["resolved_at"] = now_iso()
    res = await db.complaints.update_one({"id": cid}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    return await db.complaints.find_one({"id": cid}, {"_id": 0})


@api.delete("/complaints/{cid}")
async def delete_complaint(cid: str, _: dict = Depends(require_roles("admin"))):
    await db.complaints.delete_one({"id": cid})
    return {"ok": True}


# ---------------- Food Menu ----------------
DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


@api.get("/food")
async def get_food(_: dict = Depends(get_current_user)):
    items = await db.food_menu.find({}, {"_id": 0}).to_list(10)
    by_day = {x["day"]: x for x in items}
    return [
        by_day.get(
            d, {"day": d, "breakfast": "", "lunch": "", "dinner": ""}
        )
        for d in DAYS
    ]


@api.put("/food/{day}")
async def update_food(day: str, body: FoodDayUpdate, _: dict = Depends(require_roles("admin", "staff"))):
    if day not in DAYS:
        raise HTTPException(400, "Invalid day")
    doc = {
        "day": day,
        "breakfast": body.breakfast,
        "lunch": body.lunch,
        "dinner": body.dinner,
        "updated_at": now_iso(),
    }
    await db.food_menu.update_one({"day": day}, {"$set": doc}, upsert=True)
    return doc


# ---------------- Student "me" routes ----------------
@api.get("/me/profile")
async def my_profile(user: dict = Depends(require_roles("student"))):
    s = await db.students.find_one({"user_id": user["id"]}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Profile not found")
    return s


@api.get("/me/room")
async def my_room(user: dict = Depends(require_roles("student"))):
    s = await db.students.find_one({"user_id": user["id"]}, {"_id": 0})
    if not s or not s.get("room_no"):
        return None
    r = await db.rooms.find_one({"room_no": s["room_no"]}, {"_id": 0})
    if r and r.get("occupants"):
        names = []
        for oid in r["occupants"]:
            occ = await db.students.find_one({"id": oid}, {"_id": 0, "name": 1, "roll_no": 1})
            if occ:
                names.append({"name": occ["name"], "roll_no": occ.get("roll_no", "")})
        r["occupant_details"] = names
    return r


@api.get("/me/fees")
async def my_fees(user: dict = Depends(require_roles("student"))):
    s = await db.students.find_one({"user_id": user["id"]})
    if not s:
        return []
    items = await db.fees.find({"student_id": s["id"]}, {"_id": 0}).sort("month", -1).to_list(500)
    return items


@api.get("/me/attendance")
async def my_attendance(user: dict = Depends(require_roles("student"))):
    s = await db.students.find_one({"user_id": user["id"]})
    if not s:
        return []
    items = await db.attendance.find({"student_id": s["id"]}, {"_id": 0}).sort("date", -1).to_list(2000)
    return items


# ---------------- Dashboard stats ----------------
@api.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(get_current_user)):
    if user["role"] == "student":
        s = await db.students.find_one({"user_id": user["id"]})
        if not s:
            return {}
        pending = await db.fees.count_documents({"student_id": s["id"], "status": "pending"})
        complaints = await db.complaints.count_documents({"student_id": s["id"], "status": {"$ne": "resolved"}})
        att_total = await db.attendance.count_documents({"student_id": s["id"]})
        att_present = await db.attendance.count_documents({"student_id": s["id"], "status": "present"})
        att_pct = round((att_present / att_total * 100), 1) if att_total else 0
        return {
            "pending_fees": pending,
            "open_complaints": complaints,
            "attendance_pct": att_pct,
            "room_no": s.get("room_no"),
        }
    students = await db.students.count_documents({})
    rooms = await db.rooms.count_documents({})
    occupied_rooms = await db.rooms.count_documents({"occupants.0": {"$exists": True}})
    pending_fees = await db.fees.count_documents({"status": "pending"})
    open_complaints = await db.complaints.count_documents({"status": {"$ne": "resolved"}})
    staff_count = await db.staff.count_documents({})
    return {
        "students": students,
        "rooms": rooms,
        "occupied_rooms": occupied_rooms,
        "pending_fees": pending_fees,
        "open_complaints": open_complaints,
        "staff": staff_count,
    }


# ---------------- Project Report PDF ----------------
@api.get("/project-report.pdf")
async def project_report():
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.lib import colors
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    )

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=2*cm, rightMargin=2*cm,
                            topMargin=2*cm, bottomMargin=2*cm,
                            title="Hostel Management System - Project Report")
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("H1", parent=styles["Heading1"], fontSize=22, spaceAfter=12,
                        textColor=colors.HexColor("#1f3a93"))
    h2 = ParagraphStyle("H2", parent=styles["Heading2"], fontSize=15, spaceAfter=8,
                        textColor=colors.HexColor("#1f3a93"))
    h3 = ParagraphStyle("H3", parent=styles["Heading3"], fontSize=12, spaceAfter=6)
    body = ParagraphStyle("Body", parent=styles["BodyText"], fontSize=11, leading=15)
    story = []

    # Title page
    story += [
        Spacer(1, 4*cm),
        Paragraph("Hostel Management System", ParagraphStyle("T", parent=styles["Title"],
                  fontSize=28, alignment=1, textColor=colors.HexColor("#1f3a93"))),
        Spacer(1, 0.5*cm),
        Paragraph("A Web-Based Hostel Administration & Student Portal", ParagraphStyle(
            "S", parent=styles["Normal"], fontSize=14, alignment=1)),
        Spacer(1, 4*cm),
        Paragraph("<b>Project Submitted in Partial Fulfilment of</b><br/>"
                  "the Requirements for the Degree", ParagraphStyle(
            "S2", parent=styles["Normal"], fontSize=12, alignment=1)),
        Spacer(1, 2*cm),
        Paragraph("<b>Submitted by:</b> &lt;Your Name&gt;<br/>"
                  "<b>Roll No:</b> &lt;Your Roll No&gt;<br/>"
                  "<b>Guide:</b> &lt;Guide Name&gt;<br/>"
                  "<b>Department:</b> Computer Science &amp; Engineering<br/>"
                  "<b>Year:</b> 2025-26",
                  ParagraphStyle("S3", parent=styles["Normal"], fontSize=12, alignment=1)),
        PageBreak(),
    ]

    # Abstract
    story += [Paragraph("1. Abstract", h1),
              Paragraph(
        "The Hostel Management System (HMS) is a full-stack web application that "
        "automates the day-to-day operations of a college hostel. Manual record-keeping "
        "of students, rooms, attendance, fees, and complaints is replaced with a unified "
        "role-based portal. The system supports three roles — <b>Administrator</b>, "
        "<b>Staff (Warden)</b>, and <b>Student</b> — each with a tailored dashboard. "
        "It is built using <b>FastAPI</b> on the backend, <b>MongoDB</b> as the database, "
        "and <b>React</b> with TailwindCSS / shadcn-ui on the frontend. Authentication is "
        "handled via JSON Web Tokens (JWT) with bcrypt-hashed passwords.", body),
        Spacer(1, 0.4*cm),
        Paragraph("2. Objectives", h1),
        Paragraph(
        "<b>•</b> Provide a single source of truth for hostel records.<br/>"
        "<b>•</b> Reduce manual paperwork through digital fee &amp; attendance tracking.<br/>"
        "<b>•</b> Allow students to raise complaints and track resolution online.<br/>"
        "<b>•</b> Let the warden publish a weekly mess menu visible to every student.<br/>"
        "<b>•</b> Enforce role-based access so each user only sees their permitted data.", body),
        Spacer(1, 0.4*cm),
        Paragraph("3. Scope", h1),
        Paragraph(
        "The system covers student registration, room allotment, monthly fee billing, "
        "daily attendance marking, complaint life-cycle, staff management, and a weekly "
        "mess menu. It is delivered as a responsive web application accessible from "
        "desktop and mobile browsers.", body),
        PageBreak(),
    ]

    # Modules
    story += [Paragraph("4. Modules", h1)]
    modules = [
        ("Authentication", "Email + password login with JWT. 3 roles: admin / staff / student."),
        ("Student Management", "Admin can add, edit, delete and assign rooms to students."),
        ("Room Management", "Block-wise rooms with capacity, type, rent and live occupancy."),
        ("Fees", "Generate monthly fee records, mark as paid, view ledger by student."),
        ("Staff", "Admin manages warden / staff accounts (CRUD)."),
        ("Attendance", "Warden marks daily attendance per student (present/absent/leave)."),
        ("Complaints", "Students raise complaints; staff/admin update status and respond."),
        ("Hostel Food", "Warden edits a 7-day weekly menu (Breakfast / Lunch / Dinner)."),
        ("Dashboards", "Stats cards + role-specific home view."),
    ]
    for name, desc in modules:
        story += [Paragraph(f"<b>{name}</b>", h3), Paragraph(desc, body), Spacer(1, 0.15*cm)]

    story += [PageBreak(), Paragraph("5. Tech Stack", h1)]
    tech = [
        ["Layer", "Technology"],
        ["Frontend", "React 19, React Router, TailwindCSS, shadcn-ui, Axios"],
        ["Backend", "FastAPI (Python), Pydantic v2, Motor (async MongoDB)"],
        ["Database", "MongoDB"],
        ["Auth", "JWT (PyJWT) + bcrypt password hashing"],
        ["Styling", "Outfit + IBM Plex Sans, Yale-Blue accent palette"],
        ["Deployment", "Docker / Kubernetes (Emergent platform)"],
    ]
    t = Table(tech, hAlign="LEFT", colWidths=[5*cm, 11*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f3a93")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.whitesmoke, colors.white]),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story += [t, Spacer(1, 0.5*cm)]

    # ER Diagram (textual)
    story += [Paragraph("6. ER / Data Model", h1),
              Paragraph(
        "The MongoDB schema is organised in the following collections:", body),
              Spacer(1, 0.2*cm)]
    er = [
        ["Collection", "Key Fields"],
        ["users", "id (PK), email (unique), password_hash, name, role"],
        ["students", "id (PK), user_id (FK→users), roll_no, course, year, room_no, parent_*"],
        ["staff", "id (PK), user_id (FK→users), designation, phone, joining_date"],
        ["rooms", "id (PK), room_no (unique), block, floor, capacity, type, rent, occupants[]"],
        ["fees", "id (PK), student_id (FK), month, amount, due_date, status, paid_date"],
        ["attendance", "id (PK), student_id (FK), date, status, marked_by, marked_at"],
        ["complaints", "id (PK), student_id (FK), title, description, category, status, response"],
        ["food_menu", "day (PK Mon-Sun), breakfast, lunch, dinner"],
    ]
    t2 = Table(er, hAlign="LEFT", colWidths=[3.5*cm, 12.5*cm])
    t2.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f3a93")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.whitesmoke, colors.white]),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story += [t2, PageBreak()]

    # Use case
    story += [Paragraph("7. Use Cases by Role", h1)]
    roles_uc = [
        ("Administrator",
         "Manage students, rooms, staff, generate fees, view all complaints, "
         "view system-wide dashboard."),
        ("Staff (Warden)",
         "Mark daily attendance, view students &amp; rooms, manage complaints, "
         "edit weekly food menu."),
        ("Student",
         "View profile, room details &amp; roommates, fee status, attendance "
         "history, raise complaints, view food menu."),
    ]
    for r, d in roles_uc:
        story += [Paragraph(f"<b>{r}</b>", h3), Paragraph(d, body), Spacer(1, 0.15*cm)]

    story += [Spacer(1, 0.3*cm), Paragraph("8. Software Requirements", h1),
              Paragraph(
        "<b>OS:</b> Linux / macOS / Windows<br/>"
        "<b>Python:</b> 3.10+<br/>"
        "<b>Node:</b> 18+<br/>"
        "<b>MongoDB:</b> 6.0+<br/>"
        "<b>Browser:</b> Modern Chromium / Firefox / Safari", body),
        Spacer(1, 0.3*cm),
        Paragraph("9. Setup Instructions", h1),
        Paragraph(
        "1. Clone the repository.<br/>"
        "2. <b>Backend:</b> <i>cd backend &amp;&amp; pip install -r requirements.txt</i><br/>"
        "3. Configure <i>.env</i> with MONGO_URL, DB_NAME, JWT_SECRET, ADMIN_EMAIL/PASSWORD.<br/>"
        "4. Start API: <i>uvicorn server:app --host 0.0.0.0 --port 8001</i>.<br/>"
        "5. <b>Frontend:</b> <i>cd frontend &amp;&amp; yarn &amp;&amp; yarn start</i>.<br/>"
        "6. Open the app and login as admin (admin@hostel.edu / admin123).", body),
        Spacer(1, 0.3*cm),
        Paragraph("10. Future Enhancements", h1),
        Paragraph(
        "• Online fee payment integration (Razorpay / Stripe).<br/>"
        "• SMS / email notifications for fee due and complaint updates.<br/>"
        "• Visitor &amp; gate-pass module.<br/>"
        "• Mobile application (React Native).<br/>"
        "• AI-powered complaint auto-routing.", body),
        Spacer(1, 0.3*cm),
        Paragraph("11. Conclusion", h1),
        Paragraph(
        "The Hostel Management System successfully digitises the everyday operations "
        "of a college hostel, providing a clean role-based experience for "
        "administrators, wardens and students. The modular architecture makes it "
        "easy to extend with future requirements such as payment gateways and "
        "mobile clients.", body),
    ]

    doc.build(story)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="Hostel_Management_System_Report.pdf"'},
    )


# ---------------- Razorpay Payments ----------------
class PayOrderIn(BaseModel):
    fee_id: str


@api.get("/payments/config")
async def payments_config(_: dict = Depends(get_current_user)):
    return {"key_id": RAZORPAY_KEY_ID, "enabled": bool(razorpay_client)}


@api.post("/payments/order")
async def create_payment_order(body: PayOrderIn, user: dict = Depends(require_roles("student"))):
    if not razorpay_client:
        raise HTTPException(503, "Payment gateway not configured")
    student = await db.students.find_one({"user_id": user["id"]})
    if not student:
        raise HTTPException(404, "Student profile not found")
    fee = await db.fees.find_one({"id": body.fee_id, "student_id": student["id"]})
    if not fee:
        raise HTTPException(404, "Fee not found")
    if fee["status"] == "paid":
        raise HTTPException(400, "Fee already paid")
    amount_paise = int(round(float(fee["amount"]) * 100))
    receipt_id = f"hms-{fee['id'][:18]}"
    order = razorpay_client.order.create({
        "amount": amount_paise,
        "currency": "INR",
        "receipt": receipt_id,
        "payment_capture": 1,
        "notes": {
            "fee_id": fee["id"],
            "student_id": student["id"],
            "roll_no": student.get("roll_no", ""),
            "month": fee["month"],
        },
    })
    await db.fees.update_one(
        {"id": fee["id"]},
        {"$set": {"razorpay_order_id": order["id"], "status": "processing"}},
    )
    return {
        "order_id": order["id"],
        "amount": order["amount"],
        "currency": order["currency"],
        "key_id": RAZORPAY_KEY_ID,
        "name": student["name"],
        "email": student["email"],
        "phone": student.get("phone", ""),
        "fee_id": fee["id"],
        "month": fee["month"],
    }


class PayVerifyIn(BaseModel):
    fee_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


@api.post("/payments/verify")
async def verify_payment(body: PayVerifyIn, user: dict = Depends(require_roles("student"))):
    if not razorpay_client:
        raise HTTPException(503, "Payment gateway not configured")
    student = await db.students.find_one({"user_id": user["id"]})
    if not student:
        raise HTTPException(404, "Student profile not found")
    fee = await db.fees.find_one({"id": body.fee_id, "student_id": student["id"]})
    if not fee:
        raise HTTPException(404, "Fee not found")

    # HMAC-SHA256 signature verification
    msg = f"{body.razorpay_order_id}|{body.razorpay_payment_id}".encode()
    expected = hmac.new(
        RAZORPAY_KEY_SECRET.encode(), msg, hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(expected, body.razorpay_signature):
        await db.fees.update_one(
            {"id": fee["id"]}, {"$set": {"status": "pending"}}
        )
        raise HTTPException(400, "Invalid payment signature")

    paid_at = now_iso()
    payment = {
        "id": str(uuid.uuid4()),
        "fee_id": fee["id"],
        "student_id": student["id"],
        "student_name": student["name"],
        "roll_no": student.get("roll_no", ""),
        "amount": fee["amount"],
        "month": fee["month"],
        "razorpay_order_id": body.razorpay_order_id,
        "razorpay_payment_id": body.razorpay_payment_id,
        "razorpay_signature": body.razorpay_signature,
        "paid_at": paid_at,
    }
    await db.payments.insert_one(payment)
    await db.fees.update_one(
        {"id": fee["id"]},
        {
            "$set": {
                "status": "paid",
                "paid_date": paid_at,
                "payment_id": payment["id"],
                "razorpay_payment_id": body.razorpay_payment_id,
            }
        },
    )
    payment.pop("_id", None)
    return {"ok": True, "payment": payment}


@api.get("/payments/receipt/{fee_id}.pdf")
async def payment_receipt(fee_id: str, user: dict = Depends(get_current_user)):
    fee = await db.fees.find_one({"id": fee_id}, {"_id": 0})
    if not fee:
        raise HTTPException(404, "Fee not found")
    if fee.get("status") != "paid":
        raise HTTPException(400, "Fee not paid yet")

    # Access control: student can only download their own
    if user["role"] == "student":
        s = await db.students.find_one({"user_id": user["id"]})
        if not s or s["id"] != fee["student_id"]:
            raise HTTPException(403, "Forbidden")

    student = await db.students.find_one({"id": fee["student_id"]}, {"_id": 0}) or {}
    payment = (
        await db.payments.find_one({"fee_id": fee_id}, {"_id": 0})
        if fee.get("payment_id")
        else None
    )

    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.lib import colors
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    )

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=2 * cm, rightMargin=2 * cm,
        topMargin=2 * cm, bottomMargin=2 * cm,
        title=f"Receipt {fee_id[:8]}",
    )
    styles = getSampleStyleSheet()
    h_brand = ParagraphStyle(
        "Brand", parent=styles["Title"], fontSize=22, alignment=0,
        textColor=colors.HexColor("#1f3a93"), spaceAfter=4,
    )
    h_sub = ParagraphStyle("Sub", parent=styles["Normal"], fontSize=10,
                           textColor=colors.grey, spaceAfter=14)
    h_section = ParagraphStyle(
        "Sec", parent=styles["Heading2"], fontSize=12,
        textColor=colors.HexColor("#1f3a93"), spaceAfter=6,
    )
    body = ParagraphStyle("Body", parent=styles["BodyText"], fontSize=11, leading=15)

    story = [
        Paragraph("Hostel Management System", h_brand),
        Paragraph("Official Fee Payment Receipt", h_sub),
    ]

    receipt_no = (payment or {}).get("id", fee_id)[:8].upper()
    paid_at = (payment or {}).get("paid_at") or fee.get("paid_date") or now_iso()
    try:
        paid_str = datetime.fromisoformat(paid_at).strftime("%d %b %Y, %I:%M %p")
    except Exception:
        paid_str = paid_at

    meta = [
        ["Receipt No.", f"HMS-{receipt_no}"],
        ["Payment Date", paid_str],
        ["Payment ID", (payment or {}).get("razorpay_payment_id", "—")],
        ["Order ID", (payment or {}).get("razorpay_order_id", "—")],
    ]
    t1 = Table(meta, colWidths=[4.5 * cm, 11 * cm])
    t1.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#475569")),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica-Bold"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -1), 0.3, colors.lightgrey),
    ]))
    story += [t1, Spacer(1, 0.6 * cm), Paragraph("Billed to", h_section)]

    bill = [
        ["Name", student.get("name", "—")],
        ["Roll No.", student.get("roll_no", "—")],
        ["Course / Year", f"{student.get('course', '—')} · Year {student.get('year', '—')}"],
        ["Email", student.get("email", "—")],
        ["Room", student.get("room_no") or "—"],
    ]
    t2 = Table(bill, colWidths=[4.5 * cm, 11 * cm])
    t2.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#475569")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
    ]))
    story += [t2, Spacer(1, 0.6 * cm), Paragraph("Payment details", h_section)]

    items = [
        ["Description", "Month", "Amount"],
        [f"Hostel Fee — {student.get('name', '')}", fee["month"],
         f"INR {float(fee['amount']):,.2f}"],
        ["", "Total Paid", f"INR {float(fee['amount']):,.2f}"],
    ]
    t3 = Table(items, colWidths=[9 * cm, 3.5 * cm, 3 * cm])
    t3.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f3a93")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ALIGN", (2, 0), (2, -1), "RIGHT"),
        ("ALIGN", (1, 1), (1, -1), "CENTER"),
        ("LINEABOVE", (0, -1), (-1, -1), 0.6, colors.HexColor("#1f3a93")),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
    ]))
    story += [
        t3, Spacer(1, 1 * cm),
        Paragraph(
            "<font color='#16a34a'><b>Payment received successfully.</b></font> "
            "This is a system-generated receipt and does not require a physical signature.",
            body,
        ),
        Spacer(1, 0.3 * cm),
        Paragraph(
            "<font color='grey' size='9'>For any queries, contact the hostel office.</font>",
            body,
        ),
    ]
    doc.build(story)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="receipt-{receipt_no}.pdf"',
        },
    )


# ---------------- Health ----------------
@api.get("/")
async def root():
    return {"service": "hostel-management", "status": "ok"}


# ---------------- Mount router & middleware ----------------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------- Startup ----------------
@app.on_event("startup")
async def on_startup():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.students.create_index("id", unique=True)
    await db.students.create_index("user_id")
    await db.staff.create_index("id", unique=True)
    await db.rooms.create_index("room_no", unique=True)
    await db.fees.create_index([("student_id", 1), ("month", 1)])
    await db.attendance.create_index([("student_id", 1), ("date", 1)], unique=True)

    # Admin seed (idempotent)
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@hostel.edu").lower()
    admin_pw = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": hash_password(admin_pw),
            "name": "Administrator",
            "role": "admin",
            "created_at": now_iso(),
        })
        logger.info(f"Seeded admin user: {admin_email}")
    elif not verify_password(admin_pw, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_pw)}},
        )
        logger.info(f"Updated admin password for {admin_email}")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
