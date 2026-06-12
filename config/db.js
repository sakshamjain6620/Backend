const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const dbPath = path.resolve(process.env.DATABASE_PATH || './database/database.sqlite');
const dbDir = path.dirname(dbPath);

// Ensure database directory exists
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

console.log(`Connecting to database at ${dbPath}...`);
const db = new Database(dbPath, { verbose: console.log });

// Enable foreign keys and WAL mode
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// Initialize schema if tables don't exist
const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='admin_users'").get();

if (!tableCheck) {
    console.log("Database not initialized. Reading schema.sql...");
    const schemaPath = path.resolve(__dirname, '../database/schema.sql');
    try {
        const schema = fs.readFileSync(schemaPath, 'utf8');
        db.exec(schema);
        console.log("Database schema initialized successfully.");
    } catch (err) {
        console.error("Failed to initialize database schema:", err);
        process.exit(1);
    }
} else {
    console.log("Database tables already exist.");
}

module.exports = db;
