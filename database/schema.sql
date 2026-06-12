-- SQLite Database Schema for SwasthSetu

-- 1. admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. doctors table
CREATE TABLE IF NOT EXISTS doctors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    specialization TEXT NOT NULL,
    experience INTEGER NOT NULL,
    fee REAL NOT NULL,
    phone TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    available_days TEXT NOT NULL, -- JSON array of strings: ["Monday", "Tuesday", ...]
    manual_slots TEXT, -- JSON array of strings for custom slots
    slot_start_time TEXT NOT NULL, -- e.g. "09:00"
    slot_end_time TEXT NOT NULL, -- e.g. "17:00"
    max_patients_per_slot INTEGER DEFAULT 10,
    status TEXT DEFAULT 'active', -- active, inactive
    avatar_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. doctor_users table (for Doctor logins)
CREATE TABLE IF NOT EXISTS doctor_users (
    id TEXT PRIMARY KEY,
    doctor_id TEXT REFERENCES doctors(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. patients table
CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    age INTEGER NOT NULL,
    gender TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, -- Added password for portal login
    address TEXT,
    emergency_contact TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. appointments table
CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    patient_id TEXT REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id TEXT REFERENCES doctors(id) ON DELETE RESTRICT,
    appointment_date TEXT NOT NULL, -- YYYY-MM-DD
    appointment_time TEXT NOT NULL, -- HH:MM
    appointment_code TEXT UNIQUE,
    symptoms TEXT,
    urgency_level TEXT DEFAULT 'medium', -- low, medium, high, emergency
    ai_summary TEXT,
    token_no INTEGER,
    amount REAL,
    payment_status TEXT DEFAULT 'pending', -- pending, paid, failed
    appointment_status TEXT DEFAULT 'pending', -- pending, confirmed, cancelled, expired
    razorpay_order_id TEXT,
    razorpay_payment_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. payments table
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    appointment_id TEXT REFERENCES appointments(id) ON DELETE CASCADE,
    patient_id TEXT REFERENCES patients(id),
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'INR',
    razorpay_order_id TEXT NOT NULL,
    razorpay_payment_id TEXT,
    razorpay_signature TEXT,
    payment_status TEXT DEFAULT 'pending', -- pending, paid, failed
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. medical_records table (Patient Digital Medical Record)
CREATE TABLE IF NOT EXISTS medical_records (
    id TEXT PRIMARY KEY,
    patient_id TEXT REFERENCES patients(id) ON DELETE CASCADE,
    appointment_id TEXT REFERENCES appointments(id) ON DELETE SET NULL,
    doctor_id TEXT REFERENCES doctors(id),
    symptoms TEXT,
    diagnosis TEXT,
    doctor_notes TEXT,
    visit_summary TEXT,
    follow_up_advice TEXT,
    report_file TEXT, -- URL or path to uploaded reports
    prescription_file TEXT, -- URL or path to prescription PDF
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. prescriptions table
CREATE TABLE IF NOT EXISTS prescriptions (
    id TEXT PRIMARY KEY,
    patient_id TEXT REFERENCES patients(id) ON DELETE CASCADE,
    appointment_id TEXT REFERENCES appointments(id) ON DELETE SET NULL,
    doctor_id TEXT REFERENCES doctors(id),
    diagnosis TEXT,
    instructions TEXT,
    follow_up_date TEXT, -- YYYY-MM-DD
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 9. prescription_medicines table (medicines inside a prescription)
CREATE TABLE IF NOT EXISTS prescription_medicines (
    id TEXT PRIMARY KEY,
    prescription_id TEXT REFERENCES prescriptions(id) ON DELETE CASCADE,
    medicine_name TEXT NOT NULL,
    dosage TEXT NOT NULL, -- e.g. "1 tablet"
    timing TEXT NOT NULL, -- e.g. "Morning and Evening"
    duration_days INTEGER NOT NULL,
    start_date TEXT NOT NULL, -- YYYY-MM-DD
    end_date TEXT NOT NULL, -- YYYY-MM-DD
    instructions TEXT, -- e.g. "Before food", "After food"
    before_after_food TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 10. medicine_routines table (day-by-day scheduled routines)
CREATE TABLE IF NOT EXISTS medicine_routines (
    id TEXT PRIMARY KEY,
    patient_id TEXT REFERENCES patients(id) ON DELETE CASCADE,
    prescription_id TEXT REFERENCES prescriptions(id) ON DELETE CASCADE,
    medicine_id TEXT REFERENCES prescription_medicines(id) ON DELETE CASCADE,
    routine_date TEXT NOT NULL, -- YYYY-MM-DD
    routine_time TEXT NOT NULL, -- Morning, Afternoon, Evening, Night
    status TEXT DEFAULT 'pending', -- pending, taken, missed, completed
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 11. medicine_logs table (records when patient ticks medicine)
CREATE TABLE IF NOT EXISTS medicine_logs (
    id TEXT PRIMARY KEY,
    routine_id TEXT REFERENCES medicine_routines(id) ON DELETE CASCADE,
    patient_id TEXT REFERENCES patients(id) ON DELETE CASCADE,
    taken_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'taken',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 12. reminders table
CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    patient_id TEXT REFERENCES patients(id) ON DELETE CASCADE,
    appointment_id TEXT REFERENCES appointments(id) ON DELETE CASCADE,
    reminder_type TEXT NOT NULL, -- appointment, medicine, follow_up, payment
    message TEXT NOT NULL,
    scheduled_time TEXT NOT NULL, -- Datetime string
    status TEXT DEFAULT 'pending', -- pending, sent, failed
    sent_via TEXT NOT NULL, -- mock_whatsapp, mock_email
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 13. slots table
CREATE TABLE IF NOT EXISTS slots (
    id TEXT PRIMARY KEY,
    doctor_id TEXT REFERENCES doctors(id) ON DELETE CASCADE,
    slot_date TEXT NOT NULL, -- YYYY-MM-DD
    slot_time TEXT NOT NULL, -- HH:MM
    max_patients INTEGER NOT NULL DEFAULT 10,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create Indexes for performance
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_medicine_routines_patient_date ON medicine_routines(patient_id, routine_date);
CREATE INDEX IF NOT EXISTS idx_medical_records_patient ON medical_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_reminders_patient ON reminders(patient_id);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);
