const db = require('../config/db');
const { sendSMS } = require('../services/twilio.service');
const { v4: uuidv4 } = require('uuid');

const getDashboardStats = (req, res, next) => {
    try {
        const todayStr = new Date().toISOString().split('T')[0];

        const totalApps = db.prepare("SELECT COUNT(*) as count FROM appointments").get().count;
        const todayApps = db.prepare("SELECT COUNT(*) as count FROM appointments WHERE appointment_date = ?").get(todayStr).count;
        const pendingPayments = db.prepare("SELECT COUNT(*) as count FROM appointments WHERE payment_status = 'pending'").get().count;
        const confirmedApps = db.prepare("SELECT COUNT(*) as count FROM appointments WHERE appointment_status = 'confirmed'").get().count;
        const totalRevenue = db.prepare("SELECT SUM(amount) as sum FROM appointments WHERE payment_status = 'paid'").get().sum || 0;
        const activeDocs = db.prepare("SELECT COUNT(*) as count FROM doctors WHERE status = 'active'").get().count;
        const emergencyCases = db.prepare("SELECT COUNT(*) as count FROM appointments WHERE urgency_level = 'emergency'").get().count;
        
        const activeReminders = db.prepare("SELECT COUNT(*) as count FROM reminders").get().count;

        // Additional stats for dashboard widgets
        const todayRevenue = db.prepare("SELECT SUM(amount) as sum FROM appointments WHERE payment_status = 'paid' AND appointment_date = ?").get(todayStr).sum || 0;
        const activeSlots = db.prepare("SELECT COUNT(*) as count FROM slots WHERE is_active = 1 AND slot_date >= ?").get(todayStr).count;
        const queueLength = db.prepare("SELECT COUNT(*) as count FROM appointments WHERE appointment_date = ? AND appointment_status = 'checked_in'").get(todayStr).count;
        const completedToday = db.prepare("SELECT COUNT(*) as count FROM appointments WHERE appointment_date = ? AND appointment_status = 'completed'").get(todayStr).count;
        const totalPatients = db.prepare("SELECT COUNT(*) as count FROM patients").get().count;

        return res.json({
            success: true,
            data: {
                totalAppointments: totalApps,
                todayAppointments: todayApps,
                pendingPayments,
                confirmedAppointments: confirmedApps,
                totalRevenue,
                activeDoctors: activeDocs,
                emergencyCases,
                medicineReminders: activeReminders,
                todayRevenue,
                activeSlots,
                queueLength,
                completedToday,
                totalPatients
            }
        });
    } catch (err) {
        next(err);
    }
};

const getRevenueAnalytics = (req, res, next) => {
    try {
        // Get last 7 days of paid appointments revenue
        const dailyRev = db.prepare(`
            SELECT appointment_date as date, SUM(amount) as revenue
            FROM appointments
            WHERE payment_status = 'paid'
            GROUP BY appointment_date
            ORDER BY appointment_date DESC
            LIMIT 7
        `).all();

        return res.json({
            success: true,
            data: dailyRev.reverse()
        });
    } catch (err) {
        next(err);
    }
};

const getFilteredAppointments = (req, res, next) => {
    try {
        const { doctorId, date, paymentStatus, appointmentStatus } = req.query;
        let queryStr = `
            SELECT a.*, d.name as doctor_name, d.specialization as doctor_specialization, 
                   p.name as patient_name, p.phone as patient_phone
            FROM appointments a
            JOIN doctors d ON a.doctor_id = d.id
            JOIN patients p ON a.patient_id = p.id
            WHERE 1=1
        `;
        const params = [];

        if (doctorId) {
            queryStr += " AND a.doctor_id = ?";
            params.push(doctorId);
        }
        if (date) {
            queryStr += " AND a.appointment_date = ?";
            params.push(date);
        }
        if (paymentStatus) {
            queryStr += " AND a.payment_status = ?";
            params.push(paymentStatus);
        }
        if (appointmentStatus) {
            queryStr += " AND a.appointment_status = ?";
            params.push(appointmentStatus);
        }

        queryStr += " ORDER BY a.appointment_date DESC, a.appointment_time DESC";

        const appointments = db.prepare(queryStr).all(...params);
        return res.json({ success: true, data: appointments });
    } catch (err) {
        next(err);
    }
};

const searchPatients = (req, res, next) => {
    try {
        const { search } = req.query;
        let queryStr = "SELECT id, name, age, gender, phone, email, address, created_at FROM patients";
        const params = [];

        if (search) {
            queryStr += " WHERE name LIKE ? OR email LIKE ? OR phone LIKE ?";
            const term = `%${search}%`;
            params.push(term, term, term);
        }

        queryStr += " ORDER BY name ASC";
        const patients = db.prepare(queryStr).all(...params);
        return res.json({ success: true, data: patients });
    } catch (err) {
        next(err);
    }
};

