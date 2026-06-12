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

// -------------------- ROOT + HEALTH --------------------
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: "SwasthSetu API is running",
        timestamp: new Date()
    });
});

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

// -------------------- START SERVER --------------------
app.listen(PORT, "0.0.0.0", () => {
    console.log("==================================================");
    console.log(`🚀 Server started on port ${PORT}`);
    console.log(`👉 http://localhost:${PORT}`);
    console.log("==================================================");

    // ---------------- WhatsApp Init ----------------
    initializeWhatsAppClient()
        .then(() => console.log("✅ WhatsApp initialized"))
        .catch(err => console.error("⚠️ WhatsApp init failed:", err.message));

    // ---------------- Slot Generation (non-blocking) ----------------
    setImmediate(() => {
        try {
            const { generateSlotsForNext30Days } = require('./utils/slotGenerator');

            const allDocs = db.prepare("SELECT * FROM doctors").all();

            allDocs.forEach(doc => {
                try {
                    generateSlotsForNext30Days(doc);
                } catch (err) {
                    console.error("Slot generation error for doctor:", err.message);
                }
            });

            console.log("✅ Slot generation completed");
        } catch (err) {
            console.error("⚠️ Slot generation startup failed:", err.message);
        }
    });

    // ---------------- BACKGROUND REMINDER JOB ----------------
    setInterval(async () => {
        try {
            const now = new Date().toISOString();

            let pendingReminders = [];

            try {
                pendingReminders = db.prepare(`
                    SELECT r.*, p.name as patient_name, p.phone as patient_phone
                    FROM reminders r
                    JOIN patients p ON r.patient_id = p.id
                    WHERE r.status = 'pending' AND r.scheduled_time <= ?
                    ORDER BY r.scheduled_time ASC
                    LIMIT 20
                `).all(now);
            } catch (dbErr) {
                console.error("❌ Reminder DB error:", dbErr.message);
                return;
            }

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
            console.error("❌ Background job error:", err.message);
        }
    }, 30000);
});