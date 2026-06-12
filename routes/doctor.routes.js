const express = require('express');
const router = express.Router();
const { getAllDoctors, getDoctorById, createDoctor, updateDoctor, deleteDoctor, getSlotsForDoctor } = require('../controllers/doctor.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');

router.get('/', getAllDoctors);
router.get('/:id', getDoctorById);
router.get('/:id/slots', getSlotsForDoctor);

// Doctor routes removed as per project requirements
router.post('/', verifyToken, requireRole('admin'), createDoctor);
router.put('/:id', verifyToken, requireRole('admin'), updateDoctor);
router.delete('/:id', verifyToken, requireRole('admin'), deleteDoctor);

module.exports = router;
