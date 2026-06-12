const express = require('express');
const router = express.Router();
const { getPatientMedicineRoutine, markMedicineTaken, getMedicineLogs, allotMedicine } = require('../controllers/medicine.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');

router.post('/allot', verifyToken, requireRole('admin'), allotMedicine);
router.get('/routine/patient/:patientId', verifyToken, getPatientMedicineRoutine);
router.put('/routine/:routineId/take', verifyToken, markMedicineTaken);
router.get('/logs/patient/:patientId', verifyToken, getMedicineLogs);

module.exports = router;
