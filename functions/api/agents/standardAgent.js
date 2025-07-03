import axios from 'axios';
import { json, error } from '../utils';

export const handleStandardChat = async (body, env, user) => {
    const { text, context: requestContext, history } = body;

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('GEMINI_API_KEY is not set in the environment variables.');
        return error(500, { message: 'AI service configuration error.' });
    }
    
    let historyText = '';
    if (history && history.length > 0) {
        historyText = 'Here is the conversation history:\n---\n' + history.map(msg => `${msg.author}: ${msg.text}`).join('\n') + '\n---\n\n';
    }

    let fileContextText = '';
    if (requestContext?.files && requestContext.files.length > 0) {
        const fileContents = requestContext.files.map(file => 
            `File: "${file.fileName}"\n---\n${file.fileContent}\n---`
        ).join('\n\n');
        fileContextText = `Given the following file contexts:\n\n${fileContents}\n\n`;
    }

    const prompt = `${fileContextText}${historyText}Now, answer the user's question:\nUser: ${text}\n---\nAI:`;

    const model = 'gemini-1.5-flash'; // Corrected model name

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
    };

    try {
        const geminiResponse = await axios.post(apiUrl, requestBody, { headers: { 'Content-Type': 'application/json' } });
        const generatedText = geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return json({ result: generatedText });
    } catch (err) {
        console.error(`[AI ERROR] in Standard Agent:`, err.response?.data || err.message);
        const errorMessage = err.response?.data?.error?.message || 'AI request failed.';
        return error(err.response?.status || 500, { message: `AI service error: ${errorMessage}` });
    }
};
