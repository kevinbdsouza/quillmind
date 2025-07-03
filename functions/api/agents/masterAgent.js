import { handleStandardChat } from './standardAgent';
import { handleRagChat } from './ragAgent';
import { error, json } from '../utils';
import axios from 'axios';

const getRoutingChoice = async (text, context, apiKey) => {
    const contextProvided = context && context.files && context.files.length > 0;

    const prompt = `You are a master routing agent. Your job is to classify a user's query into one of two categories based on the query and whether file context is provided.

Categories:
1. 'rag': The query requires searching across the entire project's files to be answered properly. This is for questions about how different parts of the code interact, broad project-level questions, or questions about files that are NOT provided in the context.
2. 'standard': The query is a general conversation topic OR it can be answered using ONLY the specific file context that has been provided by the user.

**Analysis:**
- **User Query:** "${text}"
- **File Context Provided:** ${contextProvided ? 'Yes' : 'No'}

**Decision Logic:**
- If the query is general (e.g., "hello", "what is react?"), choose 'standard'.
- If File Context is 'Yes' and the query is about that context (e.g., "explain this function", "what does this code do?"), choose 'standard'.
- If the query is about the project but requires knowledge beyond the provided context (e.g., "how does authentication work?", "where is this function used?"), choose 'rag'.
- If File Context is 'No' and the query is about the project, choose 'rag'.

Respond with only the single word: 'rag' or 'standard'.`;

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
        console.log(`Routing choice for query "${text}" (Context Provided: ${contextProvided}): ${choice.trim()}`);
        return choice.trim().toLowerCase();
    } catch (err) {
        console.error(`[AI ERROR] in Master Agent Routing:`, err.response?.data || err.message);
        // Default to standard agent on routing failure
        return 'standard';
    }
}

export const routeRequest = async (body, env, user) => {
    const { text, action, context } = body;
    const apiKey = env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error('GEMINI_API_KEY is not set in the environment variables.');
        return error(500, { message: 'AI service configuration error.' });
    }

    // Explicitly handle the summarization action
    if (action === 'summarize_for_title') {
        console.log('Routing to Standard Agent for title summarization');
        // Use a specific prompt for summarization
        const summarizationBody = {
            ...body,
            text: `Summarize the following text into a short, concise chat title (3-5 words). Do not use quotes. Text: "${text}"`
        };
        return await handleStandardChat(summarizationBody, env, user);
    }
    
    const choice = await getRoutingChoice(text, context, apiKey);

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
