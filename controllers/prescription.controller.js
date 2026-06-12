const db = require('../config/db');
const { generatePrescriptionPDF } = require('../services/pdf.service');
const { v4: uuidv4 } = require('uuid');

/**
 * Calculates end date based on start date and duration days
 */
function addDays(dateStr, days) {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
}

const createPrescription = (req, res, next) => {
    // We run the inserts in a transaction to guarantee consistency
    const transaction = db.transaction((prescriptionData) => {
        const { patientId, appointmentId, diagnosis, instructions, followUpDate, medicines } = prescriptionData;
        const doctorId = req.user.doctorId; // Set by verifyToken for doctor role

        const prescriptionId = uuidv4();
        
        // 1. Insert Prescription header
        db.prepare(`
            INSERT INTO prescriptions (id, patient_id, appointment_id, doctor_id, diagnosis, instructions, follow_up_date)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(prescriptionId, patientId, appointmentId || null, doctorId || null, diagnosis || null, instructions || null, followUpDate || null);

        const insertedMedicines = [];

        // 2. Loop and Insert Medicines
        if (medicines && Array.isArray(medicines)) {
            medicines.forEach(med => {
                const medId = uuidv4();
                const startDate = med.startDate || new Date().toISOString().split('T')[0];
                const durationDays = Number(med.durationDays || 5);
                const endDate = addDays(startDate, durationDays - 1);

                db.prepare(`
                    INSERT INTO prescription_medicines (
                        id, prescription_id, medicine_name, dosage, timing, 
                        duration_days, start_date, end_date, instructions, before_after_food
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    medId, prescriptionId, med.medicineName, med.dosage, med.timing,
                    durationDays, startDate, endDate, med.instructions || null, med.beforeAfterFood || 'After Food'
                );

                // 3. Generate Day-by-Day scheduled medicine routine entries
                // e.g. timing: "Morning and Evening" -> schedule Morning & Evening logs
                const timingsToSchedule = [];
                const tLower = med.timing.toLowerCase();
                if (tLower.includes('morning') || tLower.includes('breakfast')) timingsToSchedule.push('Morning');
                if (tLower.includes('afternoon') || tLower.includes('lunch')) timingsToSchedule.push('Afternoon');
                if (tLower.includes('evening') || tLower.includes('night') || tLower.includes('dinner')) timingsToSchedule.push('Evening');

                // If timings list is empty, schedule a generic daily dose
                if (timingsToSchedule.length === 0) timingsToSchedule.push('Morning');

                for (let day = 0; day < durationDays; day++) {
                    const routineDate = addDays(startDate, day);
                    
                    timingsToSchedule.forEach(timeSlot => {
                        const routineId = uuidv4();
                        db.prepare(`
                            INSERT INTO medicine_routines (id, patient_id, prescription_id, medicine_id, routine_date, routine_time, status)
                            VALUES (?, ?, ?, ?, ?, ?, 'pending')
                        `).run(routineId, patientId, prescriptionId, medId, routineDate, timeSlot);
                    });
                }

                insertedMedicines.push({ id: medId, ...med, startDate, endDate });
            });
        }

        // 4. Update the appointment status to completed if appointmentId exists
        if (appointmentId) {
            db.prepare("UPDATE appointments SET appointment_status = 'completed' WHERE id = ?").run(appointmentId);
            
            // Also automatically create/update medical record entry linking this prescription
            const recordCheck = db.prepare("SELECT id FROM medical_records WHERE appointment_id = ?").get(appointmentId);
            if (recordCheck) {
                db.prepare("UPDATE medical_records SET prescription_file = ? WHERE id = ?").run(`prescription_${prescriptionId}.pdf`, recordCheck.id);
            } else {
                const recordId = uuidv4();
                db.prepare(`
                    INSERT INTO medical_records (id, patient_id, appointment_id, doctor_id, symptoms, diagnosis, prescription_file)
                    VALUES (?, ?, ?, ?, 'Consulted', ?, ?)
                `).run(recordId, patientId, appointmentId, doctorId, diagnosis, `prescription_${prescriptionId}.pdf`);
            }
        }

        return { prescriptionId, medicines: insertedMedicines };
    });

    try {
        const result = transaction(req.body);
        
        const responseData = db.prepare("SELECT * FROM prescriptions WHERE id = ?").get(result.prescriptionId);
        responseData.medicines = db.prepare("SELECT * FROM prescription_medicines WHERE prescription_id = ?").all(result.prescriptionId);

        return res.status(201).json({
            success: true,
            message: 'Prescription created and medicine routine scheduled.',
            data: responseData
        });
    } catch (err) {
        next(err);
    }
};

const getPrescriptionById = (req, res, next) => {
    try {
        const prescription = db.prepare(`
            SELECT p.*, d.name as doctor_name, d.specialization as doctor_specialization
            FROM prescriptions p
            JOIN doctors d ON p.doctor_id = d.id
            WHERE p.id = ?
        `).get(req.params.id);

        if (!prescription) {
            return res.status(404).json({ success: false, message: 'Prescription not found.' });
        }

        prescription.medicines = db.prepare("SELECT * FROM prescription_medicines WHERE prescription_id = ?").all(prescription.id);

        return res.json({ success: true, data: prescription });
    } catch (err) {
        next(err);
    }
};

const getPatientPrescriptions = (req, res, next) => {
    try {
        const patientId = req.params.patientId;
        const prescriptions = db.prepare(`
            SELECT p.*, d.name as doctor_name, d.specialization as doctor_specialization
            FROM prescriptions p
            JOIN doctors d ON p.doctor_id = d.id
            WHERE p.patient_id = ?
            ORDER BY p.created_at DESC
        `).all(patientId);

        prescriptions.forEach(p => {
            p.medicines = db.prepare("SELECT * FROM prescription_medicines WHERE prescription_id = ?").all(p.id);
        });

        return res.json({ success: true, data: prescriptions });
    } catch (err) {
        next(err);
    }
};

const downloadPrescriptionPDF = async (req, res, next) => {
    try {
        const prescriptionId = req.params.id;
        const prescription = db.prepare("SELECT * FROM prescriptions WHERE id = ?").get(prescriptionId);
        if (!prescription) {
            return res.status(404).json({ success: false, message: 'Prescription not found.' });
        }

        const doctor = db.prepare("SELECT * FROM doctors WHERE id = ?").get(prescription.doctor_id);
        const patient = db.prepare("SELECT * FROM patients WHERE id = ?").get(prescription.patient_id);
        const medicines = db.prepare("SELECT * FROM prescription_medicines WHERE prescription_id = ?").all(prescriptionId);

        const pdfBuffer = await generatePrescriptionPDF(prescription, doctor, patient, medicines);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=prescription_${prescriptionId.slice(0, 8)}.pdf`);
        res.setHeader('Content-Length', pdfBuffer.length);
        return res.send(pdfBuffer);
    } catch (err) {
        next(err);
    }
};

module.exports = {
    createPrescription,
    getPrescriptionById,
    getPatientPrescriptions,
    downloadPrescriptionPDF
};
