const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const createMedicalRecord = (req, res, next) => {
    try {
        const { patientId, appointmentId, symptoms, diagnosis, doctorNotes, visitSummary, followUpAdvice, reportFile, prescriptionFile } = req.body;
        const doctorId = req.user.doctorId; // Set by verifyToken for doctor logins

        if (!patientId) {
            return res.status(400).json({ success: false, message: 'Patient ID is required.' });
        }

        const id = uuidv4();

        db.prepare(`
            INSERT INTO medical_records (
                id, patient_id, appointment_id, doctor_id, symptoms, 
                diagnosis, doctor_notes, visit_summary, follow_up_advice, 
                report_file, prescription_file
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, patientId, appointmentId || null, doctorId || null, symptoms || null,
            diagnosis || null, doctorNotes || null, visitSummary || null, followUpAdvice || null,
            reportFile || null, prescriptionFile || null
        );

        // Update appointment status to completed if appointmentId exists
        if (appointmentId) {
            db.prepare("UPDATE appointments SET appointment_status = 'completed' WHERE id = ?").run(appointmentId);
        }

        const newRecord = db.prepare("SELECT * FROM medical_records WHERE id = ?").get(id);
        return res.status(201).json({ success: true, message: 'Medical record created successfully.', data: newRecord });
    } catch (err) {
        next(err);
    }
};

const getMedicalRecordById = (req, res, next) => {
    try {
        const record = db.prepare(`
            SELECT mr.*, d.name as doctor_name, d.specialization as doctor_specialization
            FROM medical_records mr
            JOIN doctors d ON mr.doctor_id = d.id
            WHERE mr.id = ?
        `).get(req.params.id);

        if (!record) {
            return res.status(404).json({ success: false, message: 'Medical record not found.' });
        }
        return res.json({ success: true, data: record });
    } catch (err) {
        next(err);
    }
};

const getPatientMedicalRecords = (req, res, next) => {
    try {
        const patientId = req.params.patientId;
        const records = db.prepare(`
            SELECT mr.*, d.name as doctor_name, d.specialization as doctor_specialization
            FROM medical_records mr
            LEFT JOIN doctors d ON mr.doctor_id = d.id
            WHERE mr.patient_id = ?
            ORDER BY mr.created_at DESC
        `).all(patientId);

        return res.json({ success: true, data: records });
    } catch (err) {
        next(err);
    }
};

const updateMedicalRecord = (req, res, next) => {
    try {
        const { diagnosis, doctorNotes, visitSummary, followUpAdvice, reportFile, prescriptionFile } = req.body;
        const recordId = req.params.id;

        const record = db.prepare("SELECT * FROM medical_records WHERE id = ?").get(recordId);
        if (!record) {
            return res.status(404).json({ success: false, message: 'Medical record not found.' });
        }

        db.prepare(`
            UPDATE medical_records 
            SET diagnosis = ?, doctor_notes = ?, visit_summary = ?, 
                follow_up_advice = ?, report_file = ?, prescription_file = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            diagnosis || record.diagnosis,
            doctorNotes || record.doctor_notes,
            visitSummary || record.visit_summary,
            followUpAdvice || record.follow_up_advice,
            reportFile !== undefined ? reportFile : record.report_file,
            prescriptionFile !== undefined ? prescriptionFile : record.prescription_file,
            recordId
        );

        const updated = db.prepare("SELECT * FROM medical_records WHERE id = ?").get(recordId);
        return res.json({ success: true, message: 'Medical record updated successfully.', data: updated });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    createMedicalRecord,
    getMedicalRecordById,
    getPatientMedicalRecords,
    updateMedicalRecord
};
