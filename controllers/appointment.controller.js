const db = require('../config/db');
const { getAvailableSlots } = require('../services/slot.service');
const { createOrder } = require('../services/razorpay.service');
const { v4: uuidv4 } = require('uuid');

const createPendingAppointment = async (req, res, next) => {
    try {
        const { doctorId, appointmentDate, appointmentTime, symptoms, urgencyLevel, aiSummary, amount } = req.body;
        const patientId = req.user.id; // From verifyToken middleware

        if (!doctorId || !appointmentDate || !appointmentTime || !amount) {
            return res.status(400).json({ success: false, message: 'Please provide doctorId, date, time, and amount.' });
        }

        // 1. Verify slot availability
        const availability = getAvailableSlots(doctorId, appointmentDate);
        if (!availability.isAvailable) {
            return res.status(400).json({ success: false, message: availability.reason || 'Doctor unavailable on this day.' });
        }

        const targetSlot = availability.slots.find(s => s.time === appointmentTime);
        if (!targetSlot) {
            return res.status(400).json({ success: false, message: `Invalid slot time ${appointmentTime}.` });
        }

        if (targetSlot.available <= 0) {
            return res.status(400).json({ success: false, message: 'This slot is already fully booked. Please choose another slot.' });
        }

        // 2. Token number is initially null. It will be assigned upon check-in.
        const appointmentId = uuidv4();

        // 3. Create pending appointment record
        db.prepare(`
            INSERT INTO appointments (
                id, patient_id, doctor_id, appointment_date, appointment_time, 
                symptoms, urgency_level, ai_summary, token_no, amount, 
                payment_status, appointment_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 'pending', 'pending')
        `).run(
            appointmentId, patientId, doctorId, appointmentDate, appointmentTime,
            symptoms || null, urgencyLevel || 'medium', aiSummary || null, Number(amount)
        );

        // 4. Create Razorpay order for the appointment amount
        const rpOrder = await createOrder(Number(amount), appointmentId);

        // 5. Save payment record (pending) linked to the Razorpay order
        const paymentId = uuidv4();
        db.prepare(`
            INSERT INTO payments (id, appointment_id, patient_id, amount, currency, razorpay_order_id, payment_status)
            VALUES (?, ?, ?, ?, 'INR', ?, 'pending')
        `).run(paymentId, appointmentId, patientId, Number(amount), rpOrder.id);

        // 6. Attach Razorpay order ID to the appointment for later verification
        db.prepare("UPDATE appointments SET razorpay_order_id = ? WHERE id = ?").run(rpOrder.id, appointmentId);

        // 7. Retrieve full appointment with doctor info
        const newAppointment = db.prepare(`
            SELECT a.*, d.name as doctor_name, d.specialization as doctor_specialization 
            FROM appointments a
            JOIN doctors d ON a.doctor_id = d.id
            WHERE a.id = ?
        `).get(appointmentId);

        // 8. Respond with appointment and Razorpay order details for client checkout
        return res.status(201).json({
            success: true,
            message: 'Pending appointment created. Proceed to payment.',
            data: {
                appointment: newAppointment,
                razorpay: {
                    key: process.env.RAZORPAY_KEY_ID || 'rzp_test_SxyTETXvDZEo7l',
                    amount: rpOrder.amount,
                    currency: rpOrder.currency,
                    order_id: rpOrder.id,
                    appointment_id: appointmentId
                }
            }
        });
    } catch (err) {
        next(err);
    }
};

const getAppointmentById = (req, res, next) => {
    try {
        const appointment = db.prepare(`
            SELECT a.*, d.name as doctor_name, d.specialization as doctor_specialization, 
                   p.name as patient_name, p.phone as patient_phone, p.email as patient_email
            FROM appointments a
            JOIN doctors d ON a.doctor_id = d.id
            JOIN patients p ON a.patient_id = p.id
            WHERE a.id = ?
        `).get(req.params.id);

        if (!appointment) {
            return res.status(404).json({ success: false, message: 'Appointment not found.' });
        }

        // Ensure user is authorized to view this appointment
        if (req.user.role === 'patient' && appointment.patient_id !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }
        if (req.user.role === 'doctor' && appointment.doctor_id !== req.user.doctorId) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }

        return res.json({ success: true, data: appointment });
    } catch (err) {
        next(err);
    }
};

