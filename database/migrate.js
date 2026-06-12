const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'swasthsetu.db');
const db = new Database(dbPath, { verbose: console.log });

console.log("Starting database migration...");

try {
    // 1. Add appointment_code column to appointments if it doesn't exist
    try {
        db.exec(`ALTER TABLE appointments ADD COLUMN appointment_code TEXT UNIQUE`);
        console.log("Column 'appointment_code' added successfully.");
    } catch (err) {
        if (err.message.includes("duplicate column name")) {
            console.log("Column 'appointment_code' already exists.");
        } else {
            console.error("Error adding column 'appointment_code':", err.message);
        }
    }

    // 2. Create slots table
    db.exec(`
        CREATE TABLE IF NOT EXISTS slots (
            id TEXT PRIMARY KEY,
            doctor_id TEXT REFERENCES doctors(id) ON DELETE CASCADE,
            slot_date TEXT NOT NULL, -- YYYY-MM-DD
            slot_time TEXT NOT NULL, -- HH:MM
            max_patients INTEGER NOT NULL DEFAULT 10,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    console.log("Table 'slots' created or already exists.");
    
    console.log("Database migration completed successfully.");
} catch (error) {
    console.error("Migration failed:", error);
} finally {
    db.close();
}
