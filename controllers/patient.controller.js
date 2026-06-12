const db = require('../config/db');
const { getFullPatientFile } = require('../services/medicalRecord.service');

const getPatientProfile = (req, res, next) => {
    try {
        const patient = db.prepare("SELECT id, name, age, gender, phone, email, address, emergency_contact, created_at FROM patients WHERE id = ?").get(req.params.id);
        if (!patient) {
            return res.status(404).json({ success: false, message: 'Patient not found.' });
        }
        return res.json({ success: true, data: patient });
    } catch (err) {
        next(err);
    }
};

const getPatientFile = (req, res, next) => {
    try {
        const patientId = req.params.id;

        // Security check: Patients can only view their own file, Doctors/Admins can view any
        if (req.user.role === 'patient' && req.user.id !== patientId) {
            return res.status(403).json({ success: false, message: 'Access denied. You can only access your own file.' });
        }

        const patientFile = getFullPatientFile(patientId);
        return res.json({ success: true, data: patientFile });
    } catch (err) {
        next(err);
    }
};

const updatePatientProfile = (req, res, next) => {
    try {
        const { name, age, gender, phone, address, emergencyContact } = req.body;
        const patientId = req.params.id;

        if (req.user.role === 'patient' && req.user.id !== patientId) {
            return res.status(403).json({ success: false, message: 'Access denied. You can only update your own profile.' });
        }

        const patient = db.prepare("SELECT * FROM patients WHERE id = ?").get(patientId);
        if (!patient) {
            return res.status(404).json({ success: false, message: 'Patient not found.' });
        }

        db.prepare(`
            UPDATE patients 
            SET name = ?, age = ?, gender = ?, phone = ?, address = ?, emergency_contact = ?
            WHERE id = ?
        `).run(
            name || patient.name,
            age ? Number(age) : patient.age,
            gender || patient.gender,
            phone || patient.phone,
            address !== undefined ? address : patient.address,
            emergencyContact !== undefined ? emergencyContact : patient.emergency_contact,
            patientId
        );

        const updated = db.prepare("SELECT id, name, age, gender, phone, email, address, emergency_contact, created_at FROM patients WHERE id = ?").get(patientId);
        return res.json({ success: true, message: 'Profile updated successfully.', data: updated });
    } catch (err) {
        next(err);
    }
};

const getAllPatients = (req, res, next) => {
    try {
        const patients = db.prepare("SELECT id, name, age, gender, phone, email, address, emergency_contact, created_at FROM patients ORDER BY name ASC").all();
        return res.json({ success: true, data: patients });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getPatientProfile,
    getPatientFile,
    updatePatientProfile,
    getAllPatients
};
