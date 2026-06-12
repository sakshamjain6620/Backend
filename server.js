const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./config/db');

// Routes
const authRoutes = require('./routes/auth.routes');
const appointmentRoutes = require('./routes/appointment.routes');
const paymentRoutes = require('./routes/payment.routes');
const aiRoutes = require('./routes/ai.routes');
const patientRoutes = require('./routes/patient.routes');
const medicalRecordRoutes = require('./routes/medicalRecord.routes');
const prescriptionRoutes = require('./routes/prescription.routes');
const medicineRoutes = require('./routes/medicine.routes');
const reminderRoutes = require('./routes/reminder.routes');
const adminRoutes = require('./routes/admin.routes');
const doctorRoutes = require('./routes/doctor.routes');

// Services
const { initializeWhatsAppClient, sendWhatsAppMessage } = require('./services/whatsapp.service');

// Middleware
const { notFound, errorHandler } = require('./middleware/error.middleware');

const app = express();
const PORT = process.env.PORT || 5000;

// -------------------- MIDDLEWARE --------------------
app.use(cors({
    origin: true,
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// -------------------- STATUS ROUTE --------------------
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        message: 'SwasthSetu Backend API is running smoothly.',
        timestamp: new Date()
    });
});

// -------------------- ROUTES --------------------
app.use('/api/auth', authRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/medical-records', medicalRecordRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/doctors', doctorRoutes);

// -------------------- ERROR HANDLERS --------------------
app.use(notFound);
app.use(errorHandler);

// -------------------- SERVER START --------------------
app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`🚀 SwasthSetu Server started on port ${PORT}`);
    console.log(`👉 http://localhost:${PORT}`);
    console.log(`==================================================`);

    // WhatsApp init (safe)
    try {
        initializeWhatsAppClient();
    } catch (err) {
        console.error("⚠️ WhatsApp init failed:", err.message);
    }

    // Generate slots for all doctors on startup
    try {
        const { generateSlotsForNext30Days } = require('./utils/slotGenerator');
        const allDocs = db.prepare("SELECT * FROM doctors").all();
        allDocs.forEach(doc => generateSlotsForNext30Days(doc));
        console.log("✅ Populated missing manual slots for all doctors.");
    } catch (err) {
        console.error("⚠️ Failed to generate slots on startup:", err.message);
    }

    // -------------------- BACKGROUND JOB --------------------
    setInterval(async () => {
        try {
            const now = new Date().toISOString();

            const pendingReminders = db.prepare(`
                SELECT r.*, p.name as patient_name, p.phone as patient_phone
                FROM reminders r
                JOIN patients p ON r.patient_id = p.id
                WHERE r.status = 'pending' AND r.scheduled_time <= ?
                ORDER BY r.scheduled_time ASC
                LIMIT 20
            `).all(now);

            if (!pendingReminders.length) return;

            for (const reminder of pendingReminders) {
                try {
                    console.log(`📱 Sending WhatsApp to ${reminder.patient_phone}`);

                    await sendWhatsAppMessage(
                        reminder.patient_phone,
                        reminder.message
                    );

                    db.prepare(
                        "UPDATE reminders SET status = 'sent' WHERE id = ?"
                    ).run(reminder.id);

                    // Optional follow-up warning
                    if (
                        reminder.reminder_type === 'medicine' &&
                        !reminder.message.includes('WARNING:')
                    ) {
                        const { v4: uuidv4 } = require('uuid');

                        const warningTime = new Date();
                        warningTime.setHours(warningTime.getHours() + 1);

                        db.prepare(`
                            INSERT INTO reminders (
                                id, patient_id, appointment_id,
                                reminder_type, message,
                                scheduled_time, status, sent_via, routine_id
                            )
                            VALUES (?, ?, ?, 'medicine', ?, ?, 'pending', 'whatsapp', ?)
                        `).run(
                            uuidv4(),
                            reminder.patient_id,
                            reminder.appointment_id,
                            `WARNING: You have not taken your medicine yet! ${reminder.message}`,
                            warningTime.toISOString(),
                            reminder.routine_id
                        );
                    }

                } catch (err) {
                    console.error("❌ Reminder send failed:", err.message);
                }
            }

        } catch (err) {
            console.error('❌ Background reminder error:', err.message);
        }
    }, 30000);
});