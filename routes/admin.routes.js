const express = require('express');
const router = express.Router();
const { 
    getDashboardStats, getRevenueAnalytics, getFilteredAppointments, 
    searchPatients, updatePatient, getPendingRemindersForPatient, 
    getSlots, createSlot, updateSlot, deleteSlot,
    verifyAppointmentCode, getTodayAppointments, generateQueue
} = require('../controllers/admin.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');

router.get('/stats', verifyToken, requireRole('admin'), getDashboardStats);
router.get('/revenue', verifyToken, requireRole('admin'), getRevenueAnalytics);
router.get('/appointments', verifyToken, requireRole('admin'), getFilteredAppointments);
router.get('/patients', verifyToken, requireRole('admin'), searchPatients);
router.put('/patients/:id', verifyToken, requireRole('admin'), updatePatient);
router.get('/reminders/pending/:patientId', verifyToken, requireRole('admin'), getPendingRemindersForPatient);

router.get('/slots', verifyToken, requireRole('admin'), getSlots);
router.post('/slots', verifyToken, requireRole('admin'), createSlot);
router.put('/slots/:id', verifyToken, requireRole('admin'), updateSlot);
router.delete('/slots/:id', verifyToken, requireRole('admin'), deleteSlot);

router.post('/queue/verify', verifyToken, requireRole('admin'), verifyAppointmentCode);
router.post('/queue/generate', verifyToken, requireRole('admin'), generateQueue);
router.get('/appointments/today', verifyToken, requireRole('admin'), getTodayAppointments);

module.exports = router;
