let twilio;
try {
  twilio = require('twilio');
} catch (e) {
  console.warn('⚠️ Twilio module not installed. WhatsApp functionality will be disabled.');
  twilio = null;
}

let client;
let fromWhatsAppNumber;
let _isInitialized = false;

const initializeWhatsAppClient = () => {
    console.log('Initializing Twilio WhatsApp Client...');
    
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  fromWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER; // e.g., 'whatsapp:+14155238886'

  if (!accountSid || !authToken || !fromWhatsAppNumber) {
    console.warn('⚠️ Twilio credentials missing in .env. WhatsApp messages will NOT be sent.');
    return;
  }

  if (!accountSid.startsWith('AC')) {
    console.warn('⚠️ Twilio ACCOUNT_SID must start with "AC". WhatsApp messages will NOT be sent.');
    return;
  }

    try {
    client = twilio(accountSid, authToken);
    _isInitialized = true;
    console.log('✅ Twilio WhatsApp Client initialized successfully');
    console.log(`   From Number: ${fromWhatsAppNumber}`);
  } catch (error) {
    console.error('❌ Failed to initialize Twilio client:', error.message);
  }
};

/**
 * Sends a WhatsApp message to a specific phone number using Twilio.
 * @param {string} phone - The phone number (e.g., '919876543210' or '+919876543210')
 * @param {string} message - The message body
 */
const sendWhatsAppMessage = async (phone, message) => {
    if (!twilio || !client || !fromWhatsAppNumber) {
    console.log('\n==================================================');
    console.log('📱 [WhatsApp Message - NOT SENT (Twilio not configured)]');
    console.log(`📞 To: ${phone}`);
    console.log(`💬 Message: "${message}"`);
    console.log('==================================================\n');
    return false;
  }

    try {
        // Twilio requires the 'whatsapp:' prefix and a '+' country code.
        let formattedPhone = phone.replace(/\D/g, ''); // strip non-digits
        // If it's a 10 digit Indian number, append 91
        if (formattedPhone.length === 10) {
            formattedPhone = `91${formattedPhone}`;
        }
        
        const toWhatsAppNumber = `whatsapp:+${formattedPhone}`;

        console.log(`📱 Sending WhatsApp to ${toWhatsAppNumber} from ${fromWhatsAppNumber}...`);

        const response = await client.messages.create({
            body: message,
            from: fromWhatsAppNumber,
            to: toWhatsAppNumber
        });

        console.log(`✅ WhatsApp sent to ${formattedPhone} (SID: ${response.sid})`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send WhatsApp to ${phone}:`, error.message);
        // Log the full message so it's not lost
        console.log(`   Message was: "${message}"`);
        return false;
    }
};

/**
 * Returns whether WhatsApp is currently enabled and initialized
 */
const isWhatsAppEnabled = () => {
    return !!twilio && !!client && !!fromWhatsAppNumber && _isInitialized;
};

module.exports = {
  initializeWhatsAppClient,
  sendWhatsAppMessage,
  isWhatsAppEnabled
};
