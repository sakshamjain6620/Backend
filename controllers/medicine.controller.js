const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const getPatientMedicineRoutine = (req, res, next) => {
    try {
        const patientId = req.params.patientId;
        const { date } = req.query; // YYYY-MM-DD
        const targetDate = date || new Date().toISOString().split('T')[0];

        const routines = db.prepare(`
            SELECT mr.*, pm.medicine_name, pm.dosage, pm.timing, pm.instructions, pm.before_after_food
            FROM medicine_routines mr
            JOIN prescription_medicines pm ON mr.medicine_id = pm.id
            WHERE mr.patient_id = ? AND mr.routine_date = ?
            ORDER BY 
                CASE mr.routine_time
                    WHEN 'Morning' THEN 1
                    WHEN 'Afternoon' THEN 2
                    WHEN 'Evening' THEN 3
                    WHEN 'Night' THEN 4
                    ELSE 5
                END ASC
        `).all(patientId, targetDate);

        return res.json({ success: true, data: routines });
    } catch (err) {
        next(err);
    }
};

const markMedicineTaken = (req, res, next) => {
    const transaction = db.transaction((routineId) => {
        const routine = db.prepare("SELECT * FROM medicine_routines WHERE id = ?").get(routineId);
        if (!routine) {
            throw new Error('Routine log not found');
        }

        // 1. Update routine status
        db.prepare("UPDATE medicine_routines SET status = 'taken' WHERE id = ?").run(routineId);

        // 1.5 Update any pending reminders for this routine to 'completed'
        db.prepare("UPDATE reminders SET status = 'completed' WHERE routine_id = ? AND status = 'pending'").run(routineId);

        // 2. Insert into medicine_logs
        const logId = uuidv4();
        db.prepare(`
            INSERT INTO medicine_logs (id, routine_id, patient_id, taken_at, status)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP, 'taken')
        `).run(logId, routineId, routine.patient_id);

        // 3. Check if all routines for this prescription are completed
        const pendingCount = db.prepare(`
            SELECT COUNT(*) as count 
            FROM medicine_routines 
            WHERE prescription_id = ? AND status = 'pending'
        `).get(routine.prescription_id);

        if (pendingCount.count === 0) {
            // Set all routines of this prescription to completed
            db.prepare("UPDATE medicine_routines SET status = 'completed' WHERE prescription_id = ? AND status = 'taken'").run(routine.prescription_id);
        }

        return { routineId, status: 'taken' };
    });

    try {
        const result = transaction(req.params.routineId);
        return res.json({
            success: true,
            message: 'Medicine marked as taken successfully.',
            data: result
        });
    } catch (err) {
        next(err);
    }
};

const getMedicineLogs = (req, res, next) => {
    try {
        const patientId = req.params.patientId;
        const logs = db.prepare(`
            SELECT ml.*, pm.medicine_name, mr.routine_date, mr.routine_time
            FROM medicine_logs ml
            JOIN medicine_routines mr ON ml.routine_id = mr.id
            JOIN prescription_medicines pm ON mr.medicine_id = pm.id
            WHERE ml.patient_id = ?
            ORDER BY ml.taken_at DESC
        `).all(patientId);

        return res.json({ success: true, data: logs });
    } catch (err) {
        next(err);
    }
};

