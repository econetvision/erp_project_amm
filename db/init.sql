-- ERP DATABASE SCHEMA

-- ── Companies ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255)   NOT NULL UNIQUE,
    code            VARCHAR(50)    NOT NULL UNIQUE,
    logo_path       VARCHAR(500),
    address         TEXT,
    city            VARCHAR(100),
    state           VARCHAR(100),
    country         VARCHAR(100)   DEFAULT 'India',
    pincode         VARCHAR(10),
    phone           VARCHAR(20),
    email           VARCHAR(255),
    website         VARCHAR(255),
    gst_number      VARCHAR(20),
    pan_number      VARCHAR(10),
    timezone        VARCHAR(50)    DEFAULT 'Asia/Kolkata',
    currency        VARCHAR(10)    DEFAULT 'INR',
    is_active       BOOLEAN        NOT NULL DEFAULT TRUE,
    theme_config    JSONB,
    payroll_config  JSONB,
    attendance_config JSONB,
    features        JSONB,
    created_at      TIMESTAMPTZ    DEFAULT NOW(),
    updated_at      TIMESTAMPTZ    DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id                  SERIAL PRIMARY KEY,
    username            VARCHAR(50)    NOT NULL UNIQUE,
    password_hash       VARCHAR(255)   NOT NULL,
    role                VARCHAR(20)    NOT NULL CHECK (role IN ('master','admin','supervisor','worker')),
    company_id          INTEGER        REFERENCES companies(id) ON DELETE SET NULL,
    email               VARCHAR(255),
    display_name        VARCHAR(255),
    phone               VARCHAR(20),
    photo_path          VARCHAR(500),
    pin_hash            VARCHAR(255),
    lock_timeout        INTEGER        DEFAULT 2,
    theme_preference    JSONB,
    is_active           BOOLEAN        NOT NULL DEFAULT TRUE,
    -- Employee fields (populated for workers/supervisors)
    name                VARCHAR(255),
    gender              VARCHAR(10),
    date_of_birth       DATE,
    blood_group         VARCHAR(5),
    marital_status      VARCHAR(20),
    emergency_contact   VARCHAR(20),
    emergency_name      VARCHAR(255),
    address             TEXT,
    aadhar_number       VARCHAR(12)    UNIQUE,
    bank_account_number VARCHAR(18),
    ifsc_code           VARCHAR(11),
    bank_name           VARCHAR(255),
    kyc_status          VARCHAR(20)    DEFAULT 'pending',
    kyc_verified_name   VARCHAR(255),
    hourly_rate         NUMERIC(10,2)  DEFAULT 0.00,
    shift               VARCHAR(10)    DEFAULT 'SHIFT_A',
    face_encoding       JSONB,
    photo               TEXT,
    work_location_name  VARCHAR(255),
    work_latitude       DOUBLE PRECISION,
    work_longitude      DOUBLE PRECISION,
    attendance_radius_km DOUBLE PRECISION DEFAULT 10.0,
    phone_verified      VARCHAR(1)     DEFAULT 'N',
    email_verified      VARCHAR(1)     DEFAULT 'N',
    created_at          TIMESTAMP      NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP      NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_aadhar ON users(aadhar_number) WHERE aadhar_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS attendance (
    id           SERIAL PRIMARY KEY,
    employee_id  INTEGER        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date         DATE           NOT NULL,
    entry_time   TIME           NOT NULL,
    exit_time    TIME,
    hours_worked NUMERIC(5,2),
    clock_in_latitude   DOUBLE PRECISION,
    clock_in_longitude  DOUBLE PRECISION,
    clock_out_latitude  DOUBLE PRECISION,
    clock_out_longitude DOUBLE PRECISION,
    created_at   TIMESTAMP      NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP      NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_attendance_employee_date UNIQUE (employee_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_employee_id ON attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date        ON attendance(date);

CREATE TABLE IF NOT EXISTS payslips (
    id           SERIAL PRIMARY KEY,
    employee_id  INTEGER        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
    employee_id  INTEGER        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

-- ── Job Routines ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_routines (
    id                    SERIAL PRIMARY KEY,
    name                  VARCHAR(255)   NOT NULL,
    type                  VARCHAR(50)    NOT NULL CHECK (type IN ('absent_report','late_report','custom')),
    frequency             VARCHAR(20)    NOT NULL CHECK (frequency IN ('daily','weekly','monthly')),
    schedule_time         VARCHAR(5)     NOT NULL DEFAULT '08:00',
    schedule_day_of_week  INTEGER        CHECK (schedule_day_of_week BETWEEN 0 AND 6),
    schedule_day_of_month INTEGER        CHECK (schedule_day_of_month BETWEEN 1 AND 28),
    delivery_channels     JSONB          NOT NULL DEFAULT '{"email": true, "in_app": true, "whatsapp": false}',
    recipients            JSONB          NOT NULL DEFAULT '[]',
    filters               JSONB,
    is_active             BOOLEAN        NOT NULL DEFAULT TRUE,
    created_by            INTEGER        REFERENCES users(id) ON DELETE SET NULL,
    created_at            TIMESTAMP      NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP      NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_routine_logs (
    id              SERIAL PRIMARY KEY,
    job_id          INTEGER NOT NULL REFERENCES job_routines(id) ON DELETE CASCADE,
    executed_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    status          VARCHAR(20) NOT NULL CHECK (status IN ('success','failed')),
    result_summary  TEXT,
    error_message   TEXT
);

CREATE INDEX IF NOT EXISTS idx_jrl_job_id ON job_routine_logs(job_id);

-- ── Notifications ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      VARCHAR(255) NOT NULL,
    body       TEXT,
    type       VARCHAR(50)  NOT NULL DEFAULT 'info',
    is_read    BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, is_read);

-- ── Salary Structures ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS salary_structures (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL UNIQUE,
    description VARCHAR(500),
    is_default  BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS salary_components (
    id                    SERIAL PRIMARY KEY,
    structure_id          INTEGER NOT NULL REFERENCES salary_structures(id) ON DELETE CASCADE,
    name                  VARCHAR(100) NOT NULL,
    type                  VARCHAR(20)  NOT NULL CHECK (type IN ('earning','deduction')),
    calculation_type      VARCHAR(30)  NOT NULL CHECK (calculation_type IN ('fixed','percentage_of_basic','percentage_of_gross')),
    amount_or_percentage  NUMERIC(12,4) NOT NULL DEFAULT 0,
    is_mandatory          BOOLEAN NOT NULL DEFAULT TRUE,
    display_order         SMALLINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sc_structure ON salary_components(structure_id);

CREATE TABLE IF NOT EXISTS employee_salary (
    id             SERIAL PRIMARY KEY,
    employee_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    structure_id   INTEGER NOT NULL REFERENCES salary_structures(id) ON DELETE CASCADE,
    basic_pay      NUMERIC(12,2) NOT NULL,
    effective_from TIMESTAMP NOT NULL DEFAULT NOW(),
    effective_to   TIMESTAMP,
    created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_es_employee ON employee_salary(employee_id);

-- ── Advances ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS advances (
    id                SERIAL PRIMARY KEY,
    employee_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount            NUMERIC(12,2) NOT NULL,
    disbursed_date    DATE NOT NULL,
    repayment_months  INTEGER NOT NULL DEFAULT 1,
    monthly_deduction NUMERIC(12,2) NOT NULL,
    remaining_balance NUMERIC(12,2) NOT NULL,
    status            VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','repaid')),
    notes             TEXT,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_advances_employee ON advances(employee_id);

-- ── Payroll Runs ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_runs (
    id               SERIAL PRIMARY KEY,
    month            SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
    year             SMALLINT NOT NULL CHECK (year > 2000),
    status           VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','processing','completed','cancelled')),
    run_by           INTEGER REFERENCES users(id) ON DELETE SET NULL,
    started_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at     TIMESTAMP,
    total_gross      NUMERIC(14,2),
    total_net        NUMERIC(14,2),
    total_deductions NUMERIC(14,2),
    employee_count   INTEGER
);

CREATE TABLE IF NOT EXISTS payroll_items (
    id                   SERIAL PRIMARY KEY,
    run_id               INTEGER NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
    employee_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    basic_pay            NUMERIC(12,2) NOT NULL,
    earnings_breakdown   JSONB NOT NULL DEFAULT '{}',
    deductions_breakdown JSONB NOT NULL DEFAULT '{}',
    days_worked          SMALLINT NOT NULL DEFAULT 0,
    overtime_hours       NUMERIC(7,2) NOT NULL DEFAULT 0,
    overtime_pay         NUMERIC(12,2) NOT NULL DEFAULT 0,
    gross_pay            NUMERIC(12,2) NOT NULL,
    total_deductions     NUMERIC(12,2) NOT NULL,
    advance_deduction    NUMERIC(12,2) NOT NULL DEFAULT 0,
    net_pay              NUMERIC(12,2) NOT NULL,
    status               VARCHAR(20) NOT NULL DEFAULT 'calculated'
);

CREATE INDEX IF NOT EXISTS idx_pi_run ON payroll_items(run_id);
CREATE INDEX IF NOT EXISTS idx_pi_employee ON payroll_items(employee_id);

-- ── Work Locations ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS work_locations (
    id                SERIAL PRIMARY KEY,
    company_id        INTEGER          REFERENCES companies(id) ON DELETE CASCADE,
    location_name     VARCHAR(255)     NOT NULL,
    location_code     VARCHAR(50)      UNIQUE,
    address           TEXT,
    city              VARCHAR(100),
    state             VARCHAR(100),
    pincode           VARCHAR(10),
    latitude          DOUBLE PRECISION NOT NULL,
    longitude         DOUBLE PRECISION NOT NULL,
    allowed_radius_km DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    work_type         VARCHAR(50),
    supervisor_id     INTEGER          REFERENCES users(id) ON DELETE SET NULL,
    is_active         BOOLEAN          NOT NULL DEFAULT TRUE,
    created_by        INTEGER          REFERENCES users(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ      DEFAULT NOW(),
    updated_at        TIMESTAMPTZ      DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wl_city   ON work_locations(city);
CREATE INDEX IF NOT EXISTS idx_wl_active ON work_locations(is_active);

-- ── Employee Location Assignments ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_location_assignments (
    id            SERIAL PRIMARY KEY,
    employee_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    location_id   INTEGER NOT NULL REFERENCES work_locations(id) ON DELETE CASCADE,
    is_primary    BOOLEAN NOT NULL DEFAULT FALSE,
    assigned_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assigned_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employee_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_ela_employee ON employee_location_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_ela_location ON employee_location_assignments(location_id);

-- ── Permissions ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS permissions (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(100)   NOT NULL UNIQUE,
    name        VARCHAR(255)   NOT NULL,
    module      VARCHAR(50)    NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ    DEFAULT NOW()
);

-- ── Roles ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(50)    NOT NULL,
    company_id  INTEGER        REFERENCES companies(id) ON DELETE CASCADE,
    is_system   BOOLEAN        NOT NULL DEFAULT FALSE,
    description TEXT,
    created_at  TIMESTAMPTZ    DEFAULT NOW(),
    updated_at  TIMESTAMPTZ    DEFAULT NOW(),
    UNIQUE(name, company_id)
);

-- ── Role Permissions ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS role_permissions (
    id            SERIAL PRIMARY KEY,
    role_id       INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    UNIQUE(role_id, permission_id)
);

-- ── Audit Logs ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER     REFERENCES users(id) ON DELETE SET NULL,
    company_id  INTEGER     REFERENCES companies(id) ON DELETE SET NULL,
    action      VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50),
    entity_id   INTEGER,
    details     TEXT,
    ip_address  VARCHAR(45),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user    ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_users_company    ON users(company_id);

-- ═══════════════════════════════════════════════════════════════════
-- INTEGRATION MANAGEMENT TABLES
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS integration_providers (
    id              SERIAL PRIMARY KEY,
    category        VARCHAR(50)  NOT NULL,
    code            VARCHAR(100) NOT NULL UNIQUE,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    logo_url        VARCHAR(500),
    config_schema   JSONB,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    version         VARCHAR(20) DEFAULT '1.0',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS company_integrations (
    id                  SERIAL PRIMARY KEY,
    company_id          INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    provider_id         INTEGER NOT NULL REFERENCES integration_providers(id) ON DELETE CASCADE,
    category            VARCHAR(50)  NOT NULL,
    is_enabled          BOOLEAN NOT NULL DEFAULT TRUE,
    is_default          BOOLEAN NOT NULL DEFAULT FALSE,
    priority            INTEGER NOT NULL DEFAULT 0,
    is_fallback         BOOLEAN NOT NULL DEFAULT FALSE,
    credentials         JSONB,
    config              JSONB,
    daily_quota         INTEGER,
    monthly_quota       INTEGER,
    rate_limit_per_min  INTEGER,
    last_health_check   TIMESTAMPTZ,
    health_status       VARCHAR(20) DEFAULT 'unknown',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, provider_id)
);
CREATE INDEX IF NOT EXISTS ix_ci_company_category ON company_integrations(company_id, category);

CREATE TABLE IF NOT EXISTS global_integration_defaults (
    id                      SERIAL PRIMARY KEY,
    category                VARCHAR(50) NOT NULL UNIQUE,
    provider_id             INTEGER REFERENCES integration_providers(id) ON DELETE SET NULL,
    fallback_provider_id    INTEGER REFERENCES integration_providers(id) ON DELETE SET NULL,
    credentials             JSONB,
    config                  JSONB,
    is_enabled              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS provider_logs (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    provider_id     INTEGER REFERENCES integration_providers(id) ON DELETE SET NULL,
    category        VARCHAR(50)  NOT NULL,
    action          VARCHAR(100) NOT NULL,
    status          VARCHAR(20)  NOT NULL DEFAULT 'pending',
    request_data    JSONB,
    response_data   JSONB,
    error_message   TEXT,
    latency_ms      INTEGER,
    retry_count     INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_pl_company_category ON provider_logs(company_id, category);
CREATE INDEX IF NOT EXISTS ix_pl_created ON provider_logs(created_at);

CREATE TABLE IF NOT EXISTS webhook_logs (
    id              SERIAL PRIMARY KEY,
    provider_id     INTEGER REFERENCES integration_providers(id) ON DELETE SET NULL,
    company_id      INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    event_type      VARCHAR(100),
    payload         JSONB,
    headers         JSONB,
    status          VARCHAR(20) NOT NULL DEFAULT 'received',
    error_message   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS provider_usage (
    id                  SERIAL PRIMARY KEY,
    company_id          INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    provider_id         INTEGER NOT NULL REFERENCES integration_providers(id) ON DELETE CASCADE,
    category            VARCHAR(50) NOT NULL,
    date                TIMESTAMPTZ NOT NULL,
    request_count       INTEGER NOT NULL DEFAULT 0,
    success_count       INTEGER NOT NULL DEFAULT 0,
    failure_count       INTEGER NOT NULL DEFAULT 0,
    total_latency_ms    INTEGER NOT NULL DEFAULT 0,
    UNIQUE(company_id, provider_id, date)
);
CREATE INDEX IF NOT EXISTS ix_pu_date ON provider_usage(date);

-- ================================================================
-- PAYSLIP TEMPLATES
-- ================================================================
CREATE TABLE IF NOT EXISTS payslip_templates (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(120) NOT NULL,
    description     VARCHAR(500),
    company_id      INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    is_default      BOOLEAN NOT NULL DEFAULT false,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    layout          JSONB NOT NULL DEFAULT '{}'::jsonb,
    logo_url        TEXT,
    company_name    VARCHAR(200),
    company_address TEXT,
    company_phone   VARCHAR(50),
    company_email   VARCHAR(200),
    footer_text     TEXT,
    signature_label VARCHAR(200),
    created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_payslip_templates_company ON payslip_templates(company_id);
