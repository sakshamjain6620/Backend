const db = require('../config/db');
const { getAvailableSlots } = require('../services/slot.service');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { generateSlotsForNext30Days } = require('../utils/slotGenerator');

const getAllDoctors = (req, res, next) => {
    try {
        const doctors = db.prepare("SELECT id, name, specialization, experience, fee, phone, email, available_days, manual_slots, slot_start_time, slot_end_time, max_patients_per_slot, status, avatar_url, created_at FROM doctors").all();
        // parse available_days JSON
        const formattedDoctors = doctors.map(doc => ({
            ...doc,
            available_days: JSON.parse(doc.available_days || '[]'),
            manual_slots: JSON.parse(doc.manual_slots || '[]')
        }));
        return res.json({ success: true, data: formattedDoctors });
    } catch (err) {
        next(err);
    }
};

const getDoctorById = (req, res, next) => {
    try {
        const doctor = db.prepare("SELECT id, name, specialization, experience, fee, phone, email, available_days, manual_slots, slot_start_time, slot_end_time, max_patients_per_slot, status, avatar_url, created_at FROM doctors WHERE id = ?").get(req.params.id);
        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Doctor not found' });
        }
        doctor.available_days = JSON.parse(doctor.available_days || '[]');
        doctor.manual_slots = JSON.parse(doctor.manual_slots || '[]');
        return res.json({ success: true, data: doctor });
    } catch (err) {
        next(err);
    }
};

const createDoctor = async (req, res, next) => {
    try {
        const { name, specialization, experience, fee, phone, email, password, availableDays, manualSlots, slot_start_time, slot_end_time, max_patients_per_slot, avatar_url } = req.body;
        
        if (!name || !specialization || !email || !password || !slot_start_time || !slot_end_time) {
            return res.status(400).json({ success: false, message: 'Please provide required doctor details.' });
        }

        const existingDoc = db.prepare("SELECT id FROM doctors WHERE email = ?").get(email);
        if (existingDoc) {
            return res.status(400).json({ success: false, message: 'Doctor with this email already exists.' });
        }

        const docId = uuidv4();
        const availableDaysStr = JSON.stringify(availableDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
        const manualSlotsStr = JSON.stringify(manualSlots || []);

        db.prepare(`
            INSERT INTO doctors (id, name, specialization, experience, fee, phone, email, available_days, manual_slots, slot_start_time, slot_end_time, max_patients_per_slot, avatar_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(docId, name, specialization, Number(experience) || 0, Number(fee) || 0, phone || '', email, availableDaysStr, manualSlotsStr, slot_start_time, slot_end_time, Number(max_patients_per_slot) || 10, avatar_url || null);

        const hashedPass = await bcrypt.hash(password, 10);
        db.prepare(`
            INSERT INTO doctor_users (id, doctor_id, email, password)
            VALUES (?, ?, ?, ?)
        `).run(uuidv4(), docId, email, hashedPass);

        const newDoc = db.prepare("SELECT * FROM doctors WHERE id = ?").get(docId);
        newDoc.available_days = JSON.parse(newDoc.available_days || '[]');
        newDoc.manual_slots = JSON.parse(newDoc.manual_slots || '[]');

        // Generate slots automatically for the new doctor
        generateSlotsForNext30Days(newDoc);

        return res.status(201).json({ success: true, message: 'Doctor created successfully', data: newDoc });
    } catch (err) {
        next(err);
    }
};

const updateDoctor = (req, res, next) => {
    try {
        const { name, specialization, experience, fee, phone, email, availableDays, manualSlots, slot_start_time, slot_end_time, max_patients_per_slot, status, avatar_url } = req.body;
        const docId = req.params.id;

        const doctor = db.prepare("SELECT * FROM doctors WHERE id = ?").get(docId);
        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Doctor not found' });
        }

        const availableDaysStr = availableDays ? JSON.stringify(availableDays) : doctor.available_days;
        const manualSlotsStr = manualSlots ? JSON.stringify(manualSlots) : doctor.manual_slots;

        db.prepare(`
            UPDATE doctors 
            SET name = ?, specialization = ?, experience = ?, fee = ?, phone = ?, email = ?, available_days = ?, manual_slots = ?, slot_start_time = ?, slot_end_time = ?, max_patients_per_slot = ?, status = ?, avatar_url = ?
            WHERE id = ?
        `).run(
            name || doctor.name, 
            specialization || doctor.specialization, 
            experience !== undefined ? Number(experience) : doctor.experience, 
            fee !== undefined ? Number(fee) : doctor.fee, 
            phone || doctor.phone, 
            email || doctor.email, 
            availableDaysStr, 
            manualSlotsStr,
            slot_start_time || doctor.slot_start_time, 
            slot_end_time || doctor.slot_end_time, 
            max_patients_per_slot !== undefined ? Number(max_patients_per_slot) : doctor.max_patients_per_slot, 
            status || doctor.status,
            avatar_url || doctor.avatar_url,
            docId
        );

        if (email && email !== doctor.email) {
            db.prepare("UPDATE doctor_users SET email = ? WHERE doctor_id = ?").run(email, docId);
        }

        const updatedDoc = db.prepare("SELECT * FROM doctors WHERE id = ?").get(docId);
        updatedDoc.available_days = JSON.parse(updatedDoc.available_days || '[]');
        updatedDoc.manual_slots = JSON.parse(updatedDoc.manual_slots || '[]');

        // Generate missing slots automatically when updated
        generateSlotsForNext30Days(updatedDoc);

        return res.json({ success: true, message: 'Doctor updated successfully', data: updatedDoc });
    } catch (err) {
        next(err);
    }
};

const deleteDoctor = (req, res, next) => {
    try {
        const docId = req.params.id;
        const doctor = db.prepare("SELECT * FROM doctors WHERE id = ?").get(docId);
        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Doctor not found' });
        }
        
        db.prepare("DELETE FROM doctor_users WHERE doctor_id = ?").run(docId);
        db.prepare("DELETE FROM doctors WHERE id = ?").run(docId);

        return res.json({ success: true, message: 'Doctor deleted successfully' });
    } catch (err) {
        next(err);
    }
};

const getSlotsForDoctor = (req, res, next) => {
    try {
        const docId = req.params.id;
        const dateStr = req.query.date;

        if (!dateStr) {
            return res.status(400).json({ success: false, message: 'Please provide a date query parameter (YYYY-MM-DD)' });
        }

        const availability = getAvailableSlots(docId, dateStr);
        return res.json({ success: true, data: availability });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getAllDoctors,
    getDoctorById,
    createDoctor,
    updateDoctor,
    deleteDoctor,
    getSlotsForDoctor
};