const updatePatient = async (req, res, next) => {
    try {
        const patientId = req.params.id;
        const { name, age, gender, phone, email, address, emergency_contact, password } = req.body;

        const patient = db.prepare("SELECT * FROM patients WHERE id = ?").get(patientId);
        if (!patient) {
            return res.status(404).json({ success: false, message: 'Patient not found' });
        }

        let newPassword = patient.password;
        if (password) {
            const bcrypt = require('bcryptjs');
            newPassword = await bcrypt.hash(password, 10);
        }

        db.prepare(`
            UPDATE patients
            SET name = ?, age = ?, gender = ?, phone = ?, email = ?, password = ?, address = ?, emergency_contact = ?
            WHERE id = ?
        `).run(
            name || patient.name,
            age ? Number(age) : patient.age,
            gender || patient.gender,
            phone || patient.phone,
            email || patient.email,
            newPassword,
            address !== undefined ? address : patient.address,
            emergency_contact !== undefined ? emergency_contact : patient.emergency_contact,
            patientId
        );

        return res.json({ success: true, message: 'Patient updated successfully' });
    } catch (err) {
        next(err);
    }
};

const getPendingRemindersForPatient = (req, res, next) => {
    try {
        const patientId = req.params.patientId;
        const reminders = db.prepare(`
            SELECT * FROM reminders 
            WHERE patient_id = ? AND status = 'pending'
            ORDER BY scheduled_time ASC
        `).all(patientId);
        
        return res.json({ success: true, data: reminders });
    } catch (err) {
        next(err);
    }
};

const getSlots = (req, res, next) => {
    try {
        const { doctorId, date } = req.query;
        let queryStr = `
            SELECT s.*, d.name as doctor_name, d.specialization as doctor_specialization,
                   (SELECT COUNT(*) FROM appointments a 
                    WHERE a.doctor_id = s.doctor_id 
                      AND a.appointment_date = s.slot_date 
                      AND a.appointment_time = s.slot_time
                      AND a.appointment_status != 'cancelled' 
                      AND a.appointment_status != 'expired') as booked_slots
            FROM slots s
            JOIN doctors d ON s.doctor_id = d.id
            WHERE 1=1
        `;
        const params = [];
        if (doctorId) {
            queryStr += " AND s.doctor_id = ?";
            params.push(doctorId);
        }
        if (date) {
            queryStr += " AND s.slot_date = ?";
            params.push(date);
        }
        queryStr += " ORDER BY s.slot_date DESC, s.slot_time ASC";
        
        const rawSlots = db.prepare(queryStr).all(...params);
        
        // Calculate remaining slots and status
        const slots = rawSlots.map(slot => {
            const booked = slot.booked_slots || 0;
            const max = slot.max_patients || 10;
            const remaining = Math.max(0, max - booked);
            let status = 'Open';
            if (slot.is_active === 0) status = 'Closed';
            else if (remaining === 0) status = 'Full';
            
            return {
                ...slot,
                booked_slots: booked,
                remaining_slots: remaining,
                slot_status: status
            };
        });

        return res.json({ success: true, data: slots });
    } catch (err) {
        next(err);
    }
};

const createSlot = (req, res, next) => {
    try {
        const { doctor_id, slot_date, slot_time, max_patients } = req.body;
        
        // Prevent duplicate slot for the same doctor at the same date & time
        const existing = db.prepare("SELECT id FROM slots WHERE doctor_id = ? AND slot_date = ? AND slot_time = ?").get(doctor_id, slot_date, slot_time);
        if (existing) {
            return res.status(400).json({ success: false, message: 'Slot already exists for this doctor at this time.' });
        }

        const id = uuidv4();
        db.prepare(`
            INSERT INTO slots (id, doctor_id, slot_date, slot_time, max_patients, is_active)
            VALUES (?, ?, ?, ?, ?, 1)
        `).run(id, doctor_id, slot_date, slot_time, max_patients || 10);
        
        return res.status(201).json({ success: true, message: 'Slot created successfully', data: { id } });
    } catch (err) {
        next(err);
    }
};

const updateSlot = (req, res, next) => {
    try {
        const slotId = req.params.id;
        const { max_patients, is_active } = req.body;
        
        const slot = db.prepare("SELECT * FROM slots WHERE id = ?").get(slotId);
        if (!slot) return res.status(404).json({ success: false, message: 'Slot not found' });
        
        db.prepare(`
            UPDATE slots SET max_patients = ?, is_active = ? WHERE id = ?
        `).run(
            max_patients !== undefined ? max_patients : slot.max_patients,
            is_active !== undefined ? (is_active ? 1 : 0) : slot.is_active,
            slotId
        );
        
        return res.json({ success: true, message: 'Slot updated' });
    } catch (err) {
        next(err);
    }
};

const deleteSlot = (req, res, next) => {
    try {
        const slotId = req.params.id;
        db.prepare("DELETE FROM slots WHERE id = ?").run(slotId);
        return res.json({ success: true, message: 'Slot deleted' });
    } catch (err) {
        next(err);
    }
};

