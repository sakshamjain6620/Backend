const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'swasthsetu_jwt_secret_dev_2024';

const registerPatient = async (req, res, next) => {
    try {
        const { name, age, gender, phone, email, password, address, emergencyContact } = req.body;
        
        if (!name || !age || !gender || !phone || !email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide all required fields.' });
        }

        // Check if patient exists
        const existingPatient = db.prepare("SELECT * FROM patients WHERE email = ?").get(email);
        if (existingPatient) {
            return res.status(400).json({ success: false, message: 'Patient with this email already registered.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const patientId = uuidv4();

        db.prepare(`
            INSERT INTO patients (id, name, age, gender, phone, email, password, address, emergency_contact)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(patientId, name, Number(age), gender, phone, email, hashedPassword, address || null, emergencyContact || null);

        const token = jwt.sign({ id: patientId, email, role: 'patient' }, JWT_SECRET, { expiresIn: '24h' });

        return res.status(201).json({
            success: true,
            message: 'Registration successful',
            data: {
                token,
                user: {

                    id: patientId,
                    name,
                    email,
                    role: 'patient'
                }
            }
        });
    } catch (err) {
        next(err);
    }
};

const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide email and password.' });
        }

        let userRecord = null;
        let role = null;
        let userId = null;

        // 1. Check Admin Users
        const admin = db.prepare("SELECT * FROM admin_users WHERE email = ?").get(email);
        if (admin) {
            userRecord = admin;
            role = admin.role || 'admin';
            userId = admin.id;
        }

        // 2. Check Patients
        if (!userRecord) {
            const patient = db.prepare("SELECT * FROM patients WHERE email = ?").get(email);
            if (patient) {
                userRecord = patient;
                role = 'patient';
                userId = patient.id;
            }
        }
        if (!userRecord) {
            return res.status(401).json({ success: false, message: 'Invalid credentials. No account found with this email.' });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, userRecord.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials. Wrong password.' });
        }

        // Generate token
        const payload = { id: userId, email, role };
        
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

        const profile = { id: userId, name: userRecord.name, email: userRecord.email, role };

        return res.json({
            success: true,
            message: 'Login successful',
            data: {
                token,
                user: profile
            }
        });
    } catch (err) {
        next(err);
    }
};

const getMe = async (req, res, next) => {
    try {
        const { id, role } = req.user;
        let profile = null;

        if (role === 'admin') {
            profile = db.prepare("SELECT id, name, email, role, created_at FROM admin_users WHERE id = ?").get(id);
        } else if (role === 'patient') {
            profile = db.prepare("SELECT id, name, age, gender, phone, email, address, emergency_contact, created_at FROM patients WHERE id = ?").get(id);
            if (profile) {
                profile.role = 'patient';
            }
        }

        if (!profile) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        return res.json({
            success: true,
            data: profile
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    registerPatient,
    login,
    getMe
};
