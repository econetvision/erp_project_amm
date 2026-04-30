-- ERP DATABASE SCHEMA

CREATE TABLE IF NOT EXISTS employees (
    id                  SERIAL PRIMARY KEY,
    name                VARCHAR(255)   NOT NULL,
    address             TEXT           NOT NULL,
    aadhar_number       CHAR(12)       NOT NULL UNIQUE,
    bank_account_number VARCHAR(18)    NOT NULL,
    hourly_rate         NUMERIC(10,2)  NOT NULL DEFAULT 0.00,
    shift               VARCHAR(10)    NOT NULL DEFAULT 'SHIFT_A' CHECK (shift IN ('SHIFT_A','SHIFT_B')),
    face_encoding       JSONB,
    photo               TEXT,
    created_at          TIMESTAMP      NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP      NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_bank_account_length CHECK (LENGTH(bank_account_number) BETWEEN 8 AND 18)
);

CREATE INDEX IF NOT EXISTS idx_employees_aadhar ON employees(aadhar_number);

CREATE TABLE IF NOT EXISTS users (
    id           SERIAL PRIMARY KEY,
    username     VARCHAR(50)    NOT NULL UNIQUE,
    password_hash VARCHAR(255)  NOT NULL,
    role         VARCHAR(20)    NOT NULL CHECK (role IN ('admin','supervisor','worker')),
    employee_id  INTEGER        REFERENCES employees(id) ON DELETE SET NULL,
    created_at   TIMESTAMP      NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

CREATE TABLE IF NOT EXISTS attendance (
    id           SERIAL PRIMARY KEY,
    employee_id  INTEGER        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    date         DATE           NOT NULL,
    entry_time   TIME           NOT NULL,
    exit_time    TIME,
    hours_worked NUMERIC(5,2),
    created_at   TIMESTAMP      NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP      NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_attendance_employee_date UNIQUE (employee_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_employee_id ON attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date        ON attendance(date);

CREATE TABLE IF NOT EXISTS payslips (
    id           SERIAL PRIMARY KEY,
    employee_id  INTEGER        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    month        SMALLINT       NOT NULL CHECK (month BETWEEN 1 AND 12),
    year         SMALLINT       NOT NULL CHECK (year > 2000),
    days_worked  SMALLINT       NOT NULL DEFAULT 0,
    total_hours  NUMERIC(7,2)   NOT NULL DEFAULT 0.00,
    hourly_rate  NUMERIC(10,2)  NOT NULL,
    daily_rate   NUMERIC(12,2)  NOT NULL DEFAULT 0.00,
    gross_pay    NUMERIC(12,2)  NOT NULL,
    esi          NUMERIC(12,2)  NOT NULL DEFAULT 0.00,
    pf           NUMERIC(12,2)  NOT NULL DEFAULT 0.00,
    net_pay      NUMERIC(12,2)  NOT NULL,
    generated_at TIMESTAMP      NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_payslip_employee_month_year UNIQUE (employee_id, month, year)
);

CREATE INDEX IF NOT EXISTS idx_payslips_employee_id ON payslips(employee_id);
CREATE INDEX IF NOT EXISTS idx_payslips_month_year  ON payslips(month, year);

CREATE TABLE IF NOT EXISTS public_holidays (
    id         SERIAL PRIMARY KEY,
    date       DATE           NOT NULL UNIQUE,
    name       VARCHAR(120)   NOT NULL,
    created_at TIMESTAMP      NOT NULL DEFAULT NOW()
);

-- ── Vehicles ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicles (
    id           SERIAL PRIMARY KEY,
    reg_number   VARCHAR(20)    NOT NULL UNIQUE,
    type         VARCHAR(20)    NOT NULL CHECK (type IN ('truck','auto','van','bike','other')),
    make         VARCHAR(100),
    model        VARCHAR(100),
    status       VARCHAR(20)    NOT NULL DEFAULT 'available' CHECK (status IN ('available','assigned','maintenance')),
    created_at   TIMESTAMP      NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP      NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicles_reg ON vehicles(reg_number);

-- ── Vehicle Assignments ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicle_assignments (
    id           SERIAL PRIMARY KEY,
    vehicle_id   INTEGER        NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    employee_id  INTEGER        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    assigned_at  TIMESTAMP      NOT NULL DEFAULT NOW(),
    released_at  TIMESTAMP,
    notes        TEXT,
    CONSTRAINT uq_active_vehicle UNIQUE (vehicle_id, released_at)
);

CREATE INDEX IF NOT EXISTS idx_va_vehicle   ON vehicle_assignments(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_va_employee  ON vehicle_assignments(employee_id);

-- ── Vehicle Locations ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicle_locations (
    id           SERIAL PRIMARY KEY,
    vehicle_id   INTEGER        NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    latitude     DOUBLE PRECISION NOT NULL,
    longitude    DOUBLE PRECISION NOT NULL,
    speed        NUMERIC(6,2),
    recorded_at  TIMESTAMP      NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vl_vehicle     ON vehicle_locations(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vl_recorded_at ON vehicle_locations(recorded_at DESC);
