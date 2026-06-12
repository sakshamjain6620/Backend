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

// -------------------- ROOT --------------------
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: "SwasthSetu API is running",
        timestamp: new Date()
    });
});

// -------------------- STATUS --------------------
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
app.listen(PORT, "0.0.0.0", () => {
    console.log("==================================================");
    console.log(`🚀 Server started on port ${PORT}`);
    console.log("==================================================");

    // ---------------- FIXED WHATSAPP INIT ----------------
    try {
        const result = initializeWhatsAppClient();

        // SAFE CHECK: only use .then if it is a Promise
        if (result && typeof result.then === "function") {
            result
                .then(() => console.log("✅ WhatsApp initialized"))
                .catch(err => console.error("⚠️ WhatsApp init failed:", err.message));
        } else {
            console.log("✅ WhatsApp initialized (sync mode)");
        }

    } catch (err) {
        console.error("⚠️ WhatsApp init crashed:", err.message);
    }

    // ---------------- SLOT GENERATION ----------------
    setImmediate(() => {
        try {
            const { generateSlotsForNext30Days } = require('./utils/slotGenerator');

            const allDocs = db.prepare("SELECT * FROM doctors").all();

            allDocs.forEach(doc => {
                try {
                    generateSlotsForNext30Days(doc);
                } catch (err) {
                    console.error("Slot error:", err.message);
                }
            });

            console.log("✅ Slots generated successfully");
        } catch (err) {
            console.error("⚠️ Slot generation failed:", err.message);
        }
    });

    // ---------------- BACKGROUND JOB ----------------
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
                    LIMIT 20
                `).all(now);
            } catch (dbErr) {
                console.error("DB error:", dbErr.message);
                return;
            }

            if (!pendingReminders.length) return;

            for (const reminder of pendingReminders) {
                try {
                    await sendWhatsAppMessage(
                        reminder.patient_phone,
                        reminder.message
                    );

                    db.prepare("UPDATE reminders SET status = 'sent' WHERE id = ?")
                        .run(reminder.id);

                } catch (err) {
                    console.error("Reminder send failed:", err.message);
                }
            }

        } catch (err) {
            console.error("Background job error:", err.message);
        }
    }, 30000);
});