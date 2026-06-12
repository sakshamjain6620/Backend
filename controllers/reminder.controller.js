const db = require('../config/db');
const { sendMedicineReminder } = require('../services/reminder.service');
const { v4: uuidv4 } = require('uuid');

const getPatientReminders = (req, res, next) => {
    try {
        const reminders = db.prepare("SELECT * FROM reminders WHERE patient_id = ? ORDER BY created_at DESC").all(req.params.patientId);
        return res.json({ success: true, data: reminders });
    } catch (err) {
        next(err);
    }
};

const getPendingReminders = (req, res, next) => {
    try {
        const reminders = db.prepare("SELECT r.*, p.name as patient_name FROM reminders r JOIN patients p ON r.patient_id = p.id WHERE r.status = 'pending' ORDER BY r.created_at ASC").all();
        return res.json({ success: true, data: reminders });
    } catch (err) {
        next(err);
    }
};

const triggerReminderSend = (req, res, next) => {
    try {
        const reminderId = req.params.id;
        const reminder = db.prepare("SELECT * FROM reminders WHERE id = ?").get(reminderId);
        if (!reminder) {
            return res.status(404).json({ success: false, message: 'Reminder not found.' });
        }

        db.prepare("UPDATE reminders SET status = 'sent' WHERE id = ?").run(reminderId);
        console.log(`[Manual Trigger] Sent mock WhatsApp for reminder ${reminderId}`);

        return res.json({ success: true, message: 'Reminder sent successfully.', data: { id: reminderId, status: 'sent' } });
    } catch (err) {
        next(err);
    }
};

/**
 * Sweeps routines and schedules reminders for missed dosages
 */
const checkAndSendMissedMedicineReminders = (req, res, next) => {
    try {
        const todayStr = new Date().toISOString().split('T')[0];

        // Find medicine routines that are 'pending' for today or prior days
        const pendingRoutines = db.prepare(`
            SELECT mr.*, p.name as patient_name, p.phone as patient_phone, pm.medicine_name, pm.dosage, pm.timing
            FROM medicine_routines mr
            JOIN patients p ON mr.patient_id = p.id
            JOIN prescription_medicines pm ON mr.medicine_id = pm.id
            WHERE mr.status = 'pending' AND mr.routine_date <= ?
        `).all(todayStr);

        const remindersSent = [];

        pendingRoutines.forEach(routine => {
            // For MVP: Automatically trigger a mock WhatsApp reminder
            const remResult = sendMedicineReminder(routine, routine, routine.medicine_name, routine.dosage, routine.timing);
            
            // Mark routine as missed or updated
            db.prepare("UPDATE medicine_routines SET status = 'missed' WHERE id = ?").run(routine.id);

            remindersSent.push({
                routineId: routine.id,
                medicine: routine.medicine_name,
                patient: routine.patient_name,
                reminderId: remResult.id
            });
        });

        return res.json({
            success: true,
            message: `Scanned routines. Sent ${remindersSent.length} mock WhatsApp reminders.`,
            data: remindersSent
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getPatientReminders,
    getPendingReminders,
    triggerReminderSend,
    checkAndSendMissedMedicineReminders
};
