const express = require('express');
const router = express.Router();
const { createPrescription, getPrescriptionById, getPatientPrescriptions, downloadPrescriptionPDF } = require('../controllers/prescription.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');

router.post('/', verifyToken, requireRole('admin'), createPrescription);
router.get('/patient/:patientId', verifyToken, getPatientPrescriptions);
router.get('/:id', verifyToken, getPrescriptionById);
router.get('/:id/pdf', verifyToken, downloadPrescriptionPDF);

module.exports = router;
