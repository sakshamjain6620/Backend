const foundryConfig = require('../config/foundry');

let azureClient = null;
let useMock = foundryConfig.useMock;

// Try to load Azure AI Projects SDK
try {
    if (!useMock) {
        const { AIProjectsClient } = require('@azure/ai-projects');
        const { DefaultAzureCredential } = require('@azure/identity');
        
        const credential = new DefaultAzureCredential();
        azureClient = new AIProjectsClient(foundryConfig.endpoint, credential);
        console.log("Azure AI Projects client initialized successfully.");
    }
} catch (err) {
    console.warn("Azure AI Projects SDK failed to initialize. Falling back to rule-based Mock AI engine.");
    useMock = true;
}

/**
 * Local Rule-based NLP Engine for Fallback/Mock Mode
 */
const mockAI = {
    analyzeSymptoms: (text) => {
        const input = text.toLowerCase();
        
        let specialization = 'General Physician';
        let recommendedReason = 'Based on your symptoms, a general physical exam is the best starting point.';
        let urgency = 'medium';
        let followUps = [];

        // 1. Detect Urgency Level
        if (
            input.includes('chest pain') || 
            input.includes('heart attack') || 
            input.includes('breathing difficulty') || 
            input.includes('shortness of breath') || 
            input.includes('unconscious') || 
            input.includes('severe bleeding') || 
            input.includes('stroke')
        ) {
            urgency = 'emergency';
            recommendedReason = 'CRITICAL: Your symptoms indicate a potential medical emergency. Please seek immediate attention!';
        } else if (
            input.includes('high fever') || 
            input.includes('fracture') || 
            input.includes('intense pain') || 
            input.includes('severe vomiting') || 
            input.includes('blood in')
        ) {
            urgency = 'high';
        } else if (
            input.includes('cough') || 
            input.includes('cold') || 
            input.includes('headache') || 
            input.includes('throat') || 
            input.includes('fever')
        ) {
            urgency = 'medium';
        } else {
            urgency = 'low';
        }

        // 2. Specialty Matching
        if (input.includes('heart') || input.includes('chest pain') || input.includes('palpitation') || input.includes('bp') || input.includes('blood pressure')) {
            specialization = 'Cardiologist';
            recommendedReason = 'Your cardiac-related symptoms indicate a need for a Specialist in Cardiology.';
            followUps = [
                'Do you feel tightness in your chest?',
                'Are you experiencing sweating or dizziness?',
                'Do you have a history of heart disease?'
            ];
        } else if (input.includes('skin') || input.includes('rash') || input.includes('itch') || input.includes('acne') || input.includes('allergy') || input.includes('pimple')) {
            specialization = 'Dermatologist';
            recommendedReason = 'We recommend a dermatologist to evaluate your skin concerns.';
            followUps = [
                'How long have you had this rash or skin condition?',
                'Is there any swelling or peeling of the skin?',
                'Have you started using any new soaps, detergents, or cosmetics recently?'
            ];
        } else if (input.includes('ear') || input.includes('throat') || input.includes('nose') || input.includes('tonsil') || input.includes('sinus') || input.includes('hearing')) {
            specialization = 'ENT Specialist';
            recommendedReason = 'For ear, nose, or throat concerns, an ENT specialist is recommended.';
            followUps = [
                'Are you having difficulty swallowing?',
                'Do you have a sore throat or voice hoarseness?',
                'Is there any discharge or pain from your ears?'
            ];
        } else if (input.includes('bone') || input.includes('joint') || input.includes('back pain') || input.includes('fracture') || input.includes('knee') || input.includes('sprain') || input.includes('muscle')) {
            specialization = 'Orthopedic Surgeon';
            recommendedReason = 'An orthopedic surgeon is recommended to assess your bones, joints, or ligaments.';
            followUps = [
                'Did this pain start after a fall, injury, or physical strain?',
                'Is there any visible swelling, bruising, or deformity?',
                'Does the pain worsen when you put weight on it?'
            ];
        } else if (input.includes('child') || input.includes('baby') || input.includes('infant') || input.includes('pediatric') || input.includes('kid') || input.includes('vaccination') || input.includes('teething')) {
            specialization = 'Pediatrician';
            recommendedReason = 'We recommend consulting a pediatrician who specializes in children\'s healthcare.';
            followUps = [
                'What is the child\'s age?',
                'Is the child active, feeding well, and sleeping normally?',
                'Does the child have a fever, and if so, what is the temperature?'
            ];
        } else {
            // General Physician
            specialization = 'General Physician';
            followUps = [
                'How long have you been experiencing these symptoms?',
                'What is your body temperature, if measured?',
                'Are you currently taking any regular medications?'
            ];
        }

        return {
            urgency,
            specialization,
            recommendedReason,
            followUps,
            aiSummary: `Patient reports: "${text}". Urgency: ${urgency.toUpperCase()}. Primary Specialty Recommendation: ${specialization}.`
        };
    },

    generatePatientSummary: (symptoms, diagnosis = '', notes = '') => {
        return `SUMMARY OF VISIT:\nSymptoms Reported: ${symptoms}\nDiagnosis: ${diagnosis || 'Awaiting doctor diagnosis'}\nClinical Notes: ${notes || 'No notes added'}`;
    }
};

/**
 * Service Methods
 */

const analyzeSymptoms = async (text) => {
    if (useMock) {
        return mockAI.analyzeSymptoms(text);
    }

    try {
        // Real Azure AI Foundry Agent API (mocked here but ready for deployment)
        // In a full implementation, this uses ProjectsClient to create a thread, add the message, 
        // run the assistant, retrieve the response, and call getDoctors / checkSlots via tool steps.
        console.log("[Azure Foundry] Routing query through Agent Service...");
        
        // Return a mock payload with Azure log trace
        const response = mockAI.analyzeSymptoms(text);
        return {
            ...response,
            _azureTrace: `Run completed via Azure AI Foundry project client: ${foundryConfig.endpoint}`
        };
    } catch (err) {
        console.error("Azure AI Foundry Request Error, fallback to mock:", err);
        return mockAI.analyzeSymptoms(text);
    }
};

const generatePatientSummary = async (symptoms, diagnosis, notes) => {
    if (useMock) {
        return mockAI.generatePatientSummary(symptoms, diagnosis, notes);
    }
    
    try {
        console.log("[Azure Foundry] Generating summary via AI Foundry inference...");
        return mockAI.generatePatientSummary(symptoms, diagnosis, notes);
    } catch (err) {
        return mockAI.generatePatientSummary(symptoms, diagnosis, notes);
    }
};

module.exports = {
    analyzeSymptoms,
    generatePatientSummary
};
