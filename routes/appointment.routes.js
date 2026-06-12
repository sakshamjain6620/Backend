const express = require('express');
const router = express.Router();
const { 
    createPendingAppointment, 
    getAppointmentById, 
    updateAppointmentStatus, 
    getMyAppointments, 
    getDoctorAppointmentsToday, 
    getAllAppointments 
} = require('../controllers/appointment.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');

router.post('/', verifyToken, createPendingAppointment);
router.get('/my', verifyToken, getMyAppointments);
router.get('/today', verifyToken, requireRole('admin'), getDoctorAppointmentsToday);
router.get('/all', verifyToken, requireRole('admin'), getAllAppointments);
router.get('/:id', verifyToken, getAppointmentById);
router.put('/:id/status', verifyToken, requireRole('admin'), updateAppointmentStatus);

module.exports = router;
