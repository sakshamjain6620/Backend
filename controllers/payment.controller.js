const db = require('../config/db');
const { createOrder, verifySignature } = require('../services/razorpay.service');
const { sendAppointmentReminder } = require('../services/reminder.service');
const { sendWhatsAppMessage } = require('../services/whatsapp.service');
const { v4: uuidv4 } = require('uuid');

const generatePaymentOrder = async (req, res, next) => {
    try {
        const { appointmentId } = req.body;
        if (!appointmentId) {
            return res.status(400).json({ success: false, message: 'Appointment ID is required.' });
        }

        const appointment = db.prepare("SELECT * FROM appointments WHERE id = ?").get(appointmentId);
        if (!appointment) {
            return res.status(404).json({ success: false, message: 'Appointment not found.' });
        }

        // Create Razorpay Order
        const amountInRupees = appointment.amount;
        const rpOrder = await createOrder(amountInRupees, appointmentId);

        // Save Payment record
        const paymentId = uuidv4();
        db.prepare(`
            INSERT INTO payments (id, appointment_id, patient_id, amount, currency, razorpay_order_id, payment_status)
            VALUES (?, ?, ?, ?, 'INR', ?, 'pending')
        `).run(paymentId, appointmentId, appointment.patient_id, amountInRupees, rpOrder.id);

        // Update appointment with Razorpay Order ID
        db.prepare("UPDATE appointments SET razorpay_order_id = ? WHERE id = ?").run(rpOrder.id, appointmentId);

        return res.json({
            success: true,
            message: 'Razorpay order created successfully.',
            data: {
                key: process.env.RAZORPAY_KEY_ID || 'rzp_test_SxyTETXvDZEo7l',
                amount: rpOrder.amount,
                currency: rpOrder.currency,
                order_id: rpOrder.id,
                appointment_id: appointmentId
            }
        });
    } catch (err) {
        next(err);
    }
};

const verifyPayment = async (req, res, next) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, appointmentId } = req.body;
        
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !appointmentId) {
            return res.status(400).json({ success: false, message: 'All signature verification fields are required.' });
        }

        const isValid = verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);

        if (isValid) {
            // Update Payments Table
            db.prepare(`
                UPDATE payments 
                SET payment_status = 'paid', razorpay_payment_id = ?, razorpay_signature = ? 
                WHERE razorpay_order_id = ?
            `).run(razorpay_payment_id, razorpay_signature, razorpay_order_id);

            // Update Appointments Table
            db.prepare(`
                UPDATE appointments 
                SET payment_status = 'paid', appointment_status = 'confirmed', razorpay_payment_id = ? 
                WHERE id = ?
            `).run(razorpay_payment_id, appointmentId);

            // Retrieve appointment, patient and doctor details
            const appointment = db.prepare("SELECT * FROM appointments WHERE id = ?").get(appointmentId);
            const patient = db.prepare("SELECT * FROM patients WHERE id = ?").get(appointment.patient_id);
            const doctor = db.prepare("SELECT * FROM doctors WHERE id = ?").get(appointment.doctor_id);

            // Auto-assign token number based on confirmed appointments for this doctor+date
            const tokenCount = db.prepare(`
                SELECT COUNT(*) as count FROM appointments 
                WHERE doctor_id = ? AND appointment_date = ? 
                AND appointment_status = 'confirmed' AND id != ?
            `).get(appointment.doctor_id, appointment.appointment_date, appointmentId);
            const tokenNo = (tokenCount.count || 0) + 1;
            db.prepare("UPDATE appointments SET token_no = ? WHERE id = ?").run(tokenNo, appointmentId);
            appointment.token_no = tokenNo;

            // Generate appointment code if it doesn't exist
            let appointmentCode = appointment.appointment_code;
            if (!appointmentCode) {
                const docNameClean = doctor.name.replace(/^Dr\.?\s*/i, '');
                const docInitials = docNameClean.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'DR';
                
                const d = new Date(appointment.appointment_date);
                const dateStr = `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth()+1).padStart(2, '0')}${String(d.getFullYear()).slice(2)}`;
                const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
                
                appointmentCode = `${docInitials}-${dateStr}-${randomStr}`;
                db.prepare("UPDATE appointments SET appointment_code = ? WHERE id = ?").run(appointmentCode, appointmentId);
                appointment.appointment_code = appointmentCode;
            }

            // Send WhatsApp confirmation with payment success and token number
            const waMsg = `✅ Payment confirmed! Your appointment with Dr. ${doctor.name} on ${appointment.appointment_date} at ${appointment.appointment_time} is booked.\n\n🎫 Token No: ${tokenNo}\n📋 Code: ${appointment.appointment_code}\n\nPlease arrive 10 minutes before your slot. - SwasthSetu`;
            sendWhatsAppMessage(patient.phone, waMsg);

            // Send Appointment reminder on WhatsApp and Email
            sendAppointmentReminder(appointment, patient, doctor);

            return res.json({
                success: true,
                message: 'Payment verified and appointment confirmed.',
                data: {
                    appointmentId,
                    tokenNo: tokenNo,
                    paymentId: razorpay_payment_id
                }
            });
        } else {
            // Update payments table to failed
            db.prepare("UPDATE payments SET payment_status = 'failed' WHERE razorpay_order_id = ?").run(razorpay_order_id);
            db.prepare("UPDATE appointments SET payment_status = 'failed', appointment_status = 'cancelled' WHERE id = ?").run(appointmentId);

            return res.status(400).json({
                success: false,
                message: 'Payment signature verification failed. Transaction marked as failed.'
            });
        }
    } catch (err) {
        next(err);
    }
};

const getPaymentByAppointmentId = (req, res, next) => {
    try {
        const payment = db.prepare("SELECT * FROM payments WHERE appointment_id = ?").get(req.params.appointmentId);
        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment record not found.' });
        }
        return res.json({ success: true, data: payment });
    } catch (err) {
        next(err);
    }
};

const getAllPayments = (req, res, next) => {
    try {
        const payments = db.prepare(`
            SELECT pay.*, p.name as patient_name, d.name as doctor_name 
            FROM payments pay
            JOIN patients p ON pay.patient_id = p.id
            JOIN appointments a ON pay.appointment_id = a.id
            JOIN doctors d ON a.doctor_id = d.id
            ORDER BY pay.created_at DESC
        `).all();
        return res.json({ success: true, data: payments });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    generatePaymentOrder,
    verifyPayment,
    getPaymentByAppointmentId,
    getAllPayments
};
