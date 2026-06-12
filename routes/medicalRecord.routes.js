const express = require('express');
const router = express.Router();
const { createMedicalRecord, getMedicalRecordById, getPatientMedicalRecords, updateMedicalRecord } = require('../controllers/medicalRecord.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');

router.post('/', verifyToken, requireRole('admin'), createMedicalRecord);
router.get('/patient/:patientId', verifyToken, getPatientMedicalRecords);
router.get('/:id', verifyToken, getMedicalRecordById);
router.put('/:id', verifyToken, requireRole('admin'), updateMedicalRecord);

module.exports = router;