const allotMedicine = (req, res, next) => {
    try {
        const { patientId, medicines } = req.body;
        // medicines: [{ medicineName, dosage, timings: ['Morning','Afternoon','Night'], durationDays, startDate, instructions, beforeAfterFood }]

        if (!patientId || !medicines || !Array.isArray(medicines) || medicines.length === 0) {
            return res.status(400).json({ success: false, message: 'Please provide patientId and at least one medicine.' });
        }

        const patient = db.prepare("SELECT * FROM patients WHERE id = ?").get(patientId);
        if (!patient) {
            return res.status(404).json({ success: false, message: 'Patient not found.' });
        }

        const prescriptionId = uuidv4();

        // Create a prescription record (admin-issued, no doctor_id)
        db.prepare(`
            INSERT INTO prescriptions (id, patient_id, appointment_id, doctor_id, diagnosis, instructions, follow_up_date)
            VALUES (?, ?, NULL, NULL, 'Admin Allotted Medicine', 'Prescribed by admin', NULL)
        `).run(prescriptionId, patientId);

        // Create an immediate notification reminder
        const immediateReminderId = uuidv4();
        const nowStr = new Date().toISOString();
        db.prepare(`
            INSERT INTO reminders (id, patient_id, reminder_type, message, scheduled_time, status, sent_via)
            VALUES (?, ?, 'medicine', ?, ?, 'pending', 'whatsapp')
        `).run(immediateReminderId, patientId, `A new medicine course has been allotted to you. Please check your SwasthSetu app for the schedule.`, nowStr);

        const allottedMedicines = [];

        medicines.forEach(med => {
            const { medicineName, dosage, timings, durationDays, startDate, instructions, beforeAfterFood } = med;
            const days = Number(durationDays) || 5;
            const start = startDate || new Date().toISOString().split('T')[0];
            const timingList = Array.isArray(timings) ? timings : ['Morning'];
            const timingStr = timingList.join(', ');

            // Calculate end date
            const startD = new Date(start);
            const endD = new Date(startD);
            endD.setDate(endD.getDate() + days - 1);
            const endDate = endD.toISOString().split('T')[0];

            const medicineId = uuidv4();
            db.prepare(`
                INSERT INTO prescription_medicines (id, prescription_id, medicine_name, dosage, timing, duration_days, start_date, end_date, instructions, before_after_food)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(medicineId, prescriptionId, medicineName, dosage || '1 tablet', timingStr, days, start, endDate, instructions || '', beforeAfterFood || 'After food');

            // Create day-by-day medicine routines
            for (let d = 0; d < days; d++) {
                const routineDate = new Date(startD);
                routineDate.setDate(routineDate.getDate() + d);
                const routineDateStr = routineDate.toISOString().split('T')[0];

                timingList.forEach(timing => {
                    const routineId = uuidv4();
                    db.prepare(`
                        INSERT INTO medicine_routines (id, patient_id, prescription_id, medicine_id, routine_date, routine_time, status)
                        VALUES (?, ?, ?, ?, ?, ?, 'pending')
                    `).run(routineId, patientId, prescriptionId, medicineId, routineDateStr, timing);

                    // Create a pending reminder for each routine
                    const timeMap = { 'Morning': '08:00', 'Afternoon': '13:30', 'Evening': '18:00', 'Night': '22:00' };
                    const scheduledTime = `${routineDateStr}T${timeMap[timing] || '08:00'}:00`;
                    const reminderId = uuidv4();
                    const message = `Hello ${patient.name}, please take your medicine: ${medicineName} (${dosage || '1 tablet'}) - ${timing} dose. ${beforeAfterFood || 'After food'}.`;

                    db.prepare(`
                        INSERT INTO reminders (id, patient_id, appointment_id, reminder_type, message, scheduled_time, status, sent_via, routine_id)
                        VALUES (?, ?, NULL, 'medicine', ?, ?, 'pending', 'whatsapp', ?)
                    `).run(reminderId, patientId, message, scheduledTime, routineId);
                });
            }

            allottedMedicines.push({ medicineId, medicineName, dosage, timings: timingList, durationDays: days, startDate: start, endDate });
        });

        return res.status(201).json({
            success: true,
            message: `Successfully allotted ${allottedMedicines.length} medicine(s) to patient ${patient.name}.`,
            data: { prescriptionId, medicines: allottedMedicines }
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getPatientMedicineRoutine,
    markMedicineTaken,
    getMedicineLogs,
    allotMedicine
};
