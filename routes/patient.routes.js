const express = require('express');
const router = express.Router();
const { getPatientProfile, getPatientFile, updatePatientProfile, getAllPatients } = require('../controllers/patient.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');

router.get('/all', verifyToken, requireRole('admin', 'doctor'), getAllPatients);
router.get('/:id', verifyToken, getPatientProfile);
router.get('/:id/file', verifyToken, getPatientFile);
router.put('/:id', verifyToken, updatePatientProfile);

module.exports = router;
