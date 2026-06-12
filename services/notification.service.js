const { sendWhatsAppMessage } = require('./whatsapp.service');

/**
 * Sends an instant appointment confirmation message via WhatsApp.
 * This skips the database polling and sends the message synchronously.
 */
const sendAppointmentConfirmationMessage = async (appointment, patient, doctor) => {
    try {
        const tokenStr = appointment.token_no ? `🎫 Token No: ${appointment.token_no}` : '';
        const codeStr = appointment.appointment_code ? `📋 Code: ${appointment.appointment_code}` : '';
        
        const message = `✅ Appointment Confirmed!
Hello ${patient.name}, your appointment with Dr. ${doctor.name} (${doctor.specialization}) is booked for ${appointment.appointment_date} at ${appointment.appointment_time}.

${tokenStr}
${codeStr}

Please arrive 10 minutes before your scheduled slot.
- SwasthSetu`;

        const success = await sendWhatsAppMessage(patient.phone, message);
        
        if (success) {
            console.log(`[Notification Service] Successfully sent appointment confirmation to ${patient.phone}`);
        } else {
            console.error(`[Notification Service] Failed to send appointment confirmation to ${patient.phone}`);
        }
        
        return success;
    } catch (err) {
        console.error(`[Notification Service Error] Error sending appointment confirmation:`, err.message);
        return false;
    }
};

module.exports = {
    sendAppointmentConfirmationMessage
};
