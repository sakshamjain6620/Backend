const db = require('./config/db'); // Uses our initialized database configuration
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function seed() {
    try {
        console.log("Disabling foreign key constraints for seeding...");
        db.pragma('foreign_keys = OFF');

        console.log("Cleaning old data...");
        db.exec("DELETE FROM admin_users");
        db.exec("DELETE FROM doctor_users");
        db.exec("DELETE FROM doctors");
        db.exec("DELETE FROM patients");
        db.exec("DELETE FROM appointments");
        db.exec("DELETE FROM payments");
        db.exec("DELETE FROM medical_records");
        db.exec("DELETE FROM prescriptions");
        db.exec("DELETE FROM prescription_medicines");
        db.exec("DELETE FROM medicine_routines");
        db.exec("DELETE FROM medicine_logs");
        db.exec("DELETE FROM reminders");

        console.log("Re-enabling foreign key constraints...");
        db.pragma('foreign_keys = ON');

        console.log("Seeding Admin User...");
        const adminPass = await bcrypt.hash('admin123', 10);
        db.prepare(`
            INSERT INTO admin_users (id, name, email, password, role)
            VALUES (?, 'Clinic Administrator', 'admin@swasthsetu.health', ?, 'admin')
        `).run(uuidv4(), adminPass);

        console.log("Seeding Doctors...");
        const doctorData = [
            {
                name: 'Rajesh Sharma',
                specialization: 'General Physician',
                experience: 12,
                fee: 500,
                phone: '+91 98765 00001',
                email: 'rajesh@swasthsetu.health',
                availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
                slotStart: '09:00',
                slotEnd: '17:00',
                avatar: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=256&q=80'
            },
            {
                name: 'Priya Patel',
                specialization: 'Cardiologist',
                experience: 15,
                fee: 1000,
                phone: '+91 98765 00002',
                email: 'priya@swasthsetu.health',
                availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                slotStart: '10:00',
                slotEnd: '16:00',
                avatar: 'https://images.unsplash.com/photo-1594824813573-246434de83fb?auto=format&fit=crop&w=256&q=80'
            },
            {
                name: 'Amit Kumar',
                specialization: 'ENT Specialist',
                experience: 8,
                fee: 600,
                phone: '+91 98765 00003',
                email: 'amit@swasthsetu.health',
                availableDays: ['Monday', 'Wednesday', 'Friday'],
                slotStart: '09:00',
                slotEnd: '15:00',
                avatar: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=256&q=80'
            },
            {
                name: 'Sneha Reddy',
                specialization: 'Dermatologist',
                experience: 10,
                fee: 700,
                phone: '+91 98765 00004',
                email: 'sneha@swasthsetu.health',
                availableDays: ['Tuesday', 'Thursday', 'Saturday'],
                slotStart: '11:00',
                slotEnd: '18:00',
                avatar: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=256&q=80'
            },
            {
                name: 'Vikram Singh',
                specialization: 'Orthopedic Surgeon',
                experience: 20,
                fee: 1200,
                phone: '+91 98765 00005',
                email: 'vikram@swasthsetu.health',
                availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'],
                slotStart: '09:00',
                slotEnd: '14:00',
                avatar: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&w=256&q=80'
            },
            {
                name: 'Meera Iyer',
                specialization: 'Pediatrician',
                experience: 7,
                fee: 500,
                phone: '+91 98765 00006',
                email: 'meera@swasthsetu.health',
                availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
                slotStart: '10:00',
                slotEnd: '17:00',
                avatar: 'https://images.unsplash.com/photo-1594824813573-246434de83fb?auto=format&fit=crop&w=256&q=80'
            }
        ];

        const doctorPass = await bcrypt.hash('doctor123', 10);

        for (const doc of doctorData) {
            const docId = uuidv4();
            db.prepare(`
                INSERT INTO doctors (id, name, specialization, experience, fee, phone, email, available_days, slot_start_time, slot_end_time, max_patients_per_slot, avatar_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 10, ?)
            `).run(
                docId, doc.name, doc.specialization, doc.experience, doc.fee, doc.phone, doc.email,
                JSON.stringify(doc.availableDays), doc.slotStart, doc.slotEnd, doc.avatar
            );

            db.prepare(`
                INSERT INTO doctor_users (id, doctor_id, email, password)
                VALUES (?, ?, ?, ?)
            `).run(uuidv4(), docId, doc.email, doctorPass);
        }

        console.log("Seeding Demo Patient...");
        const patientPass = await bcrypt.hash('patient123', 10);
        db.prepare(`
            INSERT INTO patients (id, name, age, gender, phone, email, password, address, emergency_contact)
            VALUES (?, 'Aarav Sharma', 28, 'Male', '+91 98765 98765', 'patient@swasthsetu.health', ?, '45, Skyline Towers, Andheri West, Mumbai', '+91 98765 11111')
        `).run(uuidv4(), patientPass);

        console.log("Database seeded successfully.");
    } catch (err) {
        console.error("Seeding failed:", err);
    } finally {
        db.close();
    }
}

seed();
