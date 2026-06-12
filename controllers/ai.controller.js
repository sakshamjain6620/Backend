const { queryGROQ } = require('../services/groq.service');
const { generatePatientSummary, analyzeSymptoms } = require('../services/foundry.service');
const db = require('../config/db');

/**
 * AI Chat Controller
 */
const processAIChat = async (req, res, next) => {
    try {
        const message = req.body?.message;

        if (!message) {
            return res.status(400).json({
                success: false,
                message: 'Message field is required.'
            });
        }

        // 1. Analyze symptoms using Foundry Service
        const analysis = await analyzeSymptoms(message);
        const { urgency, specialization, recommendedReason } = analysis;

        // 2. Query doctors from DB based on specialization
        const query = `SELECT id, name, specialization, fee, experience, avatar_url FROM doctors WHERE specialization LIKE ? AND status = 'active' LIMIT 5`;
        const doctors = db.prepare(query).all(`%${specialization}%`);

        // 3. Build context-rich prompt for Groq
        const contextPrompt = `
User Message: "${message}"

System Context:
- Analyzed Urgency: ${urgency}
- Recommended Specialization: ${specialization}
- Recommended Reason: ${recommendedReason}
- Available Doctors: ${JSON.stringify(doctors)}

Task:
Respond appropriately to the user, acknowledging their symptoms. 
Mention the urgency level and the recommended specialization.
You MUST return your response ONLY as a valid JSON object.
Inside the JSON object, provide the "actionHint" as "select_doctor".
Include the list of available doctors exactly as provided above in the "recommendedDoctors" array inside structured_data.
Ensure the JSON is properly formatted and contains no markdown text outside the JSON.
`;

        // Call GROQ AI
        const groqResponse = await queryGROQ(contextPrompt);

        console.log("🟢 GROQ RAW RESPONSE:", groqResponse);

        let parsedResponse;

        try {
            parsedResponse = JSON.parse(groqResponse);
        } catch (parseErr) {
            parsedResponse = {
                user_message: groqResponse,
                structured_data: null
            };
        }

        console.log("🟢 PARSED RESPONSE:", parsedResponse);

        // Robust message extraction
        const aiMessage =
            parsedResponse?.user_message ||
            parsedResponse?.message ||
            parsedResponse?.response ||
            parsedResponse?.content ||
            (typeof groqResponse === 'string' ? groqResponse : null) ||
            "I'm sorry, I couldn't generate a response.";

        const finalData = {
            message: aiMessage,
            actionHint: parsedResponse?.structured_data?.actionHint,

            ...(parsedResponse?.structured_data || {})
        };

        console.log("🟢 FINAL DATA:", finalData);

        return res.json({
            success: true,
            data: finalData
        });

    } catch (err) {
        console.error('🔥 AI Controller Error:');
        console.error(err.response?.data || err.message || err);

        return res.status(500).json({
            success: false,
            message:
                err.response?.data?.error?.message ||
                err.message ||
                'AI processing error'
        });
    }
};

/**
 * Patient Summary Controller
 */
const getPatientSymptomSummary = async (req, res, next) => {
    try {
        const { symptoms, diagnosis, doctorNotes } = req.body;

        if (!symptoms) {
            return res.status(400).json({
                success: false,
                message: 'Symptoms field is required.'
            });
        }

        const summary = await generatePatientSummary(
            symptoms,
            diagnosis,
            doctorNotes
        );

        return res.json({
            success: true,
            data: { summary }
        });

    } catch (err) {
        console.error('🔥 Summary Controller Error:', err);

        return res.status(500).json({
            success: false,
            message: err.message || 'Summary generation failed'
        });
    }
};

module.exports = {
    processAIChat,
    getPatientSymptomSummary
};