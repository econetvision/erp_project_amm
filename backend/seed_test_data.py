"""
Seed script to populate test users (with employee data), attendance records, and payslips.
Run: cd backend && python seed_test_data.py
Idempotent — skips records that already exist.
"""
import random
from datetime import date, time, timedelta
from decimal import Decimal

from database import SessionLocal, engine, Base
from models.user import User
from models.company import Company
from models.attendance import Attendance
from models.payslip import Payslip
from auth.dependencies import hash_password

# Ensure all models are imported so relationships resolve
import models.holiday            # noqa: F401
import models.vehicle            # noqa: F401
import models.vehicle_assignment  # noqa: F401
import models.vehicle_location   # noqa: F401
# Tables are already created by init.sql + alembic; skip create_all to avoid conflicts

TEST_PASSWORD = "test123"

# Combined user-employee records
TEST_USERS = [
    {"username": "supervisor1", "role": "supervisor", "name": "Rajesh Kumar",      "address": "12, Gandhi Nagar, Chennai 600020",     "aadhar_number": "234567890123", "bank_account_number": "10234567890",  "hourly_rate": Decimal("75.00"),  "shift": "SHIFT_A", "email": "rajesh.k@econetvision.com",  "display_name": "Rajesh Kumar",    "phone": "+919876543210"},
    {"username": "supervisor2", "role": "supervisor", "name": "Priya Sharma",      "address": "45, MG Road, Bengaluru 560001",        "aadhar_number": "345678901234", "bank_account_number": "20345678901",  "hourly_rate": Decimal("85.00"),  "shift": "SHIFT_B", "email": "priya.s@econetvision.com",   "display_name": "Priya Sharma",    "phone": "+919876543211"},
    {"username": "worker1",     "role": "worker",     "name": "Arun Patel",        "address": "78, Lal Darwaja, Ahmedabad 380001",    "aadhar_number": "456789012345", "bank_account_number": "30456789012",  "hourly_rate": Decimal("65.00"),  "shift": "SHIFT_A", "email": "arun.p@econetvision.com",    "display_name": "Arun Patel",      "phone": "+919876543212"},
    {"username": "worker2",     "role": "worker",     "name": "Deepa Nair",        "address": "23, Marine Drive, Kochi 682001",       "aadhar_number": "567890123456", "bank_account_number": "40567890123",  "hourly_rate": Decimal("90.00"),  "shift": "SHIFT_B", "email": "deepa.n@econetvision.com",   "display_name": "Deepa Nair",      "phone": "+919876543213"},
    {"username": "worker3",     "role": "worker",     "name": "Suresh Reddy",      "address": "56, Jubilee Hills, Hyderabad 500033",  "aadhar_number": "678901234567", "bank_account_number": "50678901234",  "hourly_rate": Decimal("70.00"),  "shift": "SHIFT_A", "email": "suresh.r@econetvision.com",  "display_name": "Suresh Reddy",    "phone": "+919876543214"},
    {"username": "worker4",     "role": "worker",     "name": "Kavitha Murugan",   "address": "89, Anna Salai, Chennai 600002",       "aadhar_number": "789012345678", "bank_account_number": "60789012345",  "hourly_rate": Decimal("100.00"), "shift": "SHIFT_B", "email": "kavitha.m@econetvision.com", "display_name": "Kavitha Murugan", "phone": "+919876543215"},
    {"username": "worker5",     "role": "worker",     "name": "Manoj Singh",       "address": "34, Connaught Place, New Delhi 110001","aadhar_number": "890123456789", "bank_account_number": "70890123456",  "hourly_rate": Decimal("55.00"),  "shift": "SHIFT_A", "email": "manoj.s@econetvision.com",   "display_name": "Manoj Singh",     "phone": "+919876543216"},
    {"username": "worker6",     "role": "worker",     "name": "Lakshmi Iyer",      "address": "67, Koramangala, Bengaluru 560034",    "aadhar_number": "901234567890", "bank_account_number": "80901234567",  "hourly_rate": Decimal("110.00"), "shift": "SHIFT_B", "email": "lakshmi.i@econetvision.com", "display_name": "Lakshmi Iyer",    "phone": "+919876543217"},
    {"username": "worker7",     "role": "worker",     "name": "Vikram Joshi",      "address": "90, FC Road, Pune 411004",             "aadhar_number": "112345678901", "bank_account_number": "91123456789",  "hourly_rate": Decimal("80.00"),  "shift": "SHIFT_A", "email": "vikram.j@econetvision.com",  "display_name": "Vikram Joshi",    "phone": "+919876543218"},
    {"username": "worker8",     "role": "worker",     "name": "Anitha Balasubramanian", "address": "15, T Nagar, Chennai 600017",     "aadhar_number": "223456789012", "bank_account_number": "10223456789",  "hourly_rate": Decimal("95.00"),  "shift": "SHIFT_B", "email": "anitha.b@econetvision.com",  "display_name": "Anitha B",        "phone": "+919876543219"},
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
        # ── 1. Create user-employees ─────────────────────────────────────
        default_company = db.query(Company).filter(Company.code == "DEFAULT").first()
        company_id = default_company.id if default_company else None
        hashed_pw = hash_password(TEST_PASSWORD)
        user_ids = []
        for u_data in TEST_USERS:
            existing = db.query(User).filter(User.username == u_data["username"]).first()
            if existing:
                user_ids.append(existing.id)
                print(f"  User '{u_data['username']}' already exists (id={existing.id}), skipping.")
                continue
            user = User(
                username=u_data["username"],
                password_hash=hashed_pw,
                role=u_data["role"],
                company_id=company_id,
                name=u_data["name"],
                address=u_data["address"],
                aadhar_number=u_data["aadhar_number"],
                bank_account_number=u_data["bank_account_number"],
                hourly_rate=u_data["hourly_rate"],
                shift=u_data["shift"],
                email=u_data["email"],
                display_name=u_data["display_name"],
                phone=u_data["phone"],
            )
            db.add(user)
            db.flush()
            user_ids.append(user.id)
            print(f"  Created user '{u_data['username']}' (role={u_data['role']}, id={user.id})")
        db.commit()

        # ── 2. Create attendance records (current month) ─────────────────
        today = date.today()
        working_days = [d for d in get_working_days(today.year, today.month) if d <= today]
        new_attendance = 0
        for i, u_data in enumerate(TEST_USERS):
            user_id = user_ids[i]
            shift = u_data["shift"]
            for day in working_days:
                existing = (
                    db.query(Attendance)
                    .filter(Attendance.employee_id == user_id, Attendance.date == day)
                    .first()
                )
                if existing:
                    continue
                if random.random() < 0.2:
                    continue
                entry = random_entry_time(shift)
                exit_t = random_exit_time(shift)
                hours = calc_hours(entry, exit_t)
                att = Attendance(
                    employee_id=user_id,
                    date=day,
                    entry_time=entry,
                    exit_time=exit_t,
                    hours_worked=hours,
                )
                db.add(att)
                new_attendance += 1
        db.commit()
        print(f"  Created {new_attendance} attendance records for {today.strftime('%B %Y')}")

        # ── 3. Create payslips (previous month) ──────────────────────────
        if today.month == 1:
            prev_month, prev_year = 12, today.year - 1
        else:
            prev_month, prev_year = today.month - 1, today.year

        prev_working_days = get_working_days(prev_year, prev_month)
        new_payslips = 0
        for i, u_data in enumerate(TEST_USERS):
            user_id = user_ids[i]
            existing = (
                db.query(Payslip)
                .filter(Payslip.employee_id == user_id, Payslip.month == prev_month, Payslip.year == prev_year)
                .first()
            )
            if existing:
                continue
            days_worked = int(len(prev_working_days) * random.uniform(0.75, 0.95))
            hourly_rate = u_data["hourly_rate"]
            effective_hours = Decimal("7.17") if u_data["shift"] == "SHIFT_A" else Decimal("7.67")
            daily_rate = hourly_rate * effective_hours
            total_hours = effective_hours * days_worked
            gross_pay = daily_rate * days_worked
            esi = (gross_pay * Decimal("0.0075")).quantize(Decimal("0.01"))
            pf = (gross_pay * Decimal("0.12")).quantize(Decimal("0.01"))
            net_pay = gross_pay - esi - pf

            payslip = Payslip(
                employee_id=user_id,
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
