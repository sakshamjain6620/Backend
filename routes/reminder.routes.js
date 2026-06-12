const express = require('express');
const router = Router = express.Router();
const { getPatientReminders, getPendingReminders, triggerReminderSend, checkAndSendMissedMedicineReminders } = require('../controllers/reminder.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');

router.get('/patient/:patientId', verifyToken, getPatientReminders);
router.get('/pending', verifyToken, requireRole('admin'), getPendingReminders);
router.put('/:id/send', verifyToken, requireRole('admin'), triggerReminderSend);
router.post('/check-medicines', verifyToken, checkAndSendMissedMedicineReminders);

module.exports = router;
