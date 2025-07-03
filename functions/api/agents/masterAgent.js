import { handleStandardChat } from './standardAgent';
import { handleRagChat } from './ragAgent'; // To be implemented
import { error, json } from '../utils';
import axios from 'axios';

const getRoutingChoice = async (text, apiKey) => {
    const prompt = `You are a master agent responsible for routing user queries. Your job is to determine if a query is a general chat question or if it requires context from the user's project files.

If the query is about the user's code, files, or project, you should classify it as 'rag'. Examples: "how does the auth work in this project?", "what is the purpose of the file src/components/ChatPanel.jsx", "explain this code".

If the query is a general question, a greeting, or anything not specific to the project files, you should classify it as 'standard'. Examples: "hello", "what is javascript?", "write me a poem".

Respond with only the single word 'rag' or 'standard'.

User Query: "${text}"`;

    const model = 'gemini-1.5-flash';
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            maxOutputTokens: 10,
        }
    };

    try {
        const geminiResponse = await axios.post(apiUrl, requestBody, { headers: { 'Content-Type': 'application/json' } });
        const choice = geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'standard';
        console.log(`Routing choice for query "${text}": ${choice.trim()}`);
        return choice.trim().toLowerCase();
    } catch (err) {
        console.error(`[AI ERROR] in Master Agent Routing:`, err.response?.data || err.message);
        // Default to standard agent on routing failure
        return 'standard';
    }
}

export const routeRequest = async (body, env, user) => {
    const { text, action } = body;
    const apiKey = env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error('GEMINI_API_KEY is not set in the environment variables.');
        return error(500, { message: 'AI service configuration error.' });
    }

    if (action === 'summarize_for_title') {
        console.log('Routing to Standard Agent for title summarization');
        const summarizationBody = {
            ...body,
            text: `Summarize the following text into a short, concise chat title (3-5 words). Do not use quotes. Text: "${text}"`
        };
        return await handleStandardChat(summarizationBody, env, user);
    }
    
    const choice = await getRoutingChoice(text, apiKey);

    let agentResponse;
    if (choice.includes('rag')) {
        console.log('Routing to RAG Agent');
        agentResponse = await handleRagChat(body, env, user);
    } else {
        console.log('Routing to Standard Agent');
        agentResponse = await handleStandardChat(body, env, user);
    }

    // Clone the response to log its body without consuming the original response stream
    try {
        const clonedResponse = agentResponse.clone();
        const responseBody = await clonedResponse.json();
        console.log('Master Agent Output:', JSON.stringify(responseBody, null, 2));
    } catch (e) {
        // This might fail if the response isn't valid JSON, but we don't want to break the request.
        console.error('Could not log master agent output:', e);
    }

    return agentResponse;
};
