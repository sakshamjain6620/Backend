const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { sendSMS } = require('./twilio.service');

/**
 * Mocks sending an email
 */
function mockSendEmail(email, subject, message) {
    console.log('\n==================================================');
    console.log(`📧 [Email Mock Notification]`);
    console.log(`📨 To: ${email}`);
    console.log(`📁 Subject: ${subject}`);
    console.log(`💬 Body: "${message}"`);
    console.log('==================================================\n');
}

const sendAppointmentReminder = (appointment, patient, doctor) => {
    const reminderId = uuidv4();
    const message = `Hello ${patient.name}, your appointment with Dr. ${doctor.name} (${doctor.specialization}) is confirmed for ${appointment.appointment_date} at ${appointment.appointment_time}. Your Token Number is: ${appointment.token_no || 'Will be assigned'}. Appointment Code: ${appointment.appointment_code || 'N/A'}. Thank you for choosing SwasthSetu!`;
    
    mockSendEmail(patient.email, 'Appointment Confirmation - SwasthSetu', message);

    return { id: reminderId, status: 'sent_instantly', sent_via: 'email' };
};

const sendMedicineReminder = (routine, patient, medicineName, dosage, timing) => {
    const reminderId = uuidv4();
    const message = `Hello ${patient.name}, this is a reminder to take your medicine: ${medicineName} (Dose: ${dosage}) scheduled for the ${timing}. Please mark it as taken on your SwasthSetu dashboard after taking it!`;

    // Save to Database as pending for WhatsApp background job
    db.prepare(`
        INSERT INTO reminders (id, patient_id, appointment_id, reminder_type, message, scheduled_time, status, sent_via)
        VALUES (?, ?, ?, 'medicine', ?, ?, 'pending', 'whatsapp')
    `).run(reminderId, patient.id, routine.prescription_id || null, message, new Date().toISOString());

    return { id: reminderId, status: 'pending', sent_via: 'whatsapp' };
};

const sendFollowUpReminder = (record, patient, doctor) => {
    const reminderId = uuidv4();
    const message = `Hello ${patient.name}, this is a follow-up reminder from Dr. ${doctor.name}. Your advice summary: "${record.follow_up_advice}". Please contact us if you need to schedule a follow-up consultation.`;

    // Save to Database as pending for WhatsApp background job
    db.prepare(`
        INSERT INTO reminders (id, patient_id, appointment_id, reminder_type, message, scheduled_time, status, sent_via)
        VALUES (?, ?, ?, 'follow_up', ?, ?, 'pending', 'whatsapp')
    `).run(reminderId, patient.id, record.appointment_id || null, message, new Date().toISOString());

    return { id: reminderId, status: 'pending', sent_via: 'whatsapp' };
};

const sendPaymentReminder = (appointment, patient, doctor) => {
    const reminderId = uuidv4();
    const message = `Dear ${patient.name}, your appointment booking with Dr. ${doctor.name} for ${appointment.appointment_date} at ${appointment.appointment_time} is pending payment of ₹${appointment.amount}. Please complete the payment to secure your slot.`;

    // Save to Database as pending for WhatsApp background job
    db.prepare(`
        INSERT INTO reminders (id, patient_id, appointment_id, reminder_type, message, scheduled_time, status, sent_via)
        VALUES (?, ?, ?, 'payment', ?, ?, 'pending', 'whatsapp')
    `).run(reminderId, patient.id, appointment.id, message, new Date().toISOString());

    return { id: reminderId, status: 'pending', sent_via: 'whatsapp' };
};

module.exports = {
    sendAppointmentReminder,
    sendMedicineReminder,
    sendFollowUpReminder,
    sendPaymentReminder
};
