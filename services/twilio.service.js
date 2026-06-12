const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER;

let client = null;
if (accountSid && authToken) {
    client = twilio(accountSid, authToken);
    console.log("🟢 Twilio Service initialized successfully.");
} else {
    console.log("🟡 Twilio Service not initialized (Missing environment variables). SMS falls back to console.");
}

const sendSMS = async (to, message) => {
    try {
        if (!client || !twilioNumber) {
            console.log(`[DUMMY SMS] To: ${to} | Message: ${message}`);
            return true;
        }

        // Format phone number (assuming India +91 if not specified)
        let formattedPhone = to.trim();
        if (!formattedPhone.startsWith('+')) {
            formattedPhone = `+91${formattedPhone}`;
        }

        const response = await client.messages.create({
            body: message,
            from: twilioNumber,
            to: formattedPhone
        });

        console.log(`✅ SMS sent successfully to ${formattedPhone} (SID: ${response.sid})`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send SMS to ${to}:`, error.message);
        return false;
    }
};

module.exports = {
    sendSMS
};
