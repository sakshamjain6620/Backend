const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

function generateSlotsForNext30Days(doctor) {
    if (!doctor) return;
    
    let manualSlots = [];
    let availableDays = [];
    
    try {
        manualSlots = typeof doctor.manual_slots === 'string' ? JSON.parse(doctor.manual_slots) : doctor.manual_slots;
        availableDays = typeof doctor.available_days === 'string' ? JSON.parse(doctor.available_days) : doctor.available_days;
    } catch (e) {
        return;
    }

    if (!Array.isArray(manualSlots) || manualSlots.length === 0) return;
    if (!Array.isArray(availableDays) || availableDays.length === 0) return;

    const daysMap = { 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };
    const targetDays = availableDays.map(d => daysMap[d]);

    const today = new Date();
    
    // Fetch existing slots to avoid duplicates
    const existingStmt = db.prepare("SELECT slot_date, slot_time FROM slots WHERE doctor_id = ?");
    const existingRecords = existingStmt.all(doctor.id);
    const existingSet = new Set(existingRecords.map(r => `${r.slot_date}_${r.slot_time}`));

    const insertStmt = db.prepare(`
        INSERT INTO slots (id, doctor_id, slot_date, slot_time, max_patients, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
    `);

    try {
        db.transaction(() => {
            for (let i = 0; i < 30; i++) {
                const date = new Date(today);
                date.setDate(today.getDate() + i);
                const dayOfWeek = date.getDay();
                
                if (targetDays.includes(dayOfWeek)) {
                    const dateStr = date.toISOString().split('T')[0];
                    
                    for (const time of manualSlots) {
                        const key = `${dateStr}_${time}`;
                        if (!existingSet.has(key)) {
                            insertStmt.run(uuidv4(), doctor.id, dateStr, time, doctor.max_patients_per_slot || 10);
                            existingSet.add(key); // prevent duplicates within transaction
                        }
                    }
                }
            }
        })();
        console.log(`Successfully generated slots for Dr. ${doctor.name}`);
    } catch (err) {
        console.error("Failed to generate slots:", err);
    }
}

module.exports = { generateSlotsForNext30Days };
