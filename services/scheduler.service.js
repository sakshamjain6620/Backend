const cron = require('node-cron');
const db = require('../config/db');
const { sendWhatsAppMessage } = require('./whatsapp.service');

// Variable to track if a job is currently running to prevent overlap
let isProcessing = false;

/**
 * Processes pending reminders and sends WhatsApp messages.
 */
const processPendingReminders = async () => {
    if (isProcessing) {
        console.log("⏳ [Scheduler] Previous job still running, skipping this tick.");
        return;
    }

    isProcessing = true;
    try {
        const now = new Date().toISOString();

        // Fetch up to 20 pending reminders that are scheduled for now or the past
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
            console.error("❌ [Scheduler] DB fetch error:", dbErr.message);
            isProcessing = false;
            return;
        }

        if (!pendingReminders.length) {
            isProcessing = false;
            return;
        }

        console.log(`\n🕒 [Scheduler] Processing ${pendingReminders.length} pending reminder(s)...`);

        for (const reminder of pendingReminders) {
            try {
                // IMPORTANT: Idempotency check. Send message first.
                const success = await sendWhatsAppMessage(
                    reminder.patient_phone,
                    reminder.message
                );

                if (success) {
                    // Update to 'sent' ONLY if Twilio returned success
                    db.prepare("UPDATE reminders SET status = 'sent' WHERE id = ?").run(reminder.id);
                    console.log(`✅ [Scheduler] Marked reminder ${reminder.id} as sent.`);
                } else {
                    // If Twilio failed, we can either retry or mark as failed.
                    // For now, let's mark as failed so it doesn't get stuck in an infinite retry loop 
                    // or implement a retry_count. Let's mark as failed.
                    db.prepare("UPDATE reminders SET status = 'failed' WHERE id = ?").run(reminder.id);
                    console.error(`❌ [Scheduler] Failed to send reminder ${reminder.id}, marked as failed.`);
                }
            } catch (err) {
                console.error(`❌ [Scheduler] Error processing reminder ${reminder.id}:`, err.message);
            }
        }
    } catch (err) {
        console.error("❌ [Scheduler] Critical error in processing job:", err.message);
    } finally {
        isProcessing = false;
    }
};

/**
 * Initializes the cron jobs for background tasks
 */
const initCronJobs = () => {
    console.log("⏰ [Scheduler] Initializing cron jobs...");
    
    // Run every minute: * * * * *
    cron.schedule('* * * * *', () => {
        processPendingReminders();
    });

    console.log("⏰ [Scheduler] Node-Cron scheduled to process reminders every 1 minute.");
};

module.exports = {
    initCronJobs
};
