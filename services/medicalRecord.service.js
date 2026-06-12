const db = require('../config/db');

const getFullPatientFile = (patientId) => {
    // 1. Get Patient Demographics
    const patient = db.prepare("SELECT id, name, age, gender, phone, email, address, emergency_contact, created_at FROM patients WHERE id = ?").get(patientId);
    if (!patient) {
        throw new Error('Patient not found');
    }

    // 2. Get Appointment History (with Doctor Details)
    const appointments = db.prepare(`
        SELECT a.*, d.name as doctor_name, d.specialization as doctor_specialization 
        FROM appointments a
        JOIN doctors d ON a.doctor_id = d.id
        WHERE a.patient_id = ?
        ORDER BY a.appointment_date DESC, a.appointment_time DESC
    `).all(patientId);

    // 3. Get Clinical Records (Visit Summaries, Diagnosis, Doctor Notes)
    const medicalRecords = db.prepare(`
        SELECT mr.*, d.name as doctor_name, d.specialization as doctor_specialization
        FROM medical_records mr
        JOIN doctors d ON mr.doctor_id = d.id
        WHERE mr.patient_id = ?
        ORDER BY mr.created_at DESC
    `).all(patientId);

    // 4. Get Prescriptions
    const prescriptions = db.prepare(`
        SELECT p.*, d.name as doctor_name, d.specialization as doctor_specialization
        FROM prescriptions p
        JOIN doctors d ON p.doctor_id = d.id
        WHERE p.patient_id = ?
        ORDER BY p.created_at DESC
    `).all(patientId);

    // Populate medicines for each prescription
    prescriptions.forEach(p => {
        p.medicines = db.prepare("SELECT * FROM prescription_medicines WHERE prescription_id = ?").all(p.id);
    });

    // 5. Get Medicine Routines (Grouped by date/status)
    const medicineRoutines = db.prepare(`
        SELECT mr.*, pm.medicine_name, pm.dosage, pm.timing, pm.instructions, pm.before_after_food
        FROM medicine_routines mr
        JOIN prescription_medicines pm ON mr.medicine_id = pm.id
        WHERE mr.patient_id = ?
        ORDER BY mr.routine_date DESC, mr.routine_time ASC
    `).all(patientId);

    // 6. Get Payment History
    const payments = db.prepare(`
        SELECT pay.*, d.name as doctor_name, a.appointment_date, a.appointment_time
        FROM payments pay
        JOIN appointments a ON pay.appointment_id = a.id
        JOIN doctors d ON a.doctor_id = d.id
        WHERE pay.patient_id = ?
        ORDER BY pay.created_at DESC
    `).all(patientId);

    // 7. Get Reminders history
    const reminders = db.prepare(`
        SELECT * FROM reminders 
        WHERE patient_id = ?
        ORDER BY created_at DESC
    `).all(patientId);

    return {
        patient,
        appointments,
        medicalRecords,
        prescriptions,
        medicineRoutines,
        payments,
        reminders
    };
};

module.exports = {
    getFullPatientFile
};
