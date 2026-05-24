"""
Seed script to populate 10 test employees, 10 users, attendance records, and payslips.
Run: cd backend && python seed_test_data.py
Idempotent — skips records that already exist.
"""
import random
from datetime import date, time, timedelta
from decimal import Decimal

from database import SessionLocal, engine, Base
from models.employee import Employee
from models.attendance import Attendance
from models.payslip import Payslip
from models.user import User
from auth.dependencies import hash_password

# Ensure tables exist
import models.holiday            # noqa: F401
import models.vehicle            # noqa: F401
import models.vehicle_assignment  # noqa: F401
import models.vehicle_location   # noqa: F401
Base.metadata.create_all(bind=engine)

TEST_PASSWORD = "test123"

EMPLOYEES = [
    {"name": "Rajesh Kumar",      "address": "12, Gandhi Nagar, Chennai 600020",     "aadhar_number": "234567890123", "bank_account_number": "10234567890",  "hourly_rate": Decimal("75.00"),  "shift": "SHIFT_A"},
    {"name": "Priya Sharma",      "address": "45, MG Road, Bengaluru 560001",        "aadhar_number": "345678901234", "bank_account_number": "20345678901",  "hourly_rate": Decimal("85.00"),  "shift": "SHIFT_B"},
    {"name": "Arun Patel",        "address": "78, Lal Darwaja, Ahmedabad 380001",    "aadhar_number": "456789012345", "bank_account_number": "30456789012",  "hourly_rate": Decimal("65.00"),  "shift": "SHIFT_A"},
    {"name": "Deepa Nair",        "address": "23, Marine Drive, Kochi 682001",       "aadhar_number": "567890123456", "bank_account_number": "40567890123",  "hourly_rate": Decimal("90.00"),  "shift": "SHIFT_B"},
    {"name": "Suresh Reddy",      "address": "56, Jubilee Hills, Hyderabad 500033",  "aadhar_number": "678901234567", "bank_account_number": "50678901234",  "hourly_rate": Decimal("70.00"),  "shift": "SHIFT_A"},
    {"name": "Kavitha Murugan",   "address": "89, Anna Salai, Chennai 600002",       "aadhar_number": "789012345678", "bank_account_number": "60789012345",  "hourly_rate": Decimal("100.00"), "shift": "SHIFT_B"},
    {"name": "Manoj Singh",       "address": "34, Connaught Place, New Delhi 110001","aadhar_number": "890123456789", "bank_account_number": "70890123456",  "hourly_rate": Decimal("55.00"),  "shift": "SHIFT_A"},
    {"name": "Lakshmi Iyer",      "address": "67, Koramangala, Bengaluru 560034",    "aadhar_number": "901234567890", "bank_account_number": "80901234567",  "hourly_rate": Decimal("110.00"), "shift": "SHIFT_B"},
    {"name": "Vikram Joshi",      "address": "90, FC Road, Pune 411004",             "aadhar_number": "112345678901", "bank_account_number": "91123456789",  "hourly_rate": Decimal("80.00"),  "shift": "SHIFT_A"},
    {"name": "Anitha Balasubramanian", "address": "15, T Nagar, Chennai 600017",     "aadhar_number": "223456789012", "bank_account_number": "10223456789",  "hourly_rate": Decimal("95.00"),  "shift": "SHIFT_B"},
]

USERS = [
    # (username, role, employee_index, email, display_name, phone)
    ("admin",       "admin",      None, "admin@econetvision.com",     "System Admin",    "+919790840313"),
    ("supervisor1", "supervisor", 0,    "rajesh.k@econetvision.com",  "Rajesh Kumar",    "+919876543210"),
    ("supervisor2", "supervisor", 1,    "priya.s@econetvision.com",   "Priya Sharma",    "+919876543211"),
    ("worker1",     "worker",     2,    "arun.p@econetvision.com",    "Arun Patel",      "+919876543212"),
    ("worker2",     "worker",     3,    "deepa.n@econetvision.com",   "Deepa Nair",      "+919876543213"),
    ("worker3",     "worker",     4,    "suresh.r@econetvision.com",  "Suresh Reddy",    "+919876543214"),
    ("worker4",     "worker",     5,    "kavitha.m@econetvision.com", "Kavitha Murugan", "+919876543215"),
    ("worker5",     "worker",     6,    "manoj.s@econetvision.com",   "Manoj Singh",     "+919876543216"),
    ("worker6",     "worker",     7,    "lakshmi.i@econetvision.com", "Lakshmi Iyer",    "+919876543217"),
    ("worker7",     "worker",     8,    "vikram.j@econetvision.com",  "Vikram Joshi",    "+919876543218"),
]

SHIFT_TIMES = {
    "SHIFT_A": {"start": time(6, 30), "end": time(14, 0)},
    "SHIFT_B": {"start": time(9, 0),  "end": time(17, 0)},
}


def get_working_days(year: int, month: int) -> list[date]:
    """Return weekdays (Mon-Sat) in a given month."""
    days = []
    d = date(year, month, 1)
    while d.month == month:
        if d.weekday() < 6:  # Mon=0 .. Sat=5
            days.append(d)
        d += timedelta(days=1)
    return days


