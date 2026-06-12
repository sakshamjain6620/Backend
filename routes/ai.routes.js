const express = require('express');
const router = express.Router();
const { processAIChat, getPatientSymptomSummary } = require('../controllers/ai.controller');

router.post('/chat', processAIChat);
router.post('/summary', getPatientSymptomSummary);

module.exports = router;