const updateAppointmentStatus = (req, res, next) => {
    try {
        const { appointmentStatus, paymentStatus } = req.body;
        const appointmentId = req.params.id;

        const appointment = db.prepare("SELECT * FROM appointments WHERE id = ?").get(appointmentId);
        if (!appointment) {
            return res.status(404).json({ success: false, message: 'Appointment not found.' });
        }

        const newStatus = appointmentStatus || appointment.appointment_status;
        const newPaymentStatus = paymentStatus || appointment.payment_status;

        db.prepare(`
            UPDATE appointments 
            SET appointment_status = ?, payment_status = ? 
            WHERE id = ?
        `).run(newStatus, newPaymentStatus, appointmentId);

        // Generate appointment code ONLY if it's confirmed and doesn't have one
        if (!appointment.appointment_code && newStatus === 'confirmed') {
            const dateObj = new Date();
            const yyyy = dateObj.getFullYear();
            const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
            const dd = String(dateObj.getDate()).padStart(2, '0');
            const prefix = `APT-${yyyy}${mm}${dd}-`;

            const maxApp = db.prepare("SELECT appointment_code FROM appointments WHERE appointment_code LIKE ? ORDER BY appointment_code DESC LIMIT 1").get(`${prefix}%`);
            
            let nextSeq = 1;
            if (maxApp && maxApp.appointment_code) {
                const parts = maxApp.appointment_code.split('-');
                if (parts.length === 3) {
                    nextSeq = parseInt(parts[2], 10) + 1;
                }
            }
            
            const appointmentCode = `${prefix}${String(nextSeq).padStart(3, '0')}`;
            db.prepare("UPDATE appointments SET appointment_code = ? WHERE id = ?").run(appointmentCode, appointmentId);
        }

        const updatedApp = db.prepare("SELECT * FROM appointments WHERE id = ?").get(appointmentId);
        return res.json({ success: true, message: 'Appointment updated successfully.', data: updatedApp });
    } catch (err) {
        next(err);
    }
};

const getMyAppointments = (req, res, next) => {
    try {
        const patientId = req.user.id;
        const appointments = db.prepare(`
            SELECT a.*, d.name as doctor_name, d.specialization as doctor_specialization, d.avatar_url as doctor_avatar
            FROM appointments a
            JOIN doctors d ON a.doctor_id = d.id
            WHERE a.patient_id = ?
            ORDER BY a.appointment_date DESC, a.appointment_time DESC
        `).all(patientId);

        return res.json({ success: true, data: appointments });
    } catch (err) {
        next(err);
    }
};

const getDoctorAppointmentsToday = (req, res, next) => {
    try {
        const doctorId = req.user.doctorId;
        if (!doctorId) {
            return res.status(400).json({ success: false, message: 'Doctor ID not found in profile.' });
        }

        const todayStr = new Date().toISOString().split('T')[0];
        const appointments = db.prepare(`
            SELECT a.*, p.name as patient_name, p.age as patient_age, p.gender as patient_gender
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            WHERE a.doctor_id = ? 
              AND a.appointment_date = ?
              AND (a.appointment_status = 'confirmed' OR a.appointment_status = 'completed')
            ORDER BY a.token_no ASC
        `).all(doctorId, todayStr);

        return res.json({ success: true, data: appointments });
    } catch (err) {
        next(err);
    }
};

const getAllAppointments = (req, res, next) => {
    try {
        const appointments = db.prepare(`
            SELECT a.*, d.name as doctor_name, d.specialization as doctor_specialization, 
                   p.name as patient_name
            FROM appointments a
            JOIN doctors d ON a.doctor_id = d.id
            JOIN patients p ON a.patient_id = p.id
            ORDER BY a.appointment_date DESC, a.appointment_time DESC
        `).all();

        return res.json({ success: true, data: appointments });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    createPendingAppointment,
    getAppointmentById,
    updateAppointmentStatus,
    getMyAppointments,
    getDoctorAppointmentsToday,
    getAllAppointments
};