def random_entry_time(shift: str) -> time:
    """Generate an entry time: 80% on-time, 20% late by up to 30 min."""
    base = SHIFT_TIMES[shift]["start"]
    base_minutes = base.hour * 60 + base.minute
    if random.random() < 0.2:
        base_minutes += random.randint(10, 30)
    else:
        base_minutes += random.randint(-5, 5)
    h, m = divmod(max(0, base_minutes), 60)
    return time(min(h, 23), m)


def random_exit_time(shift: str) -> time:
    """Generate an exit time: shift end ± 15 min."""
    base = SHIFT_TIMES[shift]["end"]
    base_minutes = base.hour * 60 + base.minute + random.randint(-15, 30)
    h, m = divmod(max(0, base_minutes), 60)
    return time(min(h, 23), m)


def calc_hours(entry: time, exit_t: time) -> Decimal:
    entry_min = entry.hour * 60 + entry.minute
    exit_min = exit_t.hour * 60 + exit_t.minute
    worked = max(0, exit_min - entry_min - 20)  # 20-min break
    return Decimal(str(round(worked / 60, 2)))


def seed_test_data():
    db = SessionLocal()
    try:
        # ── 1. Create employees ──────────────────────────────────────────
        emp_ids = []
        for emp_data in EMPLOYEES:
            existing = db.query(Employee).filter(Employee.aadhar_number == emp_data["aadhar_number"]).first()
            if existing:
                emp_ids.append(existing.id)
                print(f"  Employee '{emp_data['name']}' already exists (id={existing.id}), skipping.")
                continue
            emp = Employee(**emp_data)
            db.add(emp)
            db.flush()
            emp_ids.append(emp.id)
            print(f"  Created employee '{emp_data['name']}' (id={emp.id})")
        db.commit()

        # ── 2. Create users ──────────────────────────────────────────────
        hashed_pw = hash_password(TEST_PASSWORD)
        for username, role, emp_idx, email, display_name, phone in USERS:
            existing = db.query(User).filter(User.username == username).first()
            if existing:
                print(f"  User '{username}' already exists, skipping.")
                continue
            employee_id = emp_ids[emp_idx] if emp_idx is not None else None
            user = User(
                username=username,
                password_hash=hashed_pw,
                role=role,
                employee_id=employee_id,
                email=email,
                display_name=display_name,
                phone=phone,
            )
            db.add(user)
            print(f"  Created user '{username}' (role={role})")
        db.commit()

        # ── 3. Create attendance records (current month) ─────────────────
        today = date.today()
        working_days = [d for d in get_working_days(today.year, today.month) if d <= today]
        new_attendance = 0
        for i, emp_data in enumerate(EMPLOYEES):
            emp_id = emp_ids[i]
            shift = emp_data["shift"]
            for day in working_days:
                existing = (
                    db.query(Attendance)
                    .filter(Attendance.employee_id == emp_id, Attendance.date == day)
                    .first()
                )
                if existing:
                    continue
                # ~80% attendance
                if random.random() < 0.2:
                    continue
                entry = random_entry_time(shift)
                exit_t = random_exit_time(shift)
                hours = calc_hours(entry, exit_t)
                att = Attendance(
                    employee_id=emp_id,
                    date=day,
                    entry_time=entry,
                    exit_time=exit_t,
                    hours_worked=hours,
                )
                db.add(att)
                new_attendance += 1
        db.commit()
        print(f"  Created {new_attendance} attendance records for {today.strftime('%B %Y')}")

        # ── 4. Create payslips (previous month) ──────────────────────────
        if today.month == 1:
            prev_month, prev_year = 12, today.year - 1
        else:
            prev_month, prev_year = today.month - 1, today.year

        prev_working_days = get_working_days(prev_year, prev_month)
        new_payslips = 0
        for i, emp_data in enumerate(EMPLOYEES):
            emp_id = emp_ids[i]
            existing = (
                db.query(Payslip)
                .filter(Payslip.employee_id == emp_id, Payslip.month == prev_month, Payslip.year == prev_year)
                .first()
            )
            if existing:
                continue
            days_worked = int(len(prev_working_days) * random.uniform(0.75, 0.95))
            hourly_rate = emp_data["hourly_rate"]
            effective_hours = Decimal("7.17") if emp_data["shift"] == "SHIFT_A" else Decimal("7.67")
            daily_rate = hourly_rate * effective_hours
            total_hours = effective_hours * days_worked
            gross_pay = daily_rate * days_worked
            esi = (gross_pay * Decimal("0.0075")).quantize(Decimal("0.01"))
            pf = (gross_pay * Decimal("0.12")).quantize(Decimal("0.01"))
            net_pay = gross_pay - esi - pf

            payslip = Payslip(
                employee_id=emp_id,
                month=prev_month,
                year=prev_year,
                days_worked=days_worked,
                total_hours=total_hours,
                hourly_rate=hourly_rate,
                daily_rate=daily_rate,
                gross_pay=gross_pay,
                esi=esi,
                pf=pf,
                net_pay=net_pay,
            )
            db.add(payslip)
            new_payslips += 1
        db.commit()
        print(f"  Created {new_payslips} payslips for {prev_month}/{prev_year}")

        print("\nTest data seeding complete!")
        print(f"  All test users have password: {TEST_PASSWORD}")

    finally:
        db.close()


if __name__ == "__main__":
    seed_test_data()
