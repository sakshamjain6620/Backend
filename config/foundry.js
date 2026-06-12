require('dotenv').config();

const foundryConfig = {
    endpoint: process.env.FOUNDRY_ENDPOINT || '',
    apiKey: process.env.FOUNDRY_API_KEY || '',
    useMock: !process.env.FOUNDRY_ENDPOINT || process.env.FOUNDRY_ENDPOINT.includes('placeholder')
};

module.exports = foundryConfig;
