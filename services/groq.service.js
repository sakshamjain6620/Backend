const axios = require('axios');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Query GROQ with a user prompt.
 * @param {string} prompt
 * @returns {Promise<string>}
 */
async function queryGROQ(prompt) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error('GROQ_API_KEY not set in environment');
  }

  const payload = {
    model: 'llama-3.1-8b-instant',

    response_format: {
      type: "json_object"
    },

    messages: [
      {
        role: "system",
        content: `
You are SwasthSetu Healthcare AI.

You MUST respond ONLY with valid JSON.

Never explain.
Never use markdown.
Never use text outside JSON.

Example:

{
  "user_message":"Based on your symptoms you should consult a General Physician.",
  "structured_data":{
    "actionHint":"select_doctor",
    "specialization":"General Physician",
    "urgency":"medium",
    "recommendedDoctors":[
      {
        "id":"1",
        "name":"Dr Test",
        "specialization":"General Physician",
        "fee":500
      }
    ]
  }
}

If user says headache:
specialization = Neurologist

If user says chest pain:
specialization = Cardiologist

Output ONLY JSON.
`
      },
      {
        role: "user",
        content: prompt
      }
    ],

    temperature: 0.2
  };

  const res = await axios.post(
    GROQ_API_URL,
    payload,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return res.data.choices[0].message.content;
}

module.exports = { queryGROQ };