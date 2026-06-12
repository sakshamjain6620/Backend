const express = require('express');
const router = express.Router();
const { generatePaymentOrder, verifyPayment, getPaymentByAppointmentId, getAllPayments } = require('../controllers/payment.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');

router.post('/create-order', verifyToken, generatePaymentOrder);
router.post('/verify', verifyToken, verifyPayment);
router.get('/appointment/:appointmentId', verifyToken, getPaymentByAppointmentId);
router.get('/all', verifyToken, requireRole('admin'), getAllPayments);

module.exports = router;
