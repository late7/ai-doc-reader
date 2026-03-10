// Test web search with OpenAI - matching the working market-analysis pattern
import OpenAI from 'openai';
import { readFileSync } from 'fs';

// Parse .env.local manually
const envContent = readFileSync('.env.local', 'utf-8');
for (const line of envContent.split('\n')) {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) process.env[key.trim()] = vals.join('=').trim();
}

async function test() {
    console.log('API Key:', process.env.OPENAI_API_KEY?.slice(0, 20) + '...');
    console.log('Model:', process.env.OPENAI_MODEL || 'gpt-5.4');
    console.log('');

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    console.log('Test 1: Simple web search (matching market-analysis pattern)...');
    try {
        const response = await openai.responses.create({
            model: process.env.OPENAI_MODEL || 'gpt-5.4',
            input: [
                {
                    role: 'developer',
                    content: [{ type: 'input_text', text: 'You are a market research analyst. Be brief.' }],
                },
                {
                    role: 'user',
                    content: [{ type: 'input_text', text: 'Search the web for the current market size of chiral chromatography. Reply in 2 sentences.' }],
                },
            ],
            reasoning: {
                effort: 'medium',
                summary: 'auto',
            },
            text: { format: { type: 'text' } },
            tools: [
                {
                    type: 'web_search_preview',
                    search_context_size: 'medium',
                    user_location: { type: 'approximate', country: 'FI' },
                },
            ],
            store: false,
        });

        console.log('SUCCESS!');
        if (response.output_text) {
            console.log('Response:', response.output_text.slice(0, 300));
        }
    } catch (e) {
        console.log('FAILED:', e.constructor.name, e.message);
        if (e.cause) console.log('Cause:', e.cause.message || e.cause);
    }
}

test();