const verifyAppointmentCode = (req, res, next) => {
    try {
        const { code } = req.body;
        const todayStr = new Date().toISOString().split('T')[0];

        // Find appointment
        const appointment = db.prepare(`
            SELECT a.*, p.name as patient_name, p.phone as patient_phone, d.name as doctor_name
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            JOIN doctors d ON a.doctor_id = d.id
            WHERE a.appointment_code = ? AND a.appointment_date = ?
        `).get(code, todayStr);

        if (!appointment) {
            return res.status(404).json({ success: false, message: 'Invalid or expired Appointment Code for today.' });
        }

        if (appointment.appointment_status === 'checked_in') {
            return res.status(400).json({ success: false, message: `Patient is already checked in with Queue Token #${appointment.token_no}` });
        }

        if (appointment.appointment_status !== 'confirmed') {
            return res.status(400).json({ success: false, message: `Cannot check in. Appointment status is: ${appointment.appointment_status}` });
        }

        // Generate sequential queue token for the doctor for today
        const tokenQuery = db.prepare(`
            SELECT MAX(token_no) as maxToken 
            FROM appointments 
            WHERE doctor_id = ? AND appointment_date = ? AND token_no IS NOT NULL
        `).get(appointment.doctor_id, todayStr);
        
        const nextToken = (tokenQuery.maxToken || 0) + 1;

        db.prepare("UPDATE appointments SET token_no = ?, appointment_status = 'checked_in' WHERE id = ?").run(nextToken, appointment.id);

        // Send SMS notification with token (non-blocking, don't crash on failure)
        if (appointment.patient_phone) {
            const smsMsg = `Your queue token is #${nextToken}. Please proceed to the desk.`;
            sendSMS(appointment.patient_phone, smsMsg).catch(() => {});
        }

        return res.json({ 
            success: true, 
            message: 'Queue Token assigned successfully.',
            data: {
                token_no: nextToken,
                patient_name: appointment.patient_name,
                doctor_name: appointment.doctor_name,
                appointment_time: appointment.appointment_time
            }
        });

    } catch (err) {
        next(err);
    }
};

const getTodayAppointments = (req, res, next) => {
    try {
        const todayStr = new Date().toISOString().split('T')[0];
        const appointments = db.prepare(`
            SELECT a.*, d.name as doctor_name, p.name as patient_name, p.phone as patient_phone
            FROM appointments a
            JOIN doctors d ON a.doctor_id = d.id
            JOIN patients p ON a.patient_id = p.id
            WHERE a.appointment_date = ? AND (a.appointment_status = 'confirmed' OR a.appointment_status = 'checked_in' OR a.appointment_status = 'completed')
            ORDER BY a.appointment_time ASC, a.token_no ASC
        `).all(todayStr);
        
        return res.json({ success: true, data: appointments });
    } catch (err) {
        next(err);
    }
};

const generateQueue = (req, res, next) => {
    try {
        const todayStr = new Date().toISOString().split('T')[0];
        
        // Find all confirmed appointments for today
        const confirmedApps = db.prepare(`
            SELECT id, doctor_id, appointment_time 
            FROM appointments 
            WHERE appointment_date = ? AND appointment_status = 'confirmed'
            ORDER BY doctor_id ASC, appointment_time ASC
        `).all(todayStr);
        
        if (!confirmedApps || confirmedApps.length === 0) {
            return res.json({ success: true, message: 'No confirmed appointments found to queue today.' });
        }
        
        // Group by doctor
        const byDoctor = {};
        for (const app of confirmedApps) {
            if (!byDoctor[app.doctor_id]) byDoctor[app.doctor_id] = [];
            byDoctor[app.doctor_id].push(app);
        }
        
        // Assign sequential token_no per doctor
        let updatedCount = 0;
        const updateStmt = db.prepare("UPDATE appointments SET token_no = ?, appointment_status = 'checked_in' WHERE id = ?");
        
        db.transaction(() => {
            for (const doctorId in byDoctor) {
                // Determine starting token if there are already checked-in/completed patients today for this doc
                const maxTokenRow = db.prepare(`
                    SELECT MAX(token_no) as maxToken 
                    FROM appointments 
                    WHERE doctor_id = ? AND appointment_date = ? AND token_no IS NOT NULL AND appointment_status != 'confirmed'
                `).get(doctorId, todayStr);
                
                let nextToken = (maxTokenRow.maxToken || 0) + 1;
                
                for (const app of byDoctor[doctorId]) {
                    updateStmt.run(nextToken, app.id);
                    nextToken++;
                    updatedCount++;
                }
            }
        })();
        
        return res.json({ success: true, message: `Queue generated successfully for ${updatedCount} appointments.` });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getDashboardStats,
    getRevenueAnalytics,
    getFilteredAppointments,
    searchPatients,
    updatePatient,
    getPendingRemindersForPatient,
    getSlots,
    createSlot,
    updateSlot,
    deleteSlot,
    verifyAppointmentCode,
    getTodayAppointments,
    generateQueue
};
