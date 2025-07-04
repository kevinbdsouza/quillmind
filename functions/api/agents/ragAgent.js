import { json, error } from '../utils';
import { query } from '../../../api/dbConfig';
import axios from 'axios';
import { getVectorStore } from '../services/cloudflareKVVectorStore';

export const handleRagChat = async (body, env, user) => {
    const { text, history, projectId } = body; // Assuming projectId is passed in the request

    if (!projectId) {
        return error(400, { message: 'Project ID is required for RAG chat.' });
    }

    // 1. Generate embedding for the user's query using Gemini
    const apiKey = env.GEMINI_API_KEY;
    const embeddingModel = 'text-embedding-004';
    const embeddingApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${embeddingModel}:embedContent?key=${apiKey}`;

    let queryVector;
    try {
        const embeddingRequestBody = {
            model: `models/${embeddingModel}`,
            content: {
                parts: [{ text: text }]
            },
            taskType: 'RETRIEVAL_QUERY'
        };

        const embeddingResponse = await axios.post(embeddingApiUrl, embeddingRequestBody, {
            headers: { 'Content-Type': 'application/json' }
        });
        queryVector = embeddingResponse.data.embedding.values;
    } catch (err) {
        console.error(`[AI ERROR] in RAG Agent - Embedding generation failed:`, err.response?.data || err.message);
        const errorMessage = err.response?.data?.error?.message || 'Failed to generate text embedding.';
        return error(err.response?.status || 500, { message: `AI service error: ${errorMessage}` });
    }

    // 2. Query the vector store
    const index = getVectorStore(env);
    const topK = 3; // Number of relevant files to retrieve
    const vectorResponse = await index.query(queryVector, { topK, returnMetadata: true, projectId }, env);

    const matchedFiles = vectorResponse.matches;
    console.log(`Vector search returned ${matchedFiles.length} total matches.`);

    // Filter results to only include files from the current project
    // Coerce both sides to string to avoid strict-equality failures (number vs string)
    const projectIdStr = String(projectId);
    const projectFilteredFiles = matchedFiles.filter(match => 
        match.metadata && String(match.metadata.projectId) === projectIdStr
    );
    
    console.log(`After project filtering: ${projectFilteredFiles.length} matches for project ${projectId}.`);
    
    if (projectFilteredFiles.length > 0) {
        console.log(`Matched files from project ${projectId}:`, 
            projectFilteredFiles.map(match => match.metadata.fileName).join(', ')
        );
    }

    if (projectFilteredFiles.length === 0) {
        // Check if this is because the vector store is empty (no files indexed)
        // vs. no relevant matches found for the query
        return json({ 
            result: "I couldn't find any relevant files in the project to answer your question. " +
                   "This might be because your project hasn't been indexed yet. " +
                   "Try indexing your project first by clicking the 'Index Project' button in the Project Explorer, " +
                   "then ask your question again."
        });
    }

    // 3. Fetch the content of the matched files from D1
    const fileIds = projectFilteredFiles.map(match => match.metadata.fileId);
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

    // 5. Call the Gemini API for chat completion
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
