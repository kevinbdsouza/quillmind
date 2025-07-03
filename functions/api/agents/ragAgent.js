import { json, error } from '../utils';
import { query } from '../../../api/dbConfig';
import axios from 'axios';

export const handleRagChat = async (body, env, user) => {
    const { text, history, projectId } = body; // Assuming projectId is passed in the request

    if (!env.VECTORIZE_INDEX) {
        return error(500, { message: "Vector store is not configured for this environment. Please run `npm run dev` with the `--experimental-vectorize-bind-to-prod` flag if you want to test RAG locally." });
    }
    
    if (!projectId) {
        return error(400, { message: 'Project ID is required for RAG chat.' });
    }

    // 1. Generate embedding for the user's query using Workers AI binding directly
    const model = '@cf/baai/bge-base-en-v1.5';
    const response = await env.AI.run(model, { text: [text] });
    const queryVector = response.data[0];

    // 2. Query the Vectorize index
    const index = env.VECTORIZE_INDEX;
    const topK = 3; // Number of relevant files to retrieve
    const vectorResponse = await index.query(queryVector, { topK, returnMetadata: true });

    const matchedFiles = vectorResponse.matches;

    if (matchedFiles.length === 0) {
        // Fallback or just inform the user
        return json({ result: "I couldn't find any relevant files in the project to answer your question." });
    }

    // 3. Fetch the content of the matched files from D1
    const fileIds = matchedFiles.map(match => match.metadata.fileId);
    const placeholders = fileIds.map(() => '?').join(',');
    const filesResult = await query(`SELECT file_id, name, content FROM files WHERE file_id IN (${placeholders})`, fileIds, env);
    const fileContents = filesResult.rows;

    // 4. Construct the prompt
    let contextText = 'Here is the context from relevant files in the project:\n\n';
    contextText += fileContents.map(file => `File: "${file.name}"\n---\n${file.content}\n---\n`).join('\n\n');

    let historyText = '';
    if (history && history.length > 0) {
        historyText = 'Here is the conversation history:\n---\n' + history.map(msg => `${msg.author}: ${msg.text}`).join('\n') + '\n---\n\n';
    }

    const prompt = `${contextText}\n\n${historyText}Based on the provided context and history, answer the user's question:\nUser: ${text}\n---\nAI:`;

    // 5. Call the Gemini API
    const apiKey = env.GEMINI_API_KEY;
    const llmModel = 'gemini-1.5-flash';
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${llmModel}:generateContent?key=${apiKey}`;
    const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
    };

    try {
        const geminiResponse = await axios.post(apiUrl, requestBody, { headers: { 'Content-Type': 'application/json' } });
        const generatedText = geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return json({ result: generatedText });
    } catch (err) {
        console.error(`[AI ERROR] in RAG Agent:`, err.response?.data || err.message);
        const errorMessage = err.response?.data?.error?.message || 'AI request failed.';
        return error(err.response?.status || 500, { message: `AI service error: ${errorMessage}` });
    }
};
